/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.95.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BoxingLevel = "beginner" | "intermediate" | "advanced";
type WorkoutType = "quick" | "power" | "endurance" | "technique";

type UserStats = {
  totalWorkouts: number;
  totalMinutes: number;
  currentLevel: string;
  nextLevelProgress: number;
  combosLearned: number;
  currentStreak: number;
  longestStreak: number;
  avgAccuracy: number;
  lastWorkoutDate?: string | null;
};

type RecentSession = {
  workoutName: string;
  difficulty: BoxingLevel;
  workoutType?: WorkoutType;
  completedAt: string;
  difficultyRating?: number; // 1=too easy, 2=just right, 3=too hard
};

type RequestBody = {
  boxingLevel: BoxingLevel;
  workoutType?: WorkoutType;
  workoutHistory: number;
  userStats?: UserStats | null;
  recentSessions?: RecentSession[];
};

const levelGuidelines: Record<
  BoxingLevel,
  {
    focus: string;
    combos: string;
    footwork: string;
    defense: string;
    intensity: string;
    duration: string;
    rounds: string;
    tempo: string;
    examples: string;
  }
> = {
  beginner: {
    focus: "Master fundamentals, build muscle memory, establish proper form",
    combos:
      "2-3 punch combinations maximum. Focus on 1-2, 1-1-2, 1-2-3. Keep it simple and repetitive.",
    footwork:
      "step forward to close range, step back to reset range, lateral step left, lateral step right, pivot on rear foot, return to stance, find jab range",
    defense:
      "slip left, slip right, pull back from punches, keep high guard, chin tucked into lead shoulder, elbows tight to ribs, eyes on opponent's chest (not their fists), return to guard after every combo",
    intensity:
      "Lower intensity, longer rest between rounds (60-90 sec). Focus on form over speed.",
    duration: "15-25 minutes",
    rounds: "5-8 rounds",
    tempo:
      "Slower pace, emphasis on technique. Each punch thrown with intention and proper form.",
    examples:
      "1-2 (Jab-Cross), 1-1-2 (Double Jab-Cross), 1-2-3 (Jab-Cross-Lead Hook), 2-3-2 (Cross-Lead Hook-Cross)",
  },
  intermediate: {
    focus:
      "Develop combinations, increase speed and power, add footwork complexity",
    combos:
      "3-5 punch combinations. Mix levels (body and head). Include uppercuts and multiple hooks.",
    footwork:
      "step-in behind the jab, step-back-and-counter, circle left, circle right, pivot left, pivot right, lateral shuffle, cut the angle, side-step out, pendulum step (bounce between front and back foot), frame-and-step-out (use lead hand as a frame to create space, then step)",
    defense:
      "slip left, slip right, slip-and-counter, roll left under hook, roll right under hook, duck under, parry-counter, pull-counter, shoulder roll, slip back and reset, jab feint to open the guard, cross feint to draw a reaction, level-change feint (fake high then go low), shoulder feint, double jab to clear the guard, counter-jab (slip outside then return jab), counter-cross (slip inside then rip a hook), counter-hook (duck right then come back with cross), hand-fight the lead (parry and trap), catch and shoot (parry the incoming punch with one hand and return fire IMMEDIATELY with the other — e.g., parry the jab with the rear hand and shoot a lead jab back through the gap), block and counter to the body (catch the body hook with the same-side elbow tucked to the ribs, then return with the SAME arm: the block compresses your torso and that compression is the load for your counter hook)",
    intensity:
      "Moderate to high intensity, 45-60 sec rest. Mix speed rounds and power rounds.",
    duration: "25-35 minutes",
    rounds: "8-12 rounds",
    tempo:
      "Faster pace, fluid combinations. Start incorporating rhythm changes and feints.",
    examples:
      "1-2-3-2 (Jab-Cross-Lead Hook-Cross), 1-2b-3 (Jab-Cross body-Lead Hook head), 1-6-3-2b (Jab-Rear Uppercut-Lead Hook-Cross body), 3-2-3-2 (Lead Hook-Cross-Lead Hook-Cross), 1-1-2-5-2 (Double Jab-Cross-Lead Uppercut-Cross)",
  },
  advanced: {
    focus:
      "Master complex patterns, explosive power, fight IQ, conditioning at fight pace",
    combos:
      "5-8 punch combinations with angles and levels. Advanced patterns, setups, and counters.",
    footwork:
      "cut angle mid-combo, switch stance, slide step, L-step, pivot off the hook, explosive directional change, step back to load and return forward, lateral pivot-counter (pivot out while throwing), stutter-step then explode in, frame-and-rotate exit, pendulum reset",
    defense:
      "full shoulder roll, Philly shell (lead shoulder up, rear hand at face), check hook, pull-shift, slip-slip-counter, catch-and-return, roll-and-rip, duck-and-counter, slip back and explode forward, multi-punch defensive sequence (slip-slip-roll), feint then slip, guard trap (pull lead hand down while loading the rear), hand-fight to set up the liver shot, slip-and-frame to control distance, stutter-feint into commit punch, broken-rhythm counter (slow-slow-fast), absorb-and-rip (catch the body hook with same-side elbow, compress and rotate INTO the block to load the hip, then uncoil and rip the same-side hook or uppercut back to head or body — James Toney signature), shell-and-rip (catch on the shoulder via Philly shell, counter immediately from the loaded position), parry-and-cross (catch the jab with the rear hand and return a rear cross down the pipe in the same beat)",
    intensity:
      "High intensity fight simulation, 30-45 sec rest. Competition pace with strategic breaks.",
    duration: "35-45 minutes",
    rounds: "10-15 rounds",
    tempo:
      "Variable pace - explosive bursts, calculated pressure, rhythm breaks. Simulated fight scenarios.",
    examples:
      "1-2-5-2-3-6 (Jab-Cross-Lead Uppercut-Cross-Lead Hook-Rear Uppercut), 1-2b-3b-2 (Jab-Cross body-Lead Hook body-Cross head), 3-6-3-2-1-2 (Lead Hook-Rear Uppercut-Lead Hook-Cross-Jab-Cross), 1-2-3b-6-2 (Jab-Cross-Lead Hook body-Rear Uppercut-Cross), 2-3-2-4-2 (Cross-Lead Hook-Cross-Rear Hook-Cross)",
  },
};

const PUNCH_COUNT_RANGE: Record<BoxingLevel, { min: number; max: number }> = {
  beginner: { min: 2, max: 3 },
  intermediate: { min: 3, max: 5 },
  advanced: { min: 5, max: 8 },
};

function countPunches(notation: string): number {
  return notation
    .split("-")
    .map((s) => s.trim())
    .filter((s) => /^\d+b?$/i.test(s)).length;
}

const workoutSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    duration: { type: "integer" },
    rounds: { type: "integer" },
    combos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          notation: { type: "string" },
        },
        required: ["name", "description", "notation"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "duration", "rounds", "combos"],
  additionalProperties: false,
} as const;

function resolveTypeGuidance(
  workoutType: WorkoutType,
  boxingLevel: BoxingLevel,
  guidelines: (typeof levelGuidelines)[BoxingLevel]
) {
  switch (workoutType) {
    case "quick":
      return {
        guidance:
          "Focus on HIGH INTENSITY, short bursts. 15-20 minutes max. Reduce rest between rounds.",
        duration: "15-20 minutes",
        rounds: "4-6 rounds",
      };
    case "power":
      return {
        guidance:
          "Focus on EXPLOSIVE POWER. Heavy handed combos with focus on impact. Standard rest.",
        duration: guidelines.duration,
        rounds: guidelines.rounds,
      };
    case "endurance":
      return {
        guidance:
          "Focus on STEADY PACE, longer duration. Light combos at moderate intensity. Longer rest periods.",
        duration:
          boxingLevel === "beginner"
            ? "25-35 minutes"
            : boxingLevel === "intermediate"
              ? "35-45 minutes"
              : "45-60 minutes",
        rounds:
          boxingLevel === "beginner"
            ? "8-10 rounds"
            : boxingLevel === "intermediate"
              ? "12-15 rounds"
              : "15-20 rounds",
      };
    case "technique":
      return {
        guidance:
          "Focus on FORM AND PRECISION. Slower pace with emphasis on correct mechanics and footwork. Lots of description.",
        duration:
          boxingLevel === "beginner"
            ? "20-25 minutes"
            : boxingLevel === "intermediate"
              ? "30-40 minutes"
              : "40-50 minutes",
        rounds:
          boxingLevel === "beginner"
            ? "6-8 rounds"
            : boxingLevel === "intermediate"
              ? "10-12 rounds"
              : "12-15 rounds",
      };
  }
}

function buildSystemPrompt(
  boxingLevel: BoxingLevel,
  workoutType: WorkoutType
): string {
  const guidelines = levelGuidelines[boxingLevel];
  const t = resolveTypeGuidance(workoutType, boxingLevel, guidelines);

  return `You are a professional boxing coach with 20+ years of experience training fighters from amateur to professional level. Create a highly specific boxing workout that PERFECTLY matches the skill level.

BOXING NOTATION (Standard):
1 = Jab, 2 = Cross, 3 = Lead Hook, 4 = Rear Hook, 5 = Lead Uppercut, 6 = Rear Uppercut
Append a lowercase "b" to any number when that punch targets the body (e.g., 2b = cross to body, 3b = lead hook to body). Head shots have no suffix.

UNIVERSAL BOXING PRINCIPLES (weave these naturally into descriptions when appropriate for the level):
- Range awareness: name the range when relevant — long/jab range, mid-range, in-fighting range.
- Eye discipline: eyes locked on the opponent's chest or upper sternum, not their fists.
- Breathing: a sharp exhale on every power punch (the "tss" sound); steady nasal breathing between exchanges.
- Setup vs commit punches: the first 1-2 punches of a combo are often light setups (probing jab, double jab to clear the guard); the LAST punch is the commit punch — heavier, fully rotated, finishing the combo.
- Rhythm: most combos should run at a steady tempo, but intermediate+ combos may use broken rhythm (slow-slow-FAST) or stutter-feints to disrupt timing.
- Always reset: after the commit punch, defend (slip, roll, or pull) AND reposition (pivot, step, or cut angle) before the next combo. Never finish a combo standing flat.
- Loading the hip (kinetic engine for catch-and-counter): when you block a body shot with the same-side elbow, your torso naturally compresses and rotates INTO the punch. That compression is the load — uncoiling out of it powers the same-side counter. Same principle applies to a shoulder roll: rotate away to absorb, rotate back to counter. Always counter ON the uncoil, not after a reset, so the energy isn't wasted.

SKILL LEVEL: ${boxingLevel.toUpperCase()}
WORKOUT TYPE: ${workoutType.toUpperCase()} - ${t.guidance}

TRAINING PHILOSOPHY FOR THIS LEVEL:
${guidelines.focus}

COMBINATION GUIDELINES:
${guidelines.combos}

FOOTWORK INTEGRATION:
${guidelines.footwork}

DEFENSIVE TECHNIQUES TO INCLUDE:
${guidelines.defense}

INTENSITY & REST:
${guidelines.intensity}

WORKOUT STRUCTURE FOR ${workoutType.toUpperCase()}:
- Duration: ${t.duration}
- Rounds: ${t.rounds}
- Tempo: ${guidelines.tempo}

EXAMPLE COMBINATIONS FOR THIS LEVEL:
${guidelines.examples}

CRITICAL RULES:
1. PUNCH-COUNT PER COMBO IS MANDATORY. Count the numbers in each notation (a "b" suffix does not add a punch — "2b" is one punch). Allowed ranges:
   - Beginner: 2 to 3 punches per combo.
   - Intermediate: 3 to 5 punches per combo. NEVER generate a 2-punch combo for intermediate. "1-2" is a beginner combo and is FORBIDDEN at intermediate.
   - Advanced: 5 to 8 punches per combo. NEVER generate a combo with fewer than 5 punches for advanced. "1-2-3" is forbidden at advanced.
   Before finalizing each combo, count its punches and verify it falls in the allowed range for the level. If not, regenerate that combo.
2. EVERY combo description MUST include at least one defensive movement AND at least one footwork cue from the DEFENSIVE TECHNIQUES and FOOTWORK INTEGRATION vocabularies above. Weave them naturally into the description — typically a setup move before the punches and an exit/reset move after.

Description style examples (these are the target — match this density of defensive/footwork detail):
- Beginner (notation "1-1-2"): "Step forward with a sharp jab, snap a second jab to keep range, then drive the cross through. Pull back, return to guard."
- Intermediate (notation "2-3-2b"): "Slip right to evade the lead, fire the cross, pivot left as you land the lead hook, then sit down on the cross to the body. Roll right and slip back out of range."
- Advanced (notation "1-2-3b-6-2"): "Step in behind a hard jab, cross down the pipe, lead hook to the body, rip the rear uppercut up the middle, finish with a cross. Slip-slip and cut the angle left, then explode out with a check hook."
3. Each combo description should feel different and realistic for ${boxingLevel}s
4. Include body shots for intermediate/advanced. EVERY body-shot punch MUST get the "b" suffix in the notation (e.g., "1-2b-3" means jab, cross to body, lead hook to head). The description should still mention "body" naturally (e.g., "cross to the body"). Head-shot punches never carry a suffix.
5. Vary the combinations - don't repeat similar patterns
6. Make workout names motivating and level-appropriate
7. Workout type "${workoutType}" guidelines MUST be followed
8. WORKOUT NAME FORMAT RULE (CRITICAL): Format workout names as "TWO WORD STYLE: Rest of Name". The part before the colon MUST be exactly TWO words. Examples: "Power Rush: Build Your Stamina", "Combo Flow: Master Complex Patterns", "Speed Burst: Explosive Training". Never more than 2 words before the colon.
9. VARIETY (CRITICAL): Within this single workout, every combo must teach a distinct concept (pressure, counter, body work, angle creation, defense-to-offense, etc.). No two combos in the same workout should share the same opening two punches — if one combo opens "1-2-...", the next combo must NOT open "1-2-...". Also, never reuse a workout name that appears in the RECENT WORKOUT HISTORY block; invent a fresh name every time.
10. REALISM (CRITICAL): You are a real boxing coach with 20+ years in the gym, not a video game designer. Every combo MUST be: (a) mechanically possible — weight transfers and hip rotation must chain naturally; do NOT chain two consecutive same-side hooks without a reset; do NOT pile up impossible defense + offense sequences in one beat; (b) used by actual fighters at this tier — no invented patterns; (c) anchored in a teaching purpose that fits the user's progression tier. If a combo would only work in a fight game, don't generate it.
11. PROGRESSION (CRITICAL): The user is at the tier stated in the user message. Match that tier exactly. Tier 1 should feel notably simpler than Tier 3. Tier 5 should feel clearly more sophisticated than Tier 4. The user should be able to FEEL their progress when they level up — never coast at the same complexity if the tier number has increased.

The "duration" field is total minutes (integer). The "rounds" field is number of rounds (integer). Each combo needs name, description, and notation (e.g., "1-2-3", or "1-2b-3" for body-shot variants).

ROUND-COMBO PAIRING (MANDATORY): combos.length MUST EQUAL rounds. One distinct combo per round — the user will drill that single combo for the full round before moving on. If you have 8 rounds, you must produce exactly 8 combos. If you have 12 rounds, exactly 12 combos. This is non-negotiable.`;
}

type TierInfo = { number: number; label: string; guidance: string };

function computeTier(
  level: BoxingLevel | undefined,
  nextLevelProgress: number | undefined
): TierInfo {
  const lvl = level ?? "beginner";
  const progress = Math.max(0, Math.min(100, nextLevelProgress ?? 0));
  const sub = progress <= 33 ? 0 : progress <= 66 ? 1 : 2;
  const base = lvl === "beginner" ? 1 : lvl === "intermediate" ? 4 : 7;
  const tier = base + sub;

  const labels: Record<number, string> = {
    1: "Tier 1 — raw beginner (just starting)",
    2: "Tier 2 — mid beginner",
    3: "Tier 3 — late beginner (transitioning toward intermediate)",
    4: "Tier 4 — early intermediate",
    5: "Tier 5 — mid intermediate",
    6: "Tier 6 — late intermediate (transitioning toward advanced)",
    7: "Tier 7 — early advanced",
    8: "Tier 8 — mid advanced",
    9: "Tier 9 — pro-level boxer",
  };

  const guidance: Record<number, string> = {
    1: "Pure fundamentals. Stick to 1-2, 1-1-2, and 1-2-3. Repetition is the lesson — 4-5 combos, each drilled with conviction. Focus on stance, guard, and finishing every combo with a return to guard.",
    2: "Solid beginner core. Mix 1-2, 1-1-2, 1-2-3, 2-3-2, 1-2-2. Introduce the pivot and the lateral step. Variety starts to matter — 5-6 distinct combos per workout.",
    3: "Bridge to intermediate. Full beginner range plus a hint of what's coming: introduce ONE combo with an uppercut (5 or 6), introduce slip-and-step combinations, and use simple cross feints. 6 combos. Hint at counters without breaking the 2–3 punch-count cap.",
    4: "Early intermediate. 3-punch combos dominate, mixed with a couple of 4-punch. Slip-and-counter is the new tool. First body shots appear (1–2 of the 6 combos use the 'b' suffix). Basic feints. 6 combos.",
    5: "Mid intermediate. 4-punch combos dominate, with some 3 and some 5. Multiple feints in the workout. Body work in 2–3 of the combos. Counter-jab and counter-cross appear. Broken rhythm shows up at least once. 6-7 distinct combos.",
    6: "Late intermediate, bridging to advanced. 5-punch combos common. Counters by specific punch type (counter the jab, counter the hook). Pendulum step, frame-and-step-out, hand-fighting. Hint at advanced patterns without exceeding 5 punches. 7 distinct combos.",
    7: "Early advanced. 5-6 punch combos. Multi-level attacks (head-body-head). Check hooks. Basic shoulder roll defense in 1-2 combos. Setup-vs-commit punch structure is deliberate and obvious in the description. 7 distinct combos.",
    8: "Mid advanced. 6-7 punch combos. Signature pro patterns (Crawford-style jab loading, Inoue-style liver setups, Lomachenko angle cuts). Full Philly shell. Guard traps. Multiple feints AND counters chained in one combo. 7-8 distinct combos.",
    9: "Pro level. 7-8 punch combos with multi-range transitions (jab range → mid-range → in-fighting). Complete fight scenarios in each combo. Absorb-and-rip and parry-and-cross used liberally. Stutter-feints into commit punches. Full ring movement implied. 8 distinct combos minimum, all teaching different concepts.",
  };

  return { number: tier, label: labels[tier], guidance: guidance[tier] };
}

function ratingLabel(r?: number): string {
  if (r === 1) return "Too Easy";
  if (r === 2) return "Just Right";
  if (r === 3) return "Too Hard";
  return "unrated";
}

function daysAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diff = Math.max(0, Date.now() - then);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function buildRecentHistoryBlock(sessions: RecentSession[] | undefined): string {
  if (!sessions || sessions.length === 0) return "";

  const lines = sessions
    .slice(0, 5)
    .map(
      (s) =>
        `- ${daysAgo(s.completedAt)}: ${s.difficulty} ${s.workoutType ?? "power"} workout — rated "${ratingLabel(s.difficultyRating)}"`
    )
    .join("\n");

  const rated = sessions.filter((s) => typeof s.difficultyRating === "number");
  const tooEasy = rated.filter((s) => s.difficultyRating === 1).length;
  const tooHard = rated.filter((s) => s.difficultyRating === 3).length;

  let directive = "";
  if (rated.length >= 2) {
    if (tooEasy >= 2 && tooHard === 0) {
      directive =
        "Recent feedback: user found multiple workouts too easy. Push combo complexity to the UPPER end of this level's allowed range, add more variation, and lean toward longer combinations.";
    } else if (tooHard >= 2 && tooEasy === 0) {
      directive =
        "Recent feedback: user found multiple workouts too hard. Stay at the LOWER end of this level's allowed range. Favor fundamentals, simpler footwork, and combos they have seen before.";
    } else {
      directive =
        "Recent feedback is mixed or balanced — match the median complexity of this level. Introduce some fresh combinations to keep the workout varied.";
    }
  }

  return `

RECENT WORKOUT HISTORY (most recent first):
${lines}
${directive ? `\n${directive}` : ""}`;
}

function buildUserPrompt(
  boxingLevel: BoxingLevel,
  workoutHistory: number,
  userStats: UserStats | null | undefined,
  recentSessions?: RecentSession[]
): string {
  const stylePhrase =
    boxingLevel === "beginner"
      ? "simple and focused on fundamentals"
      : boxingLevel === "intermediate"
        ? "more complex with mixed levels and angles"
        : "advanced with complex patterns and fight scenarios";

  const tier = computeTier(userStats?.currentLevel ?? boxingLevel, userStats?.nextLevelProgress);
  const tierBlock = `

PROGRESSION TIER: ${tier.label}
${tier.guidance}`;

  const historyBlock = buildRecentHistoryBlock(recentSessions);

  let personalization = "";
  if (userStats) {
    personalization = `

USER PERSONALIZATION DATA:
- Total Training Sessions: ${userStats.totalWorkouts}
- Total Training Time: ${userStats.totalMinutes} minutes
- Current Level: ${userStats.currentLevel}
- Progress to Next Level: ${userStats.nextLevelProgress}%
- Combos Mastered: ${userStats.combosLearned}
- Current Training Streak: ${userStats.currentStreak} days
- Longest Training Streak: ${userStats.longestStreak} days
- Average Accuracy: ${userStats.avgAccuracy}%
- Last Workout: ${userStats.lastWorkoutDate || "First workout"}

Use this data to:
1. Adjust combo complexity based on combos mastered (${userStats.combosLearned} combos)
2. Consider their accuracy (${userStats.avgAccuracy}%) - if high, add more challenge; if low, focus on fundamentals
3. Reference their streak (${userStats.currentStreak} days) - reward consistency with variety
4. Match workout difficulty to their current level (${userStats.currentLevel}) and progress (${userStats.nextLevelProgress}%)
5. If they're close to leveling up (>80%), introduce slightly harder combinations to prepare them`;
  }

  return `Generate a ${boxingLevel} level boxing workout. User has completed ${workoutHistory} workouts before. Make this workout DISTINCTLY ${boxingLevel} level - it should be ${stylePhrase}.${tierBlock}${historyBlock}${personalization}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const boxingLevel = body.boxingLevel;
  const workoutType: WorkoutType = body.workoutType ?? "power";
  const workoutHistory = body.workoutHistory ?? 0;

  if (!["beginner", "intermediate", "advanced"].includes(boxingLevel)) {
    return new Response(JSON.stringify({ error: "invalid boxingLevel" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = buildSystemPrompt(boxingLevel, workoutType);
  const userPrompt = buildUserPrompt(
    boxingLevel,
    workoutHistory,
    body.userStats,
    body.recentSessions
  );

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      output_config: {
        format: { type: "json_schema", schema: workoutSchema },
      },
    });

    if (response.stop_reason === "refusal") {
      return new Response(JSON.stringify({ error: "refused" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return new Response(JSON.stringify({ error: "empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let workoutData: {
      name: string;
      duration: number;
      rounds: number;
      combos: { name: string; description: string; notation: string }[];
    };
    try {
      workoutData = JSON.parse(block.text);
    } catch {
      return new Response(JSON.stringify({ error: "invalid model JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter combos that violate the punch-count range for this level.
    const range = PUNCH_COUNT_RANGE[boxingLevel];
    const validCombos = workoutData.combos.filter((c) => {
      const n = countPunches(c.notation);
      return n >= range.min && n <= range.max;
    });

    if (validCombos.length < 3) {
      // Too few survived — let the mobile client fall back to its canned workout.
      return new Response(
        JSON.stringify({ error: "combos failed level validation" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Reconcile combos.length with rounds so the user-facing math always works.
    // One distinct combo per round is the contract.
    if (validCombos.length > workoutData.rounds) {
      // Too many — keep the first N to match rounds.
      workoutData.combos = validCombos.slice(0, workoutData.rounds);
    } else if (validCombos.length < workoutData.rounds) {
      // Too few — shrink rounds down to what we have so each round still gets a fresh combo.
      workoutData.rounds = validCombos.length;
      workoutData.combos = validCombos;
    } else {
      workoutData.combos = validCombos;
    }
    return new Response(JSON.stringify(workoutData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

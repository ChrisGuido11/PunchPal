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
type WorkoutMode = "classic" | "dynamic";

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

type FeatureSignal = {
  embeddedDefenseStruggle: boolean;
  embeddedFootworkStruggle: boolean;
  bodyShotStruggle: boolean;
  fourPlusPunchStruggle: boolean;
  embeddedDefenseSuccess: boolean;
  embeddedFootworkSuccess: boolean;
  bodyShotSuccess: boolean;
  fourPlusPunchSuccess: boolean;
};

type RequestBody = {
  boxingLevel: BoxingLevel;
  workoutType?: WorkoutType;
  workoutHistory: number;
  userStats?: UserStats | null;
  recentSessions?: RecentSession[];
  mode?: WorkoutMode;
  at_level_cap?: boolean;
  level_cap_too_easy_count_since_stay?: number;
  recent_combo_signatures?: string[];
  // Adaptive-learning signal (Phase 4.1, 2026-05-24). Derived client-side
  // from punchpal_combo_progress rating counts. Capped to 8 entries each.
  combos_user_struggles_with?: string[];
  combos_user_succeeds_with?: string[];
  // Feature-level signal (Sprint 3/B2, 2026-05-26). Aggregates per-combo
  // ratings across feature dimensions so Claude can pattern-match beyond the
  // notation-exact avoid list.
  feature_signals?: FeatureSignal;
};

// =============================================================================
// v5 notation library (Deno-side mirror of mobile/src/lib/combo-variations.ts)
// =============================================================================

const DEFENSE_MOVES = new Set([
  "slip_left",
  "slip_right",
  "roll_left",
  "roll_right",
  "block_left",
  "block_right",
  "parry_left",
  "parry_right",
]);
const FOOTWORK_MOVES = new Set([
  "pivot_left",
  "pivot_right",
  "step_back",
  "step_in",
  "shuffle_left",
  "shuffle_right",
]);
const FEINT_MOVES = new Set([
  "feint_jab",
  "feint_cross",
  "feint_hook",
  "feint_uppercut",
  "feint_high",
  "feint_low",
]);

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

type Punch = { kind: "punch"; n: number; body: boolean };
type Move = { kind: "defense" | "footwork" | "feint"; move: string };
type Token = Punch | Move;

function tokenFromString(raw: string): Token | null {
  const part = raw.trim().toLowerCase();
  if (!part) return null;
  const m = /^([1-6])(b?)$/.exec(part);
  if (m) return { kind: "punch", n: parseInt(m[1], 10), body: m[2] === "b" };
  if (DEFENSE_MOVES.has(part)) return { kind: "defense", move: part };
  if (FOOTWORK_MOVES.has(part)) return { kind: "footwork", move: part };
  if (FEINT_MOVES.has(part)) return { kind: "feint", move: part };
  return null;
}

function parseCombo(notation: string): Token[] | null {
  if (!notation || !notation.trim()) return null;
  const parts = notation
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 8) return null;
  const tokens: Token[] = [];
  for (const p of parts) {
    const tok = tokenFromString(p);
    if (!tok) return null;
    tokens.push(tok);
  }
  // Consecutive non-punch tokens are ALLOWED at intermediate+ (chained
  // defenses/footwork like slip_right-roll_left or slip-then-pivot). The
  // max-3 non-punch cap below still prevents abuse, and the biomechanical
  // validator only checks defense → IMMEDIATELY-FOLLOWING punch pairs, so
  // chains work correctly.
  let nonPunch = 0;
  let hasPunch = false;
  for (const t of tokens) {
    if (t.kind === "punch") hasPunch = true;
    else nonPunch++;
  }
  if (!hasPunch) return null;
  if (tokens[tokens.length - 1].kind !== "punch") return null;
  if (nonPunch > 3) return null;
  return tokens;
}

function expandForSpeech(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.kind === "punch") {
        const w = NUMBER_WORDS[t.n];
        return t.body ? `${w} to the body` : w;
      }
      return t.move.replace(/_/g, " ");
    })
    .join(", ");
}

function tokenToString(t: Token): string {
  if (t.kind === "punch") return `${t.n}${t.body ? "b" : ""}`;
  return t.move;
}

function serializeCombo(tokens: Token[]): string {
  return tokens.map(tokenToString).join("-");
}

function comboMeta(tokens: Token[]) {
  return {
    punch_count: tokens.filter((t) => t.kind === "punch").length,
    has_body_shot: tokens.some((t) => t.kind === "punch" && t.body),
    has_embedded_defense: tokens.some((t) => t.kind === "defense"),
    has_embedded_footwork: tokens.some((t) => t.kind === "footwork"),
  };
}

// =============================================================================
// Tier guidance + workout-type guidance (preserved from v1)
// =============================================================================

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
      "2-3 punch combinations maximum. Tier 1-2: punches 1-4 (jab, cross, lead hook, rear hook). Tier 3: also unlocks uppercuts (5, 6). PURE PUNCHES ONLY at every beginner tier — no embedded defense or footwork tokens.",
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
      "1-2 (Jab-Cross), 1-1-2 (Double Jab-Cross), 1-2-3 (Jab-Cross-Lead Hook), 2-3-2 (Cross-Lead Hook-Cross), 1-4 (Jab-Rear Hook), 3-4 (Lead Hook-Rear Hook), 1-2-4 (Jab-Cross-Rear Hook). Tier 3 additionally: 1-6 (Jab-Rear Uppercut), 1-5-2 (Jab-Lead Uppercut-Cross), 1-2-6 (Jab-Cross-Rear Uppercut)",
  },
  intermediate: {
    focus:
      "Develop combinations, increase speed and power, add footwork complexity",
    combos:
      "3-5 punch combinations. Mix levels (body and head). Include uppercuts and multiple hooks. LIGHT embedded defense/footwork — typically one slip, pivot, or feint per combo.",
    footwork:
      "step-in behind the jab, step-back-and-counter, circle left, circle right, pivot left, pivot right, lateral shuffle, cut the angle, side-step out, pendulum step, frame-and-step-out",
    defense:
      "slip left, slip right, slip-and-counter, roll left under hook, roll right under hook, duck under, parry-counter, pull-counter, shoulder roll, slip back and reset, jab feint to open the guard, cross feint to draw a reaction, level-change feint, shoulder feint, double jab to clear the guard, counter-jab, counter-cross, counter-hook, catch and shoot, block and counter to the body",
    intensity:
      "Moderate to high intensity, 45-60 sec rest. Mix speed rounds and power rounds.",
    duration: "25-35 minutes",
    rounds: "8-12 rounds",
    tempo:
      "Faster pace, fluid combinations. Start incorporating rhythm changes and feints.",
    examples:
      "1-2-4 (Jab-Cross-Rear Hook), 1-2-3-4 (Jab-Cross-Lead Hook-Rear Hook — the four-punch staple), 1-4-3-2 (Jab-Rear Hook-Lead Hook-Cross), 1-2-3-2 (Jab-Cross-Lead Hook-Cross), 1-2b-3 (Jab-Cross body-Lead Hook head), 1-6-3-2b (Jab-Rear Uppercut-Lead Hook-Cross body), 1-2-slip_right-4 (slip right into rear hook — slip loads rear hip), 2-slip_left-3 (slip left into lead hook — slip loads lead hip), 1-pivot_right-2-3, feint_jab-2b-3 (fake jab → body cross → lead hook), feint_cross-3b-2 (fake cross → body lead hook → cross), feint_hook-2-3 (fake hook → cross → lead hook), feint_uppercut-1-3b (fake uppercut → jab → body lead hook)",
  },
  advanced: {
    focus:
      "Master complex patterns, explosive power, fight IQ, conditioning at fight pace",
    combos:
      "5-8 punch combinations with angles and levels. Advanced patterns, setups, and counters. HEAVY embedded defense/footwork — multiple non-punch tokens per combo where they make tactical sense.",
    footwork:
      "cut angle mid-combo, switch stance, slide step, L-step, pivot off the hook, explosive directional change, step back to load and return forward, lateral pivot-counter, stutter-step then explode in, frame-and-rotate exit, pendulum reset, Lomachenko-style shuffle to angle",
    defense:
      "full shoulder roll, Philly shell, check hook, pull-shift, slip-slip-counter, catch-and-return, roll-and-rip, duck-and-counter, multi-punch defensive sequence (slip-slip-roll), feint then slip, guard trap, slip-and-frame to control distance, stutter-feint into commit punch, broken-rhythm counter (slow-slow-fast), absorb-and-rip, shell-and-rip, parry-and-cross",
    intensity:
      "High intensity fight simulation, 30-45 sec rest. Competition pace with strategic breaks.",
    duration: "35-45 minutes",
    rounds: "10-15 rounds",
    tempo:
      "Variable pace - explosive bursts, calculated pressure, rhythm breaks. Simulated fight scenarios.",
    examples:
      "1-2-slip_right-4-pivot_right-6 (slip right loads rear → rear hook → pivot right exit), 1-2-slip_left-3-pivot_left-5 (slip left loads lead → lead hook → pivot left exit), feint_jab-2b-3b-4 (fake jab, body cross, body lead hook, finish rear hook upstairs), feint_cross-3b-2-4 (fake cross, body lead hook, cross, rear hook finish), feint_hook-2-3b-4 (fake hook, cross, body lead hook, rear hook), feint_uppercut-1-2-3b (fake uppercut, jab, cross, body lead hook), 1-2-roll_right-4-shuffle_left-2 (Lomachenko angle, roll right → rear hook), 2-slip_left-3-roll_right-2 (mirror counter — slip lead, then roll rear), 1-pivot_right-2-4-3 (open angle with pivot right, finish with rear hook + lead hook), feint_cross-3b-2-4 (fake cross to draw the parry, body hook, cross, rear hook finish)",
  },
};

const PUNCH_COUNT_RANGE: Record<BoxingLevel, { min: number; max: number }> = {
  beginner: { min: 2, max: 3 },
  intermediate: { min: 3, max: 5 },
  advanced: { min: 5, max: 8 },
};

const REMINDER_COUNT_RANGE: Record<BoxingLevel, { min: number; max: number }> = {
  beginner: { min: 2, max: 3 },
  intermediate: { min: 3, max: 5 },
  advanced: { min: 4, max: 6 },
};

// =============================================================================
// JSON schemas for Claude (v2)
// =============================================================================

const comboSchema = {
  type: "object",
  properties: {
    notation: { type: "string" },
    expanded_speech: { type: "string" },
    punch_count: { type: "integer" },
    has_body_shot: { type: "boolean" },
    has_embedded_defense: { type: "boolean" },
    has_embedded_footwork: { type: "boolean" },
  },
  required: [
    "notation",
    "expanded_speech",
    "punch_count",
    "has_body_shot",
    "has_embedded_defense",
    "has_embedded_footwork",
  ],
  additionalProperties: false,
} as const;

const reminderSchema = {
  type: "object",
  properties: {
    speech: { type: "string" },
    category: { type: "string", enum: ["form", "punch_correction", "tempo"] },
  },
  required: ["speech", "category"],
  additionalProperties: false,
} as const;

const roundSchema = {
  type: "object",
  properties: {
    round_number: { type: "integer" },
    anchor_combo: comboSchema,
    classic_description: { type: "string" },
    classic_reminders: { type: "array", items: reminderSchema },
    rest_tip: { type: "string" },
  },
  required: [
    "round_number",
    "anchor_combo",
    "classic_description",
    "classic_reminders",
  ],
  additionalProperties: false,
} as const;

const workoutSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    duration: { type: "integer" },
    rounds: { type: "array", items: roundSchema },
  },
  required: ["title", "duration", "rounds"],
  additionalProperties: false,
} as const;

// =============================================================================
// Prompts
// =============================================================================

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
  workoutType: WorkoutType,
  mode: WorkoutMode,
  atLevelCap: boolean,
  reminderRange: { min: number; max: number }
): string {
  const guidelines = levelGuidelines[boxingLevel];
  const t = resolveTypeGuidance(workoutType, boxingLevel, guidelines);

  const modeBlock =
    mode === "classic"
      ? `MODE: CLASSIC (teaching). For each round you must produce:
- ONE anchor combo at the correct tier complexity.
- A 10-12 second classic_description (~30-40 words). It should name the combo's tactical purpose, the key technique points, and the defensive/footwork pattern to maintain. This narrative is spoken aloud after the combo callout.
- ${reminderRange.min}-${reminderRange.max} classic_reminders, each a SHORT cue (≤4 words). Each reminder has a "category": one of "form" (e.g. "chin down", "guard up"), "punch_correction" (e.g. "rotate the hip", "snap the jab"), or "tempo" (e.g. "snap, don't push", "fast hands"). Reminders are spoken evenly across the second half of the round. NEVER repeat the same cue twice in a round. Mix categories.
- Optionally a rest_tip — one short technique tip to play during the rest period before the next round.`
      : `MODE: DYNAMIC (drilling). For each round you must produce:
- ONE strong anchor combo at the correct tier complexity. The mobile client will generate variations from this anchor at runtime; you only need the anchor itself.
- classic_description MUST be an empty string ("").
- classic_reminders MUST be an empty array ([]).
- Optionally a rest_tip — same as Classic.
Anchor selection matters more in Dynamic — pick a combo that has rich variation potential (multiple punches that can be reordered, an embedded move that variations can preserve).`;

  const capStateBlock = atLevelCap
    ? `

USER IS AT LEVEL CAP. They have hit 100% progress for this level and explicitly chose to Stay rather than advance. The user message includes a list of RECENT COMBOS to avoid — enforce that list strictly and additionally:
- Use creative, distinctive workout names that feel different from anything they've seen recently.
- Pull from edge-case combinations within this level's vocabulary — patterns the user has likely not drilled before.
- Lean toward the upper end of complexity for this level (the user is bored at the bottom).`
    : "";

  return `You are a professional boxing coach with 20+ years of experience training fighters from amateur to professional level. Create a highly specific boxing workout that PERFECTLY matches the skill level.

BOXING NOTATION (v5 grammar):

Punches: 1=Jab, 2=Cross, 3=Lead Hook, 4=Rear Hook, 5=Lead Uppercut, 6=Rear Uppercut. Append lowercase "b" for body shots (e.g. "2b" = cross to body).

Embedded defense tokens (8, directional — intermediate+ only):
- slip_left, slip_right
- roll_left, roll_right
- block_left, block_right
- parry_left, parry_right

Embedded footwork tokens (6, directional — intermediate+ only):
- pivot_left, pivot_right
- step_back, step_in
- shuffle_left, shuffle_right

Embedded feint tokens (6, intermediate+ only):
- feint_jab, feint_cross, feint_hook, feint_uppercut
- feint_high, feint_low

GRAMMAR RULES (MANDATORY — invalid combos will be rejected server-side and regenerated):
1. Tokens are joined with "-" hyphens. Example: "1-2-slip_right-3".
2. Combos must END with a punch token. "1-2-slip_right" is INVALID.
3. Consecutive non-punch tokens are ALLOWED at intermediate+ tiers to model real-coach defensive chains (e.g. "1-2-slip_right-roll_left-3" — slip a counter, roll under the next, then commit the lead hook). Each non-punch in the chain is independently legal as long as the MAX 3 non-punch cap holds. The biomechanical rule applies only to the defense token IMMEDIATELY before a punch (in the example above: roll_left → 3, lead-load → lead hook ✓). Beginner combos remain pure-punch (no embedded tokens whatsoever).
4. Total tokens per combo: maximum 8.
5. Non-punch tokens per combo: maximum 3.
6. Beginner-tier combos (T1-T3) contain ONLY punches with optional "b" suffix — NO defense, footwork, or feint tokens whatsoever. Server will reject these.

SPEECH EXPANSION (pre-compute the expanded_speech field for every combo):
- Digits: 1→"one", 2→"two", 3→"three", 4→"four", 5→"five", 6→"six".
- Body suffix "b" becomes " to the body" (e.g. "2b" → "two to the body").
- Embedded tokens: replace underscores with spaces (e.g. "slip_right" → "slip right", "feint_jab" → "feint jab", "step_in" → "step in").
- Join all tokens with ", " (comma-space) — the comma creates natural TTS pacing.
- Example: notation "1-2-slip_right-3" → expanded_speech "one, two, slip right, three".
- Example: notation "feint_jab-2-3" → expanded_speech "feint jab, two, three".
- Example: notation "1-2-roll_left-3b-pivot_right-4" → expanded_speech "one, two, roll left, three to the body, pivot right, four".

UNIVERSAL BOXING PRINCIPLES (weave these naturally into descriptions when appropriate for the level):
- Range awareness: name the range when relevant — long/jab range, mid-range, in-fighting range.
- Eye discipline: eyes locked on the opponent's chest or upper sternum, not their fists.
- Breathing: a sharp exhale on every power punch (the "tss" sound); steady nasal breathing between exchanges.
- Setup vs commit punches: the first 1-2 punches of a combo are often light setups; the LAST punch is the commit punch — heavier, fully rotated, finishing the combo.
- Rhythm: most combos should run at a steady tempo, but intermediate+ combos may use broken rhythm (slow-slow-FAST) or stutter-feints to disrupt timing.
- Always reset: after the commit punch, defend (slip, roll, or pull) AND reposition (pivot, step, or cut angle) before the next combo. Never finish a combo standing flat.
- Loading the hip: when you block a body shot with the same-side elbow, your torso naturally compresses and rotates INTO the punch. That compression is the load — uncoiling out of it powers the same-side counter. Counter ON the uncoil, not after a reset.
- Lomachenko shuffle: when using shuffle_left or shuffle_right in advanced combos, draw inspiration from Lomachenko's signature lateral movement — shuffle to an angle, then punch from the new position. This is different from a pivot (which rotates the stance) and from a step (which is more committed).

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

${modeBlock}${capStateBlock}

CRITICAL RULES:
1. PUNCH-COUNT PER COMBO IS MANDATORY. Count the number of digit tokens in each notation (a "b" suffix does not add a punch — "2b" is one punch; embedded tokens like slip_right don't count as punches). Allowed ranges:
   - Beginner: 2 to 3 punches per combo.
   - Intermediate: 3 to 5 punches per combo. NEVER generate a 2-punch combo for intermediate.
   - Advanced: 5 to 8 punches per combo. NEVER generate a combo with fewer than 5 punches for advanced.
   Before finalizing each combo, count its punches and verify it falls in the allowed range.
2. Each combo description (classic_description) should feel different and realistic for ${boxingLevel}s.
3. Body shots in intermediate/advanced — EVERY body-shot punch MUST get the "b" suffix in the notation. The description should mention "body" naturally.
4. Vary the combinations — don't repeat similar patterns within a workout.
5. Make workout names motivating and level-appropriate.
6. WORKOUT NAME FORMAT (CRITICAL): Format the title as "TWO WORD STYLE: Rest of Name". The part before the colon MUST be exactly TWO words. Examples: "Power Rush: Build Your Stamina", "Combo Flow: Master Complex Patterns".
7. VARIETY (CRITICAL): Within this single workout, every combo must teach a distinct concept. No two combos should share the same opening two punches. Never reuse a workout name that appears in the RECENT WORKOUT HISTORY block; invent a fresh title every time.
8. REALISM (CRITICAL): You are a real boxing coach with 20+ years in the gym. Every combo MUST be (a) mechanically possible — weight transfers and hip rotation chain naturally; (b) used by actual fighters at this tier; (c) anchored in a teaching purpose that fits the tier.
9. PROGRESSION (CRITICAL): The user is at the tier stated in the user message. Match that tier exactly. Tier 1 should feel notably simpler than Tier 3. Tier 5 should feel clearly more sophisticated than Tier 4.

10. BIOMECHANICAL RULE — SLIP/ROLL DIRECTION (MANDATORY, server-validated). Orthodox stance assumed.
   - After slip_right OR roll_right, the next punch MUST be a REAR-hand punch: 2, 4, or 6 (with or without "b" suffix). The right-side slip/roll loads the rear hip; the only natural follow-up is a rear-hand punch.
   - After slip_left OR roll_left, the next punch MUST be a LEAD-hand punch: 1, 3, or 5 (with or without "b" suffix). The left-side slip/roll loads the lead hip.
   - INVALID: "1-slip_right-3" (slip right loads rear, but 3 is a lead hook — breaks form).
   - INVALID: "1-slip_left-2-3" (slip left loads lead, but 2 is a cross — breaks form).
   - VALID: "1-slip_right-2-3" (rear cross fires off the loaded rear hip, then lead hook).
   - VALID: "1-2-slip_left-3" (slip left loads lead, lead hook fires from the loaded lead hip).
   The server will reject any round whose anchor violates this rule. Block_*/parry_*/pivot_*/step_*/shuffle_* are NOT subject to this rule.
   SLIP DIRECTION BALANCE (workout-level): if multiple rounds use slip or roll, mix the directions. slip_right and slip_left should appear with roughly equal frequency across the workout (same for roll). A real coach mixes both sides — never call slip right for the whole workout while ignoring slip left. No single slip direction may dominate more than 60% of slip-using rounds.

11. REAR HOOK (#4) PARITY (MANDATORY for intermediate / advanced). The rear hook is core boxing arsenal and has been historically underrepresented in generated workouts. At intermediate and advanced, at LEAST 30% of the anchor combos in the workout MUST contain a #4 (with or without "b"). Treat #4 with equal weight to #3 — don't default to the lead hook every time. Many of the canonical pro-fighter combos prominently feature the rear hook (1-2-4, 1-3-4, 1-4-3-2, 2-3-4, etc.).

12. FOOTWORK VARIETY (workout-level, MANDATORY). When footwork tokens appear in anchors across the workout:
   - Balance left/right directions. pivot_left and pivot_right should appear with roughly equal frequency. Same for shuffle_left/shuffle_right and step_in/step_back.
   - No single footwork token (e.g. pivot_left) may appear in more than 2 anchor combos in the same workout.
   - Mix the FAMILIES (pivot, step, shuffle) — don't make every round a pivot round. If 3+ rounds need embedded footwork, use at least 2 distinct families across them.
   - This is what makes Dynamic mode feel improvisational rather than scripted.

13. FEINT MECHANICS (MANDATORY, server-validated). A feint is body language that draws a reaction — you fake a punch to make the opponent move their guard, then exploit the opening.
   - Allowed feint tokens: feint_jab, feint_cross, feint_hook, feint_uppercut. DO NOT use feint_high or feint_low — they are deprecated (the speech "feint high" / "feint low" confuses users; always name a specific punch).
   - The feinted punch type MUST NOT be the punch thrown immediately after the feint:
       feint_jab → next punch ≠ 1
       feint_cross → next punch ≠ 2
       feint_hook → next punch ≠ 3 AND ≠ 4
       feint_uppercut → next punch ≠ 5 AND ≠ 6
   - LEVEL MIX (workout-level): mix follow-up TARGETS across the workout. A feint to a head punch ideally draws the guard UP — so the follow-up is often a body shot ("b" suffix). A different round can mix the opposite — fake a hook (which the opponent expects from the side) and follow with a straight to the head. Don't make every feint round produce body shots; vary the follow-up level so the workout teaches both reactions.
   - VARIETY (workout-level): same parrot-repeat rule as footwork. No single feint type may appear in more than 2 anchor combos in one workout. Rotate across feint_jab / feint_cross / feint_hook / feint_uppercut.
   - VALID: feint_jab-2b-3 (fake jab → body cross → lead hook), feint_cross-3b-2 (fake cross → body lead hook → straight cross to head), feint_hook-2-3 (fake hook → cross → lead hook), feint_uppercut-1-3b.
   - INVALID: feint_jab-1-2-3 (same-punch redundancy), feint_high-anything (forbidden token), feint_low-anything (forbidden token).

ROUND-ANCHOR PAIRING (MANDATORY): rounds.length MUST match the number of rounds you produce. Each round has ONE distinct anchor combo (the user drills that anchor for the full round in Classic, and the client generates variations from it in Dynamic). round_number starts at 1 and increments. The "duration" field is total minutes (integer) and should equal rounds.length * 3.`;
}

// =============================================================================
// Tier calculation
// =============================================================================

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
    1: "Pure fundamentals. Use punches 1, 2, 3, 4 (jab, cross, lead hook, rear hook). NO uppercuts (those arrive at Tier 3). NO embedded tokens. Pull from this expanded pool of legal combos so the user doesn't see the same five every regen: 2-punch options (1-2, 1-3, 1-4, 2-1, 2-3, 2-4, 3-1, 3-2, 3-4, 4-1, 4-2, 4-3); 3-punch options (1-1-2, 1-2-3, 1-2-4, 1-3-2, 1-3-4, 1-4-2, 1-4-3, 2-1-2, 2-3-2, 2-3-4, 3-1-2, 3-4-2, 4-2-3, 4-3-2). VARIETY STRATEGY: rotate OPENING punch across rounds (don't always open with the jab — 30%+ of rounds should open with 2, 3, or 4), alternate head-only vs body-dominant workouts (sprinkle 1b/2b/3b/4b body shots), and shuffle the combos so the user gets a different opening combo each regen. Workout titles must feel dramatically different from prior sessions even when underlying combos overlap.",
    2: "Solid beginner core. Same arsenal as Tier 1 — punches 1, 2, 3, 4 only. Lean toward 3-punch combos. Pool to draw from (expanded): 1-2, 1-2b, 1-1-2, 1-2-3, 1-2-3b, 2-3-2, 1-2-2, 1-2-4, 3-4-2, 2-1, 4-2, 3-2-1, 1-3-2, 2-3-4, 4-3-2, 1-4-3, 2-3-1, 4-2-3, 1b-2, 2-1-3, 3-2-1-2 (stretch to 4 punches occasionally). NO uppercuts yet. NO embedded tokens. VARIETY STRATEGY: when the user has seen this pool recently, pull less-used permutations and vary body-shot placement (mid-combo body shots like 1-2b-3 land harder than end-of-combo). Rotate workout titles dramatically — the user should feel a different coach voice each session.",
    3: "Bridge to intermediate. 2-3 punches per combo (stretch to 4 in 1-2 rounds), still NO embedded tokens. Late-beginner UNLOCKS: lead uppercut (5) and rear uppercut (6). Mix uppercuts into combos like 1-6, 2-6, 1-5, 1-2-6, 3-6, 1-5-2, 1-2-5, 2-5-2, 6-3, 5-2, 1-6-2, 1-2-3-6, 1-5-6. Most rounds should feature at least one uppercut so the tier feels like genuine progress over Tier 2. VARIETY STRATEGY: rotate uppercut placement (opener vs finisher vs middle), alternate lead-uppercut-heavy vs rear-uppercut-heavy workouts, and don't always open with the jab. Vary body-vs-head distribution across regens.",
    4: "Early intermediate. 3-punch combos dominate, with some 4-punch. Punches 1-6 are all in use (the arsenal was unlocked across beginner tiers). The NEW content here is EMBEDDED moves — at most ONE slip, pivot, or feint per combo on average. First body shots appear. VARIETY STRATEGY: across regens, rotate WHICH embedded move dominates (one workout slip-led, next pivot-led, next feint-led) and where it sits (early as a setup vs mid as a reaction). Alternate defense-led combos (slip-into-punch) with offense-led combos (punch-then-pivot). Workout titles should signal the tactical theme.",
    5: "Mid intermediate. 4-punch combos dominate. Multiple combos contain ONE embedded move; one combo may stretch to TWO non-punch tokens. Counter-jab and counter-cross appear. Broken rhythm shows up at least once. VARIETY STRATEGY: rotate counter type across regens (counter-jab-led vs counter-cross-led vs counter-hook-led), vary broken-rhythm placement (early vs late in workout), and mix embedded-move categories within a single workout (not all slips, not all pivots). Title themes: 'Counter Punch: ...', 'Broken Rhythm: ...', 'Frame Game: ...' — pick a different one each regen.",
    6: "Late intermediate, bridging to advanced. 5-punch combos common. Most combos contain one or two embedded moves. Pendulum step, frame-and-step-out, hand-fighting. 7 distinct combos. VARIETY STRATEGY: rotate the dominant embedded-move family across regens (slip-heavy → pivot-heavy → pendulum-step-heavy → hand-fighting-heavy). Vary whether body shots arrive early as setups or late as commit punches. Avoid every combo starting with the jab — use the lead hook or cross as opener in 2+ rounds.",
    7: "Early advanced. 5-6 punch combos. Multi-level attacks (head-body-head). Check hooks. Basic shoulder roll defense in 1-2 combos. Embedded tokens become routine — most combos have 2 non-punch tokens. VARIETY STRATEGY: rotate the multi-level pattern across regens (head-body-head vs body-head-body vs alternating-by-round). Vary which pro tool opens the workout — check hooks, shoulder roll counters, straight pressure. Don't anchor every combo on the jab.",
    8: "Mid advanced. 6-7 punch combos. Signature pro patterns (Crawford-style jab loading, Inoue-style liver setups, Lomachenko angle cuts via shuffle_left/shuffle_right). Full Philly shell via block_left+block_right. Guard traps. Multiple embedded moves AND counters chained. VARIETY STRATEGY: each regen should feel like inspiration from a different fighter — one Crawford-flavored (jab loading + switch stance feel), next Inoue-flavored (liver setups + body shots), next Lomachenko-flavored (shuffle + angle cuts). Workout titles should reflect the inspiration without naming the fighter. Avoid repeating the same combo 'shape' across consecutive workouts.",
    9: "Pro level. 7-8 punch combos with multi-range transitions. Complete fight scenarios in each combo. Up to 3 embedded moves per combo. Absorb-and-rip and parry-and-cross used liberally. Stutter-feints into commit punches. 8 distinct combos minimum. VARIETY STRATEGY: every regen should feel like a different fighter's gym session — rotate between high-volume pressure styles, broken-rhythm trickster styles, and counter-puncher styles. Vary range distribution per workout (mostly in-fighting vs mostly out-fighting). Use stutter-feints sparingly across workouts so they remain surprising.",
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
    .map((s) => {
      const namePart = s.workoutName ? `"${s.workoutName}" — ` : "";
      return `- ${daysAgo(s.completedAt)}: ${namePart}${s.difficulty} — rated "${ratingLabel(s.difficultyRating)}"`;
    })
    .join("\n");

  const rated = sessions.filter((s) => typeof s.difficultyRating === "number");
  const tooEasy = rated.filter((s) => s.difficultyRating === 1).length;
  const tooHard = rated.filter((s) => s.difficultyRating === 3).length;

  let directive = "";
  if (rated.length >= 2) {
    if (tooEasy >= 2 && tooHard === 0) {
      directive =
        "Recent feedback: user found multiple workouts too easy. Push combo complexity to the UPPER end of this level's allowed range.";
    } else if (tooHard >= 2 && tooEasy === 0) {
      directive =
        "Recent feedback: user found multiple workouts too hard. Stay at the LOWER end of this level's allowed range. Favor fundamentals.";
    } else {
      directive =
        "Recent feedback is mixed — match the median complexity of this level.";
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
  recentSessions: RecentSession[] | undefined,
  atLevelCap: boolean,
  capCount: number,
  recentSignatures: string[],
  strugglesWith: string[],
  succeedsWith: string[],
  featureSignals: FeatureSignal | null
): string {
  const stylePhrase =
    boxingLevel === "beginner"
      ? "simple and focused on fundamentals"
      : boxingLevel === "intermediate"
        ? "more complex with mixed levels and angles"
        : "advanced with complex patterns and fight scenarios";

  const tier = computeTier(
    (userStats?.currentLevel as BoxingLevel | undefined) ?? boxingLevel,
    userStats?.nextLevelProgress
  );
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
- Last Workout: ${userStats.lastWorkoutDate || "First workout"}`;
  }

  // Variety block: always-on whenever we have recent combos in the ring buffer.
  // These are RAW NOTATIONS (post 2026-05-24 fix; previously FNV-1a hashes which
  // Claude could not interpret). Pre-fix entries may still be 8-char hex
  // garbage — Claude treats them as opaque strings to avoid, which is harmless.
  const varietyBlock =
    recentSignatures.length > 0
      ? `

RECENT COMBOS THE USER HAS DRILLED — DO NOT REPEAT THESE EXACT NOTATIONS:
${recentSignatures.join(", ")}

Generate combos that are genuinely different patterns from the list above. The user has already seen these — picking them again will feel like the AI isn't learning. Find permutations they haven't seen: different opening punch, different ending punch, different rhythm (e.g. doubled jab, body-shot variants, reversed sequences). If the tier's combo universe is small, vary the SETUP and FINISH around the same punches.`
      : "";

  // Adaptive-learning difficulty signal (Phase 4.1). Rendered when either
  // bucket has entries. Sourced from the user's accumulated workout ratings
  // per anchor combo (see punchpal_combo_progress rating-count columns).
  const difficultyBlock =
    strugglesWith.length > 0 || succeedsWith.length > 0
      ? `

USER DIFFICULTY SIGNAL (from rated workout history):
${
  strugglesWith.length > 0
    ? `- Patterns the user has rated TOO HARD repeatedly: ${strugglesWith.join(", ")}.
  Avoid these exact notations. Simplify similar patterns — fewer punches, or remove embedded moves the user is struggling with.`
    : ""
}${
          succeedsWith.length > 0
            ? `
- Patterns the user has rated WELL (Just Right or Too Easy): ${succeedsWith.join(", ")}.
  Similar shapes are appropriate — the user has executed these cleanly. Build on these mechanics.`
            : ""
        }`
      : "";

  const capBlock = atLevelCap
    ? `

LEVEL CAP CONTEXT:
- User is at progress=100 having chosen to STAY at this level.
- Too-easy ratings since they chose Stay: ${capCount}
- Lean into the UPPER end of complexity for this level. Pull from edge-case combinations and creative workout names — the user is bored at the bottom of this tier.`
    : "";

  // Composite directive (Sprint 3/C2): synthesizes workout-level + combo-level +
  // feature-level signals into one strong instruction. Workout ratings alone
  // can mislead (e.g. user rates Too Easy but actually misses some combos —
  // visible only in per-combo signal). The compound check provides a stronger
  // floor/ceiling than any single signal.
  const recentRated = (recentSessions ?? []).filter(
    (s) => typeof s.difficultyRating === "number"
  );
  const tooEasyRecent = recentRated.filter((s) => s.difficultyRating === 1).length;
  const tooHardRecent = recentRated.filter((s) => s.difficultyRating === 3).length;
  const anyFeatureStruggle =
    !!featureSignals &&
    (featureSignals.embeddedDefenseStruggle ||
      featureSignals.embeddedFootworkStruggle ||
      featureSignals.bodyShotStruggle ||
      featureSignals.fourPlusPunchStruggle);
  const allFeaturesClean =
    !!featureSignals &&
    !featureSignals.embeddedDefenseStruggle &&
    !featureSignals.embeddedFootworkStruggle &&
    !featureSignals.bodyShotStruggle &&
    !featureSignals.fourPlusPunchStruggle;

  let compositeBlock = "";
  if (
    tooEasyRecent >= 2 &&
    tooHardRecent === 0 &&
    strugglesWith.length === 0 &&
    allFeaturesClean
  ) {
    compositeBlock = `

COMPOSITE COMPLEXITY DIRECTIVE — PUSH HARDER:
Multiple recent workouts rated Too Easy AND no struggle combos in history AND no struggle feature patterns. The user is genuinely under-challenged. Generate combos at the absolute UPPER end of this tier's range. Use the more complex embedded patterns (or, at beginner tier, the longer punch sequences) — the user is ready.`;
  } else if (
    (tooHardRecent >= 2 || strugglesWith.length >= 3) &&
    anyFeatureStruggle
  ) {
    compositeBlock = `

COMPOSITE COMPLEXITY DIRECTIVE — REDUCE SIGNIFICANTLY:
Multiple recent workouts rated Too Hard or many struggle combos in history, AND specific feature struggles identified. Generate combos at the LOWER end of this tier's range. Strip out the patterns the user is struggling with (see USER CAPABILITY PATTERNS above). The user needs reps at a comfortable level before adding back complexity.`;
  }

  // Feature-level difficulty block (Sprint 3/B2). Rendered when any feature
  // flag is true. Feature signals roll up rating data across the user's
  // full combo history by category (embedded defense, footwork, body shots,
  // 4+ punch combos). More actionable than the per-notation list: lets Claude
  // adjust the SHAPE of combos to the user's demonstrated capability.
  const featureBits: string[] = [];
  if (featureSignals) {
    if (featureSignals.embeddedDefenseStruggle) {
      featureBits.push(
        "- EMBEDDED DEFENSE (slip/roll/block/parry): user has repeatedly rated combos with embedded defense as TOO HARD. Strongly favor pure-punch combos or combos with only ONE defense token this workout. Avoid stacking defense + footwork in the same combo."
      );
    } else if (featureSignals.embeddedDefenseSuccess) {
      featureBits.push(
        "- EMBEDDED DEFENSE: user handles combos with embedded defense well. Comfortable using slip/roll inside combos — keep using them."
      );
    }
    if (featureSignals.embeddedFootworkStruggle) {
      featureBits.push(
        "- EMBEDDED FOOTWORK (pivot/step/shuffle): user struggles with embedded footwork. Prefer combos without footwork tokens this workout, or limit to one pivot at the end of the combo."
      );
    } else if (featureSignals.embeddedFootworkSuccess) {
      featureBits.push(
        "- EMBEDDED FOOTWORK: user handles embedded footwork well — pivots and shuffles inside combos land cleanly."
      );
    }
    if (featureSignals.bodyShotStruggle) {
      featureBits.push(
        "- BODY SHOTS (the `b` suffix): user struggles when combos include body shots. Minimize body-shot variants this workout. If used, keep them at the end of the combo as a single finisher rather than mid-combo."
      );
    } else if (featureSignals.bodyShotSuccess) {
      featureBits.push(
        "- BODY SHOTS: user handles body shots cleanly. Body-shot variants are fair game — use them to add variety and target switching."
      );
    }
    if (featureSignals.fourPlusPunchStruggle) {
      featureBits.push(
        "- LONG COMBOS (4+ punches): user struggles with longer combos. Bias toward the LOWER end of this tier's punch-count range this workout."
      );
    } else if (featureSignals.fourPlusPunchSuccess) {
      featureBits.push(
        "- LONG COMBOS (4+ punches): user handles longer combos well. Push to the upper end of this tier's punch-count range."
      );
    }
  }
  const featureBlock =
    featureBits.length > 0
      ? `

USER CAPABILITY PATTERNS (aggregated from full rating history):
${featureBits.join("\n")}`
      : "";

  return `Generate a ${boxingLevel} level boxing workout. User has completed ${workoutHistory} workouts before. Make this workout DISTINCTLY ${boxingLevel} level — it should be ${stylePhrase}.${tierBlock}${historyBlock}${personalization}${varietyBlock}${difficultyBlock}${featureBlock}${capBlock}${compositeBlock}`;
}

// =============================================================================
// Server-side validation + sanitization of Claude's output
// =============================================================================

type ClaudeRound = {
  round_number: number;
  anchor_combo: {
    notation: string;
    expanded_speech: string;
    punch_count: number;
    has_body_shot: boolean;
    has_embedded_defense: boolean;
    has_embedded_footwork: boolean;
  };
  classic_description: string;
  classic_reminders: { speech: string; category: string }[];
  rest_tip?: string;
};

type ClaudeWorkout = {
  title: string;
  duration: number;
  rounds: ClaudeRound[];
};

function validateAndFixRound(
  round: ClaudeRound,
  boxingLevel: BoxingLevel,
  mode: WorkoutMode,
  reminderRange: { min: number; max: number },
  idx: number,
  forbiddenSet: Set<string>
): ClaudeRound | null {
  const tokens = parseCombo(round.anchor_combo.notation);
  if (!tokens) return null;

  // Beginner tier: no embedded tokens allowed.
  if (boxingLevel === "beginner") {
    if (tokens.some((t) => t.kind !== "punch")) return null;
  }

  const punchRange = PUNCH_COUNT_RANGE[boxingLevel];
  const meta = comboMeta(tokens);
  if (meta.punch_count < punchRange.min || meta.punch_count > punchRange.max) {
    return null;
  }

  // Biomechanical rules.
  //
  // (1) Slip/roll → next-punch hand. slip_right / roll_right load the rear
  //     hip, so the next punch (if any) must be rear-hand (2/4/6). slip_left /
  //     roll_left load the lead hip → next punch must be lead-hand (1/3/5).
  //
  // (2) Feint → next-punch sanity. A feint that fakes a specific punch must
  //     not be followed by that same punch (faking a jab then throwing a jab
  //     is redundant). feint_high makes the opponent raise their guard, so
  //     the follow must be a body shot. feint_low drops their guard → head
  //     shot. Any round violating either rule is rejected (drops into the
  //     existing 422 → canned-workout fallback) rather than teach broken form.
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (next.kind !== "punch") continue;
    if (t.kind === "defense") {
      const isRight = t.move === "slip_right" || t.move === "roll_right";
      const isLeft = t.move === "slip_left" || t.move === "roll_left";
      if (!isRight && !isLeft) continue;
      const wantRear = isRight;
      const isRear = next.n % 2 === 0;
      if (wantRear !== isRear) return null;
    } else if (t.kind === "feint") {
      const f = t.move;
      // Deprecated feints — reject the round entirely. Speech "feint high" /
      // "feint low" confuses users; only specific-punch feints are allowed.
      if (f === "feint_high" || f === "feint_low") return null;
      if (f === "feint_jab" && next.n === 1) return null;
      if (f === "feint_cross" && next.n === 2) return null;
      if (f === "feint_hook" && (next.n === 3 || next.n === 4)) return null;
      if (f === "feint_uppercut" && (next.n === 5 || next.n === 6)) return null;
    }
  }

  // Canonicalize notation + expanded_speech server-side.
  const canonical = serializeCombo(tokens);
  const expanded = expandForSpeech(tokens);

  // Hard filter: drop rounds whose canonical notation matches the user's
  // struggle list (combos they've rated TOO HARD ≥2 times). Claude's "avoid"
  // prompt is soft; this turns it into a server-side constraint. If too many
  // rounds get dropped here and <3 survive overall, the request 422s and the
  // mobile client falls back to a canned workout (preferable to forcing a
  // struggle combo on the user).
  if (forbiddenSet.has(canonical)) return null;

  // Validate reminders / description per mode.
  let classicDescription = round.classic_description ?? "";
  let classicReminders = Array.isArray(round.classic_reminders)
    ? round.classic_reminders
    : [];

  if (mode === "dynamic") {
    classicDescription = "";
    classicReminders = [];
  } else {
    // Trim reminders to the tier's range; drop duplicates.
    const seen = new Set<string>();
    classicReminders = classicReminders
      .filter((r) => r && typeof r.speech === "string" && r.speech.trim())
      .map((r) => ({
        speech: r.speech.trim(),
        category: ["form", "punch_correction", "tempo"].includes(r.category)
          ? r.category
          : "form",
      }))
      .filter((r) => {
        const key = r.speech.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, reminderRange.max);
    // No padding — if Claude returned fewer than min, we accept that; the
    // client distributes whatever count came back.
  }

  return {
    round_number: idx + 1,
    anchor_combo: {
      notation: canonical,
      expanded_speech: expanded,
      punch_count: meta.punch_count,
      has_body_shot: meta.has_body_shot,
      has_embedded_defense: meta.has_embedded_defense,
      has_embedded_footwork: meta.has_embedded_footwork,
    },
    classic_description: classicDescription,
    classic_reminders: classicReminders,
    rest_tip:
      typeof round.rest_tip === "string" && round.rest_tip.trim()
        ? round.rest_tip.trim()
        : undefined,
  };
}

// =============================================================================
// Request handler
// =============================================================================

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
  const mode: WorkoutMode = body.mode === "dynamic" ? "dynamic" : "classic";
  const atLevelCap = body.at_level_cap === true;
  const capCount = body.level_cap_too_easy_count_since_stay ?? 0;
  const recentSignatures = Array.isArray(body.recent_combo_signatures)
    ? body.recent_combo_signatures.slice(0, 10)
    : [];
  const strugglesWith = Array.isArray(body.combos_user_struggles_with)
    ? body.combos_user_struggles_with.slice(0, 8)
    : [];
  const succeedsWith = Array.isArray(body.combos_user_succeeds_with)
    ? body.combos_user_succeeds_with.slice(0, 8)
    : [];
  // Feature signals are boolean flags — defensively coerce in case the client
  // sends an unexpected shape. Missing field = no feature block in the prompt.
  const featureSignals: FeatureSignal | null = body.feature_signals
    ? {
        embeddedDefenseStruggle: !!body.feature_signals.embeddedDefenseStruggle,
        embeddedFootworkStruggle:
          !!body.feature_signals.embeddedFootworkStruggle,
        bodyShotStruggle: !!body.feature_signals.bodyShotStruggle,
        fourPlusPunchStruggle: !!body.feature_signals.fourPlusPunchStruggle,
        embeddedDefenseSuccess: !!body.feature_signals.embeddedDefenseSuccess,
        embeddedFootworkSuccess: !!body.feature_signals.embeddedFootworkSuccess,
        bodyShotSuccess: !!body.feature_signals.bodyShotSuccess,
        fourPlusPunchSuccess: !!body.feature_signals.fourPlusPunchSuccess,
      }
    : null;

  if (!["beginner", "intermediate", "advanced"].includes(boxingLevel)) {
    return new Response(JSON.stringify({ error: "invalid boxingLevel" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reminderRange = REMINDER_COUNT_RANGE[boxingLevel];
  const systemPrompt = buildSystemPrompt(
    boxingLevel,
    workoutType,
    mode,
    atLevelCap,
    reminderRange
  );
  const userPrompt = buildUserPrompt(
    boxingLevel,
    workoutHistory,
    body.userStats,
    body.recentSessions,
    atLevelCap,
    capCount,
    recentSignatures,
    strugglesWith,
    succeedsWith,
    featureSignals
  );

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0.9,
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

    let workoutData: ClaudeWorkout;
    try {
      workoutData = JSON.parse(block.text);
    } catch {
      return new Response(JSON.stringify({ error: "invalid model JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the forbidden set: combos the user has rated TOO HARD repeatedly.
    // Canonicalize each via parseCombo + serializeCombo so the comparison is
    // shape-equivalent — user-stored notation may differ in whitespace/casing
    // from Claude's output. Empty set is a no-op (no struggles to filter).
    const forbiddenSet = new Set<string>();
    for (const raw of strugglesWith) {
      const t = parseCombo(raw);
      if (t) forbiddenSet.add(serializeCombo(t));
    }

    // Validate every round; drop those that fail grammar / tier rules /
    // struggle filter.
    const validatedRounds: ClaudeRound[] = [];
    for (let i = 0; i < workoutData.rounds.length; i++) {
      const r = validateAndFixRound(
        workoutData.rounds[i],
        boxingLevel,
        mode,
        reminderRange,
        validatedRounds.length,
        forbiddenSet
      );
      if (r) validatedRounds.push(r);
    }

    if (validatedRounds.length < 3) {
      return new Response(
        JSON.stringify({ error: "rounds failed level validation" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tier = computeTier(
      (body.userStats?.currentLevel as BoxingLevel | undefined) ?? boxingLevel,
      body.userStats?.nextLevelProgress
    );

    const out = {
      workout_id: crypto.randomUUID(),
      title: workoutData.title,
      level: boxingLevel,
      tier: tier.number,
      rounds: validatedRounds,
      schema_version: 2 as const,
      // Total work-time minutes (rest periods not counted).
      duration: Math.max(1, validatedRounds.length * 3),
      workout_type: workoutType,
      mode,
    };

    return new Response(JSON.stringify(out), {
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

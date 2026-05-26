import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import {
  BoxingLevel,
  Combo,
  Reminder,
  Round,
  Tier,
  WorkoutPlan,
  WorkoutType,
} from "../types/workout";
import {
  getComboDifficultySignal,
  getFeatureDifficultySignal,
  getUserStats,
  getWorkoutHistory,
  type FeatureDifficultySignal,
} from "./database-service";
import { useUserStore, WorkoutMode } from "../state/userStore";
import { expandForSpeech, parse } from "../lib/combo-variations";

// =============================================================================
// Fallback workouts (used when Supabase or the EF is unavailable).
// Each combo becomes a single-round anchor — fallbacks are intentionally
// pure-punch so they work at any tier without server validation.
// =============================================================================

type FallbackRound = {
  notation: string;
  description: string;
};

const fallbackRounds: Record<BoxingLevel, FallbackRound[][]> = {
  beginner: [
    [
      { notation: "1-2", description: "Start in stance, snap out a quick jab then follow with a powerful cross. Keep your guard up after each punch." },
      { notation: "1-1-2", description: "Throw two quick jabs to establish range, then finish with a hard cross. Stay light on your feet." },
      { notation: "1-2-3", description: "Jab to create opening, cross to the chin, then rotate your hips for a lead hook. Return to guard." },
      { notation: "1-2-2", description: "Jab, cross, then a second cross. Really sit down on that last punch. Keep breathing." },
      { notation: "1-1-1", description: "Three quick jabs in succession. Focus on speed and snapping your arm back each time." },
      { notation: "1-4", description: "Jab to set range, then loop in a rear hook. Keep the hook compact, elbow tight, do not wind up." },
      { notation: "1-2-4", description: "Jab, cross, then rear hook. Stay balanced and do not overcommit on the hook." },
    ],
    [
      { notation: "1-2", description: "Lead with a sharp jab then throw your cross with power. Focus on balance." },
      { notation: "1-3", description: "Jab to set up, then throw a compact lead hook. Pivot on your front foot." },
      { notation: "2-3", description: "Powerful cross then immediately follow with lead hook. Keep your chin tucked." },
      { notation: "1-2-3", description: "Jab, cross, lead hook in one smooth motion. Stay relaxed between punches." },
      { notation: "2-2", description: "Cross, reset, cross again. Focus on technique and hip rotation each time." },
      { notation: "3-4", description: "Lead hook then rear hook. Plant your feet, rotate hips for each punch. Return to guard." },
      { notation: "1-4", description: "Jab to open range, then rear hook to finish. Short and sharp, no winding up." },
    ],
  ],
  intermediate: [
    [
      { notation: "1-2-3-2", description: "Jab, cross, lead hook, cross. Flow through each punch with rhythm. Mix levels." },
      { notation: "1-6-3", description: "Jab to create opening, rear uppercut up the middle, lead hook to exit." },
      { notation: "1-2b-3", description: "Jab high, cross to the body, lead hook to the head. Change levels smoothly." },
      { notation: "3-2-3-2", description: "Lead hook, cross, lead hook, cross. Keep the hooks tight and powerful." },
      { notation: "1-2-3-6", description: "Jab, step left, cross, lead hook, rear uppercut. Work the angles." },
      { notation: "1-1-2-5-2", description: "Double jab, cross, lead uppercut, cross. Fast hands, power finish." },
      { notation: "2-3-2", description: "Slip right, cross, lead hook, cross. Defense into offense." },
      { notation: "1-1-6-3-2", description: "Jab, jab, rear uppercut, lead hook, cross. Push forward with each punch." },
    ],
  ],
  advanced: [
    [
      { notation: "1-2-5-2-3-6", description: "Jab, cross, lead uppercut, cross, lead hook, rear uppercut. Full arsenal display." },
      { notation: "3-6-3-2-1-2", description: "Lead hook, rear uppercut, lead hook, cross, jab, cross. Constant pressure." },
      { notation: "1-2-3-2-3", description: "Slip left, jab, cross, lead hook, step right, cross. Defense to offense." },
      { notation: "1-2b-3b-6-2", description: "Jab high, cross body, lead hook body, rear uppercut, cross. Multi-level attack." },
      { notation: "1-2-3-4-2", description: "Jab, pivot left, cross, lead hook, pivot right, rear hook, cross. Work all angles." },
      { notation: "1-1-2-5-6-3-2", description: "Double jab, cross, lead uppercut, rear uppercut, lead hook, cross. The knockout sequence." },
      { notation: "1-1-1-2-3-2-6", description: "Triple jab, cross, lead hook, cross, rear uppercut. Overwhelming volume." },
      { notation: "6-3-2-3-4", description: "Rear uppercut, lead hook, cross, lead hook, rear hook. All power punches." },
      { notation: "1-2-3-2-1", description: "Jab, feint, cross, slip right, lead hook, cross, pivot, jab. Complete boxing." },
      { notation: "1b-2-6-2-3", description: "Jab to body, cross, rear uppercut, cross, lead hook. Anti-southpaw sequence." },
    ],
  ],
};

const FALLBACK_NAMES: Record<BoxingLevel, string[]> = {
  beginner: ["Foundation Builder: Form First", "Basics Mastery: Sharp Edges"],
  intermediate: ["Combination Flow: Mixed Levels"],
  advanced: ["Fight Simulation: Full Arsenal"],
};

function buildFallbackRound(fb: FallbackRound, idx: number): Round {
  let tokens: ReturnType<typeof parse> = [];
  try {
    tokens = parse(fb.notation);
  } catch {
    // tokens stays []
  }
  const punchCount = tokens.filter((t) => t.kind === "punch").length;
  const hasBodyShot = tokens.some((t) => t.kind === "punch" && t.body);
  const combo: Combo = {
    notation: fb.notation,
    expandedSpeech: expandForSpeech(fb.notation),
    punchCount,
    hasBodyShot,
    hasEmbeddedDefense: false,
    hasEmbeddedFootwork: false,
  };
  return {
    roundNumber: idx + 1,
    anchorCombo: combo,
    classicDescription: fb.description,
    classicReminders: [],
  };
}

function fallbackTier(level: BoxingLevel): Tier {
  if (level === "beginner") return 2;
  if (level === "intermediate") return 5;
  return 8;
}

function getRandomFallbackWorkout(
  level: BoxingLevel,
  type: WorkoutType,
  mode: WorkoutMode
): WorkoutPlan {
  const pool = fallbackRounds[level];
  const namePool = FALLBACK_NAMES[level];
  const idx = Math.floor(Math.random() * pool.length);
  const fbList = pool[idx];
  const name = namePool[idx % namePool.length];
  const rounds = fbList.map(buildFallbackRound);
  return {
    id: `workout-${Date.now()}`,
    name,
    duration: rounds.length * 3,
    rounds,
    difficulty: level,
    type,
    tier: fallbackTier(level),
    schemaVersion: 2,
    generatedAt: new Date(),
    mode,
  };
}

// =============================================================================
// EF response shape (v2) + mapper
// =============================================================================

type EfRound = {
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

type EfWorkoutResponse = {
  workout_id: string;
  title: string;
  level: BoxingLevel;
  tier: number;
  rounds: EfRound[];
  schema_version: 2;
  duration: number;
  workout_type: WorkoutType;
  mode: WorkoutMode;
};

function mapEfRoundToRound(r: EfRound): Round {
  const reminders: Reminder[] = r.classic_reminders
    .filter(
      (rm) =>
        rm &&
        typeof rm.speech === "string" &&
        ["form", "punch_correction", "tempo"].includes(rm.category)
    )
    .map((rm) => ({
      speech: rm.speech,
      category: rm.category as Reminder["category"],
    }));
  return {
    roundNumber: r.round_number,
    anchorCombo: {
      notation: r.anchor_combo.notation,
      expandedSpeech: r.anchor_combo.expanded_speech,
      punchCount: r.anchor_combo.punch_count,
      hasBodyShot: r.anchor_combo.has_body_shot,
      hasEmbeddedDefense: r.anchor_combo.has_embedded_defense,
      hasEmbeddedFootwork: r.anchor_combo.has_embedded_footwork,
    },
    classicDescription: r.classic_description,
    classicReminders: reminders,
    restTip: r.rest_tip,
  };
}

function clampTier(t: number): Tier {
  const clamped = Math.max(1, Math.min(9, Math.round(t)));
  return clamped as Tier;
}

// =============================================================================
// Public API
// =============================================================================

export async function generateWorkout(
  boxingLevel: BoxingLevel,
  workoutHistory: number,
  workoutType: WorkoutType = "power",
  userId?: string | null,
  mode: WorkoutMode = "classic"
): Promise<WorkoutPlan> {
  if (!isSupabaseEnabled()) {
    return getRandomFallbackWorkout(boxingLevel, workoutType, mode);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      return getRandomFallbackWorkout(boxingLevel, workoutType, mode);
    }
  }

  // Pull progression state from store so HomeScreen doesn't have to compose.
  const storeState = useUserStore.getState();
  const atLevelCap = storeState.levelCapStayingSince !== null;
  const capCount = storeState.levelCapTooEasyCountSinceStay;
  const recentSignatures = storeState.recentComboSignatures;

  let userStats = null;
  let recentSessions: {
    workoutName: string;
    difficulty: BoxingLevel;
    workoutType?: WorkoutType;
    completedAt: string;
    difficultyRating?: number;
  }[] = [];
  let struggleSignal: string[] = [];
  let successSignal: string[] = [];
  let featureSignal: FeatureDifficultySignal | null = null;
  if (userId) {
    // Fetch user state in parallel — independent reads.
    const emptyFeature: FeatureDifficultySignal = {
      embeddedDefenseStruggle: false,
      embeddedFootworkStruggle: false,
      bodyShotStruggle: false,
      fourPlusPunchStruggle: false,
      embeddedDefenseSuccess: false,
      embeddedFootworkSuccess: false,
      bodyShotSuccess: false,
      fourPlusPunchSuccess: false,
    };
    const [statsResult, history, difficultySignal, featureResult] =
      await Promise.all([
        getUserStats(userId),
        getWorkoutHistory(userId, 5),
        // Cold-start gating: signal queries are skipped until the user has ≥2
        // rated workouts. Empty arrays render no difficulty block in the EF.
        // Lowered from 5 to 2 so new users get adaptive personalization fast;
        // the noisier signal is mitigated by the raised classification thresholds
        // in getComboDifficultySignal (struggle ≥2, success ≥3).
        workoutHistory >= 2
          ? getComboDifficultySignal(userId)
          : Promise.resolve({ struggles: [], successes: [] }),
        // Feature-level signals need more evidence than per-notation signals,
        // so cold-start gate higher (5 workouts) to avoid flagging "user
        // struggles with body shots" off a single bad rating.
        workoutHistory >= 5
          ? getFeatureDifficultySignal(userId)
          : Promise.resolve(emptyFeature),
      ]);
    userStats = statsResult;
    recentSessions = history.map((s) => ({
      workoutName: s.workoutName,
      difficulty: s.difficulty,
      completedAt: s.completedAt,
      difficultyRating: s.difficultyRating,
    }));
    struggleSignal = difficultySignal.struggles;
    successSignal = difficultySignal.successes;
    featureSignal = featureResult;
  }

  try {
    const { data, error } = await supabase.functions.invoke<EfWorkoutResponse>(
      "punchpal-generate-workout",
      {
        body: {
          boxingLevel,
          workoutType,
          workoutHistory,
          userStats,
          recentSessions,
          mode,
          at_level_cap: atLevelCap,
          level_cap_too_easy_count_since_stay: capCount,
          recent_combo_signatures: recentSignatures,
          combos_user_struggles_with: struggleSignal,
          combos_user_succeeds_with: successSignal,
          feature_signals: featureSignal ?? undefined,
        },
      }
    );

    if (
      error ||
      !data ||
      data.schema_version !== 2 ||
      !Array.isArray(data.rounds) ||
      data.rounds.length === 0
    ) {
      return getRandomFallbackWorkout(boxingLevel, workoutType, mode);
    }

    // C3 telemetry: compute signal-hit counts for the generated workout.
    // Server-side B1 should have already dropped anchor matches in the
    // struggle list, so struggleHitCount > 0 here is a red flag — either the
    // filter didn't fire or Claude returned <3 rounds and we fell back to
    // a workout that wasn't filtered. Useful diagnostic over time.
    const struggleSet = new Set(struggleSignal);
    const successSet = new Set(successSignal);
    const recentSet = new Set(recentSignatures);
    let struggleHits = 0;
    let successHits = 0;
    let recentHits = 0;
    for (const r of data.rounds) {
      const n = r.anchor_combo?.notation;
      if (!n) continue;
      if (struggleSet.has(n)) struggleHits++;
      if (successSet.has(n)) successHits++;
      if (recentSet.has(n)) recentHits++;
    }
    const featureStruggles: string[] = [];
    const featureSuccesses: string[] = [];
    if (featureSignal) {
      if (featureSignal.embeddedDefenseStruggle)
        featureStruggles.push("embedded_defense");
      if (featureSignal.embeddedFootworkStruggle)
        featureStruggles.push("embedded_footwork");
      if (featureSignal.bodyShotStruggle) featureStruggles.push("body_shot");
      if (featureSignal.fourPlusPunchStruggle)
        featureStruggles.push("four_plus_punch");
      if (featureSignal.embeddedDefenseSuccess)
        featureSuccesses.push("embedded_defense");
      if (featureSignal.embeddedFootworkSuccess)
        featureSuccesses.push("embedded_footwork");
      if (featureSignal.bodyShotSuccess) featureSuccesses.push("body_shot");
      if (featureSignal.fourPlusPunchSuccess)
        featureSuccesses.push("four_plus_punch");
    }

    return {
      id: data.workout_id || `workout-${Date.now()}`,
      name: data.title,
      duration: data.duration,
      rounds: data.rounds.map(mapEfRoundToRound),
      difficulty: data.level ?? boxingLevel,
      type: data.workout_type ?? workoutType,
      tier: clampTier(data.tier ?? fallbackTier(boxingLevel)),
      schemaVersion: 2,
      generatedAt: new Date(),
      mode: data.mode ?? mode,
      signalTelemetry: {
        struggleHitCount: struggleHits,
        successHitCount: successHits,
        recentHitCount: recentHits,
        atLevelCap,
        featureStruggles,
        featureSuccesses,
      },
    };
  } catch {
    return getRandomFallbackWorkout(boxingLevel, workoutType, mode);
  }
}

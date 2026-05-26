import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { TABLES } from "../lib/tables";
import { BoxingLevel } from "../types/workout";
import type { RatingOutcome } from "../lib/progression";
import {
  parse as parseCombo,
  hasBodyShot,
  hasEmbeddedDefense,
  hasEmbeddedFootwork,
  countPunches,
} from "../lib/combo-variations";

async function ensureAuthUserId(): Promise<string | null> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("ensureAuthUserId: anonymous sign-in failed:", error);
    return null;
  }
  return data.session?.user.id ?? null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutName: string;
  difficulty: BoxingLevel;
  duration: number;
  rounds: number;
  completedAt: string;
  durationMinutes: number; // actual time spent
  combosAttempted: number;
  combosCompleted: number;
  accuracy: number; // 0-100
  notes?: string;
  difficultyRating?: number; // 1 = too easy, 2 = just right, 3 = too hard
  // C3 telemetry (migration 006). Captured at workout-generation time and
  // written here so we can later query "how often does the generated workout
  // include a struggle combo despite B1?", "did adaptive learning reduce
  // recent-list collisions?", etc. Undefined for fallback workouts.
  signalStruggleHitCount?: number;
  signalSuccessHitCount?: number;
  signalRecentHitCount?: number;
  signalAtLevelCap?: boolean;
  signalFeatureStruggles?: string[];
  signalFeatureSuccesses?: string[];
  // Skip Combo telemetry (migration 007). How many times the user tapped
  // the in-round Skip Combo button. Per-combo signal also fires through
  // punchpal_record_combo_rating with rating=3 (too_hard) so the struggle
  // list updates immediately; this column gives us session-level analytics.
  signalSkipCount?: number;
}

export interface UserStats {
  userId: string;
  totalWorkouts: number;
  totalMinutes: number;
  currentLevel: BoxingLevel;
  nextLevelProgress: number; // 0-100
  combosLearned: number;
  currentStreak: number;
  longestStreak: number;
  avgAccuracy: number;
  lastWorkoutDate: string | null;
  // Progression v5 fields (added by migration 004).
  levelCapStayingSince: string | null;
  levelCapTooEasyCountSinceStay: number;
  recentComboSignatures: string[];
  demotionWindow: RatingOutcome[];
}

export interface ComboProgress {
  id: string;
  userId: string;
  comboNotation: string;
  comboName: string;
  timesAttempted: number;
  timesCompleted: number;
  bestAccuracy: number;
  lastAttemptDate: string;
}

const VALID_OUTCOMES: ReadonlySet<RatingOutcome> = new Set<RatingOutcome>([
  "too_easy",
  "just_right",
  "too_hard",
  "skipped",
  "early_exit",
]);

function sanitizeDemotionWindow(value: unknown): RatingOutcome[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .filter((v): v is RatingOutcome => VALID_OUTCOMES.has(v as RatingOutcome))
    .slice(-5);
}

function sanitizeSignatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 10);
}

function mapRowToStats(row: any): UserStats {
  return {
    userId: row.user_id,
    totalWorkouts: row.total_workouts ?? 0,
    totalMinutes: row.total_minutes ?? 0,
    currentLevel: row.current_level,
    nextLevelProgress: row.next_level_progress ?? 0,
    combosLearned: row.combos_learned ?? 0,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    avgAccuracy: row.avg_accuracy ?? 0,
    lastWorkoutDate: row.last_workout_date ?? null,
    levelCapStayingSince: row.level_cap_staying_since ?? null,
    levelCapTooEasyCountSinceStay: row.level_cap_too_easy_count_since_stay ?? 0,
    recentComboSignatures: sanitizeSignatures(row.recent_combo_signatures),
    demotionWindow: sanitizeDemotionWindow(row.demotion_window),
  };
}

// Fetch user stats
export async function getUserStats(userId: string): Promise<UserStats | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    const { data, error } = await supabase
      .from(TABLES.userStats)
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    if (!data) return null;
    return mapRowToStats(data);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return null;
  }
}

// Create or update user stats. Only fields explicitly provided in `stats` are
// written — any undefined property is dropped, so callers can do partial
// updates without clobbering existing values.
export async function upsertUserStats(
  userId: string,
  stats: Partial<UserStats>
): Promise<UserStats | null> {
  if (!isSupabaseEnabled()) {
    console.log("Supabase not enabled, skipping upsertUserStats");
    return null;
  }

  try {
    const authUserId = await ensureAuthUserId();
    if (!authUserId) {
      console.error("upsertUserStats: no auth session available");
      return null;
    }

    const dbRecord: Record<string, unknown> = { user_id: authUserId };
    if (stats.totalWorkouts !== undefined) dbRecord.total_workouts = stats.totalWorkouts;
    if (stats.totalMinutes !== undefined) dbRecord.total_minutes = stats.totalMinutes;
    if (stats.currentLevel !== undefined) dbRecord.current_level = stats.currentLevel;
    if (stats.nextLevelProgress !== undefined) dbRecord.next_level_progress = stats.nextLevelProgress;
    if (stats.combosLearned !== undefined) dbRecord.combos_learned = stats.combosLearned;
    if (stats.currentStreak !== undefined) dbRecord.current_streak = stats.currentStreak;
    if (stats.longestStreak !== undefined) dbRecord.longest_streak = stats.longestStreak;
    if (stats.avgAccuracy !== undefined) dbRecord.avg_accuracy = stats.avgAccuracy;
    if (stats.lastWorkoutDate !== undefined) dbRecord.last_workout_date = stats.lastWorkoutDate;
    if (stats.levelCapStayingSince !== undefined) dbRecord.level_cap_staying_since = stats.levelCapStayingSince;
    if (stats.levelCapTooEasyCountSinceStay !== undefined) dbRecord.level_cap_too_easy_count_since_stay = stats.levelCapTooEasyCountSinceStay;
    if (stats.recentComboSignatures !== undefined) dbRecord.recent_combo_signatures = stats.recentComboSignatures;
    if (stats.demotionWindow !== undefined) dbRecord.demotion_window = stats.demotionWindow;

    const { data, error } = await supabase
      .from(TABLES.userStats)
      .upsert(dbRecord, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      throw error;
    }

    return data ? mapRowToStats(data) : null;
  } catch (error) {
    console.error("Error upserting user stats:", error);
    return null;
  }
}

// Log a completed workout
export async function logWorkoutSession(
  session: Omit<WorkoutSession, "id">
): Promise<WorkoutSession | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    const authUserId = await ensureAuthUserId();
    if (!authUserId) {
      console.error("logWorkoutSession: no auth session available");
      return null;
    }
    const dbRecord = {
      user_id: authUserId,
      workout_name: session.workoutName,
      difficulty: session.difficulty,
      duration: session.duration,
      rounds: session.rounds,
      completed_at: session.completedAt,
      duration_minutes: session.durationMinutes,
      combos_attempted: session.combosAttempted,
      combos_completed: session.combosCompleted,
      accuracy: session.accuracy,
      notes: session.notes,
      difficulty_rating: session.difficultyRating,
      // C3 telemetry — only included when migration 006 has been applied. Older
      // DBs will reject these columns; the catch below logs and silently drops
      // the insert. Acceptable: telemetry is best-effort, the user's rating
      // path remains in TimerScreen regardless.
      signal_struggle_hit_count: session.signalStruggleHitCount,
      signal_success_hit_count: session.signalSuccessHitCount,
      signal_recent_hit_count: session.signalRecentHitCount,
      signal_at_level_cap: session.signalAtLevelCap,
      signal_feature_struggles: session.signalFeatureStruggles,
      signal_feature_successes: session.signalFeatureSuccesses,
      signal_skip_count: session.signalSkipCount,
    };

    const { data, error } = await supabase
      .from(TABLES.workoutSessions)
      .insert([dbRecord])
      .select()
      .single();

    if (error) throw error;

    return data ? {
      id: data.id,
      userId: data.user_id,
      workoutName: data.workout_name,
      difficulty: data.difficulty,
      duration: data.duration,
      rounds: data.rounds,
      completedAt: data.completed_at,
      durationMinutes: data.duration_minutes,
      combosAttempted: data.combos_attempted,
      combosCompleted: data.combos_completed,
      accuracy: data.accuracy,
      notes: data.notes,
      difficultyRating: data.difficulty_rating ?? undefined,
    } : null;
  } catch (error) {
    console.error("Error logging workout session:", error);
    return null;
  }
}

// Get workout history
export async function getWorkoutHistory(
  userId: string,
  limit: number = 50
): Promise<WorkoutSession[]> {
  if (!isSupabaseEnabled()) return [];

  try {
    const { data, error } = await supabase
      .from(TABLES.workoutSessions)
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      workoutName: row.workout_name,
      difficulty: row.difficulty,
      duration: row.duration,
      rounds: row.rounds,
      completedAt: row.completed_at,
      durationMinutes: row.duration_minutes,
      combosAttempted: row.combos_attempted,
      combosCompleted: row.combos_completed,
      accuracy: row.accuracy,
      notes: row.notes,
      difficultyRating: row.difficulty_rating ?? undefined,
    }));
  } catch (error) {
    console.error("Error fetching workout history:", error);
    return [];
  }
}

// Track combo progress
export async function updateComboProgress(
  userId: string,
  comboNotation: string,
  comboName: string,
  completed: boolean,
  accuracy: number
): Promise<ComboProgress | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    // First try to get existing combo progress
    const { data: existing } = await supabase
      .from(TABLES.comboProgress)
      .select("*")
      .eq("user_id", userId)
      .eq("combo_notation", comboNotation)
      .single();

    const now = new Date().toISOString();
    let row: any = null;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from(TABLES.comboProgress)
        .update({
          times_attempted: existing.times_attempted + 1,
          times_completed: completed
            ? existing.times_completed + 1
            : existing.times_completed,
          best_accuracy: Math.max(existing.best_accuracy, accuracy),
          last_attempt_date: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      row = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from(TABLES.comboProgress)
        .insert([
          {
            user_id: userId,
            combo_notation: comboNotation,
            combo_name: comboName,
            times_attempted: 1,
            times_completed: completed ? 1 : 0,
            best_accuracy: accuracy,
            last_attempt_date: now,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      row = data;
    }

    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      comboNotation: row.combo_notation,
      comboName: row.combo_name,
      timesAttempted: row.times_attempted,
      timesCompleted: row.times_completed,
      bestAccuracy: row.best_accuracy,
      lastAttemptDate: row.last_attempt_date,
    };
  } catch (error) {
    console.error("Error updating combo progress:", error);
    return null;
  }
}

// Get combo recommendations based on progress
export async function getComboRecommendations(userId: string): Promise<string[]> {
  if (!isSupabaseEnabled()) return [];

  try {
    const { data, error } = await supabase
      .from(TABLES.comboProgress)
      .select("combo_notation")
      .eq("user_id", userId)
      .order("best_accuracy", { ascending: true })
      .limit(5);

    if (error) throw error;
    return (data || []).map((d: any) => d.combo_notation);
  } catch (error) {
    console.error("Error getting combo recommendations:", error);
    return [];
  }
}

// =============================================================================
// Adaptive learning (Phase 4.1, 2026-05-24)
//
// Workout difficulty ratings (1=too easy, 2=just right, 3=too hard) accumulate
// per anchor combo in `punchpal_combo_progress`. The EF prompt uses these to
// avoid patterns the user has rated TOO HARD and lean into patterns rated
// JUST RIGHT or TOO EASY.
// =============================================================================

export type ComboDifficultySignal = {
  struggles: string[]; // notations the user has rated TOO HARD more than well
  successes: string[]; // notations the user has rated well repeatedly
};

// Feature-level difficulty signal. Aggregates per-combo ratings across all
// combos sharing a feature (embedded defense, embedded footwork, body shot,
// 4+ punches). Tells Claude "user struggles with body shots in general" —
// far more actionable than the per-notation avoid list, since Claude can
// pattern-match across combos it hasn't seen yet.
export type FeatureDifficultySignal = {
  embeddedDefenseStruggle: boolean;
  embeddedFootworkStruggle: boolean;
  bodyShotStruggle: boolean;
  fourPlusPunchStruggle: boolean;
  embeddedDefenseSuccess: boolean;
  embeddedFootworkSuccess: boolean;
  bodyShotSuccess: boolean;
  fourPlusPunchSuccess: boolean;
};

const EMPTY_FEATURE_SIGNAL: FeatureDifficultySignal = {
  embeddedDefenseStruggle: false,
  embeddedFootworkStruggle: false,
  bodyShotStruggle: false,
  fourPlusPunchStruggle: false,
  embeddedDefenseSuccess: false,
  embeddedFootworkSuccess: false,
  bodyShotSuccess: false,
  fourPlusPunchSuccess: false,
};

// Records one row per anchor combo from a completed workout. Best-effort:
// fires the RPCs and logs errors but never throws — telemetry must not block
// the user-facing post-workout flow.
export async function recordComboProgressForSession(
  userId: string,
  anchors: { notation: string; name?: string }[],
  difficultyRating: 1 | 2 | 3
): Promise<void> {
  if (!isSupabaseEnabled() || anchors.length === 0) return;

  await Promise.all(
    anchors.map(async (a) => {
      const { error } = await supabase.rpc("punchpal_record_combo_rating", {
        p_user_id: userId,
        p_notation: a.notation,
        p_name: a.name ?? null,
        p_rating: difficultyRating,
      });
      if (error) {
        console.warn(
          "[telemetry] punchpal_record_combo_rating failed for",
          a.notation,
          error.message
        );
      }
    })
  );
}

// Pulls the last 30 rated combos for the user and partitions them into
// struggle vs success buckets. Caps each list at 8 entries to bound the EF
// prompt cost. Returns empty arrays on any error (silent degradation).
export async function getComboDifficultySignal(
  userId: string
): Promise<ComboDifficultySignal> {
  if (!isSupabaseEnabled()) return { struggles: [], successes: [] };

  try {
    const { data, error } = await supabase
      .from(TABLES.comboProgress)
      .select(
        "combo_notation, too_easy_count, just_right_count, too_hard_count, last_attempt_date"
      )
      .eq("user_id", userId)
      .gte("times_attempted", 1)
      .order("last_attempt_date", { ascending: false })
      .limit(100);

    if (error) throw error;

    const struggles: string[] = [];
    const successes: string[] = [];

    // Classification thresholds bumped from single-data-point (tooHard ≥1) to
    // multi-data-point (tooHard ≥2, success ≥3). Single ratings produced noisy
    // oscillating signal — every first "too hard" flagged a combo as struggle.
    for (const row of data ?? []) {
      const tooHard = row.too_hard_count ?? 0;
      const justRight = row.just_right_count ?? 0;
      const tooEasy = row.too_easy_count ?? 0;
      const wellHandled = justRight + tooEasy;

      if (tooHard >= 2 && tooHard > wellHandled) {
        if (struggles.length < 8) struggles.push(row.combo_notation);
      } else if (wellHandled >= 3 && tooHard <= 1) {
        if (successes.length < 8) successes.push(row.combo_notation);
      }
    }

    return { struggles, successes };
  } catch (error) {
    console.warn("[telemetry] getComboDifficultySignal failed:", error);
    return { struggles: [], successes: [] };
  }
}

// Aggregates rating counts across the user's full combo history (last 100)
// by feature: embedded defense, embedded footwork, body shots, 4+ punches.
// Returns booleans per feature for struggle (≥3 too-hards exceeding well-rated)
// and success (≥5 well-rated with ≤2 too-hards). Higher thresholds than the
// notation-level signal because feature-level rolls up many combos — needs more
// evidence to assert "user struggles with this whole category".
export async function getFeatureDifficultySignal(
  userId: string
): Promise<FeatureDifficultySignal> {
  if (!isSupabaseEnabled()) return EMPTY_FEATURE_SIGNAL;

  try {
    const { data, error } = await supabase
      .from(TABLES.comboProgress)
      .select(
        "combo_notation, too_easy_count, just_right_count, too_hard_count, last_attempt_date"
      )
      .eq("user_id", userId)
      .gte("times_attempted", 1)
      .order("last_attempt_date", { ascending: false })
      .limit(100);

    if (error) throw error;

    type Counts = { tooHard: number; wellHandled: number };
    const f = {
      embeddedDefense: { tooHard: 0, wellHandled: 0 } as Counts,
      embeddedFootwork: { tooHard: 0, wellHandled: 0 } as Counts,
      bodyShot: { tooHard: 0, wellHandled: 0 } as Counts,
      fourPlusPunch: { tooHard: 0, wellHandled: 0 } as Counts,
    };

    for (const row of data ?? []) {
      let tokens;
      try {
        tokens = parseCombo(row.combo_notation);
      } catch {
        continue;
      }
      const tooHard = row.too_hard_count ?? 0;
      const justRight = row.just_right_count ?? 0;
      const tooEasy = row.too_easy_count ?? 0;
      const wellHandled = justRight + tooEasy;

      if (hasEmbeddedDefense(tokens)) {
        f.embeddedDefense.tooHard += tooHard;
        f.embeddedDefense.wellHandled += wellHandled;
      }
      if (hasEmbeddedFootwork(tokens)) {
        f.embeddedFootwork.tooHard += tooHard;
        f.embeddedFootwork.wellHandled += wellHandled;
      }
      if (hasBodyShot(tokens)) {
        f.bodyShot.tooHard += tooHard;
        f.bodyShot.wellHandled += wellHandled;
      }
      if (countPunches(tokens) >= 4) {
        f.fourPlusPunch.tooHard += tooHard;
        f.fourPlusPunch.wellHandled += wellHandled;
      }
    }

    const isStruggle = (c: Counts) => c.tooHard >= 3 && c.tooHard > c.wellHandled;
    const isSuccess = (c: Counts) => c.wellHandled >= 5 && c.tooHard <= 2;

    return {
      embeddedDefenseStruggle: isStruggle(f.embeddedDefense),
      embeddedFootworkStruggle: isStruggle(f.embeddedFootwork),
      bodyShotStruggle: isStruggle(f.bodyShot),
      fourPlusPunchStruggle: isStruggle(f.fourPlusPunch),
      embeddedDefenseSuccess: isSuccess(f.embeddedDefense),
      embeddedFootworkSuccess: isSuccess(f.embeddedFootwork),
      bodyShotSuccess: isSuccess(f.bodyShot),
      fourPlusPunchSuccess: isSuccess(f.fourPlusPunch),
    };
  } catch (error) {
    console.warn("[telemetry] getFeatureDifficultySignal failed:", error);
    return EMPTY_FEATURE_SIGNAL;
  }
}

import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { TABLES } from "../lib/tables";
import { BoxingLevel } from "../types/workout";

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
    
    return {
      userId: data.user_id,
      totalWorkouts: data.total_workouts,
      totalMinutes: data.total_minutes,
      currentLevel: data.current_level,
      nextLevelProgress: data.next_level_progress,
      combosLearned: data.combos_learned,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      avgAccuracy: data.avg_accuracy,
      lastWorkoutDate: data.last_workout_date,
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return null;
  }
}

// Create or update user stats
export async function upsertUserStats(
  userId: string,
  stats: Partial<UserStats>
): Promise<UserStats | null> {
  if (!isSupabaseEnabled()) {
    console.log('Supabase not enabled, skipping upsertUserStats');
    return null;
  }

  try {
    const authUserId = await ensureAuthUserId();
    if (!authUserId) {
      console.error("upsertUserStats: no auth session available");
      return null;
    }
    const dbRecord = {
      user_id: authUserId,
      total_workouts: stats.totalWorkouts,
      total_minutes: stats.totalMinutes,
      current_level: stats.currentLevel,
      next_level_progress: stats.nextLevelProgress,
      combos_learned: stats.combosLearned,
      current_streak: stats.currentStreak,
      longest_streak: stats.longestStreak,
      avg_accuracy: stats.avgAccuracy,
      last_workout_date: stats.lastWorkoutDate,
    };
    
    const { data, error } = await supabase
      .from(TABLES.userStats)
      .upsert(dbRecord, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }
    
    return data ? {
      userId: data.user_id,
      totalWorkouts: data.total_workouts,
      totalMinutes: data.total_minutes,
      currentLevel: data.current_level,
      nextLevelProgress: data.next_level_progress,
      combosLearned: data.combos_learned,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      avgAccuracy: data.avg_accuracy,
      lastWorkoutDate: data.last_workout_date,
    } : null;
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

// Calculate if user should level up
export async function evaluateLevelUp(userId: string): Promise<BoxingLevel | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    const stats = await getUserStats(userId);
    if (!stats) return null;

    const { data: sessions } = await supabase
      .from(TABLES.workoutSessions)
      .select("accuracy, difficulty")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (!sessions || sessions.length === 0) return null;

    // Level up logic
    const currentLevel = stats.currentLevel;
    const recentAvgAccuracy =
      sessions.reduce((sum: number, s: any) => sum + (s.accuracy || 0), 0) / sessions.length;
    const recentSessionsAtLevel = sessions.filter((s: any) => s.difficulty === currentLevel);

    // If last 5+ sessions at current level with 80%+ average accuracy, level up
    if (recentSessionsAtLevel.length >= 5 && recentAvgAccuracy >= 80) {
      const nextLevel: Record<BoxingLevel, BoxingLevel> = {
        beginner: "intermediate",
        intermediate: "advanced",
        advanced: "advanced", // Stay at advanced
      };

      return nextLevel[currentLevel];
    }

    return null;
  } catch (error) {
    console.error("Error evaluating level up:", error);
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

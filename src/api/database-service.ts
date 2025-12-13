import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { BoxingLevel } from "../types/workout";

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
      .from("user_stats")
      .select("*")
      .eq("userId", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data || null;
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
  if (!isSupabaseEnabled()) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .upsert(
        {
          userId,
          ...stats,
        },
        { onConflict: "userId" }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from("workout_sessions")
      .insert([session])
      .select()
      .single();

    if (error) throw error;
    return data;
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
      .from("workout_sessions")
      .select("*")
      .eq("userId", userId)
      .order("completedAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
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
      .from("combo_progress")
      .select("*")
      .eq("userId", userId)
      .eq("comboNotation", comboNotation)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("combo_progress")
        .update({
          timesAttempted: existing.timesAttempted + 1,
          timesCompleted: completed ? existing.timesCompleted + 1 : existing.timesCompleted,
          bestAccuracy: Math.max(existing.bestAccuracy, accuracy),
          lastAttemptDate: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("combo_progress")
        .insert([
          {
            userId,
            comboNotation,
            comboName,
            timesAttempted: 1,
            timesCompleted: completed ? 1 : 0,
            bestAccuracy: accuracy,
            lastAttemptDate: now,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
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
      .from("workout_sessions")
      .select("accuracy, difficulty")
      .eq("userId", userId)
      .order("completedAt", { ascending: false })
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
      .from("combo_progress")
      .select("comboNotation")
      .eq("userId", userId)
      .order("bestAccuracy", { ascending: true })
      .limit(5);

    if (error) throw error;
    return (data || []).map((d: any) => d.comboNotation);
  } catch (error) {
    console.error("Error getting combo recommendations:", error);
    return [];
  }
}

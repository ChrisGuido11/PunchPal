import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { useUserStore } from "../state/userStore";
import { getUserStats, upsertUserStats } from "./database-service";
import { BoxingLevel } from "../types/workout";

/**
 * Initialize user with Supabase
 * Creates an anonymous session and syncs user stats
 */
export async function initializeUser(): Promise<string | null> {
  if (!isSupabaseEnabled()) {
    console.log("Supabase not enabled, using local storage only");
    return null;
  }

  try {
    // Check if user already has a session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let userId: string;

    if (session?.user) {
      userId = session.user.id;
    } else {
      // Sign up anonymously
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      userId = data.session?.user.id || "";
    }

    // Set user in store
    useUserStore.setState({ userId });

    // Sync user stats
    const userLevel = useUserStore.getState().boxingLevel;
    if (userLevel) {
      await syncUserStats(userId, userLevel);
    }

    console.log("User initialized:", userId);
    return userId;
  } catch (error) {
    console.error("Error initializing user:", error);
    return null;
  }
}

/**
 * Sync local user stats to Supabase
 */
export async function syncUserStats(userId: string, boxingLevel: BoxingLevel): Promise<void> {
  if (!isSupabaseEnabled()) return;

  try {
    const state = useUserStore.getState();

    await upsertUserStats(userId, {
      userId,
      totalWorkouts: state.workoutHistory.length,
      totalMinutes: state.workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0),
      currentLevel: boxingLevel,
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastWorkoutDate: state.lastWorkoutDate,
      combosLearned: state.favoriteWorkouts.length,
      avgAccuracy: 0, // Will be calculated from workout sessions
      nextLevelProgress: 0, // Will be calculated based on recent sessions
    });

    console.log("User stats synced");
  } catch (error) {
    console.error("Error syncing user stats:", error);
  }
}

/**
 * Get recommended next level based on performance
 */
export async function getRecommendedLevel(
  currentLevel: BoxingLevel,
  userId: string
): Promise<BoxingLevel> {
  if (!isSupabaseEnabled()) return currentLevel;

  try {
    const stats = await getUserStats(userId);
    if (!stats) return currentLevel;

    // If user has completed at least 5 workouts at current level
    // and average accuracy is above 80%, recommend level up
    if (stats.nextLevelProgress >= 80) {
      const nextLevel: Record<BoxingLevel, BoxingLevel> = {
        beginner: "intermediate",
        intermediate: "advanced",
        advanced: "advanced",
      };
      return nextLevel[currentLevel];
    }

    return currentLevel;
  } catch (error) {
    console.error("Error getting recommended level:", error);
    return currentLevel;
  }
}

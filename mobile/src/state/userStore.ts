import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BoxingLevel, WorkoutPlan, WorkoutHistory, SavedWorkout } from "../types/workout";

export type WorkoutMode = "classic" | "dynamic";

interface UserState {
  userId: string | null;
  hasCompletedOnboarding: boolean;
  boxingLevel: BoxingLevel | null;
  currentWorkout: WorkoutPlan | null;
  workoutHistory: WorkoutHistory[];
  favoriteWorkouts: SavedWorkout[];
  recentlyCompleted: SavedWorkout[];
  lastWorkoutDate: string | null;
  currentStreak: number;
  longestStreak: number;
  unlockedAchievements: string[];
  workoutMode: WorkoutMode;
  workoutModeMigratedAt: string | null;

  setUserId: (id: string | null) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setBoxingLevel: (level: BoxingLevel) => void;
  setCurrentWorkout: (workout: WorkoutPlan | null) => void;
  addWorkoutToHistory: (workout: WorkoutHistory) => void;
  clearWorkoutHistory: () => void;
  updateStreaks: () => void;
  unlockAchievement: (achievementId: string) => void;
  toggleFavorite: (workoutId: string, workout: SavedWorkout) => void;
  addToRecentlyCompleted: (workout: SavedWorkout) => void;
  setWorkoutMode: (mode: WorkoutMode) => void;
}

const calculateStreak = (workoutHistory: WorkoutHistory[]): { currentStreak: number; longestStreak: number } => {
  if (workoutHistory.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const sortedDates = workoutHistory
    .map(w => new Date(w.completedAt).toDateString())
    .filter((date, index, self) => self.indexOf(date) === index)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  // Calculate current streak
  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
      
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  longestStreak = tempStreak;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
    
    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userId: null,
      hasCompletedOnboarding: false,
      boxingLevel: null,
      currentWorkout: null,
      workoutHistory: [],
      favoriteWorkouts: [],
      recentlyCompleted: [],
      lastWorkoutDate: null,
      currentStreak: 0,
      longestStreak: 0,
      unlockedAchievements: [],
      workoutMode: "classic",
      workoutModeMigratedAt: null,

      setUserId: (id) => set({ userId: id }),

      // Defensive stamp: a brand-new install hits this when the user completes
      // onboarding before the persist migration has a chance to fire on a
      // previously-stored state. Without this, fresh users would default to
      // Classic via the initial state above instead of Dynamic.
      setHasCompletedOnboarding: (completed) =>
        set((s) => {
          if (completed && !s.workoutModeMigratedAt) {
            return {
              hasCompletedOnboarding: completed,
              workoutMode: "dynamic",
              workoutModeMigratedAt: new Date().toISOString(),
            };
          }
          return { hasCompletedOnboarding: completed };
        }),

      setWorkoutMode: (mode) => set({ workoutMode: mode }),

      setBoxingLevel: (level) => set({ boxingLevel: level, currentWorkout: null }),

      setCurrentWorkout: (workout) => set({ currentWorkout: workout }),

      addWorkoutToHistory: (workout) => {
        set((state) => {
          const newHistory = [workout, ...state.workoutHistory];
          const streaks = calculateStreak(newHistory);
          return {
            workoutHistory: newHistory,
            lastWorkoutDate: new Date().toISOString(),
            currentStreak: streaks.currentStreak,
            longestStreak: streaks.longestStreak,
          };
        });
      },

      updateStreaks: () => {
        const state = get();
        const streaks = calculateStreak(state.workoutHistory);
        set({
          currentStreak: streaks.currentStreak,
          longestStreak: streaks.longestStreak,
        });
      },

      unlockAchievement: (achievementId) => {
        set((state) => {
          if (state.unlockedAchievements.includes(achievementId)) {
            return state;
          }
          return {
            unlockedAchievements: [...state.unlockedAchievements, achievementId],
          };
        });
      },

      toggleFavorite: (workoutId, workout) => {
        set((state) => {
          const isFavorited = state.favoriteWorkouts.some((w) => w.id === workoutId);
          if (isFavorited) {
            return {
              favoriteWorkouts: state.favoriteWorkouts.filter((w) => w.id !== workoutId),
            };
          }
          const newFavorite: SavedWorkout = {
            ...workout,
            isFavorite: true,
            savedAt: new Date(),
          };
          return {
            favoriteWorkouts: [newFavorite, ...state.favoriteWorkouts],
          };
        });
      },

      addToRecentlyCompleted: (workout) => {
        set((state) => {
          const maxRecent = 5;
          const newRecent: SavedWorkout = {
            ...workout,
            savedAt: new Date(),
          };
          const updated = [newRecent, ...state.recentlyCompleted].slice(0, maxRecent);
          return { recentlyCompleted: updated };
        });
      },

      clearWorkoutHistory: () => set({ 
        workoutHistory: [],
        currentStreak: 0,
        lastWorkoutDate: null,
      }),
    }),
    {
      name: "punchpal-user-store",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, fromVersion: number) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as UserState;
        }
        const state = persistedState as Partial<UserState>;
        if (fromVersion < 1 && !state.workoutModeMigratedAt) {
          const wasExistingUser = state.hasCompletedOnboarding === true;
          state.workoutMode = wasExistingUser ? "classic" : "dynamic";
          state.workoutModeMigratedAt = new Date().toISOString();
        }
        return state as UserState;
      },
    }
  )
);

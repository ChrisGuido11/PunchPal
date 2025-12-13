import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BoxingLevel, WorkoutPlan, WorkoutHistory, SavedWorkout } from "../types/workout";

interface UserState {
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

  setHasCompletedOnboarding: (completed: boolean) => void;
  setBoxingLevel: (level: BoxingLevel) => void;
  setCurrentWorkout: (workout: WorkoutPlan | null) => void;
  addWorkoutToHistory: (workout: WorkoutHistory) => void;
  clearWorkoutHistory: () => void;
  updateStreaks: () => void;
  unlockAchievement: (achievementId: string) => void;
  toggleFavorite: (workoutId: string, workout: SavedWorkout) => void;
  addToRecentlyCompleted: (workout: SavedWorkout) => void;
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

      setHasCompletedOnboarding: (completed) =>
        set({ hasCompletedOnboarding: completed }),

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
    }
  )
);

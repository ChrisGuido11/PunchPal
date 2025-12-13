import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BoxingLevel, WorkoutPlan, WorkoutHistory } from "../types/workout";

interface UserState {
  hasCompletedOnboarding: boolean;
  boxingLevel: BoxingLevel | null;
  currentWorkout: WorkoutPlan | null;
  workoutHistory: WorkoutHistory[];

  setHasCompletedOnboarding: (completed: boolean) => void;
  setBoxingLevel: (level: BoxingLevel) => void;
  setCurrentWorkout: (workout: WorkoutPlan | null) => void;
  addWorkoutToHistory: (workout: WorkoutHistory) => void;
  clearWorkoutHistory: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      boxingLevel: null,
      currentWorkout: null,
      workoutHistory: [],

      setHasCompletedOnboarding: (completed) =>
        set({ hasCompletedOnboarding: completed }),

      setBoxingLevel: (level) => set({ boxingLevel: level, currentWorkout: null }),

      setCurrentWorkout: (workout) => set({ currentWorkout: workout }),

      addWorkoutToHistory: (workout) =>
        set((state) => ({
          workoutHistory: [workout, ...state.workoutHistory],
        })),

      clearWorkoutHistory: () => set({ workoutHistory: [] }),
    }),
    {
      name: "punchpal-user-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

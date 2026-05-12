export type BoxingLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutType = "quick" | "power" | "endurance" | "technique";

export interface PunchCombo {
  name: string;
  description: string;
  notation: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  duration: number;
  rounds: number;
  difficulty: BoxingLevel;
  type: WorkoutType;
  combos: PunchCombo[];
  generatedAt: Date;
  isFavorite?: boolean;
}

export interface SavedWorkout extends WorkoutPlan {
  savedAt: Date;
}

export interface WorkoutHistory {
  id: string;
  workoutPlanId: string;
  completedAt: Date;
  duration: number;
  rounds: number;
  workoutName: string;
  workoutType: WorkoutType;
  combos?: string[];
  accuracy?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
  totalWorkouts: number;
  totalRounds: number;
  totalMinutes: number;
}

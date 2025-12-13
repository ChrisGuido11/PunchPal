export type BoxingLevel = "beginner" | "intermediate" | "advanced";

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
  combos: PunchCombo[];
  generatedAt: Date;
}

export interface WorkoutHistory {
  id: string;
  workoutPlanId: string;
  completedAt: Date;
  duration: number;
  rounds: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  isPremium?: boolean;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
  totalWorkouts: number;
  totalRounds: number;
  totalMinutes: number;
}

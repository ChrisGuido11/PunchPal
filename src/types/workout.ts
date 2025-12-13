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

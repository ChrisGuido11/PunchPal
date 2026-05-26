export type BoxingLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutType = "quick" | "power" | "endurance" | "technique";
export type WorkoutMode = "classic" | "dynamic";

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ReminderCategory = "form" | "punch_correction" | "tempo";

export interface Combo {
  notation: string;
  expandedSpeech: string;
  punchCount: number;
  hasBodyShot: boolean;
  hasEmbeddedDefense: boolean;
  hasEmbeddedFootwork: boolean;
}

export interface Reminder {
  speech: string;
  category: ReminderCategory;
}

export interface Round {
  roundNumber: number;
  anchorCombo: Combo;
  classicDescription: string;
  classicReminders: Reminder[];
  restTip?: string;
}

// C3 telemetry: which adaptive signals the workout was generated with, and
// how many of the workout's anchors matched each signal list at generation
// time. Lets us measure whether Claude actually respects the signals over
// time (e.g. struggleHitCount should trend to 0 after B1 server-side filter).
export interface SignalTelemetry {
  struggleHitCount: number;
  successHitCount: number;
  recentHitCount: number;
  atLevelCap: boolean;
  featureStruggles: string[];
  featureSuccesses: string[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  duration: number;
  rounds: Round[];
  difficulty: BoxingLevel;
  type: WorkoutType;
  tier: Tier;
  schemaVersion: 2;
  generatedAt: Date;
  // Which mode the workout was generated for. Read by HomeScreen to detect
  // mode-toggle mismatches and trigger an interstitial + regen.
  mode: WorkoutMode;
  isFavorite?: boolean;
  // Captured at generation time so logWorkoutSession can write signal-usage
  // telemetry alongside the workout outcome. Undefined for fallback workouts.
  signalTelemetry?: SignalTelemetry;
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

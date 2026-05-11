export const APP_PREFIX = "punchpal";

export const TABLES = {
  userStats: `${APP_PREFIX}_user_stats`,
  workoutSessions: `${APP_PREFIX}_workout_sessions`,
  comboProgress: `${APP_PREFIX}_combo_progress`,
} as const;

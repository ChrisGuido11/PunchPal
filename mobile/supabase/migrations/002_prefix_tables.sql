-- Add punchpal_ prefix to all PunchPal tables for multi-tenant isolation
-- on the shared Stratega Supabase project.
-- RLS policies and FK constraints follow the rename automatically.
-- Idempotent — safe to re-run.

ALTER TABLE IF EXISTS user_stats RENAME TO punchpal_user_stats;
ALTER TABLE IF EXISTS workout_sessions RENAME TO punchpal_workout_sessions;
ALTER TABLE IF EXISTS combo_progress RENAME TO punchpal_combo_progress;

-- Rename indexes for clarity (auto-generated PK/UNIQUE indexes follow rename)
ALTER INDEX IF EXISTS idx_user_stats_user_id RENAME TO idx_punchpal_user_stats_user_id;
ALTER INDEX IF EXISTS idx_workout_sessions_user_id RENAME TO idx_punchpal_workout_sessions_user_id;
ALTER INDEX IF EXISTS idx_workout_sessions_completed_at RENAME TO idx_punchpal_workout_sessions_completed_at;
ALTER INDEX IF EXISTS idx_combo_progress_user_id RENAME TO idx_punchpal_combo_progress_user_id;
ALTER INDEX IF EXISTS idx_combo_progress_best_accuracy RENAME TO idx_punchpal_combo_progress_best_accuracy;

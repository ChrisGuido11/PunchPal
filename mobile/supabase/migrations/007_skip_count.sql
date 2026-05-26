-- Phase 3 — Skip Combo button telemetry.
-- Per-workout count of how many times the user tapped Skip Combo. The
-- per-combo signal already lands in punchpal_combo_progress.too_hard_count
-- via punchpal_record_combo_rating; this column gives us session-level
-- analytics ("did skip-combo usage decline as adaptive learning kicked in?",
-- "do classic-mode sessions skip less than dynamic-mode?").

ALTER TABLE IF EXISTS punchpal_workout_sessions
  ADD COLUMN IF NOT EXISTS signal_skip_count int NOT NULL DEFAULT 0;

-- Sprint 4 / C3 — Signal-usage telemetry on workout sessions.
-- Lets us measure whether the adaptive signals (struggle/success/recent/cap/
-- feature) actually shape what Claude generates over time. Without this we
-- can't tell if B1 (server hard filter) is doing its job, if the variety
-- block reduces repeats, or whether feature signals correlate with better
-- ratings.

ALTER TABLE IF EXISTS punchpal_workout_sessions
  ADD COLUMN IF NOT EXISTS signal_struggle_hit_count int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_success_hit_count  int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_recent_hit_count   int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_at_level_cap       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signal_feature_struggles  text[]  NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS signal_feature_successes  text[]  NOT NULL DEFAULT '{}'::text[];

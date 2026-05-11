-- Add difficulty_rating column for post-workout user feedback.
-- 1 = too easy, 2 = just right, 3 = too hard. NULL = unrated.
-- Used by the generate-workout edge function to tune future combo complexity.

ALTER TABLE IF EXISTS punchpal_workout_sessions
  ADD COLUMN IF NOT EXISTS difficulty_rating SMALLINT;

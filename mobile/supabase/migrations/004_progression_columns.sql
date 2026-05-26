-- Rating-driven progression columns (Phase 1+2, v5 §6.9).
-- level_cap_staying_since: set when the user taps "Stay" in the celebration
--   modal at progress=100. NULL means user is not in the cap-state.
-- level_cap_too_easy_count_since_stay: counts "Too Easy" ratings while pinned
--   at the cap. At 3, the celebration modal re-fires.
-- recent_combo_signatures: last 10 anchor-combo notation hashes. Sent to the
--   workout-generator EF so Claude can avoid repeating combos when the user
--   is at the level cap.
-- demotion_window: sliding window of the last 5 RatingOutcomes. If 3+ are
--   "too_hard" while currentLevel != beginner, ProfileScreen surfaces a
--   demotion hint (not auto-applied — user taps to revert).
--
-- Applied at runtime via the temp punchpal-migration-004 edge function;
-- `supabase db push` is blocked by sibling apps on the shared project.

ALTER TABLE IF EXISTS punchpal_user_stats
  ADD COLUMN IF NOT EXISTS level_cap_staying_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS level_cap_too_easy_count_since_stay int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_combo_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS demotion_window jsonb NOT NULL DEFAULT '[]'::jsonb;

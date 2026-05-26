-- Migration 005 (2026-05-24) — adaptive learning rating-count columns + atomic upsert RPC.
-- Applied to the shared Supabase project (zeskhorwddxyjhhnpgsa) via the temp Edge Function
-- `punchpal-migration-005`, not via `supabase db push` (blocked by sibling apps' migrations).
-- The temp function is deleted after a successful invocation.

ALTER TABLE IF EXISTS punchpal_combo_progress
  ADD COLUMN IF NOT EXISTS too_easy_count   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS just_right_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS too_hard_count   int NOT NULL DEFAULT 0;

-- combo_name was created as NOT NULL in 001 but we don't always have a meaningful
-- name for arbitrary notations. Relax to nullable; the RPC defaults to notation.
ALTER TABLE IF EXISTS punchpal_combo_progress
  ALTER COLUMN combo_name DROP NOT NULL;

-- Atomic insert-or-increment RPC. Invoked by the mobile client on workout
-- completion for each anchor combo with the rating button (1=too easy,
-- 2=just right, 3=too hard). Runs with SECURITY INVOKER so the existing RLS
-- policies on punchpal_combo_progress enforce per-user isolation.
CREATE OR REPLACE FUNCTION punchpal_record_combo_rating(
  p_user_id  text,
  p_notation text,
  p_name     text,
  p_rating   int
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Defense in depth: caller must match the row's user_id. RLS would catch
  -- this anyway but explicit failure gives a clearer error.
  IF p_user_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'unauthorized: p_user_id does not match auth.uid()';
  END IF;

  IF p_rating NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'invalid rating %, expected 1, 2, or 3', p_rating;
  END IF;

  INSERT INTO punchpal_combo_progress (
    user_id,
    combo_notation,
    combo_name,
    times_attempted,
    too_easy_count,
    just_right_count,
    too_hard_count,
    last_attempt_date,
    updated_at
  ) VALUES (
    p_user_id,
    p_notation,
    COALESCE(p_name, p_notation),
    1,
    CASE WHEN p_rating = 1 THEN 1 ELSE 0 END,
    CASE WHEN p_rating = 2 THEN 1 ELSE 0 END,
    CASE WHEN p_rating = 3 THEN 1 ELSE 0 END,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, combo_notation) DO UPDATE SET
    times_attempted   = punchpal_combo_progress.times_attempted + 1,
    too_easy_count    = punchpal_combo_progress.too_easy_count
                        + CASE WHEN p_rating = 1 THEN 1 ELSE 0 END,
    just_right_count  = punchpal_combo_progress.just_right_count
                        + CASE WHEN p_rating = 2 THEN 1 ELSE 0 END,
    too_hard_count    = punchpal_combo_progress.too_hard_count
                        + CASE WHEN p_rating = 3 THEN 1 ELSE 0 END,
    last_attempt_date = NOW(),
    updated_at        = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION punchpal_record_combo_rating(text, text, text, int)
  TO anon, authenticated;

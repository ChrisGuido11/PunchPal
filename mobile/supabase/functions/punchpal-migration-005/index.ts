/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// Temporary Edge Function — applies migration 005 (adaptive-learning rating
// counts + RPC) to the shared Supabase project's `punchpal_combo_progress`
// table. Delete this function from the dashboard + repo after a successful
// invocation; the migration is idempotent so re-invocations are safe but the
// function should not stay deployed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization, X-Client-Info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALTER_TABLE_SQL = `
  ALTER TABLE IF EXISTS punchpal_combo_progress
    ADD COLUMN IF NOT EXISTS too_easy_count   int NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS just_right_count int NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS too_hard_count   int NOT NULL DEFAULT 0;
`;

const RELAX_NAME_SQL = `
  ALTER TABLE IF EXISTS punchpal_combo_progress
    ALTER COLUMN combo_name DROP NOT NULL;
`;

const CREATE_RPC_SQL = `
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
`;

const GRANT_SQL = `
GRANT EXECUTE ON FUNCTION punchpal_record_combo_rating(text, text, text, int)
  TO anon, authenticated;
`;

const VERIFY_COLUMNS_SQL = `
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'punchpal_combo_progress'
  AND column_name IN ('too_easy_count', 'just_right_count', 'too_hard_count')
ORDER BY column_name;
`;

const VERIFY_RPC_SQL = `
SELECT proname
FROM pg_proc
WHERE proname = 'punchpal_record_combo_rating';
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return json({ error: "SUPABASE_DB_URL not set" }, 500);

  const sql = postgres(dbUrl, { prepare: false });

  try {
    await sql.unsafe(ALTER_TABLE_SQL);
    await sql.unsafe(RELAX_NAME_SQL);
    await sql.unsafe(CREATE_RPC_SQL);
    await sql.unsafe(GRANT_SQL);

    const columns = await sql.unsafe(VERIFY_COLUMNS_SQL);
    const rpc = await sql.unsafe(VERIFY_RPC_SQL);

    return json({
      ok: true,
      columns: columns.map((c: { column_name: string }) => c.column_name),
      rpc: rpc.map((r: { proname: string }) => r.proname),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return json({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});

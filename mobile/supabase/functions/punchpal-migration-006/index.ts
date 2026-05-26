/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// Temporary Edge Function — applies migration 006 (signal-usage telemetry on
// punchpal_workout_sessions). Delete this function from the dashboard + repo
// after a successful invocation; the migration is idempotent so re-invocations
// are safe but the function should not stay deployed.

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
  ALTER TABLE IF EXISTS punchpal_workout_sessions
    ADD COLUMN IF NOT EXISTS signal_struggle_hit_count int     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signal_success_hit_count  int     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signal_recent_hit_count   int     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signal_at_level_cap       boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS signal_feature_struggles  text[]  NOT NULL DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS signal_feature_successes  text[]  NOT NULL DEFAULT '{}'::text[];
`;

const VERIFY_COLUMNS_SQL = `
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'punchpal_workout_sessions'
  AND column_name LIKE 'signal_%'
ORDER BY column_name;
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
    const columns = await sql.unsafe(VERIFY_COLUMNS_SQL);
    return json({
      ok: true,
      columns: columns.map((c: { column_name: string }) => c.column_name),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return json({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});

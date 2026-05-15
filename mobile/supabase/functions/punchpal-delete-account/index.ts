/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "server not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "missing Authorization bearer token" }, 401);
  }

  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "invalid token", detail: userErr?.message }, 401);
  }
  const userId = userData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Delete child rows first (FK CASCADE would handle it, but be explicit so
  // partial failures are visible per-table). Service role bypasses RLS.
  const tableErrors: Record<string, string> = {};
  for (const table of [
    "punchpal_combo_progress",
    "punchpal_workout_sessions",
    "punchpal_user_stats",
  ]) {
    const { error } = await adminClient.from(table).delete().eq("user_id", userId);
    if (error) {
      tableErrors[table] = error.message;
    }
  }

  const dataDeleted = Object.keys(tableErrors).length === 0;

  const { error: authDelErr } = await adminClient.auth.admin.deleteUser(userId);
  const authDeleted = !authDelErr;

  return json({
    data_deleted: dataDeleted,
    auth_deleted: authDeleted,
    ...(Object.keys(tableErrors).length ? { table_errors: tableErrors } : {}),
    ...(authDelErr ? { auth_error: authDelErr.message } : {}),
  });
});

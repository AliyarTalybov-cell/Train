// Регистрация в дневнике: создаёт уже подтверждённый аккаунт, чтобы не ждать письма.
// Настройки входа общего проекта (там же живёт рассрочка) при этом не меняются.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { email?: string; password?: string; name?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "email" }, 400);
  if (password.length < 6 || password.length > 72) return json({ error: "password" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, app: "gym" } });
  if (error) return json({ error: /already|exists|registered/i.test(error.message) ? "exists" : "failed" }, error.status === 422 ? 409 : 400);
  if (name) await admin.from("gym_profile").insert({ user_id: data.user.id, name });
  return json({ ok: true });
});

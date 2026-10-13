// Удаление аккаунта дневника. Всегда стирает все данные дневника (таблицы gym_*) и файлы пользователя в gym-avatars.
// Сам вход удаляется, только если аккаунт создан в дневнике (user_metadata.app = "gym"): тем же входом может
// пользоваться рассрочка, живущая в этом же проекте, — её пользователям вход сохраняется.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// дочерние таблицы раньше родительских (упражнения ссылаются на тренировки)
const TABLES = ["gym_exercises", "gym_workouts", "gym_days", "gym_meals", "gym_foods", "gym_body", "gym_templates",
  "gym_photos", "gym_profile_tracks", "gym_track_favs", "gym_profile"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { confirm?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (String(body.confirm || "").trim().toLowerCase() !== "удалить") return json({ error: "confirm" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !user) return json({ error: "auth" }, 401);
  const uid = user.id;

  // файлы: фото профиля и галерея лежат в папке <uid>/ и <uid>/photos/
  for (const dir of [uid, `${uid}/photos`]) {
    const { data: files } = await admin.storage.from("gym-avatars").list(dir, { limit: 1000 });
    const paths = (files || []).filter(f => f.id).map(f => `${dir}/${f.name}`);
    if (paths.length) await admin.storage.from("gym-avatars").remove(paths);
  }
  for (const t of TABLES) {
    const { error } = await admin.from(t).delete().eq("user_id", uid);
    if (error) return json({ error: "failed", table: t }, 500);
  }
  const { error: shErr } = await admin.from("gym_shares").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`);
  if (shErr) return json({ error: "failed", table: "gym_shares" }, 500);

  const own = user.user_metadata?.app === "gym";
  if (own) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) return json({ error: "failed_user" }, 500);
  }
  return json({ ok: true, account_deleted: own });
});

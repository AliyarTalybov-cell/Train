// ИИ-тренер дневника (проект RassP). Модель — через OpenRouter, ключ в секрете OPENROUTER_API_KEY.
// Данные читает от имени того, кто спрашивает: токен пользователя + RLS,
// поэтому каждый получает советы только по своим тренировкам.
const GYM = "https://qgdtzpsgzlwdhlqdqwex.supabase.co";
const GYM_KEY = "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM";
const MODELS = ["deepseek/deepseek-v4-flash", "mistralai/mistral-small-2603", "nvidia/nemotron-3-super-120b-a12b:free", "qwen/qwen3.8-27b:free"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "auth" }, 401);
  const h = { apikey: GYM_KEY, Authorization: `Bearer ${token}` };
  const me = await fetch(`${GYM}/auth/v1/user`, { headers: h });
  if (!me.ok) return json({ error: "auth" }, 401);

  let body: { question?: string; today?: string; plan?: unknown; program?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = String(body.question || "").slice(0, 600);

  const get = (path: string) => fetch(`${GYM}/rest/v1/${path}`, { headers: h }).then(r => r.ok ? r.json() : []);
  const [profile, ex, meals, days, bodyW] = await Promise.all([
    get("gym_profile?select=name,weight_kg,kcal,goal_mode,protein,fat"),
    get(`gym_exercises?select=name,sets,done,plan,gym_workouts!inner(day,title,feeling,note)&gym_workouts.day=gte.${daysAgo(42)}`),
    get(`gym_meals?select=day,kcal,protein&day=gte.${daysAgo(14)}`),
    get(`gym_days?select=day,sleep_h&day=gte.${daysAgo(14)}`),
    get("gym_body?select=day,weight_kg&order=day.desc&limit=8"),
  ]);

  // Короткая выжимка вместо сырых таблиц: по дням — тренировка, упражнения с подходами.
  const byDay: Record<string, { title: string; feeling?: number; note?: string; items: string[] }> = {};
  for (const e of ex as any[]) {
    const w = e.gym_workouts, d = w.day;
    byDay[d] ||= { title: w.title || "Тренировка", feeling: w.feeling, note: w.note, items: [] };
    const sets = (e.sets || []).map((s: any) => `${s.w ?? "?"}×${s.r ?? "?"}${s.done || e.done ? "" : "(не сделан)"}`).join(", ");
    byDay[d].items.push(`${e.name}${e.plan ? ` [план ${e.plan}]` : ""}: ${sets || "без подходов"}`);
  }
  const food: Record<string, { k: number; p: number }> = {};
  for (const m of meals as any[]) { food[m.day] ||= { k: 0, p: 0 }; food[m.day].k += +m.kcal; food[m.day].p += +m.protein; }
  const ctx = [
    `Сегодня: ${body.today}.`,
    `Профиль: ${JSON.stringify((profile as any[])[0] || {})} (protein/fat — г на кг веса при goal_mode=perkg, иначе % калорий).`,
    `Программа: ${JSON.stringify(body.program || "не выбрана")}.`,
    `План на сегодня: ${JSON.stringify(body.plan || "день отдыха")}.`,
    "Тренировки за 6 недель:",
    ...Object.keys(byDay).sort().map(d => `${d} ${byDay[d].title}${byDay[d].feeling ? ` (самочувствие ${byDay[d].feeling}/5)` : ""}${byDay[d].note ? ` — «${byDay[d].note}»` : ""}: ${byDay[d].items.join("; ")}`),
    `Питание за 14 дней (ккал/белок): ${Object.keys(food).sort().map(d => `${d}: ${Math.round(food[d].k)}/${Math.round(food[d].p)}г`).join("; ") || "не записано"}.`,
    `Сон: ${(days as any[]).filter(x => x.sleep_h != null).map(x => `${x.day}: ${x.sleep_h}ч`).join("; ") || "не отмечен"}.`,
    `Вес тела: ${(bodyW as any[]).map(x => `${x.day}: ${x.weight_kg}`).join("; ") || "не записан"}.`,
  ].join("\n");

  const system = `Ты — внимательный тренер по силовым тренировкам в дневнике двух друзей. Пиши по-русски, коротко и по делу, на «ты».
Смотри на данные: что человек делал, как восстановился (сон, самочувствие, когда последний раз грузил эту группу мышц), хватает ли белка и калорий, растут ли рабочие веса.
Опирайся на принципы: каждая мышца 2 раза в неделю, отдых группе 48–72 часа, прогрессия веса (сделал верх диапазона во всех подходах — добавь 2,5 кг), при недосыпе или плохом самочувствии — снизить объём, а не пропускать.
Не выдумывай данных, которых нет. Если данных мало, так и скажи и дай общий совет.
Верни только JSON:
{"headline": "одна фраза — главное на сегодня",
 "today": "2–4 предложения: что качать сегодня и почему (если день отдыха — отдыхать или что лёгкое сделать)",
 "changes": [{"name": "точное название упражнения из плана на сегодня", "weight": число кг или null, "sets": число или null, "reps": "например 8–10" или null, "why": "коротко почему"}],
 "tips": ["1–3 коротких совета по питанию, сну или технике по данным"],
 "answer": "ответ на вопрос пользователя, если он был, иначе пустая строка"}
changes — только для упражнений из плана на сегодня и только если правда стоит что-то поменять; можно пустой список.`;

  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json({ error: "no_key" }, 503);
  let last = "";
  for (const model of MODELS) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://training-diary-azure.vercel.app", "X-Title": "Gym diary" },
        body: JSON.stringify({
          model, max_tokens: 1200, temperature: 0.4, response_format: { type: "json_object" }, reasoning: { enabled: false },
          messages: [{ role: "system", content: system }, { role: "user", content: ctx + (question ? `\n\nВопрос пользователя: ${question}` : "") }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { last = `${model} ${r.status}`; continue; }
      const text = String(data.choices?.[0]?.message?.content || "").replace(/^```(json)?|```$/g, "").trim();
      const out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if (!out.today && !out.answer) { last = `${model} empty`; continue; }
      return json({
        headline: String(out.headline || ""), today: String(out.today || ""), answer: String(out.answer || ""),
        tips: Array.isArray(out.tips) ? out.tips.map(String).slice(0, 4) : [],
        changes: Array.isArray(out.changes) ? out.changes.slice(0, 8).map((c: any) => ({
          name: String(c.name || ""), weight: Number.isFinite(+c.weight) && c.weight !== null ? +c.weight : null,
          sets: Number.isFinite(+c.sets) && c.sets !== null ? Math.max(1, Math.min(10, Math.round(+c.sets))) : null,
          reps: c.reps ? String(c.reps).slice(0, 12) : null, why: String(c.why || ""),
        })).filter((c: any) => c.name) : [],
      });
    } catch (e) { last = `${model} ${String((e as Error).message).slice(0, 80)}`; }
  }
  console.error("gym-coach failed:", last);
  return json({ error: "ai_unavailable" }, 503);
});

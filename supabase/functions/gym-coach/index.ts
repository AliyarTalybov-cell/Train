// ИИ-тренер дневника (проект RassP). Модель — через OpenRouter, ключ в секрете OPENROUTER_API_KEY.
// Данные читает от имени того, кто спрашивает (токен пользователя), и только его строки — фильтр по user_id.
const GYM = "https://qgdtzpsgzlwdhlqdqwex.supabase.co";
const GYM_KEY = "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM";
const MODELS = ["deepseek/deepseek-v4-flash", "mistralai/mistral-small-2603", "nvidia/nemotron-3-super-120b-a12b:free", "qwen/qwen3.8-27b:free"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const WDN = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
function dateTable(today: string) {
  const t0 = Date.parse(today + "T12:00:00Z"), out: string[] = [];
  for (let i = -7; i <= 35; i++) { const d = new Date(t0 + i * 864e5); out.push(`${d.toISOString().slice(0, 10)} ${WDN[d.getUTCDay()]}${i === 0 ? " (сегодня)" : i === 1 ? " (завтра)" : i === -1 ? " (вчера)" : ""}`); }
  return out.join("; ");
}
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "auth" }, 401);
  const h = { apikey: GYM_KEY, Authorization: `Bearer ${token}` };
  const me = await fetch(`${GYM}/auth/v1/user`, { headers: h });
  if (!me.ok) return json({ error: "auth" }, 401);
  const uid = (await me.json())?.id;
  if (!uid) return json({ error: "auth" }, 401);

  let body: { question?: string; today?: string; plan?: unknown; program?: unknown; calendar?: unknown; muscles?: { g?: string; last?: string | null; sets7?: number }[]; known?: string[]; history?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = String(body.question || "").slice(0, 600);

  const get = (path: string) => fetch(`${GYM}/rest/v1/${path}`, { headers: h }).then(r => r.ok ? r.json() : []);
  // все вошедшие видят дневники друг друга (RLS select для всех) — поэтому своё фильтруем по user_id явно;
  // в историю — только прошедшие дни и сегодня, будущее тренер видит в календаре
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today)) ? String(body.today) : daysAgo(0);
  const [prof] = await get(`gym_profile?select=weight_kg,height_cm&user_id=eq.${uid}`) as any[];
  const ex = await get(`gym_exercises?select=name,sets,done,plan,gym_workouts!inner(day,title)&user_id=eq.${uid}&gym_workouts.day=gte.${daysAgo(42)}&gym_workouts.day=lte.${today}`);

  // Короткая выжимка вместо сырых таблиц: по дням — тренировка, упражнения с подходами.
  const byDay: Record<string, { title: string; items: string[]; done: boolean }> = {};
  for (const e of ex as any[]) {
    const w = e.gym_workouts, d = w.day;
    byDay[d] ||= { title: w.title || "Тренировка", items: [], done: false };
    const done = (e.sets || []).filter((s: any) => s.done || e.done);
    if (!done.length && !e.done) continue;
    byDay[d].done = true;
    byDay[d].items.push(`${e.name}${e.plan ? ` [план ${e.plan}]` : ""}: ${done.map((s: any) => `${s.w ?? "?"}×${s.r ?? "?"}`).join(", ") || "сделано"}`);
  }
  // Таблица мышц считается в браузере (там знают группу каждого упражнения); статус — от числа дней отдыха.
  const DAY = 864e5, ref = Date.parse(today + "T12:00:00Z");
  const muscles = (Array.isArray(body.muscles) ? body.muscles : []).slice(0, 15).map(m => {
    const g = String(m?.g || "").slice(0, 30), last = /^\d{4}-\d{2}-\d{2}$/.test(String(m?.last)) ? String(m!.last) : null;
    const ago = last ? Math.round((ref - Date.parse(last + "T12:00:00Z")) / DAY) : null;
    const st = ago === null || ago >= 5 ? "ДАВНО НЕ БЫЛО — в приоритете" : ago <= 2 ? "ВОССТАНАВЛИВАЕТСЯ — не нагружать" : "восстановилась — можно";
    return { g, ago, st, line: `${g}: ${ago === null ? "не работала 4 недели" : ago === 0 ? "работала сегодня" : `последний раз ${last} (${ago} дн. назад)`}, подходов за 7 дней: ${Math.max(0, Math.round(+(m?.sets7 ?? 0)) || 0)} — ${st}` };
  }).filter(m => m.g);
  const rest = muscles.filter(m => m.ago !== null && m.ago <= 2).map(m => m.g);
  const fresh = muscles.filter(m => m.ago === null || m.ago > 2).sort((a, b) => (b.ago ?? 99) - (a.ago ?? 99)).map(m => m.g);
  const ctx = [
    `Сегодня: ${body.today}, ${WDN[new Date(String(body.today) + "T12:00:00Z").getUTCDay()]}. Даты в таблице: ${dateTable(String(body.today))}`,
    `Человек: вес ${prof?.weight_kg ?? "не указан"} кг, рост ${prof?.height_cm ?? "не указан"} см.`,
    `Программа: ${JSON.stringify(body.program || "не выбрана")}.`,
    `Тренировка на этот день: ${JSON.stringify(body.plan || "ничего не запланировано")}.`,
    ...(muscles.length ? [
      "МЫШЦЫ — когда реально работали (считаются только отмеченные подходы; пропущенные тренировки не в счёт):",
      ...muscles.map(m => "- " + m.line),
      `Отдыхают сейчас: ${rest.join(", ") || "никто"}. Готовы, от самых давно не работавших: ${fresh.join(", ") || "—"}.`,
    ] : []),
    "Тренировки за 6 недель (что реально сделано; «пропущена» — стояла в календаре, но ничего не отмечено, нагрузки не было):",
    ...(Object.keys(byDay).length ? Object.keys(byDay).sort().map(d => byDay[d].done ? `${d} ${byDay[d].title}: ${byDay[d].items.join("; ")}` : `${d} ${byDay[d].title}: пропущена`) : ["пока ничего не записано"]),
    ...(question ? [
      `Календарь на 4 недели вперёд (st: done — сделано, planned — запланировано, rest — пусто): ${JSON.stringify(body.calendar || []).slice(0, 6000)}`,
      `Упражнения, для которых есть фото (если подходит, называй именно так): ${(body.known || []).slice(0, 120).join("; ")}`,
    ] : []),
  ].join("\n");
  const history = (body.history || []).slice(-6).map(m => `${m.role === "assistant" ? "Тренер" : "Пользователь"}: ${String(m.content).slice(0, 500)}`).join("\n");

  // Обязательные правила выбора мышц — общие для совета дня и чата.
  const RULES = `ОБЯЗАТЕЛЬНО, прежде чем что-то советовать:
1. Смотри таблицу «МЫШЦЫ» — это главный источник. Нагрузка была только там, где отмечены подходы. Пропущенные тренировки и планы — не нагрузка.
2. Группы со статусом «ВОССТАНАВЛИВАЕТСЯ» (работали 0–2 дня назад) не предлагай ни на этот день, ни на завтра, даже если они стоят в плане или программе. Пресс и икры — тоже не каждый день.
3. Предлагай в первую очередь группы «ДАВНО НЕ БЫЛО», затем «восстановилась» — от тех, что дольше всего без нагрузки и с меньшим числом подходов за 7 дней.
4. План или программа на этот день хороши, если не нарушают пункт 2. Если нарушают — прямо скажи, какие упражнения убрать, и предложи вместо них упражнения на готовые группы.
5. Всегда коротко объясняй выбор по фактам: какие мышцы и когда работали последний раз (днём недели словами) и почему сегодня — эти.`;
  const system = `Ты — внимательный тренер по силовым тренировкам в дневнике двух друзей. Пиши по-русски, коротко и по делу, на «ты», живым языком.
Ты только читаешь дневник и советуешь, сам ничего не меняешь.
Смотри на данные: что человек делал, когда последний раз грузил каждую группу мышц, растут ли рабочие веса, не пропускает ли.
Опирайся на принципы: каждая мышца 2 раза в неделю, отдых группе 48–72 часа, прогрессия веса (сделал верх диапазона во всех подходах — добавь 2,5 кг), при усталости — снизить объём, а не пропускать.
Не выдумывай данных, которых нет. Если данных мало, так и скажи и дай общий совет. Даты пиши словами («в четверг»), без ГГГГ-ММ-ДД.
${RULES}
Верни только JSON:
{"headline": "одна фраза — главное на этот день",
 "today": "2–4 предложения: что лучше сделать в этот день и почему (если тренировки нет — отдохнуть или что лучше потренировать)",
 "changes": [{"name": "упражнение из тренировки на этот день", "weight": число кг или null, "sets": число или null, "reps": "например 8–10" или null, "why": "коротко почему"}],
 "tips": ["0–2 коротких совета по технике или распределению нагрузки"],
 "answer": "ответ на вопрос пользователя, если он был, 1–5 предложений, иначе пустая строка"}
changes — только если правда стоит поменять вес или подходы; можно пустой список. Если есть вопрос, главное — answer.`;
  // Разговор: тренер отвечает и может сам расписать тренировки в календаре.
  const systemChat = `Ты — тренер по силовым тренировкам в дневнике двух друзей. Пиши по-русски, коротко, на «ты», живым языком.
Ты можешь сам ставить тренировки в календарь пользователя. Если он просит план, программу, расписать неделю, поставить или убрать тренировку — сразу делай это через actions, не переспрашивай по мелочам: выбери разумные значения сам.
Составляй тренировки сам, не обязательно из готовых программ. Правила: каждая мышца 2 раза в неделю, одной группе 48–72 часа отдыха, базовые упражнения в начале, 5–7 упражнений в тренировке, у приоритетных мышц больше подходов и упражнений. Подходы и повторы конкретные (например 4 и "8–10"). Вес бери из истории (последний рабочий); если не знаешь — null.
${RULES}
Если ставишь тренировку на сегодня или ближайшие дни — строго по таблице «МЫШЦЫ». В длинном плане на недели вперёд первый день начинай с групп, которые давно не работали.
Если просят план без срока — ставь на 4 недели. Начало плана — ближайший понедельник после сегодняшнего дня, если не сказали иначе (можно и с сегодня, если просят «с сегодня»).
Даты — только формат ГГГГ-ММ-ДД и только из таблицы дат. Дни недели в плане: 0 — понедельник … 6 — воскресенье.
Если просьба — просто вопрос, actions пустой.
Верни только JSON:
{"reply": "1–4 предложения: что сделал или ответ; даты словами («с понедельника, 12 октября»), без ГГГГ-ММ-ДД и без слов JSON/null",
 "actions": [
  {"type": "plan", "start": "ГГГГ-ММ-ДД", "weeks": 4, "days": [{"wd": 0, "title": "Верх: спина и руки", "exercises": [{"name": "Подтягивания", "sets": 4, "reps": "8–10", "weight": null}]}]},
  {"type": "create", "day": "ГГГГ-ММ-ДД", "title": "...", "exercises": [ ... как выше ]},
  {"type": "delete", "day": "ГГГГ-ММ-ДД"}
 ]}
plan — повторяющаяся неделя на weeks недель (она заменяет программу в календаре). create — одна тренировка на день (заменяет то, что там стоит). delete — сделать день пустым.`;
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json({ error: "no_key" }, 503);
  let last = "";
  for (const model of MODELS) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://training-diary-azure.vercel.app", "X-Title": "Gym diary" },
        body: JSON.stringify({
          model, max_tokens: question ? 4000 : 1200, temperature: 0.4, response_format: { type: "json_object" }, reasoning: { enabled: false },
          messages: [{ role: "system", content: question ? systemChat : system }, { role: "user", content: ctx + (history ? `\n\nРазговор до этого:\n${history}` : "") + (question ? `\n\nВопрос пользователя: ${question}` : "") }],
        }),
        signal: AbortSignal.timeout(question ? 60000 : 30000),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { last = `${model} ${r.status}`; continue; }
      const text = String(data.choices?.[0]?.message?.content || "").replace(/^```(json)?|```$/g, "").trim();
      const out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if (question) {
        if (!out.reply) { last = `${model} empty`; continue; }
        const D = /^\d{4}-\d{2}-\d{2}$/, ok = (d: unknown) => typeof d === "string" && D.test(d) && Math.abs(Date.parse(d) - Date.now()) < 120 * 864e5;
        const num = (v: unknown) => v === null || v === undefined || v === "" || !Number.isFinite(+(v as number)) ? null : +(v as number);
        const exs = (a: unknown) => (Array.isArray(a) ? a : []).slice(0, 10).map((e: any) => ({ name: String(e?.name || "").slice(0, 80), sets: Math.max(1, Math.min(8, Math.round(num(e?.sets) ?? 3))), reps: e?.reps ? String(e.reps).slice(0, 12) : null, weight: num(e?.weight) })).filter(e => e.name);
        const actions = (Array.isArray(out.actions) ? out.actions : []).slice(0, 30).map((a: any) => {
          switch (a?.type) {
            case "plan": {
              const days = (Array.isArray(a.days) ? a.days : []).slice(0, 7).map((d: any) => ({ wd: Math.round(num(d?.wd) ?? -1), title: String(d?.title || "Тренировка").slice(0, 80), exercises: exs(d?.exercises) }))
                .filter((d: any) => d.wd >= 0 && d.wd <= 6 && d.exercises.length);
              return ok(a.start) && days.length ? { type: "plan", start: a.start, weeks: Math.max(1, Math.min(12, Math.round(num(a.weeks) ?? 4))), days } : null;
            }
            case "create": { const e = exs(a.exercises); return ok(a.day) && e.length ? { type: "create", day: a.day, title: String(a.title || "Тренировка").slice(0, 80), exercises: e } : null; }
            case "delete": return ok(a.day) ? { type: "delete", day: a.day } : null;
          }
          return null;
        }).filter(Boolean);
        return json({ reply: String(out.reply), actions });
      }
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

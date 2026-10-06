import { createClient } from "@supabase/supabase-js";
import "./fonts.css";
import { PROGRAMS, PRINCIPLES, programById, sessionFor } from "./programs.js";
import "./style.css";

// Та же база, что у рассрочки (проект RassP); дневник живёт в своих таблицах gym_*, каждая строка видна только владельцу.
const sb = createClient("https://qgdtzpsgzlwdhlqdqwex.supabase.co", "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM", {
  auth: { persistSession: true, storageKey: "gym-auth" },
});

const app = document.getElementById("app");
const S = { user: null, profile: null, workouts: [], exercises: [], templates: [], foods: [], body: [], meals: {}, day: iso(new Date()), foodDay: iso(new Date()), loaded: false };

/* ---------- helpers ---------- */
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function monday(s) { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); }
const today = () => iso(new Date());
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const longDay = s => { const d = parse(s); return `${WD_FULL[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const shortDay = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 0) => n == null ? "—" : Number(n).toLocaleString("ru-RU", { maximumFractionDigits: d });
const norm = s => String(s || "").trim().toLowerCase().replace(/ё/g, "е");
const uid = () => crypto.randomUUID();

const I = {
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a3 3 0 0 0 3 3v7M10 3v8a3 3 0 0 1-3 3M7 3v6M17 21V3c-2.2 1.3-3.5 4-3.5 7.5 0 2 1.2 3.5 3.5 3.5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

/* ---------- network ---------- */
let pending = 0;
const netbar = document.getElementById("netbar");
async function q(builder, { silent = false } = {}) {
  pending++; netbar.classList.add("on");
  try {
    const { data, error } = await builder;
    if (error) throw error;
    return data;
  } catch (e) {
    console.error(e);
    if (!silent) toast(navigator.onLine ? "Не получилось сохранить — попробуйте ещё раз" : "Нет интернета — изменения не сохранились");
    throw e;
  } finally {
    if (--pending === 0) netbar.classList.remove("on");
  }
}
const timers = new Map();
function later(key, fn, ms = 600) { clearTimeout(timers.get(key)); timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms)); }

let toastEl;
function toast(text, action) {
  toastEl?.remove();
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status");
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  if (action) el.querySelector("button").onclick = () => { el.remove(); action.run(); };
  document.body.append(el); toastEl = el;
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, action ? 5000 : 3000);
}

/* ---------- sheet ---------- */
function sheet(title, html, mount, onClose) {
  const bd = document.createElement("div");
  bd.className = "sheet-backdrop";
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn bare" data-close aria-label="Закрыть">${I.x}</button></div>${html}</div>`;
  const prev = document.activeElement;
  const close = () => { if (!bd.isConnected || !bd.classList.contains("open")) return; onClose?.(); bd.classList.remove("open"); document.removeEventListener("keydown", onKey); setTimeout(() => bd.remove(), 320); prev?.focus?.({ preventScroll: true }); };
  const onKey = e => { if (e.key === "Escape") close(); };
  bd.addEventListener("click", e => { if (e.target === bd || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(bd);
  requestAnimationFrame(() => bd.classList.add("open"));
  mount?.(bd.querySelector(".sheet"), close);
  return close;
}
function confirmSheet(title, text, ok = "Удалить") {
  return new Promise(res => {
    let answer = false;
    sheet(title, `<p class="muted">${esc(text)}</p><div class="sheet-actions"><button class="btn quiet" data-close>Отмена</button><button class="btn danger" data-ok>${esc(ok)}</button></div>`, (el, close) => {
      el.querySelector("[data-ok]").onclick = () => { answer = true; close(); };
    }, () => res(answer));
  });
}

/* ---------- theme ---------- */
const getTheme = () => { try { return localStorage.getItem("gym-theme") || "system"; } catch { return "system"; } };
function setTheme(t) {
  try { t === "system" ? localStorage.removeItem("gym-theme") : localStorage.setItem("gym-theme", t); } catch {}
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

/* ---------- data ---------- */
async function loadAll() {
  const [profile, workouts, exercises, templates, foods, body] = await Promise.all([
    q(sb.from("gym_profile").select("*").maybeSingle(), { silent: true }),
    q(sb.from("gym_workouts").select("*").order("day"), { silent: true }),
    q(sb.from("gym_exercises").select("*").order("position"), { silent: true }),
    q(sb.from("gym_templates").select("*").order("created_at"), { silent: true }),
    q(sb.from("gym_foods").select("*").order("name"), { silent: true }),
    q(sb.from("gym_body").select("*").order("day"), { silent: true }),
  ]);
  Object.assign(S, { workouts, exercises, templates, foods, body });
  S.profile = profile || await q(sb.from("gym_profile").insert({ name: (S.user.email || "").split("@")[0] }).select().single());
  S.loaded = true;
}
const workoutOn = day => S.workouts.find(w => w.day === day);
const exercisesOf = wid => S.exercises.filter(e => e.workout_id === wid).sort((a, b) => a.position - b.position);
const dayOfWorkout = wid => S.workouts.find(w => w.id === wid)?.day;

function lastFor(name, beforeDay) {
  const n = norm(name); if (!n) return null;
  let best = null;
  for (const e of S.exercises) {
    if (norm(e.name) !== n || !e.sets?.length) continue;
    const d = dayOfWorkout(e.workout_id);
    if (!d || d >= beforeDay) continue;
    if (!best || d > best.day) best = { day: d, sets: e.sets };
  }
  return best;
}
const setsText = sets => sets.filter(s => s.w != null || s.r != null).map(s => `${s.w != null ? fmt(s.w, 1) : "—"}×${s.r ?? "—"}`).join(" · ");

function goals() {
  const p = S.profile || {};
  const kcal = Number(p.kcal) || 0, w = Number(p.weight_kg) || 0;
  let P, F;
  if (p.goal_mode === "percent") { P = kcal * (Number(p.protein) || 0) / 100 / 4; F = kcal * (Number(p.fat) || 0) / 100 / 9; }
  else { P = (Number(p.protein) || 0) * w; F = (Number(p.fat) || 0) * w; }
  const C = Math.max(0, (kcal - P * 4 - F * 9) / 4);
  return { kcal, P: Math.round(P), F: Math.round(F), C: Math.round(C), needWeight: p.goal_mode !== "percent" && !w };
}

/* ---------- routing ---------- */
const ROUTES = [
  { path: "", label: "Календарь", icon: I.week, view: weekView },
  { path: "program", label: "Программа", icon: I.list, view: programView },
  { path: "food", label: "Питание", icon: I.food, view: foodView },
  { path: "progress", label: "Прогресс", icon: I.chart, view: progressView },
  { path: "me", label: "Профиль", icon: I.user, view: profileView },
];
const route = () => ROUTES.find(r => r.path === location.hash.replace(/^#\/?/, "")) || ROUTES[0];

function render() {
  if (!S.user) return loginView();
  const r = route();
  const links = cls => ROUTES.map(x => `<a href="#/${x.path}" ${x === r ? 'aria-current="page"' : ""}>${x.icon}<span>${x.label}</span></a>`).join("");
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#/">Дневник<span>.</span></a><nav class="nav" aria-label="Разделы">${links()}</nav></header>
    <main class="wrap screen" id="main">${S.loaded ? r.view() : skeleton()}</main>
    <nav class="tabbar" aria-label="Разделы">${links()}</nav>`;
  if (S.loaded) r.after?.();
  if (S.loaded && r.path === "food") ensureMeals(S.foodDay);
}
function rerender() { // перерисовать экран без анимации входа и без прыжка прокрутки
  const main = document.getElementById("main"); if (!main) return render();
  main.classList.remove("screen");
  main.innerHTML = route().view();
}
function skeleton() {
  return `<div style="display:grid;gap:12px;padding-top:28px"><div class="skel" style="height:14px;width:40%"></div><div class="skel" style="height:68px"></div><div class="skel" style="height:40px;width:60%"></div><div class="skel" style="height:140px"></div><div class="skel" style="height:140px"></div></div>`;
}
window.addEventListener("hashchange", () => { render(); scrollTo({ top: 0 }); });

/* ---------- login ---------- */
const FN_SIGNUP = "https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-signup";
function loginView(mode = "in") {
  const up = mode === "up";
  app.innerHTML = `
    <main class="login screen">
      <div class="hero" style="padding:0">
        <div class="kicker">Тренировки · питание</div>
        <h1>Дневник<em>.</em></h1>
        <p class="lead">Программа на каждый день, отметки подходов и калории.</p>
      </div>
      <div class="seg full" role="radiogroup" aria-label="Вход или регистрация">
        <button role="radio" data-auth="in" aria-checked="${!up}">Вход</button>
        <button role="radio" data-auth="up" aria-checked="${up}">Регистрация</button>
      </div>
      <form id="login" novalidate>
        ${up ? `<label class="field"><span>Имя</span><input class="inp" name="name" autocomplete="given-name" maxlength="40"></label>` : ""}
        <label class="field"><span>Почта</span><input class="inp" type="email" name="email" autocomplete="${up ? "email" : "username"}" inputmode="email" required></label>
        <label class="field"><span>Пароль${up ? ", не короче 6 символов" : ""}</span><input class="inp" type="password" name="password" autocomplete="${up ? "new-password" : "current-password"}" required></label>
        <p class="err" id="lerr" role="alert"></p>
        <button class="btn" type="submit">${up ? "Создать аккаунт" : "Войти"}</button>
      </form>
    </main>`;
  app.querySelectorAll("[data-auth]").forEach(b => b.onclick = () => { if (b.dataset.auth !== mode) { const em = app.querySelector("[name=email]").value; loginView(b.dataset.auth); app.querySelector("[name=email]").value = em; } });
  const f = document.getElementById("login");
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector("[type=submit]"), err = document.getElementById("lerr");
    const email = f.email.value.trim(), password = f.password.value;
    const fail = text => { err.textContent = text; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); btn.classList.remove("loading"); btn.disabled = false; };
    if (!email || !password) return fail("Введите почту и пароль");
    if (up && password.length < 6) return fail("Пароль должен быть не короче 6 символов");
    btn.classList.add("loading"); btn.disabled = true; err.textContent = "";
    if (up) {
      let r;
      try { r = await fetch(FN_SIGNUP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name: f.name.value.trim() }) }).then(x => x.json()); }
      catch { return fail("Не получилось — проверьте интернет"); }
      if (!r.ok) return fail({ exists: "Такая почта уже зарегистрирована — войдите", email: "Проверьте почту — похоже, в ней опечатка", password: "Пароль должен быть от 6 до 72 символов" }[r.error] || "Не получилось создать аккаунт");
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) fail(/invalid/i.test(error.message) ? "Неверная почта или пароль" : "Не получилось войти — проверьте интернет");
  };
}

/* ---------- calendar ---------- */
const sessionOn = day => sessionFor(S.profile, day, { parse, monday });
const getCalMode = () => { try { return localStorage.getItem("gym-cal") === "month" ? "month" : "week"; } catch { return "week"; } };
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function dayInfo(d) {
  const w = workoutOn(d), ex = w ? exercisesOf(w.id) : [], plan = !w && sessionOn(d);
  return { w, plan, done: !!ex.length && ex.every(e => e.done), title: w ? (w.title || "Тренировка") : plan ? plan.title : "" };
}
function dayCell(d, { label, outside } = {}) {
  const t = today(), i = dayInfo(d);
  const cls = ["day", i.w && "has", i.plan && "planned", i.done && "done", d === t && "today", outside && "outside"].filter(Boolean).join(" ");
  return `<button class="${cls}" data-act="pick-day" data-day="${d}" ${d === S.day ? 'aria-current="true"' : ""} aria-label="${longDay(d)}${i.title ? ", " + esc(i.title) : ""}">
    ${label ? `<span class="dw">${label}</span>` : ""}<span class="dn">${parse(d).getDate()}</span><span class="dt ${i.title ? "" : "rest"}">${esc(i.title || "Отдых")}</span><i class="mark"></i></button>`;
}
function weekView() {
  const mode = getCalMode(), t = today();
  let head, grid;
  if (mode === "month") {
    const d0 = parse(S.day), first = iso(new Date(d0.getFullYear(), d0.getMonth(), 1)), start = monday(first);
    const last = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), end = addDays(monday(last), 6);
    const cells = []; for (let d = start; d <= end; d = addDays(d, 1)) cells.push(dayCell(d, { outside: parse(d).getMonth() !== d0.getMonth() }));
    head = `${MONTHS[d0.getMonth()]} ${d0.getFullYear()}`;
    grid = `<div class="month"><div class="wd-row">${WD.map(w => `<span>${w}</span>`).join("")}</div><nav class="days days-month" aria-label="Дни месяца">${cells.join("")}</nav></div>`;
  } else {
    const start = monday(S.day), days = Array.from({ length: 7 }, (_, i) => addDays(start, i)), end = days[6];
    head = parse(start).getMonth() === parse(end).getMonth() ? `${parse(start).getDate()} – ${shortDay(end)}` : `${shortDay(start)} – ${shortDay(end)}`;
    grid = `<nav class="days" aria-label="Дни недели">${days.map((d, i) => dayCell(d, { label: WD[i] })).join("")}</nav>`;
  }
  const away = mode === "month" ? S.day.slice(0, 7) !== t.slice(0, 7) : monday(S.day) !== monday(t);
  return `
    <section class="hero">
      <div class="cal-top">
        <div class="seg" role="radiogroup" aria-label="Вид календаря"><button role="radio" data-act="cal-mode" data-v="week" aria-checked="${mode === "week"}">Неделя</button><button role="radio" data-act="cal-mode" data-v="month" aria-checked="${mode === "month"}">Месяц</button></div>
        ${away || S.day !== t ? `<button class="linkbtn" data-act="today">Сегодня</button>` : ""}
      </div>
      <div class="week-head">
        <div class="cal-title">${head}</div>
        <div class="row">
          <button class="icon-btn bare" data-act="shift" data-n="-1" aria-label="Назад">${I.left}</button>
          <button class="icon-btn bare" data-act="shift" data-n="1" aria-label="Вперёд">${I.right}</button>
        </div>
      </div>
      ${grid}
    </section>
    <section class="day-panel" id="day-panel">${dayPanel()}</section>`;
}

// Предложенный вес: как в прошлый раз, и +2,5 кг, если тогда во всех подходах дошёл до верха диапазона.
function suggestSets(name, sets, reps) {
  const top = parseInt(String(reps).split("–").pop()) || null, low = parseInt(reps) || null;
  const last = lastFor(name, S.day + "~");
  const ws = (last?.sets || []).map(s => +s.w).filter(Boolean), lw = ws.length ? Math.max(...ws) : null;
  const hit = last && top && last.sets.length && last.sets.every(s => (+s.r || 0) >= top);
  const w = lw ? (hit ? lw + 2.5 : lw) : null;
  return { sets: Array.from({ length: sets }, () => ({ w, r: low, done: false })), up: !!hit, last };
}

function planPanel(p, d) {
  const items = p.ex.map(e => {
    const s = suggestSets(e.name, e.sets, e.reps);
    return `<li><div class="pl-main"><b>${esc(e.name)}</b><span>${s.last ? `${shortDay(s.last.day)}: ${esc(setsText(s.last.sets))}${s.up ? " · можно добавить вес" : ""}` : esc(e.tip || "")}</span></div><span class="pl-sets mono">${e.sets} × ${e.reps}</span></li>`;
  }).join("");
  return `
    <div class="plan">
      <div class="plan-head"><h2>${esc(p.title)}</h2><p class="muted">${esc(p.focus)} · неделя ${p.week}</p></div>
      <ol class="plan-list">${items}</ol>
      <div class="row"><button class="btn" data-act="start-plan">Начать тренировку</button><button class="btn quiet" data-act="new-w">Своя тренировка</button></div>
    </div>`;
}
function nextSession(from) {
  for (let i = 1; i <= 14; i++) { const d = addDays(from, i), p = sessionOn(d); if (p) return { d, p }; }
  return null;
}

function dayPanel() {
  const d = S.day, w = workoutOn(d);
  const head = `<div class="eyebrow"><span>${longDay(d)}</span>${d === today() ? "<span>Сегодня</span>" : ""}</div>`;
  if (!w) {
    const p = sessionOn(d);
    if (p) return head + planPanel(p, d);
    const nx = S.profile?.program_id && nextSession(d);
    return `${head}
    <div class="empty-day">
      <p class="muted">${S.profile?.program_id ? `День отдыха.${nx ? ` Следующая тренировка — ${WD_FULL[(parse(nx.d).getDay() + 6) % 7].toLowerCase()}, ${shortDay(nx.d)}: ${esc(nx.p.title)}.` : ""}` : `На этот день ничего не запланировано. <a href="#/program">Выберите программу</a> — и каждый день будет понятно, что тренировать.`}</p>
      <div class="row">
        <button class="btn ${S.profile?.program_id ? "ghost" : ""}" data-act="new-w">${I.plus}Своя тренировка</button>
        ${S.templates.length || S.workouts.length ? `<button class="btn quiet" data-act="from-tpl">Из шаблона или прошлой</button>` : ""}
      </div>
    </div>`;
  }
  const ex = exercisesOf(w.id), done = ex.filter(e => e.done).length;
  const names = [...new Set(S.exercises.map(e => e.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  const feel = ["Тяжело", "Так себе", "Норм", "Хорошо", "Отлично"];
  return `${head}
    <input class="title-inp" data-field="w-title" value="${esc(w.title)}" placeholder="Название, например «Грудь и трицепс»" aria-label="Название тренировки" maxlength="80">
    <div class="progress"><div class="bar"><i style="width:${ex.length ? (done / ex.length) * 100 : 0}%"></i></div><span class="count">${done} из ${ex.length}</span></div>
    <ol class="ex-list" id="ex-list">${ex.map(e => exCard(e, d)).join("")}</ol>
    <form class="add-ex" data-form="add-ex">
      <input class="inp" name="name" list="ex-names" placeholder="Добавить упражнение" autocomplete="off" maxlength="80" aria-label="Новое упражнение">
      <datalist id="ex-names">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <button class="btn ghost" type="submit" aria-label="Добавить">${I.plus}</button>
    </form>
    <div class="summary">
      <div class="eyebrow">Итог дня</div>
      <div class="seg full feel" role="radiogroup" aria-label="Самочувствие">${feel.map((f, i) => `<button role="radio" data-act="feel" data-v="${i + 1}" aria-checked="${w.feeling === i + 1}">${f}</button>`).join("")}</div>
      <textarea class="inp" data-field="w-note" rows="3" placeholder="Как прошло, что поменять в следующий раз" aria-label="Заметка">${esc(w.note)}</textarea>
    </div>
    <div class="panel-actions">
      <button class="btn quiet" data-act="save-tpl">Сохранить как шаблон</button>
      <button class="btn quiet" data-act="del-w">${I.trash}Удалить</button>
    </div>`;
}

/* ---------- program ---------- */
function programView() {
  const p = S.profile, cur = programById(p.program_id);
  const cards = PROGRAMS.map(pr => `
    <button class="prog-card" data-act="pick-prog" data-v="${pr.id}" aria-pressed="${pr.id === p.program_id}">
      <span class="pc-top"><b>${esc(pr.title)}</b><span class="mono">${pr.days} ${plural(pr.days, "день", "дня", "дней")} в неделю</span></span>
      <span class="muted">${esc(pr.about)}</span>
    </button>`).join("");
  let setup = "";
  if (cur) {
    const days = (p.program_days?.length === cur.days ? p.program_days : cur.defaultDays);
    const wk = Math.max(0, Math.round((parse(monday(today())) - parse(monday(p.program_start))) / (7 * 864e5)));
    const block = cur.sessionsFor ? 0 : Math.floor(wk / 3) % 2;
    const list = cur.sessionsFor ? cur.sessionsFor(wk) : cur.sessions;
    setup = `
    <section class="block">
      <h2>Дни тренировок</h2>
      <p class="hint">Выберите ${cur.days} ${plural(cur.days, "день", "дня", "дней")}. Между тренировками одной группы мышц лучше оставлять хотя бы день.</p>
      <div class="wd-pick" role="group" aria-label="Дни недели">${WD.map((w, i) => `<button data-act="prog-day" data-v="${i}" aria-pressed="${days.includes(i)}">${w}</button>`).join("")}</div>
    </section>
    <section class="block">
      <h2>Тренировки</h2>
      <p class="hint">${cur.sessionsFor ? `Неделя ${(wk % cur.length) + 1} из ${cur.length}. Подходы и повторы меняются каждую неделю — в календаре всегда актуальные. Упражнения с пометкой «суперсет» делаются парой без отдыха. <a href="${cur.source}" target="_blank" rel="noopener">Источник</a>` : `Сейчас ${block ? "вторые" : "первые"} варианты упражнений; через 3 недели они сменятся сами.`}</p>
      <div class="sessions">${list.map(s => `
        <div class="card sess"><div class="sess-head"><b>${esc(s.title)}</b><span class="muted">${esc(s.focus)}</span></div>
          <ol class="plan-list">${s.ex.map(e => `<li><div class="pl-main"><b>${esc(e.n[block] || e.n[0])}</b>${e.tip ? `<span>${esc(e.tip)}</span>` : ""}</div><span class="pl-sets mono">${e.s} × ${e.r}</span></li>`).join("")}</ol>
        </div>`).join("")}</div>
    </section>
    <section class="block"><div><button class="btn quiet" data-act="prog-off">Отключить программу</button></div></section>`;
  }
  const cw = cur ? Math.max(0, Math.round((parse(monday(today())) - parse(monday(p.program_start))) / (7 * 864e5))) : 0;
  return `
    <section class="hero"><div class="kicker">Программа${cur?.length ? ` · неделя ${(cw % cur.length) + 1} из ${cur.length}` : ""}</div><h1>${cur ? esc(cur.title) : "Выберите программу"}</h1>
      ${cur ? `<p class="lead">Идёт с ${shortDay(p.program_start)}. Открой календарь — на каждый тренировочный день уже расписано, что делать.</p>` : `<p class="lead">После выбора в календаре на каждый тренировочный день появится план с подходами и весами.</p>`}</section>
    <section class="block"><div class="prog-cards">${cards}</div></section>
    ${setup}
    <section class="block" style="margin-bottom:12px">
      <h2>Принципы</h2>
      <p class="hint">Из книги Андрея Скоромного «О силовых тренировках». Готового расписания в книге нет — программы выше собраны по этим правилам.</p>
      <dl class="principles">${PRINCIPLES.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
    </section>`;
}

function exCard(e, day, isNew) {
  const last = lastFor(e.name, day);
  return `<li class="ex ${e.done ? "done" : ""} ${isNew ? "is-new" : ""}" data-ex="${e.id}">
    <div class="ex-head">
      <button class="check" data-act="ex-done" aria-pressed="${e.done}" aria-label="Выполнено">${"<i>" + I.check + "</i>"}</button>
      <input class="ex-name" data-field="ex-name" value="${esc(e.name)}" placeholder="Упражнение" aria-label="Упражнение" maxlength="80">
      <button class="icon-btn bare del" data-act="ex-del" aria-label="Удалить упражнение">${I.trash}</button>
    </div>
    ${e.plan || (last && setsText(last.sets)) ? `<p class="ex-last">${e.plan ? `<b class="mono">${esc(e.plan)}</b>${last && setsText(last.sets) ? " · " : ""}` : ""}${last && setsText(last.sets) ? `${shortDay(last.day)}: ${esc(setsText(last.sets))}` : ""}</p>` : ""}
    <div class="sets">${(e.sets || []).map((s, i) => `
      <div class="set ${s.done ? "done" : ""}" data-i="${i}">
        <span class="n">${i + 1}</span>
        <label><input inputmode="decimal" data-field="set-w" value="${s.w ?? ""}" placeholder="0" aria-label="Вес, кг">кг</label>
        <span class="x">×</span>
        <label><input inputmode="numeric" data-field="set-r" value="${s.r ?? ""}" placeholder="0" aria-label="Повторы">раз</label>
        <button class="check sm" data-act="set-done" aria-pressed="${!!s.done}" aria-label="Подход выполнен"><i>${I.check}</i></button>
        <button class="set-del" data-act="set-del" aria-label="Удалить подход">${I.x}</button>
      </div>`).join("")}
    </div>
    <div class="ex-foot"><button class="linkbtn" data-act="set-add">+ Подход</button></div>
  </li>`;
}

function refreshDayBits() { // счётчик, полоска и отметки в днях недели — без перерисовки полей ввода
  const w = workoutOn(S.day); if (!w) return;
  const ex = exercisesOf(w.id), done = ex.filter(e => e.done).length;
  const panel = document.getElementById("day-panel"); if (!panel) return;
  panel.querySelector(".progress .bar i").style.width = `${ex.length ? (done / ex.length) * 100 : 0}%`;
  panel.querySelector(".progress .count").textContent = `${done} из ${ex.length}`;
  const btn = document.querySelector(`.day[data-day="${S.day}"]`);
  if (btn) {
    btn.classList.toggle("done", !!ex.length && done === ex.length);
    const dt = btn.querySelector(".dt"); dt.textContent = w.title || "Тренировка"; dt.classList.remove("rest");
  }
}
function replaceCard(e) {
  const li = document.querySelector(`[data-ex="${e.id}"]`);
  if (li) li.outerHTML = exCard(e, S.day);
  refreshDayBits();
}
const saveEx = e => later("ex" + e.id, () => q(sb.from("gym_exercises").update({ name: e.name, sets: e.sets, done: e.done }).eq("id", e.id)), 500);

async function createWorkout(day, title = "", items = []) {
  const w = await q(sb.from("gym_workouts").insert({ day, title }).select().single());
  S.workouts.push(w);
  if (items.length) {
    const rows = items.map((it, i) => ({ workout_id: w.id, position: i, name: it.name, plan: it.plan || null, sets: (it.sets || []).map(s => ({ w: s.w ?? null, r: s.r ?? null, done: false })) }));
    S.exercises.push(...await q(sb.from("gym_exercises").insert(rows).select()));
  }
  return w;
}

function templatePicker() {
  const recent = [...S.workouts].filter(w => w.day !== S.day && exercisesOf(w.id).length).sort((a, b) => b.day.localeCompare(a.day));
  const seen = new Set(), uniq = recent.filter(w => { const k = norm(w.title) || w.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
  const tpl = S.templates.map(t => `<button data-tpl="${t.id}"><b>${esc(t.title)}</b><span>${t.exercises.map(e => esc(e.name)).join(", ") || "Без упражнений"}</span></button>`).join("");
  const past = uniq.map(w => `<button data-copy="${w.id}"><b>${esc(w.title || "Тренировка")}</b><span>${shortDay(w.day)} · ${exercisesOf(w.id).map(e => esc(e.name)).join(", ")}</span></button>`).join("");
  sheet("Что поставить на этот день", `
    ${tpl ? `<div class="eyebrow">Шаблоны</div><div class="pick">${tpl}</div>` : ""}
    ${past ? `<div class="eyebrow" style="margin-top:8px">Повторить прошлую</div><div class="pick">${past}</div>` : ""}`, (el, close) => {
    el.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-tpl],[data-copy]"); if (!b) return;
      b.disabled = true;
      if (b.dataset.tpl) { const t = S.templates.find(x => x.id === b.dataset.tpl); await createWorkout(S.day, t.title, t.exercises); }
      else { const src = S.workouts.find(x => x.id === b.dataset.copy); await createWorkout(S.day, src.title, exercisesOf(src.id).map(e => ({ name: e.name, sets: e.sets }))); }
      close(); rerender();
    });
  });
}

/* ---------- food ---------- */
async function ensureMeals(day) {
  if (S.meals[day]) return;
  S.meals[day] = await q(sb.from("gym_meals").select("*").eq("day", day).order("created_at"), { silent: true }).catch(() => []);
  if (route().path === "food" && S.foodDay === day) rerender();
}
function foodView() {
  const d = S.foodDay, list = S.meals[d], g = goals();
  const sum = (list || []).reduce((a, m) => ({ kcal: a.kcal + +m.kcal, P: a.P + +m.protein, F: a.F + +m.fat, C: a.C + +m.carb }), { kcal: 0, P: 0, F: 0, C: 0 });
  const pct = (v, goal) => goal ? Math.min(100, (v / goal) * 100) : 0;
  const macro = (label, v, goal) => `<div class="macro"><div class="top"><span>${label}</span><span class="mono"><b>${fmt(v)}</b> / ${fmt(goal)} г</span></div><div class="bar ${goal && v > goal * 1.1 ? "over" : ""}"><i style="width:${pct(v, goal)}%"></i></div></div>`;
  const left = g.kcal - sum.kcal;
  return `
    <section class="hero">
      <div class="day-switch">
        <button class="icon-btn bare" data-act="food-shift" data-n="-1" aria-label="Предыдущий день">${I.left}</button>
        <div class="label">${d === today() ? "Сегодня" : longDay(d)}</div>
        <button class="icon-btn bare" data-act="food-shift" data-n="1" aria-label="Следующий день">${I.right}</button>
      </div>
    </section>
    <section class="card totals" style="margin-top:12px">
      <div class="kcal-big"><b class="mono">${fmt(sum.kcal)}</b><span>из ${fmt(g.kcal)} ккал</span></div>
      <div class="bar ${sum.kcal > g.kcal * 1.05 ? "over" : ""}" style="height:6px"><i style="width:${pct(sum.kcal, g.kcal)}%"></i></div>
      <p class="muted" style="font-size:14px;margin-top:-6px">${left >= 0 ? `Осталось ${fmt(left)} ккал` : `Больше цели на ${fmt(-left)} ккал`}</p>
      <div class="macros">${macro("Белки", sum.P, g.P)}${macro("Жиры", sum.F, g.F)}${macro("Углеводы", sum.C, g.C)}</div>
      ${g.needWeight ? `<p class="hint">Чтобы посчитать цель по белку и жирам, укажите свой вес в <a href="#/me">профиле</a>.</p>` : ""}
    </section>
    <section class="block">
      <div class="row" style="justify-content:space-between"><h2>Съедено</h2><button class="btn" data-act="meal-add">${I.plus}Добавить</button></div>
      ${!list ? `<div class="skel" style="height:120px"></div>` : list.length ? `<ul class="meals">${list.map(m => mealRow(m)).join("")}</ul>` : `<p class="muted">Пока ничего не записано.</p>`}
    </section>`;
}
const mealRow = (m, isNew) => `<li class="meal ${isNew ? "is-new" : ""}" data-meal="${m.id}">
  <div class="main"><span class="name">${esc(m.name)}</span><span class="sub">${m.grams ? fmt(m.grams) + " г · " : ""}Б ${fmt(m.protein)} · Ж ${fmt(m.fat)} · У ${fmt(m.carb)}</span></div>
  <span class="kc">${fmt(m.kcal)} ккал</span>
  <button class="icon-btn bare del" data-act="meal-del" aria-label="Удалить">${I.trash}</button></li>`;

function mealSheet() {
  sheet("Добавить еду", `
    <input class="inp" id="fq" placeholder="${S.foods.length ? "Найти в моих продуктах" : "Название продукта"}" autocomplete="off" aria-label="Поиск или название">
    <div class="food-res" id="fres"></div>
    <form id="ff" style="display:grid;gap:12px">
      <div class="seg full" role="radiogroup" aria-label="Значения указаны"><button type="button" role="radio" data-mode="100" aria-checked="true">На 100 г</button><button type="button" role="radio" data-mode="portion" aria-checked="false">На порцию</button></div>
      <div class="grid4">
        <label class="field"><span>Ккал</span><input class="inp" name="kcal" inputmode="decimal"></label>
        <label class="field"><span>Белки</span><input class="inp" name="protein" inputmode="decimal"></label>
        <label class="field"><span>Жиры</span><input class="inp" name="fat" inputmode="decimal"></label>
        <label class="field"><span>Углев.</span><input class="inp" name="carb" inputmode="decimal"></label>
      </div>
      <label class="field" data-grams><span>Сколько грамм</span><input class="inp" name="grams" inputmode="decimal" placeholder="Например, 150"></label>
      <p class="preview" id="fprev"></p>
      <label class="chk" data-remember><input type="checkbox" name="remember" checked>Запомнить продукт</label>
      <button class="btn" type="submit">Добавить</button>
    </form>`, (el, close) => {
    const fq = el.querySelector("#fq"), res = el.querySelector("#fres"), f = el.querySelector("#ff"), prev = el.querySelector("#fprev");
    let mode = "100", picked = null;
    const vals = () => ({ kcal: num(f.kcal.value) || 0, protein: num(f.protein.value) || 0, fat: num(f.fat.value) || 0, carb: num(f.carb.value) || 0, grams: num(f.grams.value) });
    const total = () => { const v = vals(), k = mode === "100" ? (v.grams || 0) / 100 : 1; return { kcal: v.kcal * k, protein: v.protein * k, fat: v.fat * k, carb: v.carb * k, grams: v.grams }; };
    const upd = () => { const t = total(); prev.textContent = (mode === "100" && !t.grams) ? "" : `= ${fmt(t.kcal)} ккал · Б ${fmt(t.protein, 1)} · Ж ${fmt(t.fat, 1)} · У ${fmt(t.carb, 1)}`; };
    const list = () => {
      const s = norm(fq.value);
      const items = (s ? S.foods.filter(x => norm(x.name).includes(s)) : S.foods).slice(0, s ? 8 : 6);
      res.innerHTML = items.map(x => `<button type="button" data-food="${x.id}" aria-pressed="${picked?.id === x.id}"><span>${esc(x.name)}</span><span>${fmt(x.kcal)} ккал / 100 г</span></button>`).join("");
    };
    const setMode = m => { mode = m; el.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === m)); el.querySelector("[data-grams] span").textContent = m === "100" ? "Сколько грамм" : "Вес порции, г (необязательно)"; el.querySelector("[data-remember]").hidden = m !== "100" || !!picked; upd(); };
    fq.addEventListener("input", () => { if (picked && fq.value !== picked.name) { picked = null; setMode(mode); } list(); });
    res.addEventListener("click", e => {
      const b = e.target.closest("[data-food]"); if (!b) return;
      picked = S.foods.find(x => x.id === b.dataset.food);
      fq.value = picked.name; ["kcal", "protein", "fat", "carb"].forEach(k => f[k].value = +picked[k] || "");
      setMode("100"); list(); f.grams.focus();
    });
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => setMode(b.dataset.mode));
    f.addEventListener("input", upd);
    f.onsubmit = async e => {
      e.preventDefault();
      const name = fq.value.trim(), t = total(), v = vals();
      if (!name) { fq.focus(); toast("Напишите, что съели"); return; }
      if (mode === "100" && !t.grams) { f.grams.focus(); toast("Укажите, сколько грамм"); return; }
      const btn = f.querySelector("[type=submit]"); btn.classList.add("loading"); btn.disabled = true;
      try {
        const r1 = x => Math.round(x * 10) / 10;
        const m = await q(sb.from("gym_meals").insert({ day: S.foodDay, name, grams: t.grams, kcal: r1(t.kcal), protein: r1(t.protein), fat: r1(t.fat), carb: r1(t.carb) }).select().single());
        (S.meals[S.foodDay] ||= []).push(m);
        if (mode === "100" && !picked && f.remember.checked && !S.foods.some(x => norm(x.name) === norm(name))) {
          const food = await q(sb.from("gym_foods").insert({ name, kcal: v.kcal, protein: v.protein, fat: v.fat, carb: v.carb }).select().single(), { silent: true }).catch(() => null);
          if (food) { S.foods.push(food); S.foods.sort((a, b) => a.name.localeCompare(b.name, "ru")); }
        }
        close(); rerender();
        document.querySelector(`[data-meal="${m.id}"]`)?.classList.add("is-new");
      } catch { btn.classList.remove("loading"); btn.disabled = false; }
    };
    list(); setTimeout(() => fq.focus(), 350);
  });
}

/* ---------- progress ---------- */
function lineChart(points, { h = 160, unit = "" } = {}) {
  if (points.length < 2) return "";
  const W = 600, pad = 22, ys = points.map(p => p.v), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => pad + (i / (points.length - 1)) * (W - pad * 2), y = v => 12 + (1 - (v - min) / span) * (h - 36);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="График">
    <line class="gl" x1="${pad}" x2="${W - pad}" y1="${y(max)}" y2="${y(max)}"/><line class="gl" x1="${pad}" x2="${W - pad}" y1="${y(min)}" y2="${y(min)}"/>
    <polygon class="ar" points="${x(0)},${h - 24} ${line} ${x(points.length - 1)},${h - 24}"/>
    <polyline class="ln" points="${line}"/>
    <circle class="pt" cx="${x(points.length - 1)}" cy="${y(points.at(-1).v)}" r="4"/>
    <text x="${W - pad}" y="${y(max) - 4}" text-anchor="end">${fmt(max, 1)}${unit}</text>
    <text x="${W - pad}" y="${y(min) + 14}" text-anchor="end">${fmt(min, 1)}${unit}</text>
    <text x="${pad}" y="${h - 4}">${shortDay(points[0].d)}</text><text x="${W - pad}" y="${h - 4}" text-anchor="end">${shortDay(points.at(-1).d)}</text>
  </svg>`;
}
function progressView() {
  const t = today(), body = S.body.slice(-90), lastW = S.body.at(-1);
  const month = S.workouts.filter(w => w.day > addDays(t, -30) && w.day <= t && exercisesOf(w.id).some(e => e.done || e.sets?.some(x => x.done))).length;
  const weekDone = S.workouts.filter(w => w.day >= monday(t) && w.day <= t && exercisesOf(w.id).some(e => e.done || e.sets?.some(x => x.done))).length;
  const lifts = new Map();
  for (const e of S.exercises) {
    const name = e.name.trim(), d = dayOfWorkout(e.workout_id); if (!name || !d) continue;
    const top = Math.max(0, ...(e.sets || []).filter(s => s.done || e.done).map(s => +s.w || 0)); if (!top) continue;
    const k = norm(name), cur = lifts.get(k) || { name, hist: [] };
    cur.hist.push({ d, v: top, r: (e.sets.find(s => +s.w === top) || {}).r }); lifts.set(k, cur);
  }
  const rows = [...lifts.values()].map(l => { l.hist.sort((a, b) => a.d.localeCompare(b.d)); l.best = l.hist.reduce((a, b) => b.v > a.v ? b : a); l.last = l.hist.at(-1).d; return l; }).sort((a, b) => b.last.localeCompare(a.last));
  const spark = hist => { if (hist.length < 2) return `<span></span>`; const vs = hist.slice(-12).map(h => h.v), mn = Math.min(...vs), mx = Math.max(...vs), sp = mx - mn || 1; return `<svg class="spark" viewBox="0 0 84 28" preserveAspectRatio="none"><polyline points="${vs.map((v, i) => `${(i / (vs.length - 1)) * 82 + 1},${26 - ((v - mn) / sp) * 24}`).join(" ")}"/></svg>`; };
  const change = body.length > 1 ? body.at(-1).weight_kg - body[0].weight_kg : null;
  return `
    <section class="hero"><div class="kicker">Прогресс</div><h1>Как идут дела</h1></section>
    <section class="block">
      <div class="stats card">
        <div class="stat"><b class="mono">${weekDone}</b><span>на этой неделе</span></div>
        <div class="stat"><b class="mono">${month}</b><span>за 30 дней</span></div>
        <div class="stat"><b class="mono">${lastW ? fmt(lastW.weight_kg, 1) : "—"}</b><span>вес, кг</span></div>
      </div>
    </section>
    <section class="block">
      <h2>Вес тела</h2>
      <form class="add-ex" data-form="body">
        <input class="inp" name="w" inputmode="decimal" placeholder="Вес сегодня, кг" value="${S.body.find(b => b.day === t)?.weight_kg ?? ""}" aria-label="Вес сегодня, кг">
        <button class="btn" type="submit">Записать</button>
      </form>
      ${body.length > 1 ? `<div class="card">${lineChart(body.map(b => ({ d: b.day, v: +b.weight_kg })), { unit: " кг" })}</div>
        <p class="hint">${change ? `${change > 0 ? "+" : "−"}${fmt(Math.abs(change), 1)} кг с ${shortDay(body[0].day)}` : "Вес не изменился"}</p>` : `<p class="hint">Записывайте вес хотя бы раз в неделю — здесь появится график.</p>`}
    </section>
    <section class="block">
      <h2>Рабочие веса</h2>
      ${rows.length ? `<ul class="lifts card" style="padding:4px 16px">${rows.map(l => `<li class="lift"><div><div class="name">${esc(l.name)}</div><div class="sub">${shortDay(l.last)} · ${l.hist.length} ${plural(l.hist.length, "раз", "раза", "раз")}</div></div>${spark(l.hist)}<div class="best">${fmt(l.best.v, 1)} кг${l.best.r ? ` × ${l.best.r}` : ""}</div></li>`).join("")}</ul>`
        : `<p class="hint">Отмечайте выполненные подходы с весом — здесь появятся лучшие результаты по каждому упражнению.</p>`}
    </section>`;
}
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

/* ---------- profile ---------- */
function profileView() {
  const p = S.profile, g = goals(), perkg = p.goal_mode !== "percent", th = getTheme();
  return `
    <section class="hero"><div class="kicker">${esc(S.user.email)}</div><h1>${esc(p.name || "Профиль")}</h1></section>
    <section class="block">
      <div class="grid2">
        <label class="field"><span>Имя</span><input class="inp" data-field="p-name" value="${esc(p.name)}" maxlength="40" style="text-align:left;font-family:var(--body)"></label>
        <label class="field"><span>Вес, кг</span><input class="inp" data-field="p-weight_kg" inputmode="decimal" value="${p.weight_kg ?? ""}"></label>
      </div>
    </section>
    <section class="block">
      <h2>Цель по питанию</h2>
      <label class="field"><span>Калорий в день</span><input class="inp" data-field="p-kcal" inputmode="numeric" value="${p.kcal ?? ""}"></label>
      <div class="seg full" role="radiogroup" aria-label="Как задать белки и жиры">
        <button role="radio" data-act="goal-mode" data-v="perkg" aria-checked="${perkg}">Граммы на кг веса</button>
        <button role="radio" data-act="goal-mode" data-v="percent" aria-checked="${!perkg}">Проценты калорий</button>
      </div>
      <div class="grid2">
        <label class="field"><span>Белки, ${perkg ? "г на кг" : "%"}</span><input class="inp" data-field="p-protein" inputmode="decimal" value="${p.protein ?? ""}"></label>
        <label class="field"><span>Жиры, ${perkg ? "г на кг" : "%"}</span><input class="inp" data-field="p-fat" inputmode="decimal" value="${p.fat ?? ""}"></label>
      </div>
      <p class="goals-out" id="goals-out">${goalsLine(g)}</p>
      <p class="hint">Углеводы — всё, что остаётся от калорий. Обычно белка берут 1,6–2,2 г на кг веса, жиров — 0,8–1 г на кг.</p>
    </section>
    <section class="block">
      <h2>Тема</h2>
      <div class="seg" role="radiogroup" aria-label="Тема">${[["system", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([k, l]) => `<button role="radio" data-act="theme" data-v="${k}" aria-checked="${th === k}">${l}</button>`).join("")}</div>
    </section>
    <section class="block">
      <h2>Шаблоны тренировок</h2>
      ${S.templates.length ? `<ul class="list">${S.templates.map(t => `<li data-tpl="${t.id}"><div class="main"><b>${esc(t.title)}</b><span class="sub">${t.exercises.map(e => esc(e.name)).join(", ")}</span></div><button class="icon-btn bare del" data-act="tpl-del" aria-label="Удалить шаблон">${I.trash}</button></li>`).join("")}</ul>`
        : `<p class="hint">Соберите тренировку на любом дне и нажмите «Сохранить как шаблон».</p>`}
    </section>
    <section class="block">
      <h2>Мои продукты</h2>
      ${S.foods.length ? `<ul class="list">${S.foods.map(x => `<li data-food="${x.id}"><div class="main"><b>${esc(x.name)}</b><span class="sub">на 100 г: ${fmt(x.kcal)} ккал · Б ${fmt(x.protein, 1)} · Ж ${fmt(x.fat, 1)} · У ${fmt(x.carb, 1)}</span></div><button class="icon-btn bare del" data-act="food-del" aria-label="Удалить продукт">${I.trash}</button></li>`).join("")}</ul>`
        : `<p class="hint">Продукты сохраняются сами, когда вы добавляете еду с отметкой «Запомнить продукт».</p>`}
    </section>
    <section class="block" style="margin-bottom:12px"><div><button class="btn quiet" data-act="logout">Выйти</button></div></section>`;
}
const goalsLine = g => `${fmt(g.kcal)} ккал · Б ${fmt(g.P)} г · Ж ${fmt(g.F)} г · У ${fmt(g.C)} г`;
const saveProfile = () => later("profile", () => { const { user_id, updated_at, ...rest } = S.profile; q(sb.from("gym_profile").update({ ...rest, updated_at: new Date().toISOString() }).eq("user_id", S.user.id)); });

/* ---------- events ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b || b.closest(".sheet")) return;
  const act = b.dataset.act, li = b.closest("[data-ex]"), e = li && S.exercises.find(x => x.id === li.dataset.ex);
  const w = workoutOn(S.day);
  switch (act) {
    case "pick-day": S.day = b.dataset.day; rerender(); break;
    case "shift": { const n = +b.dataset.n;
      if (getCalMode() === "month") { const d0 = parse(S.day), d = new Date(d0.getFullYear(), d0.getMonth() + n, 1); S.day = iso(d).slice(0, 7) === today().slice(0, 7) ? today() : iso(d); }
      else S.day = addDays(S.day, n * 7);
      rerender(); break; }
    case "cal-mode": try { localStorage.setItem("gym-cal", b.dataset.v); } catch {} rerender(); break;
    case "start-plan": {
      const p = sessionOn(S.day); b.classList.add("loading"); b.disabled = true;
      const items = p.ex.map(e => ({ name: e.name, plan: `${e.sets} × ${e.reps}`, sets: suggestSets(e.name, e.sets, e.reps).sets }));
      await createWorkout(S.day, p.title, items).catch(() => {}); rerender(); break;
    }
    case "pick-prog": {
      const pr = programById(b.dataset.v), p = S.profile; if (p.program_id === pr.id) return;
      p.program_id = pr.id; p.program_days = pr.defaultDays; p.program_start = monday(today());
      saveProfile(); rerender(); toast(`Программа «${pr.title}» — уже в календаре`); break;
    }
    case "prog-day": {
      const p = S.profile, pr = programById(p.program_id), v = +b.dataset.v;
      let days = [...(p.program_days?.length === pr.days ? p.program_days : pr.defaultDays)];
      if (days.includes(v)) { toast("Выберите другой день вместо этого — нажмите на свободный"); return; }
      // заменяем ближайший выбранный день, чтобы число дней не менялось
      const near = days.reduce((a, c) => Math.abs(c - v) < Math.abs(a - v) ? c : a);
      days = days.map(x => x === near ? v : x).sort((a, c) => a - c);
      p.program_days = days; saveProfile(); rerender(); break;
    }
    case "prog-off": {
      if (!await confirmSheet("Отключить программу?", "План пропадёт из календаря. Уже проведённые тренировки останутся.", "Отключить")) return;
      Object.assign(S.profile, { program_id: null, program_start: null, program_days: null }); saveProfile(); rerender(); break;
    }
    case "today": S.day = today(); rerender(); break;
    case "new-w": { b.classList.add("loading"); await createWorkout(S.day).catch(() => {}); rerender(); document.querySelector(".title-inp")?.focus(); break; }
    case "from-tpl": templatePicker(); break;
    case "feel": w.feeling = w.feeling === +b.dataset.v ? null : +b.dataset.v;
      b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", +x.dataset.v === w.feeling));
      q(sb.from("gym_workouts").update({ feeling: w.feeling }).eq("id", w.id)); break;
    case "ex-done": e.done = !e.done; e.sets = (e.sets || []).map(s => ({ ...s, done: e.done })); replaceCard(e); saveEx(e); break;
    case "set-done": { const i = +b.closest(".set").dataset.i; e.sets[i].done = !e.sets[i].done; e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceCard(e); saveEx(e); break; }
    case "set-add": { const lastSet = e.sets.at(-1) || lastFor(e.name, S.day)?.sets?.[e.sets.length] || {}; e.sets.push({ w: lastSet.w ?? null, r: lastSet.r ?? null, done: false }); e.done = false; replaceCard(e); saveEx(e);
      document.querySelector(`[data-ex="${e.id}"] .set:last-child input`)?.focus(); break; }
    case "set-del": { const i = +b.closest(".set").dataset.i; e.sets.splice(i, 1); e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceCard(e); saveEx(e); break; }
    case "ex-del": {
      const idx = S.exercises.indexOf(e); S.exercises.splice(idx, 1); li.remove(); refreshDayBits();
      const t = setTimeout(() => q(sb.from("gym_exercises").delete().eq("id", e.id)), 5000);
      toast(`Упражнение «${e.name || "без названия"}» удалено`, { label: "Вернуть", run: () => { clearTimeout(t); S.exercises.push(e); rerender(); } });
      break;
    }
    case "del-w": {
      if (!await confirmSheet("Удалить тренировку?", `«${w.title || "Тренировка"}» на ${shortDay(w.day)} и все её упражнения.`)) return;
      await q(sb.from("gym_workouts").delete().eq("id", w.id));
      S.workouts = S.workouts.filter(x => x.id !== w.id); S.exercises = S.exercises.filter(x => x.workout_id !== w.id); rerender(); break;
    }
    case "save-tpl": {
      const ex = exercisesOf(w.id).filter(x => x.name.trim());
      if (!ex.length) { toast("Сначала добавьте упражнения"); return; }
      sheet("Сохранить как шаблон", `<form id="tf" style="display:grid;gap:12px"><label class="field"><span>Название шаблона</span><input class="inp" name="t" value="${esc(w.title)}" maxlength="80" required></label><p class="hint">${ex.map(x => esc(x.name)).join(", ")}</p><div class="sheet-actions"><button class="btn" type="submit">Сохранить</button></div></form>`, (el, close) => {
        const f = el.querySelector("#tf");
        f.onsubmit = async ev2 => {
          ev2.preventDefault(); const title = f.t.value.trim() || "Тренировка";
          const items = ex.map(x => ({ name: x.name.trim(), sets: x.sets.map(s => ({ w: s.w, r: s.r })) }));
          const old = S.templates.find(t => norm(t.title) === norm(title));
          if (old) { await q(sb.from("gym_templates").update({ exercises: items }).eq("id", old.id)); old.exercises = items; }
          else S.templates.push(await q(sb.from("gym_templates").insert({ title, exercises: items }).select().single()));
          close(); toast(old ? "Шаблон обновлён" : "Шаблон сохранён");
        };
      });
      break;
    }
    case "food-shift": S.foodDay = addDays(S.foodDay, +b.dataset.n); rerender(); ensureMeals(S.foodDay); break;
    case "meal-add": mealSheet(); break;
    case "meal-del": {
      const id = b.closest("[data-meal]").dataset.meal, list = S.meals[S.foodDay], m = list.find(x => x.id === id);
      list.splice(list.indexOf(m), 1); rerender();
      const t = setTimeout(() => q(sb.from("gym_meals").delete().eq("id", id)), 5000);
      toast(`«${m.name}» удалено`, { label: "Вернуть", run: () => { clearTimeout(t); list.push(m); list.sort((a, c) => a.created_at.localeCompare(c.created_at)); rerender(); } });
      break;
    }
    case "goal-mode": {
      const p = S.profile, v = b.dataset.v; if (p.goal_mode === v) return;
      const g = goals(); p.goal_mode = v; // пересчитываем в новые единицы, чтобы граммы не прыгнули
      if (v === "percent") { p.protein = g.kcal ? Math.round(g.P * 4 / g.kcal * 100) : 30; p.fat = g.kcal ? Math.round(g.F * 9 / g.kcal * 100) : 30; }
      else { const wkg = +p.weight_kg; p.protein = wkg ? Math.round(g.P / wkg * 10) / 10 : 2; p.fat = wkg ? Math.round(g.F / wkg * 10) / 10 : 1; }
      saveProfile(); rerender(); break;
    }
    case "theme": setTheme(b.dataset.v); b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); break;
    case "tpl-del": {
      const id = b.closest("[data-tpl]").dataset.tpl, t = S.templates.find(x => x.id === id);
      if (!await confirmSheet("Удалить шаблон?", `«${t.title}» исчезнет из списка шаблонов. Уже запланированные тренировки останутся.`)) return;
      await q(sb.from("gym_templates").delete().eq("id", id)); S.templates = S.templates.filter(x => x.id !== id); rerender(); break;
    }
    case "food-del": {
      const id = b.closest("[data-food]").dataset.food;
      await q(sb.from("gym_foods").delete().eq("id", id)); S.foods = S.foods.filter(x => x.id !== id); rerender(); break;
    }
    case "logout": await sb.auth.signOut(); break;
  }
});

document.addEventListener("input", ev => {
  const el = ev.target, f = el.dataset?.field; if (!f) return;
  const w = workoutOn(S.day), li = el.closest("[data-ex]"), e = li && S.exercises.find(x => x.id === li.dataset.ex);
  if (f === "w-title") { w.title = el.value; refreshDayBits(); later("wt", () => q(sb.from("gym_workouts").update({ title: w.title.trim() }).eq("id", w.id))); }
  else if (f === "w-note") { w.note = el.value; later("wn", () => q(sb.from("gym_workouts").update({ note: w.note }).eq("id", w.id)), 900); }
  else if (f === "ex-name") { e.name = el.value; saveEx(e); }
  else if (f === "set-w" || f === "set-r") { const i = +el.closest(".set").dataset.i; e.sets[i][f === "set-w" ? "w" : "r"] = num(el.value); saveEx(e); }
  else if (f.startsWith("p-")) {
    const k = f.slice(2); S.profile[k] = k === "name" ? el.value : num(el.value);
    const out = document.getElementById("goals-out"); if (out) out.innerHTML = goalsLine(goals());
    if (k === "name") document.querySelector(".hero h1").textContent = el.value || "Профиль";
    saveProfile();
  }
});

document.addEventListener("submit", async ev => {
  const form = ev.target.closest("[data-form]"); if (!form) return;
  ev.preventDefault();
  if (form.dataset.form === "add-ex") {
    const name = form.name.value.trim(); if (!name) { form.name.focus(); return; }
    const w = workoutOn(S.day), list = exercisesOf(w.id);
    const prevSets = lastFor(name, S.day)?.sets;
    const sets = prevSets?.length ? prevSets.map(s => ({ w: s.w ?? null, r: s.r ?? null, done: false })) : [{ w: null, r: null, done: false }];
    const tmp = { id: uid(), workout_id: w.id, position: list.length ? list.at(-1).position + 1 : 0, name, sets, done: false };
    form.name.value = "";
    try {
      const row = await q(sb.from("gym_exercises").insert(tmp).select().single());
      S.exercises.push(row);
      document.getElementById("ex-list").insertAdjacentHTML("beforeend", exCard(row, S.day, true));
      refreshDayBits();
    } catch { form.name.value = name; }
  } else if (form.dataset.form === "body") {
    const v = num(form.w.value); if (!v || v < 20 || v > 400) { toast("Введите вес в килограммах"); return; }
    const t = today(), btn = form.querySelector("button"); btn.classList.add("loading");
    try {
      await q(sb.from("gym_body").upsert({ day: t, weight_kg: v }));
      const ex = S.body.find(b => b.day === t); if (ex) ex.weight_kg = v; else S.body.push({ day: t, weight_kg: v });
      S.body.sort((a, b) => a.day.localeCompare(b.day));
      S.profile.weight_kg = v; saveProfile();
      rerender(); toast("Вес записан");
    } catch { btn.classList.remove("loading"); }
  }
});

/* ---------- start ---------- */
sb.auth.onAuthStateChange((event, session) => {
  const u = session?.user || null;
  if (S.started && (u?.id ?? null) === (S.user?.id ?? null)) return; // обновление токена — не перерисовываем
  S.started = true;
  S.user = u; S.loaded = false; S.meals = {};
  render();
  if (u) loadAll().then(render).catch(() => { app.querySelector("#main").innerHTML = `<div class="empty-day"><p class="muted">Не получилось загрузить данные.</p><button class="btn" onclick="location.reload()">Обновить</button></div>`; });
});
// на вкладке, открытой с вечера, «сегодня» должно сдвинуться
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.loaded) { const t = today(); if (S._t && S._t !== t) { S.day = t; S.foodDay = t; render(); } S._t = t; } });
S._t = today();

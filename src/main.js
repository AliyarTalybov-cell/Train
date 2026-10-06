import { createClient } from "@supabase/supabase-js";
import "./fonts.css";
import { PROGRAMS, PRINCIPLES, programById, sessionFor as programSession, programPlan } from "./programs.js";
import { media, NAMES as KNOWN_NAMES } from "./exercise-media.js";
import "./style.css";

// Та же база, что у рассрочки (проект RassP); дневник живёт в своих таблицах gym_*, каждая строка видна только владельцу.
const sb = createClient("https://qgdtzpsgzlwdhlqdqwex.supabase.co", "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM", {
  auth: { persistSession: true, storageKey: "gym-auth" },
});

const app = document.getElementById("app");
const S = { user: null, profile: null, workouts: [], exercises: [], templates: [], foods: [], body: [], meals: {}, days: [], open: new Set(), day: iso(new Date()), foodDay: iso(new Date()), loaded: false };

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
  const [profile, workouts, exercises, templates, foods, body, days] = await Promise.all([
    q(sb.from("gym_profile").select("*").maybeSingle(), { silent: true }),
    q(sb.from("gym_workouts").select("*").order("day"), { silent: true }),
    q(sb.from("gym_exercises").select("*").order("position"), { silent: true }),
    q(sb.from("gym_templates").select("*").order("created_at"), { silent: true }),
    q(sb.from("gym_foods").select("*").order("name"), { silent: true }),
    q(sb.from("gym_body").select("*").order("day"), { silent: true }),
    q(sb.from("gym_days").select("*").order("day"), { silent: true }),
  ]);
  Object.assign(S, { workouts, exercises, templates, foods, body, days });
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
  else if (w) { P = (Number(p.protein) || 0) * w; F = (Number(p.fat) || 0) * w; }
  else { P = kcal * 0.25 / 4; F = kcal * 0.3 / 9; } // пока вес не указан — обычные доли: 25% белка, 30% жиров
  const C = Math.max(0, (kcal - P * 4 - F * 9) / 4);
  return { kcal, P: Math.round(P), F: Math.round(F), C: Math.round(C), needWeight: p.goal_mode !== "percent" && !w };
}

/* ---------- routing ---------- */
const ROUTES = [
  { path: "", label: "Календарь", icon: I.week, view: weekView },
  { path: "program", label: "Программа", icon: I.list, view: programView },
  { path: "food", label: "Питание", icon: I.food, view: foodView },
  { path: "progress", label: "Итоги", icon: I.chart, view: progressView },
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
  if (S._shownDay && S._shownDay !== S.day) { const dir = S.day > S._shownDay ? "next" : "prev"; document.getElementById("day-panel")?.classList.add("swap", dir); }
  S._shownDay = S.day;
}
function skeleton() {
  return `<div style="display:grid;gap:12px;padding-top:28px"><div class="skel" style="height:14px;width:40%"></div><div class="skel" style="height:68px"></div><div class="skel" style="height:40px;width:60%"></div><div class="skel" style="height:140px"></div><div class="skel" style="height:140px"></div></div>`;
}
window.addEventListener("hashchange", () => { S.moving = null; render(); scrollTo({ top: 0 }); });

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
function sessionFor(profile, day, h) { // переносы: день может взять тренировку другого дня или стать отдыхом
  const mv = profile?.program_moves || {};
  if (Object.hasOwn(mv, day)) return mv[day] ? programSession(profile, mv[day], h) : null;
  return programSession(profile, day, h);
}
const sessionOn = day => sessionFor(S.profile, day, { parse, monday });
const getCalMode = () => { try { return localStorage.getItem("gym-cal") === "month" ? "month" : "week"; } catch { return "week"; } };
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const r1 = x => Math.round(x * 10) / 10;

// Состояние дня: rest — отдых, planned — впереди, done — сделано, partial — начато, missed — пропущено.
function dayStatus(d) {
  const w = workoutOn(d), ex = w ? exercisesOf(w.id) : [], plan = sessionOn(d);
  const done = ex.filter(e => e.done).length;
  let st = "rest";
  if (w && ex.length) st = done === ex.length ? "done" : done ? "partial" : d < today() ? "missed" : "planned";
  else if (w || plan) st = d < today() ? "missed" : "planned";
  return { w, ex, plan, done, st, title: w ? (w.title || "Тренировка") : plan?.title || "" };
}
const completed = d => { const s = dayStatus(d); return s.ex.length > 0 && s.done / s.ex.length >= 0.5; };
const tonnage = ex => ex.reduce((sum, e) => sum + (e.sets || []).filter(s => s.done || e.done).reduce((a, s) => a + (+s.w || 0) * (+s.r || 0), 0), 0);
const tons = kg => kg >= 1000 ? `${fmt(kg / 1000, 1)} т` : `${fmt(kg)} кг`;
const weekOf = d => Math.floor((parse(monday(d)) - parse(monday(S.profile.program_start))) / (7 * 864e5));

function dayCell(d, { label, outside } = {}) {
  const s = dayStatus(d);
  const cls = ["day", "st-" + s.st, d === today() && "today", outside && "outside"].filter(Boolean).join(" ");
  const names = { done: "сделано", partial: "начато", missed: "пропущено", planned: "по плану", rest: "отдых" };
  return `<button class="${cls}" data-act="pick-day" data-day="${d}" ${d === S.day ? 'aria-current="true"' : ""} aria-label="${longDay(d)}${s.title ? ", " + esc(s.title) : ""}, ${names[s.st]}">
    ${label ? `<span class="dw">${label}</span>` : ""}<span class="dn">${parse(d).getDate()}</span><span class="dt">${esc(s.title || "Отдых")}</span><i class="mark"></i></button>`;
}

// Полоска «где я в программе»: недели цикла, сделанные тренировки, что дальше.
function programStats() {
  const p = S.profile, prog = programById(p?.program_id); if (!prog) return null;
  const L = prog.length || 12, t = today(), cur = Math.max(0, weekOf(t)), base = Math.floor(cur / L) * L;
  const weeks = []; let planned = 0, done = 0;
  for (let wk = base; wk < base + L; wk++) {
    let pl = 0, cm = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday(p.program_start), wk * 7 + i);
      if (d < p.program_start || d > t || !sessionOn(d)) continue;
      pl++; if (completed(d)) cm++;
    }
    weeks.push({ wk, pl, cm }); planned += pl; done += cm;
  }
  return { prog, plan: programPlan(prog), L, cur, local: cur - base, weeks, planned, done };
}
function programBand() {
  const ps = programStats(); if (!ps) return "";
  const { prog, plan, L, local, weeks, planned, done } = ps;
  const seg = weeks.map((w, i) => `<i class="${i < local ? (w.pl && w.cm >= w.pl ? "full" : w.cm ? "part" : "miss") : i === local ? "cur" : ""}" title="Неделя ${i + 1}"></i>`).join("");
  const nextLine = plan.next ? plan.next(Math.floor(local / 2)) : (plan.phases.find(f => local + 1 <= f.weeks[1])?.text || "");
  return `<a class="prog-band" href="#/program">
    <div class="pb-top"><b>${esc(prog.title)}</b><span class="mono">неделя ${local + 1} из ${L}</span></div>
    <div class="pb-weeks" style="--n:${L}">${seg}</div>
    <div class="pb-foot"><span>${planned ? `Сделано ${done} из ${planned} ${plural(planned, "тренировки", "тренировок", "тренировок")}` : "Программа только началась"} · ${plan.weekLabel(local)}</span><span class="muted">${esc(nextLine)}</span></div>
  </a>`;
}

function moveView() {
  const from = S.moving, wk = S.moveWeek, s0 = dayStatus(from);
  const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
  return `<section class="hero move">
    <div class="kicker">Перенос</div>
    <h1>${s0.title ? `Куда перенести «${esc(s0.title)}»?` : "Какую тренировку поставить сюда?"}</h1>
    <p class="lead">Нажми на день — тренировки поменяются местами.</p>
    <div class="cal-top"><div class="cal-title">${parse(days[0]).getMonth() === parse(days[6]).getMonth() ? parse(days[0]).getDate() : shortDay(days[0])} – ${shortDay(days[6])}</div>
      <div class="row"><button class="icon-btn bare" data-act="move-week" data-n="-7" aria-label="Прошлая неделя">${I.left}</button><button class="icon-btn bare" data-act="move-week" data-n="7" aria-label="Следующая неделя">${I.right}</button></div></div>
    <div class="move-list">${days.map(d => { const s = dayStatus(d); return `<button data-act="move-to" data-day="${d}" class="${d === from ? "from" : ""}" ${d === from ? "disabled" : ""}>
      <span class="ml-d"><b>${WD[(parse(d).getDay() + 6) % 7]}</b><span>${parse(d).getDate()}</span></span>
      <span class="ml-t"><b>${s.title ? esc(s.title) : "Отдых"}</b><span>${d === from ? "переносим отсюда" : d === today() ? "сегодня" : s.st === "done" ? "сделано" : s.st === "partial" ? "начато" : ""}</span></span>
      ${d === from ? "" : `<span class="ml-go">Сюда</span>`}</button>`; }).join("")}</div>
    <div><button class="btn quiet" data-act="move-cancel">Отмена</button></div>
  </section>`;
}
function weekView() {
  if (S.moving) return moveView();
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
  return `
    <section class="hero cal">
      <div class="cal-top">
        <div class="cal-title">${head}</div>
        <div class="row">
          ${S.day !== t ? `<button class="linkbtn" data-act="today">Сегодня</button>` : ""}
          <button class="icon-btn bare" data-act="shift" data-n="-1" aria-label="Назад">${I.left}</button>
          <button class="icon-btn bare" data-act="shift" data-n="1" aria-label="Вперёд">${I.right}</button>
        </div>
      </div>
      <div class="seg cal-mode" role="radiogroup" aria-label="Вид календаря"><button role="radio" data-act="cal-mode" data-v="week" aria-checked="${mode === "week"}">Неделя</button><button role="radio" data-act="cal-mode" data-v="month" aria-checked="${mode === "month"}">Месяц</button></div>
      ${grid}
      <div class="legend" aria-hidden="true"><span><i class="mark m-done"></i>сделано</span><span><i class="mark m-part"></i>начато</span><span><i class="mark m-plan"></i>по плану</span><span><i class="mark m-miss"></i>пропущено</span></div>
    </section>
    <section class="day-panel" id="day-panel">${dayPanel()}</section>`;
}

/* ---------- day ---------- */
// Предложенный вес: как в прошлый раз, и +2,5 кг, если тогда во всех подходах дошёл до верха диапазона.
function suggestSets(name, sets, reps) {
  const top = parseInt(String(reps).split("–").pop()) || null, low = parseInt(reps) || null;
  const last = lastFor(name, S.day);
  const ws = (last?.sets || []).map(s => +s.w).filter(Boolean), lw = ws.length ? Math.max(...ws) : null;
  const hit = !!(last && top && last.sets.length && last.sets.every(s => (+s.r || 0) >= top));
  return { sets: Array.from({ length: sets }, () => ({ w: lw ? (hit ? lw + 2.5 : lw) : null, r: low, done: false })), up: hit, last };
}
const tipFor = name => sessionOn(S.day)?.ex.find(e => norm(e.name) === norm(name))?.tip || "";
const ring = (part, total) => {
  const r = 26, c = 2 * Math.PI * r, f = total ? part / total : 0;
  return `<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="rg-bg"/><circle cx="32" cy="32" r="${r}" class="rg-fg" style="stroke-dasharray:${c};stroke-dashoffset:${c * (1 - f)}"/></svg><span class="ring-n mono">${part}<small>/${total}</small></span>`;
};
function thumb(name, act) {
  const m = media(name);
  return `<button class="ex-thumb" data-act="${act}" aria-label="Как делать: ${esc(name)}">${m ? `<img src="${m.img}" alt="" loading="lazy" decoding="async">` : esc((name || "?").trim()[0] || "?")}</button>`;
}

// Строка упражнения. it — настоящее упражнение или пункт плана ещё не начатой тренировки (plan: true).
function exRow(it, i, d) {
  const sets = it.sets || [], open = !it.isPlan && S.open.has(it.id);
  const w0 = sets.find(s => s.w != null)?.w, last = lastFor(it.name, d);
  const doneSets = sets.filter(s => s.done).length;
  const meta = [
    it.plan ? `<b class="mono">${esc(it.plan)}</b>` : sets.length ? `<b class="mono">${sets.length} × ${sets[0].r ?? "—"}</b>` : "",
    w0 != null ? `${fmt(w0, 1)} кг` : "",
    !it.isPlan && doneSets && !it.done ? `${doneSets} из ${sets.length} подходов` : "",
  ].filter(Boolean).join(" · ");
  const lastLine = last && setsText(last.sets) ? `Прошлый раз ${shortDay(last.day)}: ${setsText(last.sets)}${it.up ? " — добавь вес" : ""}` : "";
  const act = it.isPlan ? "ex-info" : "ex-open";
  return `<li class="ex ${it.done ? "done" : ""} ${open ? "open" : ""} ${it.isPlan ? "ex-preview" : ""}" ${it.isPlan ? `data-plan="${i}"` : `data-ex="${it.id}"`} data-name="${esc(it.name)}">
    <div class="ex-row">
      ${thumb(it.name, act)}
      <button class="ex-main" data-act="${act}" ${it.isPlan ? "" : `aria-expanded="${open}"`}>
        <span class="ex-title">${esc(it.name || "Без названия")}</span>
        <span class="ex-meta">${meta}</span>
        ${lastLine ? `<span class="ex-prev">${esc(lastLine)}</span>` : ""}
      </button>
      ${it.isPlan ? `<span class="ex-chev" aria-hidden="true">${I.right}</span>` : `<button class="check" data-act="ex-done" aria-pressed="${!!it.done}" aria-label="Выполнено: ${esc(it.name)}"><i>${I.check}</i></button>`}
    </div>
    ${open ? exBody(it) : ""}
  </li>`;
}
function exBody(e) {
  const tip = tipFor(e.name), m = media(e.name);
  return `<div class="ex-body">
    ${m ? `<button class="photo" data-act="ex-photo" aria-label="Открыть фото крупно"><img src="${m.img}" alt="Начало движения"><img src="${m.img2}" alt="Конец движения" class="b"></button>` : ""}
    ${tip ? `<p class="ex-tip">${esc(tip)}</p>` : ""}
    <p class="ex-tip">Отмечай кружком каждый сделанный подход. Вес и повторы можно поправить.</p>
    <div class="sets">${(e.sets || []).map((s, i) => `
      <div class="set ${s.done ? "done" : ""}" data-i="${i}">
        <span class="n">${i + 1}</span>
        <label><input inputmode="decimal" data-field="set-w" value="${s.w ?? ""}" placeholder="0" aria-label="Вес, кг">кг</label>
        <span class="x">×</span>
        <label><input inputmode="numeric" data-field="set-r" value="${s.r ?? ""}" placeholder="0" aria-label="Повторы">раз</label>
        <button class="check sm" data-act="set-done" aria-pressed="${!!s.done}" aria-label="Подход ${i + 1} выполнен"><i>${I.check}</i></button>
        <button class="set-del" data-act="set-del" aria-label="Удалить подход">${I.x}</button>
      </div>`).join("")}
    </div>
    <div class="ex-foot">
      <button class="linkbtn" data-act="set-add">+ Подход</button>
      <span class="row" style="gap:4px">
        <button class="linkbtn muted-link" data-act="ex-rename">Переименовать</button>
        <button class="icon-btn bare del" data-act="ex-del" aria-label="Удалить упражнение">${I.trash}</button>
      </span>
    </div>
  </div>`;
}

function daySummary(d) {
  const g = goals(), list = S.meals[d], sum = (list || []).reduce((a, m) => ({ kcal: a.kcal + +m.kcal, P: a.P + +m.protein }), { kcal: 0, P: 0 });
  const sleep = S.days.find(x => x.day === d)?.sleep_h;
  const pct = (v, goal) => goal ? Math.min(100, v / goal * 100) : 0;
  return `<div class="tiles">
    <button class="tile" data-act="go-food">
      <span class="t-k">Питание</span>
      <span class="t-v"><b class="mono">${list ? fmt(sum.kcal) : "…"}</b><span>/ ${fmt(g.kcal)} ккал</span></span>
      <span class="bar"><i style="width:${pct(sum.kcal, g.kcal)}%"></i></span>
      <span class="t-sub">Белок ${list ? fmt(sum.P) : "…"} из ${fmt(g.P)} г</span>
    </button>
    <div class="tile">
      <span class="t-k">Сон</span>
      <span class="t-v"><b class="mono">${sleep != null ? fmt(sleep, 1) : "—"}</b><span>ч</span></span>
      <span class="stepper"><button data-act="sleep" data-n="-0.5" aria-label="Меньше на полчаса">−</button><button data-act="sleep" data-n="0.5" aria-label="Больше на полчаса">+</button></span>
    </div>
  </div>`;
}

function nextSession(from) {
  for (let i = 1; i <= 14; i++) { const d = addDays(from, i), p = sessionOn(d); if (p) return { d, p }; }
  return null;
}
function dayPanel() {
  const d = S.day, w = workoutOn(d), p = sessionOn(d), ps = S.profile?.program_id ? programStats() : null;
  if (S.meals[d] === undefined) ensureMeals(d);
  const eyebrow = `<div class="eyebrow"><span>${longDay(d)}</span>${d === today() ? "<span>Сегодня</span>" : ""}</div>`;
  const tiles = daySummary(d);
  if (!w && !p) {
    const nx = S.profile?.program_id && nextSession(d);
    return `${eyebrow}
      <section class="hero-card rest">
        <div class="hc-text"><h2>${S.profile?.program_id ? "День отдыха" : "Свободный день"}</h2>
        <p class="hc-sub">${S.profile?.program_id ? (nx ? `Следующая — ${WD_FULL[(parse(nx.d).getDay() + 6) % 7].toLowerCase()}, ${shortDay(nx.d)}: ${esc(nx.p.title)}. Мышцы растут как раз во время отдыха.` : "") : `Выбери <a href="#/program">программу</a> или попроси тренера расписать неделю.`}</p></div>
        <div class="row">${S.profile?.program_id ? `<button class="btn quiet" data-act="move">Поставить сюда тренировку</button>` : ""}<button class="btn ${S.profile?.program_id ? "quiet" : ""}" data-act="new-w">${I.plus}Своя тренировка</button>
        ${S.templates.length || S.workouts.length ? `<button class="btn quiet" data-act="from-tpl">Из шаблона</button>` : ""}</div>
      </section>
      ${coachCard(d)}
      ${tiles}
      ${musicBlock(d)}`;
  }
  const items = w ? exercisesOf(w.id) : p.ex.map(e => { const s = suggestSets(e.name, e.sets, e.reps); return { isPlan: true, name: e.name, plan: `${e.sets} × ${e.reps}`, sets: s.sets, up: s.up, done: false }; });
  const done = items.filter(e => e.done).length;
  const kick = p ? `${ps ? `Неделя ${ps.local + 1}` : `Неделя ${p.week}`} · ${p.focus}` : "Тренировка";
  const ton = w ? tonnage(items) : 0;
  const feel = ["Тяжело", "Так себе", "Норм", "Хорошо", "Отлично"];
  return `${eyebrow}
    <section class="hero-card ${w && items.length && done === items.length ? "is-done" : ""}">
      <div class="hc-text">
        <div class="kicker">${esc(kick)}</div>
        ${w ? `<input class="title-inp" data-field="w-title" value="${esc(w.title)}" placeholder="Название тренировки" aria-label="Название тренировки" maxlength="80">` : `<h2 class="title-inp">${esc(p.title)}</h2>`}
        ${w ? `<p class="hc-sub" id="hc-sub">${done === items.length && items.length ? "Тренировка выполнена" : `${items.length - done} ${plural(items.length - done, "упражнение", "упражнения", "упражнений")} осталось`}${ton ? ` · поднято ${tons(ton)}` : ""}</p>`
          : `<p class="hc-sub">${items.length} ${plural(items.length, "упражнение", "упражнения", "упражнений")}. Нажми на упражнение, чтобы посмотреть, как его делать.</p>`}
      </div>
      ${w ? `<div class="ring-wrap" id="hc-ring">${ring(done, items.length)}</div>` : ""}
      <div class="hc-actions">
        ${w ? "" : `<button class="btn big" data-act="start">${d < today() ? "Отметить выполненное" : "Начать тренировку"}</button>`}
        <button class="btn ${w ? "quiet small" : "quiet"}" data-act="move">Перенести</button>
        ${w && items.length && done === items.length ? `<button class="btn quiet small" data-act="unfinish">Снять отметки</button>` : ""}
      </div>
    </section>
    ${coachCard(d)}
    ${w && done < items.length ? `<p class="how">Сделал упражнение — нажми кружок справа. Нажми на само упражнение, чтобы открыть подходы и вес.</p>` : ""}
    <ol class="ex-list" id="ex-list">${items.map((e, i) => exRow(e, i, d)).join("")}</ol>
    ${w && items.length && done < items.length ? `<button class="btn big finish" data-act="finish">${I.check}Завершить тренировку</button>` : ""}
    <form class="add-ex" data-form="add-ex">
      <input class="inp" name="name" list="ex-names" placeholder="Добавить упражнение" autocomplete="off" maxlength="80" aria-label="Новое упражнение">
      <datalist id="ex-names">${[...new Set([...S.exercises.map(e => e.name.trim()), ...PROGRAMS.flatMap(pr => (pr.sessions || []).flatMap(s => s.ex.flatMap(e => e.n)))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")).map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <button class="btn ghost" type="submit" aria-label="Добавить">${I.plus}</button>
    </form>
    ${tiles}
    ${musicBlock(d)}
    ${w ? `<div class="summary">
      <div class="eyebrow">Как прошло</div>
      <div class="seg full feel" role="radiogroup" aria-label="Самочувствие">${feel.map((f, i) => `<button role="radio" data-act="feel" data-v="${i + 1}" aria-checked="${w.feeling === i + 1}">${f}</button>`).join("")}</div>
      <textarea class="inp" data-field="w-note" rows="2" placeholder="Заметка: что получилось, что поменять" aria-label="Заметка">${esc(w.note)}</textarea>
    </div>
    <div class="panel-actions"><button class="btn quiet" data-act="more">Ещё</button></div>` : ""}`;
}

function refreshDayBits() { // кольцо, подпись и отметка дня — без перерисовки полей ввода
  const w = workoutOn(S.day); if (!w) return;
  const ex = exercisesOf(w.id), done = ex.filter(e => e.done).length, ton = tonnage(ex);
  const ringEl = document.getElementById("hc-ring"); if (ringEl) ringEl.innerHTML = ring(done, ex.length);
  const sub = document.getElementById("hc-sub");
  if (sub) sub.textContent = `${done === ex.length && ex.length ? "Тренировка выполнена" : `${ex.length - done} ${plural(ex.length - done, "упражнение", "упражнения", "упражнений")} осталось`}${ton ? ` · поднято ${tons(ton)}` : ""}`;
  const cell = document.querySelector(`.day[data-day="${S.day}"]`);
  if (cell) { const tmp = document.createElement("div"); tmp.innerHTML = dayCell(S.day, { label: cell.querySelector(".dw")?.textContent, outside: cell.classList.contains("outside") }); cell.replaceWith(tmp.firstElementChild); }
}
function replaceRow(e) {
  const li = document.querySelector(`[data-ex="${e.id}"]`), list = exercisesOf(e.workout_id);
  const allBefore = document.querySelector(".hero-card")?.classList.contains("is-done"), all = list.length && list.every(x => x.done);
  if (!!all !== !!allBefore) { rerender(); if (all) document.querySelector(".hero-card")?.classList.add("celebrate"); return; }
  if (li) li.outerHTML = exRow(e, list.indexOf(e), S.day);
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
// Тренировка дня по плану создаётся в момент первой отметки — до этого план просто показывается.
let creating = null;
function ensureWorkout() {
  const w = workoutOn(S.day); if (w) return Promise.resolve(w);
  if (creating) return creating;
  const p = sessionOn(S.day);
  const items = p ? p.ex.map(e => ({ name: e.name, plan: `${e.sets} × ${e.reps}`, sets: suggestSets(e.name, e.sets, e.reps).sets })) : [];
  creating = createWorkout(S.day, p?.title || "", items).finally(() => { creating = null; });
  return creating;
}

async function exAction(b, act) {
  const li = b.closest("[data-ex],[data-plan]"); if (!li) return;
  if (act === "ex-info" || act === "ex-photo") return photoSheet(li.dataset.name);
  let e;
  if (li.dataset.ex) e = S.exercises.find(x => x.id === li.dataset.ex);
  else {
    const i = +li.dataset.plan; b.classList.add("busy");
    const w = await ensureWorkout().catch(() => null); if (!w) return;
    e = exercisesOf(w.id)[i];
    document.getElementById("day-panel").innerHTML = dayPanel(); // план стал тренировкой
  }
  if (!e) return;
  switch (act) {
    case "ex-photo": return photoSheet(e.name);
    case "ex-open": S.open.has(e.id) ? S.open.delete(e.id) : S.open.add(e.id); return replaceRow(e);
    case "ex-done": e.done = !e.done; e.sets = (e.sets || []).map(s => ({ ...s, done: e.done })); if (e.done) S.open.delete(e.id); replaceRow(e); return saveEx(e);
    case "set-done": { const i = +b.closest(".set").dataset.i; e.sets[i].done = !e.sets[i].done; e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e); return saveEx(e); }
    case "set-add": { const ls = e.sets.at(-1) || {}; e.sets.push({ w: ls.w ?? null, r: ls.r ?? null, done: false }); e.done = false; replaceRow(e); saveEx(e);
      return document.querySelector(`[data-ex="${e.id}"] .set:last-child input`)?.focus(); }
    case "set-del": { const i = +b.closest(".set").dataset.i; e.sets.splice(i, 1); e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e); return saveEx(e); }
    case "ex-rename": return sheet("Переименовать", `<form id="rf" style="display:grid;gap:12px"><input class="inp" name="n" value="${esc(e.name)}" maxlength="80" list="ex-names"><div class="sheet-actions"><button class="btn" type="submit">Сохранить</button></div></form>`, (el, close) => {
      const f = el.querySelector("#rf"); setTimeout(() => f.n.focus(), 300);
      f.onsubmit = ev => { ev.preventDefault(); e.name = f.n.value.trim() || e.name; saveEx(e); close(); replaceRow(e); };
    });
    case "ex-del": {
      S.exercises.splice(S.exercises.indexOf(e), 1); document.querySelector(`[data-ex="${e.id}"]`)?.remove(); refreshDayBits();
      const t = setTimeout(() => q(sb.from("gym_exercises").delete().eq("id", e.id)), 5000);
      return toast(`«${e.name || "Упражнение"}» удалено`, { label: "Вернуть", run: () => { clearTimeout(t); S.exercises.push(e); rerender(); } });
    }
  }
}
function photoSheet(name) {
  const m = media(name), p = sessionOn(S.day)?.ex.find(e => norm(e.name) === norm(name)), last = lastFor(name, S.day);
  sheet(name, `${m ? `<div class="photo"><img src="${m.img}" alt="Начало движения"><img src="${m.img2}" alt="Конец движения" class="b"></div>` : ""}
    <dl class="info">
      ${p ? `<div><dt>Сегодня</dt><dd class="mono">${p.sets} × ${p.reps}</dd></div>` : ""}
      ${m ? `<div><dt>Мышцы</dt><dd>${esc(m.group)}</dd></div>` : ""}
      ${last && setsText(last.sets) ? `<div><dt>Прошлый раз</dt><dd>${shortDay(last.day)}: ${esc(setsText(last.sets))}</dd></div>` : ""}
      ${p?.tip ? `<div><dt>Совет</dt><dd>${esc(p.tip)}</dd></div>` : ""}
    </dl>
    ${m ? `<p class="hint">Кадры показывают начало и конец движения.</p>` : ""}`);
}

async function swapDays(a, b) {
  const wa = workoutOn(a), wb = workoutOn(b);
  if (wa && wb) {
    await q(sb.from("gym_workouts").update({ day: "1900-01-01" }).eq("id", wa.id));
    await q(sb.from("gym_workouts").update({ day: a }).eq("id", wb.id));
    await q(sb.from("gym_workouts").update({ day: b }).eq("id", wa.id));
    wa.day = b; wb.day = a;
  } else if (wa || wb) {
    const w = wa || wb; await q(sb.from("gym_workouts").update({ day: wa ? b : a }).eq("id", w.id)); w.day = wa ? b : a;
  }
  const p = S.profile;
  if (p.program_id) {
    const mv = { ...(p.program_moves || {}) }, h = { parse, monday };
    const src = d => Object.hasOwn(mv, d) ? mv[d] : (programSession(p, d, h) ? d : null);
    const sa = src(a), sb2 = src(b);
    mv[a] = sb2; mv[b] = sa;
    for (const d of [a, b]) if (mv[d] === d || (mv[d] === null && !programSession(p, d, h))) delete mv[d];
    p.program_moves = mv; saveProfile();
  }
}
function moreSheet() {
  sheet("Тренировка", `<div class="pick">
    <button data-m="save-tpl"><b>Сохранить как шаблон</b><span>Чтобы потом поставить на любой день</span></button>
    <button data-m="from-tpl"><b>Заменить шаблоном</b><span>Взять тренировку из шаблона или прошлой</span></button>
    <button data-m="del-w"><b>Удалить тренировку</b><span>Вместе с отметками этого дня</span></button></div>`, (el, close) => {
    el.addEventListener("click", ev => { const b = ev.target.closest("[data-m]"); if (!b) return; close(); setTimeout(() => run(b, b.dataset.m), 330); });
  });
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
      const old = workoutOn(S.day);
      if (old) { await q(sb.from("gym_workouts").delete().eq("id", old.id)); S.workouts = S.workouts.filter(x => x !== old); S.exercises = S.exercises.filter(x => x.workout_id !== old.id); }
      if (b.dataset.tpl) { const t = S.templates.find(x => x.id === b.dataset.tpl); await createWorkout(S.day, t.title, t.exercises); }
      else { const src = S.workouts.find(x => x.id === b.dataset.copy); await createWorkout(S.day, src.title, exercisesOf(src.id).map(e => ({ name: e.name, plan: e.plan, sets: e.sets }))); }
      close(); rerender();
    });
  });
}

/* ---------- coach ---------- */
const FN_COACH = "https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-coach";
const coachKey = d => `gym-coach-${S.user?.id}-${d}`;
const coachCached = d => { try { return JSON.parse(localStorage.getItem(coachKey(d)) || "null"); } catch { return null; } };
function coachCard(d) {
  const c = coachCached(d);
  return `<button class="coach" data-act="coach">
    <span class="co-mark" aria-hidden="true"></span>
    <span class="co-main"><b>Тренер</b><span>${c?.headline ? esc(c.headline) : "Совет на сегодня — или попроси расписать неделю"}</span></span>
    <span class="ex-chev" aria-hidden="true">${I.right}</span>
  </button>`;
}
async function askCoach(question) {
  const { data } = await sb.auth.getSession();
  const p = sessionOn(S.day), ps = S.profile?.program_id ? programStats() : null;
  const r = await fetch(FN_COACH, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({
      question, today: S.day,
      plan: workoutOn(S.day) ? { title: workoutOn(S.day).title, ex: exercisesOf(workoutOn(S.day).id).map(e => ({ name: e.name, plan: e.plan, sets: e.sets })) } : p ? { title: p.title, focus: p.focus, ex: p.ex.map(e => ({ name: e.name, sets: e.sets, reps: e.reps })) } : null,
      program: ps ? { title: ps.prog.title, week: ps.local + 1, of: ps.L } : null,
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || "failed");
  return out;
}
function coachHTML(c) {
  return `${c.headline ? `<p class="co-head">${esc(c.headline)}</p>` : ""}
    ${c.today ? `<p>${esc(c.today)}</p>` : ""}
    ${c.changes?.length ? `<div class="eyebrow" style="margin-top:6px">Поправки на сегодня</div>
      <ul class="co-changes">${c.changes.map(x => `<li><b>${esc(x.name)}</b><span class="mono">${[x.weight != null ? `${fmt(x.weight, 1)} кг` : "", x.sets ? `${x.sets} × ${x.reps || "—"}` : x.reps ? `${x.reps} повт.` : ""].filter(Boolean).join(" · ")}</span>${x.why ? `<span class="muted">${esc(x.why)}</span>` : ""}</li>`).join("")}</ul>
      <button class="btn" data-apply>Применить к тренировке</button>` : ""}
    ${c.tips?.length ? `<ul class="co-tips">${c.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${c.answer ? `<div class="co-answer">${esc(c.answer)}</div>` : ""}`;
}
function coachSheet() {
  const cached = coachCached(S.day);
  const chatKey = `gym-chat-${S.user?.id}`;
  let msgs = []; try { msgs = JSON.parse(localStorage.getItem(chatKey) || "[]").slice(-20); } catch {}
  const chips = ["Распиши мне неделю", "Перенеси сегодняшнюю на завтра", "Отметь вчерашнюю выполненной", "Сделай тренировку полегче — не выспался"];
  sheet("Тренер", `
    <div class="co-feed" id="co-feed"></div>
    <div class="co-chips">${chips.map(c => `<button type="button" data-chip>${c}</button>`).join("")}</div>
    <form id="cq" class="co-input"><textarea class="inp" name="q" rows="1" placeholder="Напиши тренеру…" maxlength="1000"></textarea><button class="btn" type="submit" aria-label="Отправить">${I.right}</button></form>`, (el, close) => {
    const feed = el.querySelector("#co-feed"), f = el.querySelector("#cq");
    const save = () => { try { localStorage.setItem(chatKey, JSON.stringify(msgs.slice(-20))); } catch {} };
    const bubble = (role, html) => { const d = document.createElement("div"); d.className = `co-msg ${role}`; d.innerHTML = html; feed.append(d); d.scrollIntoView({ block: "end", behavior: "smooth" }); return d; };
    // совет на сегодня — первым сообщением
    const adviceBox = bubble("assistant", cached ? coachHTML(cached) : `<p class="co-wait"><i></i><i></i><i></i> Смотрю твои тренировки, питание и сон…</p>`);
    const wireApply = (box, c) => box.querySelector("[data-apply]")?.addEventListener("click", async ev => { ev.target.classList.add("loading"); await applyCoach(c.changes); close(); });
    if (cached) wireApply(adviceBox, cached);
    else askCoach().then(c => { try { localStorage.setItem(coachKey(S.day), JSON.stringify(c)); } catch {} adviceBox.innerHTML = coachHTML(c); wireApply(adviceBox, c); document.querySelector(".coach")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: coachCard(S.day) }).firstElementChild); })
      .catch(e => { adviceBox.innerHTML = `<p class="muted">${e.message === "no_key" ? "Тренер ещё не подключён." : "Совет на сегодня не загрузился — можешь просто написать, что нужно."}</p>`; });
    for (const m of msgs) bubble(m.role, m.role === "user" ? `<p>${esc(m.content)}</p>` : `<p>${esc(m.reply || m.content)}</p>`);
    const send = async text => {
      text = text.trim(); if (!text) return;
      bubble("user", `<p>${esc(text)}</p>`); msgs.push({ role: "user", content: text }); save();
      const wait = bubble("assistant", `<p class="co-wait"><i></i><i></i><i></i> Думаю…</p>`);
      try {
        const out = await chatCoach(msgs);
        msgs.push({ role: "assistant", content: JSON.stringify({ reply: out.reply, actions: out.actions }), reply: out.reply }); save();
        wait.innerHTML = `<p>${esc(out.reply)}</p>${out.actions.length ? actionsHTML(out.actions) : ""}`;
        const ap = wait.querySelector("[data-apply-actions]");
        ap?.addEventListener("click", async () => {
          ap.classList.add("loading"); ap.disabled = true;
          try { const n = await applyActions(out.actions); wait.querySelector(".co-actions").classList.add("applied"); ap.replaceWith(Object.assign(document.createElement("p"), { className: "co-done", textContent: `Готово — изменений: ${n}. Календарь обновлён.` })); rerender(); }
          catch { ap.classList.remove("loading"); ap.disabled = false; toast("Не всё получилось применить — попробуй ещё раз"); }
        });
        wait.querySelector("[data-skip]")?.addEventListener("click", ev => { ev.target.closest(".co-actions-wrap").remove(); });
      } catch (e) { wait.innerHTML = `<p class="muted">${e.message === "no_key" ? "Тренер ещё не подключён." : "Тренер не ответил. Попробуй ещё раз."}</p>`; msgs.pop(); save(); }
    };
    el.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => send(b.textContent));
    f.onsubmit = ev => { ev.preventDefault(); const v = f.q.value; f.q.value = ""; f.q.style.height = ""; send(v); };
    f.q.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } });
    f.q.addEventListener("input", () => { f.q.style.height = "auto"; f.q.style.height = Math.min(140, f.q.scrollHeight) + "px"; });
  });
}
// Календарь для тренера: неделя назад и 4 вперёд — что стоит в каждый день.
function calendarForCoach() {
  const out = [];
  for (let i = -7; i <= 28; i++) {
    const d = addDays(today(), i), s = dayStatus(d);
    const ex = s.w ? s.ex.map(e => e.name) : s.plan ? s.plan.ex.map(e => `${e.name} ${e.sets}×${e.reps}`) : [];
    out.push({ day: d, wd: WD[wdOf(d)], st: s.st, title: s.title || null, ex });
  }
  return out;
}
async function chatCoach(msgs) {
  const { data } = await sb.auth.getSession(), ps = S.profile?.program_id ? programStats() : null;
  const r = await fetch(FN_COACH, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({
      mode: "chat", today: today(), messages: msgs.map(m => ({ role: m.role, content: m.content })),
      calendar: calendarForCoach(), known: KNOWN_NAMES, program: ps ? { title: ps.prog.title, week: ps.local + 1, of: ps.L } : null,
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || "failed");
  return out;
}
const dayName = d => `${WD[wdOf(d)]}, ${shortDay(d)}`;
function actionsHTML(actions) {
  const line = a => {
    switch (a.type) {
      case "create": return `<b>${dayName(a.day)}</b> — «${esc(a.title)}»<span>${a.exercises.map(e => `${esc(e.name)} ${e.sets}×${esc(e.reps || "—")}${e.weight != null ? `, ${fmt(e.weight, 1)} кг` : ""}`).join(" · ")}</span>`;
      case "delete": return `<b>${dayName(a.day)}</b> — сделать днём отдыха`;
      case "move": return `<b>${dayName(a.from)} ⇄ ${dayName(a.to)}</b> — поменять местами`;
      case "done": return `<b>${dayName(a.day)}</b> — отметить выполненным${a.exercises.length ? `<span>${a.exercises.map(esc).join(", ")}</span>` : ""}`;
      case "edit": return `<b>${dayName(a.day)}</b> — ${esc(a.name)}<span>${[a.weight != null ? `${fmt(a.weight, 1)} кг` : "", a.sets ? `${a.sets} подх.` : "", a.reps ? `${esc(a.reps)} повт.` : ""].filter(Boolean).join(" · ")}</span>`;
    }
    return "";
  };
  return `<div class="co-actions-wrap"><ul class="co-actions">${actions.map(a => `<li class="ca-${a.type}">${line(a)}</li>`).join("")}</ul>
    <div class="row"><button class="btn" data-apply-actions>Применить в календарь</button><button class="btn quiet" data-skip>Не надо</button></div></div>`;
}
// Тренировка на любой день: если там план программы — берём его.
async function workoutFor(day) {
  const w = workoutOn(day); if (w) return w;
  const p = sessionOn(day);
  const items = p ? p.ex.map(e => ({ name: e.name, plan: `${e.sets} × ${e.reps}`, sets: suggestSets(e.name, e.sets, e.reps).sets })) : [];
  return createWorkout(day, p?.title || "Тренировка", items);
}
async function removeWorkout(day) {
  const w = workoutOn(day); if (!w) return;
  await q(sb.from("gym_workouts").delete().eq("id", w.id));
  S.workouts = S.workouts.filter(x => x !== w); S.exercises = S.exercises.filter(x => x.workout_id !== w.id);
}
function setRest(day) { // день программы становится отдыхом
  const p = S.profile; if (!p.program_id || !programSession(p, day, { parse, monday }) && !Object.hasOwn(p.program_moves || {}, day)) return;
  p.program_moves = { ...(p.program_moves || {}), [day]: null };
}
async function applyActions(actions) {
  let n = 0;
  for (const a of actions) {
    if (a.type === "create") {
      await removeWorkout(a.day);
      const items = a.exercises.map(e => { const s = suggestSets(e.name, e.sets, e.reps || "10"); return { name: e.name, plan: `${e.sets} × ${e.reps || "—"}`, sets: s.sets.map(x => ({ ...x, w: e.weight ?? x.w, r: parseInt(e.reps) || x.r })) }; });
      await createWorkout(a.day, a.title, items); n++;
    } else if (a.type === "delete") { await removeWorkout(a.day); setRest(a.day); n++; }
    else if (a.type === "move") { await swapDays(a.from, a.to); n++; }
    else if (a.type === "done" || a.type === "edit") {
      const w = await workoutFor(a.day), list = exercisesOf(w.id);
      if (a.type === "done") {
        const pick = a.exercises.length ? list.filter(e => a.exercises.some(x => norm(x) === norm(e.name))) : list;
        for (const e of pick) { e.done = true; e.sets = (e.sets || []).map(s => ({ ...s, done: true })); await q(sb.from("gym_exercises").update({ sets: e.sets, done: true }).eq("id", e.id)); }
      } else {
        let e = list.find(x => norm(x.name) === norm(a.name));
        const cnt = a.sets || e?.sets.length || 3, r = parseInt(a.reps) || e?.sets[0]?.r || null, wv = a.weight ?? e?.sets.find(s => s.w != null)?.w ?? null;
        const sets = Array.from({ length: cnt }, (_, i) => ({ w: wv, r, done: e?.sets[i]?.done || false }));
        if (e) { e.sets = sets; if (a.reps || a.sets) e.plan = `${cnt} × ${a.reps || r || "—"}`; await q(sb.from("gym_exercises").update({ sets, plan: e.plan }).eq("id", e.id)); }
        else S.exercises.push(await q(sb.from("gym_exercises").insert({ workout_id: w.id, position: list.length, name: a.name, plan: `${cnt} × ${a.reps || r || "—"}`, sets }).select().single()));
      }
      n++;
    }
  }
  saveProfile();
  return n;
}
async function applyCoach(changes) {
  const w = await ensureWorkout().catch(() => null); if (!w) return;
  let n = 0;
  for (const c of changes || []) {
    const e = exercisesOf(w.id).find(x => norm(x.name) === norm(c.name)); if (!e) continue;
    const cnt = c.sets || e.sets.length || 3, r = parseInt(c.reps) || e.sets[0]?.r || null, wv = c.weight ?? e.sets.find(s => s.w != null)?.w ?? null;
    e.sets = Array.from({ length: cnt }, (_, i) => ({ w: wv, r, done: e.sets[i]?.done || false }));
    if (c.reps || c.sets) { e.plan = `${cnt} × ${c.reps || r || "—"}`; q(sb.from("gym_exercises").update({ plan: e.plan }).eq("id", e.id)); }
    saveEx(e); n++;
  }
  rerender(); toast(n ? `Поправки применены: ${n}` : "Таких упражнений в тренировке нет");
}

/* ---------- music ---------- */
// Плеер Яндекс Музыки: принимаем код iframe или обычную ссылку на трек, альбом или плейлист.
function musicSrc(text) {
  const m = String(text).match(/https?:\/\/music\.yandex\.(?:ru|com|by|kz|uz)\/[^\s"'<>]+/); if (!m) return null;
  const u = new URL(m[0].replace(/&amp;/g, "&")), path = u.pathname;
  let x;
  if (path.startsWith("/iframe/")) return `https://music.yandex.ru${path}`;
  if ((x = path.match(/^\/album\/(\d+)\/track\/(\d+)/))) return `https://music.yandex.ru/iframe/album/${x[1]}/track/${x[2]}`;
  if ((x = path.match(/^\/album\/(\d+)\/?$/))) return `https://music.yandex.ru/iframe/album/${x[1]}`;
  if ((x = path.match(/^\/users\/([^/]+)\/playlists\/(\d+)/))) return `https://music.yandex.ru/iframe/playlist/${x[1]}/${x[2]}`;
  return null;
}
const wdOf = d => (parse(d).getDay() + 6) % 7;
const WD_EVERY = ["Каждый понедельник", "Каждый вторник", "Каждую среду", "Каждый четверг", "Каждую пятницу", "Каждую субботу", "Каждое воскресенье"];
function dayMusic(d) {
  return [...(S.days.find(x => x.day === d)?.music || []).map(u => ({ u, scope: "day" })), ...((S.profile?.week_music || {})[wdOf(d)] || []).map(u => ({ u, scope: "week" }))];
}
function musicBlock(d) {
  const list = dayMusic(d);
  return `<section class="music">
    <div class="mu-head"><span class="eyebrow">Музыка</span><button class="linkbtn" data-act="music-add">+ Добавить трек</button></div>
    ${list.map(m => `<div class="mu-item"><iframe src="${esc(m.u)}" loading="lazy" allow="clipboard-write" title="Плеер Яндекс Музыки" style="height:${m.u.includes("/track/") ? 244 : 450}px"></iframe>
      <div class="mu-meta"><span>${m.scope === "week" ? WD_EVERY[wdOf(d)] : "Только в этот день"}</span><button class="linkbtn muted-link" data-act="music-del" data-scope="${m.scope}" data-u="${esc(m.u)}">Убрать</button></div></div>`).join("")}
  </section>`;
}
function musicSheet() {
  const d = S.day;
  sheet("Добавить музыку", `<p class="hint">Вставь ссылку на трек, альбом или плейлист Яндекс Музыки — или код «Встроить» оттуда же.</p>
    <form id="mf" style="display:grid;gap:12px">
      <textarea class="inp" name="t" rows="3" placeholder="https://music.yandex.ru/album/…/track/…"></textarea>
      <div class="seg full" role="radiogroup" aria-label="Когда"><button type="button" role="radio" data-sc="day" aria-checked="true">Только ${shortDay(d)}</button><button type="button" role="radio" data-sc="week" aria-checked="false">${WD_EVERY[wdOf(d)]}</button></div>
      <p class="err" id="merr" style="color:var(--bad);font-size:14px;min-height:0"></p>
      <button class="btn" type="submit">Добавить</button>
    </form>`, (el, close) => {
    const f = el.querySelector("#mf"); let scope = "day";
    el.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => { scope = b.dataset.sc; el.querySelectorAll("[data-sc]").forEach(x => x.setAttribute("aria-checked", x === b)); });
    setTimeout(() => f.t.focus(), 300);
    f.onsubmit = async ev => {
      ev.preventDefault();
      const src = musicSrc(f.t.value);
      if (!src) { el.querySelector("#merr").textContent = "Не похоже на ссылку Яндекс Музыки на трек, альбом или плейлист"; return; }
      await saveMusic(d, scope, list => list.includes(src) ? list : [...list, src]);
      close(); rerender(); toast("Трек добавлен");
    };
  });
}
async function saveMusic(d, scope, fn) {
  if (scope === "week") {
    const wm = { ...(S.profile.week_music || {}) }, k = wdOf(d);
    wm[k] = fn(wm[k] || []); if (!wm[k].length) delete wm[k];
    S.profile.week_music = wm; saveProfile();
  } else {
    let row = S.days.find(x => x.day === d); if (!row) { row = { day: d, sleep_h: null, music: [] }; S.days.push(row); }
    row.music = fn(row.music || []);
    await q(sb.from("gym_days").upsert({ day: d, music: row.music }));
  }
}

/* ---------- program ---------- */
function programView() {
  const p = S.profile, cur = programById(p.program_id), ps = cur && programStats();
  const cards = PROGRAMS.map(pr => `
    <button class="prog-card" data-act="pick-prog" data-v="${pr.id}" aria-pressed="${pr.id === p.program_id}">
      <span class="pc-top"><b>${esc(pr.title)}</b><span class="mono">${pr.days} ${plural(pr.days, "день", "дня", "дней")} в неделю</span></span>
      <span class="muted">${esc(pr.about)}</span>
      ${pr.id === p.program_id ? `<span class="pc-on">Выбрана</span>` : ""}
    </button>`).join("");
  if (!cur) return `
    <section class="hero"><div class="kicker">Программа</div><h1>Выбери программу</h1>
      <p class="lead">После выбора в календаре на каждый тренировочный день появится готовая тренировка с подходами, весами и фото упражнений.</p></section>
    <section class="block" style="margin-bottom:12px"><div class="prog-cards">${cards}</div></section>`;
  const plan = ps.plan, days = (p.program_days?.length === cur.days ? p.program_days : cur.defaultDays);
  const wk = ps.cur, block = cur.sessionsFor ? 0 : Math.floor(wk / 3) % 2;
  const list = cur.sessionsFor ? cur.sessionsFor(wk) : cur.sessions;
  const phaseNow = plan.phases.findIndex(f => ps.local + 1 >= f.weeks[0] && ps.local + 1 <= f.weeks[1]);
  return `
    <section class="hero"><div class="kicker">Программа</div><h1>${esc(cur.title)}</h1>
      <p class="lead">Неделя <b>${ps.local + 1}</b> из ${ps.L}${ps.planned ? ` · сделано ${ps.done} из ${ps.planned} ${plural(ps.planned, "тренировки", "тренировок", "тренировок")}` : ""}.</p></section>
    <section class="block">
      <h2>Куда ведёт</h2>
      <p class="muted">${esc(plan.goal)}</p>
      <ol class="phases">${plan.phases.map((f, i) => `<li class="${i < phaseNow ? "past" : i === phaseNow ? "now" : ""}"><span class="ph-w mono">Недели ${f.weeks[0]}–${f.weeks[1]}${i === phaseNow ? " · ты здесь" : ""}</span><b>${esc(f.title)}</b><span>${esc(f.text)}</span></li>`).join("")}</ol>
    </section>
    <section class="block">
      <h2>Тренировки этой недели</h2>
      ${cur.sessionsFor ? `<p class="hint">«Суперсет» — два упражнения подряд без отдыха. <a href="${cur.source}" target="_blank" rel="noopener">Источник программы</a></p>` : ""}
      <div class="sessions">${list.map(s => `
        <div class="card sess"><div class="sess-head"><b>${esc(s.title)}</b><span class="muted">${esc(s.focus)}</span></div>
          <ol class="plan-list">${s.ex.map(e => { const n = e.n[block] || e.n[0], m = media(n); return `<li>${m ? `<button class="pl-img-btn" data-act="photo" data-name="${esc(n)}" aria-label="Как делать: ${esc(n)}"><img class="pl-img" src="${m.img}" alt="" loading="lazy"></button>` : `<span class="pl-img none"></span>`}<div class="pl-main"><b>${esc(n)}</b>${e.tip ? `<span>${esc(e.tip)}</span>` : ""}</div><span class="pl-sets mono">${e.s} × ${e.r}</span></li>`; }).join("")}</ol>
        </div>`).join("")}</div>
    </section>
    <section class="block">
      <h2>В какие дни</h2>
      <p class="hint">Нажми на свободный день — на него переедет ближайшая тренировка. Перенести одну тренировку можно прямо в календаре.</p>
      <div class="wd-pick" role="group" aria-label="Дни недели">${WD.map((w, i) => `<button data-act="prog-day" data-v="${i}" aria-pressed="${days.includes(i)}">${w}</button>`).join("")}</div>
    </section>
    <details class="block fold"><summary>Сменить программу</summary><div class="prog-cards" style="margin-top:12px">${cards}</div>
      <div style="margin-top:12px"><button class="btn quiet" data-act="prog-off">Отключить программу</button></div></details>
    <details class="block fold" style="margin-bottom:12px"><summary>Принципы тренировок</summary>
      <p class="hint" style="margin-top:8px">Из книги Андрея Скоромного «О силовых тренировках».</p>
      <dl class="principles" style="margin-top:12px">${PRINCIPLES.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl></details>`;
}

/* ---------- food ---------- */
async function ensureMeals(day) {
  if (S.meals[day] !== undefined) return;
  S.meals[day] = null;
  S.meals[day] = await q(sb.from("gym_meals").select("*").eq("day", day).order("created_at"), { silent: true }).catch(() => []);
  if ((route().path === "food" && S.foodDay === day) || (route().path === "" && S.day === day)) rerender();
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

/* ---------- stats ---------- */
const PERIODS = { 7: "Неделя", 30: "Месяц", 90: "3 мес.", 365: "Год", 0: "Всё время" };
const getPeriod = () => { try { const v = localStorage.getItem("gym-per"); return v != null && v in PERIODS ? +v : 30; } catch { return 30; } };
function firstDay() {
  const c = [S.workouts[0]?.day, S.body[0]?.day, S.days[0]?.day, S.profile?.program_start].filter(Boolean).sort();
  return c[0] && c[0] < today() ? c[0] : addDays(today(), -29);
}
// для длинных периодов — среднее по неделям, чтобы столбики читались
function series(days, fn) {
  if (days.length <= 92) return { days, vals: days.map(fn), weekly: false };
  const out = { days: [], vals: [], weekly: true };
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7), v = chunk.map(fn).filter(x => x != null);
    out.days.push(chunk[0]); out.vals.push(v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
  }
  return out;
}
let rangeLoading = null;
async function ensureMealsRange(from, to) {
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  if (days.every(d => S.meals[d])) return;
  if (rangeLoading) return;
  rangeLoading = q(sb.from("gym_meals").select("*").gte("day", from).lte("day", to).order("created_at"), { silent: true })
    .then(rows => { for (const d of days) if (!S.meals[d]) S.meals[d] = rows.filter(r => r.day === d); })
    .catch(() => {}).finally(() => { rangeLoading = null; if (route().path === "progress") rerender(); });
}
function lineChart(points, { h = 160, unit = "" } = {}) {
  if (points.length < 2) return "";
  const W = 600, pad = 22, ys = points.map(p => p.v), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => pad + (i / (points.length - 1)) * (W - pad * 2), y = v => 12 + (1 - (v - min) / span) * (h - 36);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="График веса">
    <line class="gl" x1="${pad}" x2="${W - pad}" y1="${y(max)}" y2="${y(max)}"/><line class="gl" x1="${pad}" x2="${W - pad}" y1="${y(min)}" y2="${y(min)}"/>
    <polyline class="ln" points="${line}"/>
    ${points.map((p, i) => `<circle class="pt hit" cx="${x(i)}" cy="${y(p.v)}" r="4"><title>${shortDay(p.d)}: ${fmt(p.v, 1)}${unit}</title></circle>`).join("")}
    <text x="${W - pad}" y="${y(max) - 4}" text-anchor="end">${fmt(max, 1)}${unit}</text>
    <text x="${W - pad}" y="${y(min) + 14}" text-anchor="end">${fmt(min, 1)}${unit}</text>
    <text x="${pad}" y="${h - 4}">${shortDay(points[0].d)}</text><text x="${W - pad}" y="${h - 4}" text-anchor="end">${shortDay(points.at(-1).d)}</text>
  </svg>`;
}
// Столбики по дням с линией цели. Дни без данных — пустые.
function barChart({ days, vals, weekly }, { goal, unit, fmtV = v => fmt(v) }) {
  const W = 600, H = 150, top = 12, bot = 22, n = days.length, gap = n > 40 ? 1 : 2;
  const max = Math.max(goal || 0, ...vals.filter(v => v != null)) * 1.12 || 1;
  const bw = (W - gap * (n - 1)) / n, y = v => top + (1 - v / max) * (H - top - bot);
  const bars = vals.map((v, i) => v == null ? "" : `<rect class="bc ${goal && v < goal * 0.9 ? "low" : ""}" x="${(i * (bw + gap)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - bot - y(v)).toFixed(1)}" rx="${Math.min(4, bw / 2)}"><title>${weekly ? "Неделя с " : ""}${shortDay(days[i])}: ${fmtV(v)} ${unit}${weekly ? " в среднем" : ""}</title></rect>`).join("");
  const step = weekly ? Math.ceil(n / 6) : n > 40 ? 15 : n > 10 ? 7 : 1;
  const labels = days.map((d, i) => i % step === 0 || i === n - 1 ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${weekly ? `${parse(d).getDate()}.${String(parse(d).getMonth() + 1).padStart(2, "0")}` : n > 10 ? parse(d).getDate() : WD[(parse(d).getDay() + 6) % 7]}</text>` : "").join("");
  return `<svg class="chart bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="По дням, цель ${fmtV(goal)} ${unit}">
    ${bars}${goal ? `<line class="goal" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/><text class="goal-t" x="2" y="${y(goal) - 5}">цель ${fmtV(goal)}</text>` : ""}${labels}
  </svg>`;
}

function progressView() {
  const per = getPeriod(), t = today(), from = per ? addDays(t, -(per - 1)) : firstDay();
  const days = []; for (let d = from; d <= t; d = addDays(d, 1)) days.push(d);
  const n = days.length;
  ensureMealsRange(from, t);
  const g = goals(), loaded = days.every(d => S.meals[d]);

  // тренировки
  const plannedDays = days.filter(d => sessionOn(d) || workoutOn(d));
  const doneDays = plannedDays.filter(completed);
  const missed = plannedDays.filter(d => d < t && !completed(d));
  const wIn = S.workouts.filter(w => w.day >= from && w.day <= t);
  const exIn = wIn.flatMap(w => exercisesOf(w.id));
  const ton = tonnage(exIn);
  const groups = {};
  for (const e of exIn) { const gname = media(e.name)?.group || "Другое", sets = (e.sets || []).filter(s => s.done || e.done).length; if (sets) groups[gname] = (groups[gname] || 0) + sets; }
  const weeksN = n / 7, gMax = Math.max(1, ...Object.values(groups));

  // питание
  const logged = days.filter(d => S.meals[d]?.length);
  const daySum = d => (S.meals[d] || []).reduce((a, m) => ({ kcal: a.kcal + +m.kcal, P: a.P + +m.protein }), { kcal: 0, P: 0 });
  const sums = logged.map(daySum);
  const avg = k => sums.length ? sums.reduce((a, s) => a + s[k], 0) / sums.length : 0;
  const kcalAvg = avg("kcal"), pAvg = avg("P");
  const pDaysOk = sums.filter(s => g.P && s.P >= g.P * 0.9).length;

  // сон и вес
  const sl = S.days.filter(x => x.day >= from && x.day <= t && x.sleep_h != null);
  const sleepAvg = sl.length ? sl.reduce((a, x) => a + +x.sleep_h, 0) / sl.length : null;
  const short = sl.filter(x => +x.sleep_h < 7).length;
  const bodyIn = S.body.filter(b => b.day >= from && b.day <= t);
  const wChange = bodyIn.length > 1 ? +bodyIn.at(-1).weight_kg - +bodyIn[0].weight_kg : null;

  // упражнения без прогресса: 3+ тренировки за период и верхний вес не вырос
  const stuck = [];
  const byName = {};
  for (const w of wIn) for (const e of exercisesOf(w.id)) {
    const top = Math.max(0, ...(e.sets || []).filter(s => s.done || e.done).map(s => +s.w || 0)); if (!top) continue;
    (byName[norm(e.name)] ||= { name: e.name, hist: [] }).hist.push({ d: w.day, v: top });
  }
  for (const x of Object.values(byName)) { x.hist.sort((a, b) => a.d.localeCompare(b.d)); if (x.hist.length >= 3 && Math.max(...x.hist.slice(1).map(h => h.v)) <= x.hist[0].v) stuck.push(x); }

  // что мешает — только то, что видно по данным
  const issues = [];
  if (loaded && logged.length && g.P && pAvg < g.P * 0.9) issues.push(["Мало белка", `В среднем ${fmt(pAvg)} г в день при цели ${fmt(g.P)} г — не хватает ~${fmt(g.P - pAvg)} г. Норму добрал в ${pDaysOk} ${plural(pDaysOk, "день", "дня", "дней")} из ${logged.length}.`]);
  if (loaded && logged.length && g.kcal && kcalAvg < g.kcal * 0.9) issues.push(["Недобор калорий", `В среднем ${fmt(kcalAvg)} ккал при цели ${fmt(g.kcal)}. Для роста мышц нужно есть свою норму.`]);
  if (loaded && logged.length && g.kcal && kcalAvg > g.kcal * 1.12) issues.push(["Перебор калорий", `В среднем ${fmt(kcalAvg)} ккал при цели ${fmt(g.kcal)}.`]);
  if (sleepAvg != null && sleepAvg < 7) issues.push(["Недосып", `В среднем ${fmt(sleepAvg, 1)} ч, меньше 7 часов — ${short} ${plural(short, "ночь", "ночи", "ночей")}. Мышцы восстанавливаются во сне, 7–9 часов — норма.`]);
  const pastPlanned = plannedDays.filter(d => d < t).length;
  if (missed.length) issues.push(["Пропуски", `Пропущено ${missed.length} из ${pastPlanned} ${plural(pastPlanned, "тренировки", "тренировок", "тренировок")}.`]);
  if (stuck.length) issues.push(["Веса стоят на месте", stuck.slice(0, 4).map(x => `${x.name}: ${x.hist.length} раза на ${fmt(x.hist[0].v, 1)} кг`).join("; ") + ". Попробуй добавить 2,5 кг или сменить вариант упражнения."]);
  if (loaded && logged.length < n * 0.6) issues.push(["Мало данных о питании", `Еда записана в ${logged.length} ${plural(logged.length, "день", "дня", "дней")} из ${n} — итоги по питанию неточные.`]);
  if (!sl.length) issues.push(["Сон не отмечен", "Отмечай, сколько спал, на экране дня — тогда будет видно, мешает ли недосып."]);

  const tile = (k, v, sub, cls = "") => `<div class="st-tile ${cls}"><span class="t-k">${k}</span><b class="mono">${v}</b><span class="t-sub">${sub}</span></div>`;
  return `
    <section class="hero"><div class="kicker">Итоги</div><h1>${{ 7: "За неделю", 30: "За месяц", 90: "За 3 месяца", 365: "За год", 0: "За всё время" }[per]}</h1>
      <div class="seg" role="radiogroup" aria-label="Период">${Object.entries(PERIODS).map(([k, l]) => `<button role="radio" data-act="per" data-v="${k}" aria-checked="${+k === per}">${l}</button>`).join("")}</div>
    </section>
    <section class="block">
      <div class="st-grid">
        ${tile("Тренировки", `${doneDays.length}<small>/${plannedDays.length}</small>`, plannedDays.length ? `${Math.round(doneDays.length / plannedDays.length * 100)}% плана` : "нет плана")}
        ${tile("Поднято", ton ? tons(ton) : "—", `${fmt(exIn.reduce((a, e) => a + (e.sets || []).filter(s => s.done || e.done).length, 0))} подходов`)}
        ${tile("Сон", sleepAvg != null ? `${fmt(sleepAvg, 1)}<small> ч</small>` : "—", sl.length ? `в среднем за ${sl.length} ${plural(sl.length, "ночь", "ночи", "ночей")}` : "не отмечен", sleepAvg != null && sleepAvg < 7 ? "warn" : "")}
        ${tile("Калории", loaded && logged.length ? fmt(kcalAvg) : "—", `в день · цель ${fmt(g.kcal)}`, loaded && logged.length && (kcalAvg < g.kcal * 0.9 || kcalAvg > g.kcal * 1.12) ? "warn" : "")}
        ${tile("Белок", loaded && logged.length ? `${fmt(pAvg)}<small> г</small>` : "—", `в день · цель ${fmt(g.P)} г`, loaded && logged.length && pAvg < g.P * 0.9 ? "warn" : "")}
        ${tile("Вес", bodyIn.length ? `${fmt(bodyIn.at(-1).weight_kg, 1)}<small> кг</small>` : "—", wChange != null ? `${wChange > 0 ? "+" : wChange < 0 ? "−" : "±"}${fmt(Math.abs(wChange), 1)} кг за период` : "отмечай в разделе ниже")}
      </div>
    </section>
    <section class="block">
      <h2>Что мешает</h2>
      ${issues.length ? `<ul class="issues">${issues.map(([a, b]) => `<li><b>${a}</b><span>${esc(b)}</span></li>`).join("")}</ul>` : `<p class="muted">По данным за период явных затыков нет: план выполняется, еды и сна хватает.</p>`}
    </section>
    <section class="block">
      <h2>Белок по дням</h2>
      ${loaded ? `<div class="card">${barChart(series(days, d => S.meals[d]?.length ? daySum(d).P : null), { goal: g.P, unit: "г белка" })}</div>` : `<div class="skel" style="height:150px"></div>`}
      <h2 style="margin-top:12px">Калории по дням</h2>
      ${loaded ? `<div class="card">${barChart(series(days, d => S.meals[d]?.length ? daySum(d).kcal : null), { goal: g.kcal, unit: "ккал" })}</div>` : `<div class="skel" style="height:150px"></div>`}
      <p class="hint">Приглушённые столбики — меньше 90% цели. Наведи или нажми на столбик, чтобы увидеть число.</p>
    </section>
    <section class="block">
      <h2>Сон</h2>
      ${sl.length ? `<div class="card">${barChart(series(days, d => { const x = S.days.find(s => s.day === d); return x?.sleep_h != null ? +x.sleep_h : null; }), { goal: 7, unit: "ч", fmtV: v => fmt(v, 1) })}</div>` : `<p class="hint">Отмечай сон на экране дня кнопками «−» и «+».</p>`}
    </section>
    ${Object.keys(groups).length ? `<section class="block">
      <h2>Подходы по мышцам</h2>
      <p class="hint">Сделанных подходов в неделю в среднем. Для роста обычно нужно 10–20 на группу.</p>
      <ul class="groups">${Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${k}</span><span class="bar"><i style="width:${v / gMax * 100}%"></i></span><span class="mono">${fmt(v / Math.max(1, weeksN), 1)}</span></li>`).join("")}</ul>
    </section>` : ""}
    <section class="block">
      <h2>Вес тела</h2>
      <form class="add-ex" data-form="body">
        <input class="inp" name="w" inputmode="decimal" placeholder="Вес сегодня, кг" value="${S.body.find(b => b.day === t)?.weight_kg ?? ""}" aria-label="Вес сегодня, кг">
        <button class="btn" type="submit">Записать</button>
      </form>
      ${S.body.length > 1 ? `<div class="card">${lineChart(S.body.slice(-90).map(b => ({ d: b.day, v: +b.weight_kg })), { unit: " кг" })}</div>` : `<p class="hint">Записывай вес раз в неделю утром — здесь появится график.</p>`}
    </section>
    ${liftsBlock()}`;
}
function liftsBlock() {
  const lifts = new Map();
  for (const e of S.exercises) {
    const name = e.name.trim(), d = dayOfWorkout(e.workout_id); if (!name || !d) continue;
    const top = Math.max(0, ...(e.sets || []).filter(s => s.done || e.done).map(s => +s.w || 0)); if (!top) continue;
    const k = norm(name), cur = lifts.get(k) || { name, hist: [] };
    cur.hist.push({ d, v: top, r: (e.sets.find(s => +s.w === top) || {}).r }); lifts.set(k, cur);
  }
  const rows = [...lifts.values()].map(l => { l.hist.sort((a, b) => a.d.localeCompare(b.d)); l.best = l.hist.reduce((a, b) => b.v > a.v ? b : a); l.last = l.hist.at(-1).d; return l; }).sort((a, b) => b.last.localeCompare(a.last));
  const spark = hist => { if (hist.length < 2) return `<span></span>`; const vs = hist.slice(-12).map(h => h.v), mn = Math.min(...vs), mx = Math.max(...vs), sp = mx - mn || 1; return `<svg class="spark" viewBox="0 0 84 28" preserveAspectRatio="none"><polyline points="${vs.map((v, i) => `${(i / (vs.length - 1)) * 82 + 1},${26 - ((v - mn) / sp) * 24}`).join(" ")}"/></svg>`; };
  return `<section class="block" style="margin-bottom:12px">
    <h2>Рабочие веса</h2>
    ${rows.length ? `<ul class="lifts card" style="padding:4px 16px">${rows.map(l => `<li class="lift"><div><div class="name">${esc(l.name)}</div><div class="sub">${shortDay(l.last)} · ${l.hist.length} ${plural(l.hist.length, "раз", "раза", "раз")}</div></div>${spark(l.hist)}<div class="best">${fmt(l.best.v, 1)} кг${l.best.r ? ` × ${l.best.r}` : ""}</div></li>`).join("")}</ul>`
      : `<p class="hint">Отмечай выполненные подходы с весом — здесь появятся лучшие результаты по каждому упражнению.</p>`}
  </section>`;
}
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

/* ---------- profile ---------- */
const PRESETS = { mass: ["Набор массы", 35, 2, 1], keep: ["Поддержание", 31, 1.8, 1], cut: ["Сушка", 26, 2.2, 0.8] };
const presetOf = p => Object.keys(PRESETS).find(k => { const [, kc, pr, ft] = PRESETS[k], w = +p.weight_kg; return w && p.goal_mode !== "percent" && +p.kcal === Math.round(w * kc / 50) * 50 && +p.protein === pr && +p.fat === ft; });
function profileView() {
  const p = S.profile, g = goals(), perkg = p.goal_mode !== "percent", th = getTheme(), pre = presetOf(p);
  return `
    <section class="hero"><div class="kicker">Профиль</div><h1>${esc(p.name || "Без имени")}</h1><p class="muted">${esc(S.user.email)}</p></section>
    <section class="block card pf">
      <h2>Обо мне</h2>
      <div class="grid2 pf-fields">
        <label class="field"><span>Имя</span><input class="inp" data-field="p-name" value="${esc(p.name)}" maxlength="40"></label>
        <label class="field"><span>Вес, кг</span><input class="inp" data-field="p-weight_kg" inputmode="decimal" value="${p.weight_kg ?? ""}" placeholder="например, 78"></label>
      </div>
    </section>
    <section class="block card pf">
      <h2>Цель по питанию</h2>
      <p class="hint">Выбери цель — калории и белок посчитаются от твоего веса.</p>
      <div class="presets">${Object.entries(PRESETS).map(([k, [l]]) => `<button data-act="preset" data-v="${k}" aria-pressed="${pre === k}">${l}</button>`).join("")}</div>
      <div class="macro-row" id="goals-out">${goalsLine(g)}</div>
      <details class="fold"><summary>Настроить вручную</summary>
        <div class="manual">
          <label class="field"><span>Калорий в день</span><input class="inp" data-field="p-kcal" inputmode="numeric" value="${p.kcal ?? ""}"></label>
          <div class="seg full" role="radiogroup" aria-label="Как задать белки и жиры">
            <button role="radio" data-act="goal-mode" data-v="perkg" aria-checked="${perkg}">г на кг веса</button>
            <button role="radio" data-act="goal-mode" data-v="percent" aria-checked="${!perkg}">% калорий</button>
          </div>
          <div class="grid2">
            <label class="field"><span>Белки, ${perkg ? "г на кг" : "%"}</span><input class="inp" data-field="p-protein" inputmode="decimal" value="${p.protein ?? ""}"></label>
            <label class="field"><span>Жиры, ${perkg ? "г на кг" : "%"}</span><input class="inp" data-field="p-fat" inputmode="decimal" value="${p.fat ?? ""}"></label>
          </div>
          <p class="hint">Углеводы — всё, что остаётся от калорий.</p>
        </div>
      </details>
    </section>
    <section class="block card pf">
      <h2>Тема</h2>
      <div class="seg full" role="radiogroup" aria-label="Тема">${[["system", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([k, l]) => `<button role="radio" data-act="theme" data-v="${k}" aria-checked="${th === k}">${l}</button>`).join("")}</div>
    </section>
    <details class="block card pf fold"><summary>Мои продукты <span class="muted">${S.foods.length || ""}</span></summary>
      ${S.foods.length ? `<ul class="list">${S.foods.map(x => `<li data-food="${x.id}"><div class="main"><b>${esc(x.name)}</b><span class="sub">на 100 г: ${fmt(x.kcal)} ккал · Б ${fmt(x.protein, 1)} · Ж ${fmt(x.fat, 1)} · У ${fmt(x.carb, 1)}</span></div><button class="icon-btn bare del" data-act="food-del" aria-label="Удалить продукт">${I.trash}</button></li>`).join("")}</ul>`
        : `<p class="hint">Продукты запоминаются сами, когда добавляешь еду.</p>`}
    </details>
    <details class="block card pf fold"><summary>Шаблоны тренировок <span class="muted">${S.templates.length || ""}</span></summary>
      ${S.templates.length ? `<ul class="list">${S.templates.map(t => `<li data-tpl="${t.id}"><div class="main"><b>${esc(t.title)}</b><span class="sub">${t.exercises.map(e => esc(e.name)).join(", ")}</span></div><button class="icon-btn bare del" data-act="tpl-del" aria-label="Удалить шаблон">${I.trash}</button></li>`).join("")}</ul>`
        : `<p class="hint">Сохраняются из тренировки: кнопка «Ещё» → «Сохранить как шаблон».</p>`}
    </details>
    <section class="block" style="margin-bottom:12px"><div><button class="btn quiet" data-act="logout">Выйти из аккаунта</button></div></section>`;
}
const goalsLine = g => [["Калории", fmt(g.kcal), "ккал"], ["Белки", fmt(g.P), "г"], ["Жиры", fmt(g.F), "г"], ["Углеводы", fmt(g.C), "г"]].map(([k, v, u]) => `<div><span>${k}</span><b class="mono">${v}</b><small>${u}</small></div>`).join("");
const saveProfile = () => later("profile", () => { const { user_id, updated_at, ...rest } = S.profile; q(sb.from("gym_profile").update({ ...rest, updated_at: new Date().toISOString() }).eq("user_id", S.user.id)); });

/* ---------- events ---------- */
document.addEventListener("click", ev => {
  const home = ev.target.closest('a[href="#/"]');
  if (home && S.user) {
    S.day = today(); S.moving = null; S.open.clear();
    if (!location.hash || location.hash === "#/") { ev.preventDefault(); render(); scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  const b = ev.target.closest("[data-act]"); if (!b || b.closest(".sheet")) return;
  run(b, b.dataset.act);
});
async function run(b, act) {
  if (["ex-done", "ex-open", "ex-photo", "ex-info", "set-done", "set-add", "set-del", "ex-del", "ex-rename"].includes(act)) return exAction(b, act);
  const w = workoutOn(S.day);
  switch (act) {
    case "pick-day": S.day = b.dataset.day; rerender(); break;
    case "shift": { const n = +b.dataset.n;
      if (getCalMode() === "month") { const d0 = parse(S.day), d = new Date(d0.getFullYear(), d0.getMonth() + n, 1); S.day = iso(d).slice(0, 7) === today().slice(0, 7) ? today() : iso(d); }
      else S.day = addDays(S.day, n * 7);
      rerender(); break; }
    case "cal-mode": try { localStorage.setItem("gym-cal", b.dataset.v); } catch {} rerender(); break;
    case "per": try { localStorage.setItem("gym-per", b.dataset.v); } catch {} rerender(); break;
    case "go-food": S.foodDay = S.day; location.hash = "#/food"; break;
    case "sleep": {
      const d = S.day; let row = S.days.find(x => x.day === d);
      if (!row) { row = { day: d, sleep_h: null }; S.days.push(row); }
      row.sleep_h = Math.min(14, Math.max(0, row.sleep_h != null ? +row.sleep_h + +b.dataset.n : 7.5));
      b.closest(".tile").querySelector(".t-v b").textContent = fmt(row.sleep_h, 1);
      later("sleep" + d, () => q(sb.from("gym_days").upsert({ day: d, sleep_h: row.sleep_h })), 500); break;
    }
    case "coach": coachSheet(); break;
    case "finish": case "unfinish": {
      const on = act === "finish", list = exercisesOf(w.id);
      for (const e of list) { e.done = on; e.sets = (e.sets || []).map(x => ({ ...x, done: on })); saveEx(e); }
      S.open.clear(); rerender();
      if (on) { document.querySelector(".hero-card")?.classList.add("celebrate"); scrollTo({ top: Math.max(0, document.querySelector(".hero-card").getBoundingClientRect().top + scrollY - 90), behavior: "smooth" }); toast("Тренировка завершена. Отличная работа"); }
      break;
    }
    case "photo": photoSheet(b.dataset.name); break;
    case "music-add": musicSheet(); break;
    case "music-del": await saveMusic(S.day, b.dataset.scope, list => list.filter(u => u !== b.dataset.u)); rerender(); break;
    case "move": S.moving = S.day; S.moveWeek = monday(S.day); rerender(); scrollTo({ top: 0, behavior: "smooth" }); break;
    case "move-week": S.moveWeek = addDays(S.moveWeek, +b.dataset.n); rerender(); break;
    case "move-cancel": S.moving = null; rerender(); break;
    case "move-to": {
      const from = S.moving, to = b.dataset.day; b.classList.add("loading");
      try { await swapDays(from, to); S.moving = null; S.day = to; rerender(); toast(`Готово: ${WD_FULL[(parse(to).getDay() + 6) % 7].toLowerCase()}, ${shortDay(to)}`); }
      catch { b.classList.remove("loading"); }
      break;
    }
    case "start": {
      b.classList.add("loading"); b.disabled = true;
      const w = await ensureWorkout().catch(() => null); if (!w) { b.classList.remove("loading"); b.disabled = false; return; }
      const first = exercisesOf(w.id)[0]; if (first) S.open.add(first.id);
      rerender(); document.getElementById("ex-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); break;
    }
    case "more": moreSheet(); break;
    case "pick-prog": {
      const pr = programById(b.dataset.v), p = S.profile; if (p.program_id === pr.id) return;
      p.program_id = pr.id; p.program_days = pr.defaultDays; p.program_start = monday(today()); p.program_moves = {};
      saveProfile(); rerender(); toast(`Программа «${pr.title}» — уже в календаре`); break;
    }
    case "prog-day": {
      const p = S.profile, pr = programById(p.program_id), v = +b.dataset.v;
      let days = [...(p.program_days?.length === pr.days ? p.program_days : pr.defaultDays)];
      if (days.includes(v)) { toast("Выберите другой день вместо этого — нажмите на свободный"); return; }
      // заменяем ближайший выбранный день, чтобы число дней не менялось
      const near = days.reduce((a, c) => Math.abs(c - v) < Math.abs(a - v) ? c : a);
      days = days.map(x => x === near ? v : x).sort((a, c) => a - c);
      p.program_days = days; p.program_moves = {}; saveProfile(); rerender(); break;
    }
    case "prog-off": {
      if (!await confirmSheet("Отключить программу?", "План пропадёт из календаря. Уже проведённые тренировки останутся.", "Отключить")) return;
      Object.assign(S.profile, { program_id: null, program_start: null, program_days: null, program_moves: {} }); saveProfile(); rerender(); break;
    }
    case "today": S.day = today(); rerender(); break;
    case "new-w": { b.classList.add("loading"); await createWorkout(S.day).catch(() => {}); rerender(); document.querySelector(".title-inp")?.focus(); break; }
    case "from-tpl": templatePicker(); break;
    case "feel": w.feeling = w.feeling === +b.dataset.v ? null : +b.dataset.v;
      b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", +x.dataset.v === w.feeling));
      q(sb.from("gym_workouts").update({ feeling: w.feeling }).eq("id", w.id)); break;
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
    case "preset": {
      const p = S.profile, w = +p.weight_kg, [label, kc, pr, ft] = PRESETS[b.dataset.v];
      if (!w) { toast("Сначала укажи свой вес"); document.querySelector('[data-field="p-weight_kg"]')?.focus(); return; }
      Object.assign(p, { goal_mode: "perkg", kcal: Math.round(w * kc / 50) * 50, protein: pr, fat: ft });
      saveProfile(); rerender(); toast(`Цель: ${label.toLowerCase()}`); break;
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
}

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
    if (k === "name") document.querySelector(".hero h1").textContent = el.value || "Без имени";
    if (k === "weight_kg" || k === "kcal" || k === "protein" || k === "fat") document.querySelectorAll("[data-act=preset]").forEach(x => x.setAttribute("aria-pressed", presetOf(S.profile) === x.dataset.v));
    saveProfile();
  }
});

document.addEventListener("submit", async ev => {
  const form = ev.target.closest("[data-form]"); if (!form) return;
  ev.preventDefault();
  if (form.dataset.form === "add-ex") {
    const name = form.name.value.trim(); if (!name) { form.name.focus(); return; }
    const hadW = !!workoutOn(S.day), w = await ensureWorkout(), list = exercisesOf(w.id);
    const prevSets = lastFor(name, S.day)?.sets;
    const sets = prevSets?.length ? prevSets.map(s => ({ w: s.w ?? null, r: s.r ?? null, done: false })) : [{ w: null, r: null, done: false }];
    const tmp = { id: uid(), workout_id: w.id, position: list.length ? list.at(-1).position + 1 : 0, name, sets, done: false };
    form.name.value = "";
    try {
      const row = await q(sb.from("gym_exercises").insert(tmp).select().single());
      S.exercises.push(row);
      if (!hadW) rerender(); else { document.getElementById("ex-list").insertAdjacentHTML("beforeend", exRow(row, list.length, S.day)); refreshDayBits(); }
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

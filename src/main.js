import { createClient } from "@supabase/supabase-js";
import "./fonts.css";
import { PROGRAMS, programById, sessionFor as programSession } from "./programs.js";
import { media, NAMES as KNOWN_NAMES } from "./exercise-media.js";
import "./style.css";

// Та же база, что у рассрочки (проект RassP); дневник живёт в своих таблицах gym_*, каждая строка видна только владельцу.
const sb = createClient("https://qgdtzpsgzlwdhlqdqwex.supabase.co", "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM", {
  auth: { persistSession: true, storageKey: "gym-auth" },
});

const app = document.getElementById("app");
const S = { user: null, profile: null, workouts: [], exercises: [], open: new Set(), day: iso(new Date()), loaded: false };

/* ---------- helpers ---------- */
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function monday(s) { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); }
const today = () => iso(new Date());
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const wdOf = s => (parse(s).getDay() + 6) % 7;
const longDay = s => { const d = parse(s); return `${WD_FULL[wdOf(s)]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const shortDay = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 0) => n == null ? "—" : Number(n).toLocaleString("ru-RU", { maximumFractionDigits: d });
const norm = s => String(s || "").trim().toLowerCase().replace(/ё/g, "е");
const uid = () => crypto.randomUUID();
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const exWord = n => plural(n, "упражнение", "упражнения", "упражнений");

const I = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
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
  const [profile, workouts, exercises] = await Promise.all([
    q(sb.from("gym_profile").select("*").maybeSingle(), { silent: true }),
    q(sb.from("gym_workouts").select("*").order("day"), { silent: true }),
    q(sb.from("gym_exercises").select("*").order("position"), { silent: true }),
  ]);
  Object.assign(S, { workouts, exercises });
  S.profile = profile || await q(sb.from("gym_profile").insert({ name: (S.user.email || "").split("@")[0] }).select().single());
  S.loaded = true;
}
const workoutOn = day => S.workouts.find(w => w.day === day);
const exercisesOf = wid => S.exercises.filter(e => e.workout_id === wid).sort((a, b) => a.position - b.position);
const dayOfWorkout = wid => S.workouts.find(w => w.id === wid)?.day;
const saveProfile = () => later("profile", () => { const { user_id, updated_at, ...rest } = S.profile; q(sb.from("gym_profile").update({ ...rest, updated_at: new Date().toISOString() }).eq("user_id", S.user.id)); });

function lastFor(name, beforeDay) {
  const n = norm(name); if (!n) return null;
  let best = null;
  for (const e of S.exercises) {
    if (norm(e.name) !== n || !e.sets?.some(s => s.w != null)) continue;
    const d = dayOfWorkout(e.workout_id);
    if (!d || d >= beforeDay) continue;
    if (!best || d > best.day) best = { day: d, sets: e.sets };
  }
  return best;
}
const setsText = sets => sets.filter(s => s.w != null).map(s => `${s.w != null ? fmt(s.w, 1) : "—"}×${s.r ?? "—"}`).join(" · ");

/* ---------- routing ---------- */
const ROUTES = [
  { path: "", label: "Календарь", icon: I.cal, view: calendarView },
  { path: "programs", label: "Программы", icon: I.book, view: programsView },
  { path: "me", label: "Профиль", icon: I.user, view: profileView },
];
const route = () => ROUTES.find(r => r.path === location.hash.replace(/^#\/?/, "")) || ROUTES[0];

function render() {
  if (!S.user) return loginView();
  const r = route();
  queueMicrotask(() => { if (S.loaded) S.fabShown = true; }); // кнопка тренера въезжает только при первом показе
  const links = () => ROUTES.map(x => `<a href="#/${x.path}" ${x === r ? 'aria-current="page"' : ""}>${x.icon}<span>${x.label}</span></a>`).join("");
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#/">Дневник<span>.</span></a><nav class="nav" aria-label="Разделы">${links()}</nav></header>
    <main class="wrap screen" id="main">${S.loaded ? r.view() : skeleton()}</main>
    <nav class="tabbar" aria-label="Разделы">${links()}</nav>
    ${S.loaded ? `<button class="coach-fab ${S.fabShown ? "" : "enter"}" data-act="coach" aria-label="Открыть тренера"><span class="orb" aria-hidden="true"></span><span>Тренер</span></button>` : ""}`;
}
function rerender() { // перерисовать экран без анимации входа и без прыжка прокрутки
  const main = document.getElementById("main"); if (!main) return render();
  main.classList.remove("screen");
  main.innerHTML = route().view();
}
function skeleton() {
  return `<div style="display:grid;gap:14px;padding-top:32px"><div class="skel" style="height:22px;width:45%"></div><div class="skel" style="height:300px"></div><div class="skel" style="height:120px"></div></div>`;
}
window.addEventListener("hashchange", () => { S.moving = null; render(); scrollTo({ top: 0 }); });

/* ---------- login ---------- */
const FN_SIGNUP = "https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-signup";
function loginView(mode = "in") {
  const up = mode === "up";
  app.innerHTML = `
    <main class="login screen">
      <div class="hero">
        <h1>Дневник<em>.</em></h1>
        <p class="lead">Календарь тренировок и готовые программы.</p>
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

// Состояние дня: rest — ничего, planned — запланировано, partial — начато, done — сделано, missed — прошло без отметок.
function dayStatus(d) {
  const w = workoutOn(d), ex = w ? exercisesOf(w.id) : [], plan = w ? null : sessionOn(d);
  const done = ex.filter(e => e.done).length;
  let st = "rest";
  if (w && ex.length && done === ex.length) st = "done";
  else if (w && done) st = "partial";
  else if (w || plan) st = d < today() ? "missed" : "planned";
  return { w, ex, plan, done, st, title: w ? (w.title || "Тренировка") : plan?.title || "" };
}

function dayCell(d, outside) {
  const s = dayStatus(d);
  const cls = ["day", "st-" + s.st, d === today() && "today", outside && "outside"].filter(Boolean).join(" ");
  const names = { done: "сделано", partial: "начато", planned: "запланировано", missed: "пропущено", rest: "" };
  return `<button class="${cls}" data-act="pick-day" data-day="${d}" ${d === S.day ? 'aria-current="true"' : ""} aria-label="${longDay(d)}${s.title ? ", " + esc(s.title) : ""}${names[s.st] ? ", " + names[s.st] : ""}">
    <span class="dn">${parse(d).getDate()}</span><span class="dt">${esc(s.title)}</span><i class="mark"></i></button>`;
}

function calendarView() {
  if (S.moving) return moveView();
  const d0 = parse(S.day), first = iso(new Date(d0.getFullYear(), d0.getMonth(), 1)), start = monday(first);
  const last = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), end = addDays(monday(last), 6);
  const cells = []; for (let d = start; d <= end; d = addDays(d, 1)) cells.push(dayCell(d, parse(d).getMonth() !== d0.getMonth()));
  return `
    <section class="cal">
      <div class="cal-top">
        <h1 class="cal-title">${MONTHS[d0.getMonth()]}${d0.getFullYear() !== new Date().getFullYear() ? ` ${d0.getFullYear()}` : ""}</h1>
        <div class="row">
          ${S.day === today() ? "" : `<button class="linkbtn" data-act="today">Сегодня</button>`}
          <button class="icon-btn bare" data-act="month" data-n="-1" aria-label="Прошлый месяц">${I.left}</button>
          <button class="icon-btn bare" data-act="month" data-n="1" aria-label="Следующий месяц">${I.right}</button>
        </div>
      </div>
      <div class="wd-row" aria-hidden="true">${WD.map(w => `<span>${w}</span>`).join("")}</div>
      <nav class="days" aria-label="Дни месяца">${cells.join("")}</nav>
      <div class="legend" aria-hidden="true"><span><i class="mark m-done"></i>сделано</span><span><i class="mark m-plan"></i>запланировано</span><span><i class="mark m-miss"></i>пропущено</span></div>
    </section>
    <section class="day-panel" id="day-panel">${dayPanel()}</section>`;
}

function moveView() {
  const from = S.moving, wk = S.moveWeek, s0 = dayStatus(from);
  const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
  return `<section class="hero">
    <h1>Куда перенести «${esc(s0.title)}»?</h1>
    <p class="lead">Нажми на день — тренировки поменяются местами.</p>
  </section>
  <div class="cal-top"><div class="sub-title">${shortDay(days[0])} – ${shortDay(days[6])}</div>
    <div class="row"><button class="icon-btn bare" data-act="move-week" data-n="-7" aria-label="Прошлая неделя">${I.left}</button><button class="icon-btn bare" data-act="move-week" data-n="7" aria-label="Следующая неделя">${I.right}</button></div></div>
  <div class="move-list">${days.map(d => { const s = dayStatus(d); return `<button data-act="move-to" data-day="${d}" class="${d === from ? "from" : ""}" ${d === from ? "disabled" : ""}>
    <span class="ml-d"><b>${WD[wdOf(d)]}</b><span>${parse(d).getDate()}</span></span>
    <span class="ml-t"><b>${s.title ? esc(s.title) : "Отдых"}</b><span>${d === from ? "переносим отсюда" : d === today() ? "сегодня" : ""}</span></span></button>`; }).join("")}</div>
  <div style="margin-top:20px"><button class="btn quiet" data-act="move-cancel">Отмена</button></div>`;
}

/* ---------- day ---------- */
// Предложенный вес: как в прошлый раз, и +2,5 кг, если тогда во всех подходах дошёл до верха диапазона.
function suggestSets(name, sets, reps, day) {
  const top = parseInt(String(reps).split("–").pop()) || null, low = parseInt(reps) || null;
  const last = lastFor(name, day);
  const ws = (last?.sets || []).map(s => +s.w).filter(Boolean), lw = ws.length ? Math.max(...ws) : null;
  const hit = !!(last && top && last.sets.length && last.sets.every(s => (+s.r || 0) >= top));
  return Array.from({ length: sets }, () => ({ w: lw ? (hit ? lw + 2.5 : lw) : null, r: low, done: false }));
}
const planItems = (p, day) => p.ex.map(e => ({ name: e.name, plan: `${e.sets} × ${e.reps}`, sets: suggestSets(e.name, e.sets, e.reps, day) }));
const tipFor = name => sessionOn(S.day)?.ex.find(e => norm(e.name) === norm(name))?.tip || "";

function thumb(name, act) {
  const m = media(name);
  return `<button class="ex-thumb" data-act="${act}" aria-label="Как делать: ${esc(name)}">${m ? `<img src="${m.img}" alt="" loading="lazy" decoding="async">` : esc((name || "?").trim()[0] || "?")}</button>`;
}

// Строка упражнения. it — настоящее упражнение или пункт плана ещё не начатой тренировки (isPlan).
function exRow(it, i, d) {
  const sets = it.sets || [], open = !it.isPlan && S.open.has(it.id);
  const w0 = sets.find(s => s.w != null)?.w, last = it.isPlan ? null : lastFor(it.name, d);
  const meta = [
    it.isPlan ? esc(it.plan) : sets.length ? `${sets.length} × ${sets[0].r ?? "—"}` : "",
    w0 != null ? `${fmt(w0, 1)} кг` : "",
  ].filter(Boolean).join(" · ");
  return `<li class="ex ${it.done ? "done" : ""} ${open ? "open" : ""}" ${it.isPlan ? `data-plan="${i}"` : `data-ex="${it.id}"`} data-name="${esc(it.name)}">
    <div class="ex-row">
      ${thumb(it.name, it.isPlan ? "ex-info" : "ex-photo")}
      <button class="ex-main" data-act="${it.isPlan ? "ex-info" : "ex-open"}" ${it.isPlan ? "" : `aria-expanded="${open}"`}>
        <span class="ex-title">${esc(it.name || "Без названия")}</span>
        <span class="ex-meta">${meta}</span>
        ${last && setsText(last.sets) && !open ? `<span class="ex-prev">В прошлый раз: ${esc(setsText(last.sets))}</span>` : ""}
      </button>
      ${it.isPlan ? "" : `<button class="check" data-act="ex-done" aria-pressed="${!!it.done}" aria-label="Выполнено: ${esc(it.name)}"><i>${I.check}</i></button>`}
    </div>
    ${open ? exBody(it, last) : ""}
  </li>`;
}
function exBody(e, last) {
  const tip = tipFor(e.name);
  return `<div class="ex-body">
    ${tip ? `<p class="ex-tip">${esc(tip)}</p>` : ""}
    ${last && setsText(last.sets) ? `<p class="ex-tip">В прошлый раз, ${shortDay(last.day)}: ${esc(setsText(last.sets))}</p>` : ""}
    <div class="sets">${(e.sets || []).map((s, i) => `
      <div class="set ${s.done ? "done" : ""}" data-i="${i}">
        <span class="n">${i + 1}</span>
        <label><input inputmode="decimal" data-field="set-w" value="${s.w ?? ""}" placeholder="—" aria-label="Вес, кг">кг</label>
        <label><input inputmode="numeric" data-field="set-r" value="${s.r ?? ""}" placeholder="—" aria-label="Повторы">раз</label>
        <button class="check sm" data-act="set-done" aria-pressed="${!!s.done}" aria-label="Подход ${i + 1} выполнен"><i>${I.check}</i></button>
        <button class="set-del" data-act="set-del" aria-label="Удалить подход">${I.x}</button>
      </div>`).join("")}
    </div>
    <div class="ex-foot">
      <span class="row" style="gap:16px"><button class="linkbtn" data-act="set-add">+ Подход</button><button class="linkbtn muted-link" data-act="ex-photo">История</button></span>
      <button class="linkbtn muted-link" data-act="ex-del">Удалить упражнение</button>
    </div>
  </div>`;
}

function addForm() {
  const names = [...new Set([...S.exercises.map(e => e.name.trim()), ...PROGRAMS.flatMap(pr => [...(pr.sessions || []), ...(pr.sessionsFor ? pr.sessionsFor(1) : [])].flatMap(s => s.ex.flatMap(e => e.n)))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  return `<form class="add-ex" data-form="add-ex">
    <input class="inp" name="name" list="ex-names" placeholder="Добавить упражнение" autocomplete="off" maxlength="80" aria-label="Новое упражнение">
    <datalist id="ex-names">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <button class="btn ghost" type="submit" aria-label="Добавить">${I.plus}</button>
  </form>`;
}

function dayPanel() {
  const d = S.day, s = dayStatus(d);
  const head = `<div class="eyebrow">${longDay(d)}${d === today() ? " · сегодня" : ""}</div>`;
  if (!s.w && !s.plan) return `${head}
    <h2 class="day-title muted-title">Нет тренировки</h2>
    <div class="row actions">
      <button class="btn" data-act="new-w">${I.plus}Записать тренировку</button>
      <button class="btn quiet" data-act="from-example">${S.workouts.some(w => w.day < d) ? "Повторить или взять из программ" : "Взять из программ"}</button>
    </div>
`;
  if (!s.w) {
    const items = s.plan.ex.map(e => ({ isPlan: true, name: e.name, plan: `${e.sets} × ${e.reps}` }));
    return `${head}
      <h2 class="day-title">${esc(s.plan.title)}</h2>
      <p class="day-sub">${progLine(d)}</p>
      <ol class="ex-list">${items.map((e, i) => exRow(e, i, d)).join("")}</ol>
      <div class="row actions">
        <button class="btn" data-act="start">${d < today() ? "Отметить как сделанную" : "Начать тренировку"}</button>
      </div>
      <div class="row links"><button class="linkbtn muted-link" data-act="move">Перенести на другой день</button><button class="linkbtn muted-link" data-act="skip">Убрать с этого дня</button></div>`;
  }
  return `${head}
    <input class="day-title title-inp" data-field="w-title" value="${esc(s.w.title)}" placeholder="Название тренировки" aria-label="Название тренировки" maxlength="80">
    <p class="day-sub"><span id="day-sub">${subLine(s)}</span>${sessionOn(d) ? ` · ${progLine(d)}` : ""}</p>
    <ol class="ex-list" id="ex-list">${s.ex.map((e, i) => exRow(e, i, d)).join("")}</ol>
    ${addForm()}
    ${s.ex.length && s.done < s.ex.length ? `<div class="row actions"><button class="btn" data-act="finish">${I.check}Отметить всё</button></div>` : ""}
    <div class="row links"><button class="linkbtn muted-link" data-act="move">Перенести на другой день</button><button class="linkbtn muted-link" data-act="del-w">Удалить тренировку</button></div>`;
}
// «Джей Катлер · неделя 3 из 12 · тяжёлая неделя, отдых 3–4 мин»
function progLine(d) {
  const p = sessionOn(d); if (!p) return "";
  const parts = [esc(p.prog.title), `неделя ${p.week}${p.prog.length ? ` из ${p.prog.length}` : ""}`];
  if (p.prog.length) parts.push(esc(p.focus.toLowerCase().replace(" · ", ", ")));
  return parts.join(" · ");
}
const subLine = s => !s.ex.length ? "Добавь упражнения ниже" : s.done === s.ex.length ? "Сделано" : `Сделано ${s.done} из ${s.ex.length}`;

function refreshDayBits() { // подпись и отметка дня — без перерисовки полей ввода
  const s = dayStatus(S.day);
  const sub = document.getElementById("day-sub"); if (sub) sub.textContent = subLine(s);
  const cell = document.querySelector(`.day[data-day="${S.day}"]`);
  if (cell) { const tmp = document.createElement("div"); tmp.innerHTML = dayCell(S.day, cell.classList.contains("outside")); cell.replaceWith(tmp.firstElementChild); }
}
function replaceRow(e) {
  const li = document.querySelector(`[data-ex="${e.id}"]`);
  if (li) li.outerHTML = exRow(e, 0, S.day);
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
// Тренировка дня по плану создаётся в момент «Начать» или первого добавленного упражнения.
let creating = null;
function ensureWorkout() {
  const w = workoutOn(S.day); if (w) return Promise.resolve(w);
  if (creating) return creating;
  const p = sessionOn(S.day);
  creating = createWorkout(S.day, p?.title || "", p ? planItems(p, S.day) : []).finally(() => { creating = null; });
  return creating;
}

async function exAction(b, act) {
  const li = b.closest("[data-ex],[data-plan]"); if (!li) return;
  if (act === "ex-info" || act === "ex-photo") return photoSheet(li.dataset.name);
  const e = S.exercises.find(x => x.id === li.dataset.ex); if (!e) return;
  switch (act) {
    case "ex-open": S.open.has(e.id) ? S.open.delete(e.id) : S.open.add(e.id); return replaceRow(e);
    case "ex-done": e.done = !e.done; e.sets = (e.sets || []).map(s => ({ ...s, done: e.done })); if (e.done) S.open.delete(e.id); replaceRow(e); return saveEx(e);
    case "set-done": { const i = +b.closest(".set").dataset.i; e.sets[i].done = !e.sets[i].done; e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e); if (e.sets[i].done) restTimer(); return saveEx(e); }
    case "set-add": { const ls = e.sets.at(-1) || {}; e.sets.push({ w: ls.w ?? null, r: ls.r ?? null, done: false }); e.done = false; replaceRow(e); saveEx(e);
      return document.querySelector(`[data-ex="${e.id}"] .set:last-child input`)?.focus(); }
    case "set-del": { const i = +b.closest(".set").dataset.i; e.sets.splice(i, 1); e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e); return saveEx(e); }
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
      ${p ? `<div><dt>По плану</dt><dd>${p.sets} × ${p.reps}</dd></div>` : ""}
      ${m ? `<div><dt>Мышцы</dt><dd>${esc(m.group)}</dd></div>` : ""}
      ${last && setsText(last.sets) ? `<div><dt>В прошлый раз</dt><dd>${shortDay(last.day)}: ${esc(setsText(last.sets))}</dd></div>` : ""}
      ${p?.tip ? `<div><dt>Совет</dt><dd>${esc(p.tip)}</dd></div>` : ""}
    </dl>
    ${historyHTML(name)}`);
}

// История упражнения: все прошлые записи, лучший вес по дням — тонкой линией.
function historyOf(name) {
  const n = norm(name), out = [];
  for (const e of S.exercises) {
    const sets = (e.sets || []).filter(x => (x.done || e.done) && x.w != null); // только сделанные подходы с весом
    if (norm(e.name) !== n || !sets.length) continue;
    const d = dayOfWorkout(e.workout_id); if (d && d <= today()) out.push({ day: d, sets });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}
function historyHTML(name) {
  const h = historyOf(name);
  if (!h.length) return `<p class="hint">Истории пока нет — она появится, когда отметишь подходы с весом.</p>`;
  const pts = h.map(x => ({ day: x.day, w: Math.max(0, ...x.sets.map(s => +s.w || 0)) })).filter(x => x.w).reverse().slice(-12);
  let chart = "";
  if (pts.length >= 2) {
    const lo = Math.min(...pts.map(x => x.w)), hi = Math.max(...pts.map(x => x.w)), W = 300, H = 56, pad = 6;
    const xy = pts.map((x, i) => [pad + i * (W - 2 * pad) / (pts.length - 1), hi === lo ? H / 2 : H - pad - (x.w - lo) / (hi - lo) * (H - 2 * pad)]);
    chart = `<div class="hist-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${xy.map(p => p.join(",")).join(" ")}"/>${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5"/>`).join("")}</svg>
      <div class="hist-ends"><span>${shortDay(pts[0].day)}: ${fmt(pts[0].w, 1)} кг</span><span>${shortDay(pts.at(-1).day)}: ${fmt(pts.at(-1).w, 1)} кг</span></div></div>`;
  }
  return `<div class="hist"><div class="eyebrow">История</div>${chart}
    <ul class="hist-list">${h.slice(0, 8).map(x => `<li><span>${shortDay(x.day)}</span><span class="mono">${esc(setsText(x.sets))}</span></li>`).join("")}</ul></div>`;
}

// Таймер отдыха: тихая строка над нижним меню после отметки подхода.
let restT = null;
function restTimer(sec = 90) {
  clearInterval(restT);
  let el = document.getElementById("rest");
  if (!el) {
    el = document.createElement("div"); el.id = "rest"; el.className = "rest"; el.setAttribute("role", "timer");
    el.innerHTML = `<span class="rest-t">Отдых <b class="mono"></b></span><button type="button" data-r="30">+30 с</button><button type="button" data-r="x">Хватит</button>`;
    el.onclick = ev => { const b = ev.target.closest("[data-r]"); if (!b) return; if (b.dataset.r === "x") stop(); else { end += 30000; tick(); } };
    document.body.append(el); requestAnimationFrame(() => el.classList.add("on"));
  }
  let end = Date.now() + sec * 1000;
  const stop = () => { clearInterval(restT); el.classList.remove("on"); setTimeout(() => el.remove(), 300); };
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.querySelector("b").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    if (!left) { clearInterval(restT); el.querySelector(".rest-t").textContent = "Отдых окончен — следующий подход"; navigator.vibrate?.(200); setTimeout(stop, 4000); }
  };
  el.querySelector(".rest-t").innerHTML = `Отдых <b class="mono"></b>`;
  tick(); restT = setInterval(tick, 1000);
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
function setRest(day) { // день программы становится отдыхом
  const p = S.profile; p.program_moves = { ...(p.program_moves || {}), [day]: null }; saveProfile();
}

// Одна тренировка из программ — на выбранный день.
const sessionsOf = pr => pr.sessionsFor ? pr.sessionsFor(0) : pr.sessions;
function examplePicker() {
  const seen = new Set(), past = [...S.workouts].filter(w => w.day < S.day && exercisesOf(w.id).length).sort((a, b) => b.day.localeCompare(a.day))
    .filter(w => { const k = norm(w.title) || w.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
  const pastHTML = past.length ? `<div class="eyebrow">Повторить прошлую</div><div class="pick">${past.map(w => `<button data-copy="${w.id}"><b>${esc(w.title || "Тренировка")}</b><span>${shortDay(w.day)} · ${esc(exercisesOf(w.id).map(e => e.name).join(", "))}</span></button>`).join("")}</div>` : "";
  const groups = pastHTML + PROGRAMS.map(pr => `<div class="eyebrow">${esc(pr.title)}</div><div class="pick">${sessionsOf(pr).map((s, i) => `<button data-prog="${pr.id}" data-i="${i}"><b>${esc(s.title)}</b><span>${s.ex.length} ${exWord(s.ex.length)}: ${esc(s.ex.slice(0, 3).map(e => e.n[0]).join(", "))}…</span></button>`).join("")}</div>`).join("");
  sheet("Что записать на этот день", `<div class="pick-groups">${groups}</div>`, (el, close) => {
    el.addEventListener("click", async ev => {
      const c = ev.target.closest("[data-copy]");
      if (c) { // те же упражнения и веса, отметки сброшены
        c.disabled = true; const src = S.workouts.find(x => x.id === c.dataset.copy);
        try { await createWorkout(S.day, src.title, exercisesOf(src.id).map(e => ({ name: e.name, plan: e.plan, sets: e.sets }))); close(); rerender(); } catch { c.disabled = false; }
        return;
      }
      const b = ev.target.closest("[data-prog]"); if (!b) return;
      b.disabled = true;
      const s = sessionsOf(programById(b.dataset.prog))[+b.dataset.i];
      const items = s.ex.map(e => ({ name: e.n[0], plan: `${e.s} × ${e.r}`, sets: suggestSets(e.n[0], e.s, e.r, S.day) }));
      try { await createWorkout(S.day, s.title, items); close(); rerender(); } catch { b.disabled = false; }
    });
  });
}

/* ---------- coach ---------- */
// Тренер только читает дневник и советует — календарь сам не меняет.
const FN_COACH = "https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-coach";
const coachKey = d => `gym-coach2-${S.user?.id}-${d}`;
const coachCached = d => { try { return JSON.parse(localStorage.getItem(coachKey(d)) || "null"); } catch { return null; } };
function planForCoach(d) {
  const w = workoutOn(d), p = sessionOn(d);
  if (w) return { title: w.title, ex: exercisesOf(w.id).map(e => ({ name: e.name, plan: e.plan, sets: e.sets })) };
  return p ? { title: p.title, ex: p.ex.map(e => ({ name: e.name, sets: e.sets, reps: e.reps })) } : null;
}
async function askCoach(question, history = []) {
  const { data } = await sb.auth.getSession();
  const prog = programById(S.profile?.program_id);
  const r = await fetch(FN_COACH, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({
      question, history, today: question ? today() : S.day,
      plan: question ? (planForCoach(S.day) ? { day: S.day, ...planForCoach(S.day) } : null) : planForCoach(S.day),
      program: prog ? { title: prog.title, since: S.profile.program_start } : null,
      ...(question ? { calendar: calendarForCoach(), known: KNOWN_NAMES } : {}),
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || "failed");
  return out;
}
// Что стоит в календаре на 4 недели вперёд — чтобы тренер видел, что уже запланировано.
function calendarForCoach() {
  const out = [];
  for (let i = 0; i < 28; i++) { const d = addDays(today(), i), s = dayStatus(d); if (s.st !== "rest") out.push({ day: d, st: s.st, title: s.title }); }
  return out;
}

// Действия тренера сразу меняют календарь; всё запоминается, чтобы одной кнопкой вернуть как было.
const started = w => exercisesOf(w.id).some(e => e.done || e.sets?.some(x => x.done));
const coachItems = list => list.map(e => ({ name: e.name, plan: `${e.sets} × ${e.reps || "—"}`, sets: Array.from({ length: e.sets }, () => ({ w: e.weight ?? lastWeight(e.name), r: parseInt(e.reps) || null })) }));
const lastWeight = name => { const l = lastFor(name, "9999-12-31"); const ws = (l?.sets || []).map(x => +x.w).filter(Boolean); return ws.length ? Math.max(...ws) : null; };
async function applyActions(actions) {
  const undo = { created: [], removed: [], profile: null }, p = S.profile;
  const keepProfile = () => { undo.profile ||= { program_id: p.program_id, program_start: p.program_start, program_days: p.program_days, program_moves: { ...(p.program_moves || {}) } }; };
  const clearDay = async d => { // убрать то, что ещё не начато; начатое и сделанное не трогаем
    const w = workoutOn(d);
    if (w) {
      if (started(w)) return false;
      undo.removed.push({ day: w.day, title: w.title, items: exercisesOf(w.id).map(e => ({ name: e.name, plan: e.plan, sets: e.sets })) });
      await q(sb.from("gym_workouts").delete().eq("id", w.id));
      S.workouts = S.workouts.filter(x => x !== w); S.exercises = S.exercises.filter(x => x.workout_id !== w.id);
    }
    if (sessionOn(d)) { keepProfile(); setRest(d); }
    return true;
  };
  const put = async (d, title, list) => { if (d < today() || !await clearDay(d)) return; undo.created.push((await createWorkout(d, title, coachItems(list))).id); };
  for (const a of actions) {
    if (a.type === "plan") {
      if (p.program_id) { keepProfile(); Object.assign(p, { program_id: null, program_start: null, program_days: null, program_moves: {} }); saveProfile(); }
      const m0 = monday(a.start);
      for (let k = 0; k < a.weeks; k++) for (const day of a.days) { const d = addDays(m0, k * 7 + day.wd); if (d >= a.start) await put(d, day.title, day.exercises); }
    } else if (a.type === "create") await put(a.day, a.title, a.exercises);
    else if (a.type === "delete" && a.day >= today()) await clearDay(a.day);
  }
  return undo;
}
async function undoActions(undo) {
  if (undo.created.length) await q(sb.from("gym_workouts").delete().in("id", undo.created));
  S.workouts = S.workouts.filter(w => !undo.created.includes(w.id)); S.exercises = S.exercises.filter(e => !undo.created.includes(e.workout_id));
  for (const r of undo.removed) await createWorkout(r.day, r.title, r.items);
  if (undo.profile) { Object.assign(S.profile, undo.profile); saveProfile(); }
}
const actionsSummary = (undo, actions) => {
  const days = S.workouts.filter(w => undo.created.includes(w.id)).map(w => w.day).sort();
  if (!days.length) return actions.some(a => a.type === "delete") ? "Календарь обновлён" : "";
  return `В календаре: ${days.length} ${plural(days.length, "тренировка", "тренировки", "тренировок")}${days.length > 1 ? `, с ${shortDay(days[0])} по ${shortDay(days.at(-1))}` : `, ${shortDay(days[0])}`}`;
};

const adviceHTML = c => `${c.headline ? `<p class="co-head">${esc(c.headline)}</p>` : ""}${c.today ? `<p>${esc(c.today)}</p>` : ""}
  ${c.changes?.length ? `<ul class="co-list">${c.changes.map(x => `<li><b>${esc(x.name)}</b> — ${[x.weight != null ? `${fmt(x.weight, 1)} кг` : "", x.sets ? `${x.sets} × ${x.reps || "—"}` : x.reps ? `${esc(x.reps)} повт.` : ""].filter(Boolean).join(", ")}${x.why ? `. ${esc(x.why)}` : ""}</li>`).join("")}</ul>` : ""}
  ${c.tips?.length ? `<ul class="co-list">${c.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}${c.answer ? `<p>${esc(c.answer)}</p>` : ""}`;

// Чат живёт, пока открыта вкладка: закрытие только сворачивает его, переписка и «Отменить» остаются.
let chatEl = null;
const openChat = () => { document.body.append(chatEl); document.documentElement.classList.add("chat-open"); requestAnimationFrame(() => chatEl.classList.add("open")); };
function coachChat() {
  if (chatEl) return openChat();
  const day = S.day, cached = coachCached(day), chatKey = `gym-chat2-${S.user?.id}-${day}`;
  let msgs = []; try { msgs = JSON.parse(localStorage.getItem(chatKey) || "[]").slice(-12); } catch {}
  const chips = ["Составь мне план на 4 недели", "Какой вес поставить?", "Что я давно не тренировал?"];
  const el = document.createElement("div");
  el.className = "chat"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Тренер");
  el.innerHTML = `
    <header class="chat-head">
      <button class="icon-btn bare" data-x aria-label="Закрыть">${I.left}</button>
      <div><b>Тренер</b><span>видит твои тренировки и может расписать план</span></div>
    </header>
    <div class="chat-feed" id="co-feed"></div>
    <footer class="chat-foot">
      <div class="co-chips">${chips.map(c => `<button type="button" data-chip>${c}</button>`).join("")}</div>
      <form id="cq" class="co-input"><textarea class="inp" name="q" rows="1" placeholder="Спроси тренера…" maxlength="600"></textarea><button class="btn send" type="submit" aria-label="Отправить">${I.up}</button></form>
    </footer>`;
  chatEl = el; openChat();
  const close = () => { el.classList.remove("open"); document.documentElement.classList.remove("chat-open"); };
  el.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  el.querySelector("[data-x]").onclick = close;
  const feed = el.querySelector("#co-feed"), f = el.querySelector("#cq");
  const save = () => { try { localStorage.setItem(chatKey, JSON.stringify(msgs.slice(-12))); } catch {} };
  const bubble = (role, html) => { const d = document.createElement("div"); d.className = `co-msg ${role}`; d.innerHTML = html; feed.append(d); requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" })); return d; };
  const waitHTML = t => `<p class="co-wait"><i></i><i></i><i></i><span>${t}</span></p>`;
  const failText = e => e.message === "no_key" ? "Тренер ещё не подключён." : "Тренер не ответил — попробуй ещё раз.";

  // первым — совет на этот день
  const first = bubble("assistant", cached ? adviceHTML(cached) : waitHTML("Смотрю твои тренировки…"));
  if (!cached) askCoach("").then(c => {
    try { localStorage.setItem(coachKey(day), JSON.stringify(c)); } catch {}
    first.innerHTML = adviceHTML(c);
  }).catch(e => { first.innerHTML = `<p class="muted">${failText(e)}</p>`; });
  for (const m of msgs) bubble(m.role, `<p>${esc(m.text)}</p>`);

  const send = async text => {
    text = text.trim(); if (!text) return;
    bubble("user", `<p>${esc(text)}</p>`);
    const history = msgs.slice(-6).map(m => ({ role: m.role, content: m.text }));
    msgs.push({ role: "user", text }); save();
    const wait = bubble("assistant", waitHTML("Думаю…"));
    try {
      const out = await askCoach(text, history);
      wait.innerHTML = `<p>${esc(out.reply)}</p>`;
      msgs.push({ role: "assistant", text: out.reply }); save();
      if (out.actions?.length) {
        wait.insertAdjacentHTML("beforeend", `<div class="co-done">${waitHTML("Ставлю в календарь…")}</div>`);
        const line = wait.querySelector(".co-done");
        try {
          const undo = await applyActions(out.actions); rerender();
          line.innerHTML = `${I.check}<span>${esc(actionsSummary(undo, out.actions) || "Готово")}</span><button class="linkbtn muted-link" type="button">Отменить</button>`;
          line.querySelector("button").onclick = async ev => { ev.target.disabled = true; await undoActions(undo).catch(() => {}); rerender(); line.innerHTML = `<span class="muted">Отменено — календарь как был</span>`; };
        } catch { line.innerHTML = `<span class="muted">Не всё получилось поставить — попробуй ещё раз</span>`; rerender(); }
      }
      requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" }));
    } catch (e) { wait.innerHTML = `<p class="muted">${failText(e)}</p>`; msgs.pop(); save(); }
  };
  el.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => send(b.textContent));
  f.onsubmit = ev => { ev.preventDefault(); const v = f.q.value; f.q.value = ""; f.q.style.height = ""; send(v); };
  f.q.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } });
  f.q.addEventListener("input", () => { f.q.style.height = "auto"; f.q.style.height = Math.min(120, f.q.scrollHeight) + "px"; });
}

/* ---------- programs ---------- */
function programsView() {
  const p = S.profile, cur = programById(p.program_id);
  const card = pr => {
    const on = pr.id === p.program_id;
    const days = on && p.program_days?.length === pr.days ? p.program_days : pr.defaultDays;
    return `<article class="prog ${on ? "on" : ""}">
      <div class="prog-head">
        <h2>${esc(pr.title)}</h2>
        <p class="muted">${pr.days} ${plural(pr.days, "тренировка", "тренировки", "тренировок")} в неделю${pr.length ? ` · ${pr.length} недель` : ""}${on ? " · в календаре" : ""}</p>
      </div>
      <p>${esc(pr.about)}</p>
      <details class="fold"><summary>Посмотреть тренировки</summary>
        <div class="sessions">${sessionsOf(pr).map(s => `
          <div class="sess"><b>${esc(s.title)}</b>
            <ol class="plan-list">${s.ex.map(e => { const n = e.n[0]; return `<li><button class="pl-name" data-act="photo" data-name="${esc(n)}">${esc(n)}</button><span class="pl-sets mono">${e.s} × ${e.r}</span></li>`; }).join("")}</ol>
          </div>`).join("")}
        </div>
        ${pr.source ? `<p class="hint"><a href="${pr.source}" target="_blank" rel="noopener">Источник программы</a></p>` : ""}
      </details>
      ${on ? `<div class="prog-on">
          <p class="hint">Дни тренировок. Нажми на свободный — на него переедет ближайшая тренировка.</p>
          <div class="wd-pick" role="group" aria-label="Дни недели">${WD.map((w, i) => `<button data-act="prog-day" data-v="${i}" aria-pressed="${days.includes(i)}">${w}</button>`).join("")}</div>
          <div><button class="btn quiet" data-act="prog-off">Убрать из календаря</button></div>
        </div>`
        : `<div><button class="btn ${cur ? "quiet" : ""}" data-act="pick-prog" data-v="${pr.id}">Поставить в календарь</button></div>`}
    </article>`;
  };
  return `
    <section class="hero"><h1>Программы</h1>
      <p class="lead">Готовые схемы тренировок. Поставь программу в календарь — тренировки сами появятся на нужных днях.</p></section>
    <div class="progs">${[...PROGRAMS].sort((a, b) => (b.id === p.program_id) - (a.id === p.program_id)).map(card).join("")}</div>`;
}

/* ---------- profile ---------- */
function profileView() {
  const p = S.profile, th = getTheme();
  return `
    <section class="hero"><h1>${esc(p.name || "Профиль")}</h1><p class="muted">${esc(S.user.email)}</p></section>
    <section class="block">
      <label class="field"><span>Имя</span><input class="inp" data-field="p-name" value="${esc(p.name)}" maxlength="40"></label>
      <div class="grid2">
        <label class="field"><span>Вес, кг</span><input class="inp" data-field="p-weight_kg" inputmode="decimal" value="${p.weight_kg ?? ""}" placeholder="например, 78"></label>
        <label class="field"><span>Рост, см</span><input class="inp" data-field="p-height_cm" inputmode="decimal" value="${p.height_cm ?? ""}" placeholder="например, 180"></label>
      </div>
      <p class="hint">Тренер учитывает вес и рост, когда подбирает нагрузку.</p>
    </section>
    <section class="block">
      <div class="field"><span>Тема</span>
      <div class="seg full" role="radiogroup" aria-label="Тема">${[["system", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([k, l]) => `<button role="radio" data-act="theme" data-v="${k}" aria-checked="${th === k}">${l}</button>`).join("")}</div></div>
    </section>
    <section class="block"><div><button class="btn danger-soft" data-act="logout">Выйти из аккаунта</button></div></section>`;
}

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
  if (["ex-done", "ex-open", "ex-photo", "ex-info", "set-done", "set-add", "set-del", "ex-del"].includes(act)) return exAction(b, act);
  const w = workoutOn(S.day);
  switch (act) {
    case "pick-day": {
      const changed = S.day !== b.dataset.day; S.day = b.dataset.day; rerender();
      if (changed && innerWidth < 760) document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "month": { const d0 = parse(S.day), d = new Date(d0.getFullYear(), d0.getMonth() + +b.dataset.n, 1); S.day = iso(d).slice(0, 7) === today().slice(0, 7) ? today() : iso(d); rerender(); break; }
    case "today": S.day = today(); rerender(); break;
    case "photo": photoSheet(b.dataset.name); break;
    case "coach": coachChat(); break;
    case "start": {
      b.classList.add("loading"); b.disabled = true;
      const nw = await ensureWorkout().catch(() => null); if (!nw) { b.classList.remove("loading"); b.disabled = false; return; }
      if (S.day < today()) for (const e of exercisesOf(nw.id)) { e.done = true; e.sets = e.sets.map(s => ({ ...s, done: true })); saveEx(e); }
      else { const first = exercisesOf(nw.id)[0]; if (first) S.open.add(first.id); }
      rerender(); break;
    }
    case "finish": {
      for (const e of exercisesOf(w.id)) { e.done = true; e.sets = (e.sets || []).map(x => ({ ...x, done: true })); saveEx(e); }
      S.open.clear(); rerender(); toast("Тренировка отмечена"); break;
    }
    case "new-w": { b.classList.add("loading"); await createWorkout(S.day).catch(() => {}); rerender(); document.querySelector(".add-ex .inp")?.focus(); break; }
    case "from-example": examplePicker(); break;
    case "skip": { const d = S.day; setRest(d); rerender();
      toast("Тренировка убрана с этого дня", { label: "Вернуть", run: () => { const mv = { ...S.profile.program_moves }; delete mv[d]; S.profile.program_moves = mv; saveProfile(); rerender(); } }); break; }
    case "del-w": {
      if (!await confirmSheet("Удалить тренировку?", `«${w.title || "Тренировка"}» на ${shortDay(w.day)} и все её упражнения.`)) return;
      await q(sb.from("gym_workouts").delete().eq("id", w.id));
      S.workouts = S.workouts.filter(x => x.id !== w.id); S.exercises = S.exercises.filter(x => x.workout_id !== w.id);
      if (sessionOn(w.day)) setRest(w.day); // иначе на этом дне снова появится план программы
      rerender(); break;
    }
    case "move": S.moving = S.day; S.moveWeek = monday(S.day); rerender(); scrollTo({ top: 0, behavior: "smooth" }); break;
    case "move-week": S.moveWeek = addDays(S.moveWeek, +b.dataset.n); rerender(); break;
    case "move-cancel": S.moving = null; rerender(); break;
    case "move-to": {
      const from = S.moving, to = b.dataset.day; b.classList.add("busy");
      try { await swapDays(from, to); S.moving = null; S.day = to; rerender(); toast(`Перенесено на ${WD_FULL[wdOf(to)].toLowerCase()}, ${shortDay(to)}`); }
      catch { b.classList.remove("busy"); }
      break;
    }
    case "pick-prog": {
      const pr = programById(b.dataset.v), p = S.profile;
      if (p.program_id && !await confirmSheet("Сменить программу?", `Вместо «${programById(p.program_id).title}» в календаре будет «${pr.title}». Уже записанные тренировки останутся.`, "Сменить")) return;
      p.program_id = pr.id; p.program_days = pr.defaultDays; p.program_start = today(); p.program_moves = {};
      saveProfile(); rerender(); scrollTo({ top: 0, behavior: "smooth" }); toast(`«${pr.title}» — в календаре`); break;
    }
    case "prog-day": {
      const p = S.profile, pr = programById(p.program_id), v = +b.dataset.v;
      let days = [...(p.program_days?.length === pr.days ? p.program_days : pr.defaultDays)];
      if (days.includes(v)) { toast("Нажми на свободный день — на него переедет ближайшая тренировка"); return; }
      const near = days.reduce((a, c) => Math.abs(c - v) < Math.abs(a - v) ? c : a);
      days = days.map(x => x === near ? v : x).sort((a, c) => a - c);
      p.program_days = days; p.program_moves = {}; saveProfile(); rerender(); break;
    }
    case "prog-off": {
      if (!await confirmSheet("Убрать программу из календаря?", "Запланированные дни исчезнут. Уже записанные тренировки останутся.", "Убрать")) return;
      Object.assign(S.profile, { program_id: null, program_start: null, program_days: null, program_moves: {} }); saveProfile(); rerender(); break;
    }
    case "theme": setTheme(b.dataset.v); b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); break;
    case "logout":
      if (await confirmSheet("Выйти из аккаунта?", "Тренировки сохранены — увидишь их снова, когда войдёшь с этой почтой.", "Выйти")) await sb.auth.signOut();
      break;
  }
}

document.addEventListener("input", ev => {
  const el = ev.target, f = el.dataset?.field; if (!f) return;
  const w = workoutOn(S.day), li = el.closest("[data-ex]"), e = li && S.exercises.find(x => x.id === li.dataset.ex);
  if (f === "w-title") { w.title = el.value; refreshDayBits(); later("wt", () => q(sb.from("gym_workouts").update({ title: w.title.trim() }).eq("id", w.id))); }
  else if (f === "set-w" || f === "set-r") { const i = +el.closest(".set").dataset.i; e.sets[i][f === "set-w" ? "w" : "r"] = num(el.value); saveEx(e); }
  else if (f === "p-name") { S.profile.name = el.value; document.querySelector(".hero h1").textContent = el.value || "Профиль"; saveProfile(); }
  else if (f === "p-weight_kg" || f === "p-height_cm") { const v = num(el.value), k = f.slice(2); S.profile[k] = v != null && v > 0 && v < 400 ? v : null; saveProfile(); }
});

document.addEventListener("submit", async ev => {
  const form = ev.target.closest("[data-form]"); if (!form) return;
  ev.preventDefault();
  if (form.dataset.form === "add-ex") {
    const name = form.name.value.trim(); if (!name) { form.name.focus(); return; }
    const w = await ensureWorkout(), list = exercisesOf(w.id);
    const prevSets = lastFor(name, S.day)?.sets;
    const sets = prevSets?.length ? prevSets.map(s => ({ w: s.w ?? null, r: s.r ?? null, done: false })) : [{ w: null, r: null, done: false }];
    const tmp = { id: uid(), workout_id: w.id, position: list.length ? list.at(-1).position + 1 : 0, name, sets, done: false };
    form.name.value = "";
    try {
      const row = await q(sb.from("gym_exercises").insert(tmp).select().single());
      S.exercises.push(row); S.open.add(row.id);
      const ol = document.getElementById("ex-list");
      if (ol) { ol.insertAdjacentHTML("beforeend", exRow(row, list.length, S.day)); refreshDayBits(); } else rerender();
      document.querySelector(`[data-ex="${row.id}"] .set input`)?.focus();
    } catch { form.name.value = name; }
  }
});

/* ---------- start ---------- */
sb.auth.onAuthStateChange((event, session) => {
  const u = session?.user || null;
  if (S.started && (u?.id ?? null) === (S.user?.id ?? null)) return; // обновление токена — не перерисовываем
  S.started = true;
  S.user = u; S.loaded = false;
  chatEl?.remove(); chatEl = null; document.documentElement.classList.remove("chat-open"); // чат другого аккаунта не показываем
  render();
  if (u) loadAll().then(render).catch(() => { app.querySelector("#main").innerHTML = `<div class="hero"><p class="muted">Не получилось загрузить данные.</p><div><button class="btn" onclick="location.reload()">Обновить</button></div></div>`; });
});
// на вкладке, открытой с вечера, «сегодня» должно сдвинуться
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.loaded) { const t = today(); if (S._t && S._t !== t) { S.day = t; render(); } S._t = t; } });
S._t = today();

import { createClient } from "@supabase/supabase-js";
import "./fonts.css";
import { PROGRAMS, programById, sessionFor as programSession, weekLayout, defaultLayout } from "./programs.js";
import { media, NAMES as KNOWN_NAMES } from "./exercise-media.js";
import "./style.css";

// Та же база, что у рассрочки (проект RassP); дневник живёт в своих таблицах gym_*, каждая строка видна только владельцу.
const sb = createClient("https://qgdtzpsgzlwdhlqdqwex.supabase.co", "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM", {
  auth: { persistSession: true, storageKey: "gym-auth" },
});

const app = document.getElementById("app");
const S = { user: null, profile: null, workouts: [], exercises: [], open: new Set(), day: iso(new Date()), loaded: false, people: [], shares: [], friends: {} };

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
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 6v12a1 1 0 0 1-1.5.86L9.5 13.7a2 2 0 0 1 0-3.4l9-5.16A1 1 0 0 1 20 6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 6v12a1 1 0 0 0 1.5.86l9-5.16a2 2 0 0 0 0-3.4l-9-5.16A1 1 0 0 0 4 6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>',
  heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  volOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  repeatOne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/><path d="M11 10h1v5"/></svg>',
  back10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui" font-weight="700">10</text></svg>',
  fwd10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui" font-weight="700">10</text></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
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
  // закрывается один раз и сразу, даже если анимация открытия ещё не закончилась; закрывающаяся шторка не ловит нажатия
  const close = () => { if (!bd.isConnected || bd.dataset.closing) return; bd.dataset.closing = "1"; onClose?.(); bd.classList.remove("open"); document.removeEventListener("keydown", onKey); setTimeout(() => bd.remove(), 320); prev?.focus?.({ preventScroll: true }); };
  const onKey = e => { if (e.key === "Escape") close(); };
  bd.addEventListener("click", e => { if (bd.dataset.closing) e.stopImmediatePropagation(); }, true); // двойной тап не открывает вторую шторку
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
  // Чужие профили и тренировки тоже доступны на чтение (друзья), поэтому своё всегда берём по user_id.
  const me = S.user.id;
  const [profile, workouts, exercises, people, shares] = await Promise.all([
    q(sb.from("gym_profile").select("*").eq("user_id", me).maybeSingle(), { silent: true }),
    q(sb.from("gym_workouts").select("*").eq("user_id", me).order("day"), { silent: true }),
    q(sb.from("gym_exercises").select("*").eq("user_id", me).order("position"), { silent: true }),
    q(sb.from("gym_profile").select("user_id,name,program_id,program_start,program_days,program_week,program_moves,avatar").neq("user_id", me), { silent: true }).catch(() => []),
    q(sb.from("gym_shares").select("*").order("created_at", { ascending: false }).limit(100), { silent: true }).catch(() => []),
  ]);
  Object.assign(S, { workouts, exercises, people: people.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru")), shares, friends: {} });
  S.profile = profile || await q(sb.from("gym_profile").insert({ name: (S.user.email || "").split("@")[0] }).select().single());
  S.avatars = {}; await loadAvatars();
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
  { path: "music", label: "Музыка", icon: I.note, view: musicView },
  { path: "me", label: "Профиль", icon: I.user, view: profileView },
];
const route = () => {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("u/")) return { path: h, view: friendView, parent: ROUTES[3] }; // страница друга живёт внутри «Профиля»
  if (h === "help") return { path: h, view: helpView, parent: ROUTES[3] };
  return ROUTES.find(r => r.path === h) || ROUTES[0];
};

function render() {
  if (!S.user) return loginView();
  const r = route();
  queueMicrotask(() => { if (S.loaded) S.fabShown = true; paintBadge(); }); // кнопка тренера въезжает только при первом показе
  const links = () => ROUTES.map(x => `<a href="#/${x.path}" ${x === r || x === r.parent ? 'aria-current="page"' : ""}>${x.icon}<span>${x.label}</span></a>`).join("");
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#/">Дневник<span>.</span></a><nav class="nav" aria-label="Разделы">${links()}</nav></header>
    <main class="wrap screen" id="main">${S.loaded ? r.view() : skeleton()}</main>
    <nav class="tabbar" aria-label="Разделы">${links()}</nav>
    ${S.loaded && r.path !== "music" ? `<button class="coach-fab ${S.fabShown ? "" : "enter"}" data-act="coach" aria-label="Открыть тренера"><span class="orb" aria-hidden="true"></span><span>Тренер</span></button>` : ""}`;
}
function rerender() { // перерисовать экран без анимации входа и без прыжка прокрутки
  queueMicrotask(paintBadge);
  const main = document.getElementById("main"); if (!main) return render();
  main.classList.remove("screen");
  main.innerHTML = route().view();
}
function skeleton() {
  return `<div style="display:grid;gap:14px;padding-top:32px"><div class="skel" style="height:22px;width:45%"></div><div class="skel" style="height:300px"></div><div class="skel" style="height:120px"></div></div>`;
}
window.addEventListener("hashchange", () => { S.moving = null; S.friends = {}; S.wkSel = null; render(); scrollTo({ top: 0 }); });

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

// Вид календаря — неделя или месяц; запоминается в браузере.
const getCalView = () => { try { return localStorage.getItem("gym-cal-view") || "week"; } catch { return "week"; } };
const ST_NAMES = { done: "сделано", partial: "начато", planned: "запланировано", missed: "пропущено", rest: "" };

function weekRow(d) {
  const s = dayStatus(d), n = s.w ? s.ex.length : s.plan?.ex.length || 0;
  const sub = s.st === "rest" ? "" : s.st === "partial" ? `сделано ${s.done} из ${s.ex.length}` : [ST_NAMES[s.st], n ? `${n} ${exWord(n)}` : ""].filter(Boolean).join(" · ");
  return `<button class="wk-day st-${s.st} ${d === today() ? "today" : ""}" data-act="pick-day" data-day="${d}" ${d === S.day ? 'aria-current="true"' : ""}>
    <span class="wk-d"><b>${WD[wdOf(d)]}</b><span>${parse(d).getDate()}</span></span>
    <span class="wk-t"><b>${s.title ? esc(s.title) : "Отдых"}</b>${sub ? `<span>${sub}</span>` : ""}</span>
    <i class="mark" aria-hidden="true"></i></button>`;
}

function calendarView() {
  if (S.moving) return moveView();
  const view = getCalView(), d0 = parse(S.day);
  let title, body;
  if (view === "week") {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday(S.day), i)), a = parse(days[0]), b = parse(days[6]);
    title = a.getMonth() === b.getMonth() ? `${a.getDate()} – ${shortDay(days[6])}` : `${shortDay(days[0])} – ${shortDay(days[6])}`;
    body = `<nav class="week" aria-label="Дни недели">${days.map(weekRow).join("")}</nav>`;
  } else {
    const first = iso(new Date(d0.getFullYear(), d0.getMonth(), 1)), start = monday(first);
    const last = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), end = addDays(monday(last), 6);
    const cells = []; for (let d = start; d <= end; d = addDays(d, 1)) cells.push(dayCell(d, parse(d).getMonth() !== d0.getMonth()));
    title = `${MONTHS[d0.getMonth()]}${d0.getFullYear() !== new Date().getFullYear() ? ` ${d0.getFullYear()}` : ""}`;
    body = `<div class="wd-row" aria-hidden="true">${WD.map(w => `<span>${w}</span>`).join("")}</div>
      <nav class="days" aria-label="Дни месяца">${cells.join("")}</nav>
      <div class="legend" aria-hidden="true"><span><i class="mark m-done"></i>сделано</span><span><i class="mark m-plan"></i>запланировано</span><span><i class="mark m-miss"></i>пропущено</span></div>`;
  }
  const unit = view === "week" ? ["Прошлая неделя", "Следующая неделя"] : ["Прошлый месяц", "Следующий месяц"];
  return `${inboxHTML()}${helpHintHTML()}
    <section class="cal">
      <div class="cal-top">
        <h1 class="cal-title">${title}</h1>
        <div class="row">
          ${S.day === today() ? "" : `<button class="linkbtn" data-act="today">Сегодня</button>`}
          <button class="icon-btn bare" data-act="shift" data-n="-1" aria-label="${unit[0]}">${I.left}</button>
          <button class="icon-btn bare" data-act="shift" data-n="1" aria-label="${unit[1]}">${I.right}</button>
        </div>
      </div>
      <div class="seg cal-seg" role="radiogroup" aria-label="Вид календаря">${[["week", "Неделя"], ["month", "Месяц"]].map(([k, l]) => `<button role="radio" data-act="cal-view" data-v="${k}" aria-checked="${view === k}">${l}</button>`).join("")}</div>
      ${body}
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
  const names = [...new Set([...S.exercises.map(e => e.name.trim()), ...KNOWN_NAMES, ...PROGRAMS.flatMap(pr => [...(pr.sessions || []), ...(pr.sessionsFor ? pr.sessionsFor(1) : [])].flatMap(s => s.ex.flatMap(e => e.n)))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
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
      ${workoutMeta(s.plan.ex.map(e => ({ name: e.name, sets: e.sets })))}
      <ol class="ex-list">${items.map((e, i) => exRow(e, i, d)).join("")}</ol>
      <div class="row actions">
        <button class="btn" data-act="start">${d < today() ? "Отметить как сделанную" : "Начать тренировку"}</button>
      </div>
      <div class="row links"><button class="linkbtn muted-link" data-act="move">Перенести на другой день</button><button class="linkbtn muted-link" data-act="skip">Убрать с этого дня</button></div>`;
  }
  return `${head}
    <input class="day-title title-inp" data-field="w-title" value="${esc(s.w.title)}" placeholder="Название тренировки" aria-label="Название тренировки" maxlength="80">
    <p class="day-sub"><span id="day-sub">${subLine(s)}</span>${sessionOn(d) ? ` · ${progLine(d)}` : ""}</p>
    ${s.ex.length ? workoutMeta(s.ex.map(e => ({ name: e.name, sets: e.sets?.length || 0 }))) : ""}
    <ol class="ex-list" id="ex-list">${s.ex.map((e, i) => exRow(e, i, d)).join("")}</ol>
    ${addForm()}
    ${s.ex.length && s.done < s.ex.length ? `<div class="row actions"><button class="btn" data-act="finish">${I.check}Отметить всё</button></div>` : ""}
    <div class="row links"><button class="linkbtn muted-link" data-act="move">Перенести на другой день</button><button class="linkbtn muted-link" data-act="del-w">Удалить тренировку</button></div>`;
}
// Сводка тренировки: число упражнений, примерное время (≈2,5 мин на подход с отдыхом) и мышцы.
function workoutMeta(items) {
  const sets = items.reduce((a, e) => a + (+e.sets || 0), 0), min = Math.max(10, Math.round(sets * 2.5 / 5) * 5);
  const groups = [...new Set(items.map(e => media(e.name)?.group).filter(Boolean))];
  return `<div class="w-meta"><span class="tag">${items.length} ${exWord(items.length)}</span>${sets ? `<span class="tag">≈ ${min} мин</span>` : ""}${groups.map(g => `<span class="tag muscle">${esc(g)}</span>`).join("")}</div>`;
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
  const cell = document.querySelector(`.day[data-day="${S.day}"],.wk-day[data-day="${S.day}"]`);
  if (cell) { const tmp = document.createElement("div"); tmp.innerHTML = cell.classList.contains("wk-day") ? weekRow(S.day) : dayCell(S.day, cell.classList.contains("outside")); cell.replaceWith(tmp.firstElementChild); }
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
  const keepProfile = () => { undo.profile ||= { program_id: p.program_id, program_start: p.program_start, program_days: p.program_days, program_week: p.program_week, program_moves: { ...(p.program_moves || {}) } }; };
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
      if (p.program_id) { keepProfile(); Object.assign(p, { program_id: null, program_start: null, program_days: null, program_week: null, program_moves: {} }); saveProfile(); }
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
const chatDim = Object.assign(document.createElement("div"), { className: "chat-dim" });
const openChat = () => { document.body.append(chatDim, chatEl); chatDim.onclick = () => chatEl.querySelector("[data-x]").click(); document.documentElement.classList.add("chat-open"); requestAnimationFrame(() => chatEl.classList.add("open")); };
function coachChat() {
  if (chatEl) return openChat();
  const day = S.day, cached = coachCached(day), chatKey = `gym-chat2-${S.user?.id}-${day}`;
  let msgs = []; try { msgs = JSON.parse(localStorage.getItem(chatKey) || "[]").slice(-12); } catch {}
  const chips = ["Составь мне план на 4 недели", "Какой вес поставить?", "Что я давно не тренировал?"];
  const el = document.createElement("div");
  el.className = "chat"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Тренер");
  el.innerHTML = `
    <header class="chat-head">
      <span class="chat-ava" aria-hidden="true"><span class="orb"></span></span>
      <div><b>Тренер</b><span>видит твои тренировки, может расписать план</span></div>
      <button class="icon-btn bare" data-x aria-label="Свернуть чат">${I.x}</button>
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
  const bubble = (role, html) => { if (role === "user") el.classList.add("talked"); const d = document.createElement("div"); d.className = `co-msg ${role}`; d.innerHTML = html; feed.append(d); requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" })); return d; };
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
const STAR_ORDER = ["coleman", "cutler", "the-rock", "morning"];
function programsView() {
  const p = S.profile, cur = programById(p.program_id);
  const card = pr => {
    const on = pr.id === p.program_id;
    // четыре фото из разных тренировок программы — чтобы сразу было видно, что в ней
    const pics = [...new Set(sessionsOf(pr).flatMap(s => s.ex.map(e => media(e.n[0])?.img)).filter(Boolean))];
    const four = Array.from({ length: 4 }, (_, k) => pics[Math.floor(k * pics.length / 4)]).filter(Boolean);
    return `<article class="prog ${on ? "on" : ""}">
      ${pr.photo ? `<figure class="prog-photo ${pr.joke ? "joke" : ""}" ${pr.joke ? `data-act="storm" data-id="${pr.id}"` : ""}>${photoSrc(pr) ? `<img src="${photoSrc(pr)}" alt="${esc(pr.photo.caption)}" loading="lazy" decoding="async" style="object-position:${pr.photo.pos || "30% 22%"}">` : ""}
          <figcaption><b>${esc(pr.photo.caption)}</b>${pr.photo.credit ? `<a href="${pr.photo.link}" target="_blank" rel="noopener">${esc(pr.photo.credit)}</a>` : ""}</figcaption></figure>`
        : `<div class="prog-pics" aria-hidden="true">${four.map(src => `<img src="${src}" alt="" loading="lazy" decoding="async">`).join("")}</div>`}
      <div class="prog-head">
        <h2>${esc(pr.title)}</h2>
        <div class="tags">${on ? `<span class="tag on">${I.check}в календаре</span>` : ""}<span class="tag">${pr.days} ${plural(pr.days, "раз", "раза", "раз")} в неделю</span><span class="tag">${{ дом: "дома", везде: "где угодно" }[pr.place] || "в зале"}</span>${pr.length ? `<span class="tag">${pr.length} недель</span>` : ""}</div>
      </div>
      <p>${esc(pr.about)}</p>
      <details class="fold" ${pr.joke ? `data-storm="${pr.id}"` : ""}><summary>Посмотреть тренировки</summary>
        <div class="sessions">${sessionsOf(pr).map((s, k) => `
          <section class="sess">
            <header class="sess-head"><span class="sess-n mono">${k + 1}</span><div><b>${esc(s.title)}</b>${s.focus ? `<span>${esc(s.focus)}</span>` : ""}</div></header>
            <ol class="sess-list">${s.ex.map(e => { const n = e.n[0], m = media(n); return `<li><button class="sx" data-act="photo" data-name="${esc(n)}">
              <span class="sx-img">${m ? `<img src="${m.img}" alt="" loading="lazy" decoding="async">` : ""}</span>
              <span class="sx-name">${esc(n)}</span>
              <span class="sx-sets mono">${e.s}×${esc(e.r)}</span></button></li>`; }).join("")}</ol>
          </section>`).join("")}
        </div>
        ${pr.source ? `<p class="hint"><a href="${pr.source}" target="_blank" rel="noopener">Источник программы</a></p>` : ""}
      </details>
      ${pr.diet ? dietHTML(pr) : ""}
      ${on ? `<div class="prog-on">
          ${weekBoard(pr)}
          <div><button class="btn quiet" data-act="prog-off">Убрать из календаря</button></div>
        </div>`
        : `<div><button class="btn ${cur ? "quiet" : ""}" data-act="pick-prog" data-v="${pr.id}">Поставить в календарь</button></div>`}
    </article>`;
  };
  const where = S.progWhere || "all";
  const list = [...PROGRAMS].filter(pr => where === "all" || pr.id === p.program_id || (where === "home") === (pr.place === "дом"))
    // сначала программы звёзд (Коулман, Катлер, Скала), внутри групп — та, что стоит в календаре
    .sort((a, b) => (!!b.photo - !!a.photo) || (b.id === p.program_id) - (a.id === p.program_id) || STAR_ORDER.indexOf(a.id) - STAR_ORDER.indexOf(b.id));
  return `
    <section class="hero"><h1>Программы</h1>
      <p class="lead">Готовые схемы тренировок. Поставь программу в календарь — тренировки сами появятся на нужных днях.</p>
      <div class="seg" role="radiogroup" aria-label="Где тренируешься">${[["all", "Все"], ["gym", "В зале"], ["home", "Дома"]].map(([k, l]) => `<button role="radio" data-act="prog-where" data-v="${k}" aria-checked="${where === k}">${l}</button>`).join("")}</div></section>
    <div class="progs">${list.map(card).join("")}</div>`;
}

/* ---------- avatars ---------- */
// Фото профиля лежат в закрытом хранилище gym-avatars; ссылки подписываются пачкой на 6 часов.
S.avatars = {};
async function loadAvatars() {
  const all = [S.profile, ...S.people].filter(u => u?.avatar);
  if (!all.length) return;
  const { data } = await sb.storage.from("gym-avatars").createSignedUrls(all.map(u => u.avatar), 6 * 3600).catch(() => ({ data: [] }));
  for (const d of data || []) { const u = all.find(x => x.avatar === d.path); if (u && d.signedUrl) S.avatars[u.user_id] = d.signedUrl; }
}
const avatarHTML = (uid, name, cls = "") => S.avatars[uid]
  ? `<span class="me-ava ${cls} has-img" aria-hidden="true"><img src="${S.avatars[uid]}" alt="" decoding="async"></span>`
  : `<span class="me-ava ${cls}" aria-hidden="true">${esc(initial(name))}</span>`;
// Квадрат 512×512 по центру, JPEG — чтобы фото весило ~50 КБ, а не мегабайты с телефона.
function squareJpeg(file, size = 512) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.naturalWidth - k) / 2, (img.naturalHeight - k) / 2, k, k, 0, 0, size, size);
      URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error("blob")), "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
async function uploadAvatar(file) {
  if (!file || !/^image\//.test(file.type)) return toast("Нужна картинка");
  const box = document.querySelector(".ava-edit"); box?.classList.add("busy");
  try {
    const blob = await squareJpeg(file), path = `${S.user.id}/${Date.now().toString(36)}.jpg`, old = S.profile.avatar;
    const { error } = await sb.storage.from("gym-avatars").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    await q(sb.from("gym_profile").update({ avatar: path }).eq("user_id", S.user.id));
    if (old) sb.storage.from("gym-avatars").remove([old]);
    S.profile.avatar = path; S.avatars[S.user.id] = URL.createObjectURL(blob);
    rerender(); toast("Фото обновлено");
  } catch (e) { console.error(e); toast("Не получилось загрузить фото — попробуй другое"); box?.classList.remove("busy"); }
}
async function removeAvatar() {
  const old = S.profile.avatar; if (!old) return;
  try {
    await q(sb.from("gym_profile").update({ avatar: null }).eq("user_id", S.user.id));
    sb.storage.from("gym-avatars").remove([old]);
    S.profile.avatar = null; delete S.avatars[S.user.id]; rerender(); toast("Фото убрано");
  } catch {}
}

/* ---------- friends ---------- */
const initial = name => (String(name || "?").trim()[0] || "?").toUpperCase();
const personName = id => S.people.find(u => u.user_id === id)?.name || "Друг";
const repsOf = plan => String(plan || "").split("×")[1]?.trim() || "";

// Список упражнений с фото — общий для предложений (как в «Посмотреть тренировки»).
const exListHTML = (items, hint) => `<ol class="sess-list share-list">${items.map(e => { const m = media(e.name); return `<li><button class="sx" type="button" data-photo="${esc(e.name)}">
  <span class="sx-img">${m ? `<img src="${m.img}" alt="" loading="lazy" decoding="async">` : ""}</span>
  <span class="sx-name">${esc(e.name)}${hint && e.w ? `<small>${esc(hint)}: ${fmt(e.w, 1)} кг</small>` : ""}</span>
  <span class="sx-sets mono">${e.s}×${esc(e.r || "—")}</span></button></li>`; }).join("")}</ol>`;
const thumbsHTML = names => `<span class="share-thumbs" aria-hidden="true">${names.map(n => media(n)?.img).filter(Boolean).slice(0, 4).map(src => `<img src="${src}" alt="" loading="lazy">`).join("")}</span>`;
const dayChips = d => [0, 1, 2].map(k => addDays(today(), k)).map((x, k) => `<button type="button" class="chip" data-day="${x}" aria-pressed="${x === d}">${["Сегодня", "Завтра", "Послезавтра"][k]}</button>`).join("");
function wireDay(el, onChange) { // чипы «Сегодня / Завтра / Послезавтра» и поле даты работают вместе
  const inp = el.querySelector("[name=day]");
  const sync = () => { el.querySelectorAll(".chip[data-day]").forEach(c => c.setAttribute("aria-pressed", c.dataset.day === inp.value)); onChange?.(inp.value); };
  el.querySelectorAll(".chip[data-day]").forEach(c => c.onclick = () => { inp.value = c.dataset.day; sync(); });
  inp.addEventListener("change", sync); sync();
}
const wirePhotos = el => el.querySelectorAll("[data-photo]").forEach(b => b.onclick = () => photoSheet(b.dataset.photo));

// Входящие предложения — карточками над календарём.
function inboxHTML() {
  const inbox = S.shares.filter(x => x.to_user === S.user.id && x.status === "new");
  if (!inbox.length) return "";
  return `<section class="inbox">${inbox.map(x => {
    const pr = x.kind === "program" && programById(x.payload?.program_id), items = x.payload?.items || [];
    const what = x.kind === "program" ? esc(pr?.title || "Программа") : esc(x.payload?.title || "Тренировка");
    const sub = x.kind === "program" ? `программа · ${pr?.days || "?"} ${plural(pr?.days || 0, "раз", "раза", "раз")} в неделю` : `тренировка · ${items.length} ${exWord(items.length)}${x.day ? ` · на ${shortDay(x.day)}` : ""}`;
    const names = x.kind === "program" ? (pr ? sessionsOf(pr).flatMap(s => s.ex.map(e => e.n[0])) : []) : items.map(e => e.name);
    const thumbs = pr?.photo ? `<span class="share-thumbs one"><img src="${pr.photo.src}" alt="" style="object-position:${pr.photo.pos || "30% 22%"}"></span>` : thumbsHTML(names);
    return `<article class="inbox-card">
      <div class="inbox-top">${avatarHTML(x.from_user, personName(x.from_user), "sm")}
        <div class="inbox-t"><span class="eyebrow">${esc(personName(x.from_user))} предлагает</span><b>${what}</b><span class="muted">${sub}</span></div>${thumbs}</div>
      ${x.note ? `<p class="inbox-note">«${esc(x.note)}»</p>` : ""}
      <div class="row"><button class="btn sm" data-act="share-open" data-id="${x.id}">Посмотреть</button><button class="btn quiet sm" data-act="share-no" data-id="${x.id}">Отклонить</button></div>
    </article>`;
  }).join("")}</section>`;
}
async function answerShare(sh, status) {
  await q(sb.from("gym_shares").update({ status }).eq("id", sh.id));
  sh.status = status; // список мог обновиться в фоне — меняем и актуальную запись
  S.shares.forEach(x => { if (x.id === sh.id) x.status = status; });
}
async function declineShare(sh) {
  await answerShare(sh, "declined"); rerender();
  toast("Предложение отклонено", { label: "Вернуть", run: async () => { await answerShare(sh, "new").catch(() => {}); rerender(); } });
}
function acceptSheet(sh) {
  if (!sh) return;
  const from = personName(sh.from_user);
  const note = sh.note ? `<p class="share-note"><b>${esc(from)}:</b> «${esc(sh.note)}»</p>` : "";
  if (sh.kind === "program") {
    const pr = programById(sh.payload?.program_id); if (!pr) return;
    return sheet(pr.title, `
      ${pr.photo ? `<figure class="prog-photo sheet-photo"><img src="${pr.photo.src}" alt="" style="object-position:${pr.photo.pos || "30% 22%"}"><figcaption><b>${esc(pr.photo.caption)}</b></figcaption></figure>` : ""}
      <p class="muted">${esc(from)} предлагает программу. ${esc(pr.about)}</p>${note}
      <div class="sessions">${sessionsOf(pr).map((s, k) => `<section class="sess"><header class="sess-head"><span class="sess-n mono">${k + 1}</span><div><b>${esc(s.title)}</b>${s.focus ? `<span>${esc(s.focus)}</span>` : ""}</div></header>
        ${exListHTML(s.ex.map(e => ({ name: e.n[0], s: e.s, r: e.r })))}</section>`).join("")}</div>
      ${S.profile.program_id && S.profile.program_id !== pr.id ? `<p class="hint">Сейчас в календаре «${esc(programById(S.profile.program_id)?.title || "")}» — её заменит эта программа. Уже записанные тренировки останутся.</p>` : ""}
      <div class="sheet-actions"><button class="btn quiet" data-close>Позже</button><button class="btn" data-ok>${S.profile.program_id === pr.id ? "Уже в календаре — отметить принятой" : "Поставить в календарь"}</button></div>`, (el, close) => {
      wirePhotos(el);
      el.querySelector("[data-ok]").onclick = async ev => {
        const b = ev.currentTarget; b.classList.add("loading"); b.disabled = true;
        try {
          await answerShare(sh, "accepted");
          if (S.profile.program_id !== pr.id) { Object.assign(S.profile, { program_id: pr.id, program_days: pr.defaultDays, program_week: defaultLayout(pr), program_start: today(), program_moves: {} }); saveProfile(); }
          close(); S.day = today(); rerender(); toast(`«${pr.title}» — в календаре`);
        } catch { b.classList.remove("loading"); b.disabled = false; }
      };
    });
  }
  const items = sh.payload?.items || [], d0 = sh.day && sh.day >= today() ? sh.day : today();
  sheet(sh.payload?.title || "Тренировка", `
    <p class="muted">${esc(from)} предлагает тренировку · ${items.length} ${exWord(items.length)}</p>${note}
    ${exListHTML(items, `у ${from}`)}
    <div class="field"><span>На какой день</span><div class="chips">${dayChips(d0)}</div><input class="inp" type="date" name="day" value="${d0}" min="${today()}"></div>
    <p class="hint share-busy" hidden></p>
    <div class="sheet-actions"><button class="btn quiet" data-close>Позже</button><button class="btn" data-ok>Добавить в календарь</button></div>`, (el, close) => {
    wirePhotos(el);
    const ok = el.querySelector("[data-ok]"), busy = el.querySelector(".share-busy");
    wireDay(el, d => { // день занят — упражнения добавятся к той тренировке
      const w = d && workoutOn(d);
      busy.hidden = !w; if (w) busy.textContent = `На ${shortDay(d)} уже есть «${w.title || "Тренировка"}» — упражнения добавятся к ней.`;
      ok.textContent = w ? "Добавить к тренировке" : "Добавить в календарь";
    });
    ok.onclick = async () => {
      const d = el.querySelector("[name=day]").value; if (!d) return;
      ok.classList.add("loading"); ok.disabled = true;
      const rows = items.map(e => ({ name: e.name, plan: `${e.s} × ${e.r || "—"}`, sets: suggestSets(e.name, +e.s || 3, e.r || "", d) }));
      try {
        const w = workoutOn(d);
        if (w) { // дописываем в конец существующей тренировки
          const pos = (exercisesOf(w.id).at(-1)?.position ?? -1) + 1;
          S.exercises.push(...await q(sb.from("gym_exercises").insert(rows.map((r, k) => ({ workout_id: w.id, position: pos + k, name: r.name, plan: r.plan, sets: r.sets.map(x => ({ ...x, done: false })) }))).select()));
        } else await createWorkout(d, sh.payload?.title || "", rows);
        await answerShare(sh, "accepted");
        close(); S.day = d; rerender(); toast(w ? `Добавлено к тренировке ${shortDay(d)}` : `Тренировка на ${shortDay(d)}`);
      } catch { ok.classList.remove("loading"); ok.disabled = false; }
    };
  });
}

// Отправка в два шага: выбрать тренировку → посмотреть, выбрать день, написать пару слов → «Отправить».
async function sendShare(to, row) {
  const out = await q(sb.from("gym_shares").insert({ to_user: to, ...row }).select().single());
  S.shares.unshift(out);
}
const pendingSame = (to, kind, key) => S.shares.find(x => x.from_user === S.user.id && x.to_user === to && x.status === "new" && x.kind === kind &&
  (kind === "program" ? x.payload?.program_id === key : norm(x.payload?.title) === norm(key.title) && x.day === key.day));
function sendWorkoutSheet(to, tab) {
  const name = personName(to);
  const seen = new Set(), mine = [...S.workouts].filter(w => exercisesOf(w.id).length).sort((a, b) => b.day.localeCompare(a.day))
    .filter(w => { const k = norm(w.title) || w.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  tab ||= mine.length ? "mine" : "prog";
  const progs = [...PROGRAMS].sort((a, b) => (!!b.photo - !!a.photo) || STAR_ORDER.indexOf(a.id) - STAR_ORDER.indexOf(b.id));
  let prog = S.sendProg && programById(S.sendProg) ? S.sendProg : progs[0].id;
  const progList = () => sessionsOf(programById(prog)).map((s, i) => `<button class="pick-row" data-prog="${prog}" data-i="${i}">${thumbsHTML(s.ex.map(e => e.n[0]))}<span><b>${esc(s.title)}</b><span>${s.ex.length} ${exWord(s.ex.length)}${s.focus ? ` · ${esc(s.focus)}` : ""}</span></span>${I.right}</button>`).join("");
  sheet(`Тренировка для ${name}`, `
    <div class="seg full" role="radiogroup" aria-label="Откуда тренировка">
      <button role="radio" data-tab="mine" aria-checked="${tab === "mine"}">Мои тренировки</button><button role="radio" data-tab="prog" aria-checked="${tab === "prog"}">Из программ</button></div>
    <div data-pane="mine" ${tab === "mine" ? "" : "hidden"}>${mine.length ? `<div class="pick">${mine.map(w => { const ex = exercisesOf(w.id); return `<button class="pick-row" data-w="${w.id}">${thumbsHTML(ex.map(e => e.name))}<span><b>${esc(w.title || "Тренировка")}</b><span>${shortDay(w.day)} · ${ex.length} ${exWord(ex.length)}</span></span>${I.right}</button>`; }).join("")}</div>`
      : `<p class="hint">Записанных тренировок пока нет — выбери из программ.</p>`}</div>
    <div data-pane="prog" ${tab === "prog" ? "" : "hidden"}>
      <div class="chips scroll">${progs.map(pr => `<button type="button" class="chip" data-pr="${pr.id}" aria-pressed="${pr.id === prog}">${esc(pr.title)}</button>`).join("")}</div>
      <div class="pick" data-list>${progList()}</div></div>`, (el, close) => {
    el.addEventListener("click", ev => {
      const t = ev.target.closest("[data-tab]");
      if (t) { el.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-checked", x === t)); el.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== t.dataset.tab); return; }
      const c = ev.target.closest("[data-pr]");
      if (c) { prog = S.sendProg = c.dataset.pr; el.querySelectorAll("[data-pr]").forEach(x => x.setAttribute("aria-pressed", x === c)); el.querySelector("[data-list]").innerHTML = progList(); return; }
      const b = ev.target.closest("[data-w],[data-prog]"); if (!b) return;
      let title, items;
      if (b.dataset.w) {
        const w = S.workouts.find(x => x.id === b.dataset.w); title = w.title || "Тренировка";
        items = exercisesOf(w.id).map(e => ({ name: e.name, s: e.sets?.length || 3, r: repsOf(e.plan) || String(e.sets?.[0]?.r ?? ""), w: Math.max(0, ...(e.sets || []).map(x => +x.w || 0)) || null }));
      } else {
        const s = sessionsOf(programById(b.dataset.prog))[+b.dataset.i]; title = s.title;
        items = s.ex.map(e => ({ name: e.n[0], s: e.s, r: e.r }));
      }
      close(); setTimeout(() => sendPreview(to, { title, items }, b.dataset.w ? "mine" : "prog"), 260);
    });
  });
}
function sendPreview(to, { title, items }, back) {
  const name = personName(to), d0 = addDays(today(), 1);
  sheet(title, `
    <p class="muted">${items.length} ${exWord(items.length)} · для ${esc(name)}</p>
    ${exListHTML(items, "у тебя")}
    <div class="field"><span>На какой день</span><div class="chips">${dayChips(d0)}</div><input class="inp" type="date" name="day" value="${d0}" min="${today()}"></div>
    <label class="field"><span>Пара слов, необязательно</span><input class="inp" name="note" maxlength="140" placeholder="Например: попробуй, после неё ноги горят"></label>
    <p class="err" role="alert"></p>
    <div class="sheet-actions"><button class="btn quiet" data-back>Назад</button><button class="btn" data-ok>Отправить</button></div>`, (el, close) => {
    wirePhotos(el); wireDay(el);
    el.querySelector("[data-back]").onclick = () => { close(); setTimeout(() => sendWorkoutSheet(to, back), 260); };
    el.querySelector("[data-ok]").onclick = async ev => {
      const b = ev.currentTarget, day = el.querySelector("[name=day]").value || null, note = el.querySelector("[name=note]").value.trim();
      if (pendingSame(to, "workout", { title, day })) { el.querySelector(".err").textContent = `Эта тренировка на ${shortDay(day)} уже отправлена и ждёт ответа`; return; }
      b.classList.add("loading"); b.disabled = true;
      try { await sendShare(to, { kind: "workout", day, note, payload: { title, items } }); close(); rerender(); toast(`Отправлено ${name}`); }
      catch { b.classList.remove("loading"); b.disabled = false; }
    };
  });
}
function sendProgramSheet(to) {
  const name = personName(to), progs = [...PROGRAMS].sort((a, b) => (!!b.photo - !!a.photo) || STAR_ORDER.indexOf(a.id) - STAR_ORDER.indexOf(b.id));
  sheet(`Программа для ${name}`, `<p class="hint">${esc(name)} увидит предложение над своим календарём и решит, ставить ли программу.</p>
    <div class="pick">${progs.map(pr => `<button class="pick-row" data-p="${pr.id}">${pr.photo ? `<span class="share-thumbs one"><img src="${pr.photo.src}" alt="" style="object-position:${pr.photo.pos || "30% 22%"}"></span>` : thumbsHTML(sessionsOf(pr).flatMap(s => s.ex.map(e => e.n[0])))}<span><b>${esc(pr.title)}</b><span>${pr.days} ${plural(pr.days, "раз", "раза", "раз")} в неделю${pr.length ? ` · ${pr.length} недель` : ""} · ${pr.place === "дом" ? "дома" : "в зале"}</span></span>${I.right}</button>`).join("")}</div>`, (el, close) => {
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-p]"); if (!b) return;
      const pr = programById(b.dataset.p);
      close(); setTimeout(() => sheet(pr.title, `<p class="muted">${esc(pr.about)}</p>
        <label class="field"><span>Пара слов, необязательно</span><input class="inp" name="note" maxlength="140" placeholder="Например: давай вместе по ней"></label>
        <p class="err" role="alert"></p>
        <div class="sheet-actions"><button class="btn quiet" data-back>Назад</button><button class="btn" data-ok>Отправить</button></div>`, (el2, close2) => {
        el2.querySelector("[data-back]").onclick = () => { close2(); setTimeout(() => sendProgramSheet(to), 260); };
        el2.querySelector("[data-ok]").onclick = async ev2 => {
          const btn = ev2.currentTarget;
          if (pendingSame(to, "program", pr.id)) { el2.querySelector(".err").textContent = "Эта программа уже отправлена и ждёт ответа"; return; }
          btn.classList.add("loading"); btn.disabled = true;
          try { await sendShare(to, { kind: "program", note: el2.querySelector("[name=note]").value.trim(), payload: { program_id: pr.id } }); close2(); rerender(); toast(`Отправлено ${name}`); }
          catch { btn.classList.remove("loading"); btn.disabled = false; }
        };
      }), 260);
    });
  });
}
async function cancelShare(id) {
  const sh = S.shares.find(x => x.id === id); if (!sh) return;
  await q(sb.from("gym_shares").delete().eq("id", id));
  S.shares = S.shares.filter(x => x.id !== id); rerender(); toast("Предложение отозвано");
}
// Предложения обновляются, когда возвращаешься на вкладку и раз в минуту: новые входящие и ответы друзей.
async function refreshShares() {
  if (!S.loaded || document.visibilityState !== "visible") return;
  const fresh = await q(sb.from("gym_shares").select("*").order("created_at", { ascending: false }).limit(100), { silent: true }).catch(() => null);
  if (!fresh) return;
  const old = new Map(S.shares.map(x => [x.id, x]));
  const answered = fresh.filter(x => x.from_user === S.user.id && old.get(x.id)?.status === "new" && x.status !== "new");
  const incoming = fresh.some(x => x.to_user === S.user.id && x.status === "new" && !old.has(x.id));
  S.shares = fresh;
  for (const x of answered) toast(`${personName(x.to_user)}: «${x.kind === "program" ? programById(x.payload?.program_id)?.title || "программа" : x.payload?.title || "тренировка"}» — ${x.status === "accepted" ? "принято" : "отклонено"}`);
  const typing = document.activeElement?.matches?.("input,textarea");
  if ((incoming || answered.length) && !typing && !document.querySelector(".sheet-backdrop")) rerender();
  paintBadge();
}
function paintBadge() { // точка на «Календаре», если есть непросмотренные предложения
  const n = S.shares.filter(x => x.to_user === S.user?.id && x.status === "new").length;
  const onCal = route() === ROUTES[0]; // на календаре карточки и так видны
  document.querySelectorAll('a[href="#/"]').forEach(a => { if (a.classList.contains("brand")) return; a.classList.toggle("has-badge", n > 0 && !onCal); });
}
setInterval(refreshShares, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshShares(); });

// Страница друга: неделя, итоги, рабочие веса, последние тренировки. Только чтение.
async function loadFriend(id) {
  const [workouts, exercises] = await Promise.all([
    q(sb.from("gym_workouts").select("*").eq("user_id", id).order("day"), { silent: true }),
    q(sb.from("gym_exercises").select("*").eq("user_id", id).order("position"), { silent: true }),
  ]);
  S.friends[id] = { workouts, exercises };
}
function friendView() {
  const id = route().path.slice(2), u = S.people.find(x => x.user_id === id);
  if (!u) return `<section class="hero"><h1>Не найден</h1><p class="muted">Такого пользователя нет.</p><div><a class="linkbtn" href="#/me">← Профиль</a></div></section>`;
  const f = S.friends[id];
  if (!f) { loadFriend(id).catch(() => { S.friends[id] = { failed: true }; }).then(() => { if (route().path === "u/" + id) rerender(); }); return skeleton(); }
  if (f.failed) { delete S.friends[id]; return `<section class="hero"><p class="muted">Не получилось загрузить — проверь интернет.</p><div><button class="btn quiet" onclick="location.reload()">Обновить</button></div></section>`; }
  const t = today(), exOf = wid => f.exercises.filter(e => e.workout_id === wid);
  const st = (d, w) => {
    const ex = w ? exOf(w.id) : [], done = ex.filter(e => e.done).length, plan = w ? null : sessionFor(u, d, { parse, monday });
    const s = w && ex.length && done === ex.length ? "done" : w && done ? "partial" : (w || plan) ? (d < t ? "missed" : "planned") : "rest";
    return { st: s, title: w ? (w.title || "Тренировка") : plan?.title || "", n: w ? ex.length : plan?.ex.length || 0, done };
  };
  const doneW = f.workouts.filter(w => w.day <= t && st(w.day, w).st === "done");
  const month = doneW.filter(w => w.day.slice(0, 7) === t.slice(0, 7)).length;
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday(t), i)).map(d => {
    const s = st(d, f.workouts.find(w => w.day === d));
    const sub = s.st === "rest" ? "" : s.st === "partial" ? `сделано ${s.done} из ${s.n}` : [ST_NAMES[s.st], s.n ? `${s.n} ${exWord(s.n)}` : ""].filter(Boolean).join(" · ");
    return `<div class="wk-day st-${s.st} ${d === t ? "today" : ""}"><span class="wk-d"><b>${WD[wdOf(d)]}</b><span>${parse(d).getDate()}</span></span>
      <span class="wk-t"><b>${s.title ? esc(s.title) : "Отдых"}</b>${sub ? `<span>${sub}</span>` : ""}</span><i class="mark" aria-hidden="true"></i></div>`;
  }).join("");
  // рабочие веса: по каждому упражнению лучший вес первой и последней тренировки
  const by = new Map();
  for (const e of f.exercises) {
    const d = f.workouts.find(w => w.id === e.workout_id)?.day; if (!d || d > t) continue;
    const ws = (e.sets || []).filter(x => (x.done || e.done) && x.w != null).map(x => +x.w); if (!ws.length) continue;
    const k = norm(e.name), v = by.get(k) || { name: e.name, pts: [] }; v.pts.push({ d, w: Math.max(...ws) }); by.set(k, v);
  }
  const lifts = [...by.values()].map(v => { v.pts.sort((a, b) => a.d.localeCompare(b.d)); return { ...v, last: v.pts.at(-1), first: v.pts[0] }; })
    .sort((a, b) => b.last.d.localeCompare(a.last.d) || b.pts.length - a.pts.length).slice(0, 8);
  const recent = f.workouts.filter(w => w.day <= t && exOf(w.id).some(e => e.done || e.sets?.some(x => x.done))).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 5);
  const sent = S.shares.filter(x => x.from_user === S.user.id && x.to_user === id).slice(0, 5);
  const stName = { new: "ждёт ответа", accepted: "принято", declined: "отклонено" };
  const prog = programById(u.program_id);
  return `
    <div class="back"><a class="linkbtn muted-link" href="#/me">${I.left}Профиль</a></div>
    <section class="hero me">
      ${avatarHTML(u.user_id, u.name)}
      <div><h1>${esc(u.name || "Без имени")}</h1><p class="muted">${prog ? `Программа «${esc(prog.title)}»` : "Без программы"}</p></div>
    </section>
    <div class="row friend-acts"><button class="btn" data-act="send-w" data-u="${id}">${I.plus}Отправить тренировку</button><button class="btn quiet" data-act="send-p" data-u="${id}">Предложить программу</button></div>
    <div class="stats">
      <div><b>${doneW.length}</b><span>${plural(doneW.length, "тренировка", "тренировки", "тренировок")} всего</span></div>
      <div><b>${month}</b><span>в ${MON[new Date().getMonth()].replace(/я$/, "е").replace(/а$/, "е")}</span></div>
    </div>
    <section class="card"><h2 class="card-t">Эта неделя</h2><div class="week">${week}</div></section>
    <section class="card"><h2 class="card-t">Рабочие веса</h2>
      ${lifts.length ? `<ul class="lifts">${lifts.map(l => { const dw = l.last.w - l.first.w; return `<li><span class="lift-n">${esc(l.name)}</span><span class="mono">${fmt(l.last.w, 1)} кг</span><span class="lift-d ${dw > 0 ? "up" : ""}">${l.pts.length > 1 ? (dw > 0 ? `+${fmt(dw, 1)} кг с ${shortDay(l.first.d)}` : dw < 0 ? `${fmt(dw, 1)} кг с ${shortDay(l.first.d)}` : "без изменений") : shortDay(l.last.d)}</span></li>`; }).join("")}</ul>`
        : `<p class="hint">Пока нет отмеченных подходов с весом.</p>`}
    </section>
    <section class="card"><h2 class="card-t">Последние тренировки</h2>
      ${recent.length ? `<ul class="hist-list recent">${recent.map(w => `<li><span>${shortDay(w.day)}</span><span class="recent-t"><b>${esc(w.title || "Тренировка")}</b> ${esc(exOf(w.id).map(e => e.name).join(", "))}</span></li>`).join("")}</ul>`
        : `<p class="hint">Пока ничего не отмечено.</p>`}
    </section>
    ${sent.length ? `<section class="card"><h2 class="card-t">Твои предложения</h2><ul class="sent-list">${sent.map(x => `<li>
        <span class="sent-t"><b>${x.kind === "program" ? `Программа «${esc(programById(x.payload?.program_id)?.title || "—")}»` : `«${esc(x.payload?.title || "Тренировка")}»`}</b><span>${x.kind === "program" ? "" : x.day ? `на ${shortDay(x.day)} · ` : ""}отправлено ${shortDay(x.created_at.slice(0, 10))}</span></span>
        <span class="share-st st-${x.status}">${stName[x.status]}</span>
        ${x.status === "new" ? `<button class="linkbtn muted-link" data-act="share-cancel" data-id="${x.id}">Отозвать</button>` : ""}</li>`).join("")}</ul></section>` : ""}`;
}

/* ---------- music ---------- */
// Треки лежат в закрытом хранилище gym-music/tracks (слушать могут только вошедшие), список — в таблице gym_tracks.
// Загружать новые может только владелец сайта.
const OWNER = "63719d65-7465-436c-b3e0-0fd943771228";
// Плеер живёт вне страниц: музыка не прерывается при переходах и отметках подходов.
const M = { tracks: null, folders: [], covers: {}, favs: new Set(), folder: null, queue: [], i: -1, urls: {}, shuffle: false, repeat: "all", audio: new Audio(), bar: null, full: null, loading: null };
try { const v = parseFloat(localStorage.getItem("gym-volume")); if (v >= 0 && v <= 1) M.audio.volume = v; } catch {}
// на iPhone громкость задаётся только кнопками телефона — там ползунок не показываем
const canVolume = (() => { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; })();
M.audio.preload = "metadata";
const mmss = sec => sec == null || !isFinite(sec) ? "" : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
function loadTracks() {
  M.loading ||= (async () => {
    const cur = M.tracks?.[M.i]?.file;
    const [tracks, folders, favs] = await Promise.all([
      q(sb.from("gym_tracks").select("*").order("created_at").order("title"), { silent: true }),
      q(sb.from("gym_music_folders").select("*").order("created_at"), { silent: true }).catch(() => []),
      q(sb.from("gym_track_favs").select("track_id,created_at").eq("user_id", S.user.id).order("created_at", { ascending: false }), { silent: true }).catch(() => []),
    ]);
    M.tracks = tracks; M.folders = folders; M.favs = new Set(favs.map(f => f.track_id)); M.favOrder = favs.map(f => f.track_id);
    const paths = [...M.tracks.map(t => "tracks/" + t.file), ...folders.filter(f => f.cover).map(f => "covers/" + f.cover)];
    const { data: urls } = await sb.storage.from("gym-music").createSignedUrls(paths, 6 * 3600);
    for (const u of urls || []) if (u.signedUrl) {
      if (u.path.startsWith("covers/")) M.covers[u.path.slice(7)] = u.signedUrl; else M.urls[u.path.replace(/^tracks\//, "")] = u.signedUrl;
    }
    if (M.folder && M.folder !== "fav" && !folders.some(f => f.id === M.folder)) M.folder = null;
    M.tracks = M.tracks.filter(t => M.urls[t.file]);
    if (cur) M.i = M.tracks.findIndex(t => t.file === cur);
  })().catch(e => { M.loading = null; throw e; });
  return M.loading;
}
const folderOf = t => M.folders.find(f => f.id === t?.folder_id);
const coverOf = f => f?.cover ? M.covers[f.cover] : null;
// обложка-заглушка: первая буква на цветном фоне, цвет зависит от названия
const tileHue = name => [...String(name || "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
const coverHTML = (f, cls = "") => coverOf(f) ? `<img class="cov ${cls}" style="--h:${tileHue(f?.name)}" src="${coverOf(f)}" alt="" decoding="async" onload="this.classList.add('ok')">`
  : `<span class="cover-tile ${cls}" style="--h:${tileHue(f?.name)}" aria-hidden="true">${esc(initial(f?.name || "♪"))}</span>`;
// внутри папки — по альбомам и номерам треков, во «Все треки» — по порядку добавления
const visibleTracks = () => {
  if (M.q) { // поиск — по всем трекам: название, группа, альбом
    const words = norm(M.q).split(/\s+/).filter(Boolean);
    return M.tracks.map((t, i) => ({ t, i })).filter(({ t }) => { const hay = norm(`${t.title} ${t.artist} ${t.album}`); return words.every(w => hay.includes(w)); });
  }
  if (M.folder === "fav") return (M.favOrder || []).map(id => M.tracks.findIndex(t => t.id === id)).filter(i => i >= 0).map(i => ({ t: M.tracks[i], i }));
  const list = M.tracks.map((t, i) => ({ t, i })).filter(x => !M.folder || x.t.folder_id === M.folder);
  if (M.folder) list.sort((a, b) => (a.t.album || "").localeCompare(b.t.album || "") || (a.t.track_no ?? 999) - (b.t.track_no ?? 999) || a.i - b.i);
  return list;
};
const isOwner = () => S.user?.id === OWNER;

function musicView() {
  if (!M.tracks) {
    loadTracks().then(() => { if (route().path === "music") rerender(); })
      .catch(() => { if (route().path === "music") document.getElementById("main").innerHTML = `<section class="hero"><h1>Музыка</h1><p class="muted">Не получилось загрузить треки — проверь интернет.</p><div><button class="btn quiet" onclick="location.reload()">Обновить</button></div></section>`; });
    return skeleton();
  }
  const count = id => M.tracks.filter(t => t.folder_id === id).length;
  const card = (id, name, n, cover) => `<button class="fold-card ${M.folder === id && !M.q ? "on" : ""}" data-act="mu-folder" data-id="${id || ""}">
      <span class="fold-cover">${cover}</span><b>${esc(name)}</b><span>${n} ${plural(n, "трек", "трека", "треков")}</span></button>`;
  return `
    <section class="hero mu-hero"><h1>Музыка</h1><p class="lead">Играет, пока открыт сайт: можно отмечать подходы и переходить между разделами.</p></section>
    <div class="folders" role="list">
      ${card(null, "Все треки", M.tracks.length, `<span class="cover-tile all" aria-hidden="true">${I.note}</span>`)}
      ${card("fav", "Избранное", M.favs.size, `<span class="cover-tile fav" aria-hidden="true">${I.heart}</span>`)}
      ${M.folders.map(x => card(x.id, x.name, count(x.id), coverHTML(x))).join("")}
      ${isOwner() ? `<button class="fold-card add" data-act="mu-new-folder"><span class="fold-cover"><span class="cover-tile plus" aria-hidden="true">${I.plus}</span></span><b>Новая папка</b><span>группа или альбом</span></button>` : ""}
    </div>
    <label class="mu-search">${I.search}<input type="search" data-field="mu-q" value="${esc(M.q || "")}" placeholder="Найти трек или группу" autocomplete="off" enterkeyhint="search" aria-label="Поиск по трекам">${M.q ? `<button type="button" data-act="mu-q-clear" aria-label="Очистить поиск">${I.x}</button>` : ""}</label>
    <div id="mu-list">${musicList()}</div>`;
}
function musicList() {
  const list = visibleTracks(), fav = M.folder === "fav" && !M.q, f = !M.q && M.folders.find(x => x.id === M.folder), playing = !M.audio.paused;
  const total = list.reduce((a, x) => a + (x.t.sec || 0), 0);
  return `
    <section class="mu-head">
      <div class="mu-title">${f ? `<span class="mu-cover">${coverHTML(f)}</span>` : ""}<div><h2>${M.q ? "Поиск" : esc(f?.name || (fav ? "Избранное" : "Все треки"))}</h2><p class="muted">${list.length} ${plural(list.length, "трек", "трека", "треков")} · ${Math.round(total / 60)} мин</p></div></div>
      <div class="row"><button class="btn" data-act="mu-all" ${list.length ? "" : "disabled"}>${I.play}Слушать</button><button class="btn quiet" data-act="mu-shuffle" aria-pressed="${M.shuffle}">${I.shuffle}Вперемешку</button>
        ${f && isOwner() ? `<button class="icon-btn" data-act="mu-folder-menu" aria-label="Настройки папки">${I.dots}</button>` : ""}</div>
    </section>
    ${isOwner() && !fav && !M.q ? `<label class="mu-up"><input type="file" accept=".mp3,audio/mpeg" multiple hidden data-field="mu-files">${I.plus}<span><b>Загрузить треки${f ? ` в «${esc(f.name)}»` : ""}</b><span class="hint" id="mu-st">mp3 с компьютера, можно несколько или перетащить на страницу. Группа, название и обложка берутся из самого трека; папка группы создаётся сама.</span></span></label>` : ""}
    ${list.length ? `<ol class="tracks">${list.map(({ t, i }, k) => `<li class="${i === M.i ? "cur" : ""} ${i === M.i && playing ? "playing" : ""}" data-i="${i}">
      <button class="track" data-act="mu-play" data-i="${i}">
        <span class="tr-n">${i === M.i ? `<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>` : k + 1}</span>
        <span class="tr-t"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></span>
        <span class="tr-d mono">${mmss(t.sec)}</span></button>
      <button class="tr-fav" data-act="mu-fav" data-i="${i}" aria-pressed="${M.favs.has(t.id)}" aria-label="${M.favs.has(t.id) ? "Убрать из избранного" : "В избранное"}">${M.favs.has(t.id) ? I.heartFill : I.heart}</button>
      ${isOwner() ? `<button class="tr-more" data-act="mu-track-menu" data-i="${i}" aria-label="Действия с треком">${I.dots}</button>` : ""}</li>`).join("")}</ol>`
      : `<p class="hint mu-empty">${M.q ? "Ничего не нашлось — попробуй часть названия или группу." : fav ? "Здесь будут треки, которые ты отметишь сердечком." : isOwner() ? "В папке пока нет треков — загрузи их кнопкой выше или перенеси из «Все треки» через ⋯ у трека." : "В папке пока нет треков."}</p>`}`;
}

// Действия владельца: перенести трек в папку, удалить трек, создать папку, сменить обложку, удалить папку.
function trackMenu(i) {
  const t = M.tracks[i]; if (!t) return;
  sheet(t.title, `<p class="muted">${esc(t.artist)}</p>
    <div class="eyebrow">Перенести в папку</div>
    <div class="pick">${[{ id: "", name: "Без папки" }, ...M.folders].map(f => `<button data-to="${f.id}" ${(t.folder_id || "") === f.id ? "disabled" : ""}><b>${esc(f.name)}</b>${(t.folder_id || "") === f.id ? "<span>сейчас здесь</span>" : ""}</button>`).join("")}</div>
    <div class="sheet-actions"><button class="btn danger-soft" data-del>Удалить трек</button></div>`, (el, close) => {
    el.addEventListener("click", async ev => {
      const to = ev.target.closest("[data-to]");
      if (to) { to.disabled = true;
        try { await q(sb.from("gym_tracks").update({ folder_id: to.dataset.to || null }).eq("id", t.id)); t.folder_id = to.dataset.to || null; close(); rerender(); toast("Перенесено"); } catch { to.disabled = false; }
        return; }
      if (!ev.target.closest("[data-del]")) return;
      close();
      if (!await confirmSheet("Удалить трек?", `«${t.title}» исчезнет с сайта у всех. Файл на твоём компьютере останется.`)) return;
      try {
        await q(sb.from("gym_tracks").delete().eq("id", t.id));
        await sb.storage.from("gym-music").remove(["tracks/" + t.file]);
        if (M.i === i) { M.audio.pause(); M.audio.removeAttribute("src"); }
        const cur = M.tracks[M.i]?.file; M.tracks.splice(i, 1); M.i = cur ? M.tracks.findIndex(x => x.file === cur) : -1;
        if (M.i < 0) { M.bar?.remove(); M.bar = null; document.documentElement.classList.remove("has-player"); }
        rerender(); toast("Трек удалён");
      } catch {}
    });
  });
}
function newFolderSheet() {
  sheet("Новая папка", `<form class="music-form" data-mf>
      <label class="field"><span>Название — группа или альбом</span><input class="inp" name="name" maxlength="60" required autocomplete="off"></label>
      <label class="field"><span>Обложка, необязательно</span><input class="inp" type="file" name="cover" accept="image/jpeg,image/png,image/webp"></label>
      <p class="err" role="alert"></p>
      <div class="sheet-actions"><button class="btn quiet" type="button" data-close>Отмена</button><button class="btn" type="submit">Создать</button></div></form>`, (el, close) => {
    el.querySelector("[name=name]").focus();
    el.querySelector("form").onsubmit = async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const fm = ev.target, name = fm.name.value.trim(), btn = fm.querySelector("[type=submit]"), err = fm.querySelector(".err");
      if (!name) return;
      if (M.folders.some(f => norm(f.name) === norm(name))) { err.textContent = "Такая папка уже есть"; return; }
      btn.classList.add("loading"); btn.disabled = true;
      try {
        const cover = fm.cover.files[0] ? await uploadCover(fm.cover.files[0], name) : null;
        const row = await q(sb.from("gym_music_folders").insert({ name, cover }).select().single());
        // треки этого исполнителя без папки сразу переезжают в неё
        const ids = M.tracks.filter(t => !t.folder_id && norm(t.artist.split(",")[0]) === norm(name)).map(t => t.id);
        if (ids.length) await q(sb.from("gym_tracks").update({ folder_id: row.id }).in("id", ids));
        M.folder = row.id; M.loading = null; await loadTracks(); close(); rerender(); toast(`Папка «${name}» создана${ids.length ? `, перенесено треков: ${ids.length}` : ""}`);
      } catch { btn.classList.remove("loading"); btn.disabled = false; err.textContent = "Не получилось — попробуй ещё раз"; }
    };
  });
}
async function uploadCover(file, name) {
  const ext = /png/.test(file.type) ? "png" : /webp/.test(file.type) ? "webp" : "jpg", path = `${slugify(name)}-${Date.now().toString(36)}.${ext}`; // file может быть Blob из тегов
  const { error } = await sb.storage.from("gym-music").upload("covers/" + path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}
function folderMenu() {
  const f = M.folders.find(x => x.id === M.folder); if (!f) return;
  sheet(f.name, `<div class="pick">
      <label class="pick-file"><input type="file" accept="image/jpeg,image/png,image/webp" hidden data-cover><b>Сменить обложку</b><span>картинка с компьютера</span></label>
      <button data-del-folder><b>Удалить папку</b><span>треки останутся во «Все треки»</span></button></div>`, (el, close) => {
    el.querySelector("[data-cover]").onchange = async ev => {
      const file = ev.target.files[0]; if (!file) return;
      try { const cover = await uploadCover(file, f.name); await q(sb.from("gym_music_folders").update({ cover }).eq("id", f.id)); if (f.cover) sb.storage.from("gym-music").remove(["covers/" + f.cover]);
        M.loading = null; await loadTracks(); close(); rerender(); toast("Обложка обновлена"); } catch { toast("Не получилось загрузить картинку"); }
    };
    el.querySelector("[data-del-folder]").onclick = async () => {
      close();
      if (!await confirmSheet(`Удалить папку «${f.name}»?`, "Треки не удалятся — они останутся во «Все треки».")) return;
      try { await q(sb.from("gym_music_folders").delete().eq("id", f.id)); if (f.cover) sb.storage.from("gym-music").remove(["covers/" + f.cover]);
        M.folder = null; M.loading = null; await loadTracks(); rerender(); toast("Папка удалена"); } catch {}
    };
  });
}

// Загрузка: файл → хранилище, строка → gym_tracks. Длительность читается в браузере.
const slugify = s => s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "track";
const durationOf = f => new Promise(res => { const a = new Audio(), u = URL.createObjectURL(f); a.preload = "metadata"; a.src = u;
  a.onloadedmetadata = () => { res(isFinite(a.duration) ? Math.round(a.duration) : null); URL.revokeObjectURL(u); }; a.onerror = () => { res(null); URL.revokeObjectURL(u); }; });
// Теги mp3 (ID3v2): исполнитель, название, альбом, номер трека и обложка — читаются прямо в браузере.
async function id3(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (String.fromCharCode(...head.slice(0, 3)) !== "ID3") return {};
  const ver = head[3], ss = b => (b[0] << 21) | (b[1] << 14) | (b[2] << 7) | b[3];
  const data = new Uint8Array(await file.slice(10, 10 + ss(head.slice(6, 10))).arrayBuffer()), out = {};
  const dec = (enc, bytes) => new TextDecoder(["iso-8859-1", "utf-16", "utf-16be", "utf-8"][enc] || "utf-8").decode(bytes).replace(/\0/g, "").trim();
  for (let i = 0; i + 10 <= data.length;) {
    const id = String.fromCharCode(...data.slice(i, i + 4)); if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const sz = ver === 4 ? ss(data.slice(i + 4, i + 8)) : (data[i + 4] << 24 | data[i + 5] << 16 | data[i + 6] << 8 | data[i + 7]) >>> 0;
    const body = data.slice(i + 10, i + 10 + sz);
    if (["TPE1", "TIT2", "TALB", "TRCK"].includes(id)) out[id] = dec(body[0], body.slice(1));
    if (id === "APIC" && !out.cover) {
      const enc = body[0]; let j = body.indexOf(0, 1); const mime = dec(0, body.slice(1, j)) || "image/jpeg"; j += 2;
      if (enc === 1 || enc === 2) { while (j < body.length && (body[j] || body[j + 1])) j += 2; j += 2; } else j = body.indexOf(0, j) + 1;
      if (body.length - j > 1000) out.cover = new Blob([body.slice(j)], { type: /png/.test(mime) ? "image/png" : "image/jpeg" });
    }
    i += 10 + sz;
  }
  return out;
}
// «01. Группа - Трек [audiovk.com]» → исполнитель и название без номеров и приписок
function fromName(name) {
  const base = name.replace(/\.mp3$/i, "").replace(/\s*[\[(][^\])]*\.(com|ru|net|org)[^\])]*[\])]/gi, "").replace(/^\s*\d{1,3}\s*[.\-_)]\s*/, "").trim();
  const k = base.indexOf(" - ");
  return k > 0 ? { artist: base.slice(0, k).trim(), title: base.slice(k + 3).trim() } : { artist: "", title: base };
}
const folderKey = n => norm(n).replace(/^the\s+/, "");
async function uploadTracks(files) {
  files = [...files].filter(f => /\.mp3$/i.test(f.name) || f.type === "audio/mpeg");
  if (!files.length) return toast("Нужны файлы mp3");
  const st = () => document.getElementById("mu-st"), have = new Set((M.tracks || []).map(t => t.file));
  const same = new Set((M.tracks || []).map(t => norm(t.artist) + "|" + norm(t.title)));
  let ok = 0, fail = 0, dup = 0, made = 0;
  for (const [k, f] of files.entries()) {
    if (st()) st().textContent = `Загружаю ${k + 1} из ${files.length}: ${f.name}`;
    try {
      const tag = await id3(f).catch(() => ({})), byName = fromName(f.name);
      // «Трек - Группа»: если вторая часть — уже известная группа, а первая нет, меняем местами
      if (!tag.TPE1 && M.folders.some(x => folderKey(x.name) === folderKey(byName.title)) && !M.folders.some(x => folderKey(x.name) === folderKey(byName.artist)))
        [byName.artist, byName.title] = [byName.title, byName.artist];
      const artist = (tag.TPE1 || byName.artist).split(/\s*[\/;]\s*/)[0].trim(), title = tag.TIT2 || byName.title;
      const album = tag.TALB || "", track_no = parseInt(tag.TRCK || f.name.match(/^\s*(\d{1,3})\s*[.\-_)]/)?.[1]) || null;
      if (same.has(norm(artist) + "|" + norm(title))) { dup++; continue; } // такой трек уже есть
      // папка: открытая сейчас, иначе папка группы; нет такой — создаётся с обложкой из трека
      let folder = M.folders.find(x => x.id === M.folder) || (artist && M.folders.find(x => folderKey(x.name) === folderKey(artist)));
      if (!folder && artist) {
        const cover = tag.cover ? await uploadCover(tag.cover, artist).catch(() => null) : null;
        folder = await q(sb.from("gym_music_folders").insert({ name: artist, cover }).select().single(), { silent: true });
        M.folders.push(folder); made++;
      } else if (folder && !folder.cover && tag.cover) {
        const cover = await uploadCover(tag.cover, folder.name).catch(() => null);
        if (cover) { await q(sb.from("gym_music_folders").update({ cover }).eq("id", folder.id), { silent: true }); folder.cover = cover; }
      }
      let file = slugify(`${artist} ${title}`) + ".mp3"; if (have.has(file)) file = slugify(`${artist} ${title}`) + "-" + Date.now().toString(36) + ".mp3";
      const sec = await durationOf(f);
      const { error } = await sb.storage.from("gym-music").upload("tracks/" + file, f, { contentType: "audio/mpeg" });
      if (error) throw error;
      await q(sb.from("gym_tracks").insert({ file, artist, title, album, track_no, sec, folder_id: folder?.id || null }), { silent: true });
      have.add(file); same.add(norm(artist) + "|" + norm(title)); ok++;
    } catch (e) { console.error(e); fail++; }
  }
  M.loading = null; await loadTracks().catch(() => {});
  if (route().path === "music") rerender();
  toast([`Загружено: ${ok}`, made && `новых папок: ${made}`, dup && `уже были: ${dup}`, fail && `не получилось: ${fail}`].filter(Boolean).join(", "));
}
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "p-avatar") { uploadAvatar(ev.target.files[0]); ev.target.value = ""; } });
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "mu-files") { uploadTracks(ev.target.files); ev.target.value = ""; } });
document.addEventListener("dragover", ev => { if (route().path === "music" && S.user?.id === OWNER && ev.dataTransfer?.types.includes("Files")) { ev.preventDefault(); document.documentElement.classList.add("mu-drop"); } });
document.addEventListener("dragleave", ev => { if (!ev.relatedTarget) document.documentElement.classList.remove("mu-drop"); });
document.addEventListener("drop", ev => { if (route().path !== "music" || S.user?.id !== OWNER || !ev.dataTransfer?.files.length) return; ev.preventDefault(); document.documentElement.classList.remove("mu-drop"); uploadTracks(ev.dataTransfer.files); });

function playAt(i) {
  const t = M.tracks[i]; if (!t) return;
  M.i = i; M.audio.src = M.urls[t.file]; M.audio.play().catch(() => {});
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: folderOf(t)?.name || "Дневник", artwork: coverOf(folderOf(t)) ? [{ src: coverOf(folderOf(t)), sizes: "400x400" }] : [] });
  drawBar(); drawFull(); refreshTracks();
}
async function toggleFav(i) {
  const t = M.tracks[i]; if (!t) return;
  const on = !M.favs.has(t.id);
  on ? (M.favs.add(t.id), M.favOrder = [t.id, ...(M.favOrder || [])]) : (M.favs.delete(t.id), M.favOrder = (M.favOrder || []).filter(x => x !== t.id));
  paintFavs();
  try { await (on ? q(sb.from("gym_track_favs").insert({ track_id: t.id })) : q(sb.from("gym_track_favs").delete().eq("user_id", S.user.id).eq("track_id", t.id))); }
  catch { on ? M.favs.delete(t.id) : M.favs.add(t.id); paintFavs(); }
}
function paintFavs() { // сердечки в списке, плеере и счётчик папки — без перерисовки страницы
  document.querySelectorAll(".tr-fav").forEach(b => { const on = M.favs.has(M.tracks[+b.dataset.i]?.id); b.setAttribute("aria-pressed", on); b.innerHTML = on ? I.heartFill : I.heart; });
  const t = M.tracks?.[M.i], on = !!t && M.favs.has(t.id);
  document.querySelectorAll("[data-p=fav]").forEach(b => { b.setAttribute("aria-pressed", on); b.innerHTML = on ? I.heartFill : I.heart; });
  const c = document.querySelector('.fold-card[data-id="fav"] > span:last-child'); if (c) c.textContent = `${M.favs.size} ${plural(M.favs.size, "трек", "трека", "треков")}`;
  if (M.folder === "fav" && route().path === "music") rerender();
}
// Очередь — треки той папки, откуда включили музыку.
const nextIndex = dir => {
  const fromQ = M.queue.map(f => M.tracks.findIndex(t => t.file === f)).filter(i => i >= 0);
  const qu = fromQ.length ? fromQ : M.tracks.map((_, i) => i), n = qu.length, pos = qu.indexOf(M.i);
  if (M.shuffle && n > 1) { let k; do k = qu[Math.floor(Math.random() * n)]; while (k === M.i); return k; }
  if (M.repeat === "off" && dir > 0 && pos === n - 1) return -1; // очередь кончилась
  return qu[((pos < 0 ? 0 : pos) + dir + n) % n];
};
function refreshTracks() {
  if (route().path !== "music") return;
  const playing = !M.audio.paused;
  document.querySelectorAll(".tracks li").forEach((li, k) => {
    const i = +li.dataset.i, cur = i === M.i;
    li.classList.toggle("cur", cur); li.classList.toggle("playing", cur && playing);
    li.querySelector(".tr-n").innerHTML = cur ? `<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>` : k + 1;
  });
}
// Длина трека: пока браузер её не узнал, берём из списка треков.
const dur = () => isFinite(M.audio.duration) && M.audio.duration > 0 ? M.audio.duration : (M.tracks?.[M.i]?.sec || 0);
// Ползунок перемотки: и в мини-плеере, и в большом. Пока тянешь — время не прыгает.
const seekHTML = cls => `<div class="seek ${cls}"><input type="range" min="0" max="1000" value="0" step="1" data-seek aria-label="Перемотка"><div class="seek-t mono"><span data-cur>0:00</span><span data-left></span></div></div>`;
function paintTime() {
  const a = M.audio, d = dur(), k = d ? Math.min(1, a.currentTime / d) : 0;
  document.querySelectorAll("[data-seek]").forEach(r => { if (!r.dragging) { r.value = Math.round(k * 1000); r.style.setProperty("--p", k * 100 + "%"); } });
  document.querySelectorAll("[data-cur]").forEach(e => { const r = e.closest(".seek")?.querySelector("[data-seek]"); e.textContent = mmss(r?.dragging ? r.value / 1000 * d : a.currentTime) || "0:00"; });
  document.querySelectorAll("[data-left]").forEach(e => { e.textContent = d ? mmss(d) : mmss(M.tracks?.[M.i]?.sec); });
  if (M.bar) M.bar.querySelector(".pl-line i").style.width = k * 100 + "%";
}
function wirePlayer(root) {
  root.addEventListener("click", ev => {
    const b = ev.target.closest("[data-p]"); if (!b) return;
    ({ open: openFull, close: closeFull,
      prev: () => M.audio.currentTime > 5 ? (M.audio.currentTime = 0) : playAt(nextIndex(-1)),
      next: () => { const n = nextIndex(1); n >= 0 ? playAt(n) : playAt(M.queue.length ? M.tracks.findIndex(t => t.file === M.queue[0]) : 0); },
      toggle: () => { M.audio.paused ? M.audio.play().catch(() => {}) : M.audio.pause(); },
      fav: () => toggleFav(M.i),
      shuffle: () => { M.shuffle = !M.shuffle; drawFull(); document.querySelectorAll('[data-act="mu-shuffle"]').forEach(x => x.setAttribute("aria-pressed", M.shuffle)); },
      repeat: () => { M.repeat = { all: "one", one: "off", off: "all" }[M.repeat]; drawFull(); },
      mute: () => { M.audio.muted = !M.audio.muted; paintVolume(); },
      back: () => { M.audio.currentTime = Math.max(0, M.audio.currentTime - 10); },
      fwd: () => { M.audio.currentTime = Math.min(dur(), M.audio.currentTime + 10); },
    })[b.dataset.p]?.();
  });
  root.addEventListener("input", ev => {
    const r = ev.target;
    if (r.matches("[data-seek]")) { r.dragging = true; r.style.setProperty("--p", r.value / 10 + "%"); paintTime(); }
    if (r.matches("[data-vol]")) { M.audio.volume = r.value / 100; M.audio.muted = false; try { localStorage.setItem("gym-volume", M.audio.volume); } catch {} paintVolume(); }
  });
  root.addEventListener("change", ev => {
    const r = ev.target; if (!r.matches("[data-seek]")) return;
    if (dur()) M.audio.currentTime = r.value / 1000 * dur();
    r.dragging = false; paintTime();
  });
}
function paintVolume() {
  const v = M.audio.muted ? 0 : M.audio.volume;
  document.querySelectorAll("[data-vol]").forEach(r => { r.value = Math.round(v * 100); r.style.setProperty("--p", v * 100 + "%"); });
  document.querySelectorAll("[data-p=mute]").forEach(b => { b.innerHTML = v === 0 ? I.volOff : I.vol; b.setAttribute("aria-label", v === 0 ? "Включить звук" : "Выключить звук"); });
}
const volHTML = () => canVolume ? `<div class="vol"><button class="icon-btn bare" data-p="mute" aria-label="Выключить звук">${I.vol}</button><input type="range" min="0" max="100" value="100" data-vol aria-label="Громкость"></div>` : "";

function drawBar() {
  const t = M.tracks?.[M.i]; if (!t) return;
  if (!M.bar) {
    M.bar = document.createElement("div"); M.bar.className = "player"; M.bar.setAttribute("aria-label", "Плеер");
    M.bar.innerHTML = `<div class="pl-line"><i></i></div>
      <div class="pl-row"><button class="pl-info" data-p="open" aria-label="Открыть плеер"><span class="pl-cover"></span><span class="pl-txt"><b></b><span></span></span></button>
        <button class="icon-btn bare pl-fav" data-p="fav"></button>
        <button class="icon-btn bare pl-wide" data-p="prev" aria-label="Предыдущий">${I.prev}</button>
        <button class="pl-play" data-p="toggle"></button>
        <button class="icon-btn bare" data-p="next" aria-label="Следующий">${I.next}</button>
        <div class="pl-wide pl-seek">${seekHTML("mini")}</div>
        <span class="pl-wide">${volHTML()}</span></div>`;
    wirePlayer(M.bar);
    document.body.append(M.bar); document.documentElement.classList.add("has-player");
    requestAnimationFrame(() => M.bar.classList.add("on"));
  }
  M.bar.querySelector(".pl-txt b").textContent = t.title;
  M.bar.querySelector(".pl-txt span").textContent = t.artist;
  const cov = folderOf(t) || { name: t.artist };
  if (M.bar.dataset.cov !== (cov.id || cov.name)) { M.bar.dataset.cov = cov.id || cov.name; M.bar.querySelector(".pl-cover").innerHTML = coverHTML(cov); }
  const paused = M.audio.paused, play = M.bar.querySelector(".pl-play");
  play.innerHTML = paused ? I.play : I.pause; play.setAttribute("aria-label", paused ? "Играть" : "Пауза");
  paintFavs(); paintTime(); paintVolume();
}

// Большой плеер: обложка, перемотка со временем, ±10 секунд, повтор, перемешивание, громкость.
function openFull() {
  if (!M.tracks?.[M.i]) return;
  if (!M.full) {
    M.full = document.createElement("section"); M.full.className = "now"; M.full.setAttribute("role", "dialog"); M.full.setAttribute("aria-label", "Сейчас играет");
    M.full.innerHTML = `<div class="now-in">
      <header class="now-head"><button class="icon-btn bare" data-p="close" aria-label="Свернуть">${I.down}</button><span class="eyebrow" data-from></span><span style="width:44px"></span></header>
      <div class="now-cover"></div>
      <div class="now-title"><div><h2 data-title></h2><p class="muted" data-artist></p></div><button class="icon-btn bare now-fav" data-p="fav"></button></div>
      ${seekHTML("big")}
      <div class="now-ctrl">
        <button class="icon-btn bare" data-p="shuffle" aria-label="Перемешивание">${I.shuffle}</button>
        <button class="icon-btn bare" data-p="prev" aria-label="Предыдущий">${I.prev}</button>
        <button class="icon-btn bare sm-hide" data-p="back" aria-label="Назад на 10 секунд">${I.back10}</button>
        <button class="pl-play big" data-p="toggle"></button>
        <button class="icon-btn bare sm-hide" data-p="fwd" aria-label="Вперёд на 10 секунд">${I.fwd10}</button>
        <button class="icon-btn bare" data-p="next" aria-label="Следующий">${I.next}</button>
        <button class="icon-btn bare" data-p="repeat" aria-label="Повтор"></button>
      </div>
      ${volHTML()}
    </div>`;
    wirePlayer(M.full);
    M.full.addEventListener("click", ev => { if (ev.target === M.full) closeFull(); });
    document.body.append(M.full);
  }
  drawFull();
  document.documentElement.classList.add("now-open");
  requestAnimationFrame(() => M.full.classList.add("open"));
}
function closeFull() { M.full?.classList.remove("open"); document.documentElement.classList.remove("now-open"); }
function drawFull() {
  const t = M.tracks?.[M.i]; if (!M.full || !t) return;
  const f = folderOf(t) || { name: t.artist };
  M.full.querySelector("[data-title]").textContent = t.title;
  M.full.querySelector("[data-artist]").textContent = t.artist + (t.album ? ` · ${t.album}` : "");
  M.full.querySelector("[data-from]").textContent = M.folder === "fav" ? "Избранное" : f.name || "Музыка";
  if (M.full.dataset.cov !== (f.id || f.name)) { M.full.dataset.cov = f.id || f.name; M.full.querySelector(".now-cover").innerHTML = coverHTML(f, "xl"); }
  const paused = M.audio.paused, play = M.full.querySelector(".pl-play");
  play.innerHTML = paused ? I.play : I.pause; play.setAttribute("aria-label", paused ? "Играть" : "Пауза");
  M.full.querySelector("[data-p=shuffle]").setAttribute("aria-pressed", M.shuffle);
  const rp = M.full.querySelector("[data-p=repeat]");
  rp.innerHTML = M.repeat === "one" ? I.repeatOne : I.repeat; rp.setAttribute("aria-pressed", M.repeat !== "off");
  rp.setAttribute("aria-label", { all: "Повтор очереди", one: "Повтор трека", off: "Без повтора" }[M.repeat]);
  paintFavs(); paintTime(); paintVolume();
}
M.audio.addEventListener("ended", () => {
  if (M.repeat === "one") { M.audio.currentTime = 0; M.audio.play().catch(() => {}); return; }
  const n = nextIndex(1); if (n >= 0) playAt(n); else { drawBar(); drawFull(); }
});
M.audio.addEventListener("play", () => { drawBar(); drawFull(); refreshTracks(); });
M.audio.addEventListener("pause", () => { drawBar(); drawFull(); refreshTracks(); });
M.audio.addEventListener("loadedmetadata", paintTime);
M.audio.addEventListener("volumechange", paintVolume);
let lastPos = 0;
M.audio.addEventListener("timeupdate", () => {
  paintTime();
  if ("mediaSession" in navigator && navigator.mediaSession.setPositionState && M.audio.duration && Math.abs(M.audio.currentTime - lastPos) > 4) {
    lastPos = M.audio.currentTime;
    try { navigator.mediaSession.setPositionState({ duration: M.audio.duration, position: M.audio.currentTime, playbackRate: 1 }); } catch {}
  }
});
M.audio.addEventListener("error", () => { // ссылка истекла — получить новые и продолжить
  if (!M.tracks || M.retry || M.i < 0) return; M.retry = true; M.loading = null;
  const at = M.audio.currentTime;
  loadTracks().then(() => { playAt(M.i); M.audio.currentTime = at; }).catch(() => toast("Трек не загрузился — проверь интернет")).finally(() => setTimeout(() => { M.retry = false; }, 5000));
});
if ("mediaSession" in navigator) {
  const ms = navigator.mediaSession, set = (k, fn) => { try { ms.setActionHandler(k, fn); } catch {} };
  set("play", () => M.audio.play().catch(() => {}));
  set("pause", () => M.audio.pause());
  set("nexttrack", () => { const n = nextIndex(1); if (n >= 0) playAt(n); });
  set("previoustrack", () => playAt(nextIndex(-1)));
  set("seekto", d => { M.audio.currentTime = d.seekTime; paintTime(); });
  set("seekbackward", d => { M.audio.currentTime = Math.max(0, M.audio.currentTime - (d.seekOffset || 10)); });
  set("seekforward", d => { M.audio.currentTime = Math.min(dur(), M.audio.currentTime + (d.seekOffset || 10)); });
}
// Клавиши на компьютере: пробел — пауза, ←/→ — 5 секунд, Shift+←/→ — трек; Esc — свернуть большой плеер.
document.addEventListener("keydown", ev => {
  if (M.i < 0 || ev.metaKey || ev.ctrlKey || ev.altKey || ev.target.closest("input:not([type=range]),textarea,select,[contenteditable]")) return;
  if (ev.key === "Escape" && document.documentElement.classList.contains("now-open")) return closeFull();
  if (ev.key === " " && !ev.target.closest("button,a")) { ev.preventDefault(); M.audio.paused ? M.audio.play().catch(() => {}) : M.audio.pause(); }
  else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
    if (ev.target.matches("input[type=range]")) return;
    ev.preventDefault();
    if (ev.shiftKey) playAt(nextIndex(ev.key === "ArrowRight" ? 1 : -1) >= 0 ? nextIndex(ev.key === "ArrowRight" ? 1 : -1) : M.i);
    else M.audio.currentTime = Math.max(0, Math.min(dur(), M.audio.currentTime + (ev.key === "ArrowRight" ? 5 : -5)));
  }
});
function stopMusic() { M.audio.pause(); M.audio.removeAttribute("src"); M.bar?.remove(); M.bar = null; M.full?.remove(); M.full = null; document.documentElement.classList.remove("now-open"); M.favs = new Set(); M.i = -1; M.tracks = null; M.urls = {}; M.loading = null; document.documentElement.classList.remove("has-player"); }

/* ---------- help ---------- */
// Подсказка новичку: пока нет ни одной тренировки и её не закрыли.
function helpHintHTML() {
  let hidden = false; try { hidden = !!localStorage.getItem("gym-help-hidden"); } catch {}
  if (hidden || S.workouts.length) return "";
  return `<section class="inbox"><div class="inbox-card help-hint">
    <div class="inbox-t"><b>Впервые здесь?</b><span class="muted">За минуту расскажем, как всё устроено.</span>
      <div class="row"><a class="btn sm" href="#/help">Как пользоваться</a><button class="btn quiet sm" data-act="help-hide">Скрыть</button></div></div></div></section>`;
}
const HELP = [
  ["С чего начать", [
    "Открой «Программы», выбери подходящую (фильтр «В зале / Дома» сверху) и нажми «Поставить в календарь» — тренировки сами встанут на нужные дни недели.",
    "У программ звёзд — Катлера, Коулмана и Скалы Джонсона — есть блок «Питание»: как ел сам спортсмен, сколько есть тебе (по весу из профиля) и пример дня.",
    "Там же блок «Твоя неделя»: перетащи тренировку на другой день (или нажми на неё, а потом на день), «+» на дне отдыха добавляет тренировку, крестик делает день выходным.",
    "Не хочешь программу — открой день в календаре и нажми «Записать тренировку» или «Взять из программ».",
  ]],
  ["Календарь", [
    "Переключатель «Неделя / Месяц» меняет вид, стрелки листают неделю или месяц, «Сегодня» возвращает к текущему дню.",
    "Нажми на день — под календарём откроется его тренировка.",
    "Точки: закрашенная — сделано, кружок — запланировано, серый кружок — пропущено.",
  ]],
  ["Тренировка", [
    "Нажми «Начать тренировку» — веса подставятся из прошлого раза, а если тогда сделал все повторы, то на 2,5 кг больше.",
    "Нажми на упражнение, чтобы раскрыть подходы: поправь вес и повторы, отметь подход галочкой — запустится таймер отдыха.",
    "Галочка справа отмечает упражнение целиком, «Отметить всё» — всю тренировку.",
    "Фото упражнения показывает, как его делать, и историю твоих весов.",
    "«Перенести на другой день» меняет тренировки местами, «Убрать с этого дня» делает день отдыхом.",
  ]],
  ["Тренер", [
    "Кнопка «Тренер» внизу справа. Первым сообщением он даёт совет на выбранный день.",
    "Можно спросить что угодно: какой вес поставить, что давно не тренировал, как заменить упражнение.",
    "Попроси «составь план на 4 недели» — тренер сам расставит тренировки в календаре. Не понравилось — «Отменить», и всё вернётся как было.",
  ]],
  ["Друзья", [
    "В «Профиле» — список всех, кто пользуется сайтом. Нажми на человека: его неделя, рабочие веса и последние тренировки.",
    "«Отправить тренировку»: выбери свою записанную или из программ, посмотри упражнения, выбери день, напиши пару слов — «Отправить». Одно и то же дважды не уйдёт.",
    "«Предложить программу» — так же: выбери, посмотри и отправь. Пока друг не ответил, предложение можно отозвать.",
    "Тебе прислали — на «Календаре» появится точка, а над календарём карточка. «Посмотреть» — выбрать день и добавить; если в этот день уже есть тренировка, упражнения допишутся к ней. «Отклонить» можно вернуть.",
    "Когда друг ответит, придёт уведомление, а на его странице увидишь «принято» или «отклонено».",
  ]],
  ["Профиль", [
    "Нажми на кружок с буквой — загрузишь своё фото, его увидят друзья. «Убрать фото» — вернуть букву.",
    "Имя видят друзья. Вес и рост нужны тренеру и для расчёта питания. Всё сохраняется само.",
    "Там же тема оформления и выход из аккаунта.",
  ]],
  ["На телефоне как приложение", [
    "iPhone: открой сайт в Safari → «Поделиться» → «На экран «Домой»».",
    "Android: в Chrome меню ⋮ → «Добавить на главный экран».",
  ]],
];
function helpView() {
  return `
    <div class="back"><a class="linkbtn muted-link" href="#/me">${I.left}Профиль</a></div>
    <section class="hero"><h1>Как пользоваться</h1><p class="lead">Главное — открыть календарь, увидеть сегодняшнюю тренировку и отметить сделанное. Остальное по желанию.</p></section>
    ${HELP.map(([t, items]) => `<section class="card"><h2 class="card-t">${t}</h2><ul class="help-list">${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>`).join("")}`;
}

/* ---------- program week ---------- */
// Неделя программы: у каждого дня своя тренировка или отдых. Тренировки перетаскиваются между днями
// (палец или мышь), либо нажатием: сначала на тренировку, потом на день.
function weekBoard(pr) {
  const lay = weekLayout(S.profile, pr), list = sessionsOf(pr), sel = S.wkSel;
  const label = v => pr.alternate ? "А / Б по очереди" : list[v]?.title || "Тренировка";
  const n = lay.filter(x => x != null).length;
  return `<div class="wk-board-head"><b>Твоя неделя</b><span class="muted">${n} ${plural(n, "тренировка", "тренировки", "тренировок")}</span></div>
    <p class="hint">Перетащи тренировку на другой день — дни поменяются местами. На свободный день можно добавить любую тренировку программы.</p>
    <ol class="wk-board ${sel != null ? "picking" : ""}">${lay.map((v, i) => `<li data-wd="${i}" class="${v == null ? "free" : ""} ${sel === i ? "sel" : ""}">
      <span class="wkb-d">${WD[i]}</span>
      ${v == null
        ? `<button class="wkb-free" data-act="wk-drop">${sel != null ? "Сюда" : `${I.plus}<span>Отдых</span>`}</button>`
        : `<button class="wkb-chip" data-act="wk-pick" aria-pressed="${sel === i}"><i class="grip" aria-hidden="true"></i><span>${esc(label(v))}</span></button>
           <button class="wkb-x" data-act="wk-off" aria-label="Сделать ${WD_FULL[i].toLowerCase()} отдыхом">${I.x}</button>`}
    </li>`).join("")}</ol>
    <div class="row"><button class="linkbtn muted-link" data-act="wk-reset">Как в программе</button></div>`;
}
function setLayout(lay) {
  const p = S.profile;
  p.program_week = lay; p.program_days = lay.map((v, i) => v == null ? null : i).filter(x => x != null); p.program_moves = {};
  S.wkSel = null; saveProfile(); rerender();
  if (!lay.some(x => x != null)) toast("Неделя пустая — в календаре не будет тренировок");
}
function moveInWeek(from, to) {
  const lay = weekLayout(S.profile, programById(S.profile.program_id));
  [lay[from], lay[to]] = [lay[to], lay[from]];
  setLayout(lay);
}
function addToDay(i) {
  const pr = programById(S.profile.program_id), lay = weekLayout(S.profile, pr);
  if (pr.alternate) { lay[i] = 0; return setLayout(lay); }
  const used = new Set(lay.filter(x => x != null));
  sheet(`${WD_FULL[i]}: какая тренировка`, `<div class="pick">${sessionsOf(pr).map((s, k) => `<button data-k="${k}"><b>${esc(s.title)}</b><span>${esc(s.focus || "")}${used.has(k) ? " · уже есть в неделе" : ""}</span></button>`).join("")}</div>`, (el, close) => {
    el.addEventListener("click", ev => { const b = ev.target.closest("[data-k]"); if (!b) return; lay[i] = +b.dataset.k; close(); setLayout(lay); });
  });
}
// Перетаскивание указателем: работает и пальцем на телефоне, и мышью. Короткое нажатие остаётся кликом.
document.addEventListener("pointerdown", ev => {
  const chip = ev.target.closest(".wkb-chip"); if (!chip || ev.button > 0) return;
  const from = +chip.closest("[data-wd]").dataset.wd, x0 = ev.clientX, y0 = ev.clientY;
  let ghost = null, over = null;
  const move = e => {
    if (!ghost) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 8) return;
      const r = chip.getBoundingClientRect();
      ghost = chip.cloneNode(true); ghost.classList.add("wkb-ghost");
      Object.assign(ghost.style, { width: r.width + "px", left: r.left + "px", top: r.top + "px" });
      ghost.dataset.dx = x0 - r.left; ghost.dataset.dy = y0 - r.top;
      document.body.append(ghost); chip.closest("li").classList.add("dragging");
    }
    e.preventDefault();
    ghost.style.left = e.clientX - ghost.dataset.dx + "px"; ghost.style.top = e.clientY - ghost.dataset.dy + "px";
    ghost.hidden = true; const li = document.elementFromPoint(e.clientX, e.clientY)?.closest(".wk-board li"); ghost.hidden = false;
    if (li !== over) { over?.classList.remove("over"); over = li; over?.classList.add("over"); }
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!ghost) return;
    ghost.remove(); document.querySelector(".wk-board li.dragging")?.classList.remove("dragging"); over?.classList.remove("over");
    S.dragged = true; setTimeout(() => { S.dragged = false; }); // клик сразу после перетаскивания не считается
    const to = over ? +over.dataset.wd : null;
    if (to != null && to !== from) moveInWeek(from, to);
  };
  addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", up); addEventListener("pointercancel", up);
});

/* ---------- шуточная программа: молнии ---------- */
// Фото шуточной программы — из закрытого хранилища, подписанные ссылки кэшируются.
S.fun = {};
function photoSrc(pr) {
  if (!pr.photo?.storage) return pr.photo?.src;
  if (S.fun[pr.photo.storage]) return S.fun[pr.photo.storage];
  loadFun().then(() => { if (route().path === "programs") rerender(); });
  return "";
}
let funLoading = null;
function loadFun() {
  const paths = PROGRAMS.flatMap(p => [p.photo?.storage, p.flash]).filter(Boolean);
  funLoading ||= sb.storage.from("gym-avatars").createSignedUrls(paths, 6 * 3600).then(({ data }) => {
    for (const d of data || []) if (d.signedUrl) { S.fun[d.path] = d.signedUrl; new Image().src = d.signedUrl; } // заранее прогреть картинку для вспышки
  }).catch(() => { funLoading = null; });
  return funLoading;
}
// Гроза: три вспышки с молниями (не чаще трёх в секунду), на второй — мелькает фото и исчезает.
function bolt(x) { // ломаная молния сверху вниз, в процентах экрана
  let px = x, py = -2, d = `M${px} ${py}`;
  while (py < 70 + Math.random() * 25) { px += (Math.random() - 0.5) * 14; py += 6 + Math.random() * 9; d += ` L${px.toFixed(1)} ${py.toFixed(1)}`; }
  const bx = px + (Math.random() - 0.5) * 20; // ответвление
  return `<path d="${d}"/><path class="br" d="M${px.toFixed(1)} ${py.toFixed(1)} L${bx.toFixed(1)} ${(py + 12).toFixed(1)}"/>`;
}
function storm(id) {
  if (document.querySelector(".storm")) return;
  const pr = programById(id), face = pr?.flash && S.fun[pr.flash];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "storm" + (calm ? " calm" : ""); el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="storm-sky"></div>
    ${[0, 1, 2].map(k => `<svg class="bolt b${k}" viewBox="0 0 100 100" preserveAspectRatio="none">${bolt(15 + k * 32 + Math.random() * 12)}</svg>`).join("")}
    <div class="storm-flash"></div>${face ? `<img class="storm-face" src="${face}" alt="">` : ""}`;
  document.body.append(el);
  navigator.vibrate?.([60, 440, 60, 440, 120]);
  setTimeout(() => el.remove(), calm ? 1600 : 2500);
}
document.addEventListener("toggle", ev => { const d = ev.target; if (d.dataset?.storm && d.open) { loadFun().then(() => storm(d.dataset.storm)); } }, true);

/* ---------- diet ---------- */
// Питание звёздных программ: как ел сам спортсмен, сколько есть тебе (по весу из профиля) и пример дня.
const DIET = { // ккал на кг веса, белок и жиры — г на кг; углеводы — остаток
  mass: { kcal: 35, p: 2.2, f: 1, label: "набор массы" },
  lean: { kcal: 31, p: 2.4, f: 0.9, label: "сухая масса" },
};
function dietHTML(pr) {
  const d = pr.diet, g = DIET[d.goal], w = S.profile?.weight_kg;
  const calc = w ? (() => { const kcal = Math.round(w * g.kcal / 50) * 50, p = Math.round(w * g.p), f = Math.round(w * g.f), c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return `<div class="macros"><div><b>${fmt(kcal)}</b><span>ккал</span></div><div><b>${p} г</b><span>белок</span></div><div><b>${f} г</b><span>жиры</span></div><div><b>${c} г</b><span>углеводы</span></div></div>
      <p class="hint">Посчитано на твой вес ${fmt(w, 1)} кг под цель «${g.label}». Если за 2 недели вес не меняется — добавь 200 ккал, если растёт быстрее 0,5 кг в неделю — убери.</p>`; })()
    : `<p class="hint">Укажи вес в <a href="#/me">профиле</a> — посчитаем калории, белки, жиры и углеводы под тебя. Ориентир: белок ${g.p} г на кг веса, жиры ${g.f} г на кг.</p>`;
  return `<details class="fold diet"><summary>Питание</summary>
    <div class="diet-in">
      <div class="diet-block"><div class="eyebrow">Как ел он</div><ul class="diet-how">${d.how.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="diet-block"><div class="eyebrow">Сколько есть тебе</div>${calc}</div>
      <div class="diet-block"><div class="eyebrow">Пример дня · порции на ~80 кг</div>
        <ol class="diet-day">${d.day.map(([t, x]) => `<li><b>${esc(t)}</b><span>${esc(x)}</span></li>`).join("")}</ol>
        <p class="hint">Порции меняй пропорционально своему весу. Это ориентир, а не медицинская рекомендация.</p></div>
    </div></details>`;
}

/* ---------- profile ---------- */
function profileView() {
  const p = S.profile, th = getTheme(), prog = programById(p.program_id), t = today();
  const done = S.workouts.filter(w => w.day <= t && dayStatus(w.day).st === "done");
  const month = done.filter(w => w.day.slice(0, 7) === t.slice(0, 7)).length;
  const lay = prog ? weekLayout(p, prog) : [], days = WD.filter((_, i) => lay[i] != null).map(w => w.toLowerCase()).join(", ");
  return `
    <section class="hero me">
      <label class="ava-edit" aria-label="Сменить фото профиля">${avatarHTML(S.user.id, p.name || S.user.email)}<input type="file" accept="image/*" hidden data-field="p-avatar"><span class="ava-cam" aria-hidden="true">${I.camera}</span></label>
      <div><h1>${esc(p.name || "Профиль")}</h1><p class="muted">${esc(S.user.email)}</p>${p.avatar ? `<button class="linkbtn muted-link ava-rm" data-act="ava-rm">Убрать фото</button>` : `<p class="hint">Нажми на кружок — добавишь своё фото</p>`}</div>
    </section>
    <div class="stats">
      <div><b>${done.length}</b><span>${plural(done.length, "тренировка", "тренировки", "тренировок")} всего</span></div>
      <div><b>${month}</b><span>в ${MON[new Date().getMonth()].replace(/я$/, "е").replace(/а$/, "е")}</span></div>
    </div>
    <a class="card help-link" href="#/help"><span><b>Как пользоваться сайтом</b><span class="hint">Календарь, тренировки, программы, тренер и друзья — коротко</span></span>${I.right}</a>
    ${S.people.length ? `<section class="card">
      <h2 class="card-t">Друзья</h2>
      <div class="people">${S.people.map(u => `<a class="person" href="#/u/${u.user_id}">
        ${avatarHTML(u.user_id, u.name, "sm")}
        <span class="person-t"><b>${esc(u.name || "Без имени")}</b><span>${esc(programById(u.program_id)?.title || "без программы")}</span></span>${I.right}</a>`).join("")}</div>
    </section>` : ""}
    <section class="card">
      <h2 class="card-t">Программа</h2>
      ${prog ? `<div class="card-p"><b>${esc(prog.title)}</b><p class="hint">${lay.filter(x => x != null).length} ${plural(lay.filter(x => x != null).length, "тренировка", "тренировки", "тренировок")} в неделю: ${days}</p></div>`
        : `<p class="hint">Программа не выбрана — тренировки записываются вручную.</p>`}
      <a class="linkbtn card-link" href="#/programs">${prog ? "Сменить или настроить дни" : "Выбрать программу"}${I.right}</a>
    </section>
    <section class="card">
      <h2 class="card-t">О себе</h2>
      <label class="field"><span>Имя</span><input class="inp" data-field="p-name" value="${esc(p.name)}" maxlength="40"></label>
      <div class="grid2">
        <label class="field"><span>Вес, кг</span><input class="inp" data-field="p-weight_kg" inputmode="decimal" value="${p.weight_kg ?? ""}" placeholder="например, 78"></label>
        <label class="field"><span>Рост, см</span><input class="inp" data-field="p-height_cm" inputmode="decimal" value="${p.height_cm ?? ""}" placeholder="например, 180"></label>
      </div>
      <p class="hint">Тренер учитывает вес и рост, когда подбирает нагрузку. Сохраняется само.</p>
    </section>
    <section class="card">
      <h2 class="card-t">Оформление</h2>
      <div class="seg full" role="radiogroup" aria-label="Тема">${[["system", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([k, l]) => `<button role="radio" data-act="theme" data-v="${k}" aria-checked="${th === k}">${l}</button>`).join("")}</div>
    </section>
    <section class="card">
      <h2 class="card-t">Аккаунт</h2>
      <p class="hint">Вход по почте ${esc(S.user.email)}. Тренировки хранятся в аккаунте и видны на любом устройстве.</p>
      <div><button class="btn danger-soft" data-act="logout">Выйти из аккаунта</button></div>
    </section>`;
}

/* ---------- events ---------- */
document.addEventListener("click", ev => {
  const home = ev.target.closest('a[href="#/"]');
  if (home && S.user) {
    S.day = today(); S.moving = null; S.open.clear();
    if (!location.hash || location.hash === "#/") { ev.preventDefault(); render(); scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  const b = ev.target.closest("[data-act]"); if (!b || b.closest(".sheet") || S.dragged) return;
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
    case "shift": {
      const n = +b.dataset.n;
      if (getCalView() === "week") { const d = addDays(S.day, 7 * n); S.day = monday(d) === monday(today()) ? today() : monday(d); }
      else { const d0 = parse(S.day), d = new Date(d0.getFullYear(), d0.getMonth() + n, 1); S.day = iso(d).slice(0, 7) === today().slice(0, 7) ? today() : iso(d); }
      rerender(); break;
    }
    case "cal-view": try { localStorage.setItem("gym-cal-view", b.dataset.v); } catch {} rerender(); break;
    case "today": S.day = today(); rerender(); break;
    case "photo": photoSheet(b.dataset.name); break;
    case "coach": coachChat(); break;
    case "mu-play": { const i = +b.dataset.i; if (i === M.i) M.audio.paused ? M.audio.play().catch(() => {}) : M.audio.pause(); else { M.queue = visibleTracks().map(x => x.t.file); playAt(i); } break; }
    case "mu-all": { const v = visibleTracks(); M.queue = v.map(x => x.t.file); if (!v.length) break; playAt(M.shuffle ? v[Math.floor(Math.random() * v.length)].i : v[0].i); break; }
    case "mu-folder": {
      const x = document.querySelector(".folders")?.scrollLeft || 0;
      M.folder = b.dataset.id || null; M.q = ""; rerender();
      const strip = document.querySelector(".folders"); if (strip) strip.scrollLeft = x; // полоса папок остаётся на месте
      break;
    }
    case "mu-fav": toggleFav(+b.dataset.i); break;
    case "mu-q-clear": M.q = ""; rerender(); document.querySelector("[data-field=mu-q]")?.focus(); break;
    case "prog-where": S.progWhere = b.dataset.v; rerender(); break;
    case "mu-track-menu": trackMenu(+b.dataset.i); break;
    case "mu-new-folder": newFolderSheet(); break;
    case "mu-folder-menu": folderMenu(); break;
    case "mu-shuffle": M.shuffle = !M.shuffle; b.setAttribute("aria-pressed", M.shuffle); break;
    case "help-hide": try { localStorage.setItem("gym-help-hidden", "1"); } catch {} rerender(); break;
    case "send-w": sendWorkoutSheet(b.dataset.u); break;
    case "send-p": sendProgramSheet(b.dataset.u); break;
    case "share-open": acceptSheet(S.shares.find(x => x.id === b.dataset.id)); break;
    case "share-no": { const sh = S.shares.find(x => x.id === b.dataset.id); b.classList.add("loading"); b.disabled = true;
      try { await declineShare(sh); } catch { b.classList.remove("loading"); b.disabled = false; } break; }
    case "ava-rm": removeAvatar(); break;
    case "storm": loadFun().then(() => storm(b.dataset.id)); break;
    case "share-cancel": b.disabled = true; cancelShare(b.dataset.id).catch(() => { b.disabled = false; }); break;
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
      p.program_id = pr.id; p.program_days = pr.defaultDays; p.program_week = defaultLayout(pr); p.program_start = today(); p.program_moves = {};
      saveProfile(); rerender(); scrollTo({ top: 0, behavior: "smooth" }); toast(`«${pr.title}» — в календаре`); break;
    }
    case "wk-pick": { // выбор без перетаскивания: нажал на тренировку, потом на день
      const i = +b.closest("[data-wd]").dataset.wd;
      if (S.wkSel == null) { S.wkSel = i; rerender(); }
      else if (S.wkSel === i) { S.wkSel = null; rerender(); }
      else moveInWeek(S.wkSel, i);
      break;
    }
    case "wk-drop": if (S.wkSel != null) moveInWeek(S.wkSel, +b.closest("[data-wd]").dataset.wd); else addToDay(+b.closest("[data-wd]").dataset.wd); break;
    case "wk-off": { const i = +b.closest("[data-wd]").dataset.wd, lay = weekLayout(S.profile, programById(S.profile.program_id)); lay[i] = null; setLayout(lay); break; }
    case "wk-reset": setLayout(defaultLayout(programById(S.profile.program_id))); break;
    case "prog-off": {
      if (!await confirmSheet("Убрать программу из календаря?", "Запланированные дни исчезнут. Уже записанные тренировки останутся.", "Убрать")) return;
      Object.assign(S.profile, { program_id: null, program_start: null, program_days: null, program_week: null, program_moves: {} }); saveProfile(); rerender(); break;
    }
    case "theme": setTheme(b.dataset.v); b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); break;
    case "logout":
      if (await confirmSheet("Выйти из аккаунта?", "Тренировки сохранены — увидишь их снова, когда войдёшь с этой почтой.", "Выйти")) await sb.auth.signOut();
      break;
  }
}

document.addEventListener("input", ev => {
  const el = ev.target, f = el.dataset?.field; if (!f) return;
  if (f === "mu-q") { // список обновляется без перерисовки поля — фокус и курсор остаются
    M.q = el.value; const box = document.getElementById("mu-list"); if (box) box.innerHTML = musicList();
    const lab = el.closest(".mu-search"); lab.querySelector("button")?.remove();
    if (M.q) lab.insertAdjacentHTML("beforeend", `<button type="button" data-act="mu-q-clear" aria-label="Очистить поиск">${I.x}</button>`);
    document.querySelectorAll(".fold-card").forEach(c => c.classList.toggle("on", !M.q && (c.dataset.id || null) === M.folder));
    return;
  }
  const w = workoutOn(S.day), li = el.closest("[data-ex]"), e = li && S.exercises.find(x => x.id === li.dataset.ex);
  if (f === "w-title") { w.title = el.value; refreshDayBits(); later("wt", () => q(sb.from("gym_workouts").update({ title: w.title.trim() }).eq("id", w.id))); }
  else if (f === "set-w" || f === "set-r") { const i = +el.closest(".set").dataset.i; e.sets[i][f === "set-w" ? "w" : "r"] = num(el.value); saveEx(e); }
  else if (f === "p-name") { S.profile.name = el.value; document.querySelector(".hero h1").textContent = el.value || "Профиль"; const av = document.querySelector(".ava-edit .me-ava:not(.has-img)"); if (av) av.textContent = (el.value || S.user.email || "?").trim()[0]?.toUpperCase() || "?"; saveProfile(); }
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
  chatEl?.remove(); chatDim.remove(); chatEl = null; stopMusic(); document.documentElement.classList.remove("chat-open"); // чат другого аккаунта не показываем
  render();
  if (u) loadAll().then(() => { render(); loadTracks().catch(() => {}); }).catch(() => { app.querySelector("#main").innerHTML = `<div class="hero"><p class="muted">Не получилось загрузить данные.</p><div><button class="btn" onclick="location.reload()">Обновить</button></div></div>`; });
});
// на вкладке, открытой с вечера, «сегодня» должно сдвинуться
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.loaded) { const t = today(); if (S._t && S._t !== t) { S.day = t; render(); } S._t = t; } });
S._t = today();

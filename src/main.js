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
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
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
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
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
  lookAnim();
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  themeColor();
}
// Палитра (фон, карточки, текст) и цвет кнопок — как на английской платформе. По умолчанию — «Классика» и бирюзовый
// (без атрибута); остальное ставится на <html> как data-palette / data-accent, цвета страницы — в style.css.
const ACCENTS = {
  teal: { label: "Бирюзовый", l: "#0B7A75", d: "#46BFB6" }, blue: { label: "Синий", l: "#3563A8", d: "#86A9E0" },
  lavender: { label: "Лавандовый", l: "#6B55A3", d: "#B3A1E6" }, rose: { label: "Пыльная роза", l: "#A04868", d: "#E39AB3" },
  graphite: { label: "Графит", l: "#4A5561", d: "#AEB8C2" }, ocean: { label: "Морской", l: "#1B6A8E", d: "#7CC4E3" },
  indigo: { label: "Индиго", l: "#3F47B5", d: "#A3A9F2" }, plum: { label: "Сливовый", l: "#7D3A79", d: "#DBA4D5" },
  cocoa: { label: "Какао", l: "#7A5131", d: "#D8B48F" },
};
const PALETTES = { // [фон, карточка, текст, линия] для светлой и тёмной — для превью и цвета строки браузера
  classic: { label: "Классика", l: ["#F3F5F2", "#FFFFFF", "#18212B", "#D9E0DC"], d: ["#11161B", "#1A2128", "#E7ECEF", "#2C3740"] },
  paper: { label: "Бумага", l: ["#F6F1E7", "#FFFCF5", "#2B2620", "#E4DACB"], d: ["#1A1714", "#24201B", "#EDE6DA", "#3A332B"] },
  mint: { label: "Мята", l: ["#EAF4EF", "#FFFFFF", "#15241E", "#CFE2D8"], d: ["#0F1A16", "#172520", "#E3EFE9", "#263A33"] },
  night: { label: "Ночь", l: ["#EFF2F8", "#FFFFFF", "#161C2C", "#D6DCE8"], d: ["#0D1322", "#151D31", "#E4E9F5", "#27314A"] },
  sand: { label: "Песок", l: ["#F2EADF", "#FBF6EF", "#2B2219", "#E2D3BF"], d: ["#1C1610", "#28201A", "#F0E5D6", "#3F3428"] },
  sage: { label: "Шалфей", l: ["#EEF1EA", "#FAFBF7", "#1E2620", "#D6DDD2"], d: ["#131814", "#1C231D", "#E4EAE2", "#2D372E"] },
  sepia: { label: "Сепия", l: ["#F4ECD8", "#FBF4E3", "#3B2F22", "#E3D5B8"], d: ["#1E1912", "#2A231A", "#EADCC2", "#43382A"] },
  oled: { label: "Графит", l: ["#F2F3F5", "#FFFFFF", "#16191D", "#D8DCE1"], d: ["#000000", "#0E0F11", "#ECEEF0", "#26292D"] },
  contrast: { label: "Контраст", l: ["#FFFFFF", "#FFFFFF", "#000000", "#5F676E"], d: ["#000000", "#0D0D0D", "#FFFFFF", "#8A949C"] },
};
const LOOK = { accent: ["gym-accent", ACCENTS, "teal"], palette: ["gym-palette", PALETTES, "classic"] };
const getLook = k => { const [key, set, def] = LOOK[k]; try { const v = localStorage.getItem(key); return v && Object.hasOwn(set, v) ? v : def; } catch { return def; } };
function setLook(k, v) {
  const [key, set, def] = LOOK[k]; if (!Object.hasOwn(set, v)) return;
  try { v === def ? localStorage.removeItem(key) : localStorage.setItem(key, v); } catch {}
  lookAnim();
  if (v === def) delete document.documentElement.dataset[k]; else document.documentElement.dataset[k] = v;
  themeColor();
}
let lookTimer;
function lookAnim() { // цвета перетекают плавно, а не щёлкают
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("theme-anim"); clearTimeout(lookTimer);
  lookTimer = setTimeout(() => document.documentElement.classList.remove("theme-anim"), 320);
}
const darkNow = () => getTheme() === "dark" || (getTheme() === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
function themeColor() { // строка браузера и статус-бар телефона — в цвет фона палитры
  const p = PALETTES[getLook("palette")], t = getTheme();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const add = (c, media) => { const m = document.createElement("meta"); m.name = "theme-color"; m.content = c; if (media) m.media = media; document.head.append(m); };
  if (t === "system") { add(p.l[0], "(prefers-color-scheme: light)"); add(p.d[0], "(prefers-color-scheme: dark)"); } else add(p[t === "dark" ? "d" : "l"][0]);
}
themeColor();
const palPreview = k => { const c = PALETTES[k][darkNow() ? "d" : "l"];
  return `<span class="pal-prev" style="--p-bg:${c[0]};--p-surface:${c[1]};--p-ink:${c[2]};--p-line:${c[3]}" aria-hidden="true"><i></i><i></i><b><i></i><u></u></b></span>`; };

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
  obLoad(); applyOutbox(); snapLater();
  S.loaded = true; S.offline = false;
}
/* ---------- без сети: очередь записей и снимок данных на телефоне ---------- */
// Отметки подходов, новые упражнения и тренировки сначала попадают в очередь (localStorage) и отправляются,
// как только есть связь. Номера записей придумываются на телефоне, поэтому начать тренировку можно и без сети.
const OB_KEY = () => `gym-outbox-${S.user?.id}`, SNAP_KEY = () => `gym-snap-${S.user?.id}`;
let outbox = [], syncFail = false, flushP = null, flushTimer;
const TABLE_OF = { gym_workouts: () => S.workouts, gym_exercises: () => S.exercises };
function obLoad() { try { outbox = JSON.parse(localStorage.getItem(OB_KEY()) || "[]"); } catch { outbox = []; } }
function obSave() { try { outbox.length ? localStorage.setItem(OB_KEY(), JSON.stringify(outbox)) : localStorage.removeItem(OB_KEY()); } catch {} paintSync(); }
// op: { k: "таблица:id", t, kind: "upsert" | "update", id, row }; правки одной записи сливаются в одну
function enqueue(op) {
  const same = outbox.find(o => o.k === op.k);
  if (same) same.row = { ...same.row, ...op.row }; else outbox.push(op);
  obSave(); snapLater(); return flush();
}
const isNetErr = e => !navigator.onLine || /fetch|network|load failed|timed? ?out|abort/i.test(e?.message || String(e));
function flush() {
  if (!S.user || !outbox.length) return Promise.resolve();
  return flushP ||= (async () => {
    try {
      while (outbox.length) {
        const op = outbox[0], b = sb.from(op.t);
        const { error } = op.kind === "upsert" ? await b.upsert(op.row, { onConflict: "id" }) : await b.update(op.row).eq("id", op.id);
        if (error && isNetErr(error)) { syncFail = true; break; }
        if (error) { console.error(error); toast("Одна запись не сохранилась — обнови страницу"); }
        syncFail = false; outbox.shift(); obSave();
      }
    } catch (e) { syncFail = true; }
    finally {
      flushP = null; paintSync(); clearTimeout(flushTimer);
      if (outbox.length) flushTimer = setTimeout(flush, 15000);
      else if (S.offline) refreshAfterOffline(); // связь вернулась — подтянуть свежие данные
    }
  })();
}
addEventListener("online", () => { if (outbox.length) flush(); else if (S.offline) refreshAfterOffline(); paintSync(); });
addEventListener("offline", paintSync);
document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });
// записи из очереди поверх загруженных данных (если страницу перезагрузили до отправки)
function applyOutbox() {
  for (const op of outbox) {
    const arr = TABLE_OF[op.t]?.(); if (!arr) continue;
    const id = op.kind === "upsert" ? op.row.id : op.id, cur = arr.find(x => x.id === id);
    if (cur) Object.assign(cur, op.row); else if (op.kind === "upsert") arr.push({ user_id: S.user.id, created_at: new Date().toISOString(), plan: null, done: false, ...op.row });
  }
}
const snapLater = () => later("snap", () => {
  try { localStorage.setItem(SNAP_KEY(), JSON.stringify({ at: Date.now(), profile: S.profile, workouts: S.workouts, exercises: S.exercises, people: S.people, shares: S.shares })); } catch {}
}, 800);
function fromSnapshot() {
  let snap; try { snap = JSON.parse(localStorage.getItem(SNAP_KEY()) || "null"); } catch {}
  if (!snap?.profile) return false;
  Object.assign(S, { profile: snap.profile, workouts: snap.workouts || [], exercises: snap.exercises || [], people: snap.people || [], shares: snap.shares || [], friends: {}, avatars: S.avatars || {}, loaded: true, offline: true });
  applyOutbox();
  clearInterval(fromSnapshot.t); fromSnapshot.t = setInterval(() => { if (!S.offline) clearInterval(fromSnapshot.t); else refreshAfterOffline(); }, 20000);
  return true;
}
let refreshing = false;
async function refreshAfterOffline() {
  if (refreshing || !navigator.onLine) return; refreshing = true;
  try { await loadAll(); S.offline = false; paintSync(); rerender(); } catch {} finally { refreshing = false; }
}
// плашка сверху: только когда есть неотправленное и нет связи
function paintSync() {
  let el = document.getElementById("sync");
  const show = !!S.user && (outbox.length > 0 && (syncFail || !navigator.onLine) || !!S.offline);
  if (!show) { if (el) { delete el.dataset.want; el.classList.remove("on"); } return; }
  if (!el) { el = document.createElement("div"); el.id = "sync"; el.className = "sync"; el.setAttribute("role", "status"); document.body.append(el); }
  el.innerHTML = `<i aria-hidden="true"></i><span>${outbox.length ? `Нет сети — отметки сохранятся, когда появится связь · ${outbox.length}` : "Нет связи — показаны последние сохранённые данные"}</span>`;
  el.dataset.want = "1"; requestAnimationFrame(() => { if (el.dataset.want) el.classList.add("on"); }); // плашку могли уже убрать до кадра
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
// История упражнения: лучший вес выполненных подходов за каждый день (до сегодня включительно).
function liftHistory(name, workouts = S.workouts, exercises = S.exercises) {
  const n = norm(name), t = today(), by = new Map();
  for (const e of exercises) {
    if (norm(e.name) !== n) continue;
    const d = workouts.find(w => w.id === e.workout_id)?.day; if (!d || d > t) continue;
    for (const x of e.sets || []) if ((x.done || e.done) && x.w != null && +x.w > 0 && (!by.has(d) || +x.w > by.get(d).w)) by.set(d, { d, w: +x.w, r: x.r });
  }
  return [...by.values()].sort((a, b) => a.d.localeCompare(b.d));
}
// лучший вес до этого дня (для отметки рекорда) — по выполненным подходам
const bestBefore = (name, day) => liftHistory(name).filter(p => p.d < day).reduce((m, p) => Math.max(m, p.w), 0);
// какой подход сегодня — рекорд: самый тяжёлый выполненный, если он тяжелее всех прошлых (первый раз — не рекорд)
function prSetIndex(e, day) {
  const prev = bestBefore(e.name, day); if (!prev) return -1;
  let k = -1, max = prev;
  (e.sets || []).forEach((x, i) => { if (x.done && x.w != null && +x.w > max) { max = +x.w; k = i; } });
  return k;
}
// все рекорды: лучший вес по каждому упражнению и когда он поставлен
function records(workouts = S.workouts, exercises = S.exercises) {
  const names = [...new Map(exercises.map(e => [norm(e.name), e.name])).values()].filter(Boolean);
  return names.map(n => { const h = liftHistory(n, workouts, exercises); if (!h.length) return null;
      const best = h.reduce((a, b) => b.w > a.w ? b : a); return { name: n, w: best.w, d: best.d, n: h.length }; })
    .filter(Boolean).sort((a, b) => b.d.localeCompare(a.d) || b.w - a.w);
}
// График рабочего веса: линия по датам, точка рекорда, подсказка при наведении или касании, под графиком — таблица.
function liftChart(name, uid) {
  const f = uid && uid !== S.user.id ? S.friends[uid] : null;
  const h = f ? liftHistory(name, f.workouts, f.exercises) : liftHistory(name);
  if (!h.length) return toast("По этому упражнению пока нет подходов с весом");
  const W = 320, H = 168, L = 34, R = 14, T = 16, B = 26;
  const ws = h.map(p => p.w), lo = Math.min(...ws), hi = Math.max(...ws), pad = Math.max(2.5, (hi - lo) * .15);
  const y0 = Math.max(0, Math.floor((lo - pad) / 2.5) * 2.5), y1 = Math.ceil((hi + pad) / 2.5) * 2.5;
  const t0 = +parse(h[0].d), t1 = +parse(h.at(-1).d), span = Math.max(1, t1 - t0);
  const X = p => h.length === 1 ? (L + W - R) / 2 : L + (+parse(p.d) - t0) / span * (W - L - R);
  const Y = w => T + (1 - (w - y0) / (y1 - y0 || 1)) * (H - T - B);
  const ticks = [y0, (y0 + y1) / 2, y1].map(v => Math.round(v * 2) / 2);
  const best = h.reduce((a, b) => b.w > a.w ? b : a), last = h.at(-1), first = h[0], dw = last.w - first.w;
  const path = h.map((p, i) => `${i ? "L" : "M"}${X(p).toFixed(1)},${Y(p.w).toFixed(1)}`).join("");
  const svg = `<svg class="lc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Рабочий вес: от ${fmt(first.w, 1)} до ${fmt(last.w, 1)} кг">
    ${ticks.map(v => `<line class="lc-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="lc-ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${fmt(v, 1)}</text>`).join("")}
    <text class="lc-ax" x="${L}" y="${H - 6}">${shortDay(first.d)}</text>${h.length > 1 ? `<text class="lc-ax" x="${W - R}" y="${H - 6}" text-anchor="end">${shortDay(last.d)}</text>` : ""}
    <path class="lc-line" d="${path}"/>
    ${h.map((p, i) => `<circle class="lc-dot ${p === best ? "best" : ""}" cx="${X(p)}" cy="${Y(p.w)}" r="${p === best ? 5 : 4}" data-k="${i}"/>`).join("")}
    <text class="lc-lab" x="${Math.min(X(best), W - R - 4)}" y="${Y(best.w) - 10}" text-anchor="${X(best) > W - 60 ? "end" : "middle"}">${fmt(best.w, 1)} кг</text>
    <line class="lc-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <rect class="lc-hit" x="${L}" y="0" width="${W - L - R}" height="${H}"/>
  </svg>`;
  const rows = [...h].reverse().slice(0, 8);
  sheet(name, `<div class="lc-sum">
      <div><b class="mono">${fmt(best.w, 1)} кг</b><span>рекорд · ${shortDay(best.d)}</span></div>
      <div><b class="mono ${dw > 0 ? "up" : ""}">${h.length > 1 ? (dw > 0 ? "+" : "") + fmt(dw, 1) + " кг" : "—"}</b><span>${h.length > 1 ? `с ${shortDay(first.d)}` : "пока одна тренировка"}</span></div>
      <div><b class="mono">${h.length}</b><span>${plural(h.length, "тренировка", "тренировки", "тренировок")}</span></div></div>
    <div class="lc-wrap">${svg}<div class="lc-tip" hidden></div></div>
    <table class="lc-table"><thead><tr><th>Дата</th><th>Лучший подход</th></tr></thead>
      <tbody>${rows.map(p => `<tr><td>${shortDay(p.d)}</td><td class="mono">${fmt(p.w, 1)} кг${p.r ? ` × ${p.r}` : ""}${p === best ? ` <span class="pr-tag">PR</span>` : ""}</td></tr>`).join("")}</tbody></table>`, el => {
    const svgEl = el.querySelector("svg.lc"), tip = el.querySelector(".lc-tip"), cross = el.querySelector(".lc-cross");
    const show = ev => {
      const r = svgEl.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      let k = 0; h.forEach((p, i) => { if (Math.abs(X(p) - x) < Math.abs(X(h[k]) - x)) k = i; });
      const p = h[k]; cross.setAttribute("x1", X(p)); cross.setAttribute("x2", X(p)); cross.setAttribute("visibility", "visible");
      el.querySelectorAll(".lc-dot").forEach(d => d.classList.toggle("on", +d.dataset.k === k));
      tip.hidden = false; tip.innerHTML = `<b>${fmt(p.w, 1)} кг${p.r ? ` × ${p.r}` : ""}</b><span>${shortDay(p.d)}</span>`;
      tip.style.left = Math.min(Math.max(X(p) / W * r.width, 50), r.width - 50) + "px";
    };
    const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); el.querySelectorAll(".lc-dot.on").forEach(d => d.classList.remove("on")); };
    svgEl.addEventListener("pointermove", show); svgEl.addEventListener("pointerdown", show); svgEl.addEventListener("pointerleave", hide);
  });
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
  const h = location.hash.replace(/^#\/?/, "").split("?")[0];
  if (h.startsWith("u/")) return { path: h, view: friendView, parent: ROUTES[3] }; // страница друга живёт внутри «Профиля»
  if (h === "help") return { path: h, view: helpView, parent: ROUTES[3] };
  return ROUTES.find(r => r.path === h) || ROUTES[0];
};

// ---------- анимации: только transform и opacity, короткие, без бесконечных циклов ----------
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let introDone = false;
// подсветка активного раздела переезжает со старого пункта на новый (FLIP: запомнили где была — сдвинули — отпустили)
function pillRects() { return [...document.querySelectorAll(".nav, .tabbar")].map(n => n.querySelector('[aria-current="page"]')?.getBoundingClientRect() || null); }
function slidePills(old) {
  if (calm()) return;
  document.querySelectorAll(".nav, .tabbar").forEach((n, k) => {
    const a = n.querySelector('[aria-current="page"]'), o = old[k]; if (!a || !o) return;
    const r = a.getBoundingClientRect(), dx = o.left - r.left; if (Math.abs(dx) < 1) return;
    a.style.setProperty("--from", dx + "px"); a.style.setProperty("--sx", n.classList.contains("nav") ? o.width / r.width : 1);
    a.classList.remove("slide"); void a.offsetWidth; a.classList.add("slide");
  });
}
// блоки экрана появляются волной: прямые дети экрана и строки недели, не больше дюжины
function staggerIn(main) {
  if (!main || calm()) return;
  const items = [...main.children].slice(0, 12);
  main.querySelectorAll(".week > *, .progs > *, .stats > *").forEach(x => items.length < 24 && items.push(x));
  items.forEach((x, i) => { x.classList.add("stg"); x.style.setProperty("--i", Math.min(i, 11)); });
}
// числа в плитках набегают от нуля
function countUp(main) {
  if (!main || calm() || document.hidden) return; // вкладка в фоне не рисует кадры — оставляем готовые числа
  main.querySelectorAll(".stats b").forEach(el => {
    const to = parseInt(el.textContent, 10); if (!(to > 0)) return;
    const t0 = performance.now(), dur = 700;
    const step = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    el.textContent = "0"; requestAnimationFrame(step);
  });
}
function render() {
  if (!S.user) return loginView();
  sidePosters();
  const r = route(), oldPills = pillRects();
  queueMicrotask(() => { if (S.loaded) S.fabShown = true; paintBadge(); }); // кнопка тренера въезжает только при первом показе
  const links = () => ROUTES.map(x => `<a href="#/${x.path}" ${x === r || x === r.parent ? 'aria-current="page"' : ""}>${x.icon}<span>${x.label}</span></a>`).join("");
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#/" aria-label="Train — на главную"><span class="brand-t" aria-hidden="true">Train</span><span aria-hidden="true">.</span></a><nav class="nav" aria-label="Разделы">${links()}</nav></header>
    <main class="wrap screen" id="main">${S.loaded ? r.view() : skeleton()}</main>
    <nav class="tabbar" aria-label="Разделы">${links()}</nav>
    ${S.loaded && r.path !== "music" ? `<button class="coach-fab ${S.fabShown ? "" : "enter"}" data-act="coach" aria-label="Открыть тренера">${bbSVG("fab")}<span>Тренер</span></button>` : ""}`;
  if (!introDone && S.loaded && !calm()) { introDone = true; app.querySelector(".brand").classList.add("intro"); } // логотип проявляется один раз за открытие сайта
  if (scrambleNext) { scrambleNext = false; setTimeout(() => scramble(app.querySelector(".brand .brand-t")), 30); }
  if (S.loaded) { const main = document.getElementById("main"); slidePills(oldPills); staggerIn(main); countUp(main); }
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
const tabIdx = () => { const r = route(); return ROUTES.indexOf(r.parent || r); };
let lastTab = tabIdx();
window.addEventListener("hashchange", () => {
  S.moving = null; S.friends = {}; S.wkSel = null;
  // переход между вкладками: экран уезжает в сторону, куда нажали (вправо по меню — содержимое приходит справа)
  const ti = tabIdx(), dir = Math.sign(ti - lastTab), root = document.documentElement; lastTab = ti;
  clearTimeout(root._dirT);
  if (dir && !calm()) { root.style.setProperty("--dir", dir); root.classList.add("tabdir"); root._dirT = setTimeout(() => root.classList.remove("tabdir"), 700); }
  else root.classList.remove("tabdir");
  const go = () => { render(); scrollTo({ top: 0 }); };
  // старый экран быстро гаснет, новый поднимается волной; шапка и нижнее меню — отдельными слоями, не мигают
  // между вкладками — без View Transition: снимок старого экрана задерживал отклик на нажатие; хватает сдвига блоков
  if (dir || !document.startViewTransition || calm() || document.hidden || !S.user) return go();
  root.classList.add("vt");
  document.startViewTransition(go).finished.finally(() => root.classList.remove("vt"));
});

/* ---------- login ---------- */
const FN_SIGNUP = "https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-signup";
// Удаление аккаунта: два предупреждения — обычное и с вводом слова «удалить».
async function deleteAccount() {
  if (!await confirmSheet("Удалить аккаунт?", "Пропадут все тренировки, программа, рабочие веса, фото и треки в профиле. Вернуть их не получится.", "Продолжить")) return;
  sheet("Точно удалить навсегда?", `<form class="del-form" data-del-form>
      <p class="muted">Это последнее предупреждение. Чтобы подтвердить, впиши слово <b>удалить</b>.</p>
      <input class="inp" name="w" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="удалить" aria-label="Слово для подтверждения">
      <p class="err" role="alert"></p>
      <div class="sheet-actions"><button class="btn quiet" type="button" data-close>Отмена</button><button class="btn danger" type="submit" disabled>Удалить навсегда</button></div></form>`, (el, close) => {
    const f = el.querySelector("form"), btn = f.querySelector("[type=submit]"), ok = () => norm(f.w.value) === "удалить";
    f.w.focus(); f.w.addEventListener("input", () => { btn.disabled = !ok(); });
    f.onsubmit = async ev => {
      ev.preventDefault(); ev.stopPropagation(); if (!ok()) return;
      btn.classList.add("loading"); btn.disabled = true;
      try {
        const { data: { session } } = await sb.auth.getSession();
        const r = await fetch("https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-delete-account", { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token, apikey: "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM" },
          body: JSON.stringify({ confirm: "удалить" }) }).then(x => x.json());
        if (!r.ok) throw new Error(r.error || "failed");
        try { Object.keys(localStorage).filter(k => k.includes(S.user.id) || k === POS_KEY).forEach(k => localStorage.removeItem(k)); } catch {}
        close(); await sb.auth.signOut(); toast(r.account_deleted ? "Аккаунт удалён" : "Данные дневника удалены");
      } catch { btn.classList.remove("loading"); btn.disabled = false; f.querySelector(".err").textContent = "Не получилось — проверь интернет и попробуй ещё раз"; }
    };
  });
}
// Постеры чемпионов на «стене» по бокам широкого экрана: по два с каждой стороны, как приклеенные скотчем.
function sidePosters() {
  if (document.querySelector(".wall")) return;
  const list = [...ATHLETES].sort(() => Math.random() - .5); // все восемь, по четыре с каждой стороны; порядок — случайный
  const wall = document.createElement("div"); wall.className = "wall";
  wall.innerHTML = list.map((a, k) => `<figure class="poster p${k}" data-ath="${a.id}" role="button" tabindex="0" aria-label="${esc(a.name)} — мотивация">
      <span class="tape a"></span><span class="tape b"></span>
      <span class="poster-ph"><img src="${a.src}" alt="" style="object-position:${a.pos}" decoding="async" loading="lazy"></span>
      <figcaption><b>${a.name}</b><span>${a.title.replace(" × ", "× ")}</span></figcaption></figure>`).join("");
  document.body.append(wall);
  wall.addEventListener("click", ev => { const p = ev.target.closest("[data-ath]"); if (p) athleteSheet(p.dataset.ath); });
  wall.addEventListener("keydown", ev => { const p = ev.target.closest("[data-ath]"); if (p && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); athleteSheet(p.dataset.ath); } });
}
// Мотивация от атлета — как постер: фото на всю карточку, цитата крупно поверх, имя огромными буквами внизу.
// Фразы — только известные; у кого их нет — реальная история. Кнопка ведёт к его программе.
function athleteSheet(id) {
  const a = ATHLETES.find(x => x.id === id); if (!a) return;
  const pr = a.prog && programById(a.prog), [first, ...rest] = a.short || a.name.replace(/«|»/g, "").split(" ");
  const ov = document.createElement("div"); ov.className = "ath-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", a.name);
  ov.innerHTML = `<article class="ath-poster">
      <span class="tape a" aria-hidden="true"></span><span class="tape b" aria-hidden="true"></span>
      <img src="${a.src}" alt="" style="object-position:${a.id === "rock" ? a.pos : "50% 10%"}">
      <div class="ap-top"><span>Train · легенды</span><span>${esc(a.title)}</span></div>
      <div class="ap-body">
        ${a.quotes ? `<blockquote class="ap-q">${esc(a.quotes[0])}</blockquote>` : `<p class="ap-q story">${esc(a.story)}</p>`}
        <h2 class="ap-name" style="--len:${Math.max(first.length, ...rest.map(w => w.length), 4)}">${esc(first)}<br>${esc(rest.join(" "))}</h2>
        ${a.quotes ? `<p class="ap-story">${esc(a.story)}</p>` : ""}
        ${pr && S.user ? `<a class="ap-cta" href="#/programs" data-prog-go>Тренироваться как ${esc(a.short ? a.short[0] : first)}${I.right}</a>` : ""}
      </div>
    </article>
    <button class="ap-x" type="button" aria-label="Закрыть">${I.x}</button>`;
  const close = () => { ov.classList.remove("on"); document.removeEventListener("keydown", key); document.documentElement.classList.remove("lb-open"); setTimeout(() => ov.remove(), 260); };
  const key = ev => { if (ev.key === "Escape") close(); };
  ov.addEventListener("click", ev => {
    if (ev.target.closest("[data-prog-go]")) { close(); S.goProg = pr.id; if (route().path === "programs") { ev.preventDefault(); rerender(); } return; }
    if (ev.target === ov || ev.target.closest(".ap-x")) close();
  });
  document.addEventListener("keydown", key);
  document.body.append(ov); document.documentElement.classList.add("lb-open");
  requestAnimationFrame(() => ov.classList.add("on"));
  ov.querySelector(".ap-x").focus({ preventScroll: true });
}
// Логотип: при нажатии буквы быстро перебираются и по очереди встают на место.
function scramble(el) {
  if (!el || el.dataset.busy || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const word = "Train", pool = "TRAINMUSCLE0123456789#%&@", w = el.getBoundingClientRect().width;
  el.dataset.busy = "1"; el.style.display = "inline-block"; el.style.minWidth = w + "px";
  let f = 0;
  const tick = () => {
    f++;
    el.textContent = [...word].map((c, i) => f > 5 + i * 3 ? c : pool[Math.floor(Math.random() * pool.length)]).join("");
    el.classList.toggle("scr", f <= 5 + (word.length - 1) * 3);
    if (f <= 5 + (word.length - 1) * 3) setTimeout(tick, 42); else { delete el.dataset.busy; el.style.minWidth = ""; }
  };
  tick();
}
// Нажатие на логотип в шапке ведёт на главную и перерисовывает шапку — перебор запускаем уже на новом логотипе.
let scrambleNext = false;
document.addEventListener("click", ev => {
  const h = ev.target.closest(".brand, [data-scramble]"); if (!h) return;
  if (!h.classList.contains("brand")) return scramble(h.querySelector(".brand-t"));
  scrambleNext = true;
  setTimeout(() => { if (scrambleNext) { scrambleNext = false; scramble(document.querySelector(".brand .brand-t")); } }, 160); // если перерисовки не было
});
// Легенды «Мистер Олимпия» на странице входа. Фото — Wikimedia Commons, авторы и лицензии — под формой.
const ATHLETES = [
  { id: "arnold", src: "/img/arnold.jpg", name: "Арнольд Шварценеггер", title: "7 × «Мистер Олимпия»", pos: "50% 18%",
    quotes: ["Последние три-четыре повтора — вот что заставляет мышцу расти. Эта зона боли отделяет чемпиона от того, кто им не станет.",
      "Разум — вот предел. Если разум видит, что ты можешь что-то сделать, — ты сможешь, если веришь в это на все сто."],
    from: "из фильма «Качая железо», 1977",
    story: "Приехал в Америку почти без денег и английского — и стал семикратным «Мистером Олимпия», звездой кино и губернатором Калифорнии." },
  { id: "coleman", src: "/img/ronnie-coleman.jpg", name: "Ронни Коулман", title: "8 × «Мистер Олимпия»", pos: "50% 20%", prog: "coleman",
    quotes: ["Все хотят быть бодибилдерами, но никто не хочет поднимать по-настоящему тяжёлые веса.", "Лёгкий вес, бэйби!"],
    from: "его фразы из зала",
    story: "Работал полицейским в Арлингтоне и тренировался после смен. Восемь раз подряд выиграл «Мистера Олимпия» — рекорд, который делит только с Ли Хейни." },
  { id: "heath", src: "/img/phil-heath.jpg", name: "Фил Хит", title: "7 × «Мистер Олимпия»", pos: "50% 12%", prog: "phil-heath",
    story: "Играл в баскетбол за университет и пришёл в бодибилдинг только в 22 года. Через девять лет стал «Мистером Олимпия» — и выигрывал семь лет подряд, с 2011 по 2017." },
  { id: "cutler", src: "/img/jay-cutler.jpg", name: "Джей Катлер", title: "4 × «Мистер Олимпия»", pos: "45% 25%", prog: "cutler",
    story: "Четыре раза был вторым после Коулмана — в 2001, 2003, 2004 и 2005 годах. Не сдался и в 2006-м победил. А в 2009-м стал первым, кто вернул себе титул после того, как его потерял." },
  { id: "yates", src: "/img/dorian-yates.jpg", name: "Дориан Йейтс", title: "6 × «Мистер Олимпия»", pos: "50% 15%", prog: "dorian-yates",
    story: "Тренировался в подвальном зале в Бирмингеме, вдали от звёздных залов Калифорнии. Короткие тренировки, один подход до отказа — и шесть титулов подряд, с 1992 по 1997." },
  { id: "kai", src: "/img/kai-greene.jpg", name: "Кай Грин", title: "3 × Arnold Classic", pos: "50% 16%", prog: "kai-greene",
    story: "Вырос в приёмных семьях в Бруклине; заниматься бодибилдингом его подтолкнул школьный учитель. Трижды выиграл Arnold Classic и трижды был вторым на «Мистере Олимпия»." },
  { id: "priest", src: "/img/lee-priest.jpg", name: "Ли Прист", title: "IFBB Pro, «Блондинистый миф»", pos: "50% 20%", prog: "lee-priest",
    story: "Начал выступать подростком, а в 21 год уже был профессионалом. Рост около 163 см — и одни из самых больших рук в истории спорта." },
  { id: "rock", src: "/img/the-rock.jpg", name: "Дуэйн «Скала» Джонсон", short: ["Скала", "Джонсон"], title: "актёр и рестлер", pos: "20% 4%", prog: "the-rock",
    quotes: ["Кровь, пот и уважение. Первые два ты отдаёшь, последнее — зарабатываешь."],
    story: "После того как его выгнали из канадской футбольной лиги, у него в кармане было семь долларов. В честь этого он назвал свою компанию Seven Bucks — и стал самым высокооплачиваемым актёром Голливуда." },
];
// Лицензии CC BY / CC BY-SA требуют указать авторов — список открывается по ссылке «Авторы фото».
const ATH_CREDITS = [
  ["Арнольд Шварценеггер", "Madison Square Garden Center, общественное достояние", "https://commons.wikimedia.org/wiki/File:Arnold_Schwarzenegger_1974.jpg"],
  ["Ронни Коулман", "localfitness.com.au, CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Ronnie_Coleman_8_x_Mr_Olympia_-_2009_-_4.png"],
  ["Фил Хит", "Kevin Laval, «Мистер Олимпия» 2012, CC0", "https://commons.wikimedia.org/wiki/File:Phil_Heath_Kai_Greene.JPG"],
  ["Джей Катлер", "Morten Skovgaard, CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Jay_Cutler_%E2%80%93_Loaded_039_(15263347890).jpg"],
  ["Кай Грин", "neverfearfailure.com, CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Kai_greene_arnold_classic.jpg"],
  ["Дуэйн «Скала» Джонсон", "Spc. Casey Brumbach, U.S. Army, общественное достояние", "https://commons.wikimedia.org/wiki/File:Dwayne_Johnson_Daytona_500_8246702.jpg"],
];
function loginView(mode = "in") {
  const up = mode === "up";
  const card = a => `<figure class="ath" data-ath="${a.id}" role="button" tabindex="0" aria-label="${esc(a.name)} — мотивация"><img src="${a.src}" alt="" style="object-position:${a.pos}" decoding="async" onload="this.classList.add('ok')"><figcaption><b>${a.name}</b><span>${a.title}</span></figcaption></figure>`;
  app.innerHTML = `
    <main class="auth screen">
      <section class="auth-art" aria-label="Легенды бодибилдинга"><div class="auth-track">${[...ATHLETES, ...ATHLETES, ...ATHLETES].map(card).join("")}</div></section>
      <section class="auth-card">
      <div class="auth-brand">
        <span class="eyebrow">Дневник тренировок</span>
        <h1 class="auth-logo intro" data-scramble><span class="brand-t">Train</span><em>.</em></h1>
        <p class="lead">Тренируйся по программам чемпионов: календарь, рабочие веса и тренер, который видит твой прогресс.</p>
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
      <button type="button" class="auth-credit" data-credits>Авторы фото</button>
      </section>
    </main>`;
  app.querySelectorAll("[data-auth]").forEach(b => b.onclick = () => { if (b.dataset.auth !== mode) { const em = app.querySelector("[name=email]").value; loginView(b.dataset.auth); app.querySelector("[name=email]").value = em; } });
  app.querySelector(".auth-art").onclick = ev => { const c = ev.target.closest("[data-ath]"); if (c) athleteSheet(c.dataset.ath); };
  app.querySelector("[data-credits]").onclick = () => sheet("Авторы фото", `<p class="hint">Фото с Wikimedia Commons</p>
    <div class="pick">${ATH_CREDITS.map(([who, cr, url]) => `<a class="pick-row credit-row" href="${url}" target="_blank" rel="noopener"><span><b>${who}</b><span>${cr}</span></span>${I.right}</a>`).join("")}</div>`);
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
    <div class="sets">${(e.sets || []).map((s, i, _, pr = prSetIndex(e, dayOfWorkout(e.workout_id) || S.day)) => `
      <div class="set ${s.done ? "done" : ""} ${i === pr ? "pr" : ""}" data-i="${i}">
        <span class="n">${i === pr ? `<span class="pr-tag" title="Личный рекорд">PR</span>` : i + 1}</span>
        <label><input inputmode="decimal" data-field="set-w" value="${s.w ?? ""}" placeholder="—" aria-label="Вес, кг">кг</label>
        <label><input inputmode="numeric" data-field="set-r" value="${s.r ?? ""}" placeholder="—" aria-label="Повторы">раз</label>
        <button class="check sm" data-act="set-done" aria-pressed="${!!s.done}" aria-label="Подход ${i + 1} выполнен"><i>${I.check}</i></button>
        <button class="set-del" data-act="set-del" aria-label="Удалить подход">${I.x}</button>
      </div>`).join("")}
    </div>
    <div class="ex-foot">
      <span class="row" style="gap:16px"><button class="linkbtn" data-act="set-add">+ Подход</button><button class="linkbtn muted-link ex-chart" data-act="lift-chart" data-n="${esc(e.name)}">${I.chart}История веса</button></span>
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
const saveEx = e => later("ex" + e.id, () => enqueue({ k: "gym_exercises:" + e.id, t: "gym_exercises", kind: "update", id: e.id, row: { name: e.name, sets: e.sets, done: e.done } }), 500);

async function createWorkout(day, title = "", items = []) {
  const now = new Date().toISOString(), w = { id: uid(), user_id: S.user.id, day, title, note: "", feeling: null, created_at: now };
  S.workouts.push(w);
  enqueue({ k: "gym_workouts:" + w.id, t: "gym_workouts", kind: "upsert", row: { id: w.id, day, title } });
  for (const [i, it] of items.entries()) {
    const row = { id: uid(), workout_id: w.id, position: i, name: it.name, plan: it.plan || null, sets: (it.sets || []).map(s => ({ w: s.w ?? null, r: s.r ?? null, done: false })), done: false };
    S.exercises.push({ ...row, user_id: S.user.id, created_at: now });
    enqueue({ k: "gym_exercises:" + row.id, t: "gym_exercises", kind: "upsert", row });
  }
  return w; // отправка идёт в фоне; кто следом шлёт запрос со ссылкой на эту тренировку — сначала ждёт flush()
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
    case "set-done": { const i = +b.closest(".set").dataset.i; e.sets[i].done = !e.sets[i].done; e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e);
      if (e.sets[i].done) { restTimer(); const d = dayOfWorkout(e.workout_id) || S.day;
        if (prSetIndex(e, d) === i) toast(`Новый рекорд: ${e.name} — ${fmt(e.sets[i].w, 1)} кг (было ${fmt(bestBefore(e.name, d), 1)})`); }
      return saveEx(e); }
    case "set-add": { const ls = e.sets.at(-1) || {}; e.sets.push({ w: ls.w ?? null, r: ls.r ?? null, done: false }); e.done = false; replaceRow(e); saveEx(e);
      return document.querySelector(`[data-ex="${e.id}"] .set:last-child input`)?.focus(); }
    case "set-del": { const i = +b.closest(".set").dataset.i; e.sets.splice(i, 1); e.done = e.sets.length > 0 && e.sets.every(s => s.done); replaceRow(e); return saveEx(e); }
    case "ex-del": {
      S.exercises.splice(S.exercises.indexOf(e), 1); document.querySelector(`[data-ex="${e.id}"]`)?.remove(); refreshDayBits();
      const t = setTimeout(() => flush().catch(() => {}).then(() => q(sb.from("gym_exercises").delete().eq("id", e.id))), 5000);
      return toast(`«${e.name || "Упражнение"}» удалено`, { label: "Вернуть", run: () => { clearTimeout(t); S.exercises.push(e); rerender(); } });
    }
  }
}
// «Утро настоящего атлета»: у котов вместо истории весов — подпись к упражнению.
const CAT_NOTES = {
  "проснулся": "Главное — открыть глаза. Второе главное — не закрыть их обратно. Зевок засчитывается как разминка.",
  "покушац": "Быстрые углеводы, медленные углеводы, чужая колбаса — всё идёт в массу. Миска пуста — подход засчитан.",
  "покурыт": "Пять минут тишины и созерцания. Техника: лёг, расслабился, смотришь вдаль с видом философа.",
  "качат качат": "Жим лёжа по-кошачьи: спина на траве, лапы вверх. Потом растяжка на пороге. 4 подхода по 12 потягушек.",
  "идти работат": "Самое тяжёлое упражнение дня. Рабочий вес — ноутбук. Зевать можно, уходить нельзя.",
};
function photoSheet(name) {
  const m = media(name), p = sessionOn(S.day)?.ex.find(e => norm(e.name) === norm(name)), last = lastFor(name, S.day), cat = CAT_NOTES[norm(name)];
  sheet(name, `${m ? `<div class="photo"><img src="${m.img}" alt="Начало движения"><img src="${m.img2}" alt="Конец движения" class="b"></div>` : ""}
    <dl class="info">
      ${p ? `<div><dt>По плану</dt><dd>${p.sets} × ${p.reps}</dd></div>` : ""}
      ${m ? `<div><dt>Мышцы</dt><dd>${esc(m.group)}</dd></div>` : ""}
      ${last && setsText(last.sets) ? `<div><dt>В прошлый раз</dt><dd>${shortDay(last.day)}: ${esc(setsText(last.sets))}</dd></div>` : ""}
      ${p?.tip ? `<div><dt>Совет</dt><dd>${esc(p.tip)}</dd></div>` : ""}
    </dl>
    ${cat ? `<p class="cat-note">${esc(cat)}</p>` : historyHTML(name)}`);
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
      await flush().catch(() => {}); // сначала дослать очередь, иначе неотправленная запись «воскреснет» после удаления
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
  await flush().catch(() => {});
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
const openChat = () => { document.body.append(chatDim, chatEl); chatDim.onclick = () => chatEl.querySelector("[data-x]").click(); document.documentElement.classList.add("chat-open");
  requestAnimationFrame(() => { chatEl.classList.add("open"); setTimeout(() => { bbPlay(chatEl.querySelector(".co-hello .bb"), "flex"); bbPlay(chatEl.querySelector(".chat-ava .bb"), "flex"); }, 180); }); };
// Качок тренера: поза «двойной бицепс». Предплечья вращаются вокруг локтей, бицепсы надуваются — всё в цвете акцента.
const bbSVG = (cls = "") => `<svg class="bb ${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <g class="bb-body">
    <path class="bb-legs" d="M46 97h13l-2 19h-9zM61 97h13l-3 19h-9z"/>
    <path class="bb-shorts" d="M48 85h24l2 13H62l-2-6-2 6H46z"/>
    <path class="bb-skin" d="M40 44q20-5 40 0l-4 21q-4 15-6 21H50q-2-6-6-21z"/>
    <path class="bb-line" d="M47 52q6 7 13 2q7 5 13-2M60 58v25M52 66h16M53 74h14"/>
    <path class="bb-skin" d="M52 41q8-5 16 0l5 4H47z"/>
    <circle class="bb-skin" cx="60" cy="27" r="10"/>
    <path class="bb-hair" d="M50 25q1-10 10-10t10 10q-4-4-10-4t-10 4z"/>
    <g class="bb-arm l"><circle class="bb-skin" cx="40" cy="47" r="7"/><path class="bb-limb" d="M38 48L22 50"/><ellipse class="bb-skin bb-bi" cx="30" cy="44.5" rx="8" ry="6"/>
      <g class="bb-fa"><path class="bb-limb fa" d="M22 50L20 31"/><circle class="bb-skin" cx="20" cy="28" r="5.5"/></g></g>
    <g class="bb-arm r"><circle class="bb-skin" cx="80" cy="47" r="7"/><path class="bb-limb" d="M82 48L98 50"/><ellipse class="bb-skin bb-bi" cx="90" cy="44.5" rx="8" ry="6"/>
      <g class="bb-fa"><path class="bb-limb fa" d="M98 50L100 31"/><circle class="bb-skin" cx="100" cy="28" r="5.5"/></g></g>
    <path class="bb-spark" d="M10 40l-5-2M12 33l-6-6M106 33l6-6M110 40l5-2"/>
  </g></svg>`;
// перезапустить анимацию качка (класс снимается и ставится снова)
const bbPlay = (el, cls) => { if (!el) return; el.classList.remove("flex", "reps"); void el.getBoundingClientRect(); el.classList.add(cls); };
function coachChat() {
  if (chatEl) return openChat();
  const day = S.day, cached = coachCached(day), chatKey = `gym-chat2-${S.user?.id}-${day}`;
  let msgs = []; try { msgs = JSON.parse(localStorage.getItem(chatKey) || "[]").slice(-12); } catch {}
  const chips = ["Составь мне план на 4 недели", "Какой вес поставить?", "Что я давно не тренировал?"];
  const el = document.createElement("div");
  el.className = "chat"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Тренер");
  el.innerHTML = `
    <header class="chat-head">
      <span class="chat-ava" aria-hidden="true">${bbSVG("mini")}</span>
      <div><b>Тренер</b><span class="chat-st"><i aria-hidden="true"></i>на связи · видит твои тренировки</span></div>
      <button class="icon-btn bare" data-x aria-label="Свернуть чат">${I.x}</button>
    </header>
    <div class="chat-feed" id="co-feed"><div class="co-hello">${bbSVG("big")}<b>Привет! Я твой тренер</b><span>Подскажу вес, распишу план и поставлю его в календарь.</span></div></div>
    <footer class="chat-foot">
      <div class="co-chips">${chips.map(c => `<button type="button" data-chip>${c}</button>`).join("")}</div>
      <form id="cq" class="co-input"><textarea class="inp" name="q" rows="1" placeholder="Спроси тренера…" maxlength="600"></textarea><button class="btn send" type="submit" aria-label="Отправить">${I.up}</button></form>
    </footer>`;
  chatEl = el; openChat();
  const ava = el.querySelector(".chat-ava .bb");
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
  if (!cached) { setTimeout(() => bbPlay(ava, "reps"), 1700); askCoach("").then(c => {
    try { localStorage.setItem(coachKey(day), JSON.stringify(c)); } catch {}
    first.innerHTML = adviceHTML(c); bbPlay(ava, "flex");
  }).catch(e => { ava?.classList.remove("reps"); first.innerHTML = `<p class="muted">${failText(e)}</p>`; }); }
  for (const m of msgs) bubble(m.role, `<p>${esc(m.text)}</p>`);

  const send = async text => {
    text = text.trim(); if (!text) return;
    bubble("user", `<p>${esc(text)}</p>`);
    const history = msgs.slice(-6).map(m => ({ role: m.role, content: m.text }));
    msgs.push({ role: "user", text }); save();
    const wait = bubble("assistant", waitHTML("Думаю…"));
    bbPlay(ava, "reps");
    try {
      const out = await askCoach(text, history);
      bbPlay(ava, "flex");
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
    } catch (e) { ava?.classList.remove("reps"); wait.innerHTML = `<p class="muted">${failText(e)}</p>`; msgs.pop(); save(); }
  };
  el.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => send(b.textContent));
  f.onsubmit = ev => { ev.preventDefault(); const v = f.q.value; f.q.value = ""; f.q.style.height = ""; send(v); };
  f.q.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } });
  f.q.addEventListener("input", () => { f.q.style.height = "auto"; f.q.style.height = Math.min(120, f.q.scrollHeight) + "px"; });
}

/* ---------- programs ---------- */
const STAR_ORDER = ["coleman", "cutler", "phil-heath", "dorian-yates", "kai-greene", "lee-priest", "frank-zane", "the-rock", "morning"];
function programsView() {
  const p = S.profile, cur = programById(p.program_id);
  if (S.goProg) { const id = S.goProg; S.goProg = null; setTimeout(() => document.getElementById("prog-" + id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60); } // пришли с постера
  const card = pr => {
    const on = pr.id === p.program_id;
    // четыре фото из разных тренировок программы — чтобы сразу было видно, что в ней
    const pics = [...new Set(sessionsOf(pr).flatMap(s => s.ex.map(e => media(e.n[0])?.img)).filter(Boolean))];
    const four = Array.from({ length: 4 }, (_, k) => pics[Math.floor(k * pics.length / 4)]).filter(Boolean);
    return `<article class="prog ${on ? "on" : ""}" id="prog-${pr.id}">
      ${pr.photo2 ? duoHTML(pr) : pr.photo ? `<figure class="prog-photo ${pr.joke ? "joke" : ""}" ${pr.joke ? `data-act="storm" data-id="${pr.id}"` : ""}>${photoSrc(pr) ? `<img src="${photoSrc(pr)}" alt="${esc(pr.photo.caption)}" loading="lazy" decoding="async" style="object-position:${pr.photo.pos || "30% 22%"}">` : ""}
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
          await flush().catch(() => {}); // тренировка могла быть создана без сети и ещё не отправлена
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
      ${S.avatars[u.user_id] ? `<button class="ava-open" data-act="ph-ava" data-u="${u.user_id}" aria-label="Открыть фото профиля">${avatarHTML(u.user_id, u.name)}</button>` : avatarHTML(u.user_id, u.name)}
      <div><h1>${esc(u.name || "Без имени")}</h1><p class="muted">${prog ? `Программа «${esc(prog.title)}»` : "Без программы"}</p></div>
    </section>
    <div class="row friend-acts"><button class="btn" data-act="send-w" data-u="${id}">${I.plus}Отправить тренировку</button><button class="btn quiet" data-act="send-p" data-u="${id}">Предложить программу</button></div>
    ${pfBlocks(id, false)}
    <div class="stats">
      <div><b>${doneW.length}</b><span>${plural(doneW.length, "тренировка", "тренировки", "тренировок")} всего</span></div>
      <div><b>${month}</b><span>в ${MON[new Date().getMonth()].replace(/я$/, "е").replace(/а$/, "е")}</span></div>
    </div>
    <section class="card"><h2 class="card-t">Эта неделя</h2><div class="week">${week}</div></section>
    <section class="card"><h2 class="card-t">Рабочие веса</h2>
      ${lifts.length ? `<ul class="lifts">${lifts.map(l => { const dw = l.last.w - l.first.w; return `<li><button class="lift-btn" data-act="lift-chart" data-u="${id}" data-n="${esc(l.name)}"><span class="lift-n">${esc(l.name)}</span><span class="mono">${fmt(l.last.w, 1)} кг</span><span class="lift-d ${dw > 0 ? "up" : ""}">${l.pts.length > 1 ? (dw > 0 ? `+${fmt(dw, 1)} кг с ${shortDay(l.first.d)}` : dw < 0 ? `${fmt(dw, 1)} кг с ${shortDay(l.first.d)}` : "без изменений") : shortDay(l.last.d)}</span></button></li>`; }).join("")}</ul>`
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
    if (M.folder && M.folder !== "fav" && M.folder !== "yt" && !folders.some(f => f.id === M.folder)) M.folder = null;
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
  openShared();
  const count = id => M.tracks.filter(t => t.folder_id === id).length;
  let ci = 0;
  const card = (id, name, n, cover) => `<button style="--i:${Math.min(ci++, 8)}" class="fold-card ${M.folder === id && !M.q ? "on" : ""}" data-act="mu-folder" data-id="${id || ""}">
      <span class="fold-cover">${cover}</span><b>${esc(name)}</b><span>${n} ${plural(n, "трек", "трека", "треков")}</span></button>`;
  return `
    <section class="hero mu-hero"><h1>Музыка</h1><p class="lead">Играет, пока открыт сайт: можно отмечать подходы и переходить между разделами.</p></section>
    <div class="folders" role="list">
      ${card(null, "Все треки", M.tracks.length, `<span class="cover-tile all" aria-hidden="true">${I.note}</span>`)}
      ${card("fav", "Избранное", M.favs.size, `<span class="cover-tile fav" aria-hidden="true">${I.heart}</span>`)}
      <button style="--i:2" class="fold-card ${M.folder === "yt" ? "on" : ""}" data-act="mu-folder" data-id="yt"><span class="fold-cover"><span class="cover-tile yt" aria-hidden="true"><i class="yt-logo">${I.play}</i></span></span><b>YouTube</b><span>${YT.list ? `${YT.list.length} видео` : "по ссылкам"}</span></button>
      ${M.folders.map(x => card(x.id, x.name, count(x.id), coverHTML(x))).join("")}
      ${isOwner() ? `<button class="fold-card add" data-act="mu-new-folder"><span class="fold-cover"><span class="cover-tile plus" aria-hidden="true">${I.plus}</span></span><b>Новая папка</b><span>группа или альбом</span></button>` : ""}
    </div>
    ${M.folder === "yt" ? "" : searchBox()}
    <div id="mu-list">${musicList()}</div>`;
}
// ---------- YouTube в «Музыке»: общий список по ссылкам, играет официальный плеер YouTube в мини-плеере внизу ----------
const YT = { list: null, loading: null, i: -1, player: null, ready: null, dock: null, playing: false, subOpen: (() => { try { return localStorage.getItem("gym-yt-sub") !== "0"; } catch { return true; } })() };
function loadYt() {
  return YT.loading ||= q(sb.from("gym_yt").select("*").order("created_at", { ascending: false }), { silent: true })
    .then(r => { YT.list = r; }).catch(() => { YT.list = YT.list || []; }).finally(() => { YT.loading = null; });
}
// ссылка → видео или плейлист: youtu.be/ID, watch?v=ID, shorts/ID, music.youtube.com, playlist?list=ID
function parseYt(url) {
  let u; try { u = new URL(url.trim()); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
  const v = u.hostname.endsWith("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
  const list = u.searchParams.get("list");
  if (v && /^[\w-]{11}$/.test(v)) return { kind: "video", yt_id: v };
  if (list && /^[\w-]{10,64}$/.test(list)) return { kind: "playlist", yt_id: list };
  return null;
}
const ytThumb = x => x.kind === "video" ? `https://i.ytimg.com/vi/${x.yt_id}/mqdefault.jpg` : "";
// Плейлист раскрывается под своей строкой: сначала аккуратные «скелетоны», потом плавно — список треков.
// Треки берёт серверная функция gym-yt-list (одним запросом, с названиями и длительностью); список запоминается на 12 часов.
const YTL = {}; // id плейлиста → { st: "load" | "ok" | "err", items: [] }
async function ytListOf(id) {
  if (YTL[id]?.st === "ok" || YTL[id]?.st === "load") return YTL[id];
  try { const c = JSON.parse(localStorage.getItem("gym-ytpl-" + id) || "null"); if (c && Date.now() - c.at < 12 * 3600e3) return YTL[id] = { st: "ok", items: c.items }; } catch {}
  YTL[id] = { st: "load", items: [] };
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`https://qgdtzpsgzlwdhlqdqwex.supabase.co/functions/v1/gym-yt-list?list=${encodeURIComponent(id)}`, { headers: { Authorization: "Bearer " + session?.access_token, apikey: "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM" } }).then(x => x.json());
    if (!r.items?.length) throw new Error("empty");
    YTL[id] = { st: "ok", items: r.items };
    try { localStorage.setItem("gym-ytpl-" + id, JSON.stringify({ at: Date.now(), items: r.items })); } catch {}
  } catch { YTL[id] = { st: "err", items: [] }; }
  return YTL[id];
}
const ytSkel = () => `<div class="yt-skel" aria-hidden="true">${Array.from({ length: 5 }, () => `<div class="yt-sk"><i class="skel"></i><span><i class="skel"></i><i class="skel"></i></span></div>`).join("")}<p class="hint">Загружаю треки с YouTube…</p></div>`;
function ytItemsHTML(i) {
  const x = YT.list[i], L = YTL[x.yt_id];
  if (!L || L.st === "load") return ytSkel();
  if (L.st === "err") return `<p class="hint yt-err">Не получилось загрузить список — можно просто нажать ▶ и слушать плейлист целиком.</p>`;
  const curK = YT.i === i ? YT.plk : -1;
  return `<ol class="yt-items">${L.items.map((v, k) => `<li data-k="${k}" class="${k === curK ? "cur" : ""} ${k === curK && YT.playing ? "playing" : ""}">
      <button class="yt-thb" data-act="yt-watch" data-i="${i}" data-k="${k}" aria-label="Открыть видео «${esc(v.t)}»" title="Открыть видео">
        <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy" decoding="async">${v.len ? `<span class="yt-len mono">${esc(v.len)}</span>` : ""}<span class="yt-eye" aria-hidden="true">${I.expand}</span></button>
      <button class="yt-it" data-act="yt-at" data-i="${i}" data-k="${k}">
        <span class="tr-t"><b>${esc(v.t || "Видео")}</b><span>${esc(v.a || "")}</span></span>
        <span class="yt-st" aria-hidden="true">${k === curK ? `<i class="eq"><b></b><b></b><b></b></i>` : I.play}</span></button></li>`).join("")}</ol>`;
}
// плавно поменять содержимое и высоту блока (без скачков): было h0 → стало h1
function ytMorph(body, html) {
  const h0 = body.getBoundingClientRect().height;
  body.innerHTML = html;
  if (calm()) { body.style.height = ""; return; }
  const h1 = body.scrollHeight;
  body.style.height = h0 + "px"; void body.offsetHeight; body.style.height = h1 + "px";
  clearTimeout(body._t); body._t = setTimeout(() => { body.style.height = ""; }, 380);
}
async function ytToggle(i) {
  const x = YT.list[i], li = document.querySelector(`.yt-list > li[data-i="${i}"]`); if (!li) return;
  let body = li.querySelector(".yt-body"), btn = li.querySelector("[data-act=yt-exp]");
  if (YT.exp === x.yt_id && body) { // свернуть
    YT.exp = null; btn.setAttribute("aria-expanded", "false");
    body.style.height = body.getBoundingClientRect().height + "px"; void body.offsetHeight; body.style.height = "0px"; body.classList.add("closing");
    setTimeout(() => body.remove(), 330); return;
  }
  document.querySelectorAll(".yt-list .yt-body").forEach(b => b.remove()); // открыт только один плейлист
  document.querySelectorAll(".yt-list [data-act=yt-exp]").forEach(b => b.setAttribute("aria-expanded", "false"));
  YT.exp = x.yt_id; btn.setAttribute("aria-expanded", "true");
  body = document.createElement("div"); body.className = "yt-body"; body.style.height = "0px"; li.append(body);
  const ready = YTL[x.yt_id]?.st === "ok";
  ytMorph(body, ready ? ytItemsHTML(i) : ytSkel());
  if (ready) return;
  await ytListOf(x.yt_id);
  if (YT.exp === x.yt_id && body.isConnected) { ytMorph(body, ytItemsHTML(i)); body.querySelector(".yt-items")?.classList.add("appear"); }
  const n = YTL[x.yt_id]?.items?.length, sub = li.querySelector(".yt-line .tr-t span");
  if (n && sub && !sub.textContent.includes("·")) sub.textContent += ` · ${n} ${plural(n, "трек", "трека", "треков")}`;
}
// включить трек плейлиста; big — сразу развернуть видео
async function ytPlayAt(i, k, big) {
  const x = YT.list[i];
  if (YT.i === i && YT.player?.playVideoAt && YT.loaded === x.yt_id) { M.audio.pause(); YT.player.playVideoAt(k); }
  else await ytPlay(i, k);
  if (big && YT.dock) { YT.dock.classList.add("big"); YT.dock.classList.remove("mini"); }
  YT.plk = k; YT.want = { k, until: Date.now() + 4000 }; refreshYtList(); ytPaintDock();
}
function ytSection() {
  if (!YT.list) { loadYt().then(() => { if (route().path === "music" && M.folder === "yt") rerender(); }); return `<div class="skel" style="height:180px;margin-top:16px"></div>`; }
  const cur = YT.list[YT.i];
  return `<section class="mu-head"><div class="mu-title"><div><h2>YouTube</h2><p class="muted">${YT.list.length} ${plural(YT.list.length, "видео", "видео", "видео")} · общий список</p></div></div>
      <div class="row"><button class="btn" data-act="yt-all" ${YT.list.length ? "" : "disabled"}>${I.play}Слушать</button></div></section>
    <form class="yt-add" data-yt-form>
      <input class="inp" name="url" inputmode="url" placeholder="Ссылка на видео или плейлист YouTube" autocomplete="off" aria-label="Ссылка YouTube">
      <button class="btn" type="submit">Добавить</button>
    </form>
    <details class="yt-how"><summary>Как добавить?${I.chevDown}</summary><p class="hint">Поиска внутри сайта нет — <a href="https://www.youtube.com/results?search_query=${encodeURIComponent("музыка для зала")}" target="_blank" rel="noopener">найди на YouTube</a>, нажми «Поделиться» → «Копировать ссылку» и вставь сюда. Подходят и видео, и плейлисты. Если видео не играет — его автор запретил показ на других сайтах, оно пропустится само.</p></details>
    ${YT.list.length ? `<ol class="tracks yt-list">${YT.list.map((x, i) => { const pl = x.kind === "playlist", open = pl && YT.exp === x.yt_id, n = YTL[x.yt_id]?.items?.length;
      return `<li data-i="${i}" class="${i === YT.i ? "cur" : ""} ${i === YT.i && YT.playing ? "playing" : ""} ${pl ? "is-pl" : ""}">
        <div class="yt-line">
          ${pl ? `<button class="track" data-act="yt-exp" data-i="${i}" aria-expanded="${open}">
              <span class="yt-th yt-pl">${I.note}<small>плейлист</small></span>
              <span class="tr-t"><b>${esc(x.title || "Плейлист YouTube")}</b><span>${esc(x.author || "")}${n ? ` · ${n} ${plural(n, "трек", "трека", "треков")}` : ""}</span></span>
              <span class="yt-chev" aria-hidden="true">${I.chevDown}</span></button>
            <button class="tr-more yt-all1" data-act="yt-play" data-i="${i}" aria-label="Слушать плейлист целиком" title="Слушать всё">${I.play}</button>`
          : `<button class="yt-thb one" data-act="yt-watch" data-i="${i}" data-k="-1" aria-label="Открыть видео" title="Открыть видео"><img src="${ytThumb(x)}" alt="" loading="lazy"><span class="yt-eye" aria-hidden="true">${I.expand}</span></button>
            <button class="track" data-act="yt-play" data-i="${i}"><span class="tr-t"><b>${esc(x.title || "Видео YouTube")}</b><span>${esc(x.author || "")}</span></span></button>`}
          ${x.user_id === S.user.id ? `<button class="tr-more" data-act="yt-del" data-i="${i}" aria-label="Убрать из списка" title="Убрать">${I.x}</button>` : ""}
        </div>
        ${open ? `<div class="yt-body">${ytItemsHTML(i)}</div>` : ""}</li>`; }).join("")}</ol>`
      : `<p class="hint mu-empty">Пока пусто — добавь первое видео или плейлист.</p>`}`;
}
async function addYt(form) {
  const x = parseYt(form.url.value), btn = form.querySelector("[type=submit]");
  if (!x) return toast("Нужна ссылка на видео или плейлист YouTube");
  if ((YT.list || []).some(y => y.kind === x.kind && y.yt_id === x.yt_id)) return toast("Это уже есть в списке");
  btn.classList.add("loading"); btn.disabled = true;
  try {
    const url = x.kind === "video" ? `https://www.youtube.com/watch?v=${x.yt_id}` : `https://www.youtube.com/playlist?list=${x.yt_id}`;
    const meta = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const row = await q(sb.from("gym_yt").insert({ ...x, title: (meta.title || "").slice(0, 200), author: (meta.author_name || "").slice(0, 100) }).select().single());
    YT.list = [row, ...(YT.list || [])]; if (YT.i >= 0) YT.i++;
    form.url.value = ""; rerender(); toast("Добавлено");
  } catch { btn.classList.remove("loading"); btn.disabled = false; }
}
// Плеер: официальный IFrame API YouTube, живёт вне страниц — музыка не прерывается при переходах
function ytApi() {
  return YT.ready ||= new Promise((res, rej) => {
    if (window.YT?.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.onerror = () => { YT.ready = null; rej(new Error("yt")); };
    document.head.append(s);
  });
}
async function ytPlay(i, k = 0) {
  const x = YT.list?.[i]; if (!x) return;
  M.audio.pause(); // одновременно играет что-то одно
  ytWake(true);
  document.documentElement.classList.add("yt-front"); YT.dock?.classList.remove("mini");
  YT.i = i; YT.plk = x.kind === "playlist" ? k : -1; YT.shuffle = false; YT.loaded = null; ytDock(); ytPaintDock(); refreshYtList();
  if (x.kind === "playlist") ytListOf(x.yt_id).then(() => ytPaintDock()); // для «3 из 25» в плеере
  try { await ytApi(); } catch { return toast("YouTube не загрузился — проверь интернет или VPN"); }
  const load = () => { YT.loaded = x.yt_id; x.kind === "video" ? YT.player.loadVideoById(x.yt_id) : YT.player.loadPlaylist({ list: x.yt_id, listType: "playlist", index: k }); };
  // через 12 секунд видео так и не пошло — честно говорим, а не крутим молча (в России YouTube часто замедлен)
  clearTimeout(YT.watch); const want = i;
  YT.watch = setTimeout(() => { if (YT.i === want && !YT.playing && !(YT.player?.getCurrentTime?.() > 0)) toast("YouTube не грузится — без VPN он часто тормозит. Попробуй с VPN или включи наши треки"); }, 12000);
  if (YT.player) return load();
  YT.player = new window.YT.Player(YT.dock.querySelector(".yt-frame"), {
    width: 160, height: 90, host: "https://www.youtube-nocookie.com", // с обычного youtube.com часть сайтов получает «показ запрещён» (ошибка 150)
    playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    ...(x.kind === "video" ? { videoId: x.yt_id } : {}),
    events: {
      onReady: e => { e.target.setVolume(ytVol()); if (x.kind === "playlist") load(); else e.target.playVideo(); },
      onStateChange: e => {
        YT.playing = e.data === 1; ytPaintDock(); refreshYtList(); ytWake(YT.playing || !!YT.lockEl);
        if (e.data === 0 && YT.list[YT.i]?.kind === "video") ytNext(1); // видео закончилось — следующее
      },
      onError: () => { toast("Это видео нельзя включить на других сайтах — пропускаю"); ytNext(1); },
    },
  });
}
function ytNext(d) {
  const x = YT.list?.[YT.i];
  if (x?.kind === "playlist" && YT.player) return d > 0 ? YT.player.nextVideo() : YT.player.previousVideo();
  const n = YT.i + d; if (n >= 0 && n < YT.list.length) ytPlay(n); else { YT.playing = false; ytPaintDock(); }
}
// Мини-плеер YouTube: видео (нажатие — развернуть), название, кнопки, полоса перемотки со временем
function ytDock() {
  if (YT.dock) return;
  const el = YT.dock = document.createElement("div"); el.className = "yt-dock"; el.setAttribute("aria-label", "Плеер YouTube");
  el.innerHTML = `<button class="yt-vid" data-y="big" aria-label="Развернуть видео" title="Развернуть видео"><div class="yt-frame"></div><span class="yt-vid-ic" aria-hidden="true">${I.expand}</span><span class="yt-vid-lab">${I.shrink}Свернуть видео</span></button>
    <div class="yt-main">
      <div class="yt-row">
        <div class="yt-info"><b></b><span></span></div>
        <div class="yt-ctrl">
          <button class="icon-btn bare yt-sh" data-y="shuffle" aria-label="Перемешать плейлист" aria-pressed="false">${I.shuffle}</button>
          <button class="icon-btn bare" data-y="prev" aria-label="Предыдущее">${I.prev}</button>
          <button class="icon-btn bare yt-wide" data-y="back" aria-label="Назад на 10 секунд">${I.back10}</button>
          <button class="pl-play" data-y="toggle" aria-label="Играть или пауза">${I.pause}</button>
          <button class="icon-btn bare yt-wide" data-y="fwd" aria-label="Вперёд на 10 секунд">${I.fwd10}</button>
          <button class="icon-btn bare" data-y="next" aria-label="Следующее">${I.next}</button>
          <div class="vol yt-vol yt-wide-v"><button class="icon-btn bare" data-y="mute" aria-label="Выключить звук" title="Громкость">${I.vol}</button><input type="range" min="0" max="100" value="${ytVol()}" data-yvol aria-label="Громкость YouTube"></div>
          <button class="icon-btn bare yt-lock" data-y="lock" aria-label="Заблокировать экран" title="Заблокировать экран — музыка играет, случайные нажатия не сработают">${I.lock}</button>
          <button class="icon-btn bare yt-min" data-y="min" aria-label="Свернуть плеер" title="Свернуть плеер — музыка продолжит играть">${I.chevDown}</button>
          <button class="icon-btn bare pl-x" data-y="close" aria-label="Закрыть YouTube" title="Закрыть YouTube">${I.x}</button>
        </div>
      </div>
      <div class="yt-seek"><span class="mono" data-t0>0:00</span><input type="range" min="0" max="1000" value="0" data-yseek aria-label="Перемотка"><span class="mono" data-t1>0:00</span></div>
    </div>`;
  el.addEventListener("click", ev => {
    const a = ev.target.closest("[data-y]")?.dataset.y, P = YT.player; if (!a) return;
    if (a === "big") { const big = el.classList.toggle("big"); el.classList.remove("mini"); const b = el.querySelector(".yt-vid"); b.title = big ? "Свернуть видео" : "Развернуть видео"; b.setAttribute("aria-label", b.title); return; }
    if (a === "min") { const mini = el.classList.toggle("mini"); if (!mini) document.documentElement.classList.add("yt-front"); el.classList.remove("big"); const b = el.querySelector(".yt-min"); b.setAttribute("aria-label", mini ? "Развернуть плеер" : "Свернуть плеер"); b.title = mini ? "Развернуть плеер" : "Свернуть плеер — музыка продолжит играть"; return; }
    if (a === "close") return ytClose();
    if (a === "lock") return ytLock();
    if (!P?.getPlayerState) return;
    if (a === "toggle") YT.playing ? P.pauseVideo() : (M.audio.pause(), document.documentElement.classList.add("yt-front"), P.playVideo());
    if (a === "prev") ytNext(-1);
    if (a === "next") ytNext(1);
    if (a === "mute") { P.isMuted() ? P.unMute() : P.mute(); ytPaintVol(); return; }
    if (a === "back" || a === "fwd") P.seekTo(Math.max(0, P.getCurrentTime() + (a === "fwd" ? 10 : -10)), true);
    if (a === "shuffle") { YT.shuffle = !YT.shuffle; P.setShuffle(YT.shuffle); ytPaintDock(); toast(YT.shuffle ? "Плейлист перемешан" : "Плейлист по порядку"); }
  });
  const vol = el.querySelector("[data-yvol]");
  vol.style.setProperty("--p", vol.value + "%");
  vol.addEventListener("input", () => { const v = +vol.value; vol.style.setProperty("--p", v + "%"); YT.player?.setVolume?.(v); if (v > 0) YT.player?.unMute?.(); try { localStorage.setItem("gym-yt-vol", v); } catch {} ytPaintVol(); });
  const seek = el.querySelector("[data-yseek]");
  seek.addEventListener("input", () => { YT.drag = true; const d = YT.player?.getDuration?.() || 0; el.querySelector("[data-t0]").textContent = mmss(seek.value / 1000 * d); seek.style.setProperty("--p", seek.value / 10 + "%"); });
  seek.addEventListener("change", () => { const d = YT.player?.getDuration?.() || 0; if (d) YT.player.seekTo(seek.value / 1000 * d, true); YT.drag = false; });
  document.body.append(el); document.documentElement.classList.add("has-yt");
  requestAnimationFrame(() => el.classList.add("on"));
  clearInterval(YT.tick); YT.tick = setInterval(ytTick, 500); // время, перемотка, текущее видео плейлиста
}
// громкость YouTube — своя, запоминается; значок показывает «без звука»
const ytVol = () => { try { const v = +localStorage.getItem("gym-yt-vol"); return localStorage.getItem("gym-yt-vol") == null ? 100 : Math.max(0, Math.min(100, v)); } catch { return 100; } };
function ytPaintVol() {
  const b = YT.dock?.querySelector("[data-y=mute]"); if (!b || !YT.player?.isMuted) return;
  const off = YT.player.isMuted() || YT.player.getVolume() === 0;
  b.innerHTML = off ? I.volOff : I.vol; b.setAttribute("aria-label", off ? "Включить звук" : "Выключить звук");
}
function ytTick() {
  const P = YT.player; if (!YT.dock || !P?.getCurrentTime) return;
  const t = P.getCurrentTime() || 0, d = P.getDuration() || 0;
  if (!YT.drag) {
    const seek = YT.dock.querySelector("[data-yseek]"), v = d ? Math.round(t / d * 1000) : 0;
    seek.value = v; seek.style.setProperty("--p", v / 10 + "%");
    YT.dock.querySelector("[data-t0]").textContent = mmss(t);
  }
  YT.dock.querySelector("[data-t1]").textContent = d ? mmss(d) : "0:00";
  // плейлист: какой трек играет сейчас — подсветка в раскрытом списке и «N из M» в плеере
  if (YT.list?.[YT.i]?.kind === "playlist") {
    const k = P.getPlaylistIndex?.() ?? -1;
    if (YT.want) { if (k === YT.want.k || Date.now() > YT.want.until) YT.want = null; else return; } // ждём, пока YouTube переключится на выбранный трек — без мигания подсветки
    if (k >= 0 && k !== YT.plk) { YT.plk = k; ytPaintDock(); refreshYtList(); }
  }
}
const ytRepaintList = () => { if (route().path === "music" && M.folder === "yt") { const box = document.getElementById("mu-list"); if (box) box.innerHTML = musicList(); } };
function ytPaintDock() {
  const x = YT.list?.[YT.i]; if (!YT.dock || !x) return;
  const data = YT.player?.getVideoData?.() || {}, pl = x.kind === "playlist";
  YT.dock.querySelector(".yt-info b").textContent = data.title || x.title || "YouTube";
  const n = YTL[x.yt_id]?.items?.length;
  YT.dock.querySelector(".yt-info span").textContent = pl ? `${x.title}${n && YT.plk >= 0 ? ` · ${YT.plk + 1} из ${n}` : ""}` : data.author || x.author || "";
  YT.dock.querySelector("[data-y=toggle]").innerHTML = YT.playing ? I.pause : I.play;
  YT.dock.classList.toggle("pl", pl);
  YT.dock.querySelector("[data-y=shuffle]").setAttribute("aria-pressed", !!YT.shuffle);
}
function refreshYtList() {
  document.querySelectorAll(".yt-list > li").forEach(li => { const k = +li.dataset.i; li.classList.toggle("cur", k === YT.i); li.classList.toggle("playing", k === YT.i && YT.playing); });
  document.querySelectorAll(".yt-list > li").forEach(li => {
    const mine = +li.dataset.i === YT.i;
    li.querySelectorAll(".yt-items > li").forEach(t => {
      const cur = mine && +t.dataset.k === YT.plk; if (t.classList.contains("cur") === cur && t.classList.contains("playing") === (cur && YT.playing)) return;
      t.classList.toggle("cur", cur); t.classList.toggle("playing", cur && YT.playing);
      t.querySelector(".yt-st").innerHTML = cur ? `<i class="eq"><b></b><b></b><b></b></i>` : I.play;
    });
  });
}
// Пока играет YouTube, экран не гаснет: при блокировке iPhone останавливает видео, а не давать ему гаснуть — можно
function ytWake(on) {
  if (!("wakeLock" in navigator)) return;
  if (on && !YT.wake && !document.hidden) { YT.wake = navigator.wakeLock.request("screen").then(w => { w.addEventListener("release", () => { YT.wake = null; }); return w; }).catch(() => (YT.wake = null)); }
  if (!on && YT.wake) { const w = YT.wake; YT.wake = null; w.then(x => x?.release()).catch(() => {}); }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && (YT.playing || YT.lockEl)) ytWake(true); });
// «Замок» сайта: чёрный экран поверх всего, музыка играет, нажатия не проходят; снять — удерживать кнопку
function ytLock() {
  if (YT.lockEl) return;
  const x = YT.list?.[YT.i], d = YT.player?.getVideoData?.() || {};
  const el = YT.lockEl = document.createElement("div"); el.className = "yt-lockscr"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Экран заблокирован");
  el.innerHTML = `<div class="yl-mid">${I.lock}<b>${esc(d.title || x?.title || "YouTube")}</b><span>Музыка играет, экран не гаснет</span></div>
    <button class="yl-hold" type="button"><i aria-hidden="true"></i><span>Удерживай, чтобы разблокировать</span></button>`;
  const stop = ev => { if (!ev.target.closest(".yl-hold")) ev.preventDefault(); };
  ["touchstart", "touchmove", "contextmenu", "wheel"].forEach(t => el.addEventListener(t, stop, { passive: false }));
  const hold = el.querySelector(".yl-hold"); let t;
  const end = () => { clearTimeout(t); hold.classList.remove("on"); };
  hold.addEventListener("pointerdown", ev => { ev.preventDefault(); hold.classList.add("on"); t = setTimeout(ytUnlock, 900); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(k => hold.addEventListener(k, end));
  hold.addEventListener("contextmenu", ev => ev.preventDefault());
  document.body.append(el); document.documentElement.classList.add("yt-locked");
  requestAnimationFrame(() => el.classList.add("on"));
  ytWake(true);
}
function ytUnlock() {
  const el = YT.lockEl; if (!el) return; YT.lockEl = null;
  el.classList.remove("on"); setTimeout(() => el.remove(), 260); document.documentElement.classList.remove("yt-locked");
  ytWake(YT.playing);
}
function ytClose() {
  ytUnlock(); ytWake(false);
  try { YT.player?.stopVideo(); YT.player?.destroy(); } catch {}
  YT.player = null; YT.playing = false; YT.i = -1; YT.plk = -1; YT.loaded = null; clearInterval(YT.tick);
  const el = YT.dock; YT.dock = null; el?.classList.remove("on"); setTimeout(() => el?.remove(), 260);
  document.documentElement.classList.remove("has-yt", "yt-front"); refreshYtList();
}
// включили наш mp3 — YouTube на паузу
M.audio.addEventListener("play", () => { // включили наш mp3 — YouTube на паузу и в маленькую плашку, на виду наш плеер
  if (YT.playing) YT.player?.pauseVideo();
  if (YT.dock) { YT.dock.classList.add("mini"); YT.dock.classList.remove("big"); document.documentElement.classList.remove("yt-front"); }
});
document.addEventListener("submit", ev => { if (ev.target.matches("[data-yt-form]")) { ev.preventDefault(); addYt(ev.target); } });
const searchBox = () => `<label class="mu-search">${I.search}<input type="search" data-field="mu-q" value="${esc(M.q || "")}" placeholder="Найти трек или группу" autocomplete="off" enterkeyhint="search" aria-label="Поиск по трекам">${M.q ? `<button type="button" data-act="mu-q-clear" aria-label="Очистить поиск">${I.x}</button>` : ""}</label>`;
function musicList() {
  if (M.folder === "yt") return ytSection();
  const list = visibleTracks(), fav = M.folder === "fav" && !M.q, f = !M.q && M.folders.find(x => x.id === M.folder), playing = !M.audio.paused;
  const total = list.reduce((a, x) => a + (x.t.sec || 0), 0);
  return `
    <section class="mu-head">
      <div class="mu-title">${f ? `<span class="mu-cover">${coverHTML(f)}</span>` : ""}<div><h2>${M.q ? "Поиск" : esc(f?.name || (fav ? "Избранное" : "Все треки"))}</h2><p class="muted">${list.length} ${plural(list.length, "трек", "трека", "треков")} · ${Math.round(total / 60)} мин</p></div></div>
      <div class="row"><button class="btn" data-act="mu-all" ${list.length ? "" : "disabled"}>${I.play}Слушать</button><button class="btn quiet" data-act="mu-shuffle" aria-pressed="${M.shuffle}">${I.shuffle}Вперемешку</button>
        ${f && isOwner() ? `<button class="icon-btn" data-act="mu-folder-menu" aria-label="Настройки папки">${I.dots}</button>` : ""}</div>
    </section>
    ${isOwner() && U.items.length ? uploadPanel() : ""}
    ${isOwner() && !fav && !M.q && !U.run ? `<label class="mu-up"><input type="file" accept=".mp3,audio/mpeg" multiple hidden data-field="mu-files">${I.plus}<span><b>Загрузить треки${f ? ` в «${esc(f.name)}»` : ""}</b><span class="hint">mp3 с компьютера, можно несколько или перетащить на страницу. Группа, название и обложка берутся из самого трека; папка группы создаётся сама.</span></span></label>` : ""}
    ${list.length ? `<ol class="tracks">${list.map(({ t, i }, k) => `<li class="${i === M.i ? "cur" : ""} ${i === M.i && playing ? "playing" : ""} " data-i="${i}" style="--i:${Math.min(k, 12)}">
      <button class="track" data-act="mu-play" data-i="${i}">
        <span class="tr-n">${i === M.i ? `<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>` : k + 1}</span>
        <span class="tr-t"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></span>
        <span class="tr-d mono">${mmss(t.sec)}</span></button>
      <button class="tr-fav" data-act="mu-fav" data-i="${i}" aria-pressed="${M.favs.has(t.id)}" aria-label="${M.favs.has(t.id) ? "Убрать из избранного" : "В избранное"}">${M.favs.has(t.id) ? I.heartFill : I.heart}</button>
      <button class="tr-more" data-act="mu-track-menu" data-i="${i}" aria-label="Действия с треком" title="В профиль, поделиться">${I.dots}</button></li>`).join("")}</ol>`
      : `<p class="hint mu-empty">${M.q ? "Ничего не нашлось — попробуй часть названия или группу." : fav ? "Здесь будут треки, которые ты отметишь сердечком." : isOwner() ? "В папке пока нет треков — загрузи их кнопкой выше или перенеси из «Все треки» через ⋯ у трека." : "В папке пока нет треков."}</p>`}`;
}

// Действия владельца: перенести трек в папку, удалить трек, создать папку, сменить обложку, удалить папку.
// Меню трека: сверху сам трек, ниже — спокойный список действий с иконками. Перенос в папку — отдельным шагом.
function trackMenu(i) {
  const t = M.tracks[i]; if (!t) return;
  const own = isOwner(), f = folderOf(t);
  const head = `<div class="tm-head"><span class="tm-cov">${coverHTML(f || { name: t.artist })}</span><span class="tm-t"><b>${esc(t.title)}</b><span>${esc(t.artist)}${t.album ? ` · ${esc(t.album)}` : ""}</span></span></div>`;
  const item = (act, icon, label, cls = "") => `<button class="tm-item ${cls}" data-tm="${act}">${icon}<span>${label}</span></button>`;
  const main = () => { const inP = inProfile(t); return `${head}<div class="tm-list">
      ${item("prof", inP ? I.check : I.plus, inP ? "Убрать из профиля" : "Добавить в профиль", inP ? "on" : "")}
      ${item("share", I.share, "Поделиться")}
      ${item("dl", I.download, "Скачать")}
      ${own ? `<hr>${item("move", I.folder, `Перенести в папку<small>${esc(f?.name || "без папки")}</small>`)}${item("del", I.trash, "Удалить трек", "danger")}` : ""}
    </div>`; };
  const folders = () => `${head}<button class="tm-back" data-tm="back">${I.left}Назад</button><div class="tm-list">
      ${[{ id: "", name: "Без папки" }, ...M.folders].map(x => `<button class="tm-item ${(t.folder_id || "") === x.id ? "on" : ""}" data-to="${x.id}" ${(t.folder_id || "") === x.id ? "aria-current=\"true\"" : ""}>
        ${(t.folder_id || "") === x.id ? I.check : `<i class="tm-dot" aria-hidden="true"></i>`}<span>${esc(x.name)}</span></button>`).join("")}</div>`;
  sheet("Трек", `<div class="tm" data-tm-box>${main()}</div>`, (el, close) => {
    const box = el.querySelector("[data-tm-box]");
    el.classList.add("tm-sheet");
    el.addEventListener("click", async ev => {
      const a = ev.target.closest("[data-tm]")?.dataset.tm, to = ev.target.closest("[data-to]");
      if (a === "share") { close(); return shareTrack(t); }
      if (a === "prof") { close(); return toggleProfileTrack(t); }
      if (a === "dl") { close(); return downloadTrack(t); }
      if (a === "move") { box.innerHTML = folders(); return; }
      if (a === "back") { box.innerHTML = main(); return; }
      if (to) { to.disabled = true;
        try { await q(sb.from("gym_tracks").update({ folder_id: to.dataset.to || null }).eq("id", t.id)); t.folder_id = to.dataset.to || null; close(); rerender(); toast("Перенесено"); } catch { to.disabled = false; }
        return; }
      if (a !== "del") return;
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
// Скачать трек: короткая ссылка с именем файла «Группа — Название.mp3», браузер сохраняет файл сам.
async function downloadTrack(t) {
  if (!t) return;
  const name = `${t.artist ? t.artist + " — " : ""}${t.title}.mp3`.replace(/[\\/:*?"<>|]+/g, " ");
  const { data, error } = await sb.storage.from("gym-music").createSignedUrl("tracks/" + t.file, 600, { download: name });
  if (error || !data?.signedUrl) return toast("Не получилось скачать — попробуй ещё раз");
  const a = document.createElement("a"); a.href = data.signedUrl; a.download = name; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  toast("Скачивание началось");
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
// Загрузка идёт по одному треку; состояние — в U, поэтому панель с прогрессом переживает переходы между разделами.
const U = { items: [], run: false, stop: false, xhr: null };
const mb = n => (n / 1048576).toLocaleString("ru-RU", { maximumFractionDigits: n < 10485760 ? 1 : 0 });
// Файл уходит в хранилище через XHR — у него, в отличие от supabase-js, есть прогресс по байтам.
async function putTrack(path, f, onPct) {
  const { data: { session } } = await sb.auth.getSession();
  return new Promise((res, rej) => {
    const x = U.xhr = new XMLHttpRequest();
    x.open("POST", `https://qgdtzpsgzlwdhlqdqwex.supabase.co/storage/v1/object/gym-music/${path.split("/").map(encodeURIComponent).join("/")}`);
    x.setRequestHeader("Authorization", "Bearer " + session?.access_token);
    x.setRequestHeader("apikey", "sb_publishable_rKUjSv2W8BS1_ZDXGXwU1A_jgCrjPWM");
    x.setRequestHeader("Content-Type", "audio/mpeg"); x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = e => e.lengthComputable && onPct(e.loaded / e.total);
    x.onload = () => { U.xhr = null; x.status < 300 ? res() : rej(new Error(x.status + " " + x.responseText)); };
    x.onerror = () => { U.xhr = null; rej(new Error("network")); };
    x.onabort = () => { U.xhr = null; rej(new Error("abort")); };
    x.send(f);
  });
}
const UP_ST = { wait: "ждёт", tags: "читаю теги", up: "", ok: "готово", dup: "уже есть", fail: "не получилось", skip: "остановлено" };
function uploadPanel() {
  const it = U.items, n = it.length, done = it.filter(x => !["wait", "tags", "up"].includes(x.st)).length;
  const total = it.reduce((a, x) => a + x.f.size, 0), sent = it.reduce((a, x) => a + (["ok", "dup"].includes(x.st) ? x.f.size : x.st === "up" ? x.f.size * x.pct : 0), 0);
  const pct = total ? sent / total : 0, cur = it.find(x => x.st === "up" || x.st === "tags");
  const c = st => it.filter(x => x.st === st).length;
  let left = "";
  if (U.run && U.t0 && sent > 1e5) { const sec = (Date.now() - U.t0) / 1000 * (total - sent) / sent; left = sec < 60 ? " · меньше минуты" : ` · ещё ≈ ${Math.round(sec / 60)} мин`; }
  const head = U.run ? `Загружаю ${Math.min(done + 1, n)} из ${n}` : U.stop ? "Загрузка остановлена" : c("fail") ? "Загрузка закончена с ошибками" : "Все треки загружены";
  const sub = U.run ? `${mb(sent)} из ${mb(total)} МБ${left}` : [`загружено ${c("ok")}`, c("dup") && `уже были ${c("dup")}`, c("fail") && `не получилось ${c("fail")}`, c("skip") && `остановлено ${c("skip")}`, U.made && `новых папок ${U.made}`].filter(Boolean).join(" · ");
  return `<section class="mu-upl ${U.run ? "run" : ""}" id="mu-upl" aria-live="polite">
    <div class="upl-head"><div><b>${head}</b><span class="hint">${sub}</span></div>
      ${U.run ? `<button class="btn quiet" data-act="mu-up-stop">Остановить</button>`
        : `<div class="row">${c("fail") || c("skip") ? `<button class="btn quiet" data-act="mu-up-retry">Повторить</button>` : ""}<button class="btn quiet" data-act="mu-up-close">Закрыть</button></div>`}</div>
    <div class="upl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="Общий прогресс"><i style="width:${pct * 100}%"></i></div>
    ${cur ? `<p class="upl-cur">${esc(cur.f.name)}</p>` : ""}
    <ol class="upl-list">${it.map(x => `<li class="${x.st}"><span class="upl-ic" aria-hidden="true">${x.st === "ok" ? I.check : x.st === "fail" ? I.x : ""}</span>
      <span class="upl-n">${esc(x.title ? `${x.artist ? x.artist + " — " : ""}${x.title}` : x.f.name)}</span>
      <span class="upl-s mono">${x.st === "up" ? Math.round(x.pct * 100) + "%" : `${UP_ST[x.st]}${x.st === "wait" ? ` · ${mb(x.f.size)} МБ` : ""}`}</span></li>`).join("")}</ol>
  </section>`;
}
let upPaint = 0;
function paintUpload(force) { // при прогрессе — не чаще 8 раз в секунду
  if (!force && Date.now() - upPaint < 120) return; upPaint = Date.now();
  const el = document.getElementById("mu-upl");
  if (el) { const st = el.querySelector(".upl-list")?.scrollTop; el.outerHTML = uploadPanel(); const nl = document.querySelector("#mu-upl .upl-list"); if (nl && st) nl.scrollTop = st; }
}
function uploadTracks(files) {
  files = [...files].filter(f => /\.mp3$/i.test(f.name) || f.type === "audio/mpeg");
  if (!files.length) return toast("Нужны файлы mp3");
  if (U.run) { U.items.push(...files.map(f => ({ f, st: "wait", pct: 0 }))); paintUpload(true); return toast(`Добавлено в очередь: ${files.length}`); }
  U.items = files.map(f => ({ f, st: "wait", pct: 0 }));
  runUpload();
}
async function runUpload() {
  Object.assign(U, { run: true, stop: false, made: 0, t0: Date.now() });
  if (route().path === "music") rerender(); // кнопка загрузки сменяется панелью
  const have = new Set((M.tracks || []).map(t => t.file));
  const same = new Set((M.tracks || []).map(t => norm(t.artist) + "|" + norm(t.title)));
  for (let x; !U.stop && (x = U.items.find(y => y.st === "wait"));) {
    const f = x.f; x.st = "tags"; paintUpload(true);
    try {
      const tag = await id3(f).catch(() => ({})), byName = fromName(f.name);
      // «Трек - Группа»: если вторая часть — уже известная группа, а первая нет, меняем местами
      if (!tag.TPE1 && M.folders.some(y => folderKey(y.name) === folderKey(byName.title)) && !M.folders.some(y => folderKey(y.name) === folderKey(byName.artist)))
        [byName.artist, byName.title] = [byName.title, byName.artist];
      const artist = (tag.TPE1 || byName.artist).split(/\s*[\/;]\s*/)[0].trim(), title = tag.TIT2 || byName.title;
      const album = tag.TALB || "", track_no = parseInt(tag.TRCK || f.name.match(/^\s*(\d{1,3})\s*[.\-_)]/)?.[1]) || null;
      Object.assign(x, { artist, title });
      if (same.has(norm(artist) + "|" + norm(title))) { x.st = "dup"; continue; } // такой трек уже есть
      // папка: открытая сейчас, иначе папка группы; нет такой — создаётся с обложкой из трека
      let folder = M.folders.find(y => y.id === M.folder) || (artist && M.folders.find(y => folderKey(y.name) === folderKey(artist)));
      if (!folder && artist) {
        const cover = tag.cover ? await uploadCover(tag.cover, artist).catch(() => null) : null;
        folder = await q(sb.from("gym_music_folders").insert({ name: artist, cover }).select().single(), { silent: true });
        M.folders.push(folder); U.made++;
      } else if (folder && !folder.cover && tag.cover) {
        const cover = await uploadCover(tag.cover, folder.name).catch(() => null);
        if (cover) { await q(sb.from("gym_music_folders").update({ cover }).eq("id", folder.id), { silent: true }); folder.cover = cover; }
      }
      let file = slugify(`${artist} ${title}`) + ".mp3"; if (have.has(file)) file = slugify(`${artist} ${title}`) + "-" + Date.now().toString(36) + ".mp3";
      const sec = await durationOf(f);
      if (U.stop) throw new Error("abort");
      x.st = "up"; x.pct = 0; paintUpload(true);
      await putTrack("tracks/" + file, f, p => { x.pct = p; paintUpload(); });
      await q(sb.from("gym_tracks").insert({ file, artist, title, album, track_no, sec, folder_id: folder?.id || null }), { silent: true });
      have.add(file); same.add(norm(artist) + "|" + norm(title)); x.st = "ok";
    } catch (e) { x.st = U.stop ? "skip" : "fail"; if (!U.stop) console.error(e); }
  }
  U.items.forEach(y => { if (y.st === "wait") y.st = "skip"; });
  U.run = false; M.loading = null; await loadTracks().catch(() => {});
  if (route().path === "music") rerender();
  const ok = U.items.filter(y => y.st === "ok").length, bad = U.items.filter(y => y.st === "fail").length;
  toast(U.stop ? `Загрузка остановлена, загружено: ${ok}` : bad ? `Загружено: ${ok}, не получилось: ${bad}` : `Загружено треков: ${ok}`);
}
addEventListener("beforeunload", ev => { if (U.run) ev.preventDefault(); }); // не потерять загрузку случайным закрытием вкладки
// ---------- Фото и любимые треки в профиле: видят все вошедшие, менять может только владелец ----------
const PF = { photos: {}, tracks: {}, urls: {}, loading: {}, busy: "" };
const PF_MAX = 10;
function loadPf(uid, force) {
  if (!force && (PF.photos[uid] || PF.loading[uid])) return PF.loading[uid] || Promise.resolve();
  return PF.loading[uid] = (async () => {
    const [photos, favs] = await Promise.all([
      q(sb.from("gym_photos").select("*").eq("user_id", uid).order("created_at", { ascending: false }), { silent: true }).catch(() => []),
      q(sb.from("gym_profile_tracks").select("track_id").eq("user_id", uid).order("created_at", { ascending: false }), { silent: true }).catch(() => []),
    ]);
    const need = photos.map(x => x.path).filter(x => !PF.urls[x]);
    if (need.length) { const { data } = await sb.storage.from("gym-avatars").createSignedUrls(need, 6 * 3600).catch(() => ({ data: [] })); for (const d of data || []) if (d.signedUrl) PF.urls[d.path] = d.signedUrl; }
    PF.photos[uid] = photos.filter(x => PF.urls[x.path]); PF.tracks[uid] = favs.map(x => x.track_id);
    if (!M.tracks && favs.length) await loadTracks().catch(() => {});
  })().finally(() => { PF.loading[uid] = null; });
}
// блоки «Фото» и «Любимые треки» — на своей странице и на странице друга
function pfBlocks(uid, own) {
  if (!PF.photos[uid]) { loadPf(uid).then(() => { if (["me", `u/${uid}`].includes(route().path)) rerender(); }); return `<div class="skel" style="height:140px;margin-top:12px;border-radius:18px"></div>`; }
  const ph = PF.photos[uid];
  const favs = PF.tracks[uid] || [];
  const idx = favs.map(id => M.tracks ? M.tracks.findIndex(t => t.id === id) : -1).filter(i => i >= 0);
  const photos = ph.length || own ? `<section class="card">
      <div class="card-head"><h2 class="card-t">Фото</h2>${ph.length ? `<span class="hint">${ph.length}</span>` : ""}</div>
      ${!ph.length ? `<p class="hint">Добавь фото с тренировок или формы — их увидят друзья.</p>` : ""}
      <div class="ph-grid">
        ${own ? `<label class="ph-add ${PF.busy ? "busy" : ""}">${PF.busy ? `<span class="spin" aria-hidden="true"></span><span>${PF.busy}</span>` : `${I.plus}<span>Добавить</span>`}<input type="file" accept="image/*" multiple hidden data-field="ph-files" ${PF.busy ? "disabled" : ""}></label>` : ""}
        ${ph.map((x, k) => `<button class="ph" data-act="ph-open" data-u="${uid}" data-k="${k}" aria-label="Открыть фото ${k + 1}"><img src="${PF.urls[x.path]}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')"></button>`).join("")}
      </div></section>` : "";
  const tracks = idx.length || own ? `<section class="card">
      <div class="card-head"><h2 class="card-t">${own ? "Мои треки" : "Треки"}</h2>${own ? `<button class="linkbtn" data-act="pf-pick">${I.plus}Добавить</button>` : ""}</div>
      ${idx.length ? `<ol class="tracks pf-tracks">${idx.map(i => { const t = M.tracks[i], f = folderOf(t) || { name: t.artist };
        return `<li class="${i === M.i ? "cur" : ""} ${i === M.i && !M.audio.paused ? "playing" : ""}" data-i="${i}"><button class="track" data-act="pf-play" data-u="${uid}" data-i="${i}">
          <span class="pf-cov">${coverHTML(f)}<span class="pf-ic" aria-hidden="true">${i === M.i && !M.audio.paused ? I.pause : I.play}</span></span>
          <span class="tr-t"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></span><span class="tr-d mono">${mmss(t.sec)}</span></button></li>`; }).join("")}</ol>`
        : `<p class="hint">Выставь сюда треки, которые хочешь показать друзьям: кнопкой «Добавить» или в «Музыке» через ⋯ у трека.</p>`}
    </section>` : "";
  return photos + tracks;
}
// Трек в профиль и обратно — из «Музыки» (⋯ у трека, большой плеер) и из профиля («Добавить»).
const inProfile = t => !!t && (PF.tracks[S.user.id] || []).includes(t.id);
async function toggleProfileTrack(t, quiet) {
  if (!t) return; const me = S.user.id; await loadPf(me);
  const list = PF.tracks[me] ||= [], had = list.includes(t.id);
  if (!had && list.length >= PF_MAX) { toast(`В профиле уже ${PF_MAX} треков — убери какой-нибудь`); return false; }
  try {
    if (had) await q(sb.from("gym_profile_tracks").delete().eq("user_id", me).eq("track_id", t.id));
    else await q(sb.from("gym_profile_tracks").insert({ track_id: t.id }));
  } catch { return false; }
  PF.tracks[me] = had ? list.filter(x => x !== t.id) : [t.id, ...list];
  if (!quiet) toast(had ? "Убрано из профиля" : "Добавлено в профиль — друзья его увидят");
  drawFull(); if (["me", "music"].includes(route().path)) rerender();
  return true;
}
function pickProfileTracks() {
  const row = (t, i) => { const on = inProfile(t); return `<button class="pt-row" data-i="${i}" aria-pressed="${on}"><span class="pf-cov">${coverHTML(folderOf(t) || { name: t.artist })}</span>
      <span class="tr-t"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></span><span class="pt-mark" aria-hidden="true">${on ? I.check : I.plus}</span></button>`; };
  const list = qv => { const w = norm(qv).split(/\s+/).filter(Boolean);
    const all = M.tracks.map((t, i) => ({ t, i })).filter(({ t }) => { const h = norm(`${t.title} ${t.artist} ${t.album}`); return w.every(x => h.includes(x)); });
    return all.length ? all.slice(0, 80).map(({ t, i }) => row(t, i)).join("") : `<p class="hint">Ничего не нашлось</p>`; };
  const count = () => `${(PF.tracks[S.user.id] || []).length} из ${PF_MAX}`;
  const go = () => sheet("Треки в профиль", `<label class="mu-search">${I.search}<input type="search" data-q placeholder="Найти трек или группу" autocomplete="off" aria-label="Поиск"></label>
    <p class="hint pt-count">В профиле: ${count()}</p><div class="pt-list">${list("")}</div>`, el => {
    const box = el.querySelector(".pt-list"), inp = el.querySelector("[data-q]");
    inp.addEventListener("input", () => { box.innerHTML = list(inp.value); });
    box.addEventListener("click", async ev => {
      const b = ev.target.closest(".pt-row"); if (!b || b.disabled) return; b.disabled = true;
      const t = M.tracks[+b.dataset.i];
      if (await toggleProfileTrack(t, true)) { b.outerHTML = row(t, +b.dataset.i); el.querySelector(".pt-count").textContent = `В профиле: ${count()}`; } else b.disabled = false;
    });
  });
  if (M.tracks) go(); else loadTracks().then(go).catch(() => toast("Не получилось загрузить треки"));
}
// ---------- Прогресс фигуры: фото «до / после» — видит только владелец (закрытый бакет gym-progress) ----------
const PG = { list: null, urls: {}, loading: null, open: false, busy: false };
function loadProgress() {
  return PG.loading ||= (async () => {
    const rows = await q(sb.from("gym_progress").select("*").eq("user_id", S.user.id).order("day").order("created_at"), { silent: true }).catch(() => []);
    const need = rows.map(r => r.path).filter(p => !PG.urls[p]);
    if (need.length) { const { data } = await sb.storage.from("gym-progress").createSignedUrls(need, 6 * 3600).catch(() => ({ data: [] })); for (const d of data || []) if (d.signedUrl) PG.urls[d.path] = d.signedUrl; }
    PG.list = rows;
  })().finally(() => { PG.loading = null; });
}
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
// «до» для быстрого сравнения: снимок не позже чем за n дней до последнего (или самый ранний)
function beforeFor(n) {
  const L = PG.list || [], last = L.at(-1); if (!last || L.length < 2) return null;
  if (n === "first") return L[0];
  const lim = addDays(last.day, -n); return [...L].reverse().find(x => x.day <= lim && x !== last) || null;
}
function progressBlock() {
  const L = PG.list;
  if (!L && PG.open) loadProgress().then(() => { if (route().path === "me") rerender(); });
  const last = L?.at(-1);
  const quick = L && L.length > 1 ? [[14, "2 недели"], [30, "месяц"], [90, "3 месяца"], ["first", "с первого"]].filter(([n]) => beforeFor(n)) : [];
  return `<details class="card prog-fold" ${PG.open ? "open" : ""} data-pg-fold>
    <summary><span><b>Прогресс фигуры</b><span class="hint">фото «до / после» · видишь только ты</span></span>${I.right}</summary>
    ${!PG.open ? "" : !L ? `<div class="skel" style="height:120px"></div>` : `
      ${quick.length ? `<div class="pg-quick"><span class="hint">Сравнить:</span>${quick.map(([n, l]) => `<button class="chip-btn" data-act="pg-cmp" data-n="${n}">${l}</button>`).join("")}</div>` : ""}
      <div class="pg-grid">
        <label class="ph-add pg-add ${PG.busy ? "busy" : ""}">${PG.busy ? `<span class="spin" aria-hidden="true"></span><span>Загружаю</span>` : `${I.camera}<span>Добавить фото</span>`}<input type="file" accept="image/*" hidden data-field="pg-file" ${PG.busy ? "disabled" : ""}></label>
        ${[...L].reverse().map(x => `<button class="pg-item" data-act="pg-open" data-id="${x.id}"><img src="${PG.urls[x.path] || ""}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')"><span>${shortDay(x.day)}${x.weight_kg ? ` · ${fmt(x.weight_kg, 1)} кг` : ""}</span></button>`).join("")}
      </div>
      ${!L.length ? `<p class="hint">Снимай в одной позе, при одном свете и в одно время — тогда разница видна честно. Например, раз в две недели.</p>` : L.length === 1 ? `<p class="hint">Добавь ещё одно фото позже — и можно будет сравнить «до» и «после».</p>` : ""}`}
  </details>`;
}
// добавить фото: дата и вес (по умолчанию — сегодня и вес из профиля)
function addProgress(file) {
  if (!file || !/^image\//.test(file.type)) return toast("Нужна картинка");
  const url = URL.createObjectURL(file);
  sheet("Фото прогресса", `<form class="pg-form" data-pg-form>
      <div class="pg-preview"><img src="${url}" alt=""></div>
      <div class="grid2">
        <label class="field"><span>Дата</span><input class="inp" type="date" name="day" value="${today()}" max="${today()}" required></label>
        <label class="field"><span>Вес, кг</span><input class="inp" name="w" inputmode="decimal" value="${S.profile?.weight_kg ?? ""}" placeholder="необязательно"></label>
      </div>
      <p class="err" role="alert"></p>
      <div class="sheet-actions"><button class="btn quiet" type="button" data-close>Отмена</button><button class="btn" type="submit">Сохранить</button></div>
    </form>`, (el, close) => {
    const f = el.querySelector("form");
    f.onsubmit = async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const btn = f.querySelector("[type=submit]"); btn.classList.add("loading"); btn.disabled = true;
      try {
        const { blob, w, h } = await fitJpeg(file, 1600), path = `${S.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await sb.storage.from("gym-progress").upload(path, blob, { contentType: "image/jpeg" }); if (error) throw error;
        const row = await q(sb.from("gym_progress").insert({ path, day: f.day.value || today(), weight_kg: num(f.w.value), w, h }).select().single(), { silent: true });
        PG.urls[path] = URL.createObjectURL(blob); PG.list = [...(PG.list || []), row].sort((a, b) => a.day.localeCompare(b.day) || a.created_at.localeCompare(b.created_at));
        close(); rerender(); toast("Фото добавлено");
      } catch (e) { console.error(e); btn.classList.remove("loading"); btn.disabled = false; f.querySelector(".err").textContent = "Не получилось — проверь интернет и попробуй ещё раз"; }
    };
  }, () => URL.revokeObjectURL(url));
}
// Сравнение: «после» поверх «до», шторку тянешь пальцем или мышью; снизу — выбор снимков
function compareProgress(a, b) {
  const L = PG.list || []; if (L.length < 2) return;
  let A = a || L[0], B = b || L.at(-1);
  const pick = (cur, side) => `<div class="pg-pick" data-side="${side}">${L.map(x => `<button class="${x === cur ? "on" : ""}" data-id="${x.id}" ${(side === "a" ? x === B : x === A) ? "disabled" : ""}><img src="${PG.urls[x.path]}" alt=""><span>${shortDay(x.day)}</span></button>`).join("")}</div>`;
  const body = () => { const d = daysBetween(A.day, B.day), dw = A.weight_kg != null && B.weight_kg != null ? +B.weight_kg - +A.weight_kg : null;
    return `<p class="pg-sum"><b>${Math.abs(d)} ${plural(Math.abs(d), "день", "дня", "дней")}</b>${dw != null ? ` · <b class="${dw < 0 ? "down" : dw > 0 ? "up" : ""}">${dw > 0 ? "+" : dw < 0 ? "−" : ""}${fmt(Math.abs(dw), 1)} кг</b>` : ""}</p>
      <div class="pg-cmp" style="--x:50%">
        <img src="${PG.urls[A.path]}" alt="До"><img class="after" src="${PG.urls[B.path]}" alt="После">
        <span class="pg-tag l">До · ${shortDay(A.day)}${A.weight_kg ? ` · ${fmt(A.weight_kg, 1)} кг` : ""}</span><span class="pg-tag r">После · ${shortDay(B.day)}${B.weight_kg ? ` · ${fmt(B.weight_kg, 1)} кг` : ""}</span>
        <i class="pg-line" aria-hidden="true"><b></b></i>
        <input type="range" min="0" max="100" value="50" aria-label="Шторка «до / после»">
      </div>
      <div class="eyebrow">До</div>${pick(A, "a")}<div class="eyebrow">После</div>${pick(B, "b")}`; };
  sheet("До и после", `<div class="pg-box">${body()}</div>`, el => {
    const box = el.querySelector(".pg-box");
    box.addEventListener("input", ev => { if (ev.target.type === "range") ev.target.closest(".pg-cmp").style.setProperty("--x", ev.target.value + "%"); });
    box.addEventListener("click", ev => {
      const b = ev.target.closest(".pg-pick button"); if (!b || b.disabled) return;
      const x = L.find(r => r.id === b.dataset.id); if (b.closest("[data-side]").dataset.side === "a") A = x; else B = x;
      if (A.day > B.day) [A, B] = [B, A];
      box.innerHTML = body();
    });
  });
}
// одно фото: крупно, удалить
function openProgress(id) {
  const x = (PG.list || []).find(r => r.id === id); if (!x) return;
  sheet(`${shortDay(x.day)}${x.weight_kg ? ` · ${fmt(x.weight_kg, 1)} кг` : ""}`, `<div class="pg-one"><img src="${PG.urls[x.path]}" alt=""></div>
    <div class="sheet-actions">${PG.list.length > 1 ? `<button class="btn quiet" data-cmp>Сравнить</button>` : ""}<button class="btn danger-soft" data-del>Удалить фото</button></div>`, (el, close) => {
    el.querySelector("[data-cmp]")?.addEventListener("click", () => { close(); const other = x === PG.list[0] ? PG.list.at(-1) : PG.list[0]; compareProgress(...[x, other].sort((a, b) => a.day.localeCompare(b.day))); });
    el.querySelector("[data-del]").addEventListener("click", async () => {
      close(); if (!await confirmSheet("Удалить фото?", "Снимок пропадёт насовсем.")) return;
      try { await q(sb.from("gym_progress").delete().eq("id", x.id)); sb.storage.from("gym-progress").remove([x.path]); PG.list = PG.list.filter(r => r !== x); rerender(); toast("Фото удалено"); } catch {}
    });
  });
}
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "pg-file") { addProgress(ev.target.files[0]); ev.target.value = ""; } });
document.addEventListener("toggle", ev => { if (ev.target.matches?.("[data-pg-fold]")) { const was = PG.open; PG.open = ev.target.open; if (PG.open && !was && !PG.list) rerender(); } }, true);
// Фото уменьшается до 1600 точек по длинной стороне и сохраняется в JPEG — чётко, но не мегабайты.
function fitJpeg(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = async () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      for (const qv of [0.86, 0.78, 0.68]) { const b = await new Promise(r => c.toBlob(r, "image/jpeg", qv)); if (b && (b.size < 1.9e6 || qv === 0.68)) return res({ blob: b, w, h }); }
      rej(new Error("blob"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
async function uploadPhotos(files) {
  files = [...files].filter(f => /^image\//.test(f.type)); if (!files.length) return toast("Нужны картинки");
  const me = S.user.id; let ok = 0;
  for (const [k, f] of files.entries()) {
    PF.busy = files.length > 1 ? `${k + 1} из ${files.length}` : "Загружаю"; if (route().path === "me") rerender();
    try {
      const { blob, w, h } = await fitJpeg(f), path = `${me}/photos/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
      const { error } = await sb.storage.from("gym-avatars").upload(path, blob, { contentType: "image/jpeg" }); if (error) throw error;
      const row = await q(sb.from("gym_photos").insert({ path, w, h }).select().single(), { silent: true });
      PF.urls[path] = URL.createObjectURL(blob); (PF.photos[me] ||= []).unshift(row); ok++;
    } catch (e) { console.error(e); }
  }
  PF.busy = ""; if (route().path === "me") rerender();
  toast(ok === files.length ? (ok > 1 ? `Добавлено фото: ${ok}` : "Фото добавлено") : `Добавлено ${ok} из ${files.length} — остальные не получились`);
}
// Просмотр фото на весь экран: стрелки, свайп, клавиши ← → и Esc; своё фото можно удалить.
function lightbox(list, k = 0, own = false) {
  const el = document.createElement("div"); el.className = "lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Фото");
  el.innerHTML = `<div class="lb-top"><span class="lb-n mono"></span><span class="lb-acts">${own ? `<button class="lb-btn" data-lb="del" aria-label="Удалить фото" title="Удалить">${I.trash}</button>` : ""}<button class="lb-btn" data-lb="x" aria-label="Закрыть">${I.x}</button></span></div>
    <img class="lb-img" alt=""><button class="lb-btn lb-prev" data-lb="prev" aria-label="Предыдущее">${I.left}</button><button class="lb-btn lb-next" data-lb="next" aria-label="Следующее">${I.right}</button>`;
  const img = el.querySelector("img");
  const close = () => { el.classList.remove("on"); document.removeEventListener("keydown", key); document.documentElement.classList.remove("lb-open"); setTimeout(() => el.remove(), 220); };
  const show = () => {
    if (!list.length) return close(); k = (k + list.length) % list.length;
    img.classList.remove("ok"); img.onload = () => img.classList.add("ok"); img.src = list[k].src;
    el.querySelector(".lb-n").textContent = list.length > 1 ? `${k + 1} / ${list.length}` : "";
    el.classList.toggle("one", list.length < 2);
  };
  const key = ev => { if (ev.key === "Escape") close(); else if (ev.key === "ArrowRight") { k++; show(); } else if (ev.key === "ArrowLeft") { k--; show(); } };
  el.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-lb]")?.dataset.lb;
    if (!b) { if (ev.target === el) close(); return; }
    if (b === "x") close(); else if (b === "next") { k++; show(); } else if (b === "prev") { k--; show(); }
    else if (b === "del") {
      const x = list[k]; if (!await confirmSheet("Удалить фото?", "Его больше не увидят друзья.")) return;
      try { await q(sb.from("gym_photos").delete().eq("id", x.id)); sb.storage.from("gym-avatars").remove([x.path]);
        PF.photos[S.user.id] = PF.photos[S.user.id].filter(y => y.id !== x.id); list.splice(k, 1); show(); if (route().path === "me") rerender(); toast("Фото удалено"); } catch {}
    }
  });
  let x0 = null;
  el.addEventListener("touchstart", ev => { x0 = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
  el.addEventListener("touchend", ev => { if (x0 == null) return; const dx = ev.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50 && list.length > 1) { k += dx < 0 ? 1 : -1; show(); } });
  document.addEventListener("keydown", key);
  document.body.append(el); document.documentElement.classList.add("lb-open"); show();
  requestAnimationFrame(() => el.classList.add("on"));
}
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "ph-files") { uploadPhotos(ev.target.files); ev.target.value = ""; } });
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "p-avatar") { uploadAvatar(ev.target.files[0]); ev.target.value = ""; } });
document.addEventListener("change", ev => { if (ev.target.dataset?.field === "mu-files") { uploadTracks(ev.target.files); ev.target.value = ""; } });
document.addEventListener("dragover", ev => { if (route().path === "music" && S.user?.id === OWNER && ev.dataTransfer?.types.includes("Files")) { ev.preventDefault(); document.documentElement.classList.add("mu-drop"); } });
document.addEventListener("dragleave", ev => { if (!ev.relatedTarget) document.documentElement.classList.remove("mu-drop"); });
document.addEventListener("drop", ev => { if (route().path !== "music" || S.user?.id !== OWNER || !ev.dataTransfer?.files.length) return; ev.preventDefault(); document.documentElement.classList.remove("mu-drop"); uploadTracks(ev.dataTransfer.files); });

function playAt(i) {
  const t = M.tracks[i]; if (!t) return;
  M.i = i; M.audio.src = M.urls[t.file]; M.audio.play().catch(() => {});
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: folderOf(t)?.name || "Train", artwork: coverOf(folderOf(t)) ? [{ src: coverOf(folderOf(t)), sizes: "400x400" }] : [] });
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
  const playing = !M.audio.paused;
  document.querySelectorAll(".pf-tracks li").forEach(li => { // любимые треки в профиле
    const cur = +li.dataset.i === M.i; li.classList.toggle("cur", cur); li.classList.toggle("playing", cur && playing);
    li.querySelector(".pf-ic").innerHTML = cur && playing ? I.pause : I.play;
  });
  if (route().path !== "music") return;
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
    ({ open: openFull, close: closeFull, hide: hidePlayer, share: () => shareTrack(M.tracks[M.i]), prof: () => toggleProfileTrack(M.tracks[M.i]), dl: () => downloadTrack(M.tracks[M.i]),
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
        <span class="pl-wide">${volHTML()}</span>
        <button class="icon-btn bare pl-x" data-p="hide" aria-label="Закрыть плеер" title="Закрыть плеер">${I.x}</button></div>`;
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
      <header class="now-head"><button class="icon-btn bare" data-p="close" aria-label="Свернуть">${I.down}</button><span class="eyebrow" data-from></span><span class="now-acts"><button class="icon-btn bare" data-p="dl" aria-label="Скачать трек" title="Скачать">${I.download}</button><button class="icon-btn bare" data-p="share" aria-label="Поделиться треком" title="Поделиться">${I.share}</button></span></header>
      <div class="now-cover"></div>
      <div class="now-title"><div><h2 data-title></h2><p class="muted" data-artist></p></div><button class="icon-btn bare now-fav" data-p="fav"></button></div>
      <button class="now-prof" data-p="prof"></button>
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
    swipeDown(M.full.querySelector(".now-in"), closeFull);
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
  if (M.full.dataset.cov !== (f.id || f.name)) { M.full.dataset.cov = f.id || f.name; M.full.querySelector(".now-cover").innerHTML = coverHTML(f, "xl"); ambient(f); }
  const paused = M.audio.paused, play = M.full.querySelector(".pl-play");
  play.innerHTML = paused ? I.play : I.pause; play.setAttribute("aria-label", paused ? "Играть" : "Пауза");
  M.full.querySelector("[data-p=shuffle]").setAttribute("aria-pressed", M.shuffle);
  const pb = M.full.querySelector("[data-p=prof]"), inP = inProfile(t); pb.setAttribute("aria-pressed", inP);
  pb.innerHTML = inP ? `${I.check}В профиле` : `${I.plus}В профиль`; pb.title = inP ? "Убрать из профиля" : "Показать трек друзьям в профиле";
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

// Крестик в мини-плеере: музыка останавливается, плеер уезжает. Следующий трек — снова из списка.
function hidePlayer() {
  M.audio.pause(); closeFull(); forgetPos();
  const bar = M.bar; M.bar = null; M.i = -1; M.audio.removeAttribute("src");
  document.documentElement.classList.remove("has-player");
  bar?.classList.remove("on"); setTimeout(() => bar?.remove(), 260);
  refreshTracks();
}
// Где остановились: после перезагрузки плеер появляется на паузе на том же месте.
const POS_KEY = "gym-last-track";
let posSaved = 0;
function savePos(force) {
  const t = M.tracks?.[M.i]; if (!t || (!force && Date.now() - posSaved < 4000)) return; posSaved = Date.now();
  try { localStorage.setItem(POS_KEY, JSON.stringify({ user: S.user?.id, file: t.file, at: Math.floor(M.audio.currentTime || 0) })); } catch {}
}
function forgetPos() { try { localStorage.removeItem(POS_KEY); } catch {} }
M.audio.addEventListener("timeupdate", () => savePos());
M.audio.addEventListener("pause", () => savePos(true));
function restorePos() {
  if (M.i >= 0 || !M.tracks) return;
  let last; try { last = JSON.parse(localStorage.getItem(POS_KEY)); } catch {}
  const i = last?.user === S.user?.id ? M.tracks.findIndex(t => t.file === last.file) : -1; if (i < 0) return;
  M.i = i; M.audio.preload = "metadata"; M.audio.src = M.urls[M.tracks[i].file];
  const at = last.at > 3 && last.at < (M.tracks[i].sec || 1e9) - 3 ? last.at : 0;
  M.audio.currentTime = at; // до загрузки данных браузер запоминает это как место старта
  M.audio.addEventListener("loadedmetadata", () => { if (at && M.audio.currentTime < 1) M.audio.currentTime = at; paintTime(); }, { once: true });
  drawBar(); refreshTracks();
}

// Поделиться треком: ссылка открывает у друга «Музыку» на этом треке, играет он по нажатию.
async function shareTrack(t) {
  if (!t) return;
  const url = `${location.origin}/#/music?t=${t.id}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: `${t.title} — ${t.artist}`, url }); } catch {} // закрыл меню — ничего не делаем
    return;
  }
  try { await navigator.clipboard.writeText(url); toast("Ссылка на трек скопирована — отправь её другу"); }
  catch { sheet("Ссылка на трек", `<p class="muted">${esc(t.title)} — ${esc(t.artist)}</p><input class="inp" readonly value="${esc(url)}" onfocus="this.select()">`); }
}
const sharedId = () => new URLSearchParams(location.hash.split("?")[1] || "").get("t");
// Открыли ссылку на трек: папка трека, трек заряжен в плеер на паузе и открыт большой плеер — остаётся нажать «Играть».
function openShared() {
  const id = sharedId(); if (!id || !M.tracks) return;
  history.replaceState(null, "", "#/music"); // ссылка срабатывает один раз; дальше — обычная «Музыка»
  const i = M.tracks.findIndex(t => t.id === id), t = M.tracks[i];
  if (!t) return queueMicrotask(() => toast("Этого трека уже нет — возможно, его удалили"));
  M.q = ""; M.folder = t.folder_id || null;
  if (M.i !== i) { M.audio.pause(); M.i = i; M.audio.preload = "metadata"; M.audio.src = M.urls[t.file]; M.audio.currentTime = 0; }
  setTimeout(() => { drawBar(); refreshTracks(); openFull(); M.full?.querySelector(".pl-play")?.focus({ preventScroll: true });
    document.querySelector(`.tracks li[data-i="${i}"]`)?.scrollIntoView({ block: "center" }); }, 0);
}

// Свайп вниз по большому плееру (когда он не прокручен) — свернуть.
function swipeDown(el, done) {
  let y0 = null, dy = 0;
  el.addEventListener("touchstart", ev => { y0 = el.scrollTop <= 0 && !ev.target.closest("input[type=range]") ? ev.touches[0].clientY : null; dy = 0; }, { passive: true });
  el.addEventListener("touchmove", ev => {
    if (y0 == null) return; dy = Math.max(0, ev.touches[0].clientY - y0);
    el.style.transition = "none"; el.style.transform = dy ? `translateY(${dy}px)` : "";
  }, { passive: true });
  el.addEventListener("touchend", () => {
    if (y0 == null) return; y0 = null; el.style.transition = ""; el.style.transform = "";
    if (dy > 110) done();
  });
}
// Фон большого плеера мягко окрашивается в цвет обложки.
function ambient(f) {
  const el = M.full?.querySelector(".now-in"), src = coverOf(f); if (!el) return;
  if (!src) return el.style.setProperty("--amb", `hsl(${tileHue(f?.name)} 45% 45%)`);
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 8;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, 8, 8);
      const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      const n = d.length / 4; el.style.setProperty("--amb", `rgb(${r / n | 0} ${g / n | 0} ${b / n | 0})`);
    } catch { el.style.removeProperty("--amb"); }
  };
  img.src = src;
}

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
// Обложка из двух фото: «Проснулся» → «Идти работат», между ними молния.
function duoHTML(pr) {
  const half = (ph, side) => { const src = ph.storage ? (S.fun[ph.storage] || (photoSrc(pr), "")) : ph.src;
    return `<div class="duo-half ${side}">${src ? `<img src="${src}" alt="${esc(ph.caption)}" decoding="async" style="object-position:${ph.pos || "50% 40%"}">` : ""}<b>${esc(ph.caption)}</b></div>`; };
  return `<figure class="prog-photo duo joke" data-act="storm" data-id="${pr.id}">${half(pr.photo, "l")}${half(pr.photo2, "r")}
    <svg class="duo-bolt" viewBox="0 0 40 220" preserveAspectRatio="none" aria-hidden="true"><path d="M24 0 L12 70 L26 74 L10 150 L22 154 L14 220"/></svg></figure>`;
}
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
  const paths = PROGRAMS.flatMap(p => [p.photo?.storage, p.photo2?.storage, ...[p.flash || []].flat()]).filter(Boolean);
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
  // случайное фото из списка, не то же, что в прошлый раз
  const pr = programById(id), pool = [pr?.flash || []].flat().filter(f => S.fun[f]);
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && pick === S.lastFlash) pick = pool[(pool.indexOf(pick) + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length];
  S.lastFlash = pick; const face = pick && S.fun[pick];
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
    ${(rec => rec.length ? `<section class="card"><div class="card-head"><h2 class="card-t">Рекорды</h2><span class="hint">лучший вес</span></div>
      <ul class="lifts rec-list">${rec.slice(0, 6).map(r => `<li><button class="lift-btn" data-act="lift-chart" data-n="${esc(r.name)}"><span class="lift-n">${esc(r.name)}</span><span class="mono">${fmt(r.w, 1)} кг</span><span class="lift-d">${shortDay(r.d)} · ${I.chart}график</span></button></li>`).join("")}</ul></section>` : "")(records())}
    ${pfBlocks(S.user.id, true)}
    ${progressBlock()}
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
      <p class="look-label" id="look-pal">Палитра</p>
      <div class="look-pals" role="radiogroup" aria-labelledby="look-pal">${Object.entries(PALETTES).map(([k, x]) => `<button class="look-pal" role="radio" data-act="look" data-k="palette" data-v="${k}" aria-checked="${getLook("palette") === k}">${palPreview(k)}<span>${x.label}</span></button>`).join("")}</div>
      <p class="look-label" id="look-acc">Цвет кнопок и ссылок</p>
      <div class="look-accents" role="radiogroup" aria-labelledby="look-acc">${Object.entries(ACCENTS).map(([k, a]) => `<button class="swatch" role="radio" data-act="look" data-k="accent" data-v="${k}" aria-checked="${getLook("accent") === k}" aria-label="${a.label}" title="${a.label}" style="--sw:${a.l};--sw-d:${a.d}"><i aria-hidden="true"></i></button>`).join("")}</div>
      <p class="hint">Запоминается на этом устройстве.</p>
    </section>
    <section class="card">
      <h2 class="card-t">Аккаунт</h2>
      <p class="hint">Вход по почте ${esc(S.user.email)}. Тренировки хранятся в аккаунте и видны на любом устройстве.</p>
      <div class="row"><button class="btn danger-soft" data-act="logout">Выйти из аккаунта</button><button class="linkbtn del-acc" data-act="del-acc">Удалить аккаунт</button></div>
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
  if (act === "lift-chart") return liftChart(b.dataset.n, b.dataset.u); // график веса — из упражнения, рекордов и страницы друга
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
    case "yt-play": { const i = +b.dataset.i; if (i === YT.i && YT.player?.getPlayerState) { YT.playing ? YT.player.pauseVideo() : YT.player.playVideo(); } else ytPlay(i); break; }
    case "yt-all": ytPlay(0); break;
    case "yt-exp": ytToggle(+b.dataset.i); break;
    case "yt-at": { const i = +b.dataset.i, k = +b.dataset.k; if (i === YT.i && k === YT.plk && YT.player?.getPlayerState) { YT.playing ? YT.player.pauseVideo() : YT.player.playVideo(); } else ytPlayAt(i, k); break; }
    case "yt-watch": { const i = +b.dataset.i, k = +b.dataset.k; if (k < 0) { await ytPlay(i); if (YT.dock) { YT.dock.classList.add("big"); YT.dock.classList.remove("mini"); } } else ytPlayAt(i, k, true); break; }
    case "yt-del": { const x = YT.list[+b.dataset.i]; if (!x || !await confirmSheet("Убрать из списка?", `«${x.title || "Видео"}» пропадёт из общего списка.`, "Убрать")) break;
      try { await q(sb.from("gym_yt").delete().eq("id", x.id)); const cur = YT.list[YT.i]; YT.list = YT.list.filter(y => y !== x); YT.i = cur ? YT.list.indexOf(cur) : -1; rerender(); } catch {} break; }
    case "mu-q-clear": M.q = ""; rerender(); document.querySelector("[data-field=mu-q]")?.focus(); break;
    case "prog-where": S.progWhere = b.dataset.v; rerender(); break;
    case "mu-track-menu": trackMenu(+b.dataset.i); break;
    case "mu-new-folder": newFolderSheet(); break;
    case "mu-folder-menu": folderMenu(); break;
    case "ph-open": { const uid = b.dataset.u; lightbox(PF.photos[uid].map(x => ({ ...x, src: PF.urls[x.path] })), +b.dataset.k, uid === S.user.id); break; }
    case "ph-ava": lightbox([{ src: S.avatars[b.dataset.u] }]); break;
    case "pf-pick": pickProfileTracks(); break;
    case "pg-open": openProgress(b.dataset.id); break;
    case "pg-cmp": { const B = PG.list.at(-1), A = beforeFor(b.dataset.n === "first" ? "first" : +b.dataset.n); if (A) compareProgress(A, B); break; }
    case "pf-play": { const i = +b.dataset.i; if (i === M.i) { M.audio.paused ? M.audio.play().catch(() => {}) : M.audio.pause(); break; }
      const uid = b.dataset.u; M.queue = (PF.tracks[uid] || []).map(id => M.tracks.find(t => t.id === id)?.file).filter(Boolean); playAt(i); break; }
    case "mu-share": shareTrack(M.tracks[+b.dataset.i]); break;
    case "mu-up-stop": U.stop = true; U.xhr?.abort(); break;
    case "mu-up-close": U.items = []; document.getElementById("mu-upl")?.remove(); break;
    case "mu-up-retry": U.items = U.items.filter(y => y.st === "fail" || y.st === "skip").map(y => ({ f: y.f, st: "wait", pct: 0 })); runUpload(); break;
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
      await flush().catch(() => {});
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
    case "theme": setTheme(b.dataset.v); b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b));
      document.querySelectorAll(".look-pal").forEach(x => { x.querySelector(".pal-prev").outerHTML = palPreview(x.dataset.v); }); break; // превью — под светлую или тёмную
    case "look": setLook(b.dataset.k, b.dataset.v); b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); break;
    case "del-acc": deleteAccount(); break;
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
      const row = { ...tmp, plan: null, user_id: S.user.id, created_at: new Date().toISOString() };
      enqueue({ k: "gym_exercises:" + tmp.id, t: "gym_exercises", kind: "upsert", row: tmp });
      S.exercises.push(row); S.open.add(row.id);
      const ol = document.getElementById("ex-list");
      if (ol) { ol.insertAdjacentHTML("beforeend", exRow(row, list.length, S.day)); refreshDayBits(); } else rerender();
      document.querySelector(`[data-ex="${row.id}"] .set input`)?.focus();
    } catch { form.name.value = name; }
  }
});

/* ---------- start ---------- */
// Сам сайт (страница, скрипты, шрифты, картинки) кэшируется, чтобы открываться в зале без связи.
if ("serviceWorker" in navigator && !import.meta.env.DEV) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
sb.auth.onAuthStateChange((event, session) => {
  const u = session?.user || null;
  if (S.started && (u?.id ?? null) === (S.user?.id ?? null)) return; // обновление токена — не перерисовываем
  S.started = true;
  S.user = u; S.loaded = false;
  Object.assign(PG, { list: null, urls: {}, open: false }); // фото прогресса — только свои, у другого аккаунта их не показываем
  document.querySelectorAll(".sheet-backdrop, .lb").forEach(x => x.remove()); document.documentElement.classList.remove("lb-open"); // окна прошлого аккаунта не остаются
  if (!u) scrollTo({ top: 0 });
  chatEl?.remove(); chatDim.remove(); chatEl = null; stopMusic(); document.documentElement.classList.remove("chat-open"); // чат другого аккаунта не показываем
  render();
  if (!u) return;
  obLoad();
  const extras = () => { loadTracks().then(restorePos).catch(() => {}); loadPf(S.user.id).then(drawFull).catch(() => {}); };
  // нет сети — сразу последние сохранённые данные; сеть есть, но сервер молчит 6 секунд — тоже они, а загрузка идёт дальше в фоне
  const quick = setTimeout(() => { if (!S.loaded && fromSnapshot()) { render(); paintSync(); } }, navigator.onLine ? 6000 : 0);
  loadAll().then(() => { clearTimeout(quick); paintSync(); render(); extras(); }).catch(() => {
    clearTimeout(quick);
    if (S.loaded || fromSnapshot()) { render(); paintSync(); return; }
    app.querySelector("#main").innerHTML = `<div class="hero"><p class="muted">Не получилось загрузить данные.</p><div><button class="btn" onclick="location.reload()">Обновить</button></div></div>`;
  });
});
// на вкладке, открытой с вечера, «сегодня» должно сдвинуться
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.loaded) { const t = today(); if (S._t && S._t !== t) { S.day = t; render(); } S._t = t; } });
S._t = today();

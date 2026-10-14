// Музыка в Cloudflare R2: временные ссылки на прослушивание и скачивание (всем вошедшим),
// загрузка, удаление, перенос из хранилища Supabase и настройка CORS корзины — только владельцу музыки.
// Ключи R2 — только в секретах функции (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const OWNER = "63719d65-7465-436c-b3e0-0fd943771228";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ACC = Deno.env.get("R2_ACCOUNT_ID") || "", KEY = Deno.env.get("R2_ACCESS_KEY_ID") || "", SECRET = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const BUCKET = Deno.env.get("R2_BUCKET") || "train-music";
const ready = !!(ACC && KEY && SECRET);
const r2 = ready ? new AwsClient({ accessKeyId: KEY, secretAccessKey: SECRET, service: "s3", region: "auto" }) : null;
const base = `https://${ACC}.r2.cloudflarestorage.com/${BUCKET}`;
const okKey = (k: unknown) => typeof k === "string" && /^tracks\/[\w.\-]{1,200}$/.test(k);
const url = (k: string) => `${base}/${k.split("/").map(encodeURIComponent).join("/")}`;

async function presign(k: string, method: "GET" | "PUT", sec: number, extra: Record<string, string> = {}) {
  const u = new URL(url(k));
  u.searchParams.set("X-Amz-Expires", String(sec));
  for (const [a, b] of Object.entries(extra)) u.searchParams.set(a, b);
  const signed = await r2!.sign(new Request(u, { method }), { aws: { signQuery: true } });
  return signed.url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "auth" }, 401);
  if (b.action === "status") return json({ ready, bucket: BUCKET });
  if (!ready) return json({ error: "not_configured" }, 503);
  const owner = user.id === OWNER;

  // ссылки на прослушивание (6 часов); со скачиванием — с именем файла
  if (b.action === "get") {
    const keys: string[] = (Array.isArray(b.keys) ? b.keys : []).filter(okKey).slice(0, 1000);
    const out: Record<string, string> = {};
    await Promise.all(keys.map(async k => { out[k] = await presign(k, "GET", 6 * 3600); }));
    return json({ urls: out });
  }
  if (b.action === "download") {
    if (!okKey(b.key)) return json({ error: "key" }, 400);
    const name = String(b.name || "track.mp3").replace(/[\\/:*?"<>|]+/g, " ").slice(0, 150);
    return json({ url: await presign(b.key, "GET", 600, { "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` }) });
  }

  if (!owner) return json({ error: "forbidden" }, 403);
  if (b.action === "put") { // загрузка с компьютера владельца: прямая ссылка на запись в R2 (1 час)
    if (!okKey(b.key)) return json({ error: "key" }, 400);
    return json({ url: await presign(b.key, "PUT", 3600) });
  }
  if (b.action === "delete") {
    const keys: string[] = (Array.isArray(b.keys) ? b.keys : []).filter(okKey).slice(0, 100);
    await Promise.all(keys.map(k => r2!.fetch(url(k), { method: "DELETE" })));
    return json({ ok: true });
  }
  if (b.action === "copy") { // перенос одного трека из хранилища Supabase в R2
    const file = String(b.file || ""), k = `tracks/${file}`;
    if (!okKey(k)) return json({ error: "key" }, 400);
    const { data: blob, error } = await admin.storage.from("gym-music").download(k);
    if (error || !blob) return json({ error: "download" }, 502);
    const put = await r2!.fetch(url(k), { method: "PUT", body: await blob.arrayBuffer(), headers: { "Content-Type": "audio/mpeg" } });
    if (!put.ok) return json({ error: "upload", status: put.status }, 502);
    await admin.from("gym_tracks").update({ r2: true }).eq("file", file);
    return json({ ok: true, size: blob.size });
  }
  if (b.action === "cors") { // корзина разрешает сайту загружать (PUT) и читать файлы
    const origins = ["https://training-diary-azure.vercel.app", "http://localhost:5191", "http://127.0.0.1:5191"];
    const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule>${origins.map(o => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
    const body = new TextEncoder().encode(xml);
    const md5 = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("MD5", body).catch(() => new ArrayBuffer(0)))));
    const r = await r2!.fetch(`${base}?cors`, { method: "PUT", body, headers: { "Content-Type": "application/xml", ...(md5 ? { "Content-MD5": md5 } : {}) } });
    return json({ ok: r.ok, status: r.status, text: r.ok ? "" : (await r.text()).slice(0, 300) });
  }
  return json({ error: "action" }, 400);
});

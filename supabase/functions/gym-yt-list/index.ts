// Список видео плейлиста YouTube одним запросом: id, название, исполнитель, длительность (первые ~100).
// YouTube без ключа API такого не даёт, поэтому читаем данные со страницы плейлиста на сервере.
// Только для вошедших пользователей дневника — чтобы функция не стала открытым прокси.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "private, max-age=600" } });

type Item = { id: string; t: string; a: string; len: string };
const pick = (o: any, path: (string | number)[]) => path.reduce((x, k) => (x == null ? x : x[k]), o);

function collect(data: unknown): Item[] {
  const out: Item[] = [];
  const walk = (o: any) => {
    if (Array.isArray(o)) { for (const v of o) walk(v); return; }
    if (!o || typeof o !== "object") return;
    const l = o.lockupViewModel;
    if (l && l.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && l.contentId) {
      const md = pick(l, ["metadata", "lockupMetadataViewModel"]) || {};
      const a = pick(md, ["metadata", "contentMetadataViewModel", "metadataRows", 0, "metadataParts", 0, "text", "content"]) || "";
      const len = (JSON.stringify(l.contentImage || {}).match(/"text":"(\d{1,2}(?::\d{2}){1,2})"/) || [])[1] || "";
      out.push({ id: l.contentId, t: pick(md, ["title", "content"]) || "", a, len });
    }
    const r = o.playlistVideoRenderer; // старый формат страницы
    if (r?.videoId) out.push({ id: r.videoId, t: pick(r, ["title", "runs", 0, "text"]) || "", a: pick(r, ["shortBylineText", "runs", 0, "text"]) || "", len: pick(r, ["lengthText", "simpleText"]) || "" });
    for (const v of Object.values(o)) walk(v);
  };
  walk(data);
  const seen = new Set<string>();
  return out.filter(x => !seen.has(x.id) && seen.add(x.id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const list = new URL(req.url).searchParams.get("list") || "";
  if (!/^[\w-]{10,64}$/.test(list)) return json({ error: "list" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "auth" }, 401);

  const page = await fetch(`https://www.youtube.com/playlist?list=${list}&hl=ru`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "ru,en;q=0.8" },
  }).then(r => r.ok ? r.text() : "").catch(() => "");
  const m = page.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return json({ error: "parse", items: [] }, 502);
  let data: unknown; try { data = JSON.parse(m[1]); } catch { return json({ error: "parse", items: [] }, 502); }
  const title = (page.match(/"playlistMetadataRenderer":\{"title":"((?:[^"\\]|\\.)*)"/) || [])[1] || "";
  return json({ title: title ? JSON.parse(`"${title}"`) : "", items: collect(data).slice(0, 200) });
});

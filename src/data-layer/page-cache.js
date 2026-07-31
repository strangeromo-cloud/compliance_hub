// Cache for cited page text.
//
// Most cited sources are regulations, FAQs and guidance that change on the
// order of months. Re-fetching them on every question was wasteful and, worse,
// fragile: a shared retrieval deadline meant one unreachable host could abort
// requests to healthy ones, so a source that answers in 30ms would be reported
// as unavailable because a different host had hung.
//
// With a cache, a source that was read recently is not fetched at all, so the
// deadline rarely applies and a slow host can no longer take others down with
// it. Freshness is stated rather than assumed: served text always carries the
// time it was captured.
//
// The entries are rows keyed by URL. The file version hashed the URL into a
// filename and pruned by listing the directory and stat-ing every entry; here
// the bound is one DELETE.

import { db } from "./db.js";

const MAX_ENTRIES = 300;

export async function readCachedPage(url) {
  const row = db().prepare("SELECT url, text, etag, captured_at FROM page_cache WHERE url = ?").get(String(url));
  if (!row?.text) return null;
  const ageMs = Date.now() - Date.parse(row.captured_at);
  return { url: row.url, text: row.text, etag: row.etag, capturedAt: row.captured_at, ageMs: Number.isFinite(ageMs) ? ageMs : Infinity };
}

export async function writeCachedPage(url, text, etag = null) {
  try {
    const database = db();
    database.prepare(`
      INSERT INTO page_cache (url, text, etag, captured_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (url) DO UPDATE SET text = excluded.text, etag = excluded.etag, captured_at = excluded.captured_at`)
      .run(String(url), String(text), etag == null ? null : String(etag), new Date().toISOString());
    // Bounded so a long-running prototype cannot fill the disk. Oldest first.
    database.prepare("DELETE FROM page_cache WHERE url NOT IN (SELECT url FROM page_cache ORDER BY captured_at DESC LIMIT ?)").run(MAX_ENTRIES);
  } catch { /* the cache is an optimisation; failing to write it is not fatal */ }
}

export function describeAge(ageMs) {
  if (!Number.isFinite(ageMs)) return null;
  const hours = ageMs / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ageMs / 60_000))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

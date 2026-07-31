// What changed, over a window, from the notices themselves.
//
// "汇总最近 6 个月中国出口管制公告的变化" is not a case. There is no
// counterparty, no item and no destination, so running it through a review
// procedure produced a party-screening step for a question that names no party.
//
// It is a different shape of work: read the ingested notices, keep the ones in
// the window, and put them in order. Every line carries its notice number, its
// date and the authority that issued it, because a regulatory summary whose
// items cannot be traced back to a notice is worth nothing to the person who has
// to act on it.
//
// What this does not do is interpret. It reports which measures were published
// and which notices superseded which — both of which the notices state
// themselves — and leaves what that means for a given transaction to a review.

import { readNormalized } from "./data-layer/storage.js";

const NOTICE_SOURCES = [
  { sourceId: "china-dual-use", label: "商务部两用物项管制公告" },
  { sourceId: "china-control-entities", label: "中国出口管制管控名单" },
  { sourceId: "china-unreliable-entity", label: "中国不可靠实体清单" },
  { sourceId: "china-licence-catalogue", label: "中国出口许可证管理目录" }
];

// How far back, taken from the question rather than assumed. "最近 6 个月" and
// "过去两年" are different requests and answering both with a fixed window would
// silently ignore what was asked.
const WINDOWS = [
  { match: /(\d+)\s*个?月|last\s+(\d+)\s+months?/i, unit: 30 },
  { match: /(\d+)\s*年|last\s+(\d+)\s+years?/i, unit: 365 },
  { match: /(\d+)\s*周|(\d+)\s*星期|last\s+(\d+)\s+weeks?/i, unit: 7 }
];

export function windowFor(question, now = Date.now()) {
  for (const { match, unit } of WINDOWS) {
    const found = String(question).match(match);
    if (!found) continue;
    const count = Number(found.slice(1).find(Boolean));
    if (!Number.isFinite(count) || count <= 0) continue;
    const days = count * unit;
    return { days, since: new Date(now - days * 86_400_000).toISOString().slice(0, 10), stated: true };
  }
  // Nothing stated. Six months is the default and is reported as one, so a
  // reader can see the window was chosen rather than asked for.
  return { days: 183, since: new Date(now - 183 * 86_400_000).toISOString().slice(0, 10), stated: false };
}

const dateOf = (record) => record.effectiveFrom || record.publishedAt || null;

export async function buildBriefing(question, now = Date.now()) {
  const window = windowFor(question, now);
  const items = [];
  const searched = [];
  const unavailable = [];

  for (const source of NOTICE_SOURCES) {
    const snapshot = await readNormalized(source.sourceId);
    if (!snapshot?.records?.length) {
      unavailable.push(source);
      continue;
    }
    searched.push({
      ...source,
      recordCount: snapshot.records.length,
      capturedAt: snapshot.capturedAt,
      fallback: Boolean(snapshot.isFallback)
    });

    // One line per notice, not per listed entity: a notice that added forty
    // companies is one change, and forty lines would bury the other notices.
    const byNotice = new Map();
    for (const record of snapshot.records) {
      const date = dateOf(record);
      if (!date || date < window.since) continue;
      const key = record.noticeNumber || record.recordId;
      const entry = byNotice.get(key) || {
        sourceId: source.sourceId,
        sourceLabel: source.label,
        noticeNumber: record.noticeNumber || null,
        title: record.noticeTitle || null,
        date,
        authorities: record.issuingAuthorities || [],
        measureType: record.measureType || null,
        supersedes: record.supersedesNotices || [],
        entities: [],
        controlCodes: [],
        sourceUrl: record.sourceUrl || null,
        fallback: Boolean(snapshot.isFallback)
      };
      if (record.entityName) entry.entities.push(record.entityName);
      for (const code of record.controlCodes || []) entry.controlCodes.push(code);
      if (date < entry.date) entry.date = date;
      byNotice.set(key, entry);
    }
    items.push(...byNotice.values());
  }

  items.sort((left, right) => String(right.date).localeCompare(String(left.date)));
  return { window, items, searched, unavailable };
}

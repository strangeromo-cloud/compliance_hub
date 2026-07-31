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
  { sourceId: "china-dual-use", label: "商务部两用物项管制公告", labelEn: "MOFCOM dual-use control notices", side: "CN" },
  { sourceId: "china-control-entities", label: "中国出口管制管控名单", labelEn: "PRC export control list", side: "CN" },
  { sourceId: "china-unreliable-entity", label: "中国不可靠实体清单", labelEn: "PRC unreliable entity list", side: "CN" },
  { sourceId: "china-licence-catalogue", label: "中国出口许可证管理目录", labelEn: "PRC export licence catalogue", side: "CN" },
  // The US side. Without it, "what changed in the last six months" returned an
  // answer about one jurisdiction — a worse answer than saying so.
  { sourceId: "us-federal-register", label: "美国联邦公报（BIS / OFAC）", labelEn: "US Federal Register (BIS / OFAC)", side: "US" }
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

// What a notice did, taken from its own title.
//
// The titles state the change outright — "将20家日本实体列入出口管制管控名单",
// "暂停对…的出口管制措施" — so classifying them is reading, not inferring. The
// previous version listed the notice numbers and dropped this, which is the part
// a reader actually wants: a list of file names is not a summary of changes.
const ACTIONS = [
  { key: "added", match: /列入|新增|增列/, zh: "列入", en: "added to" },
  { key: "removed", match: /移出|删除|解除|移除/, zh: "移出", en: "removed from" },
  { key: "suspended", match: /暂停|中止/, zh: "暂停", en: "suspended" },
  { key: "repealed", match: /废止|终止/, zh: "废止", en: "repealed" },
  { key: "adjusted", match: /调整|修订|完善|修改/, zh: "调整", en: "adjusted" },
  { key: "licensing", match: /许可|审批|申报/, zh: "许可事项", en: "licensing" }
];

const LISTS = [
  { key: "control", match: /出口管制管控名单/, zh: "出口管制管控名单", en: "export control list" },
  { key: "watch", match: /关注名单/, zh: "关注名单", en: "watch list" },
  { key: "unreliable", match: /不可靠实体清单/, zh: "不可靠实体清单", en: "unreliable entity list" },
  { key: "controlList", match: /管制清单|管制物项|管制编码/, zh: "两用物项管制清单", en: "dual-use control list" }
];

// "20家日本实体" — the count and whose it is, both stated in the title.
const COUNT = /(\d+)\s*家([\u4e00-\u9fff]{2,4})?实体/;

export function classifyNotice(title = "", fallbackCount = 0) {
  const text = String(title);
  const action = ACTIONS.find((item) => item.match.test(text)) || null;
  const list = LISTS.find((item) => item.match.test(text)) || null;
  const counted = text.match(COUNT);
  return {
    action: action?.key || "other",
    actionZh: action?.zh || null,
    actionEn: action?.en || null,
    list: list?.key || null,
    listZh: list?.zh || null,
    listEn: list?.en || null,
    entityCount: counted ? Number(counted[1]) : (fallbackCount || 0),
    subjectCountry: counted?.[2] || null
  };
}

// A Federal Register document states its own type and action line, so the
// classification is read off those rather than pattern-matched out of a title
// the way the PRC notices have to be.
const US_ACTIONS = {
  entity_list_addition: { zh: "列入实体清单", en: "added to the Entity List" },
  entity_list_removal: { zh: "移出实体清单", en: "removed from the Entity List" },
  rule_final: { zh: "最终规则", en: "final rule" },
  rule_interim: { zh: "临时最终规则", en: "interim final rule" },
  rule_proposed: { zh: "规则草案", en: "proposed rule" },
  notice: { zh: "公告", en: "notice" },
  other: { zh: "其他文件", en: "document" }
};

export function classifyUsDocument(item) {
  const kind = US_ACTIONS[item.changeType] || US_ACTIONS.other;
  return {
    action: item.changeType,
    actionZh: kind.zh,
    actionEn: kind.en,
    list: null,
    listZh: item.authorities?.[0] || null,
    listEn: item.authorities?.[0] || null,
    entityCount: 0,
    subjectCountry: null
  };
}

export async function buildBriefing(question, now = Date.now()) {
  const window = windowFor(question, now);
  let items = [];
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
        sourceLabelEn: source.labelEn || source.label,
        side: source.side || "CN",
        changeType: record.changeType || null,
        documentType: record.documentType || null,
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

  // One notice is one change, whichever sources carry it. 商务部公告2026年第27号
  // appears in both the dual-use notices and the control-list notices, and
  // counting it once per source turned "20 Japanese entities" into eighty. The
  // sources it came from are kept, because which registers carry it is itself
  // information.
  const merged = new Map();
  for (const item of items) {
    const key = item.noticeNumber || `${item.sourceId}:${item.date}:${item.title}`;
    const existing = merged.get(key);
    if (!existing) { merged.set(key, { ...item, sourceLabels: [item.sourceLabel] }); continue; }
    if (!existing.sourceLabels.includes(item.sourceLabel)) existing.sourceLabels.push(item.sourceLabel);
    // Keep the fullest record: a title where there was none, the earlier date,
    // and the union of the entities each source listed under it.
    if (!existing.title && item.title) existing.title = item.title;
    if (item.date < existing.date) existing.date = item.date;
    existing.entities = [...new Set([...existing.entities, ...item.entities])];
    existing.controlCodes = [...new Set([...existing.controlCodes, ...item.controlCodes])];
  }
  items = [...merged.values()];
  items.sort((left, right) => String(right.date).localeCompare(String(left.date)));

  const today = new Date(now).toISOString().slice(0, 10);
  for (const item of items) {
    item.change = item.side === "US"
      ? classifyUsDocument(item)
      : classifyNotice(item.title || "", item.entities.length);
    // A rule published in July to take effect in November is a change worth
    // knowing about and has not happened yet. Listing it above what already took
    // effect, with nothing to say so, reads as the most recent event.
    item.pending = Boolean(item.date && item.date > today);
  }

  // What the period amounts to, not just what is in it. A reader asking what
  // changed over six months wants the aggregate first and the notices as the
  // supporting detail.
  const rollup = {
    added: 0, removed: 0, suspended: 0, repealed: 0, adjusted: 0, entities: 0,
    byList: {}, byCountry: {},
    // Both jurisdictions counted separately: one total mixing MOFCOM notices
    // with Federal Register documents answers neither "what did China do" nor
    // "what did the US do".
    bySide: { CN: 0, US: 0 }, usRules: 0, usNotices: 0, pending: 0
  };
  for (const item of items) {
    const change = item.change;
    rollup.bySide[item.side] = (rollup.bySide[item.side] || 0) + 1;
    if (item.pending) rollup.pending += 1;
    if (item.side === "US") {
      if (/^rule_/.test(change.action)) rollup.usRules += 1;
      else rollup.usNotices += 1;
    }
    if (rollup[change.action] !== undefined) rollup[change.action] += 1;
    if (change.action === "added" && change.entityCount) {
      rollup.entities += change.entityCount;
      if (change.listZh) rollup.byList[change.listZh] = (rollup.byList[change.listZh] || 0) + change.entityCount;
      if (change.subjectCountry) rollup.byCountry[change.subjectCountry] = (rollup.byCountry[change.subjectCountry] || 0) + change.entityCount;
    }
  }

  return { window, items, searched, unavailable, rollup };
}

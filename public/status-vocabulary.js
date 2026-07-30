// One vocabulary for every status the product shows.
//
// The workbench and the coverage page previously each carried their own labels,
// which drifted: "archived copy" in the evidence panel and "fallback snapshot"
// on the coverage page were describing overlapping things under different names.
// A compliance tool cannot afford a reader to wonder whether two words mean the
// same state, so the labels live here and both pages read from them.

// How a source's stored data was obtained.
export const SYNC_STATUS = {
  success:                { zh: "已同步",     en: "Synced",           tone: "ok" },
  fallback_snapshot:      { zh: "兜底快照",   en: "Bundled copy",     tone: "warn" },
  syncing:                { zh: "同步中",     en: "Syncing",          tone: "warn" },
  failed:                 { zh: "同步失败",   en: "Sync failed",      tone: "crit" },
  // The snapshot is real and dated; only the attempt to refresh it failed. Told
  // apart from "failed" because the two call for different actions.
  refresh_failed:         { zh: "刷新失败",   en: "Refresh failed",   tone: "warn" },
  configuration_required: { zh: "待配置",     en: "Needs config",     tone: "muted" },
  not_synced:             { zh: "未同步",     en: "Not synced",       tone: "muted" }
};

// How the text behind a citation was obtained for this particular answer.
export const EVIDENCE_STATUS = {
  live:          { zh: "实时获取",   en: "Live",          tone: "ok" },
  cached:        { zh: "缓存",       en: "Cached",        tone: "ok" },
  cached_stale:  { zh: "缓存已过期", en: "Cached, stale", tone: "warn" },
  // Distinct from a source-level bundled copy: the live page failed and the
  // text came from the ingested corpus instead.
  archived:      { zh: "已采集副本", en: "Archived copy", tone: "warn" },
  citation_only: { zh: "仅引用",     en: "Cited only",    tone: "muted" },
  metadata_only: { zh: "元数据",     en: "Metadata",      tone: "muted" },
  not_fetched:   { zh: "未获取",     en: "Not fetched",   tone: "muted" },
  unavailable:   { zh: "获取失败",   en: "Unavailable",   tone: "crit" }
};

// Where an analysis step stands.
export const STEP_STATUS_VOCAB = {
  pending:         { zh: "待执行",       en: "Planned",              tone: "pending", mark: "○" },
  confirmed:       { zh: "已确认",       en: "Settled",              tone: "ok",      mark: "✓" },
  declared:        { zh: "已声明，待核验", en: "Declared, unverified", tone: "declared", mark: "◐" },
  evidence_needed: { zh: "需更多证据",   en: "Evidence needed",      tone: "warn",    mark: "!" },
  // A step with no work in it. Distinct from not_reached, which is work that is
  // still waiting: one is finished business, the other is outstanding.
  not_applicable:  { zh: "不适用",       en: "Not applicable",   tone: "muted", mark: "–" },
  not_reached:     { zh: "待前序步骤",   en: "Awaiting earlier step", tone: "muted",  mark: "·" },
  review_required: { zh: "需人工复核",   en: "Human review",         tone: "crit",    mark: "▲" }
};

export function label(vocabulary, key, locale = "zh") {
  const entry = vocabulary[key];
  return entry ? entry[locale] || entry.zh : key;
}

export function tone(vocabulary, key) {
  return vocabulary[key]?.tone || "muted";
}

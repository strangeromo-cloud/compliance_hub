const copy = {
  zh: {
    brandSub: "合规情报原型", back: "返回对话", title: "公开数据覆盖与接入状态", lead: "查看当前 Prototype 已经读取了什么、下一步可以自动化什么，以及哪些来源必须保留人工查询。",
    checked: "调研核验日期", connected: "真实同步成功", ready: "现在可以开发", limited: "有限制可开发", manual: "仅人工查询", boundary: "数据边界",
    disclosure: "页面会区分 Adapter 已实现与数据真实同步成功。只有成功状态才表示已保存官方原始快照和标准化记录；这不等于完成法律判断或交易放行。",
    search: "搜索来源、机构或覆盖字段", feasibility: "可行性", all: "全部", registry: "数据源注册表", help: "“已读取”表示当前 Prototype 的真实能力，不等于已经建立完整历史数据库。",
    noResults: "没有符合当前筛选条件的数据源。", current: "当前覆盖", target: "目标数据", access: "接入方式", frequency: "更新", webSearch: "Web Search", auth: "需要凭证", captcha: "存在验证码", noData: "尚未保存结构化字段",
    currentLabels: { query_context: "查询时网页上下文", verified_lookup: "已核验结构化查询", structured_snapshot: "完整结构化快照", sample_snapshot: "样本快照 + 实时查询", planned: "尚未接入", manual: "人工查询入口" },
    feasibilityLabels: { can_build_now: "现在可开发", can_build_with_limitations: "有限制可开发", manual_only: "仅人工", not_recommended: "不建议" },
    automationLabels: { api_available: "API 可用", download_available: "文件下载可用", scraping_available: "网页采集可用", manual_only: "仅人工", blocked: "受阻", not_started: "未开始" },
    webLabels: { good_for_discovery: "适合政策发现", supplement_only: "仅作辅助线索", not_for_screening: "不能替代正式查询" },
    syncLabels: { not_synced: "尚未同步", syncing: "同步中", success: "同步成功", failed: "同步失败", configuration_required: "等待配置" },
    adapterReady: "Adapter 已实现", queryReady: "支持实时查询", sync: "立即同步", retry: "重新同步", records: "条记录", lastSync: "最后同步", sourceVersion: "来源版本", syncScope: "同步范围", configKey: "需配置", syncFailed: "同步失败，请查看状态详情。"
  },
  en: {
    brandSub: "Compliance intelligence", back: "Back to chat", title: "Public data coverage & integration status", lead: "See what the prototype actually reads today, what can be automated next, and which sources must remain manual.",
    checked: "Research checked", connected: "Successful syncs", ready: "Build now", limited: "Build with limits", manual: "Manual only", boundary: "Data boundary",
    disclosure: "This page distinguishes an implemented adapter from a successful data sync. Success means an official raw snapshot and normalized records were saved; it is not a legal determination or transaction clearance.",
    search: "Search source, authority, or covered field", feasibility: "Feasibility", all: "All", registry: "Data source registry", help: "Readable today describes actual prototype capability; it does not mean a complete historical database exists.",
    noResults: "No data sources match the current filters.", current: "Current coverage", target: "Target data", access: "Access", frequency: "Update", webSearch: "Web Search", auth: "Credentials required", captcha: "CAPTCHA present", noData: "No structured fields saved yet",
    currentLabels: { query_context: "Query-time page context", verified_lookup: "Verified structured lookup", structured_snapshot: "Full structured snapshot", sample_snapshot: "Sample + live query", planned: "Not connected", manual: "Manual query entry" },
    feasibilityLabels: { can_build_now: "Build now", can_build_with_limitations: "Build with limits", manual_only: "Manual only", not_recommended: "Not recommended" },
    automationLabels: { api_available: "API available", download_available: "Download available", scraping_available: "Web collection available", manual_only: "Manual only", blocked: "Blocked", not_started: "Not started" },
    webLabels: { good_for_discovery: "Good for policy discovery", supplement_only: "Supporting leads only", not_for_screening: "Not a screening substitute" },
    syncLabels: { not_synced: "Not synced", syncing: "Syncing", success: "Synced", failed: "Sync failed", configuration_required: "Configuration required" },
    adapterReady: "Adapter implemented", queryReady: "Live query ready", sync: "Sync now", retry: "Sync again", records: "records", lastSync: "Last sync", sourceVersion: "Source version", syncScope: "Sync scope", configKey: "Configure", syncFailed: "Sync failed. Open the status details for the recorded error."
  }
};

const state = { locale: localStorage.getItem("compliance-locale") || "zh", module: "all", feasibility: "all", query: "", data: null };
const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const t = () => copy[state.locale];

function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem("compliance-theme", theme); }

function applyLocale(locale) {
  state.locale = locale; localStorage.setItem("compliance-locale", locale); document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  const c = t();
  $("brandSub").textContent = c.brandSub; $("backLabel").textContent = c.back; $("coverageTitle").textContent = c.title; $("coverageLead").textContent = c.lead;
  $("checkedLabel").textContent = c.checked; $("connectedLabel").textContent = c.connected; $("readyLabel").textContent = c.ready; $("limitedLabel").textContent = c.limited; $("manualLabel").textContent = c.manual;
  $("disclosureTitle").textContent = c.boundary; $("disclosureText").textContent = c.disclosure; $("sourceSearch").placeholder = c.search; $("feasibilityLabel").textContent = c.feasibility;
  $("registryTitle").textContent = c.registry; $("registryHelp").textContent = c.help; $("registryEmpty").textContent = c.noResults;
  $("feasibilitySelect").options[0].textContent = c.all; $("feasibilitySelect").options[1].textContent = c.feasibilityLabels.can_build_now; $("feasibilitySelect").options[2].textContent = c.feasibilityLabels.can_build_with_limitations; $("feasibilitySelect").options[3].textContent = c.feasibilityLabels.manual_only;
  $("coverageZh").classList.toggle("active", locale === "zh"); $("coverageEn").classList.toggle("active", locale === "en");
  render();
}

function moduleLabel(module) { return module === "tpdd" ? "Ethics & TPDD" : `${module[0].toUpperCase()}${module.slice(1)} Compliance`; }

function renderCard(source) {
  const c = t(); const current = source.dataCaptured.length ? source.dataCaptured : [c.noData]; const sync = source.sync || { status: "not_synced" }; const adapter = source.adapter || {};
  const completedAt = sync.completedAt ? new Intl.DateTimeFormat(state.locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sync.completedAt)) : "—";
  return `<article class="registry-card">
    <div class="registry-card-head"><div><span class="module-tag module-${esc(source.module)}">${esc(moduleLabel(source.module))}</span><h3>${esc(source.sourceName)}</h3><p>${esc(source.authority)} · ${esc(source.country)}</p></div><span class="coverage-state state-${esc(source.currentCoverage)}">${esc(c.currentLabels[source.currentCoverage])}</span></div>
    <div class="registry-badges"><span>${esc(c.automationLabels[source.automationStatus])}</span><span class="feasibility-${esc(source.feasibility)}">${esc(c.feasibilityLabels[source.feasibility])}</span><span>${esc(c.webLabels[source.webSearchUse])}</span>${adapter.implemented ? `<span class="adapter-badge">${c.adapterReady}</span>` : ""}${adapter.queryable ? `<span class="adapter-badge">${c.queryReady}</span>` : ""}${source.authenticationRequired ? `<span>${c.auth}</span>` : ""}${source.captchaPresent ? `<span class="warning-badge">${c.captcha}</span>` : ""}</div>
    <div class="sync-panel sync-${esc(sync.status)}"><div><span class="sync-dot"></span><strong>${esc(c.syncLabels[sync.status] || sync.status)}</strong>${sync.recordCount !== undefined ? `<span>${Number(sync.recordCount).toLocaleString()} ${c.records}</span>` : ""}</div>${adapter.syncable ? `<button class="source-sync-button" type="button" data-sync-source="${esc(source.sourceId)}" ${sync.status === "syncing" ? "disabled" : ""}>${sync.status === "success" || sync.status === "failed" ? c.retry : c.sync}</button>` : ""}</div>
    ${(sync.status === "success" || sync.status === "failed" || sync.status === "configuration_required") ? `<details class="sync-details"><summary>${state.locale === "zh" ? "查看同步状态" : "View sync status"}</summary><div class="registry-details"><dl><div><dt>${c.lastSync}</dt><dd>${esc(completedAt)}</dd></div>${sync.sourceUpdatedAt ? `<div><dt>${c.sourceVersion}</dt><dd>${esc(sync.sourceUpdatedAt)}</dd></div>` : ""}${sync.syncScope ? `<div><dt>${c.syncScope}</dt><dd>${esc(sync.syncScope)}</dd></div>` : ""}${adapter.credential && !adapter.credentialConfigured ? `<div><dt>${c.configKey}</dt><dd>${esc(adapter.credential)}</dd></div>` : ""}</dl>${sync.error ? `<p class="sync-error">${esc(sync.error)}</p>` : ""}</div></details>` : ""}
    <div class="registry-fields"><div><strong>${c.current}</strong><ul>${current.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div><div><strong>${c.target}</strong><ul>${source.targetData.slice(0, 6).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div></div>
    <details><summary>${state.locale === "zh" ? "查看接入说明" : "View integration notes"}</summary><div class="registry-details"><dl><div><dt>${c.access}</dt><dd>${esc(source.accessMethod)} · ${esc(source.fileFormat)}</dd></div><div><dt>${c.frequency}</dt><dd>${esc(source.updateFrequency)}</dd></div><div><dt>${c.webSearch}</dt><dd>${esc(c.webLabels[source.webSearchUse])}</dd></div></dl><p>${esc(source.notes)}</p></div></details>
    <a class="official-source-link" href="${esc(source.websiteUrl)}" target="_blank" rel="noopener noreferrer">${state.locale === "zh" ? "打开官方来源" : "Open official source"}<span aria-hidden="true">↗</span></a>
  </article>`;
}

function render() {
  if (!state.data) return;
  const query = state.query.toLowerCase();
  const visible = state.data.sources.filter((source) => {
    const haystack = [source.sourceName, source.authority, source.country, ...source.dataCaptured, ...source.targetData].join(" ").toLowerCase();
    return (state.module === "all" || source.module === state.module) && (state.feasibility === "all" || source.feasibility === state.feasibility) && (!query || haystack.includes(query));
  });
  $("sourceRegistry").innerHTML = visible.map(renderCard).join(""); $("visibleSourceCount").textContent = visible.length; $("registryEmpty").classList.toggle("hidden", visible.length > 0);
}

async function loadRegistry() {
  try {
    const response = await fetch("/api/data-sources"); if (!response.ok) throw new Error(); state.data = await response.json();
    const counts = state.data.counts; $("checkedAt").textContent = state.data.checkedAt; $("connectedCount").textContent = state.data.syncCounts?.success || 0; $("readyCount").textContent = counts.can_build_now || 0; $("limitedCount").textContent = counts.can_build_with_limitations || 0; $("manualCount").textContent = counts.manual_only || 0;
    render();
  } catch { $("sourceRegistry").innerHTML = `<div class="registry-empty">Unable to load the data source registry.</div>`; }
}

document.querySelector(".coverage-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-module]"); if (!button) return; state.module = button.dataset.module; document.querySelectorAll("[data-module]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", item === button); }); render(); });
$("feasibilitySelect").addEventListener("change", (event) => { state.feasibility = event.target.value; render(); });
$("sourceSearch").addEventListener("input", (event) => { state.query = event.target.value.trim(); render(); });
$("sourceRegistry").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-sync-source]"); if (!button) return;
  const source = state.data.sources.find((item) => item.sourceId === button.dataset.syncSource); if (!source) return;
  source.sync = { ...source.sync, status: "syncing", error: null }; render();
  try {
    const response = await fetch("/api/data-sources/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: source.sourceId }) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || t().syncFailed);
    source.sync = payload.sync;
  } catch (error) { source.sync = { ...source.sync, status: "failed", completedAt: new Date().toISOString(), error: error.message || t().syncFailed }; }
  render(); $("connectedCount").textContent = state.data.sources.filter((item) => item.sync?.status === "success").length;
});
$("coverageZh").addEventListener("click", () => applyLocale("zh")); $("coverageEn").addEventListener("click", () => applyLocale("en"));
$("coverageTheme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
applyLocale(state.locale); loadRegistry();

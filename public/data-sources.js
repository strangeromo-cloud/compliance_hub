const copy = {
  zh: {
    brandSub: "合规情报原型", back: "返回对话", title: "公开数据覆盖与接入状态", lead: "每个来源当前读到了什么、授权允许怎么用、以及哪些来源因为验证码或反爬必须保留人工查询。",
    howto: "这里的 sourceId（如 trade-csl）在工作台有两个用处：在输入框开头打 @ 可以直查它的原始记录；建自建 Gem 时可以把它勾成绑定来源，那个 Gem 的问题就会写明只依据勾选的来源。答案里每条依据旁的 ⛁ 也跳到直查视图。",
    checked: "调研核验日期", connected: "真实同步成功", ready: "现在可以开发", limited: "有限制可开发", manual: "仅人工查询", boundary: "数据边界",
    disclosure: "「已同步」指真实保存了官方原始快照与标准化记录，不等于完成法律判断或交易放行。「刷新失败」指快照仍可用、只是最近一次刷新没成功，与从未采集到的「同步失败」是两回事。标注了授权限制的来源（如 CC-BY-NC 仅限非商用）必须按其条款使用；所有同步数据与历史记录存在单个 SQLite 文件（data/runtime/hub.db）中；容器文件系统是临时的，未挂载 Volume 时重新部署会清空它。厂商分类表（NVIDIA、AMD）是厂商对自家产品的声明，不是分类决定，出口商仍需自行分类。",
    evoTitle: "提问覆盖", evoHelp: "这套部署把用户的问题读得有多准。四项都可以在不动任何条文的前提下改进。",
    evoFallback: "未匹配关键词，三条线全跑", evoAsk: "中途停下追问", evoTurns: "平均轮数", evoOpen: "仍有未闭合步骤",
    evoSteps: "最常停下的步骤", evoFields: "被追问后才补上的字段",
    search: "搜索来源、机构或覆盖字段", feasibility: "可行性", all: "全部", registry: "数据源注册表", help: "“已读取”表示当前 Prototype 的真实能力，不等于已经建立完整历史数据库。",
    noResults: "没有符合当前筛选条件的数据源。", current: "当前覆盖", target: "目标数据", access: "接入方式", frequency: "更新", webSearch: "Web Search", auth: "需要凭证", captcha: "存在验证码", noData: "尚未保存结构化字段",
    currentLabels: { query_context: "查询时网页上下文", verified_lookup: "已核验结构化查询", structured_snapshot: "完整结构化快照", sample_snapshot: "样本快照 + 实时查询", planned: "尚未接入", manual: "人工查询入口" },
    feasibilityLabels: { can_build_now: "现在可开发", can_build_with_limitations: "有限制可开发", manual_only: "仅人工", not_recommended: "不建议" },
    automationLabels: { api_available: "API 可用", download_available: "文件下载可用", scraping_available: "网页采集可用", manual_only: "仅人工", blocked: "受阻", not_started: "未开始" },
    webLabels: { good_for_discovery: "适合政策发现", supplement_only: "仅作辅助线索", not_for_screening: "不能替代正式查询" },
    syncLabels: { not_synced: "尚未同步", syncing: "同步中", success: "同步成功", failed: "同步失败", refresh_failed: "快照可用，刷新失败", fallback_snapshot: "兜底快照", configuration_required: "等待配置" },
    coveredByLabel: "内容已被其他来源覆盖：", usedInLabel: "用于步骤：", apiOn: "官方检索接口已启用：", apiOff: "可选的官方检索接口（未配置）：", notUsedLabel: "当前没有分析步骤读取该来源；可在数据源直查中检索", adapterReady: "Adapter 已实现", queryReady: "支持实时查询", sync: "立即同步", retry: "重新同步", records: "条记录", lastSync: "最后同步", sourceVersion: "来源版本", syncScope: "同步范围", configKey: "需配置", syncFailed: "同步失败，请查看状态详情。", syncNeedsCode: "需要访问口令：请回到首页「访问设置」填写口令后重试。"
  },
  en: {
    brandSub: "Compliance intelligence", back: "Back to chat", title: "Public data coverage & integration status", lead: "What each source currently reads, what its licence permits, and which sources stay manual because of a CAPTCHA or an anti-bot wall.",
    howto: "A sourceId here (trade-csl, say) is used in two places in the workbench: type @ at the start of the composer to query its own records, and tick it when building a gem so that gem's questions say to rely on the ticked sources only. The \u26C1 beside a step's basis in an answer opens the same query view.",
    checked: "Research checked", connected: "Successful syncs", ready: "Build now", limited: "Build with limits", manual: "Manual only", boundary: "Data boundary",
    disclosure: "Synced means an official raw snapshot and normalized records were saved; it is not a legal determination or transaction clearance. Refresh failed means the snapshot is still usable and only the latest refresh did not land — different from Sync failed, which means the source was never captured. Sources marked with a licence limit (CC-BY-NC is non-commercial only) must be used on those terms. Synced data and case history live in one SQLite file (data/runtime/hub.db); the container filesystem is ephemeral, so without a mounted volume a redeploy clears it. A vendor classification table is the manufacturer\u2019s statement about its own product, not a classification decision \u2014 the exporter remains responsible for its own.",
    evoTitle: "Question coverage", evoHelp: "How well this deployment reads the questions it is given. Every figure here can be improved without touching a provision.",
    evoFallback: "No term matched, so all three lanes ran", evoAsk: "Stopped to ask mid-run", evoTurns: "Rounds per thread", evoOpen: "Still holding an open step",
    evoSteps: "Steps that most often stop the run", evoFields: "Fields supplied only after being asked for",
    search: "Search source, authority, or covered field", feasibility: "Feasibility", all: "All", registry: "Data source registry", help: "Readable today describes actual prototype capability; it does not mean a complete historical database exists.",
    noResults: "No data sources match the current filters.", current: "Current coverage", target: "Target data", access: "Access", frequency: "Update", webSearch: "Web Search", auth: "Credentials required", captcha: "CAPTCHA present", noData: "No structured fields saved yet",
    currentLabels: { query_context: "Query-time page context", verified_lookup: "Verified structured lookup", structured_snapshot: "Full structured snapshot", sample_snapshot: "Sample + live query", planned: "Not connected", manual: "Manual query entry" },
    feasibilityLabels: { can_build_now: "Build now", can_build_with_limitations: "Build with limits", manual_only: "Manual only", not_recommended: "Not recommended" },
    automationLabels: { api_available: "API available", download_available: "Download available", scraping_available: "Web collection available", manual_only: "Manual only", blocked: "Blocked", not_started: "Not started" },
    webLabels: { good_for_discovery: "Good for policy discovery", supplement_only: "Supporting leads only", not_for_screening: "Not a screening substitute" },
    syncLabels: { not_synced: "Not synced", syncing: "Syncing", success: "Synced", failed: "Sync failed", refresh_failed: "Snapshot kept, refresh failed", fallback_snapshot: "Bundled copy", configuration_required: "Configuration required" },
    coveredByLabel: "Already held by another source: ", usedInLabel: "Read by: ", apiOn: "Publisher\u2019s search API enabled: ", apiOff: "Optional publisher search API (not configured): ", notUsedLabel: "No analysis step reads this source; it is searchable directly", adapterReady: "Adapter implemented", queryReady: "Live query ready", sync: "Sync now", retry: "Sync again", records: "records", lastSync: "Last sync", sourceVersion: "Source version", syncScope: "Sync scope", configKey: "Configure", syncFailed: "Sync failed. Open the status details for the recorded error.", syncNeedsCode: "Access code required: enter it under Access on the home page, then retry."
  }
};

const state = { locale: localStorage.getItem("compliance-locale") || "zh", module: "all", feasibility: "all", query: "", data: null };

// How long ago a state was recorded.
//
// Sync status survives a redeploy now that a volume holds it, which is what it
// is for — but it means a failure from this morning goes on being displayed as
// though it were happening. Nothing has retried it; that is simply the last
// thing that was tried. The age is the difference between "this is broken" and
// "the last attempt, hours ago, failed", and only the second is true.
function ago(iso, locale) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return locale === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return locale === "zh" ? `${hours} 小时前` : `${hours}h ago`;
  return locale === "zh" ? `${Math.round(hours / 24)} 天前` : `${Math.round(hours / 24)}d ago`;
}
const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const t = () => copy[state.locale];

function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem("compliance-theme", theme); }

function applyLocale(locale) {
  state.locale = locale; localStorage.setItem("compliance-locale", locale); document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  const c = t();
  $("brandSub").textContent = c.brandSub; $("backLabel").textContent = c.back; $("coverageTitle").textContent = c.title; $("coverageLead").textContent = c.lead; $("coverageHowto").textContent = c.howto;
  $("checkedLabel").textContent = c.checked; $("connectedLabel").textContent = c.connected; $("readyLabel").textContent = c.ready; $("limitedLabel").textContent = c.limited; $("manualLabel").textContent = c.manual;
  $("disclosureTitle").textContent = c.boundary; $("disclosureText").textContent = c.disclosure; $("sourceSearch").placeholder = c.search; $("feasibilityLabel").textContent = c.feasibility;
  $("registryTitle").textContent = c.registry; $("registryHelp").textContent = c.help; $("registryEmpty").textContent = c.noResults;
  $("feasibilitySelect").options[0].textContent = c.all; $("feasibilitySelect").options[1].textContent = c.feasibilityLabels.can_build_now; $("feasibilitySelect").options[2].textContent = c.feasibilityLabels.can_build_with_limitations; $("feasibilitySelect").options[3].textContent = c.feasibilityLabels.manual_only;
  $("evoTitle").textContent = c.evoTitle; $("evoHelp").textContent = c.evoHelp;
  $("evoFallbackLabel").textContent = c.evoFallback; $("evoAskLabel").textContent = c.evoAsk;
  $("evoTurnsLabel").textContent = c.evoTurns; $("evoOpenLabel").textContent = c.evoOpen;
  $("evoStepsTitle").textContent = c.evoSteps; $("evoFieldsTitle").textContent = c.evoFields;
  $("coverageZh").classList.toggle("active", locale === "zh"); $("coverageEn").classList.toggle("active", locale === "en");
  render();
}

function moduleLabel(module) { return module === "tpdd" ? "Ethics & TPDD" : `${module[0].toUpperCase()}${module.slice(1)} Compliance`; }

function renderCard(source) {
  const c = t(); const current = source.dataCaptured.length ? source.dataCaptured : [c.noData]; const sync = source.sync || { status: "not_synced" }; const adapter = source.adapter || {};
  // Shown for every recorded state, not only failures: a snapshot from last week
  // and one from ten minutes ago are different things too.
  const lastAttempt = ago(sync.completedAt || sync.refreshFailedAt || sync.startedAt, state.locale);
  const completedAt = sync.completedAt ? new Intl.DateTimeFormat(state.locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sync.completedAt)) : "—";
  return `<article class="registry-card">
    <div class="registry-card-head"><div><span class="module-tag module-${esc(source.module)}">${esc(moduleLabel(source.module))}</span><h3>${esc(source.sourceName)}</h3><p>${esc(source.authority)} · ${esc(source.country)}</p></div><span class="coverage-state state-${esc(source.currentCoverage)}">${esc(c.currentLabels[source.currentCoverage])}</span></div>
    <div class="registry-badges"><span>${esc(c.automationLabels[source.automationStatus])}</span><span class="feasibility-${esc(source.feasibility)}">${esc(c.feasibilityLabels[source.feasibility])}</span><span>${esc(c.webLabels[source.webSearchUse])}</span>${adapter.implemented ? `<span class="adapter-badge">${c.adapterReady}</span>` : ""}${adapter.queryable ? `<span class="adapter-badge">${c.queryReady}</span>` : ""}${source.authenticationRequired ? `<span>${c.auth}</span>` : ""}${source.captchaPresent ? `<span class="warning-badge">${c.captcha}</span>` : ""}</div>
    <div class="sync-panel sync-${esc(sync.status)}"><div><span class="sync-dot"></span><strong>${esc(c.syncLabels[sync.status] || sync.status)}</strong>${sync.recordCount !== undefined ? `<span>${Number(sync.recordCount).toLocaleString()} ${c.records}</span>` : ""}${lastAttempt ? `<span class="sync-age">${esc(lastAttempt)}</span>` : ""}</div>${adapter.syncable ? `<button class="source-sync-button" type="button" data-sync-source="${esc(source.sourceId)}" ${sync.status === "syncing" ? "disabled" : ""}>${["success", "failed", "refresh_failed"].includes(sync.status) ? c.retry : c.sync}</button>` : ""}</div>
    ${source.purpose ? `<p class="source-purpose">${esc(state.locale === "zh" ? source.purpose.zh : source.purpose.en)}</p>
      ${source.purpose.usedIn?.length
        ? `<p class="source-usedin"><b>${esc(c.usedInLabel)}</b>${source.purpose.usedIn.map((step) => `<code>${esc(step)}</code>`).join("")}</p>`
        : `<p class="source-usedin unused">${esc(c.notUsedLabel)}</p>`}` : ""}
    ${source.purpose?.optionalApi ? `<p class="source-optional ${source.purpose.optionalApi.configured ? "on" : ""}">
      <b>${esc(source.purpose.optionalApi.configured ? c.apiOn : c.apiOff)}</b>${esc(state.locale === "zh" ? source.purpose.optionalApi.zh : source.purpose.optionalApi.en)}</p>` : ""}
    ${source.coveredBy ? `<p class="source-covered"><b>${esc(c.coveredByLabel)}</b>${esc(source.coveredBy.note)}</p>` : ""}
    ${source.attribution ? `<p class="source-attribution">${esc(source.attribution)}</p>` : ""}
    ${["success", "failed", "refresh_failed", "configuration_required"].includes(sync.status) ? `<details class="sync-details"><summary>${state.locale === "zh" ? "查看同步状态" : "View sync status"}</summary><div class="registry-details"><dl><div><dt>${c.lastSync}</dt><dd>${esc(completedAt)}</dd></div>${sync.sourceUpdatedAt ? `<div><dt>${c.sourceVersion}</dt><dd>${esc(sync.sourceUpdatedAt)}</dd></div>` : ""}${sync.syncScope ? `<div><dt>${c.syncScope}</dt><dd>${esc(sync.syncScope)}</dd></div>` : ""}${adapter.credential && !adapter.credentialConfigured ? `<div><dt>${c.configKey}</dt><dd>${esc(adapter.credential)}</dd></div>` : ""}</dl>${sync.error ? `<p class="sync-error">${esc(sync.error)}</p>` : ""}</div></details>` : ""}
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

// How well this deployment is reading the questions it is given.
//
// Hidden until there is something to show: a panel of dashes is worse than no
// panel, and a fresh deployment has no cases yet. Every figure here can be
// improved without touching a provision — which is exactly why they are the
// ones worth watching.
function renderEvolution(data) {
  const panel = $("evolutionPanel");
  if (!data || !data.total) { panel.hidden = true; return; }
  panel.hidden = false;
  const pct = (value) => (value === null ? "—" : `${Math.round(value * 100)}%`);
  $("evoTotal").textContent = data.total;
  $("evoFallback").textContent = pct(data.fallbackRate);
  $("evoAsk").textContent = pct(data.askRate);
  $("evoTurns").textContent = data.averageTurns === null ? "—" : data.averageTurns.toFixed(1);
  $("evoOpen").textContent = data.unanswered;
  const list = (rows) => rows.length
    ? rows.map((row) => `<li><span>${esc(row.name)}</span><b>${row.count}</b></li>`).join("")
    : `<li class="evo-none"><span>—</span></li>`;
  $("evoSteps").innerHTML = list(data.askedSteps || []);
  $("evoFields").innerHTML = list(data.lateFields || []);
}

async function loadRegistry() {
  try {
    const response = await fetch("/api/data-sources"); if (!response.ok) throw new Error(); state.data = await response.json();
    const counts = state.data.counts; $("checkedAt").textContent = state.data.checkedAt; $("connectedCount").textContent = (state.data.syncCounts?.success || 0) + (state.data.syncCounts?.refresh_failed || 0); $("readyCount").textContent = counts.can_build_now || 0; $("limitedCount").textContent = counts.can_build_with_limitations || 0; $("manualCount").textContent = counts.manual_only || 0;
    render();
  } catch { $("sourceRegistry").innerHTML = `<div class="registry-empty">Unable to load the data source registry.</div>`; }
}

async function loadEvolution() {
  try {
    const response = await fetch("/api/evolution?days=90");
    if (response.ok) renderEvolution(await response.json());
  } catch { /* the panel simply stays hidden */ }
}

document.querySelector(".coverage-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-module]"); if (!button) return; state.module = button.dataset.module; document.querySelectorAll("[data-module]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", item === button); }); render(); });
$("feasibilitySelect").addEventListener("change", (event) => { state.feasibility = event.target.value; render(); });
$("sourceSearch").addEventListener("input", (event) => { state.query = event.target.value.trim(); render(); });
$("sourceRegistry").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-sync-source]"); if (!button) return;
  const source = state.data.sources.find((item) => item.sourceId === button.dataset.syncSource); if (!source) return;
  source.sync = { ...source.sync, status: "syncing", error: null }; render();
  try {
    // Sync is one of the gated endpoints, so this page has to send the access
    // code too — without it every button on a code-protected deployment fails
    // with a 401 that reads like the official source was unreachable.
    const code = localStorage.getItem("compliance-access-password") || "";
    const response = await fetch("/api/data-sources/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(code ? { "x-access-password": code } : {}) },
      body: JSON.stringify({ sourceId: source.sourceId })
    });
    const payload = await response.json();
    if (response.status === 401) throw new Error(t().syncNeedsCode);
    if (!response.ok) throw new Error(payload.error || t().syncFailed);
    source.sync = payload.sync;
  } catch (error) { source.sync = { ...source.sync, status: "failed", completedAt: new Date().toISOString(), error: error.message || t().syncFailed }; }
  render(); $("connectedCount").textContent = state.data.sources.filter((item) => ["success", "refresh_failed"].includes(item.sync?.status)).length;
});
$("coverageZh").addEventListener("click", () => applyLocale("zh")); $("coverageEn").addEventListener("click", () => applyLocale("en"));
$("coverageTheme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
applyLocale(state.locale); loadRegistry(); loadEvolution();

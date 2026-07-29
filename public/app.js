import { GEMS, GEM_BY_ID, GEM_GROUPS, factCoverage, matchGems, toggleWorkspaceGem, workspaceGemIds } from "/gems.js";

const i18n = {
  zh: {
    prototype: "Prototype", skipLink: "跳到工作区", workbench: "出口管制工作台", newChat: "新对话",
    scenarioLibrary: "测试场景", scenarioHelp: "场景只填入输入框，不会新建对话。",
    startTitle: "描述交易，或用 / 选择一个 Gem",
    startLead: "范围为美国与中国的出口管制。Master Agent 自动路由到贸易、产品和第三方尽调 Agent，返回一份带证据链的统一答案。",
    gemsLabel: "GEMS", gemsHint: "在输入框键入 / 可随时调用", coverageLabel: "数据覆盖",
    questionLabel: "输入合规情景", placeholder: "描述交易方、产品、路线、最终用户或付款安排……",
    slashHint: "Gem", composerNote: "原型输出仅用于研究与风险分流，不构成法律意见。请勿输入商业秘密或未公开交易数据。",
    evidence: "证据与来源", evidenceEmpty: "完成一次分析后，这里显示引用来源、获取状态与访问时间。",
    modelSettings: "模型配置", settingsIntro: "支持 OpenAI-compatible Chat Completions API。", show: "显示", hide: "隐藏",
    keyNote: "API Key 仅保存在当前浏览器会话中，用于转发本次调用；不会写入服务器文件或日志。",
    testConnection: "测试连接", saveSession: "保存", analyzing: "正在检索官方来源并组织答案……",
    dataLoading: "数据状态载入中", dataSynced: "个来源已同步", dataFallback: "个用兜底快照", dataFailed: "个失败", dataNone: "暂无可用来源",
    sourcesSynced: "已同步来源", listRecords: "名单记录", cnSources: "中国来源", fallbackSources: "兜底快照", failedSources: "同步失败",
    fallbackTitle: "本机未同步，使用随仓库提交的时点快照，采集于",
    gemSourcesUnit: "个来源", gemRecordsUnit: "条记录", gemUnsynced: "个未同步", gemNoData: "无绑定来源", gemNoCoverage: "数据状态未知",
    factsShort: "必填", railCollapse: "收起侧边栏", railExpand: "展开侧边栏",
    step_routed: "选择 Agent", step_sources: "检索官方来源", step_grounding: "名单筛查与结构化事实", step_agents: "专业 Agent 分析", step_synthesizing: "综合结论",
    groundingNote: "已筛查 {screened} 个名单来源 · {matches} 条潜在命中 · {internal} 条内部主数据关联",
    filterAll: "全部", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "跨域",
    runtimeRules: "规则模式", runtimeReady: "实时模型", runtimeMissing: "未配置模型",
    modeHint: "点击切换规则模式与实时模型",
    routeLabel: "路由", routedTo: "已路由至", specialistTrace: "专业 Agent 分析轨迹",
    overallAssessment: "总体判断", nextStep: "建议下一步", missingInfo: "仍需信息", actions: "建议行动", noItems: "暂无",
    sourceLive: "实时获取", sourceMetadata: "元数据", sourceUnavailable: "获取失败", sourceNotFetched: "未获取", sourceArchived: "已采集副本", sourceCitationOnly: "仅引用",
    mockLabel: "规则 + 公开数据", liveLabel: "实时模型 + 公开数据",
    riskLow: "低", riskMedium: "中", riskHigh: "高", riskUnknown: "待定",
    accessPassword: "访问口令", accessRequired: "该部署需要访问口令，请在模型配置中填写。", keyFromServer: "服务器已配置模型，无需在此填写 API Key。", badResponse: "服务端未返回有效结果，通常是网关超时；请重试或缩短问题。", needKey: "请先在模型配置中填写 API Key，或使用规则模式。", invalidQuestion: "请先描述一个具体情景。", error: "分析失败",
    saved: "已保存到当前会话", testing: "正在测试连接……", connected: "连接成功。", connectionFailed: "连接失败，请检查配置。",
    gemInstruction: "指令", gemSources: "绑定数据源", gemFacts: "必填事实", gemOutput: "输出结构",
    gemAdd: "添加到工作区", gemRemove: "从工作区移除", gemUse: "使用此 Gem", gemAdded: "已添加到工作区", gemRemoved: "已从工作区移除",
    gemDetail: "详情", gemNoSources: "不绑定外部来源，基于当前对话生成", factsLabel: "必填事实",
    factsMet: "已提供", boundLabel: "绑定来源",
    paletteEmpty: "没有匹配的 Gem", paletteNav: "↑↓ 选择", paletteEnter: "Enter 使用", paletteEsc: "Esc 关闭",
    model_auth_error: "认证失败（401）：API Key 无效或不属于该服务。", model_permission_error: "权限被拒绝（403）。", model_endpoint_or_name_not_found: "接口或模型不存在（404）：检查 Base URL 是否含 /v1。", model_quota_or_rate_limit: "被限流或额度不足（429）。", model_invalid_request: "接口拒绝了请求（400/422）。", model_invalid_response: "响应不是兼容的 Chat Completions JSON。", model_timeout: "连接超时。", model_network_error: "无法连接模型接口。", model_provider_error: "模型服务异常。", model_unknown_error: "连接失败。"
  },
  en: {
    prototype: "Prototype", skipLink: "Skip to workspace", workbench: "Export control workbench", newChat: "New",
    scenarioLibrary: "Test scenarios", scenarioHelp: "Scenarios only fill the composer; they do not start a new thread.",
    startTitle: "Describe the transaction, or press / for a gem",
    startLead: "Scope is US and PRC export control. The Master Agent routes to the trade, product and third-party diligence agents and returns one answer with its evidence chain.",
    gemsLabel: "GEMS", gemsHint: "type / in the composer at any time", coverageLabel: "Data coverage",
    questionLabel: "Enter a compliance scenario", placeholder: "Describe the party, product, route, end user or payment arrangement…",
    slashHint: "Gem", composerNote: "Prototype output is for research and triage only and is not legal advice. Do not enter trade secrets or confidential transaction data.",
    evidence: "Evidence & sources", evidenceEmpty: "After an analysis, cited sources, retrieval status and access time appear here.",
    modelSettings: "Model settings", settingsIntro: "Supports OpenAI-compatible Chat Completions APIs.", show: "Show", hide: "Hide",
    keyNote: "The API key stays in this browser session and is used only to forward this call. It is never written to server files or logs.",
    testConnection: "Test connection", saveSession: "Save", analyzing: "Retrieving official sources and composing the answer…",
    dataLoading: "Loading data status", dataSynced: "synced", dataFallback: "on bundled copy", dataFailed: "failed", dataNone: "No sources available",
    sourcesSynced: "Sources synced", listRecords: "List records", cnSources: "PRC sources", fallbackSources: "Bundled copies", failedSources: "Sync failures",
    fallbackTitle: "Not synced on this host; using the bundled point-in-time copy captured",
    gemSourcesUnit: "sources", gemRecordsUnit: "records", gemUnsynced: "not synced", gemNoData: "no bound sources", gemNoCoverage: "coverage unknown",
    factsShort: "Facts", railCollapse: "Collapse sidebar", railExpand: "Expand sidebar",
    step_routed: "Select agents", step_sources: "Retrieve official sources", step_grounding: "Screening and structured facts", step_agents: "Specialist analysis", step_synthesizing: "Synthesis",
    groundingNote: "{screened} list sources screened · {matches} potential matches · {internal} internal records touched",
    filterAll: "All", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "Cross-domain",
    runtimeRules: "Rules mode", runtimeReady: "Live model", runtimeMissing: "No model configured",
    modeHint: "Toggle between rules mode and the live model",
    routeLabel: "Route", routedTo: "Routed to", specialistTrace: "Specialist agent trace",
    overallAssessment: "Overall assessment", nextStep: "Next step", missingInfo: "Missing information", actions: "Recommended actions", noItems: "None",
    sourceLive: "Live", sourceMetadata: "Metadata", sourceUnavailable: "Unavailable", sourceNotFetched: "Not fetched", sourceArchived: "Archived copy", sourceCitationOnly: "Cited only",
    mockLabel: "Rules + public data", liveLabel: "Live model + public data",
    riskLow: "Low", riskMedium: "Medium", riskHigh: "High", riskUnknown: "Unknown",
    accessPassword: "Access password", accessRequired: "This deployment requires an access password. Add it in Model settings.", keyFromServer: "The server already provides a model; no API key is needed here.", badResponse: "The server did not return a valid result, usually a gateway timeout. Retry or shorten the question.", needKey: "Add an API key in Model settings, or stay in rules mode.", invalidQuestion: "Describe a specific scenario first.", error: "Analysis failed",
    saved: "Saved for this session", testing: "Testing…", connected: "Connected.", connectionFailed: "Connection failed. Check the settings.",
    gemInstruction: "Instruction", gemSources: "Bound sources", gemFacts: "Required facts", gemOutput: "Output",
    gemAdd: "Add to workspace", gemRemove: "Remove from workspace", gemUse: "Use this gem", gemAdded: "Added to workspace", gemRemoved: "Removed from workspace",
    gemDetail: "Details", gemNoSources: "No external sources; works from the current thread", factsLabel: "Required facts",
    factsMet: "provided", boundLabel: "Bound sources",
    paletteEmpty: "No matching gem", paletteNav: "↑↓ navigate", paletteEnter: "Enter to use", paletteEsc: "Esc to close",
    model_auth_error: "Authentication failed (401): the API key is invalid or belongs to another service.", model_permission_error: "Permission denied (403).", model_endpoint_or_name_not_found: "Endpoint or model not found (404): check that the Base URL includes /v1.", model_quota_or_rate_limit: "Rate limited or out of quota (429).", model_invalid_request: "The endpoint rejected the request (400/422).", model_invalid_response: "The response was not compatible Chat Completions JSON.", model_timeout: "The request timed out.", model_network_error: "The model endpoint could not be reached.", model_provider_error: "The provider returned an error.", model_unknown_error: "Connection failed."
  }
};

const scenarios = {
  zh: [
    { id: "T01", category: "trade", title: "受限方品牌名与具体签约实体", meta: "实体识别 · 限制范围", question: "我们计划与华为体系内一家公司签订远程技术支持合同。请说明如何确认具体签约实体、该实体可能适用的清单限制，以及纯服务、软件更新和技术访问应分别核查什么。" },
    { id: "T02", category: "trade", title: "非名单客户的受限所有权风险", meta: "OFAC 50% Rule · UBO", question: "客户 Meridian Data Systems Pte. Ltd. 本身没有出现在制裁名单上，但两家受制裁公司分别持有其 30% 和 25% 股权。我们能否交易？还需要取得哪些 UBO 及所有权资料？" },
    { id: "T03", category: "trade", title: "同名名单命中的误报处理", meta: "身份要素比对", question: "客户 Aveox Technologies (Shenzhen) Co., Ltd.，注册号 91440300778812XKA，中国深圳，直销客户。系统提示与管控名单中的名称相似，请判断是真实命中还是误报，并说明保留哪些证据。" },
    { id: "P01", category: "product", title: "AI 系统经加拿大出口至墨西哥", meta: "分类 · 路线 · 许可证", question: "ECCN 4A090.a 的 AI 训练系统从美国出口，经加拿大中转到墨西哥经销商，是否需要许可证？请列出准确判断所需的产品、收货方、最终安装地点和最终用途信息。" },
    { id: "P02", category: "product", title: "加密网络设备出口至印度", meta: "ECCN · 加密 · 例外", question: "NW-4400-VPN 网络安全设备包含 IPsec VPN 和 AES-256 加密，美国原产，拟出口到印度商业银行。应如何确认 ECCN、加密分类、可能的许可例外和申报要求？" },
    { id: "P03", category: "product", title: "中国两用物项出口至欧盟", meta: "中国管制 · 最终用途", question: "PT-7700-GA 镓基射频功放模块从深圳出口至德国电信客户，用于基站维修。需要核查哪些中国两用物项管制编码、公告文号、生效状态和许可要求？" },
    { id: "DM1", category: "product", title: "中国制造含美国内容出口第三国", meta: "EAR 734 · de minimis", question: "TS-6200-DM 在合肥制造，受控美国原产内容占比 28%，出口至印度企业数据中心。是否 subject to the EAR？请先做 Part 734 的 de minimis 和外国直接产品规则分析。" },
    { id: "D01", category: "tpdd", title: "顾问成功费与 BVI 收款账户", meta: "费用 · 付款路径 · UBO", question: "新顾问 Silverline Advisory Ltd.（BVI 注册）要求 15% 成功费并付款到 BVI 账户，未披露 UBO，也没有明确交付物。需要开展哪些尽调？" },
    { id: "D02", category: "tpdd", title: "新经销商缺少经营实质", meta: "红旗 · 经营证据", question: "经销商 Orchard Networks Pte. Ltd. 成立三个月，使用共享办公地址、没有公开员工信息，并拒绝提供 UBO。哪些是风险指标？需要哪些文件才能判断其经营实质？" },
    { id: "D03", category: "tpdd", title: "政府招标中的本地顾问", meta: "PEP · 反腐败", question: "本地顾问 Highfield Public Affairs Pvt. Ltd. 声称能帮助赢得政府招标，要求向个人账户支付月费和成功费。应如何审查 PEP 关系、服务范围、费用合理性和履约证据？" },
    { id: "X01", category: "cross", title: "AI 系统经分销商转供中国最终用户", meta: "转运 · 最终用户 · 经销商", question: "AI-8100-H1 销售给墨西哥经销商 Vantage Trading S.A. de C.V.，但资料显示最终用户为中国的 Clearwater Computing。请同时评估受限方、产品许可、转运规避和经销商尽调风险。" },
    { id: "X02", category: "cross", title: "被拒订单改由货代与第三方付款", meta: "规避模式 · 付款", question: "一个出口订单因最终用户信息不完整被拒后，销售要求改由新加坡货代 Westgate Logistics 收货，并由无关第三方付款。应触发哪些 Trade、Product 和 TPDD 检查？" },
    { id: "X03", category: "cross", title: "新供应商、敏感 BOM 与异常付款", meta: "BOM · 供应商 · 交易", question: "采购拟从新供应商 Copperfield Industrial 购买含美国加密芯片和中国两用物项部件的设备，供应商要求付款到香港关联公司账户。请整合产品分类、交易方筛查和第三方尽调问题。" }
  ],
  en: [
    { id: "T01", category: "trade", title: "Restricted brand vs contracting entity", meta: "Entity identity · Restriction scope", question: "We plan to sign a remote technical-support contract with a company in the Huawei group. Explain how to identify the contracting entity, which list restrictions may apply, and what to check separately for pure services, software updates and technology access." },
    { id: "T02", category: "trade", title: "Blocked ownership of an unlisted customer", meta: "OFAC 50% Rule · UBO", question: "Customer Meridian Data Systems Pte. Ltd. is not itself listed, but two blocked companies own 30% and 25%. Can we transact, and what UBO and ownership evidence is required?" },
    { id: "T03", category: "trade", title: "Resolving a name-match false positive", meta: "Identity elements", question: "Customer Aveox Technologies (Shenzhen) Co., Ltd., registration 91440300778812XKA, Shenzhen China, direct customer. Screening flags a name similar to a control-list entry. Is this a real hit or a false positive, and what evidence should be retained?" },
    { id: "P01", category: "product", title: "AI system via Canada to Mexico", meta: "Classification · Route · Licence", question: "Does exporting an ECCN 4A090.a AI training system from the US via Canada to a Mexican distributor require a licence? List the product, consignee, installation location and end-use facts required." },
    { id: "P02", category: "product", title: "Encrypted network appliance to India", meta: "ECCN · Encryption · Exception", question: "NW-4400-VPN network appliance with IPsec VPN and AES-256, US origin, to be exported to an Indian commercial bank. How should we confirm the ECCN, encryption classification, possible exception and reporting?" },
    { id: "P03", category: "product", title: "PRC dual-use item exported to the EU", meta: "PRC controls · End use", question: "PT-7700-GA gallium RF amplifier module exported from Shenzhen to a German telecom customer for base-station repair. Which PRC control codes, notice numbers, in-force status and licence requirements apply?" },
    { id: "DM1", category: "product", title: "China-made with US content to a third country", meta: "EAR 734 · de minimis", question: "TS-6200-DM is manufactured in Hefei with 28% controlled US-origin content and exported to an enterprise data centre in India. Is it subject to the EAR? Run the Part 734 de minimis and foreign direct product analysis first." },
    { id: "D01", category: "tpdd", title: "Success fee and BVI payment account", meta: "Fee · Payment path · UBO", question: "New consultant Silverline Advisory Ltd. (BVI) requests a 15% success fee to a BVI account, has not disclosed its UBO, and has no defined deliverables. What due diligence is required?" },
    { id: "D02", category: "tpdd", title: "New distributor with little substance", meta: "Red flags · Evidence", question: "Distributor Orchard Networks Pte. Ltd. was formed three months ago, uses a shared-office address, has no public employee information and refuses to provide its UBO. Which indicators matter and what evidence is needed?" },
    { id: "D03", category: "tpdd", title: "Local consultant for a government tender", meta: "PEP · Anti-bribery", question: "Local consultant Highfield Public Affairs Pvt. Ltd. claims it can help win a government tender and asks for a monthly fee plus success fee to a personal account. How should we assess PEP links, scope, fee reasonableness and performance evidence?" },
    { id: "X01", category: "cross", title: "AI system diverted through a distributor", meta: "Diversion · End user", question: "AI-8100-H1 is sold to Mexican distributor Vantage Trading S.A. de C.V., but records show the end user is Clearwater Computing in China. Assess restricted-party, product-licence, diversion and distributor-diligence risk together." },
    { id: "X02", category: "cross", title: "Rejected order rerouted with third-party payment", meta: "Circumvention · Payment", question: "After an export order was rejected for missing end-user information, Sales proposes delivery to Singapore forwarder Westgate Logistics with payment from an unrelated third party. Which Trade, Product and TPDD checks should trigger?" },
    { id: "X03", category: "cross", title: "New supplier, sensitive BOM, unusual payment", meta: "BOM · Vendor · Transaction", question: "Procurement wants to buy equipment containing US encryption chips and PRC dual-use components from new supplier Copperfield Industrial, which asks for payment to a Hong Kong affiliate account. Consolidate classification, screening and diligence questions." }
  ]
};

const state = {
  locale: localStorage.getItem("compliance-locale") || "zh",
  busy: false,
  scenarioCategory: "all",
  conversation: [],
  serverModelConfigured: false,
  accessPasswordRequired: false,
  rulesMode: true,
  coverage: null,
  factsOpen: false,
  rail: localStorage.getItem("compliance-rail") === "1",
  activeGem: null,
  palette: { open: false, items: [], index: 0 }
};

const $ = (id) => document.getElementById(id);
const t = (key) => i18n[state.locale][key] || key;
const localized = (value) => (value && typeof value === "object" ? value[state.locale] || value.zh : value);
const agentName = (agent) => ({ trade: "Trade", product: "Product", tpdd: "Ethics & TPDD" })[agent] || agent;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

function accessHeaders() {
  const password = localStorage.getItem("compliance-access-password") || "";
  return password ? { "x-access-password": password } : {};
}

function getConfig() {
  return {
    baseUrl: localStorage.getItem("compliance-base-url") || "https://api.openai.com/v1",
    model: localStorage.getItem("compliance-model") || "gpt-5.4-mini",
    apiKey: sessionStorage.getItem("compliance-api-key") || ""
  };
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("compliance-theme", theme);
}

/* ------------------------------------------------------------------ gems */

function gemIconMarkup(gem, size = "") {
  return `<span class="gem-icon ${size}" aria-hidden="true">${gem.icon}</span>`;
}

// What a gem is actually standing on. Reporting the gaps as well as the totals
// is the point: a gem bound to five sources of which three never synced should
// say so rather than imply five sources' worth of coverage.
function gemBacking(gem) {
  if (!gem.boundSources.length) return { kind: "none" };
  if (!state.coverage) return { kind: "unknown" };
  const byId = new Map(state.coverage.sources.map((source) => [source.sourceId, source]));
  const known = gem.boundSources.filter((id) => byId.has(id)).map((id) => byId.get(id));
  if (!known.length) return { kind: "none" };
  const usable = known.filter((source) => ["success", "fallback_snapshot"].includes(source.sync?.status));
  return {
    kind: "known",
    total: known.length,
    usable: usable.length,
    missing: known.length - usable.length,
    records: usable.reduce((sum, source) => sum + (source.sync.recordCount || 0), 0),
    capturedAt: usable.map((source) => source.sync.completedAt || source.sync.bundledAt).filter(Boolean).sort().at(-1) || null
  };
}

function gemBackingMarkup(gem) {
  const backing = gemBacking(gem);
  if (backing.kind === "none") return `<div class="gem-meta"><span class="none">${t("gemNoData")}</span></div>`;
  if (backing.kind === "unknown") return `<div class="gem-meta"><span class="none">${t("gemNoCoverage")}</span></div>`;
  const parts = [`${backing.total} ${t("gemSourcesUnit")}`];
  if (backing.records) parts.push(`${backing.records.toLocaleString()} ${t("gemRecordsUnit")}`);
  if (backing.capturedAt) parts.push(String(backing.capturedAt).slice(5, 10));
  const gap = backing.missing ? `<span class="sep">·</span><span class="warn">${backing.missing} ${t("gemUnsynced")}</span>` : "";
  return `<div class="gem-meta">${parts.map(esc).join('<span class="sep">·</span>')}${gap}</div>`;
}

function orderedGems() {
  const pinned = workspaceGemIds();
  return [...GEMS].sort((a, b) => (pinned.includes(b.id) ? 1 : 0) - (pinned.includes(a.id) ? 1 : 0));
}

function renderGemNav() {
  const pinned = workspaceGemIds();
  $("gemNav").innerHTML = orderedGems().map((gem) => `
    <li>
      <button type="button" data-gem="${gem.id}" class="${state.activeGem?.id === gem.id ? "active" : ""}" title="${esc(localized(gem.name))} ${esc(gem.command)}">
        ${gemIconMarkup(gem)}
        <span class="gem-name">${esc(localized(gem.name))}${pinned.includes(gem.id) ? ' <span class="pin">●</span>' : ""}</span>
      </button>
    </li>`).join("");
}

function renderGemGrid() {
  $("gemGrid").innerHTML = orderedGems().slice(0, 6).map((gem) => `
    <button type="button" class="gem-card" data-gem="${gem.id}">
      ${gemIconMarkup(gem, "lg")}
      <span>
        <span class="gem-card-title"><strong>${esc(localized(gem.name))}</strong><code>${esc(gem.command)}</code></span>
        <small>${esc(localized(gem.summary))}</small>
        ${gemBackingMarkup(gem)}
      </span>
    </button>`).join("");
}

// The gem row lives inside the composer box, so the required facts collapse to
// a counter by default and the input never changes height when a gem changes.
function renderActiveGem() {
  const host = $("gemRow");
  if (!state.activeGem) { host.classList.add("hidden"); host.innerHTML = ""; renderGemNav(); return; }
  const gem = state.activeGem;
  const facts = factCoverage(gem, $("questionInput").value);
  const met = facts.filter((fact) => fact.met).length;
  host.classList.remove("hidden");
  host.innerHTML = `
    ${gemIconMarkup(gem)}
    <span class="gem-row-name">${esc(localized(gem.name))}</span>
    <code>${esc(gem.command)}</code>
    <button type="button" class="facts-toggle ${met === facts.length ? "complete" : ""}" data-facts-toggle aria-expanded="${state.factsOpen}">
      ${t("factsShort")} ${met}/${facts.length} ${state.factsOpen ? "⌃" : "⌄"}
    </button>
    <button type="button" class="gem-drop" data-gem-drop aria-label="remove gem">
      <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>
    ${state.factsOpen ? `
      <div class="facts-panel">
        <ul>${facts.map((fact) => `<li class="${fact.met ? "met" : ""}">${esc(localized({ zh: fact.zh, en: fact.en }))}</li>`).join("")}</ul>
        <div class="facts-sources">${gem.boundSources.length ? `${t("boundLabel")}: ${gem.boundSources.map(esc).join(" · ")}` : t("gemNoSources")}</div>
      </div>` : ""}`;
  renderGemNav();
}

function activateGem(gemId, { focus = true } = {}) {
  const gem = GEM_BY_ID.get(gemId);
  if (!gem) return;
  state.activeGem = gem;
  state.factsOpen = false;
  closePalette();
  const input = $("questionInput");
  input.placeholder = localized(gem.placeholder) || t("placeholder");
  renderActiveGem();
  updateRouteHint();
  if (focus) input.focus();
}

function clearGem() {
  state.activeGem = null;
  state.factsOpen = false;
  $("questionInput").placeholder = t("placeholder");
  renderActiveGem();
}

/* ------------------------------------------------------- slash palette */

function paletteQuery() {
  const value = $("questionInput").value;
  // The palette only opens on a slash that starts the draft, so a URL or a date
  // typed mid-sentence never hijacks the composer.
  const match = value.match(/^\/([\w-]*)$/);
  return match ? match[1] : null;
}

function openPalette(query) {
  const items = matchGems(query);
  state.palette = { open: true, items, index: 0 };
  renderPalette();
}

function closePalette() {
  if (!state.palette.open) return;
  state.palette.open = false;
  $("palette").classList.add("hidden");
}

function renderPalette() {
  const host = $("palette");
  const { items, index } = state.palette;
  host.classList.remove("hidden");
  if (!items.length) { host.innerHTML = `<div class="palette-empty">${t("paletteEmpty")}</div>`; return; }
  const groups = Object.keys(GEM_GROUPS).filter((group) => items.some((gem) => gem.group === group));
  host.innerHTML = groups.map((group) => `
    <div class="palette-group">
      <div class="palette-group-label">${esc(localized(GEM_GROUPS[group]))}</div>
      ${items.filter((gem) => gem.group === group).map((gem) => `
        <button type="button" class="palette-item ${items.indexOf(gem) === index ? "active" : ""}" data-gem="${gem.id}" role="option">
          ${gemIconMarkup(gem)}
          <span><strong>${esc(localized(gem.name))}</strong><small>${esc(localized(gem.summary))}</small></span>
          <code>${esc(gem.command)}</code>
        </button>`).join("")}
    </div>`).join("")
    + `<div class="palette-foot"><span>${t("paletteNav")}</span><span>${t("paletteEnter")}</span><span>${t("paletteEsc")}</span></div>`;
  host.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
}

function movePalette(step) {
  const { items } = state.palette;
  if (!items.length) return;
  state.palette.index = (state.palette.index + step + items.length) % items.length;
  renderPalette();
}

function choosePalette() {
  const gem = state.palette.items[state.palette.index];
  if (!gem) return;
  $("questionInput").value = "";
  activateGem(gem.id);
}

/* -------------------------------------------------------- gem detail */

function openGemDetail(gemId) {
  const gem = GEM_BY_ID.get(gemId);
  if (!gem) return;
  const pinned = workspaceGemIds().includes(gem.id);
  $("gemDialogBody").innerHTML = `
    <div class="card-head">
      <div class="gem-detail-head">
        ${gemIconMarkup(gem)}
        <div>
          <h2>${esc(localized(gem.name))} <code>${esc(gem.command)}</code></h2>
          <p>${esc(localized(gem.summary))}</p>
        </div>
      </div>
      <button class="icon-btn" data-close-gem type="button" aria-label="Close">
        <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <dl class="gem-spec">
      <div class="gem-spec-row"><dt>${t("gemInstruction")}</dt><dd>${esc(localized(gem.instruction))}</dd></div>
      <div class="gem-spec-row"><dt>${t("gemSources")}</dt><dd>${gem.boundSources.length
        ? `<div class="chip-row">${gem.boundSources.map((id) => `<span class="chip mono">${esc(id)}</span>`).join("")}</div>`
        : esc(t("gemNoSources"))}</dd></div>
      <div class="gem-spec-row"><dt>${t("gemFacts")}</dt><dd><div class="chip-row">${gem.requiredFacts.map((fact) => `<span class="chip">${esc(localized({ zh: fact.zh, en: fact.en }))}</span>`).join("")}</div></dd></div>
      <div class="gem-spec-row"><dt>${t("gemOutput")}</dt><dd>${esc(localized(gem.outputTemplate))}</dd></div>
    </dl>
    <div class="card-actions">
      <button class="btn" data-toggle-workspace="${gem.id}" type="button">${pinned ? t("gemRemove") : t("gemAdd")}</button>
      <button class="btn btn-primary" data-use-gem="${gem.id}" type="button">${t("gemUse")}</button>
    </div>`;
  $("gemDialog").showModal();
}

/* ----------------------------------------------------------- rendering */

function riskLabel(level) { return t(`risk${level.charAt(0).toUpperCase()}${level.slice(1)}`); }
function renderList(items) { return items?.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>${t("noItems")}</p>`; }

function estimatedRoute(question) {
  const lower = question.toLowerCase();
  const agents = [];
  if (/华为|huawei|名单|entity|sdn|交易方|restricted|sanction|party|ownership|所有权|最终用户|end.user|最终用途|end.use|false positive|screening|管控名单|筛查/.test(lower)) agents.push("trade");
  if (/h100|gpu|cpu|芯片|产品|eccn|加密|encryption|licen|许可|product|出口|export|两用物项|dual.use|bom|镓|gallium|de minimis|734|管辖/.test(lower)) agents.push("product");
  if (/顾问|consultant|成功费|success fee|bvi|付款|payment|第三方|third.party|尽调|due diligence|shell|ubo|经销商|distributor|共享办公|政府招标|货代|freight|关联公司|affiliate/.test(lower)) agents.push("tpdd");
  return agents.length ? [...new Set(agents)] : ["trade", "product", "tpdd"];
}

function updateRouteHint() {
  const value = $("questionInput").value.trim();
  const host = $("routeHint");
  if (!value) { host.innerHTML = ""; return; }
  const agents = estimatedRoute(value);
  host.innerHTML = `<span>${t("routeLabel")}</span>${agents.map((a) => `<span class="route-tag">${agentName(a)}</span>`).join("")}`;
}

function showEvidencePanel(show) {
  $("app").classList.toggle("no-evidence", !show);
}

function renderEvidence(sources) {
  $("sourceCount").textContent = sources.length;
  showEvidencePanel(sources.length > 0);
  if (!sources.length) { $("evidenceList").innerHTML = `<p class="evidence-empty">${t("evidenceEmpty")}</p>`; return; }
  const statusLabel = (source) => ({
    live: t("sourceLive"), metadata_only: t("sourceMetadata"), unavailable: t("sourceUnavailable"),
    not_fetched: t("sourceNotFetched"), archived: t("sourceArchived"), citation_only: t("sourceCitationOnly")
  }[source.liveStatus] || source.liveStatus);
  $("evidenceList").innerHTML = sources.map((source) => `
    <article class="source-card">
      <div class="authority">${esc(source.authority)}</div>
      <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>
      <div class="source-meta">
        <span class="source-status ${esc(source.liveStatus)}">${esc(statusLabel(source))}</span>
        <time>${source.retrievedAt ? new Date(source.retrievedAt).toLocaleTimeString(state.locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</time>
      </div>
    </article>`).join("");
}

function answerMarkup(data) {
  const synthesis = data.synthesis;
  return `
      <span class="avatar" aria-hidden="true">CH</span>
      <div>
        <div class="msg-meta">
          <span class="tag">${esc(data.id)}</span><span class="sep">·</span>
          <span>${data.mode === "live-model" ? t("liveLabel") : t("mockLabel")}</span><span class="sep">·</span>
          <span>${t("routedTo")} ${data.agents.map(agentName).join(", ")}</span>
        </div>
        <section class="answer">
          <div class="answer-head">
            <span class="risk-mark risk-${esc(synthesis.overallRisk)}">${esc(riskLabel(synthesis.overallRisk))}</span>
            <div>
              <h3>${esc(synthesis.headline)}</h3>
              <p>${esc(synthesis.executiveSummary)}</p>
            </div>
          </div>
          <div class="next-step"><b>${t("nextStep")}</b>${esc(synthesis.nextStep)}</div>
        </section>
        <details class="trace">
          <summary>${t("specialistTrace")}</summary>
          <div class="trace-body">${data.results.map((result) => `
            <section class="trace-agent">
              <div class="trace-agent-head">
                <strong>${agentName(result.agent)}</strong>
                <span class="risk-chip risk-${esc(result.riskLevel)}">${esc(riskLabel(result.riskLevel))}</span>
              </div>
              <p>${esc(result.summary)}</p>
              <ul class="trace-findings">${(result.findings || []).map((finding) => `
                <li><b>${esc(finding.title)}</b> ${esc(finding.detail)}<span class="cite">${(finding.evidenceSourceIds || []).map((id) => `<span>${esc(id)}</span>`).join("")}</span></li>`).join("")}</ul>
              <div class="trace-cols">
                <div><h4>${t("missingInfo")}</h4>${renderList(result.missingInfo)}</div>
                <div><h4>${t("actions")}</h4>${renderList(result.recommendedActions)}</div>
              </div>
            </section>`).join("")}</div>
        </details>
        <p class="msg-note">${esc(data.disclaimer)}</p>
      </div>`;
}

const STEP_ORDER = ["routed", "sources", "grounding", "agents", "synthesizing"];

// A live message that fills in as stages report, instead of a spinner that
// hides a thirty-second wait behind a single dot.
function createLiveMessage() {
  const node = document.createElement("article");
  node.className = "msg msg-assistant";
  node.innerHTML = `
    <span class="avatar" aria-hidden="true">CH</span>
    <div>
      <div class="msg-meta" data-live-meta></div>
      <ol class="live-steps" data-live-steps></ol>
      <div class="live-agents" data-live-agents></div>
    </div>`;
  $("threadInner").appendChild(node);
  node.scrollIntoView({ behavior: "smooth", block: "end" });
  return node;
}

function renderSteps(node, done, current) {
  node.querySelector("[data-live-steps]").innerHTML = STEP_ORDER.map((step) => {
    const state = done.has(step) ? "done" : step === current ? "active" : "idle";
    return `<li class="${state}"><span class="tick" aria-hidden="true"></span>${esc(t(`step_${step}`))}</li>`;
  }).join("");
}

function renderResult(data) {
  const node = document.createElement("article");
  node.className = "msg msg-assistant";
  node.id = `answer-${data.id}`;
  node.innerHTML = answerMarkup(data);
  $("threadInner").appendChild(node);
  renderEvidence(data.sources || []);
  node.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------- coverage */

async function loadCoverage() {
  try {
    const response = await fetch("/api/data-sources");
    if (!response.ok) return;
    const data = await response.json();
    state.coverage = data;
    const synced = data.sources.filter((source) => source.sync?.status === "success");
    const fallback = data.sources.filter((source) => source.sync?.status === "fallback_snapshot");
    const failed = data.sources.filter((source) => source.sync?.status === "failed");
    const usable = [...synced, ...fallback];
    const records = usable.reduce((sum, source) => sum + (source.sync.recordCount || 0), 0);
    const cnUsable = usable.filter((source) => source.country === "CN").length;
    const cnTotal = data.sources.filter((source) => source.country === "CN").length;

    // A bundled copy never reads as green. It is a warning state, because the
    // list it holds may already have been superseded.
    const status = $("dataStatus");
    status.className = `side-item ${failed.length || fallback.length ? "warn" : synced.length ? "ok" : "bad"}`;
    $("dataStatusText").innerHTML = usable.length
      ? `<b>${synced.length}</b> ${t("dataSynced")}${fallback.length ? ` · <b>${fallback.length}</b> ${t("dataFallback")}` : ""}${failed.length ? ` · <b>${failed.length}</b> ${t("dataFailed")}` : ""}`
      : t("dataNone");
    status.title = [
      ...fallback.map((source) => `${source.sourceId}: ${t("fallbackTitle")} ${String(source.sync.bundledAt || "").slice(0, 10)}`),
      ...failed.map((source) => `${source.sourceId}: ${source.sync.error || ""}`)
    ].join("\n");

    $("coverageStrip").innerHTML = [
      { value: `${synced.length}/${data.sources.length}`, label: t("sourcesSynced") },
      { value: records.toLocaleString(), label: t("listRecords") },
      { value: `${cnUsable}/${cnTotal}`, label: t("cnSources") },
      { value: String(fallback.length), label: t("fallbackSources"), warn: fallback.length > 0 },
      { value: String(failed.length), label: t("failedSources"), bad: failed.length > 0 }
    ].map((cell) => `<div class="coverage-cell ${cell.bad ? "is-bad" : ""} ${cell.warn ? "is-warn" : ""}"><b>${esc(cell.value)}</b><span>${esc(cell.label)}</span></div>`).join("");

    renderGemGrid();
    renderGemNav();
  } catch { /* Coverage is informational; the workbench stays usable without it. */ }
}

/* ------------------------------------------------------------- analysis */

async function analyze(event) {
  event.preventDefault();
  if (state.busy) return;
  closePalette();
  const raw = $("questionInput").value.trim();
  if (raw.length < 5) return toast(t("invalidQuestion"));
  const gem = state.activeGem;
  const config = getConfig();
  const mock = state.rulesMode;
  if (!mock && !config.apiKey && !state.serverModelConfigured) { toast(t("needKey")); return openSettings(); }

  // The gem contributes its instruction and its bound-source whitelist; the
  // user's text stays verbatim so the transcript shows what was actually asked.
  const question = gem
    ? `${localized(gem.instruction)}\n\n${gem.boundSources.length ? `仅使用以下来源作为依据：${gem.boundSources.join(", ")}。\n\n` : ""}${raw}`
    : raw;

  const priorHistory = state.conversation.slice(-6);
  state.conversation.push({ role: "user", content: question });
  $("startPanel").classList.add("hidden");
  $("threadInner").insertAdjacentHTML("beforeend", `
    <article class="msg msg-user"><div class="bubble">${gem ? `<span class="gem-tag">${esc(gem.command)}</span><br>` : ""}${esc(raw)}</div></article>`);
  $("questionInput").value = "";
  updateRouteHint();
  renderActiveGem();

  state.busy = true;
  $("submitBtn").disabled = true;

  const live = createLiveMessage();
  const done = new Set();
  const collected = { agents: [], sources: [] };
  renderSteps(live, done, "routed");

  const onEvent = (event) => {
    if (event.type === "routed") {
      done.add("routed");
      live.querySelector("[data-live-meta]").innerHTML =
        `<span class="tag">${esc(event.id)}</span><span class="sep">·</span>`
        + `<span>${event.mode === "live-model" ? t("liveLabel") : t("mockLabel")}</span><span class="sep">·</span>`
        + `<span>${t("routedTo")} ${event.agents.map(agentName).join(", ")}</span>`;
      renderSteps(live, done, "sources");
    }
    if (event.type === "sources") {
      done.add("sources");
      collected.sources = event.sources;
      // Evidence appears while the specialists are still thinking.
      renderEvidence(event.sources);
      renderSteps(live, done, "grounding");
    }
    if (event.type === "grounding") {
      done.add("grounding");
      const g = event.grounding;
      const screened = g.screening?.screenedSources?.length || 0;
      live.querySelector("[data-live-steps]").insertAdjacentHTML("afterend",
        `<p class="live-note">${esc(t("groundingNote")
          .replace("{screened}", screened)
          .replace("{matches}", g.listMatchCount)
          .replace("{internal}", g.internalImpactCount))}</p>`);
      renderSteps(live, done, "agents");
    }
    if (event.type === "agent") {
      collected.agents.push(event.result);
      live.querySelector("[data-live-agents]").insertAdjacentHTML("beforeend", `
        <section class="live-agent">
          <div class="trace-agent-head">
            <strong>${agentName(event.result.agent)}</strong>
            <span class="risk-chip risk-${esc(event.result.riskLevel)}">${esc(riskLabel(event.result.riskLevel))}</span>
          </div>
          <p>${esc(event.result.summary)}</p>
        </section>`);
      live.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    if (event.type === "synthesizing") {
      done.add("agents");
      renderSteps(live, done, "synthesizing");
    }
  };

  try {
    const response = await fetch("/api/assess/stream", {
      method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() },
      body: JSON.stringify({ question, locale: state.locale, mock, config, history: priorHistory })
    });
    if (response.status === 401) { toast(t("accessRequired")); openSettings(); throw new Error(t("accessRequired")); }
    if (!response.ok || !response.body) {
      const raw = await response.text();
      let payload = null;
      try { payload = JSON.parse(raw); } catch { /* a gateway error is not JSON */ }
      throw new Error(payload?.error || `${t("badResponse")} (HTTP ${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = null;
    let streamError = null;

    // One JSON object per line; a chunk can split a line, so the remainder is
    // carried over rather than parsed half-formed.
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = streamDone ? "" : lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === "done") finished = event.result;
        else if (event.type === "error") streamError = event;
        else onEvent(event);
      }
      if (streamDone) break;
    }

    if (streamError) throw new Error(streamError.error);
    if (!finished) throw new Error(t("badResponse"));

    state.conversation.push({ role: "assistant", content: `${finished.synthesis.headline}\n${finished.synthesis.executiveSummary}` });
    live.id = `answer-${finished.id}`;
    live.innerHTML = answerMarkup(finished);
    renderEvidence(finished.sources || []);
    live.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    live.innerHTML = `
      <span class="avatar" aria-hidden="true">CH</span>
      <div><section class="answer"><div class="answer-head">
        <span class="risk-mark risk-unknown">!</span>
        <div><h3>${t("error")}</h3><p>${esc(error.message)}</p></div>
      </div></section></div>`;
    toast(`${t("error")}: ${error.message}`);
  } finally {
    state.busy = false;
    $("submitBtn").disabled = false;
  }
}

function newConversation() {
  state.conversation = [];
  $("threadInner").innerHTML = "";
  $("startPanel").classList.remove("hidden");
  $("questionInput").value = "";
  clearGem();
  renderEvidence([]);
  updateRouteHint();
  $("questionInput").focus();
}

/* -------------------------------------------------------------- settings */

function updateModePill() {
  const pill = $("modePill");
  const ready = state.serverModelConfigured || Boolean(sessionStorage.getItem("compliance-api-key"));
  pill.classList.toggle("live", !state.rulesMode && ready);
  pill.title = t("modeHint");
  $("modePillText").textContent = state.rulesMode ? t("runtimeRules") : ready ? t("runtimeReady") : t("runtimeMissing");
}

function openSettings() {
  const config = getConfig();
  $("baseUrlInput").value = config.baseUrl;
  $("modelInput").value = config.model;
  $("apiKeyInput").value = config.apiKey;
  $("accessPasswordInput").value = localStorage.getItem("compliance-access-password") || "";
  $("accessField").hidden = !state.accessPasswordRequired;
  $("connectionStatus").textContent = "";
  $("connectionStatus").className = "status-line";
  $("settingsDialog").showModal();
}

function saveSettings(event) {
  event.preventDefault();
  localStorage.setItem("compliance-base-url", $("baseUrlInput").value.trim());
  localStorage.setItem("compliance-model", $("modelInput").value.trim());
  const password = $("accessPasswordInput").value.trim();
  if (password) localStorage.setItem("compliance-access-password", password);
  else localStorage.removeItem("compliance-access-password");
  const key = $("apiKeyInput").value.trim();
  if (key) { sessionStorage.setItem("compliance-api-key", key); state.rulesMode = false; }
  else sessionStorage.removeItem("compliance-api-key");
  updateModePill();
  $("settingsDialog").close();
  toast(t("saved"));
}

async function testConnection() {
  const status = $("connectionStatus");
  status.className = "status-line";
  status.textContent = t("testing");
  $("testConnectionBtn").disabled = true;
  try {
    const config = { baseUrl: $("baseUrlInput").value.trim(), model: $("modelInput").value.trim(), apiKey: $("apiKeyInput").value.trim() };
    const response = await fetch("/api/test-connection", { method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() }, body: JSON.stringify({ config }) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(i18n[state.locale][data.code] || data.error || t("connectionFailed"));
    status.className = "status-line ok";
    status.textContent = t("connected");
  } catch (error) {
    status.className = "status-line err";
    status.textContent = error.message || t("connectionFailed");
  } finally { $("testConnectionBtn").disabled = false; }
}

async function loadRuntimeCapabilities() {
  try {
    const response = await fetch("/api/runtime-capabilities");
    if (!response.ok) return;
    const capabilities = await response.json();
    state.serverModelConfigured = Boolean(capabilities.liveModelConfigured);
    state.accessPasswordRequired = Boolean(capabilities.accessPasswordRequired);
    if (state.serverModelConfigured) state.rulesMode = false;
    updateModePill();
  } catch { /* Rules mode remains available when capability discovery fails. */ }
}

/* ------------------------------------------------------------ scenarios */

function renderScenarios() {
  const visible = scenarios[state.locale].filter((item) => state.scenarioCategory === "all" || item.category === state.scenarioCategory);
  $("scenarioFilters").innerHTML = ["all", "trade", "product", "tpdd", "cross"].map((category) => `
    <button type="button" class="filter-btn ${state.scenarioCategory === category ? "active" : ""}" data-category="${category}">${t(`filter${category.charAt(0).toUpperCase()}${category.slice(1)}`)}</button>`).join("");
  $("scenarioList").innerHTML = visible.map((item) => `
    <button type="button" class="scenario-btn" data-scenario="${item.id}">
      <span class="gem-icon" aria-hidden="true">${esc(item.id)}</span>
      <span><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></span>
    </button>`).join("");
}

function applyLocale(locale) {
  state.locale = locale;
  localStorage.setItem("compliance-locale", locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $("zhBtn").classList.toggle("active", locale === "zh");
  $("enBtn").classList.toggle("active", locale === "en");
  $("zhBtn").setAttribute("aria-pressed", String(locale === "zh"));
  $("enBtn").setAttribute("aria-pressed", String(locale === "en"));
  if (state.activeGem) $("questionInput").placeholder = localized(state.activeGem.placeholder);
  renderScenarios();
  renderGemGrid();
  renderGemNav();
  renderActiveGem();
  updateModePill();
  loadCoverage();
  if (!$("evidenceList").children.length || $("evidenceList").querySelector(".evidence-empty")) renderEvidence([]);
}

/* --------------------------------------------------------------- events */

$("questionInput").addEventListener("input", () => {
  const query = paletteQuery();
  if (query !== null) openPalette(query); else closePalette();
  updateRouteHint();
  if (state.activeGem) renderActiveGem();
});

$("questionInput").addEventListener("keydown", (event) => {
  if (state.palette.open) {
    if (event.key === "ArrowDown") { event.preventDefault(); return movePalette(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); return movePalette(-1); }
    if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); return choosePalette(); }
    if (event.key === "Escape") { event.preventDefault(); return closePalette(); }
  }
  if (event.key === "Escape" && state.activeGem) { clearGem(); return; }
  // Backspacing into an empty composer drops the gem, matching how chips behave
  // elsewhere, so the gem never feels stuck.
  if (event.key === "Backspace" && !$("questionInput").value && state.activeGem) { event.preventDefault(); clearGem(); return; }
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("questionForm").requestSubmit(); }
});

$("palette").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gem]");
  if (!button) return;
  $("questionInput").value = "";
  activateGem(button.dataset.gem);
});

$("gemGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gem]");
  if (button) activateGem(button.dataset.gem);
});

$("gemNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gem]");
  if (!button) return;
  // Clicking the gem already in use opens its spec rather than re-selecting it.
  if (state.activeGem?.id === button.dataset.gem) return openGemDetail(button.dataset.gem);
  activateGem(button.dataset.gem);
  closeDrawer();
});

$("gemRow").addEventListener("click", (event) => {
  if (event.target.closest("[data-gem-drop]")) return clearGem();
  if (event.target.closest("[data-facts-toggle]")) { state.factsOpen = !state.factsOpen; return renderActiveGem(); }
});

function setRail(collapsed) {
  state.rail = collapsed;
  localStorage.setItem("compliance-rail", collapsed ? "1" : "0");
  $("app").classList.toggle("rail", collapsed);
  $("railToggle").title = t(collapsed ? "railExpand" : "railCollapse");
  document.querySelector(".sidebar-brand").title = collapsed ? t("railExpand") : "";
}
function closeDrawer() {
  $("app").classList.remove("drawer-open");
  $("scrim").hidden = true;
}
$("railToggle").addEventListener("click", () => setRail(true));
// The toggle is hidden once collapsed, so the brand mark restores the sidebar.
document.querySelector(".sidebar-brand").addEventListener("click", (event) => {
  if (state.rail && !event.target.closest("#railToggle")) setRail(false);
});
$("drawerBtn").addEventListener("click", () => {
  const open = !$("app").classList.contains("drawer-open");
  $("app").classList.toggle("drawer-open", open);
  $("scrim").hidden = !open;
});
$("scrim").addEventListener("click", closeDrawer);

$("gemDialog").addEventListener("click", (event) => {
  if (event.target === $("gemDialog") || event.target.closest("[data-close-gem]")) return $("gemDialog").close();
  const use = event.target.closest("[data-use-gem]");
  if (use) { $("gemDialog").close(); return activateGem(use.dataset.useGem); }
  const toggle = event.target.closest("[data-toggle-workspace]");
  if (toggle) {
    const added = toggleWorkspaceGem(toggle.dataset.toggleWorkspace);
    toggle.textContent = added ? t("gemRemove") : t("gemAdd");
    renderGemGrid();
    toast(added ? t("gemAdded") : t("gemRemoved"));
  }
});

document.addEventListener("click", (event) => {
  if (state.palette.open && !event.target.closest(".composer")) closePalette();
});

$("questionForm").addEventListener("submit", analyze);
$("newChatBtn").addEventListener("click", newConversation);
$("modePill").addEventListener("click", () => { state.rulesMode = !state.rulesMode; updateModePill(); });
$("zhBtn").addEventListener("click", () => applyLocale("zh"));
$("enBtn").addEventListener("click", () => applyLocale("en"));
$("themeBtn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
$("settingsBtn").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", () => $("settingsDialog").close());
$("settingsForm").addEventListener("submit", saveSettings);
$("testConnectionBtn").addEventListener("click", testConnection);
$("showKeyBtn").addEventListener("click", () => {
  const field = $("apiKeyInput");
  field.type = field.type === "password" ? "text" : "password";
  $("showKeyBtn").textContent = field.type === "password" ? t("show") : t("hide");
});
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) $("settingsDialog").close(); });
$("scenarioBtn").addEventListener("click", () => $("scenarioDialog").showModal());
$("closeScenarioDialog").addEventListener("click", () => $("scenarioDialog").close());
$("scenarioDialog").addEventListener("click", (event) => {
  if (event.target === $("scenarioDialog")) return $("scenarioDialog").close();
  const filter = event.target.closest("[data-category]");
  if (filter) { state.scenarioCategory = filter.dataset.category; return renderScenarios(); }
  const pick = event.target.closest("[data-scenario]");
  if (!pick) return;
  const scenario = scenarios[state.locale].find((item) => item.id === pick.dataset.scenario);
  if (!scenario) return;
  $("questionInput").value = scenario.question;
  $("scenarioDialog").close();
  updateRouteHint();
  if (state.activeGem) renderActiveGem();
  $("questionInput").focus();
});

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
if (sessionStorage.getItem("compliance-api-key")) state.rulesMode = false;
setRail(state.rail);
applyLocale(state.locale);
renderEvidence([]);
loadRuntimeCapabilities();

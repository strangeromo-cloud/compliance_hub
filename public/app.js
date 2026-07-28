const i18n = {
  zh: {
    brandSub: "合规情报原型", prototype: "Prototype", publicSources: "公开来源", modelSettings: "模型配置", scenarioLibrary: "测试场景", dataCoverage: "数据覆盖",
    quickStart: "快速开始", scenarios: "验证情景", scenarioHelp: "选择一个情景，验证 Agent 路由与公开信息整合。",
    testCases: "个测试场景", filterAll: "全部", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "跨域协同",
    demoMode: "规则演示", demoModeHelp: "无需 API Key；覆盖内置政策和场景，不等于开放式实时问答", boundary: "仅做公开信息研究和风险分流，不替代律师审查，也不自动批准交易。",
    masterAgent: "COMPLIANCE HUB MASTER AGENT", welcomeTitle: "直接描述你的交易或合规问题",
    welcomeLead: "你只需要在一个对话框提问。Master Agent 会自动选择 Trade、Product、Ethics & TPDD Agent，并返回一份统一答案。",
    hubAssistant: "Compliance Hub Assistant", autoRouting: "Master Agent 自动路由", newChat: "新对话", testLibrary: "TEST LIBRARY",
    scenarioDialogHelp: "场景只用于快速填入主对话框，不会创建新的对话窗口。", specialistTrace: "查看专业 Agent 分析轨迹", routedTo: "已路由至",
    questionLabel: "输入合规情景", questionPlaceholder: "描述交易方、产品、路线、最终用户、付款安排或服务范围……",
    willRoute: "Master Agent 将在后台自动路由", analyze: "发送", composerCaption: "Prototype 不替代律师审查。不要输入商业秘密、个人敏感信息或未公开交易数据。",
    traceability: "可追溯性", evidence: "证据与来源", evidenceEmpty: "完成一次分析后，这里会显示来源、实时获取状态和访问时间。",
    modelConnection: "MODEL CONNECTION", settingsIntro: "支持 OpenAI-compatible Chat Completions API。配置仅用于本机 Prototype。", show: "显示", hide: "隐藏",
    keyNote: "API Key 仅保存在当前浏览器会话中，发送给本机服务用于本次调用；不会写入项目文件或服务器日志。",
    testConnection: "测试连接", saveSession: "保存到当前会话", analyzing: "正在编排合规分析", analyzingHelp: "正在检索公开来源并组织统一回答……",
    needKey: "请先在模型配置中填写 API Key，或开启演示模式。", invalidQuestion: "请先描述一个具体的交易情景。", error: "分析失败",
    saved: "模型配置已保存到当前会话", testing: "正在测试连接……", connected: "连接成功，可以使用实时模型。", connectionFailed: "连接失败，请检查 Base URL、模型、Key 或账户额度。",
    model_auth_error: "认证失败（401）：API Key 无效、已过期，或不属于这个 API 服务。", model_permission_error: "权限被拒绝（403）：Key 已被识别，但账户、IP 或当前模型权限不允许调用。", model_endpoint_or_name_not_found: "接口或模型不存在（404）：请检查 Base URL 是否包含正确的 /v1 路径，以及模型名称。", model_quota_or_rate_limit: "请求被限流或账户额度不足（429）：请检查余额、额度和速率限制。", model_invalid_request: "模型接口拒绝了请求（400/422）：该接口可能不兼容 Chat Completions，或不支持当前模型参数。", model_invalid_response: "接口已响应，但不是兼容的 Chat Completions JSON：请检查 Base URL 是否指向 /v1，或供应商是否支持该协议。", model_timeout: "模型接口连接超时：请检查网络、代理或服务状态。", model_network_error: "无法连接模型接口：域名、网络、代理或 TLS 连接失败。", model_provider_error: "模型服务返回异常，请检查服务状态。", model_unknown_error: "连接失败，服务未返回可识别的错误。",
    overallAssessment: "总体判断", nextStep: "建议下一步", findings: "主要发现", missingInfo: "仍需信息", actions: "建议行动", noItems: "暂无",
    sourceLive: "实时获取", sourceMetadata: "元数据", sourceUnavailable: "获取失败", sourceNotFetched: "未获取", accessed: "访问",
    mockLabel: "规则与公开数据", liveLabel: "实时模型 + 公开数据", openSource: "打开官方来源", riskLow: "低", riskMedium: "中", riskHigh: "高", riskUnknown: "待定",
    routeLabel: "路由", resultAgents: "参与 Agent", themeLabel: "切换明暗主题", runtimeRules: "规则模式", runtimeReady: "实时模型已配置", runtimeMissing: "实时模型未配置"
  },
  en: {
    brandSub: "Compliance intelligence", prototype: "Prototype", publicSources: "Public sources", modelSettings: "Model settings", scenarioLibrary: "Test scenarios", dataCoverage: "Data coverage",
    quickStart: "Quick start", scenarios: "Test scenarios", scenarioHelp: "Choose a scenario to validate routing and public-information consolidation.",
    testCases: "test scenarios", filterAll: "All", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "Cross-domain",
    demoMode: "Rules demo", demoModeHelp: "No API key; covers built-in policies and scenarios, not open-ended live Q&A", boundary: "For public-information research and risk triage only. Not legal review or transaction approval.",
    masterAgent: "COMPLIANCE HUB MASTER AGENT", welcomeTitle: "Describe your transaction or compliance question",
    welcomeLead: "Ask through one conversation. The Master Agent automatically selects Trade, Product, and Ethics & TPDD agents and returns one unified answer.",
    hubAssistant: "Compliance Hub Assistant", autoRouting: "Automatic Master Agent routing", newChat: "New chat", testLibrary: "TEST LIBRARY",
    scenarioDialogHelp: "Scenarios only fill the main composer; they do not create separate chat windows.", specialistTrace: "View specialist Agent analysis trace", routedTo: "Routed to",
    questionLabel: "Enter a compliance scenario", questionPlaceholder: "Describe the party, product, route, ultimate user, payment arrangement or service scope…",
    willRoute: "Master Agent routes in the background", analyze: "Send", composerCaption: "This prototype does not replace legal review. Do not enter trade secrets, sensitive personal data, or confidential transaction details.",
    traceability: "Traceability", evidence: "Evidence & sources", evidenceEmpty: "After an analysis, official sources, retrieval status and access time appear here.",
    modelConnection: "MODEL CONNECTION", settingsIntro: "Supports OpenAI-compatible Chat Completions APIs. Configuration is for this local prototype only.", show: "Show", hide: "Hide",
    keyNote: "The API key stays in this browser session and is sent to the local service for calls. It is never written to project files or server logs.",
    testConnection: "Test connection", saveSession: "Save for this session", analyzing: "Orchestrating compliance analysis", analyzingHelp: "Retrieving public sources and composing one answer…",
    needKey: "Add an API key in Model settings, or enable Demo mode.", invalidQuestion: "Describe a specific transaction scenario first.", error: "Analysis failed",
    saved: "Model settings saved for this session", testing: "Testing connection…", connected: "Connection successful. Live-model mode is ready.", connectionFailed: "Connection failed. Check the Base URL, model, key, and account quota.",
    model_auth_error: "Authentication failed (401): the API key is invalid, expired, or belongs to another API service.", model_permission_error: "Permission denied (403): the key was recognized, but the account, IP, or selected model is not permitted.", model_endpoint_or_name_not_found: "Endpoint or model not found (404): check that the Base URL includes the correct /v1 path and that the model name exists.", model_quota_or_rate_limit: "Rate limit or insufficient quota (429): check balance, quota, and rate limits.", model_invalid_request: "The model API rejected the request (400/422): it may not support Chat Completions or the selected parameters.", model_invalid_response: "The endpoint responded, but not with compatible Chat Completions JSON. Check that the Base URL points to /v1 and that the provider supports this protocol.", model_timeout: "The model API timed out. Check the network, proxy, or provider status.", model_network_error: "The model API could not be reached. Check the hostname, network, proxy, or TLS connection.", model_provider_error: "The model provider returned an error. Check provider status.", model_unknown_error: "Connection failed with an unrecognized error.",
    overallAssessment: "Overall assessment", nextStep: "Recommended next step", findings: "Key findings", missingInfo: "Missing information", actions: "Recommended actions", noItems: "None",
    sourceLive: "Live retrieved", sourceMetadata: "Metadata", sourceUnavailable: "Unavailable", sourceNotFetched: "Not fetched", accessed: "Accessed",
    mockLabel: "Rules + public data", liveLabel: "Live model + public data", openSource: "Open official source", riskLow: "Low", riskMedium: "Medium", riskHigh: "High", riskUnknown: "Unknown",
    routeLabel: "Route", resultAgents: "Participating agents", themeLabel: "Toggle light/dark theme", runtimeRules: "Rules mode", runtimeReady: "Live model configured", runtimeMissing: "Live model not configured"
  }
};

const scenarios = {
  zh: [
    { id: "T01", category: "trade", icon: "T1", title: "受限方品牌名与具体签约实体", meta: "实体识别 · 限制范围", agents: ["trade"], question: "我们计划与华为体系内一家公司签订远程技术支持合同。请说明如何确认具体签约实体、该实体可能适用的清单限制，以及纯服务、软件更新和技术访问应分别核查什么。" },
    { id: "T02", category: "trade", icon: "T2", title: "非名单客户的受限所有权风险", meta: "OFAC 50% Rule · UBO", agents: ["trade", "tpdd"], question: "客户本身没有出现在制裁名单上，但两家受制裁公司分别持有其30%和25%股权。我们能否交易？还需要取得哪些UBO及所有权资料？" },
    { id: "T03", category: "trade", icon: "T3", title: "同名名单命中的误报处理", meta: "Name match · 地址与身份", agents: ["trade"], question: "系统提示客户 Apex Global Trading 与限制名单中的名称相似，但国家、地址和注册号不同。应如何判断是真实命中还是 false positive，并保留哪些证据？" },
    { id: "P01", category: "product", icon: "P1", title: "H100 经加拿大出口至墨西哥", meta: "分类 · 路线 · 许可证", agents: ["product"], question: "NVIDIA H100 从美国出口，经加拿大中转到墨西哥，是否需要许可证？请列出准确判断所需的产品、收货方、最终安装地点和最终用途信息。" },
    { id: "P02", category: "product", icon: "P2", title: "加密网络设备出口至印度", meta: "ECCN · Encryption · 例外", agents: ["product"], question: "一台包含VPN和高强度加密功能的美国原产网络安全设备拟出口到印度商业银行。应如何确认ECCN、加密分类、可能的许可例外和申报要求？" },
    { id: "P03", category: "product", icon: "P3", title: "中国两用物项出口至欧盟", meta: "中国出口管制 · 最终用途", agents: ["product", "trade"], question: "中国供应商拟向欧盟客户出口可能属于两用物项的镓相关材料。需要核查哪些中国出口管制清单、产品参数、最终用户和最终用途信息？" },
    { id: "D01", category: "tpdd", icon: "D1", title: "顾问成功费与 BVI 收款账户", meta: "费用 · 付款路径 · UBO", agents: ["tpdd"], question: "一家新成立的第三方顾问要求15%成功费，并要求付款到BVI账户。需要开展哪些尽调？" },
    { id: "D02", category: "tpdd", icon: "D2", title: "新经销商缺少经营实质", meta: "Shell indicators · UBO", agents: ["tpdd"], question: "一家成立三个月的经销商使用共享办公地址、没有公开员工信息，并拒绝提供UBO。哪些是风险指标？需要哪些文件才能判断其经营实质？" },
    { id: "D03", category: "tpdd", icon: "D3", title: "政府招标中的本地顾问", meta: "PEP · 服务证明 · 反腐败", agents: ["tpdd"], question: "本地顾问声称能帮助赢得政府招标，要求向个人账户支付月费和成功费。我们应如何审查PEP关系、服务范围、费用合理性和实际履约证据？" },
    { id: "X01", category: "cross", icon: "X1", title: "H100 经分销商转供中国最终用户", meta: "转运 · 最终用户 · 经销商", agents: ["trade", "product", "tpdd"], question: "H100 销售给墨西哥经销商，但邮件显示最终用户位于中国。请同时评估受限方、产品许可、转运规避和经销商尽调风险。" },
    { id: "X02", category: "cross", icon: "X2", title: "被拒订单改由货代与第三方付款", meta: "Circumvention · Payment", agents: ["trade", "product", "tpdd"], question: "一个出口订单因最终用户信息不完整被拒后，销售要求改由新加坡货代收货，并由无关第三方付款。应触发哪些Trade、Product和TPDD检查？" },
    { id: "X03", category: "cross", icon: "X3", title: "新供应商、敏感 BOM 与异常付款", meta: "BOM · Vendor · Transaction", agents: ["trade", "product", "tpdd"], question: "采购拟从新供应商购买含美国加密芯片和中国两用物项部件的设备，供应商要求预付款到关联公司账户。请整合产品分类、交易方筛查和第三方尽调问题。" }
  ],
  en: [
    { id: "T01", category: "trade", icon: "T1", title: "Restricted brand vs contracting entity", meta: "Entity identity · Restriction scope", agents: ["trade"], question: "We plan to sign a remote technical-support contract with a company in the Huawei group. Explain how to identify the contracting entity, determine applicable list restrictions, and separately assess pure services, software updates, and technology access." },
    { id: "T02", category: "trade", icon: "T2", title: "Blocked ownership of an unlisted customer", meta: "OFAC 50% Rule · UBO", agents: ["trade", "tpdd"], question: "The customer is not named on a sanctions list, but two blocked companies own 30% and 25% respectively. Can we transact, and what UBO and ownership evidence is required?" },
    { id: "T03", category: "trade", icon: "T3", title: "Resolving a potential name-match false positive", meta: "Name match · Identity evidence", agents: ["trade"], question: "Screening flags Apex Global Trading as similar to a restricted-list name, but its country, address, and registration number differ. How should we resolve the match and document the evidence?" },
    { id: "P01", category: "product", icon: "P1", title: "H100 from the US via Canada to Mexico", meta: "Classification · Route · License", agents: ["product"], question: "Does exporting an NVIDIA H100 from the United States via Canada to Mexico require a license? List the product, consignee, installation location, and end-use facts required for the analysis." },
    { id: "P02", category: "product", icon: "P2", title: "Encrypted network appliance to India", meta: "ECCN · Encryption · Exception", agents: ["product"], question: "A US-origin network-security appliance with VPN and strong encryption will be exported to an Indian commercial bank. How should we confirm the ECCN, encryption classification, possible license exception, and reporting requirements?" },
    { id: "P03", category: "product", icon: "P3", title: "PRC dual-use item exported to the EU", meta: "PRC controls · End use", agents: ["product", "trade"], question: "A Chinese supplier plans to export gallium-related material that may be dual-use to an EU customer. Which PRC control lists, technical parameters, end-user facts, and end-use facts must be checked?" },
    { id: "D01", category: "tpdd", icon: "D1", title: "Success fee and BVI payment account", meta: "Fee · Payment path · UBO", agents: ["tpdd"], question: "A newly formed third-party consultant requests a 15% success fee paid to a BVI account. What due diligence is required?" },
    { id: "D02", category: "tpdd", icon: "D2", title: "New distributor with little business substance", meta: "Shell indicators · UBO", agents: ["tpdd"], question: "A distributor formed three months ago uses a shared-office address, has no public employee information, and refuses to provide its UBO. Which indicators matter, and what evidence is needed to assess business substance?" },
    { id: "D03", category: "tpdd", icon: "D3", title: "Local consultant for a government tender", meta: "PEP · Performance · Anti-bribery", agents: ["tpdd"], question: "A local consultant claims it can help win a government tender and requests a monthly fee plus a success fee paid to an individual account. How should we assess PEP links, scope, fee reasonableness, and performance evidence?" },
    { id: "X01", category: "cross", icon: "X1", title: "H100 diverted through a distributor to China", meta: "Diversion · End user · Distributor", agents: ["trade", "product", "tpdd"], question: "An H100 is sold to a Mexican distributor, but emails indicate that the ultimate user is in China. Assess restricted-party, product-license, diversion, and distributor-due-diligence risks together." },
    { id: "X02", category: "cross", icon: "X2", title: "Rejected order rerouted with third-party payment", meta: "Circumvention · Payment", agents: ["trade", "product", "tpdd"], question: "After an export order was rejected for missing end-user information, Sales proposes delivery to a Singapore freight forwarder with payment from an unrelated third party. Which Trade, Product, and TPDD checks should trigger?" },
    { id: "X03", category: "cross", icon: "X3", title: "New supplier, sensitive BOM and unusual payment", meta: "BOM · Vendor · Transaction", agents: ["trade", "product", "tpdd"], question: "Procurement wants to buy equipment containing US encryption chips and PRC dual-use components from a new supplier that requests prepayment to an affiliate account. Consolidate product-classification, party-screening, and third-party-due-diligence questions." }
  ]
};

const state = { locale: localStorage.getItem("compliance-locale") || "zh", busy: false, scenarioCategory: "all", conversation: [], serverModelConfigured: false };
const $ = (id) => document.getElementById(id);

function t(key) { return i18n[state.locale][key] || key; }
function agentName(agent) { return ({ trade: "Trade Compliance", product: "Product Compliance", tpdd: "Ethics & TPDD" })[agent] || agent; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function getConfig() {
  return {
    baseUrl: localStorage.getItem("compliance-base-url") || "https://api.openai.com/v1",
    model: localStorage.getItem("compliance-model") || "gpt-5.4-mini",
    apiKey: sessionStorage.getItem("compliance-api-key") || ""
  };
}

function renderScenarios() {
  const visible = scenarios[state.locale].filter((scenario) => state.scenarioCategory === "all" || scenario.category === state.scenarioCategory);
  $("visibleScenarioCount").textContent = visible.length;
  $("scenarioFilters").innerHTML = ["all", "trade", "product", "tpdd", "cross"].map((category) => `
    <button type="button" class="filter-button ${state.scenarioCategory === category ? "active" : ""}" data-category="${category}" aria-pressed="${state.scenarioCategory === category}">${t(`filter${category.charAt(0).toUpperCase()}${category.slice(1)}`)}</button>`).join("");
  $("scenarioList").innerHTML = visible.map((scenario) => `
    <button type="button" class="scenario-button" data-scenario="${scenario.id}">
      <span class="scenario-icon">${scenario.icon}</span>
      <span><strong>${escapeHtml(scenario.title)}</strong><small>${escapeHtml(scenario.meta)}</small><span class="scenario-route">${scenario.agents.map((agent) => `<i>${agentName(agent)}</i>`).join("")}</span></span>
    </button>`).join("");
}

function renderStarterPrompts() {
  const starterIds = ["T03", "P02", "D02", "X02"];
  const selected = starterIds.map((id) => scenarios[state.locale].find((scenario) => scenario.id === id)).filter(Boolean);
  $("starterPrompts").innerHTML = selected.map((scenario) => `<button type="button" class="starter-prompt" data-starter="${scenario.id}"><b>${scenario.id} · ${scenario.agents.map(agentName).join(" + ")}</b>${escapeHtml(scenario.title)}</button>`).join("");
}

function applyLocale(locale) {
  state.locale = locale;
  localStorage.setItem("compliance-locale", locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $("zhBtn").classList.toggle("active", locale === "zh"); $("zhBtn").setAttribute("aria-pressed", locale === "zh");
  $("enBtn").classList.toggle("active", locale === "en"); $("enBtn").setAttribute("aria-pressed", locale === "en");
  $("themeBtn").ariaLabel = t("themeLabel");
  $("scenarioLibraryBtn").ariaLabel = t("scenarioLibrary");
  $("settingsBtn").ariaLabel = t("modelSettings");
  $("newChatBtn").ariaLabel = t("newChat");
  renderScenarios();
  renderStarterPrompts();
  updateRuntimeStatus();
}

function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("compliance-theme", theme);
}

function updateRuntimeStatus() {
  const status = $("runtimeStatus");
  if (!status) return;
  const rulesMode = $("mockToggle").checked;
  const ready = state.serverModelConfigured || Boolean(sessionStorage.getItem("compliance-api-key"));
  status.className = `runtime-status ${rulesMode ? "runtime-rules" : ready ? "runtime-ready" : "runtime-missing"}`;
  status.textContent = rulesMode ? t("runtimeRules") : ready ? t("runtimeReady") : t("runtimeMissing");
}

function estimatedRoute(question) {
  const lower = question.toLowerCase(); const agents = [];
  if (/华为|huawei|名单|entity|sdn|交易方|restricted|sanction|party|ownership|所有权|最终用户|end.user|最终用途|end.use|false positive|screening/.test(lower)) agents.push("trade");
  if (/h100|gpu|cpu|芯片|产品|eccn|加密|encryption|license|许可证|product|出口|export|两用物项|dual.use|bom|镓|gallium/.test(lower)) agents.push("product");
  if (/顾问|consultant|成功费|success fee|bvi|付款|payment|第三方|third.party|尽调|due diligence|shell|ubo|经销商|distributor|共享办公|shared.office|政府招标|government tender|货代|freight.forwarder|关联公司|affiliate account/.test(lower)) agents.push("tpdd");
  return agents.length ? [...new Set(agents)] : ["trade", "product", "tpdd"];
}

function updateRoutePreview() {
  const value = $("questionInput").value.trim();
  if (!value) { $("routePreview").innerHTML = `<span>${t("willRoute")}</span>`; return; }
  const looksLikeFollowUp = /^(那|那么|如果|再|另外|对于|上述|这个|该|what if|then|and if|how about|for that)/i.test(value);
  const latestUserContext = [...state.conversation].reverse().find((item) => item.role === "user")?.content || "";
  const previewAgents = looksLikeFollowUp && latestUserContext ? [...new Set([...estimatedRoute(latestUserContext), ...estimatedRoute(value)])] : estimatedRoute(value);
  $("routePreview").innerHTML = `<span>${t("routeLabel")}:</span>${previewAgents.map((agent) => `<span class="route-tag">${agentName(agent)}</span>`).join("")}`;
}

function riskLabel(level) { return t(`risk${level.charAt(0).toUpperCase()}${level.slice(1)}`); }
function renderList(items) { return items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${t("noItems")}</p>`; }

function renderResults(data) {
  $("emptyState").classList.add("hidden"); $("loadingState").classList.add("hidden");
  const synthesis = data.synthesis;
  const answerId = `answer-${data.id}`;
  $("resultState").insertAdjacentHTML("beforeend", `
    <article class="chat-message assistant-message" id="${escapeHtml(answerId)}">
      <span class="assistant-avatar" aria-hidden="true">CH</span>
      <div class="assistant-content">
        <div class="assistant-meta"><strong>Compliance Hub</strong><span>${escapeHtml(data.id)}</span><span>${data.mode === "live-model" ? t("liveLabel") : t("mockLabel")}</span></div>
        <div class="route-strip">${t("routedTo")}: ${data.agents.map((agent) => `<span>${agentName(agent)}</span>`).join("")}</div>
        <section class="unified-answer">
          <div class="unified-answer-head"><span class="risk-mark risk-${synthesis.overallRisk}">${escapeHtml(riskLabel(synthesis.overallRisk))}</span>
            <div><p class="eyebrow">${t("overallAssessment")}</p><h2>${escapeHtml(synthesis.headline)}</h2><p>${escapeHtml(synthesis.executiveSummary)}</p></div>
          </div>
          <div class="next-step"><strong>${t("nextStep")}</strong><p>${escapeHtml(synthesis.nextStep)}</p></div>
        </section>
        <details class="analysis-trace">
          <summary>${t("specialistTrace")}</summary>
          <div class="trace-body">${data.results.map((result) => `
            <section class="trace-agent">
              <div class="trace-agent-head"><strong>${agentName(result.agent)}</strong><span class="risk-chip risk-${result.riskLevel}">${escapeHtml(riskLabel(result.riskLevel))}</span></div>
              <p>${escapeHtml(result.summary)}</p>
              <ul class="trace-findings">${(result.findings || []).map((finding) => `<li><b>${escapeHtml(finding.title)}：</b>${escapeHtml(finding.detail)} <span class="citation-chips">${(finding.evidenceSourceIds || []).map((id) => `<span>${escapeHtml(id)}</span>`).join("")}</span></li>`).join("")}</ul>
              <div class="trace-columns"><div><h3>${t("missingInfo")}</h3>${renderList(result.missingInfo)}</div><div><h3>${t("actions")}</h3>${renderList(result.recommendedActions)}</div></div>
            </section>`).join("")}</div>
        </details>
        <p class="message-disclaimer">${escapeHtml(data.disclaimer)}</p>
      </div>
    </article>`);
  renderEvidence(data.sources || []);
  document.getElementById(answerId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function sourceStatus(source) {
  return { live: t("sourceLive"), metadata_only: t("sourceMetadata"), unavailable: t("sourceUnavailable"), not_fetched: t("sourceNotFetched") }[source.liveStatus] || source.liveStatus;
}
function renderEvidence(sources) {
  $("sourceCount").textContent = sources.length; $("evidenceEmpty").classList.toggle("hidden", sources.length > 0);
  $("evidenceList").innerHTML = sources.map((source) => `
    <article class="source-card"><div class="source-authority">${escapeHtml(source.authority)}</div>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" title="${t("openSource")}">${escapeHtml(source.title)}</a>
      <div class="source-meta"><span class="source-status ${escapeHtml(source.liveStatus)}">${escapeHtml(sourceStatus(source))}</span><time>${source.retrievedAt ? new Date(source.retrievedAt).toLocaleTimeString(state.locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</time></div>
    </article>`).join("");
}

async function analyze(event) {
  event.preventDefault(); if (state.busy) return;
  const question = $("questionInput").value.trim(); const mock = $("mockToggle").checked; const config = getConfig();
  if (question.length < 5) return toast(t("invalidQuestion"));
  if (!mock && !config.apiKey && !state.serverModelConfigured) { toast(t("needKey")); openSettings(); return; }
  const priorHistory = state.conversation.slice(-6);
  state.conversation.push({ role: "user", content: question });
  $("emptyState").classList.add("hidden");
  $("resultState").insertAdjacentHTML("beforeend", `<article class="chat-message user-message"><div class="user-bubble">${escapeHtml(question)}</div></article>`);
  $("questionInput").value = ""; updateRoutePreview();
  state.busy = true; $("submitBtn").disabled = true; $("loadingState").classList.remove("hidden");
  $("loadingState").scrollIntoView({ behavior: "smooth", block: "end" });
  try {
    const response = await fetch("/api/assess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, locale: state.locale, mock, config, history: priorHistory }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || t("error"));
    state.conversation.push({ role: "assistant", content: `${data.synthesis.headline}\n${data.synthesis.executiveSummary}\n${data.synthesis.nextStep}` });
    renderResults(data);
  } catch (error) {
    $("loadingState").classList.add("hidden");
    $("resultState").insertAdjacentHTML("beforeend", `<article class="chat-message assistant-message"><span class="assistant-avatar">CH</span><div class="assistant-content"><div class="unified-answer"><strong>${t("error")}</strong><p>${escapeHtml(error.message)}</p></div></div></article>`);
    toast(`${t("error")}: ${error.message}`);
  } finally { state.busy = false; $("submitBtn").disabled = false; }
}

function newConversation() {
  state.conversation = [];
  $("resultState").innerHTML = "";
  $("emptyState").classList.remove("hidden");
  $("loadingState").classList.add("hidden");
  $("questionInput").value = "";
  renderEvidence([]);
  updateRoutePreview();
  $("questionInput").focus();
}

function openSettings() {
  const config = getConfig(); $("baseUrlInput").value = config.baseUrl; $("modelInput").value = config.model; $("apiKeyInput").value = config.apiKey; $("connectionStatus").textContent = "";
  $("settingsDialog").showModal();
}
function saveSettings(event) {
  event.preventDefault(); localStorage.setItem("compliance-base-url", $("baseUrlInput").value.trim()); localStorage.setItem("compliance-model", $("modelInput").value.trim());
  const key = $("apiKeyInput").value.trim(); if (key) sessionStorage.setItem("compliance-api-key", key); else sessionStorage.removeItem("compliance-api-key");
  if (key) $("mockToggle").checked = false;
  updateRuntimeStatus();
  $("settingsDialog").close(); toast(t("saved"));
}

async function loadRuntimeCapabilities() {
  try {
    const response = await fetch("/api/runtime-capabilities");
    if (!response.ok) return;
    const capabilities = await response.json();
    state.serverModelConfigured = Boolean(capabilities.liveModelConfigured);
    if (state.serverModelConfigured && !sessionStorage.getItem("compliance-force-demo")) $("mockToggle").checked = false;
    updateRuntimeStatus();
  } catch { /* The rules demo remains available when capability discovery fails. */ }
}
async function testConnection() {
  const status = $("connectionStatus"); status.className = "connection-status"; status.textContent = t("testing"); $("testConnectionBtn").disabled = true;
  try {
    const config = { baseUrl: $("baseUrlInput").value.trim(), model: $("modelInput").value.trim(), apiKey: $("apiKeyInput").value.trim() };
    const response = await fetch("/api/test-connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const message = i18n[state.locale][data.code] || data.error || t("connectionFailed");
      const error = new Error(message); error.code = data.code; throw error;
    }
    status.classList.add("success"); status.textContent = t("connected");
  } catch (error) { status.classList.add("error"); status.textContent = error.message || t("connectionFailed"); }
  finally { $("testConnectionBtn").disabled = false; }
}

$("scenarioFilters").addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (!button) return; state.scenarioCategory = button.dataset.category; renderScenarios(); });
$("scenarioList").addEventListener("click", (event) => { const button = event.target.closest("[data-scenario]"); if (!button) return; const scenario = scenarios[state.locale].find((item) => item.id === button.dataset.scenario); if (!scenario) return; $("questionInput").value = scenario.question; $("scenarioDialog").close(); updateRoutePreview(); $("questionInput").focus(); });
$("starterPrompts").addEventListener("click", (event) => { const button = event.target.closest("[data-starter]"); if (!button) return; const scenario = scenarios[state.locale].find((item) => item.id === button.dataset.starter); if (!scenario) return; $("questionInput").value = scenario.question; updateRoutePreview(); $("questionInput").focus(); });
$("questionForm").addEventListener("submit", analyze); $("questionInput").addEventListener("input", updateRoutePreview);
$("mockToggle").addEventListener("change", updateRuntimeStatus);
$("questionInput").addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") $("questionForm").requestSubmit(); });
$("zhBtn").addEventListener("click", () => applyLocale("zh")); $("enBtn").addEventListener("click", () => applyLocale("en"));
$("themeBtn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
$("scenarioLibraryBtn").addEventListener("click", () => $("scenarioDialog").showModal());
$("closeScenarioDialog").addEventListener("click", () => $("scenarioDialog").close());
$("scenarioDialog").addEventListener("click", (event) => { if (event.target === $("scenarioDialog")) $("scenarioDialog").close(); });
$("newChatBtn").addEventListener("click", newConversation);
$("settingsBtn").addEventListener("click", openSettings); $("closeSettings").addEventListener("click", () => $("settingsDialog").close());
$("settingsForm").addEventListener("submit", saveSettings); $("testConnectionBtn").addEventListener("click", testConnection);
$("showKeyBtn").addEventListener("click", () => { const field = $("apiKeyInput"); field.type = field.type === "password" ? "text" : "password"; $("showKeyBtn").textContent = field.type === "password" ? t("show") : t("hide"); });
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) $("settingsDialog").close(); });

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
if (sessionStorage.getItem("compliance-api-key")) $("mockToggle").checked = false;
applyLocale(state.locale); updateRoutePreview(); updateRuntimeStatus(); loadRuntimeCapabilities();

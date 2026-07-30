import { GEMS, GEM_BY_ID, GEM_GROUPS, factCoverage, matchGems, toggleWorkspaceGem, workspaceGemIds } from "/gems.js";
import { EVIDENCE_STATUS, STEP_STATUS_VOCAB, label, tone } from "/status-vocabulary.js";

const i18n = {
  zh: {
    prototype: "Prototype", skipLink: "跳到工作区", workbench: "出口管制工作台", newChat: "新对话",
    scenarioLibrary: "测试场景", guideLink: "使用说明", scenarioHelp: "场景只填入输入框，不会新建对话。",
    startTitle: "描述交易，或用 / 选择一个 Gem",
    startLead: "范围为美国与中国的出口管制。Master Agent 自动路由到贸易、产品和第三方尽调 Agent，返回一份带证据链的统一答案。",
    gemsLabel: "GEMS", gemsHint: "在输入框键入 / 可随时调用", coverageLabel: "数据覆盖",
    questionLabel: "输入合规情景", placeholder: "描述交易方、产品、路线、最终用户或付款安排……",
    slashHint: "Gem", composerNote: "原型输出仅用于研究与风险分流，不构成法律意见。请勿输入商业秘密或未公开交易数据。",
    evidence: "证据与来源", evidenceEmpty: "完成一次分析后，这里显示引用来源、获取状态与访问时间。",
    modelSettings: "模型配置", settingsIntro: "支持 OpenAI-compatible Chat Completions API。", settingsIntroServer: "本部署的模型由服务器提供。你只需填写访问口令。", settingsIntroBlocked: "本部署已配置模型，但服务器未设置访问口令，因此实时模型不可用。", accessSettings: "访问设置", codeNote: "访问口令保存在本浏览器，用于调用受保护的接口。它是共享口令，不是身份认证。", serverModelNote: "模型由服务器提供，无需在此填写 API Key。", show: "显示", hide: "隐藏",
    keyNote: "API Key 仅保存在当前浏览器会话中，用于转发本次调用；不会写入服务器文件或日志。",
    testConnection: "测试连接", saveSession: "保存", analyzing: "正在检索官方来源并组织答案……",
    dataLoading: "数据状态载入中", dataSynced: "个来源已同步", dataFallback: "个用兜底快照", dataFailed: "个失败", dataNone: "暂无可用来源",
    sourcesSynced: "已同步来源", listRecords: "名单记录", cnSources: "中国来源", fallbackSources: "兜底快照", failedSources: "同步失败",
    fallbackTitle: "本机未同步，使用随仓库提交的时点快照，采集于",
    gemSourcesUnit: "个来源", gemRecordsUnit: "条记录", gemUnsynced: "个未同步", gemNoData: "无绑定来源", gemNoCoverage: "数据状态未知",
    factsShort: "必填", railCollapse: "收起侧边栏", railExpand: "展开侧边栏",
    mosaicLabel: "来源版图", mosaicUs: "美国", mosaicCn: "中国", mosaicOther: "全球 / 其他",
    hfQuestion: "一个问题", hfAnswer: "统一答案", startersLabel: "快速开始", workspaceEmpty: "工作区还没有 Gem", gemBacking: "数据支撑",
    teachSlashTitle: "在输入框键入 /", teachSlashBody: "呼出 {n} 个 Gem 的完整目录，上下键选择，回车使用。",
    teachPinTitle: "把常用 Gem 加入工作区", teachPinBody: "在目录里点 ★，或在 Gem 详情里点「添加到工作区」，它会常驻左侧栏。",
    historyLabel: "历史记录", historyEmpty: "暂无记录", turnUnit: "轮", historyOpenFailed: "无法打开该记录", flowTitle: "执行流程", flowEmpty: "提交一个问题后，这里显示分析路径的执行进度", flowNotRun: "该步骤尚未执行", laneAhead: "还有 {n} 步未执行：", derivTitle: "分析路径的来源", derivLead: "主检查", derivSteps: "步",
    derivMatched: "匹配依据", derivStandard: "遵循规范", derivBreakdown: "步骤构成",
    derivMatch_gem: "由所选 Gem 指定为主检查", derivMatch_always: "每次分析都执行", derivMatch_question_terms: "问题中的关键词",
    derivMatch_no_term_matched_all_lanes_run: "问题未命中任何关键词，三条检查全部执行",
    derivKind_official: "官方发布的检查程序", derivKind_derived: "系统规划（无对应官方程序）",
    derivFromStandard: "{n} 步来自规范", derivFromSystem: "{n} 步由系统规划",
    pathTitle: "分析路径", pathPlanning: "分析路径（进行中）", laneRunning: "正在分析", laneQueued: "排队中", stAsking: "等待你补充", stAfterInput: "待补充信息后继续", pathBasis: "路径依据", pathTemplated: "规则模式：待补项来自内置模板，不是对本问题的分析结果。切换到实时模型可得到针对性判断。", pathDerivedNote: "本步骤无对应官方条文，由系统按问题结构补充", stConfirmed: "已确认", stEvidence: "需更多证据", stNotReached: "未进行", status_confirmed: "已确认", status_evidence_needed: "需更多证据", status_not_reached: "待前序步骤", status_review_required: "需人工复核", status_pending: "待执行", stPending: "待执行", status_declared: "已声明，待核验", stDeclared: "已声明", declareSubmit: "提交并继续", declareSkip: "暂无此信息", declareSkipped: "已跳过 — 该步骤仍需证据，已保留在下方行动清单中", declareReopen: "重新填写", declarePlaceholder: "填写后提交", declareNote: "填写的内容记为声明信息，不等于已核验证据", declareEmpty: "请先填写至少一项", declarePrefix: "补充信息 — ", declaredAdded: "已提交", declareContinuing: "正在继续分析…", reasoningTrace: "比对明细", rsSearched: "已检索的名单来源", rsMatched: "名称命中", rsCompared: "身份要素比对", rsFacts: "已核验事实",
    rsScore: "相似度", rsOpen: "查看原文", rsUnsynced: "未同步、本次未检索",
    el_country: "国别", el_registration_number: "注册号", el_address: "地址",
    st_agree: "一致", st_conflict: "冲突", st_unavailable: "缺失",
    basis_normalized_name_identical: "规范化后名称完全一致", basis_one_normalized_name_contains_the_other: "一个名称包含另一个",
    basis_token_overlap: "词元重叠", basis_weak_token_overlap: "弱词元重叠", basis_no_overlap: "无重叠", basis_no_comparable_name: "无可比对名称",
    disp_strong_potential_match_escalate_for_human_confirmation: "身份要素一致 —— 建议升级人工确认",
    disp_potential_match_requires_identity_review: "潜在命中 —— 需人工核对身份要素",
    disp_weak_potential_match_requires_identity_review: "弱潜在命中 —— 需人工核对",
    disp_likely_false_positive_identity_elements_conflict: "身份要素冲突 —— 判定为疑似误报（仍需人工用注册证据确认）",
    disp_below_review_threshold: "低于复核阈值",
    noStreamNotice: "当前模型未返回流式响应，分析文本会在每个 Agent 完成后一次性显示。", step_routed: "选择 Agent", step_sources: "检索官方来源", step_grounding: "名单筛查与结构化事实", step_agents: "专业 Agent 分析", step_synthesizing: "综合结论",
    groundingNote: "已筛查 {screened} 个名单来源 · {matches} 条潜在命中 · {internal} 条内部主数据关联",
    filterAll: "全部", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "跨域",
    runtimeRules: "规则模式", runtimeReady: "实时模型", runtimeMissing: "未配置模型",
    modeHint: "点击切换规则模式与实时模型",
    routeLabel: "路由", routedTo: "已路由至", specialistTrace: "专业 Agent 分析轨迹",
    overallAssessment: "总体判断", nextStep: "下一步", missingInfo: "仍需信息", actions: "建议行动", planSuggested: "其他建议", notClosed: "分析未结案 — 还需要 {n} 项信息", notClosedLead: "补齐后分析会从当前步骤继续；在补齐之前不出具结论。", notClosedGo: "去补充：", interimVerdict: "阶段性判断（基于现有信息，未结案）", noItems: "暂无", limitations: "结论边界与限制",
    sourceLive: "实时获取", sourceMetadata: "元数据", sourceUnavailable: "获取失败", sourceNotFetched: "未获取", sourceArchived: "已采集副本", sourceCitationOnly: "仅引用", sourceCached: "缓存", noQueryableSource: "暂无可直查的来源（需先同步）", sourceQueryHint: "@ 直查数据源", sourceQueryPlaceholder: "输入实体名、公告号或条文关键词（按相关性排序；留空则浏览全部）…",
    queryEmpty: "请输入查询内容", queryHits: "{total} 条命中", browseCount: "共 {total} 条", browseAll: "浏览全部", pagePrev: "上一页", pageNext: "下一页", relMatched: "命中", relMissed: "未命中", relPartial: "另有 {n} 条仅命中部分检索词，未列出", queryNoHit: "该来源中未找到匹配记录", queryTruncated: "显示前 {shown} 条，共 {total} 条",
    queryEscalate: "以此发起完整筛查 →", escalatePrefix: "请对 {q} 做完整合规筛查",
    queryDisclaimer: "直查返回的是来源原始记录，不是判定结论。", jumpSource: "在该来源中直查", lookupMode: "直查模式 · 不经 Agent 分析", sourceStale: "缓存（已过期）", evidenceCollapse: "收起证据栏", evidenceExpand: "展开证据栏",
    mockLabel: "规则 + 公开数据", liveLabel: "实时模型 + 公开数据",
    riskLow: "低", riskMedium: "中", riskHigh: "高", riskUnknown: "待定",
    accessPassword: "访问口令", accessRequired: "该部署需要访问口令，请先填写口令后再使用实时模型。", access_password_required: "访问口令不正确，实时模型未调用。", access_code_unset: "服务器未设置 ACCESS_PASSWORD，实时模型已停用；当前仅可使用规则模式。", keyFromServer: "服务器已配置模型，无需在此填写 API Key。", badResponse: "服务端未返回有效结果，通常是网关超时；请重试或缩短问题。", needKey: "请先在模型配置中填写 API Key，或使用规则模式。", invalidQuestion: "请先描述一个具体情景。", error: "分析失败",
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
    scenarioLibrary: "Test scenarios", guideLink: "Guide", scenarioHelp: "Scenarios only fill the composer; they do not start a new thread.",
    startTitle: "Describe the transaction, or press / for a gem",
    startLead: "Scope is US and PRC export control. The Master Agent routes to the trade, product and third-party diligence agents and returns one answer with its evidence chain.",
    gemsLabel: "GEMS", gemsHint: "type / in the composer at any time", coverageLabel: "Data coverage",
    questionLabel: "Enter a compliance scenario", placeholder: "Describe the party, product, route, end user or payment arrangement…",
    slashHint: "Gem", composerNote: "Prototype output is for research and triage only and is not legal advice. Do not enter trade secrets or confidential transaction data.",
    evidence: "Evidence & sources", evidenceEmpty: "After an analysis, cited sources, retrieval status and access time appear here.",
    modelSettings: "Model settings", settingsIntro: "Supports OpenAI-compatible Chat Completions APIs.", settingsIntroServer: "This deployment provides the model. You only need the access code.", settingsIntroBlocked: "This deployment has a model configured, but the server has no access code set, so the live model is unavailable.", accessSettings: "Access", codeNote: "The access code is kept in this browser and used to call the protected endpoints. It is a shared code, not authentication.", serverModelNote: "The model is provided by the server; no API key is needed here.", show: "Show", hide: "Hide",
    keyNote: "The API key stays in this browser session and is used only to forward this call. It is never written to server files or logs.",
    testConnection: "Test connection", saveSession: "Save", analyzing: "Retrieving official sources and composing the answer…",
    dataLoading: "Loading data status", dataSynced: "synced", dataFallback: "on bundled copy", dataFailed: "failed", dataNone: "No sources available",
    sourcesSynced: "Sources synced", listRecords: "List records", cnSources: "PRC sources", fallbackSources: "Bundled copies", failedSources: "Sync failures",
    fallbackTitle: "Not synced on this host; using the bundled point-in-time copy captured",
    gemSourcesUnit: "sources", gemRecordsUnit: "records", gemUnsynced: "not synced", gemNoData: "no bound sources", gemNoCoverage: "coverage unknown",
    factsShort: "Facts", railCollapse: "Collapse sidebar", railExpand: "Expand sidebar",
    mosaicLabel: "Source map", mosaicUs: "United States", mosaicCn: "China", mosaicOther: "Global / other",
    hfQuestion: "One question", hfAnswer: "One answer", startersLabel: "Start here", workspaceEmpty: "No gems in your workspace yet", gemBacking: "Data behind it",
    teachSlashTitle: "Press / in the composer", teachSlashBody: "Opens the full catalogue of {n} gems. Arrow keys select, Enter uses.",
    teachPinTitle: "Pin the ones you use", teachPinBody: "Add to workspace from a gem's details and it stays in the sidebar.",
    historyLabel: "History", historyEmpty: "No cases yet", turnUnit: "turns", historyOpenFailed: "That case could not be opened", flowTitle: "Execution flow", flowEmpty: "Ask a question and the analysis path\u2019s progress appears here", flowNotRun: "That step has not run yet", laneAhead: "{n} steps not yet run: ", derivTitle: "Where this path comes from", derivLead: "lead check", derivSteps: "steps",
    derivMatched: "Matched on", derivStandard: "Procedure followed", derivBreakdown: "Step origin",
    derivMatch_gem: "set as the lead check by the selected gem", derivMatch_always: "runs on every analysis", derivMatch_question_terms: "terms in the question",
    derivMatch_no_term_matched_all_lanes_run: "no term matched, so all three checks run",
    derivKind_official: "published decision procedure", derivKind_derived: "planned by the system (no official procedure)",
    derivFromStandard: "{n} from the procedure", derivFromSystem: "{n} planned here",
    pathTitle: "Analysis path", pathPlanning: "Analysis path (running)", laneRunning: "analysing", laneQueued: "queued", stAsking: "waiting for you", stAfterInput: "continues once supplied", pathBasis: "Path follows", pathTemplated: "Rules mode: the outstanding items come from built-in templates, not from analysing this question. Switch to the live model for a specific assessment.", pathDerivedNote: "No official provision for this step; added by the system", stConfirmed: "settled", stEvidence: "need evidence", stNotReached: "not reached", status_confirmed: "Settled", status_evidence_needed: "Evidence needed", status_not_reached: "Awaiting earlier step", status_review_required: "Human review", status_pending: "Planned", stPending: "planned", status_declared: "Declared, unverified", stDeclared: "declared", declareSubmit: "Submit and continue", declareSkip: "Not available", declareSkipped: "Skipped — this step still needs evidence and stays in the action list below", declareReopen: "Fill in", declarePlaceholder: "Fill in, then submit", declareNote: "What you enter is recorded as a declaration, not as verified evidence", declareEmpty: "Fill in at least one field first", declarePrefix: "Additional information — ", declaredAdded: "Submitted", declareContinuing: "continuing the analysis…", reasoningTrace: "Comparison detail", rsSearched: "Lists searched", rsMatched: "Name matches", rsCompared: "Identity comparison", rsFacts: "Verified facts",
    rsScore: "Similarity", rsOpen: "Open source", rsUnsynced: "Not synced, therefore not searched",
    el_country: "Country", el_registration_number: "Registration no.", el_address: "Address",
    st_agree: "agree", st_conflict: "conflict", st_unavailable: "missing",
    basis_normalized_name_identical: "normalized names identical", basis_one_normalized_name_contains_the_other: "one name contains the other",
    basis_token_overlap: "token overlap", basis_weak_token_overlap: "weak token overlap", basis_no_overlap: "no overlap", basis_no_comparable_name: "no comparable name",
    disp_strong_potential_match_escalate_for_human_confirmation: "Identity elements agree — escalate for human confirmation",
    disp_potential_match_requires_identity_review: "Potential match — identity elements need review",
    disp_weak_potential_match_requires_identity_review: "Weak potential match — needs review",
    disp_likely_false_positive_identity_elements_conflict: "Identity elements conflict — likely false positive (still requires confirmation against registration evidence)",
    disp_below_review_threshold: "Below review threshold",
    noStreamNotice: "This model does not return a streamed response; each specialist\u2019s text appears once it finishes.", step_routed: "Select agents", step_sources: "Retrieve official sources", step_grounding: "Screening and structured facts", step_agents: "Specialist analysis", step_synthesizing: "Synthesis",
    groundingNote: "{screened} list sources screened · {matches} potential matches · {internal} internal records touched",
    filterAll: "All", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "Cross-domain",
    runtimeRules: "Rules mode", runtimeReady: "Live model", runtimeMissing: "No model configured",
    modeHint: "Toggle between rules mode and the live model",
    routeLabel: "Route", routedTo: "Routed to", specialistTrace: "Specialist agent trace",
    overallAssessment: "Overall assessment", nextStep: "Next step", missingInfo: "Missing information", actions: "Recommended actions", planSuggested: "Other suggestions", notClosed: "Not concluded — {n} items still needed", notClosedLead: "Supply them and the analysis continues from where it stopped. No conclusion is issued until then.", notClosedGo: "Supply: ", interimVerdict: "Interim assessment (on incomplete facts, not a conclusion)", noItems: "None", limitations: "Limits on this conclusion",
    sourceLive: "Live", sourceMetadata: "Metadata", sourceUnavailable: "Unavailable", sourceNotFetched: "Not fetched", sourceArchived: "Archived copy", sourceCitationOnly: "Cited only", sourceCached: "Cached", noQueryableSource: "No queryable source yet (sync one first)", sourceQueryHint: "@ query a source", sourceQueryPlaceholder: "Entity name, notice number or keyword — ranked by relevance; leave empty to browse all…",
    queryEmpty: "Enter something to look up", queryHits: "{total} matches", browseCount: "{total} records", browseAll: "Browse all", pagePrev: "Previous", pageNext: "Next", relMatched: "matched", relMissed: "not matched", relPartial: "{n} more records matched only part of the query and are not listed", queryNoHit: "No matching record in this source", queryTruncated: "Showing {shown} of {total}",
    queryEscalate: "Run a full screening on this →", escalatePrefix: "Run a full compliance screening on {q}",
    queryDisclaimer: "A lookup returns the source's own records, not a determination.", jumpSource: "Look this up in the source", lookupMode: "Lookup mode · does not run the agents", sourceStale: "Cached (stale)", evidenceCollapse: "Collapse evidence", evidenceExpand: "Expand evidence",
    mockLabel: "Rules + public data", liveLabel: "Live model + public data",
    riskLow: "Low", riskMedium: "Medium", riskHigh: "High", riskUnknown: "Unknown",
    accessPassword: "Access password", accessRequired: "This deployment requires an access code. Enter it before using the live model.", access_password_required: "The access code is not correct; the live model was not called.", access_code_unset: "ACCESS_PASSWORD is not set on the server, so live-model calls are disabled. Rules mode is still available.", keyFromServer: "The server already provides a model; no API key is needed here.", badResponse: "The server did not return a valid result, usually a gateway timeout. Retry or shorten the question.", needKey: "Add an API key in Model settings, or stay in rules mode.", invalidQuestion: "Describe a specific scenario first.", error: "Analysis failed",
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
  serverModel: null,
  accessPasswordRequired: false,
  liveModelBlocked: false,
  rulesMode: true,
  coverage: null,
  cases: [],
  threadId: null,
  declaredFacts: {},
  sourceQuery: null,
  factsOpen: false,
  rail: localStorage.getItem("compliance-rail") === "1",
  evidenceCollapsed: false,
  panelTab: "flow",
  activeGem: null,
  palette: { open: false, items: [], index: 0 }
};

const $ = (id) => document.getElementById(id);
const t = (key) => i18n[state.locale][key] || key;
const localized = (value) => (value && typeof value === "object" ? value[state.locale] || value.zh : value);
const agentName = (agent) => ({ trade: "Trade", product: "Product", tpdd: "Ethics & TPDD" })[agent] || agent;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

// Models write markdown; rendering it as literal asterisks and hyphens wastes
// structure the model already provided. Everything is escaped first and only
// then given tags, so no model output can inject markup.
function formatInline(value = "") {
  return esc(value)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "<em>$1</em>");
}

const LIST_ITEM = /^\s*(?:[-*•·]|\d+[.)]|[（(]\d+[）)])\s+(.*)$/;

// Turns a model's prose into paragraphs and lists. An ordered source list stays
// ordered, because in compliance guidance the sequence usually carries meaning.
function formatBlock(value = "") {
  const lines = String(value).split(/\r?\n/);
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`); list = null; } };
  for (const line of lines) {
    const match = line.match(LIST_ITEM);
    if (match) {
      const ordered = /^\s*(?:\d+[.)]|[（(]\d+[）)])/.test(line);
      const tag = ordered ? "ol" : "ul";
      if (!list || list.tag !== tag) { closeList(); list = { tag, items: [] }; }
      list.items.push(`<li>${formatInline(match[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim()) out.push(`<p>${formatInline(line)}</p>`);
  }
  closeList();
  return out.join("") || `<p>${formatInline(value)}</p>`;
}

// An array item that already carries its own marker would otherwise be numbered
// twice once the interface adds its own.
function stripMarker(value = "") {
  return String(value).replace(LIST_ITEM, "$1").trim();
}

function accessHeaders() {
  const password = localStorage.getItem("compliance-access-password") || "";
  return password ? { "x-access-password": password } : {};
}

// One enquiry is one thread. A follow-up must join the question that prompted
// it, otherwise the history lists unrelated cases that merely share a topic.
function ensureThreadId() {
  if (!state.threadId) state.threadId = `TH-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;
  return state.threadId;
}

function getConfig() {
  if (state.serverModelConfigured) return {};
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


function renderGemNav() {
  const pinned = workspaceGemIds();
  // The sidebar is the workspace, not the catalogue — the palette is the
  // catalogue. Showing all eight here made pinning meaningless, because it only
  // reordered a list that already held everything.
  const shown = GEMS.filter((gem) => pinned.includes(gem.id) || state.activeGem?.id === gem.id);
  $("gemNav").innerHTML = shown.length
    ? shown.map((gem) => `
      <li>
        <button type="button" data-gem="${gem.id}" class="${state.activeGem?.id === gem.id ? "active" : ""}" title="${esc(localized(gem.name))} ${esc(gem.command)}">
          ${gemIconMarkup(gem)}
          <span class="gem-name">${esc(localized(gem.name))}</span>
        </button>
      </li>`).join("")
    : `<li class="gem-nav-empty">${esc(t("workspaceEmpty"))}</li>`;
}

// The pipeline the question actually travels, drawn from the same tokens as
// everything else. Decoration that states something true about the system beats
// decoration that just fills space.
function renderCaseNav() {
  const threads = state.cases || [];
  $("caseNav").innerHTML = threads.length
    ? threads.slice(0, 12).map((item) => `
      <li><button type="button" data-case="${esc(item.threadId)}" class="${state.threadId === item.threadId ? "active" : ""}" title="${esc(item.title)}">
        <span class="case-risk risk-${esc(item.overallRisk)}" aria-hidden="true"></span>
        <span class="case-text">
          <span class="case-q">${esc(item.title)}</span>
          <span class="case-when">${esc(String(item.updatedAt).slice(5, 16).replace("T", " "))}${item.turnCount > 1 ? ` · ${item.turnCount} ${esc(t("turnUnit"))}` : ""}</span>
        </span>
      </button></li>`).join("")
    : `<li class="case-empty">${esc(t("historyEmpty"))}</li>`;
}

async function loadCases() {
  try {
    const response = await fetch("/api/threads?limit=20");
    if (!response.ok) return;
    state.cases = (await response.json()).threads || [];
    renderCaseNav();
  } catch (error) {
    console.error("Case history load failed:", error);
  }
}

async function openCase(id) {
  try {
    const response = await fetch(`/api/threads/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("not found");
    const record = await response.json();
    if (!record.turns?.length) throw new Error("empty");

    // Reopening resumes the enquiry rather than starting a new one, so a
    // further follow-up joins the same thread.
    state.threadId = record.threadId;
    state.declaredFacts = record.turns.at(-1)?.declaredFacts || {};
    state.conversation = [];
    $("threadInner").innerHTML = "";
    $("startPanel").classList.add("hidden");

    let last = null;
    for (const turn of record.turns) {
      $("threadInner").insertAdjacentHTML("beforeend",
        `<article class="msg msg-user"><div class="bubble">${esc(turn.question || "")}</div></article>`);
      const node = document.createElement("article");
      node.className = "msg msg-assistant";
      node.id = `answer-${turn.id}`;
      node.innerHTML = answerMarkup(turn);
      $("threadInner").appendChild(node);
      hydrateBars(node);
      state.conversation.push({ role: "user", content: turn.question || "" });
      state.conversation.push({ role: "assistant", content: `${turn.synthesis?.headline || ""}\n${turn.synthesis?.executiveSummary || ""}` });
      last = turn;
    }
    renderEvidence(last?.sources || []);
    // A reopened case shows the flow it reached, not an empty rail.
    renderFlowPanel(last?.analysisPath);
    renderCaseNav();
    closeDrawer();
    $("threadInner").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch { toast(t("historyOpenFailed")); }
}

function renderHeroFigure() {
  const lanes = [
    { key: "trade", label: "Trade" },
    { key: "product", label: "Product" },
    { key: "tpdd", label: "Ethics & TPDD" }
  ];
  $("heroFigure").innerHTML = `
    <div class="hf-col hf-in"><span class="hf-node">${esc(t("hfQuestion"))}</span></div>
    <div class="hf-fan" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="hf-col hf-agents">${lanes.map((lane) => `
      <span class="hf-node hf-agent lane-${lane.key}"><em></em>${esc(lane.label)}</span>`).join("")}</div>
    <div class="hf-fan hf-fan-in" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="hf-col hf-out"><span class="hf-node hf-answer">${esc(t("hfAnswer"))}</span></div>
    <div class="hf-codes" aria-hidden="true">4A090.a · 1C117.d · 5A002.a.1 · 3A090.b · 3C004.a · EAR 734 · EAR 744</div>`;
}

// One tile per registered source, tinted by what it is actually doing. The data
// layer is the substance of this product, so it is worth seeing at a glance.
function renderSourceMosaic() {
  const data = state.coverage;
  if (!data) { $("sourceMosaic").innerHTML = ""; return; }
  const groups = [
    { key: "US", label: t("mosaicUs") },
    { key: "CN", label: t("mosaicCn") },
    { key: "other", label: t("mosaicOther") }
  ];
  const bucket = (source) => (source.country === "US" || source.country === "CN" ? source.country : "other");
  const tone = (status) => ({ success: "live", fallback_snapshot: "fallback", failed: "failed", syncing: "syncing" }[status] || "idle");

  $("sourceMosaic").innerHTML = groups.map((group) => {
    const sources = data.sources.filter((source) => bucket(source) === group.key);
    if (!sources.length) return "";
    const live = sources.filter((source) => ["success", "fallback_snapshot"].includes(source.sync?.status)).length;
    return `
      <div class="mosaic-group">
        <div class="mosaic-head"><span>${esc(group.label)}</span><b>${live}/${sources.length}</b></div>
        <div class="mosaic-tiles">${sources.map((source) => `
          <a class="tile tone-${tone(source.sync?.status)}" href="/data-sources.html"
             title="${esc(source.sourceId)} · ${esc(source.sync?.status || "not_synced")}${source.sync?.recordCount ? ` · ${source.sync.recordCount}` : ""}"></a>`).join("")}</div>
      </div>`;
  }).join("");
}

function renderStartPanel() {
  renderHeroFigure();
  renderSourceMosaic();
  $("startTeach").innerHTML = `
    <div class="teach-row">
      <kbd>/</kbd>
      <div><strong>${esc(t("teachSlashTitle"))}</strong><span>${esc(t("teachSlashBody").replace("{n}", GEMS.length))}</span></div>
    </div>
    <div class="teach-row">
      <span class="teach-pin" aria-hidden="true">★</span>
      <div><strong>${esc(t("teachPinTitle"))}</strong><span>${esc(t("teachPinBody"))}</span></div>
    </div>`;

  // Example questions rather than gem names: something to click that the
  // sidebar and the palette do not already offer.
  const picks = ["T03", "DM1", "P03", "X01"]
    .map((id) => scenarios[state.locale].find((item) => item.id === id)).filter(Boolean);
  $("starterGrid").innerHTML = picks.map((item) => `
    <button type="button" class="starter" data-starter="${esc(item.id)}">
      <strong>${esc(item.title)}</strong>
      <small>${esc(item.meta)}</small>
    </button>`).join("");
}

// The gem row lives inside the composer box, so the required facts collapse to
// a counter by default and the input never changes height when a gem changes.
function renderActiveGem() {
  const host = $("gemRow");
  if (state.sourceQuery) {
    const source = state.sourceQuery;
    host.classList.remove("hidden");
    host.innerHTML = `
      <span class="src-icon" aria-hidden="true">⛁</span>
      <span class="gem-row-name">${esc(source.sourceName)}</span>
      <code>@${esc(source.sourceId)}</code>
      <span class="src-meta">${Number(source.sync.recordCount || 0).toLocaleString()} ${esc(t("gemRecordsUnit"))} · ${esc(String(source.sync.completedAt || source.sync.bundledAt || "").slice(0, 10))}</span>
      <button type="button" class="gem-drop" data-source-drop aria-label="close">
        <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>`;
    renderGemNav();
    return;
  }
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
    <button type="button" class="gem-drop" data-gem-detail="${gem.id}" title="${esc(t("gemDetail"))}" aria-label="${esc(t("gemDetail"))}">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
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

// Two palettes share one surface: / picks a gem, @ picks a data source to query
// directly. A point lookup — which entities does this notice name, what does
// this provision say — should not have to travel through the whole analysis.
function sourceQueryTrigger() {
  const match = $("questionInput").value.match(/^@([\w-]*)$/);
  return match ? match[1] : null;
}

function queryableSources() {
  return (state.coverage?.sources || [])
    .filter((source) => ["success", "fallback_snapshot"].includes(source.sync?.status))
    .sort((left, right) => (right.sync.recordCount || 0) - (left.sync.recordCount || 0));
}

function openSourcePalette(query) {
  const needle = String(query || "").toLowerCase();
  const items = queryableSources().filter((source) =>
    !needle || source.sourceId.includes(needle) || (source.sourceName || "").toLowerCase().includes(needle));
  state.palette = { open: true, mode: "source", items, index: 0 };
  renderSourcePalette();
}

function renderSourcePalette() {
  const host = $("palette");
  const { items, index } = state.palette;
  host.classList.remove("hidden");
  if (!items.length) { host.innerHTML = `<div class="palette-empty">${esc(t("noQueryableSource"))}</div>`; return; }
  const groups = [["CN", t("mosaicCn")], ["US", t("mosaicUs")], ["other", t("mosaicOther")]];
  const bucket = (source) => (source.country === "US" || source.country === "CN" ? source.country : "other");
  host.innerHTML = groups.map(([key, label]) => {
    const inGroup = items.filter((source) => bucket(source) === key);
    if (!inGroup.length) return "";
    return `<div class="palette-group">
      <div class="palette-group-label">${esc(label)}</div>
      ${inGroup.map((source) => `
        <button type="button" class="palette-item ${items.indexOf(source) === index ? "active" : ""}" data-source="${esc(source.sourceId)}">
          <span class="src-dot ${source.sync.status === "fallback_snapshot" ? "warn" : "ok"}" aria-hidden="true"></span>
          <span><strong>${esc(source.sourceName)}</strong><small>${esc(source.authority)}</small></span>
          <span class="src-count">${Number(source.sync.recordCount || 0).toLocaleString()}</span>
        </button>`).join("")}
    </div>`;
  }).join("") + `<div class="palette-foot"><span>${esc(t("paletteNav"))}</span><span>${esc(t("paletteEnter"))}</span><span>${esc(t("sourceQueryHint"))}</span></div>`;
  host.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
}

function activateSourceQuery(sourceId, prefill = "") {
  const source = (state.coverage?.sources || []).find((item) => item.sourceId === sourceId);
  if (!source) return;
  state.sourceQuery = source;
  state.activeGem = null;
  closePalette();
  $("questionInput").value = prefill;
  $("questionInput").placeholder = t("sourceQueryPlaceholder");
  renderActiveGem();
  updateRouteHint();
  $("questionInput").focus();
}

function clearSourceQuery() {
  state.sourceQuery = null;
  $("questionInput").placeholder = t("placeholder");
  renderActiveGem();
  updateRouteHint();
}

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
          <span class="palette-pin ${workspaceGemIds().includes(gem.id) ? "on" : ""}" data-pin="${gem.id}" role="button" tabindex="-1"
                title="${esc(t(workspaceGemIds().includes(gem.id) ? "gemRemove" : "gemAdd"))}">★</span>
        </button>`).join("")}
    </div>`).join("")
    + `<div class="palette-foot"><span>${t("paletteNav")}</span><span>${t("paletteEnter")}</span><span>${t("paletteEsc")}</span></div>`;
  host.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
}

function movePalette(step) {
  const { items, mode } = state.palette;
  if (!items.length) return;
  state.palette.index = (state.palette.index + step + items.length) % items.length;
  if (mode === "source") renderSourcePalette(); else renderPalette();
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
      <div class="gem-spec-row"><dt>${t("gemBacking")}</dt><dd>${gemBackingMarkup(gem)}</dd></div>
    </dl>
    <div class="card-actions">
      <button class="btn" data-toggle-workspace="${gem.id}" type="button">${pinned ? t("gemRemove") : t("gemAdd")}</button>
      <button class="btn btn-primary" data-use-gem="${gem.id}" type="button">${t("gemUse")}</button>
    </div>`;
  $("gemDialog").showModal();
}

/* ----------------------------------------------------------- rendering */

function riskLabel(level) { return t(`risk${level.charAt(0).toUpperCase()}${level.slice(1)}`); }

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
  document.querySelector(".slash-hint").classList.toggle("hidden", Boolean(state.sourceQuery));
  if (state.sourceQuery) { host.innerHTML = `<span>${esc(t("lookupMode"))}</span>`; return; }
  if (!value) { host.innerHTML = ""; return; }
  const agents = estimatedRoute(value);
  host.innerHTML = `<span>${t("routeLabel")}</span>${agents.map((a) => `<span class="route-tag">${agentName(a)}</span>`).join("")}`;
}

// The Content-Security-Policy is `style-src 'self'`, which bars style attributes
// outright — a width written into markup is silently dropped, so every bar sat at
// full width. Setting it through the CSSOM is not inline style and is allowed, so
// bars are hydrated after their markup lands. Cheap, and it keeps the policy
// strict rather than opening it up with 'unsafe-inline'.
function hydrateBars(root = document) {
  root.querySelectorAll("[data-bar]").forEach((node) => {
    node.style.setProperty("--pct", `${Math.max(0, Math.min(100, Number(node.dataset.bar) || 0))}%`);
  });
}

// The right column holds two views of the same run — where the analysis is, and
// what it stands on — so they are tabs rather than a stack. The flow is the
// default because "which step are we on" is the question asked most often, and
// the panel starts open: a panel that has to be found first is not a panel.
function setPanelTab(tab) {
  // Not persisted: every load opens on the flow. Which tab someone last looked
  // at is a weaker signal than "where is this analysis now", which is the
  // question the panel exists to answer.
  state.panelTab = tab === "evidence" ? "evidence" : "flow";
  $("evidencePanel").classList.toggle("show-evidence", state.panelTab === "evidence");
  $("tabFlow").setAttribute("aria-selected", String(state.panelTab === "flow"));
  $("tabEvidence").setAttribute("aria-selected", String(state.panelTab === "evidence"));
}

// The flow rail: every step of the path as a node, so what has run, what is
// running and what has not been reached is answerable at a glance. The body of
// the answer only carries steps that have executed, and this is where the rest
// of the plan stays visible.
const FLOW_STATE = {
  confirmed: { cls: "done", mark: "✓" },
  declared: { cls: "declared", mark: "◐" },
  evidence_needed: { cls: "blocked", mark: "!" },
  review_required: { cls: "review", mark: "▲" },
  not_reached: { cls: "todo", mark: "" },
  pending: { cls: "todo", mark: "" }
};

function renderFlowPanel(path, options = {}) {
  const panel = $("flowPanel");
  const markup = flowMarkup(path, options);
  const steps = (path?.lanes || []).flatMap((lane) => lane.steps);
  const executed = steps.filter((item) => item.status !== "pending" && item.status !== "not_reached").length;
  $("flowCount").textContent = steps.length ? `${executed}/${steps.length}` : "";
  panel.innerHTML = markup || `<p class="evidence-empty">${esc(t("flowEmpty"))}</p>`;
  hydrateBars(panel);
  // Below the breakpoint that hides the right column the rail has to live
  // somewhere, so the same markup is mirrored into the answer and CSS picks one.
  document.querySelectorAll(".flow-inline").forEach((host) => { host.innerHTML = markup; hydrateBars(host); });
}

function flowMarkup(path, options = {}) {
  if (!path?.lanes?.length) return "";
  const steps = path.lanes.flatMap((lane) => lane.steps);
  const executed = steps.filter((item) => item.status !== "pending" && item.status !== "not_reached").length;
  const asking = firstBlockedStep(path);
  const percent = Math.round((executed / steps.length) * 100);

  return `
    <div class="flow-head">
      <h3>${esc(t("flowTitle"))}</h3>
      <span class="flow-count">${executed}/${steps.length}</span>
    </div>
    <div class="flow-bar" role="img" aria-label="${executed}/${steps.length}">
      <span class="fb-fill" data-bar="${percent}"></span>
    </div>
    ${path.lanes.map((lane) => {
      const laneSteps = lane.steps;
      const laneDone = laneSteps.filter((item) => item.status !== "pending" && item.status !== "not_reached").length;
      const running = options.activeLane === lane.lane;
      return `
      <section class="flow-lane ${running ? "running" : ""}">
        <div class="fl-head">
          <span class="fl-label">${esc(lane.label)}</span>
          <span class="fl-progress">${laneDone}/${laneSteps.length}</span>
        </div>
        <ol class="fl-steps">${laneSteps.map((item) => {
          const shape = FLOW_STATE[item.status] || FLOW_STATE.pending;
          const current = item.id === asking;
          return `
          <li class="fl-step ${shape.cls} ${current ? "current" : ""}">
            <button type="button" data-flow-step="${esc(item.id)}" title="${esc(label(STEP_STATUS_VOCAB, item.status, state.locale))}">
              <span class="fl-node" aria-hidden="true">${shape.mark}</span>
              <span class="fl-text">${esc(item.title)}</span>
            </button>
          </li>`;
        }).join("")}</ol>
      </section>`;
    }).join("")}
    <div class="flow-legend">
      <span class="fl-key done">✓ ${esc(t("stConfirmed"))}</span>
      <span class="fl-key blocked">! ${esc(t("stEvidence"))}</span>
      <span class="fl-key todo">○ ${esc(t("stNotReached"))}</span>
    </div>`;
}

function renderEvidence(sources) {
  $("sourceCount").textContent = sources.length;
  if (!sources.length) { $("evidenceList").innerHTML = `<p class="evidence-empty">${t("evidenceEmpty")}</p>`; return; }
  const statusKey = (source) => (source.liveStatus === "cached" && source.stale ? "cached_stale" : source.liveStatus);
  const statusLabel = (source) => label(EVIDENCE_STATUS, statusKey(source), state.locale);
  $("evidenceList").innerHTML = sources.map((source) => `
    <article class="source-card">
      <div class="authority">${esc(source.authority)}</div>
      <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>
      <div class="source-meta">
        <span class="source-status tone-${esc(tone(EVIDENCE_STATUS, statusKey(source)))}">${esc(statusLabel(source))}</span>
        ${source.cacheAge ? `<span class="source-age">${esc(source.cacheAge)}</span>` : ""}
        <time>${source.retrievedAt ? new Date(source.retrievedAt).toLocaleTimeString(state.locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</time>
      </div>
    </article>`).join("");
}

// What a reviewer needs, in the order they need it: the call, then the gaps
// that block it, then what to do, then the trace. Missing information and
// recommended actions used to be buried inside the collapsed trace, which is
// where the eye goes last — they are the actionable part, so they come up.



function comparisonTable(comparisons) {
  if (!comparisons?.length) return "";
  return `<div class="cmp-table">${comparisons.map((row) => `
    <div class="cmp-row cmp-${esc(row.status)}">
      <span class="cmp-el">${esc(t(`el_${row.element}`))}</span>
      <span class="cmp-status">${esc(t(`st_${row.status}`))}</span>
      <span class="cmp-values"><b>${esc(row.queryValue ?? "—")}</b><i>vs</i>${esc(row.recordValue ?? "—")}</span>
    </div>`).join("")}</div>`;
}

// A blocked step can be answered in place. What the user types is a declaration,
// never verified evidence — the status it produces says so, and the action list
// then asks for it to be verified.
function stepInputsMarkup(item) {
  return `
    <div class="step-inputs" data-step="${esc(item.id)}">
      ${item.inputs.map((input) => input.kind === "choice"
        ? `<div class="si-row">
             <span class="si-label">${esc(input.label)}</span>
             <div class="si-choices">${input.options.map((option) => `
               <button type="button" class="si-choice" data-field="${esc(input.field)}" data-value="${esc(option)}">${esc(option)}</button>`).join("")}</div>
           </div>`
        : `<div class="si-row">
             <span class="si-label">${esc(input.label)}</span>
             <input class="si-text" type="text" data-field="${esc(input.field)}" maxlength="300" placeholder="${esc(t("declarePlaceholder"))}">
           </div>`).join("")}
      <div class="si-actions">
        <button type="button" class="btn btn-primary si-submit">${esc(t("declareSubmit"))}</button>
        <button type="button" class="btn si-skip">${esc(t("declareSkip"))}</button>
        <span class="si-note">${esc(t("declareNote"))}</span>
      </div>
      <div class="si-skipped">
        <span class="si-skipped-text">${esc(t("declareSkipped"))}</span>
        <button type="button" class="si-reopen">${esc(t("declareReopen"))}</button>
      </div>
    </div>`;
}

// The path is the whole progress display, not a summary printed next to one.
// Showing a stage list, a planned path and a set of agent panels side by side
// made three renderings of one process, and none of them read as the sequence
// the work actually follows.
//
// Expansion follows position in that sequence: what is settled or waiting on the
// user is open, what has not been reached is a collapsed line. Only the first
// step that needs input carries a form — six forms at once is not a sequence, and
// the request was to answer one thing and continue.
function firstBlockedStep(path) {
  for (const lane of path?.lanes || []) {
    for (const item of lane.steps) {
      if (item.status === "evidence_needed" && item.inputs?.length) return item.id;
    }
  }
  return null;
}

// "Why these steps" answered from data the plan already carries: which words in
// the question selected the check, which published procedure supplies its steps,
// and which steps had no provision and were planned by the system.
function derivationMarkup(path) {
  const rows = path?.derivation || [];
  if (!rows.length) return "";
  return `
    <details class="path-derivation" open>
      <summary>${esc(t("derivTitle"))}<span class="trace-count">${rows.length}</span></summary>
      <div class="deriv-body">
        ${rows.map((row) => `
        <section class="deriv-flow">
          <div class="df-head">
            <strong>${esc(row.label)}</strong>
            ${row.leading ? `<span class="df-lead">${esc(t("derivLead"))}</span>` : ""}
            <span class="df-steps">${row.stepCount} ${esc(t("derivSteps"))}</span>
          </div>
          <dl class="df-rows">
            <div><dt>${esc(t("derivMatched"))}</dt><dd>${row.matchedTerms.length
              ? row.matchedTerms.map((term) => `<code>${esc(term)}</code>`).join(" ")
              : esc(t(`derivMatch_${row.matchedBy}`))}</dd></div>
            <div><dt>${esc(t("derivStandard"))}</dt><dd>${row.methodology
              ? `${row.methodology.url
                  ? `<a href="${esc(row.methodology.url)}" target="_blank" rel="noopener noreferrer">${esc(row.methodology.label)}</a>`
                  : esc(row.methodology.label)}
                 ${row.methodology.authority ? `<span class="df-auth">${esc(row.methodology.authority)}</span>` : ""}
                 <span class="df-kind ${esc(row.methodology.kind)}">${esc(t(`derivKind_${row.methodology.kind}`))}</span>`
              : esc(t("derivKind_derived"))}</dd></div>
            <div><dt>${esc(t("derivBreakdown"))}</dt><dd>
              ${row.officialStepCount ? `<span class="df-official">${esc(t("derivFromStandard").replace("{n}", row.officialStepCount))}</span>` : ""}
              ${row.plannedStepCount ? `<span class="df-planned">${esc(t("derivFromSystem").replace("{n}", row.plannedStepCount))}${row.plannedSteps.length ? `：${row.plannedSteps.map(esc).join("、")}` : ""}</span>` : ""}
            </dd></div>
          </dl>
        </section>`).join("")}
      </div>
    </details>`;
}

function pathMarkup(path, grounding, options = {}) {
  if (!path?.lanes?.length) return "";
  const s = path.summary;
  const blocked = options.allowInput === false ? null : firstBlockedStep(path);
  const activeLane = options.activeLane || null;
  const doneLanes = options.doneLanes || new Set();
  return `
    <details class="trace analysis-path" open>
      <summary>${esc(t(options.allowInput === false ? "pathPlanning" : "pathTitle"))}
        <span class="path-summary">
          ${s.pending ? `<span class="ps pending">○ ${s.pending} ${esc(label(STEP_STATUS_VOCAB, "pending", state.locale))}</span>` : ""}
          ${s.confirmed ? `<span class="ps ok">✓ ${s.confirmed} ${esc(label(STEP_STATUS_VOCAB, "confirmed", state.locale))}</span>` : ""}
          ${s.declared ? `<span class="ps declared">◐ ${s.declared} ${esc(t("stDeclared"))}</span>` : ""}
          ${s.evidenceNeeded ? `<span class="ps warn">! ${s.evidenceNeeded} ${esc(t("stEvidence"))}</span>` : ""}
          ${s.notReached ? `<span class="ps muted">· ${s.notReached} ${esc(t("stNotReached"))}</span>` : ""}
        </span>
      </summary>
      <div class="trace-body">
        ${path.templated ? `<p class="path-templated">${esc(t("pathTemplated"))}</p>` : ""}
        <div class="flow-inline">${flowMarkup(path, options)}</div>
        ${derivationMarkup(path)}
        ${path.lanes.filter((lane) => {
          // The closing step is only shown once there is something to close. With
          // items outstanding it appeared in the body while the foot of the answer
          // said the analysis was not concluded — the same word twice, meaning
          // opposite things. Until then it lives in the flow rail as a node ahead.
          if (lane.lane !== "review") return true;
          return !blocked && !path.lanes.some((group) => group.steps.some((item) => item.status === "evidence_needed"));
        }).map((lane) => {
          const running = lane.lane === activeLane;
          const laneState = running ? "running" : doneLanes.has(lane.lane) ? "done" : options.allowInput === false ? "queued" : "";
          return `
        <section class="path-lane ${laneState}" data-lane="${esc(lane.lane)}">
          <div class="path-lane-label">
            ${esc(lane.label)}
            ${running ? `<span class="thinking-dot" aria-hidden="true"></span><span class="lane-state">${esc(t("laneRunning"))}</span>` : ""}
            ${laneState === "queued" ? `<span class="lane-state">${esc(t("laneQueued"))}</span>` : ""}
          </div>
          <ol class="path-steps">${lane.steps.filter((item) => {
            // Only what has actually run. A plan of twelve steps rendered in full
            // before any of them executed is what made the state unreadable; the
            // ones still ahead are in the flow rail, where they belong.
            const reached = item.status !== "not_reached" && item.status !== "pending";
            return reached || item.id === blocked;
          }).map((item) => {
            const stepTone = tone(STEP_STATUS_VOCAB, item.status);
            const mark = STEP_STATUS_VOCAB[item.status]?.mark || "·";
            const asking = item.id === blocked;
            const reached = item.status !== "not_reached" && item.status !== "pending";
            const open = asking || reached;
            const waiting = Boolean(blocked) && !reached;
            return `
            <li class="path-step tone-${stepTone} ${open ? "open" : "shut"} ${asking ? "asking" : ""}" data-step-id="${esc(item.id)}">
              <span class="step-mark" aria-hidden="true">${mark}</span>
              <div class="step-body">
                <button type="button" class="step-head" data-step-toggle aria-expanded="${open}">
                  <strong>${esc(item.title)}</strong>
                  <span class="step-status">${esc(waiting ? t("stAfterInput") : label(STEP_STATUS_VOCAB, item.status, state.locale))}</span>
                  ${item.cite ? `<span class="step-cite ${item.methodology === "derived" ? "derived" : ""}" title="${esc(item.citeNote || "")}">${esc(item.cite)}</span>` : ""}
                  ${asking ? `<span class="step-asking">${esc(t("stAsking"))}</span>` : ""}
                </button>
                <div class="step-detail-wrap">
                  ${item.basis.length ? `<ul class="step-basis">${item.basis.map((line) => {
                    const sourceRef = String(line).match(/^([a-z0-9-]{4,32})[：:]/);
                    const known = sourceRef && (state.coverage?.sources || []).some((source) => source.sourceId === sourceRef[1]);
                    return `<li>${formatInline(line)}${known ? ` <button type="button" class="jump-source" data-jump-source="${esc(sourceRef[1])}" title="${esc(t("jumpSource"))}">⛁</button>` : ""}</li>`;
                  }).join("")}</ul>` : ""}
                  ${/* What a step is missing belongs to the step, not to a list
                        further down the page. Keeping them apart meant reading
                        the same items twice and jumping between two places to act
                        on them; the path already orders the work by dependency,
                        which is what the separate list was for. */ ""}
                  ${item.needs.length ? `<ul class="step-needs">${item.needs.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>` : ""}
                  ${stepDetailMarkup(item, grounding)}
                  ${asking ? stepInputsMarkup(item) : ""}
                </div>
              </div>
            </li>`;
          }).join("")}</ol>
          ${(() => {
            const ahead = lane.steps.filter((item) => (item.status === "not_reached" || item.status === "pending") && item.id !== blocked);
            return ahead.length ? `<p class="lane-ahead">${esc(t("laneAhead").replace("{n}", ahead.length))} ${ahead.map((item) => esc(item.title)).join(" · ")}</p>` : "";
          })()}
          ${/* The specialist's reasoning appears under the steps it is producing,
                so nothing a reader has already acted on is written over from
                above. */ ""}
          <div class="lane-stream" data-lane-stream="${esc(lane.lane)}"></div>
        </section>`;
        }).join("")}
        ${grounding?.limitations?.length ? `<div class="path-limits">
          <div class="pl-label">${esc(t("limitations"))}<span class="trace-count">${grounding.limitations.length}</span></div>
          <ul>${grounding.limitations.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>
        </div>` : ""}
      </div>
    </details>`;
}

// Detail that used to sit in a separate "comparison" section now sits in the
// step it belongs to. Four collapsible blocks saying overlapping things was the
// reason nothing read as the point.
function stepDetailMarkup(item, grounding) {
  if (!grounding) return "";

  if (item.id === "identity_resolution") {
    const internal = (grounding.internalParties || []).flatMap((entry) => entry.internalMatches || []);
    if (!internal.length) return "";
    return internal.map((party) => `
      <div class="step-detail">
        <div class="sd-head">
          <span>${esc(party.entityName)}</span><i>vs</i><span>${esc(party.designatedEntity || "—")}</span>
          ${party.designationNoticeNumber ? `<code>${esc(party.designationNoticeNumber)}</code>` : ""}
        </div>
        ${comparisonTable(party.identityComparisons)}
      </div>`).join("");
  }

  if (item.id === "name_match") {
    const matches = grounding.listMatches || [];
    if (!matches.length) return "";
    return `<div class="step-detail">${matches.slice(0, 4).map((match) => `
      <div class="sd-match">
        <strong>${esc(match.entityName || match.matchedName)}</strong>
        ${match.entityNameEn ? `<span>${esc(match.entityNameEn)}</span>` : ""}
        <code>${esc(match.sourceId)}</code>
        <span class="sd-score">${esc(t("rsScore"))} ${match.matchScore}</span>
        ${match.sourceUrl ? `<a href="${esc(match.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("rsOpen"))}</a>` : ""}
      </div>`).join("")}</div>`;
  }

  if (item.id === "classify" || item.id === "jurisdiction") {
    const facts = (grounding.facts || []).filter((fact) => /eccn|tpp|管制编码|分类|原产|含量/i.test(fact.fact || ""));
    if (!facts.length) return "";
    return `<div class="step-detail"><ul class="sd-facts">${facts.slice(0, 3).map((fact) => `
      <li><code>${esc(fact.sourceId)}</code>${formatInline(String(fact.fact).slice(0, 200))}</li>`).join("")}</ul></div>`;
  }

  return "";
}

// An outstanding item means the analysis is not finished, so it does not present
// a conclusion as if it were. The verdict on incomplete facts is still shown —
// withholding it would hide the reasoning that has been done — but it is labelled
// as interim and folded away, and what leads is the request for what is missing.
function conclusionMarkup(data) {
  const synthesis = data.synthesis;
  const steps = (data.analysisPath?.lanes || []).flatMap((lane) => lane.steps);
  const outstanding = steps.filter((item) => item.status === "evidence_needed");
  const askingId = firstBlockedStep(data.analysisPath);
  const asking = steps.find((item) => item.id === askingId);
  const suggested = data.actionPlan?.suggested || [];

  const verdict = `
    <div class="answer-head">
      <span class="risk-mark risk-${esc(synthesis.overallRisk)}">${esc(riskLabel(synthesis.overallRisk))}</span>
      <div>
        <h3>${esc(synthesis.headline)}</h3>
        <div class="prose">${formatBlock(synthesis.executiveSummary)}</div>
      </div>
    </div>`;

  if (!outstanding.length) {
    return `<section class="answer">${verdict}
      ${suggested.length ? `<details class="plan-extra"><summary>${esc(t("planSuggested"))}<span class="trace-count">${suggested.length}</span></summary>
        <ul>${suggested.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul></details>` : ""}
    </section>`;
  }

  return `
    <section class="answer answer-open">
      <div class="open-head">
        <span class="risk-mark risk-unknown">…</span>
        <div>
          <h3>${esc(t("notClosed").replace("{n}", outstanding.length))}</h3>
          <p class="open-lead">${esc(t("notClosedLead"))}</p>
          ${asking ? `<button type="button" class="btn btn-primary" data-goto-step="${esc(asking.id)}">${esc(t("notClosedGo"))}${esc(asking.title)}</button>` : ""}
        </div>
      </div>
      <details class="interim">
        <summary>${esc(t("interimVerdict"))}</summary>
        <div class="interim-body">${verdict}
          ${suggested.length ? `<ul class="interim-suggested">${suggested.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>` : ""}
        </div>
      </details>
    </section>`;
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

        ${/* The conclusion is last, where the work ends. Printing it first meant
              reading the verdict, then the reasoning that produced it, then
              scrolling back — and it put the synthesis text far from where it had
              streamed. Everything now runs in one direction. */ ""}
        ${pathMarkup(data.analysisPath, data.grounding, { allowInput: true })}

        ${conclusionMarkup(data)}

        <details class="trace">
          <summary>${t("specialistTrace")}<span class="trace-count">${data.results.length}</span></summary>
          <div class="trace-body">${data.results.map((result) => `
            <section class="trace-agent">
              <div class="trace-agent-head">
                <strong>${agentName(result.agent)}</strong>
                <span class="risk-chip risk-${esc(result.riskLevel)}">${esc(riskLabel(result.riskLevel))}</span>
              </div>
              <div class="prose">${formatBlock(result.summary)}</div>
              <ul class="trace-findings">${(result.findings || []).map((finding) => `
                <li><b>${esc(finding.title)}</b> <span class="finding-detail">${formatInline(finding.detail)}</span><span class="cite">${(finding.evidenceSourceIds || []).map((id) => `<span>${esc(id)}</span>`).join("")}</span></li>`).join("")}</ul>
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
      <p class="live-steps" data-live-steps></p>
      <div data-live-path></div>
      <div class="live-agents" data-live-agents></div>
    </div>`;
  $("threadInner").appendChild(node);
  node.scrollIntoView({ behavior: "smooth", block: "end" });
  return node;
}

// The stage checklist was a second progress display sitting directly above the
// flow rail, listing the same run in different words. What it had that the rail
// does not is the pre-analysis phases — retrieval and grounding happen before any
// lane starts — so it collapses to one line naming the current phase.
function renderSteps(node, done, current) {
  // A resumed run writes into an answer that has already been rendered, so the
  // live scaffold is gone. Progress then shows on the path itself.
  const host = node.querySelector("[data-live-steps]");
  if (!host) return;
  host.innerHTML = current
    ? `<span class="tick" aria-hidden="true"></span>${esc(t(`step_${current}`))}`
    : "";
}


/* ------------------------------------------------------------- coverage */

async function loadCoverage() {
  try {
    const response = await fetch("/api/data-sources");
    if (!response.ok) return;
    const data = await response.json();
    state.coverage = data;
    // A snapshot whose refresh failed is still a snapshot with a capture date, so
    // it counts as synced here and its failed refresh is counted separately.
    const synced = data.sources.filter((source) => ["success", "refresh_failed"].includes(source.sync?.status));
    const fallback = data.sources.filter((source) => source.sync?.status === "fallback_snapshot");
    const failed = data.sources.filter((source) => ["failed", "refresh_failed"].includes(source.sync?.status));
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

    renderGemNav();
    renderSourceMosaic();
  } catch (error) {
    // Coverage is informational and the workbench stays usable without it, but
    // swallowing the reason entirely makes a failure here impossible to find.
    console.error("Coverage load failed:", error);
  }
}

/* ------------------------------------------------------------- analysis */

const PARTY_FIELDS = [
  ["entityNameEn", "英文名"], ["commonNames", "常用名"], ["aliases", "别名"],
  ["country", "国别"], ["addresses", "地址"], ["address", "地址"],
  ["registrationNumber", "注册号"], ["noticeNumber", "公告"], ["effectiveFrom", "生效"],
  ["measures", "措施"], ["restrictionType", "限制类型"], ["sourceList", "所属名单"], ["programs", "项目"]
];
const TEXT_FIELDS = [["part", "所属部分"], ["effectiveDate", "版本日期"], ["noticeNumber", "公告"], ["publishedAt", "发布"], ["effectiveFrom", "生效"], ["measureType", "类型"]];

function fieldValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, 4).map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(" · ");
  if (value && typeof value === "object") return JSON.stringify(value).slice(0, 160);
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function recordMarkup(record) {
  const isParty = Boolean(record.entityName || record.entityNameEn);
  const title = record.entityName || record.noticeTitle || record.title || record.recordId || "—";
  const template = isParty ? PARTY_FIELDS : TEXT_FIELDS;
  const rows = template
    .map(([key, label]) => [label, fieldValue(record[key])])
    .filter(([, value]) => value);

  return `
    <article class="rec">
      <div class="rec-head">
        <strong>${esc(title)}</strong>
        ${record.sourceUrl ? `<a href="${esc(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("rsOpen"))}</a>` : ""}
      </div>
      ${rows.length ? `<dl class="rec-fields">${rows.map(([label, value]) => `
        <div><dt>${esc(label)}</dt><dd>${esc(value.slice(0, 220))}</dd></div>`).join("")}</dl>` : ""}
      ${record.relevance ? `<div class="rec-rel">
        <span class="rr-bar" data-bar="${Math.round(Math.min(1, record.relevance.score / 40) * 100)}"></span>
        <span class="rr-terms">${esc(t("relMatched"))} ${record.relevance.matchedTerms.map((term) => `<b>${esc(term)}</b>`).join("")}${record.relevance.missedTerms.length ? `<span class="rr-miss">${esc(t("relMissed"))} ${record.relevance.missedTerms.map(esc).join(" ")}</span>` : ""}</span>
      </div>` : ""}
      ${(record.matchSnippets || []).map((snippet) => `<p class="rec-snippet">${esc(snippet.text)}</p>`).join("")}
      ${record.matchDisposition ? `<div class="rec-warn">${esc(t(`disp_${record.matchDisposition}`) || record.matchDisposition)}</div>` : ""}
    </article>`;
}

async function runSourceQuery(event, options = {}) {
  if (event) event.preventDefault();
  if (state.busy) return;
  const source = options.source || state.sourceQuery;
  // No terms is a request to browse the source rather than an empty query: a list
  // you can page through is how you find out what a source actually holds.
  const query = options.query !== undefined ? options.query : $("questionInput").value.trim();
  const offset = Number(options.offset) || 0;

  $("startPanel").classList.add("hidden");
  if (!options.replace) {
    $("threadInner").insertAdjacentHTML("beforeend",
      `<article class="msg msg-user"><div class="bubble"><span class="gem-tag">@${esc(source.sourceId)}</span><br>${esc(query || t("browseAll"))}</div></article>`);
    $("questionInput").value = "";
  }
  state.busy = true; $("submitBtn").disabled = true;

  try {
    const response = await fetch("/api/data-sources/query", {
      method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() },
      body: JSON.stringify({ sourceId: source.sourceId, query, limit: 20, offset })
    });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { throw new Error(`${t("badResponse")} (HTTP ${response.status})`); }
    if (!response.ok) throw new Error(data.error || t("error"));

    const total = data.kind === "browse" ? data.totalRecords : (data.totalMatches ?? data.records.length);
    const shownTo = offset + data.records.length;
    const stale = data.mode === "bundled_fallback_snapshot";
    const markup = `
      <article class="msg msg-assistant" data-lookup="${esc(source.sourceId)}" data-lookup-query="${esc(query)}" data-lookup-offset="${offset}">
        <span class="avatar" aria-hidden="true">⛁</span>
        <div>
          <div class="msg-meta">
            <span class="tag">@${esc(source.sourceId)}</span><span class="sep">·</span>
            <span>${esc(t(data.kind === "browse" ? "browseCount" : "queryHits").replace("{total}", total))}</span>
            ${total > data.records.length ? `<span class="sep">·</span><span>${offset + 1}–${shownTo}</span>` : ""}
            <span class="sep">·</span>
            <span class="${stale ? "src-stale" : ""}">${esc(stale ? t("sourceArchived") : t("sourceCached"))} ${esc(String(data.capturedAt || "").slice(0, 10))}</span>
          </div>
          ${data.partialMatchesExcluded ? `<p class="msg-note">${esc(t("relPartial").replace("{n}", data.partialMatchesExcluded))}</p>` : ""}
          ${data.records.length
            ? `<div class="rec-list">${data.records.map(recordMarkup).join("")}</div>
               ${total > data.records.length ? `<div class="rec-page">
                   <button type="button" class="btn" data-page="${Math.max(0, offset - 20)}" ${offset === 0 ? "disabled" : ""}>${esc(t("pagePrev"))}</button>
                   <span>${offset + 1}–${shownTo} / ${total}</span>
                   <button type="button" class="btn" data-page="${offset + 20}" ${shownTo >= total ? "disabled" : ""}>${esc(t("pageNext"))}</button>
                 </div>` : ""}
               <div class="rec-actions">
                 ${query ? `<button type="button" class="btn" data-escalate="${esc(query)}">${esc(t("queryEscalate"))}</button>` : ""}
                 ${query ? `<button type="button" class="btn" data-browse="${esc(source.sourceId)}">${esc(t("browseAll"))}</button>` : ""}
               </div>`
            : `<p class="msg-note">${esc(t("queryNoHit"))}</p>
               <div class="rec-actions"><button type="button" class="btn" data-browse="${esc(source.sourceId)}">${esc(t("browseAll"))}</button></div>`}
          <p class="msg-note">${esc(t("queryDisclaimer"))}</p>
        </div>
      </article>`;
    // Paging replaces the panel in place rather than appending another copy of the
    // same lookup, so the thread stays a record of questions, not of clicks.
    if (options.replace) options.replace.outerHTML = markup;
    else $("threadInner").insertAdjacentHTML("beforeend", markup);
    hydrateBars($("threadInner"));
    (options.replace ? $("threadInner").querySelector(`[data-lookup-offset="${offset}"]`) : $("threadInner").lastElementChild)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    toast(`${t("error")}: ${error.message}`);
  } finally {
    state.busy = false; $("submitBtn").disabled = false;
  }
}

// `continueIn` is an answer already on screen. Supplying a fact does not start a
// new analysis of a new question — it is the same analysis carrying on with more
// to work from, so it updates that answer in place. Rendering a second complete
// structure below the first was the reason it read as starting over.
// Section-by-section, so the message keeps its identity and the reader keeps
// their place. Rebuilding the whole node is what made a continuation look like a
// brand new answer appearing.
function patchAnswer(node, data) {
  const replace = (selector, markup) => {
    const target = node.querySelector(selector);
    if (!target) return;
    if (markup) target.outerHTML = markup;
    else target.remove();
  };
  replace(".analysis-path", pathMarkup(data.analysisPath, data.grounding, { allowInput: true }));
  // The conclusion changes shape as items close — an open analysis and a closed
  // one are different blocks — so it is replaced whole rather than patched field
  // by field.
  replace(".answer", conclusionMarkup(data));
}

async function analyze(event, options = {}) {
  if (event) event.preventDefault();
  if (state.busy) return;
  const resuming = options.continueIn || null;
  // A source query is a lookup, not an analysis, so it never reaches the agents.
  if (!resuming && state.sourceQuery) return runSourceQuery(event);   // an empty box browses the source
  closePalette();
  const raw = resuming ? resuming.dataset.question : $("questionInput").value.trim();
  if (!raw || raw.length < 5) return toast(t("invalidQuestion"));
  const gem = resuming ? GEMS.find((item) => item.id === resuming.dataset.gem) || null : state.activeGem;
  const config = getConfig();
  const mock = state.rulesMode;
  if (!mock && !config.apiKey && !state.serverModelConfigured) { toast(t("needKey")); return openSettings(); }
  // The code is checked before the request rather than after: a rejected live
  // call would otherwise land as a failed analysis in the thread.
  if (!mock && state.liveModelBlocked) { toast(t("access_code_unset")); return; }
  if (!mock && state.accessPasswordRequired && !accessHeaders()["x-access-password"]) { toast(t("accessRequired")); return openSettings(); }

  // The gem contributes its instruction and its bound-source whitelist; the
  // user's text stays verbatim so the transcript shows what was actually asked.
  const question = gem
    ? `${localized(gem.instruction)}\n\n${gem.boundSources.length ? `仅使用以下来源作为依据：${gem.boundSources.join(", ")}。\n\n` : ""}${raw}`
    : raw;

  const priorHistory = state.conversation.slice(-6);
  if (!resuming) {
    state.conversation.push({ role: "user", content: question });
    $("startPanel").classList.add("hidden");
    $("threadInner").insertAdjacentHTML("beforeend",
      `<article class="msg msg-user"><div class="bubble">${gem ? `<span class="gem-tag">${esc(gem.command)}</span><br>` : ""}${esc(raw)}</div></article>`);
    $("questionInput").value = "";
    updateRouteHint();
    renderActiveGem();
  }

  state.busy = true;
  $("submitBtn").disabled = true;

  const live = resuming || createLiveMessage();
  if (!resuming) { live.dataset.question = question; live.dataset.gem = gem?.id || ""; }
  live.classList.toggle("resuming", Boolean(resuming));
  const done = new Set();
  const collected = { agents: [], sources: [] };
  // Lane progress is kept outside the DOM so a redraw can restore the streamed
  // text: the path is re-rendered whenever a lane starts or finishes.
  const progress = { activeLane: null, doneLanes: new Set(), text: {}, summary: {} };

  // Lane state and streamed reasoning are written into the path that is already
  // rendered, rather than replacing it. Nothing the reader is looking at moves.
  function markLanes() {
    const path = live.querySelector(".analysis-path");
    if (!path) return;
    for (const laneNode of path.querySelectorAll(".path-lane")) {
      const lane = laneNode.dataset.lane;
      laneNode.classList.toggle("running", lane === progress.activeLane);
      laneNode.classList.toggle("done", progress.doneLanes.has(lane));
      const stream = laneNode.querySelector("[data-lane-stream]");
      if (stream && progress.text[lane] !== undefined) stream.textContent = progress.text[lane];
    }
  }

  function drawPath() {
    if (!collected.path) return;
    // While resuming, the path on screen is the finished one from the previous
    // turn. It is left alone and only its lane states and streaming text are
    // updated, so the reader keeps the steps they were already looking at.
    const host = live.querySelector("[data-live-path]");
    if (!host) return markLanes();
    const openLanes = [...host.querySelectorAll(".path-lane")].filter((lane) => lane.dataset.open === "1").map((lane) => lane.dataset.lane);
    host.innerHTML = pathMarkup(collected.path, collected.grounding, {
      allowInput: false, activeLane: progress.activeLane, doneLanes: progress.doneLanes
    });
    for (const [lane, text] of Object.entries(progress.text)) {
      const target = host.querySelector(`[data-lane-stream="${CSS.escape(lane)}"]`);
      if (target) target.textContent = text;
    }
    for (const lane of openLanes) host.querySelector(`[data-lane="${CSS.escape(lane)}"]`)?.setAttribute("data-open", "1");
  }

  renderSteps(live, done, "routed");

  const onEvent = (event) => {
    if (event.type === "routed") {
      done.add("routed");
      const meta = live.querySelector("[data-live-meta]");
      if (meta) meta.innerHTML =
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
      collected.grounding = event.grounding;
      const g = event.grounding;
      const screened = g.screening?.screenedSources?.length || 0;
      live.querySelector("[data-live-steps]")?.insertAdjacentHTML("afterend",
        `<p class="live-note">${esc(t("groundingNote")
          .replace("{screened}", screened)
          .replace("{matches}", g.listMatchCount)
          .replace("{internal}", g.internalImpactCount))}</p>`);
      renderSteps(live, done, "agents");
    }
    // A specialist gets its panel the moment it starts, so its reasoning can be
    // shown as it is written rather than appearing complete out of nowhere.
    if (event.type === "path") {
      collected.path = event.path;
      drawPath();
      renderFlowPanel(event.path, { activeLane: progress.activeLane });
    }
    if (event.type === "agent_start") {
      // The lane becomes the active one, so the reasoning about to stream lands
      // inside the steps it is reasoning about.
      progress.activeLane = event.agent;
      drawPath();
      renderFlowPanel(collected.path, { activeLane: progress.activeLane });
    }
    // A provider that ignores stream: true degrades to one update at the end,
    // which is indistinguishable from a broken feature unless it is said.
    if (event.type === "stream_mode" && event.streaming === false && !live.querySelector("[data-stream-notice]")) {
      live.querySelector("[data-live-steps]")?.insertAdjacentHTML("afterend",
        `<p class="live-note stream-notice" data-stream-notice>${esc(t("noStreamNotice"))}</p>`);
    }
    if (event.type === "agent_delta") {
      progress.text[event.agent] = event.text;
      // A continuation reads from where it was started: the reasoning appears
      // directly under the values just submitted, not in a lane further up.
      const lane = live.querySelector("[data-resume-stream]") || live.querySelector(`[data-lane-stream="${CSS.escape(event.agent)}"]`);
      if (lane) {
        lane.textContent = event.text;
        // Only follow the stream while the reader is already at the bottom.
        const thread = $("thread");
        if (thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120) thread.scrollTop = thread.scrollHeight;
      }
    }
    if (event.type === "agent") {
      collected.agents.push(event.result);
      progress.doneLanes.add(event.result.agent);
      progress.summary[event.result.agent] = event.result;
      if (progress.activeLane === event.result.agent) progress.activeLane = null;
      drawPath();
      renderFlowPanel(collected.path, { activeLane: progress.activeLane });
    }
    if (event.type === "synthesis_delta") {
      progress.text.review = event.text;
      const lane = live.querySelector("[data-resume-stream]") || live.querySelector('[data-lane-stream="review"]');
      if (lane) {
        lane.textContent = event.text;
        const thread = $("thread");
        if (thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120) thread.scrollTop = thread.scrollHeight;
      }
    }
    if (event.type === "synthesizing") {
      done.add("agents");
      progress.activeLane = "review";
      renderSteps(live, done, "synthesizing");
      drawPath();
      renderFlowPanel(collected.path, { activeLane: progress.activeLane });
    }
  };

  try {
    const response = await fetch("/api/assess/stream", {
      method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() },
      body: JSON.stringify({ question, locale: state.locale, mock, config, history: priorHistory, threadId: ensureThreadId(), gemId: gem?.id || null, declaredFacts: state.declaredFacts })
    });
    if (response.status === 401) { toast(t("accessRequired")); openSettings(); throw new Error(t("accessRequired")); }
    // The server refuses live calls when it has a key but no code to check it
    // against; drop to rules mode so the user has a working path, not an error.
    if (response.status === 503) {
      state.liveModelBlocked = true;
      state.rulesMode = true;
      updateModePill();
      toast(t("access_code_unset"));
      throw new Error(t("access_code_unset"));
    }
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

    if (streamError) throw new Error(i18n[state.locale][streamError.code] || streamError.error);
    if (!finished) throw new Error(t("badResponse"));

    state.conversation.push({ role: "assistant", content: `${finished.synthesis.headline}\n${finished.synthesis.executiveSummary}` });
    live.id = `answer-${finished.id}`;
    // Patching replaces whole sections, which changes their height. The offset of
    // the message is measured across the swap and the scroll corrected by the
    // difference, so the page does not slide under the reader.
    const thread = $("thread");
    const before = live.getBoundingClientRect().top;
    if (resuming) patchAnswer(live, finished);
    else live.innerHTML = answerMarkup(finished);
    const shift = live.getBoundingClientRect().top - before;
    if (resuming && Math.abs(shift) > 1) thread.scrollTop += shift;
    hydrateBars(live);
    renderFlowPanel(finished.analysisPath);
    live.classList.remove("resuming");
    renderEvidence(finished.sources || []);
    // Deliberately no scroll on completion. Output arrives in one direction and
    // the reader is already at the end of it; jumping to the top of the answer, or
    // to a step further up, is the "content moving around" that made the sequence
    // impossible to follow.
    loadCases();
  } catch (error) {
    // A failure part-way through a continuation must not discard the answer the
    // reader already has; the submitted values are re-offered instead.
    if (resuming) {
      live.classList.remove("resuming");
      live.querySelectorAll(".step-inputs.submitted").forEach((host) => host.classList.remove("submitted"));
    } else {
      live.innerHTML = `
        <span class="avatar" aria-hidden="true">CH</span>
        <div><section class="answer"><div class="answer-head">
          <span class="risk-mark risk-unknown">!</span>
          <div><h3>${t("error")}</h3><p>${esc(error.message)}</p></div>
        </div></section></div>`;
    }
    toast(`${t("error")}: ${error.message}`);
  } finally {
    state.busy = false;
    $("submitBtn").disabled = false;
  }
}

function newConversation() {
  renderFlowPanel(null);
  state.conversation = [];
  state.threadId = null;
  state.declaredFacts = {};
  $("threadInner").innerHTML = "";
  $("startPanel").classList.remove("hidden");
  $("questionInput").value = "";
  clearGem();
  renderEvidence([]);
  updateRouteHint();
  $("questionInput").focus();
}

/* -------------------------------------------------------------- settings */

// "Ready" means a live call would actually be accepted: a model to call, and
// the access code the server will ask for. Anything less stays rules mode.
function liveModelReady() {
  if (state.liveModelBlocked) return false;
  if (state.accessPasswordRequired && !localStorage.getItem("compliance-access-password")) return false;
  return state.serverModelConfigured || Boolean(sessionStorage.getItem("compliance-api-key"));
}

function updateModePill() {
  const pill = $("modePill");
  const ready = liveModelReady();
  pill.classList.toggle("live", !state.rulesMode && ready);
  pill.title = state.liveModelBlocked ? t("access_code_unset") : state.accessPasswordRequired && !ready ? t("accessRequired") : t("modeHint");
  $("modePillText").textContent = state.rulesMode ? t("runtimeRules") : ready ? t("runtimeReady") : t("runtimeMissing");
}

function openSettings() {
  const config = getConfig();
  const serverProvides = state.serverModelConfigured;
  // The endpoint fields are hidden rather than merely ignored: the server now
  // refuses client configuration in this mode, so offering the inputs would
  // invite someone to fill in values that quietly do nothing.
  $("clientModelFields").hidden = serverProvides;
  // Hiding a control does not exempt it from constraint validation, and one
  // invalid hidden field blocks submit with no visible cause — which made the
  // access code unsaveable on a server-key deployment. Disabling exempts them.
  $("clientModelFields").querySelectorAll("input").forEach((input) => { input.disabled = serverProvides; });
  $("serverModelNote").hidden = !serverProvides;
  $("settingsIntro").textContent = t(state.liveModelBlocked ? "settingsIntroBlocked" : serverProvides ? "settingsIntroServer" : "settingsIntro");
  $("settingsTitle").textContent = t(serverProvides ? "accessSettings" : "modelSettings");
  $("keyNoteText").textContent = t(serverProvides ? "codeNote" : "keyNote");
  $("serverModelName").textContent = state.serverModel || "";
  $("testConnectionBtn").hidden = serverProvides;
  $("baseUrlInput").value = config.baseUrl || "https://api.openai.com/v1";
  $("modelInput").value = config.model || "gpt-5.4-mini";
  $("apiKeyInput").value = config.apiKey || "";
  $("accessPasswordInput").value = localStorage.getItem("compliance-access-password") || "";
  $("accessField").hidden = !state.accessPasswordRequired;
  $("modelBlockedNote").hidden = !state.liveModelBlocked;
  $("modelBlockedText").textContent = state.liveModelBlocked ? t("access_code_unset") : "";
  $("connectionStatus").textContent = "";
  $("connectionStatus").className = "status-line";
  $("settingsDialog").showModal();
}

function saveSettings(event) {
  event.preventDefault();
  if (!state.serverModelConfigured) {
    localStorage.setItem("compliance-base-url", $("baseUrlInput").value.trim());
    localStorage.setItem("compliance-model", $("modelInput").value.trim());
  }
  const password = $("accessPasswordInput").value.trim();
  if (password) localStorage.setItem("compliance-access-password", password);
  else localStorage.removeItem("compliance-access-password");
  const key = $("apiKeyInput").value.trim();
  if (key) { sessionStorage.setItem("compliance-api-key", key); state.rulesMode = false; }
  else sessionStorage.removeItem("compliance-api-key");
  // Supplying the code is what unlocks live mode on a server-key deployment,
  // so it takes effect here rather than waiting for the pill to be clicked.
  if (liveModelReady() && state.serverModelConfigured) state.rulesMode = false;
  else if (!liveModelReady()) state.rulesMode = true;
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
    state.serverModel = capabilities.model || null;
    state.accessPasswordRequired = Boolean(capabilities.accessPasswordRequired);
    state.liveModelBlocked = Boolean(capabilities.liveModelBlocked);
    // Live mode is only pre-selected when it can actually run: a server key
    // behind a code the browser does not have yet still starts in rules mode.
    if (state.serverModelConfigured && !state.liveModelBlocked && liveModelReady()) state.rulesMode = false;
    document.querySelector('#settingsBtn .side-label').textContent = t(state.serverModelConfigured ? "accessSettings" : "modelSettings");
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
  renderStartPanel();
  renderGemNav();
  renderCaseNav();
  renderActiveGem();
  updateModePill();
  document.querySelector('#settingsBtn .side-label').textContent = t(state.serverModelConfigured ? "accessSettings" : "modelSettings");
  loadCoverage();
  if (!$("evidenceList").children.length || $("evidenceList").querySelector(".evidence-empty")) renderEvidence([]);
}

/* --------------------------------------------------------------- events */

$("questionInput").addEventListener("input", () => {
  const sourceTrigger = state.sourceQuery ? null : sourceQueryTrigger();
  if (sourceTrigger !== null) openSourcePalette(sourceTrigger);
  else {
    const query = paletteQuery();
    if (query !== null) openPalette(query); else closePalette();
  }
  updateRouteHint();
  if (state.activeGem) renderActiveGem();
});

$("questionInput").addEventListener("keydown", (event) => {
  if (state.palette.open) {
    if (event.key === "ArrowDown") { event.preventDefault(); return movePalette(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); return movePalette(-1); }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (state.palette.mode === "source") {
        const source = state.palette.items[state.palette.index];
        return source && activateSourceQuery(source.sourceId);
      }
      return choosePalette();
    }
    if (event.key === "Escape") { event.preventDefault(); return closePalette(); }
  }
  if (event.key === "Escape" && state.sourceQuery) { clearSourceQuery(); return; }
  if (event.key === "Escape" && state.activeGem) { clearGem(); return; }
  if (event.key === "Backspace" && !$("questionInput").value && state.sourceQuery) { event.preventDefault(); clearSourceQuery(); return; }
  // Backspacing into an empty composer drops the gem, matching how chips behave
  // elsewhere, so the gem never feels stuck.
  if (event.key === "Backspace" && !$("questionInput").value && state.activeGem) { event.preventDefault(); clearGem(); return; }
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("questionForm").requestSubmit(); }
});

$("palette").addEventListener("click", (event) => {
  const source = event.target.closest("[data-source]");
  if (source) return activateSourceQuery(source.dataset.source);
  // The star curates without selecting, so the catalogue is also where a
  // workspace gets built.
  const pin = event.target.closest("[data-pin]");
  if (pin) {
    event.stopPropagation();
    const added = toggleWorkspaceGem(pin.dataset.pin);
    renderGemNav();
    renderPalette();
    return toast(added ? t("gemAdded") : t("gemRemoved"));
  }
  const button = event.target.closest("[data-gem]");
  if (!button) return;
  $("questionInput").value = "";
  activateGem(button.dataset.gem);
});

$("starterGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-starter]");
  if (!button) return;
  const scenario = scenarios[state.locale].find((item) => item.id === button.dataset.starter);
  if (!scenario) return;
  $("questionInput").value = scenario.question;
  updateRouteHint();
  $("questionInput").focus();
});

$("caseNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-case]");
  if (button) openCase(button.dataset.case);
});

$("gemNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gem]");
  if (!button) return;
  // Clicking the gem already in use opens its spec rather than re-selecting it.
  if (state.activeGem?.id === button.dataset.gem) return openGemDetail(button.dataset.gem);
  activateGem(button.dataset.gem);
  closeDrawer();
});

// Declarations are submitted as another turn in the same thread, so the
// transcript records what was supplied and the conclusion is recomputed with it
// rather than being patched in place.
$("threadInner").addEventListener("click", (event) => {
  const gotoStep = event.target.closest("[data-goto-step]");
  if (gotoStep) {
    const step = gotoStep.closest(".msg-assistant")?.querySelector(`.path-step[data-step-id="${CSS.escape(gotoStep.dataset.gotoStep)}"]`);
    if (!step) return;
    step.classList.add("open", "flash"); step.classList.remove("shut");
    step.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => step.classList.remove("flash"), 1300);
    step.querySelector(".si-text")?.focus();
    return;
  }
  // A collapsed step can still be opened: collapsing is about what to read first,
  // not about hiding what a step concluded.
  const stepToggle = event.target.closest("[data-step-toggle]");
  if (stepToggle) {
    const step = stepToggle.closest(".path-step");
    const open = step.classList.toggle("open");
    step.classList.toggle("shut", !open);
    stepToggle.setAttribute("aria-expanded", String(open));
    return;
  }
  // Paging re-runs the same lookup and swaps the panel in place.
  const page = event.target.closest("[data-page]");
  if (page) {
    const panel = page.closest("[data-lookup]");
    return runSourceQuery(null, {
      source: { sourceId: panel.dataset.lookup },
      query: panel.dataset.lookupQuery,
      offset: Number(page.dataset.page),
      replace: panel
    });
  }
  const browse = event.target.closest("[data-browse]");
  if (browse) return runSourceQuery(null, { source: { sourceId: browse.dataset.browse }, query: "" });
  const escalate = event.target.closest("[data-escalate]");
  if (escalate) {
    clearSourceQuery();
    $("questionInput").value = t("escalatePrefix").replace("{q}", escalate.dataset.escalate);
    updateRouteHint();
    $("questionInput").focus();
    return;
  }
  // The basis line of a step links to the source it stands on, so a reviewer can
  // verify the claim in the source itself rather than taking it on trust.
  const jump = event.target.closest("[data-jump-source]");
  if (jump) {
    activateSourceQuery(jump.dataset.jumpSource, jump.dataset.jumpQuery || "");
    return;
  }
  const choice = event.target.closest(".si-choice");
  if (choice) {
    const group = choice.closest(".si-choices");
    group.querySelectorAll(".si-choice").forEach((button) => button.classList.toggle("on", button === choice));
    return;
  }
  // Skipping is a UI action only: nothing was supplied, so there is nothing to
  // re-analyse. The step keeps its "evidence needed" status and stays in the
  // action list; the form just stops demanding an answer the user does not have.
  const skip = event.target.closest(".si-skip");
  if (skip) return skip.closest(".step-inputs").classList.add("skipped");
  const reopen = event.target.closest(".si-reopen");
  if (reopen) return reopen.closest(".step-inputs").classList.remove("skipped");
  const submit = event.target.closest(".si-submit");
  if (!submit) return;
  const host = submit.closest(".step-inputs");
  const facts = {};
  host.querySelectorAll(".si-text").forEach((input) => { if (input.value.trim()) facts[input.dataset.field] = input.value.trim(); });
  host.querySelectorAll(".si-choice.on").forEach((button) => { facts[button.dataset.field] = button.dataset.value; });
  if (!Object.keys(facts).length) return toast(t("declareEmpty"));
  state.declaredFacts = { ...state.declaredFacts, ...facts };

  // The form becomes a record of what was submitted before the request returns.
  // Leaving the inputs editable while the analysis re-runs invites a second
  // submission of the same fact and gives no sign the first one registered.
  const labels = [...host.querySelectorAll(".si-row")]
    .filter((row) => row.querySelector(".si-text")?.value.trim() || row.querySelector(".si-choice.on"))
    .map((row) => `${row.querySelector(".si-label").textContent}：${row.querySelector(".si-text")?.value.trim() || row.querySelector(".si-choice.on").dataset.value}`);
  host.classList.add("submitted");
  host.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
  host.insertAdjacentHTML("beforeend", `
    <div class="si-done">
      <span class="sis-label">${esc(t("declaredAdded"))}</span>
      <span class="sis-values">${labels.map(esc).join("；")}</span>
      <span class="thinking-dot" aria-hidden="true"></span>
      <span class="sis-state">${esc(t("declareContinuing"))}</span>
    </div>
    <div class="si-stream" data-resume-stream></div>`);

  // The same analysis carries on with one more fact, inside the answer already on
  // screen — not a new question producing a second answer below it.
  const answer = host.closest(".msg-assistant");
  if (answer?.dataset.question) return analyze(null, { continueIn: answer });
  $("questionInput").value = `${t("declarePrefix")}${labels.join("；")}`;
  $("questionForm").requestSubmit();
});

$("gemRow").addEventListener("click", (event) => {
  if (event.target.closest("[data-source-drop]")) return clearSourceQuery();
  if (event.target.closest("[data-gem-drop]")) return clearGem();
  if (event.target.closest("[data-facts-toggle]")) { state.factsOpen = !state.factsOpen; return renderActiveGem(); }
  const detail = event.target.closest("[data-gem-detail]");
  if (detail) return openGemDetail(detail.dataset.gemDetail);
});

// Collapsing is a within-session gesture for reading width, not a preference to
// carry forward: the panel opens on every load, like the tab it opens on.
function setEvidenceCollapsed(collapsed) {
  state.evidenceCollapsed = collapsed;
  $("app").classList.toggle("evidence-collapsed", collapsed);
  $("evidenceToggle").setAttribute("aria-expanded", String(!collapsed));
  $("evidenceToggle").title = t(collapsed ? "evidenceExpand" : "evidenceCollapse");
}

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
// A node in the rail points at the step in the body. Steps that have not run are
// not in the body, so the click says so instead of scrolling nowhere.
document.addEventListener("click", (event) => {
  const node = event.target.closest("[data-flow-step]");
  if (!node) return;
  const step = [...document.querySelectorAll(".path-step")]
    .find((item) => item.querySelector("[data-step-toggle]") && item.closest(".msg-assistant") && item.dataset.stepId === node.dataset.flowStep);
  if (!step) return toast(t("flowNotRun"));
  step.classList.add("open"); step.classList.remove("shut");
  step.scrollIntoView({ behavior: "smooth", block: "center" });
  step.classList.add("flash");
  setTimeout(() => step.classList.remove("flash"), 1200);
});

$("evidenceToggle").addEventListener("click", () => setEvidenceCollapsed(!state.evidenceCollapsed));
document.querySelector(".panel-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-panel-tab]");
  // Choosing a tab on a collapsed panel means "show me this", so it opens too.
  if (!tab) return;
  if (state.evidenceCollapsed) setEvidenceCollapsed(false);
  setPanelTab(tab.dataset.panelTab);
});
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
    renderGemNav();
    toast(added ? t("gemAdded") : t("gemRemoved"));
  }
});

document.addEventListener("click", (event) => {
  if (state.palette.open && !event.target.closest(".composer")) closePalette();
});

$("questionForm").addEventListener("submit", analyze);
$("newChatBtn").addEventListener("click", newConversation);
$("modePill").addEventListener("click", () => {
  // Switching to live mode is refused where it cannot work, so the pill never
  // claims a capability the next question would fail on.
  if (state.rulesMode && !liveModelReady()) {
    if (state.liveModelBlocked) return toast(t("access_code_unset"));
    toast(t(state.accessPasswordRequired ? "accessRequired" : "needKey"));
    return openSettings();
  }
  state.rulesMode = !state.rulesMode;
  updateModePill();
});
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
setEvidenceCollapsed(state.evidenceCollapsed);
setPanelTab(state.panelTab);
applyLocale(state.locale);
renderEvidence([]);
renderFlowPanel(null);
loadRuntimeCapabilities();
loadCases();

import { DEFAULT_GEM_ID, GEMS, GEM_BY_ID, GEM_GROUPS, allGems, deskFor, factCoverage, factLabel, matchGems, setCustomGems, skillsForGem, toggleWorkspaceGem, workspaceGemIds } from "/gems.js";
import { EVIDENCE_STATUS, FOLDED, SETTLED_STATUS, STEP_STATUS_VOCAB, currentStepId, firstBlockedStep as blockedStep, isAskable as askable, isDone, label, laneQuestion, laneView, stepState as state_, tone, visibleLanes } from "/status-vocabulary.js";
import { AGENT_META, judgeIntent } from "/intent.js";

const i18n = {
  zh: {
    prototype: "合规情报原型", skipLink: "跳到工作区", workbench: "出口管制工作台", newChat: "新对话",
    scenarioLibrary: "测试场景", guideLink: "使用说明", scenarioHelp: "场景只填入输入框，不会新建对话。",
    startTitle: "描述交易，或用 / 选择一个 Gem",
    startLead: "范围为美国与中国的出口管制。Master Agent 自动路由到贸易、产品和第三方尽调 Agent，返回一份带证据链的统一答案。",
    assistantsEyebrow: "ASSISTANTS", sopEyebrow: "SOP LIBRARY", gemsLabel: "Gems", gemsRailHint: "选择一个长期工作的专家助手", skillsRailHint: "点击插入，或在输入框键入 /", ownFoot: "自建的 Gem 和 Skill 不额外调用模型，保存在这台服务器的数据库里。", skillsLabel: "Skills", skillNew: "新建 Skill", skillName: "名称", skillCommand: "斜杠命令", skillSummary: "一句话说明", skillProcedure: "标准提示词 / SOP", skillSave: "保存", skillDelete: "删除", cancel: "取消", optional: "选填", skillSaved: "已保存", skillNote: "Skill 只是追加给模型的一段流程说明。它不绑定数据源，也不要求问题里必须包含什么——那是 Gem 才做的事。它挂在 Gem 下面：当前 Gem 指定了名单，就只有名单里的能调用。", skillEmpty: "还没有自建 Skill", skillNoneHere: "当前 Gem 没有挂 Skill", skillScoped: "「{gem}」下的 Skill，另有 {n} 个不在这个 Gem 里", gemSkills: "挂在下面的 Skill", gemSkillsAllNote: "这个 Gem 没有指定，所以自建 Skill 全部可用", gemSkillsLabel: "这个 Gem 下的 Skill", gemSkillsHint: "不勾就是全都能用；勾了就只有勾中的能在这个 Gem 下调用", gemSkillsAll: "自建 Skill", gemNew: "新建 Gem", gemSaved: "Gem 已保存", gemNote: "Gem 是常驻的——选中后一直挂着，直到你换一个。它比 Skill 多四样：可用的数据源、提交前就会检查的必填事实、给三条专业线的指令，以及挂在它下面的 Skill。", gemInstruction: "给专业线的指令", gemSources: "可用数据源", gemSourcesHint: "勾选后，问题里会写明只依据这些来源", gemFactsLabel: "问题需包含的事实", gemFactsHint: "填名称和会出现在描述里的词；提交前据此提示还缺什么", gemFactAdd: "＋ 加一项", gemFactName: "名称，如：最终用户", gemFactWords: "关键词，用、分隔", gemsHint: "在输入框键入 / 可随时调用", coverageLabel: "数据覆盖",
    questionLabel: "输入合规情景", placeholder: "描述交易方、产品、路线、最终用户或付款安排……",
    slashHint: "Gem", composerNote: "原型输出仅用于研究与风险分流，不构成法律意见。请勿输入商业秘密或未公开交易数据。", itaAttribution: "This product uses the International Trade Administration\u2019s Data API but is not endorsed or certified by the International Trade Administration.",
    evidence: "证据与来源", evidenceEmpty: "完成一次分析后，这里显示引用来源、获取状态与访问时间。", sourceFellBack: "未取到页面正文，本次只用了该来源的摘要。名单筛查不读这些条文页，用的是已同步的名单记录。",
    modelSettings: "模型配置", settingsIntro: "支持 OpenAI-compatible Chat Completions API。", settingsIntroServer: "本部署的模型由服务器提供。你只需填写访问口令。", settingsIntroBlocked: "本部署已配置模型，但服务器未设置访问口令，因此实时模型不可用。", accessSettings: "访问设置", codeNote: "访问口令保存在本浏览器，用于调用受保护的接口。它是共享口令，不是身份认证。", serverModelNote: "模型由服务器提供，无需在此填写 API Key。", show: "显示", hide: "隐藏",
    keyNote: "API Key 仅保存在当前浏览器会话中，用于转发本次调用；不会写入服务器文件或日志。",
    testConnection: "测试连接", saveSession: "保存", analyzing: "正在检索官方来源并组织答案……",
    dataLoading: "数据状态载入中", dataSynced: "个来源已同步", dataFallback: "个用兜底快照", dataFailed: "个失败", dataNone: "暂无可用来源",
    sourcesSynced: "已同步来源", listRecords: "名单记录", fallbackSources: "兜底快照", failedSources: "同步失败",
    fallbackTitle: "本机未同步，使用随仓库提交的时点快照，采集于",
    gemSourcesUnit: "个来源", gemRecordsUnit: "条记录", gemUnsynced: "个未同步", gemNoData: "无绑定来源", gemNoCoverage: "数据状态未知",
    factsShort: "必填", railCollapse: "收起侧边栏", railExpand: "展开侧边栏",
    coverageMore: "查看全部数据源", mosaicUs: "美国", mosaicCn: "中国", mosaicOther: "全球 / 其他",
    hfQuestion: "一个问题", hfAnswer: "统一答案", startersLabel: "快速开始", gemBacking: "数据支撑",
    teachSlashTitle: "键入 / — 选一个 Gem 或 Skill",
    teachSlashBody: "先是三张常驻台——贸易、物项与许可、第三方尽调；选中一张就一直在上面，开新对话也还在。每张台下面是它的窄化入口，键入关键词直接命中。Skill 挂在当前台下面，把一段流程追加给模型。共 {n} 个 Gem、{s} 个自建 Skill。",
    teachAtTitle: "键入 @ — 直查数据源",
    teachAtBody: "在 {n} 个已入库的来源里按实体名、公告号或关键词翻记录。返回的是来源自己的条目，不是判定结论。",
    teachMakeTitle: "＋ 建自己的 Gem 和 Skill",
    teachMakeBody: "在左侧栏两个标题旁边。Skill 是一段 SOP 加一个斜杠命令；Gem 还能绑定可用的数据源，并规定问题里需要包含哪些事实。",
    historyLabel: "历史记录", historyEmpty: "暂无记录", historyVolatile: "记录存在容器本地磁盘，重新部署会清空。挂载 Volume 到 data/runtime 可长期保留。", turnUnit: "轮", historyOpenFailed: "无法打开该记录", flowTitle: "执行流程", flowDone: "已跑完", flowOf: "共 {n} 步", runPanel: "本次运行", flowRest: "顶部计的是整轮。另有 {n} 步在 {lanes} 本次没有走到 —— 上面这条线还缺证据，所以给出的是阶段性判断而不是结案",
    flowRestDone: "顶部计的是整轮。另有 {n} 步在 {lanes} 本次没有走完（其中 {done} 步已完成）—— 上面这条线还缺证据，所以给出的是阶段性判断而不是结案", briefLead: "本次问题落在以下 {n} 个审查范围：", briefBecause: "命中 ", briefStandard: "标准程序", briefNoStandard: "无对应标准程序", briefDesigned: "系统设计", briefSteps: "{n} 个步骤", briefDesignedN: "其中 {n} 步由系统补充", flowEmpty: "提交一个问题后，这里显示分析路径的执行进度", flowNotRun: "该步骤尚未执行",
    derivMatch_gem: "由所选 Gem 指定为主检查", derivMatch_always: "每次分析都执行", derivMatch_direct_lookup: "直接查询，不进入审查程序", derivMatch_gem_kind: "该 Gem 的产出类型，不进入审查程序", derivMatch_question_terms: "问题中的关键词",
    derivMatch_no_term_matched_all_lanes_run: "问题未命中任何关键词，三条检查全部执行",
    derivKind_official: "官方程序", derivKind_derived: "系统规划",
    derivFromStandard: "{n} 来自规范", derivFromSystem: "{n} 步由系统规划", laneRunning: "正在分析", pathDerivedNote: "本步骤无对应官方条文，由系统按问题结构补充", stConfirmed: "已确认", stEvidence: "需更多证据", stNotReached: "未进行", stSkipped: "已跳过，仍待补", status_confirmed: "已确认", status_evidence_needed: "需更多证据", status_not_reached: "待前序步骤", status_review_required: "需人工复核", status_pending: "待执行", stPending: "待执行", status_declared: "已声明，待核验", stDeclared: "已声明", declareSubmit: "提交并继续", declareSkip: "暂无此信息", declareSkipped: "已跳过 — 该步骤仍需证据，右侧执行流程中保留为待补", declareSkippedLabel: "暂无", declareReopen: "重新填写", declareRedo: "重新填写", declarePlaceholder: "填写后提交", declareNote: "填写的内容记为声明信息，不等于已核验证据", declareEmpty: "请先填写至少一项", declarePrefix: "补充信息 — ", declaredAdded: "已提交", declareContinuing: "正在继续分析…", declareSkippedContinued: "已跳过，分析继续进行", resumeFailed: "继续分析失败，表单已恢复可编辑，可重新提交：", reasoningTrace: "比对明细", rsSearched: "已检索的名单来源", rsMatched: "名称命中", rsCompared: "身份要素比对", rsFacts: "已核验事实",
    rsScore: "相似度", rsOpen: "查看原文", rsUnsynced: "未同步、本次未检索",
    el_country: "国别", el_registration_number: "注册号", el_address: "地址",
    st_agree: "一致", st_conflict: "冲突", st_unavailable: "缺失",
    basis_normalized_name_identical: "规范化后名称完全一致", basis_one_normalized_name_contains_the_other: "一个名称包含另一个",
    basis_token_overlap: "词元重叠", basis_weak_token_overlap: "弱词元重叠", basis_no_overlap: "无重叠", basis_no_comparable_name: "无可比对名称",
    disp_strong_potential_match_escalate_for_human_confirmation: "身份要素一致 —— 建议升级人工确认",
    disp_potential_match_requires_identity_review: "潜在命中 —— 需人工核对身份要素", disp_potential_match_requires_review: "名单条目 —— 命中与否须经人工核对",
    disp_weak_potential_match_requires_identity_review: "弱潜在命中 —— 需人工核对",
    disp_likely_false_positive_identity_elements_conflict: "身份要素冲突 —— 判定为疑似误报（仍需人工用注册证据确认）",
    disp_below_review_threshold: "低于复核阈值",
    noStreamNotice: "当前模型未返回流式响应，分析文本会在每个 Agent 完成后一次性显示。", step_routed: "选择 Agent", step_sources: "检索官方来源", step_grounding: "名单筛查与结构化事实", step_agents: "专业 Agent 分析", step_synthesizing: "综合结论", step_briefing: "汇总已发布公告", step_memo: "整理本会话的分析", step_lookup: "在已接入数据中检索",
    ground_notices: "两用物项公告", ground_product: "物项与管制编码", ground_screening: "管制名单比对",
    ground_counterparties: "交易对手候选", ground_ownership: "GLEIF 公司链", ground_stated: "OFAC 声明的关系",
    ground_beneficial: "SEC 13D/G 与 DEF 14A 持股", ground_shareholders: "年报前十大股东",
    groundingNote: "已筛查 {screened} 个名单来源 · {matches} 条潜在命中 · {internal} 条内部主数据关联",
    filterAll: "全部", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "跨域",
    runtimeReady: "实时模型", runtimeMissing: "未配置模型",
    routeLabel: "路由", intentReview: "合规审查", intentLookup: "直接查询", intentBriefing: "监管变化简报", intentMemo: "案件备忘录", intentNoReview: "不进入合规审查流程", intentAllLanes: "未匹配到关键词，三条线全跑", routedTo: "已路由至",
    willAsk: "这次会用到：", willAskMore: " 等 {n} 项", send: "发送", stopRun: "停止本次分析", runStopped: "已停止。本次分析未完成，也未存入案件历史。", overallAssessment: "总体判断", nextStep: "下一步", missingInfo: "仍需信息", actions: "建议行动", askFor: "建议补充", planSuggested: "专业 Agent 的其他建议", planSuggestedNote: "这些建议未对应分析路径上的某一步，供人工复核时参考", notClosed: "尚有 {n} 项未补齐", naCount: "{n} 项本次不适用", laneUnreached: "另有 {n} 步本次未进行", stepTriggered: "由前一步的发现触发", flowFolded: "另有 {n} 项不适用", laneFindings: "本条线的分析发现（专业 Agent 输出，非全案结论）", interimVerdict: "阶段性判断（基于现有信息，未结案）", noItems: "暂无", limitations: "结论边界与限制", clearanceTitle: "结案条件 · 五条", clearanceNote: "五个条件分属三条专业线，任何一条线都无法独自定案。沉默不算通过：未说明即为未满足。", clearanceCleared: "五条全部满足 —— 在所述事实下不产生许可要求，这不是批准，也不是放行。", clearanceBlocked: "尚有 {n} 条未满足，因此不出清晰结论。", clearanceOpen: "另有 {n} 个步骤仍在等证据；即使五条全过，未闭合的步骤同样阻断清晰结论。", clearanceMet: "已满足", clearanceUnmet: "未满足", countSuffix: " · {n} 条",
    sourceLive: "实时获取", sourceMetadata: "元数据", sourceUnavailable: "获取失败", sourceNotFetched: "未获取", sourceArchived: "已采集副本", sourceCitationOnly: "仅引用", sourceCached: "缓存", noQueryableSource: "暂无可直查的来源（需先同步）", sourceQueryHint: "@ 直查数据源", srcAuthority: "发布机构", srcCountry: "法域", srcUpdates: "更新频率", srcCaptured: "本地采集于", srcBoundary: "这里返回来源自己的记录，不是判定结论。", sourceQueryPlaceholder: "输入实体名、公告号或条文关键词（按相关性排序；留空则浏览全部）…",
    queryEmpty: "请输入查询内容", queryHits: "{total} 条命中", browseCount: "共 {total} 条", browseAll: "浏览全部", pagePrev: "上一页", pageNext: "下一页", relMatched: "命中", relMissed: "未命中", relPartial: "另有 {n} 条仅命中部分检索词，未列出", queryNoHit: "该来源中未找到匹配记录", queryTruncated: "显示前 {shown} 条，共 {total} 条",
    queryEscalate: "以此发起完整筛查 →", escalatePrefix: "请对 {q} 做完整合规筛查",
    queryDisclaimer: "直查返回的是来源原始记录，不是判定结论。", jumpSource: "在该来源中直查", lookupMode: "直查模式 · 不经 Agent 分析", sourceStale: "缓存（已过期）", evidenceCollapse: "收起证据栏", evidenceExpand: "展开证据栏",
    liveLabel: "实时模型 + 公开数据",
    riskLow: "低", riskMedium: "中", riskHigh: "高", riskUnknown: "待定",
    accessPassword: "访问口令", accessRequired: "该部署需要访问口令，请先填写口令后再使用实时模型。", access_password_required: "访问口令不正确，实时模型未调用。", access_code_unset: "服务器未设置 ACCESS_PASSWORD，实时模型已停用，本部署当前无法作答。请让运维配置该变量。", keyFromServer: "服务器已配置模型，无需在此填写 API Key。", badResponse: "服务端未返回有效结果，通常是网关超时；请重试或缩短问题。", needKey: "请先在模型配置中填写 API Key —— 没有模型时本系统不作答。", invalidQuestion: "请先描述一个具体情景。", error: "分析失败",
    saved: "已保存到当前会话", testing: "正在测试连接……", connected: "连接成功。", connectionFailed: "连接失败，请检查配置。",
    gemInstruction: "指令", gemSources: "绑定数据源", gemFacts: "必填事实", gemOutput: "输出结构",
    gemAdd: "添加到工作区", gemRemove: "从工作区移除", gemUse: "使用此 Gem", gemAdded: "已添加到工作区", gemRemoved: "已从工作区移除",
    gemDetail: "详情", gemNoSources: "不绑定外部来源，基于当前对话生成", factsLabel: "必填事实",
    factsMet: "已提供", boundLabel: "绑定来源",
    paletteEmpty: "没有匹配的 Gem", paletteMore: "还有 {n} 个",  paletteNav: "↑↓ 选择", paletteEnter: "Enter 使用", paletteEsc: "Esc 关闭",
    model_auth_error: "认证失败（401）：API Key 无效或不属于该服务。", model_permission_error: "权限被拒绝（403）。", model_endpoint_or_name_not_found: "接口或模型不存在（404）：检查 Base URL 是否含 /v1。", model_quota_or_rate_limit: "被限流或额度不足（429）。", model_invalid_request: "接口拒绝了请求（400/422）。", model_non_json_body: "接口没有返回 JSON —— 通常是网关或代理返回了错误页，不是模型本身的问题。", model_empty_content: "模型返回了空内容 —— 常见于触发了内容过滤，或输出被 token 上限截断。", model_text_not_json: "模型返回的不是 JSON —— 它按自然语言作答了。若该供应商不支持 response_format，换一个支持的模型更稳。", model_invalid_response: "响应不是兼容的 Chat Completions JSON。", model_timeout: "连接超时。", model_network_error: "无法连接模型接口。", model_provider_error: "模型服务异常。", model_unknown_error: "连接失败。"
  },
  en: {
    prototype: "Compliance intelligence", skipLink: "Skip to workspace", workbench: "Export control workbench", newChat: "New",
    scenarioLibrary: "Test scenarios", guideLink: "Guide", scenarioHelp: "Scenarios only fill the composer; they do not start a new thread.",
    startTitle: "Describe the transaction, or press / for a gem",
    startLead: "Scope is US and PRC export control. The Master Agent routes to the trade, product and third-party diligence agents and returns one answer with its evidence chain.",
    assistantsEyebrow: "ASSISTANTS", sopEyebrow: "SOP LIBRARY", gemsLabel: "Gems", gemsRailHint: "Pick the expert you are working with", skillsRailHint: "Click to insert, or type / in the composer", ownFoot: "Gems and skills you build cost no extra model call. They live in this server's database.", skillsLabel: "Skills", skillNew: "New skill", skillName: "Name", skillCommand: "Slash command", skillSummary: "One-line description", skillProcedure: "Standard prompt / SOP", skillSave: "Save", skillDelete: "Delete", cancel: "Cancel", optional: "optional", skillSaved: "Saved", skillNote: "A skill is a procedure appended to what the model is already told. It binds no sources and requires no facts \u2014 that is what a gem does. It hangs under a gem: where the selected gem names a set, only that set can be called.", skillEmpty: "No skills of your own yet", skillNoneHere: "This gem carries no skills", skillScoped: "Under {gem} — {n} more sit outside this gem", gemSkills: "Skills under it", gemSkillsAllNote: "This gem names none, so every skill you wrote is available", gemSkillsLabel: "Skills under this gem", gemSkillsHint: "Tick none and all of them work; tick some and only those can be called under this gem", gemSkillsAll: "Your skills", gemNew: "New gem", gemSaved: "Gem saved", gemNote: "A gem stays selected until you pick another. It carries four things a skill does not: the sources it may use, the facts checked before you submit, the instruction the specialists get, and the skills that hang under it.", gemInstruction: "Instruction for the specialists", gemSources: "Sources it may use", gemSourcesHint: "The question will say to rely on these only", gemFactsLabel: "Facts the question must carry", gemFactsHint: "A name and the words a draft carrying it would use; the composer flags what is missing", gemFactAdd: "+ Add one", gemFactName: "Name, e.g. end user", gemFactWords: "Keywords, comma separated", gemsHint: "type / in the composer at any time", coverageLabel: "Data coverage",
    questionLabel: "Enter a compliance scenario", placeholder: "Describe the party, product, route, end user or payment arrangement…",
    slashHint: "Gem", composerNote: "Prototype output is for research and triage only and is not legal advice. Do not enter trade secrets or confidential transaction data.", itaAttribution: "This product uses the International Trade Administration\u2019s Data API but is not endorsed or certified by the International Trade Administration.",
    evidence: "Evidence & sources", evidenceEmpty: "After an analysis, cited sources, retrieval status and access time appear here.", sourceFellBack: "The page text was not retrieved, so only this source\u2019s own summary was used. List screening does not read these provision pages; it runs on the ingested records.",
    modelSettings: "Model settings", settingsIntro: "Supports OpenAI-compatible Chat Completions APIs.", settingsIntroServer: "This deployment provides the model. You only need the access code.", settingsIntroBlocked: "This deployment has a model configured, but the server has no access code set, so the live model is unavailable.", accessSettings: "Access", codeNote: "The access code is kept in this browser and used to call the protected endpoints. It is a shared code, not authentication.", serverModelNote: "The model is provided by the server; no API key is needed here.", show: "Show", hide: "Hide",
    keyNote: "The API key stays in this browser session and is used only to forward this call. It is never written to server files or logs.",
    testConnection: "Test connection", saveSession: "Save", analyzing: "Retrieving official sources and composing the answer…",
    dataLoading: "Loading data status", dataSynced: "synced", dataFallback: "on bundled copy", dataFailed: "failed", dataNone: "No sources available",
    sourcesSynced: "Sources synced", listRecords: "List records", fallbackSources: "Bundled copies", failedSources: "Sync failures",
    fallbackTitle: "Not synced on this host; using the bundled point-in-time copy captured",
    gemSourcesUnit: "sources", gemRecordsUnit: "records", gemUnsynced: "not synced", gemNoData: "no bound sources", gemNoCoverage: "coverage unknown",
    factsShort: "Facts", railCollapse: "Collapse sidebar", railExpand: "Expand sidebar",
    coverageMore: "See all sources", mosaicUs: "United States", mosaicCn: "China", mosaicOther: "Global / other",
    hfQuestion: "One question", hfAnswer: "One answer", startersLabel: "Start here", gemBacking: "Data behind it",
    teachSlashTitle: "Type / \u2014 a gem or a skill",
    teachSlashBody: "Three desks first \u2014 Trade, Item & licence, Third-party diligence. Pick one and you stay there, new conversations included. Each desk's narrower entries sit under it, and typing reaches them directly. Skills hang under the desk you are at. {n} gems and {s} skills of your own.",
    teachAtTitle: "Type @ \u2014 query a source",
    teachAtBody: "Search {n} ingested sources by entity name, notice number or keyword. It returns the source\u2019s own records, not a determination.",
    teachMakeTitle: "\uFF0B Build your own",
    teachMakeBody: "Beside either sidebar heading. A skill is an SOP and a slash command; a gem also binds the sources it may use and the facts a question has to carry.",
    historyLabel: "History", historyEmpty: "No cases yet", historyVolatile: "Cases sit on the container\u2019s own disk and are cleared by a redeploy. Mount a volume at data/runtime to keep them.", turnUnit: "turns", historyOpenFailed: "That case could not be opened", flowTitle: "Execution flow", flowDone: "finished", flowOf: "of {n}", runPanel: "This run", flowRest: "The count above is the whole run. {n} further steps in {lanes} were not reached — the lane above is still short of evidence, so what you have is an interim assessment rather than a closed case",
    flowRestDone: "The count above is the whole run. {n} further steps in {lanes} were not finished ({done} of them are settled) — the lane above is still short of evidence, so what you have is an interim assessment rather than a closed case", briefLead: "This question falls into {n} review scopes:", briefBecause: "matched ", briefStandard: "Standard procedure", briefNoStandard: "No standard procedure", briefDesigned: "designed here", briefSteps: "{n} steps", briefDesignedN: "{n} added by this system", flowEmpty: "Ask a question and the analysis path\u2019s progress appears here", flowNotRun: "That step has not run yet",
    derivMatch_gem: "set as the lead check by the selected gem", derivMatch_always: "runs on every analysis", derivMatch_direct_lookup: "a direct lookup; no review procedure applies", derivMatch_gem_kind: "what this gem produces; no review procedure applies", derivMatch_question_terms: "terms in the question",
    derivMatch_no_term_matched_all_lanes_run: "no term matched, so all three checks run",
    derivKind_official: "official", derivKind_derived: "system-planned",
    derivFromStandard: "{n} from procedure", derivFromSystem: "{n} planned here", laneRunning: "analysing", pathDerivedNote: "No official provision for this step; added by the system", stConfirmed: "settled", stEvidence: "need evidence", stNotReached: "not reached", stSkipped: "skipped, still outstanding", status_confirmed: "Settled", status_evidence_needed: "Evidence needed", status_not_reached: "Awaiting earlier step", status_review_required: "Human review", status_pending: "Planned", stPending: "planned", status_declared: "Declared, unverified", stDeclared: "declared", declareSubmit: "Submit and continue", declareSkip: "Not available", declareSkipped: "Skipped — this step still needs evidence and stays outstanding in the flow rail", declareSkippedLabel: "Not available", declareReopen: "Fill in", declareRedo: "Change this answer", declarePlaceholder: "Fill in, then submit", declareNote: "What you enter is recorded as a declaration, not as verified evidence", declareEmpty: "Fill in at least one field first", declarePrefix: "Additional information — ", declaredAdded: "Submitted", declareContinuing: "continuing the analysis…", declareSkippedContinued: "skipped; the analysis moved on", resumeFailed: "The continuation failed; the form is editable again so you can resubmit: ", reasoningTrace: "Comparison detail", rsSearched: "Lists searched", rsMatched: "Name matches", rsCompared: "Identity comparison", rsFacts: "Verified facts",
    rsScore: "Similarity", rsOpen: "Open source", rsUnsynced: "Not synced, therefore not searched",
    el_country: "Country", el_registration_number: "Registration no.", el_address: "Address",
    st_agree: "agree", st_conflict: "conflict", st_unavailable: "missing",
    basis_normalized_name_identical: "normalized names identical", basis_one_normalized_name_contains_the_other: "one name contains the other",
    basis_token_overlap: "token overlap", basis_weak_token_overlap: "weak token overlap", basis_no_overlap: "no overlap", basis_no_comparable_name: "no comparable name",
    disp_strong_potential_match_escalate_for_human_confirmation: "Identity elements agree — escalate for human confirmation",
    disp_potential_match_requires_identity_review: "Potential match — identity elements need review", disp_potential_match_requires_review: "A list entry — whether it matches is for a human to confirm",
    disp_weak_potential_match_requires_identity_review: "Weak potential match — needs review",
    disp_likely_false_positive_identity_elements_conflict: "Identity elements conflict — likely false positive (still requires confirmation against registration evidence)",
    disp_below_review_threshold: "Below review threshold",
    noStreamNotice: "This model does not return a streamed response; each specialist\u2019s text appears once it finishes.", step_routed: "Select agents", step_sources: "Retrieve official sources", step_grounding: "Screening and structured facts", step_agents: "Specialist analysis", step_synthesizing: "Synthesis", step_briefing: "Summarising published notices", step_memo: "Assembling this session\u2019s analysis", step_lookup: "Searching the ingested data",
    ground_notices: "Dual-use notices", ground_product: "Item and control codes", ground_screening: "Restricted-list comparison",
    ground_counterparties: "Counterparty candidates", ground_ownership: "GLEIF corporate chain", ground_stated: "OFAC stated relationships",
    ground_beneficial: "SEC 13D/G and DEF 14A holdings", ground_shareholders: "Annual-report top ten",
    groundingNote: "{screened} list sources screened · {matches} potential matches · {internal} internal records touched",
    filterAll: "All", filterTrade: "Trade", filterProduct: "Product", filterTpdd: "TPDD", filterCross: "Cross-domain",
    runtimeReady: "Live model", runtimeMissing: "No model configured",
    routeLabel: "Route", intentReview: "Compliance review", intentLookup: "Direct lookup", intentBriefing: "Regulatory briefing", intentMemo: "Case memo", intentNoReview: "no review procedure runs", intentAllLanes: "no term matched, so all three run", routedTo: "Routed to",
    willAsk: "This will use: ", willAskMore: " and {n} more", send: "Send", stopRun: "Stop this analysis", runStopped: "Stopped. This analysis did not finish, and was not saved to the case history.", overallAssessment: "Overall assessment", nextStep: "Next step", missingInfo: "Missing information", actions: "Recommended actions", askFor: "Suggested to supply", planSuggested: "Other suggestions from the specialists", planSuggestedNote: "These do not map onto a step in the analysis path; they are for the reviewer to weigh", notClosed: "{n} items still open", naCount: "{n} not applicable here", laneUnreached: "{n} more not reached", stepTriggered: "triggered by an earlier finding", flowFolded: "{n} more not applicable", laneFindings: "What this lane found (specialist output, not the case conclusion)", interimVerdict: "Interim assessment (on incomplete facts, not a conclusion)", noItems: "None", limitations: "Limits on this conclusion", clearanceTitle: "Clearance conditions · five", clearanceNote: "The five conditions belong to three different lanes, so no lane can close a case on its own. Silence is not a pass: unstated is unmet.", clearanceCleared: "All five are met — no licence requirement arises on the stated facts. This is not an approval and not a release.", clearanceBlocked: "{n} not met, so no clear conclusion is drawn.", clearanceOpen: "{n} step(s) are still waiting on evidence. An open step blocks a clear conclusion even when all five conditions hold.", clearanceMet: "Met", clearanceUnmet: "Not met", countSuffix: " · {n}",
    sourceLive: "Live", sourceMetadata: "Metadata", sourceUnavailable: "Unavailable", sourceNotFetched: "Not fetched", sourceArchived: "Archived copy", sourceCitationOnly: "Cited only", sourceCached: "Cached", noQueryableSource: "No queryable source yet (sync one first)", sourceQueryHint: "@ query a source", srcAuthority: "Published by", srcCountry: "Jurisdiction", srcUpdates: "Updated", srcCaptured: "Captured locally", srcBoundary: "This returns the source's own records, not a determination.", sourceQueryPlaceholder: "Entity name, notice number or keyword — ranked by relevance; leave empty to browse all…",
    queryEmpty: "Enter something to look up", queryHits: "{total} matches", browseCount: "{total} records", browseAll: "Browse all", pagePrev: "Previous", pageNext: "Next", relMatched: "matched", relMissed: "not matched", relPartial: "{n} more records matched only part of the query and are not listed", queryNoHit: "No matching record in this source", queryTruncated: "Showing {shown} of {total}",
    queryEscalate: "Run a full screening on this →", escalatePrefix: "Run a full compliance screening on {q}",
    queryDisclaimer: "A lookup returns the source's own records, not a determination.", jumpSource: "Look this up in the source", lookupMode: "Lookup mode · does not run the agents", sourceStale: "Cached (stale)", evidenceCollapse: "Collapse evidence", evidenceExpand: "Expand evidence",
    liveLabel: "Live model + public data",
    riskLow: "Low", riskMedium: "Medium", riskHigh: "High", riskUnknown: "Unknown",
    accessPassword: "Access password", accessRequired: "This deployment requires an access code. Enter it before using the live model.", access_password_required: "The access code is not correct; the live model was not called.", access_code_unset: "ACCESS_PASSWORD is not set on the server, so live-model calls are disabled and this deployment cannot answer. Ask an operator to set it.", keyFromServer: "The server already provides a model; no API key is needed here.", badResponse: "The server did not return a valid result, usually a gateway timeout. Retry or shorten the question.", needKey: "Add an API key in Model settings — without a model this system does not answer.", invalidQuestion: "Describe a specific scenario first.", error: "Analysis failed",
    saved: "Saved for this session", testing: "Testing…", connected: "Connected.", connectionFailed: "Connection failed. Check the settings.",
    gemInstruction: "Instruction", gemSources: "Bound sources", gemFacts: "Required facts", gemOutput: "Output",
    gemAdd: "Add to workspace", gemRemove: "Remove from workspace", gemUse: "Use this gem", gemAdded: "Added to workspace", gemRemoved: "Removed from workspace",
    gemDetail: "Details", gemNoSources: "No external sources; works from the current thread", factsLabel: "Required facts",
    factsMet: "provided", boundLabel: "Bound sources",
    paletteEmpty: "No matching gem", paletteMore: "{n} more",  paletteNav: "↑↓ navigate", paletteEnter: "Enter to use", paletteEsc: "Esc to close",
    model_auth_error: "Authentication failed (401): the API key is invalid or belongs to another service.", model_permission_error: "Permission denied (403).", model_endpoint_or_name_not_found: "Endpoint or model not found (404): check that the Base URL includes /v1.", model_quota_or_rate_limit: "Rate limited or out of quota (429).", model_invalid_request: "The endpoint rejected the request (400/422).", model_non_json_body: "The endpoint did not return JSON — usually a gateway or proxy error page rather than the model itself.", model_empty_content: "The model returned empty content — typically a content filter, or output cut off by the token limit.", model_text_not_json: "The model answered in prose rather than JSON. If this provider does not support response_format, a model that does will be steadier.", model_invalid_response: "The response was not compatible Chat Completions JSON.", model_timeout: "The request timed out.", model_network_error: "The model endpoint could not be reached.", model_provider_error: "The provider returned an error.", model_unknown_error: "Connection failed."
  }
};

const scenarios = {
  zh: [
    { id: "C01", category: "trade", title: "德国长期客户直销办公笔记本（可结案）", meta: "EAR99 · 直销 · 逐条满足", question: "客户 Rhein Systeme GmbH，注册号 HRB 214553，德国杜塞尔多夫 Kölner Str. 12。我们直销一批 TX-1140 办公笔记本电脑给该公司，无中间商、无代理商。厂商分类为 EAR99，最终目的地德国，最终用户为该公司自身办公使用。请判断是否需要出口许可。",
      facts: { legalName: "Rhein Systeme GmbH", registrationNumber: "HRB 214553", country: "DE", address: "Kölner Str. 12, 40211 Düsseldorf, Germany", ownership: "创始人 Anna Reinhardt 个人持股 100%，无被列名主体直接或间接持股", partNumber: "TX-1140", usContent: "> 25%", eccn: "EAR99", destination: "德国", endUse: "该公司自身办公使用，无转售、无军事或核相关用途" } },
    { id: "C02", category: "product", title: "低于 de minimis 的境外制造件出口日本（可结案）", meta: "§ 734.4 · 不受 EAR 管辖", question: "我们从马来西亚工厂直接发运一批 MP-820 机架导轨组件给日本客户 Sakura Kikai K.K.（法人番号 0104-01-089221，东京都港区），无中间商。该组件受控美国原产内容占比低于 10%，最终用户为该公司产线自用。请判断是否受 EAR 管辖以及是否需要许可。",
      facts: { legalName: "Sakura Kikai K.K.", registrationNumber: "0104-01-089221", country: "JP", address: "东京都港区芝 3-14-2", ownership: "上市公司，前十大股东均为日本机构投资者，无被列名主体持股", partNumber: "MP-820", usContent: "< 10%", eccn: "", destination: "日本", endUse: "该公司自有产线自用，非转售、非军事用途" } },
    { id: "C03", category: "trade", title: "同名但身份要素全部对不上的加拿大客户（可结案）", meta: "误报排除 · 直销", question: "客户 Northbridge Instruments Ltd.，注册号 BC1029384，加拿大温哥华 W Hastings St 550。名称与名单条目相似，但注册国、地址均不一致。我们直销一台 EAR99 校准仪给该公司，无中间商，最终用户为其自有实验室。请完成误报排除并判断许可要求。",
      facts: { legalName: "Northbridge Instruments Ltd.", registrationNumber: "BC1029384", country: "CA", address: "550 W Hastings St, Vancouver, BC", ownership: "两名加拿大籍自然人各持股 50%，无被列名主体持股", partNumber: "CAL-330", usContent: "> 25%", eccn: "EAR99", destination: "加拿大", endUse: "其自有实验室校准使用，无转售" } },
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
    { id: "C01", category: "trade", title: "Direct sale of office laptops to a German customer (clears)", meta: "EAR99 · direct · every condition met", question: "Customer Rhein Systeme GmbH, registration HRB 214553, Kölner Str. 12, Düsseldorf, Germany. We are selling TX-1140 office laptops to them directly, with no intermediary and no agent. The manufacturer classification is EAR99, the destination is Germany, and the end user is the company itself for office use. Is an export licence required?",
      facts: { legalName: "Rhein Systeme GmbH", registrationNumber: "HRB 214553", country: "DE", address: "Kölner Str. 12, 40211 Düsseldorf, Germany", ownership: "Founder Anna Reinhardt holds 100%; no designated party holds any direct or indirect interest", partNumber: "TX-1140", usContent: "> 25%", eccn: "EAR99", destination: "Germany", endUse: "The company's own office use; no resale, no military or nuclear application" } },
    { id: "C02", category: "product", title: "Below de minimis, foreign-made, shipped to Japan (clears)", meta: "§ 734.4 · not subject to the EAR", question: "We ship MP-820 rack rail assemblies from our Malaysian plant directly to Japanese customer Sakura Kikai K.K. (corporate number 0104-01-089221, Minato-ku, Tokyo), with no intermediary. Controlled US-origin content is below 10%. The end user is the company's own production line. Is the item subject to the EAR, and is a licence required?",
      facts: { legalName: "Sakura Kikai K.K.", registrationNumber: "0104-01-089221", country: "JP", address: "3-14-2 Shiba, Minato-ku, Tokyo", ownership: "Listed company; top ten holders are Japanese institutional investors, none designated", partNumber: "MP-820", usContent: "< 10%", eccn: "", destination: "Japan", endUse: "The company's own production line; not for resale, not a military application" } },
    { id: "C03", category: "trade", title: "Similar name, every identity element conflicts, Canada (clears)", meta: "false positive cleared · direct", question: "Customer Northbridge Instruments Ltd., registration BC1029384, 550 W Hastings St, Vancouver, Canada. The name resembles a list entry but the country and address both conflict. We are selling one EAR99 calibrator to them directly, with no intermediary, for their own laboratory. Resolve the false positive and determine the licence requirement.",
      facts: { legalName: "Northbridge Instruments Ltd.", registrationNumber: "BC1029384", country: "CA", address: "550 W Hastings St, Vancouver, BC", ownership: "Two Canadian individuals hold 50% each; no designated party holds an interest", partNumber: "CAL-330", usContent: "> 25%", eccn: "EAR99", destination: "Canada", endUse: "Their own laboratory calibration; no resale" } },
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
  // The AbortController for the run in flight, so the button can end it. Null
  // whenever nothing is running, which is also what tells the button which of
  // its two jobs it currently has.
  run: null,
  scenarioCategory: "all",
  conversation: [],
  serverModelConfigured: false,
  serverModel: null,
  serverEndpoint: null,
  accessPasswordRequired: false,
  liveModelBlocked: false,
  coverage: null,
  cases: [],
  threadId: null,
  declaredFacts: {},
  unavailableFacts: [],
  resumingStep: null,
  sourceQuery: null,
  factsOpen: false,
  rail: localStorage.getItem("compliance-rail") === "1",
  historyPersistent: true,
  evidenceCollapsed: false,
  activeGem: null,
  skills: [],
  sourceOptions: [],
  palette: { open: false, items: [], index: 0, query: "" },
  // Desks the reader opened by hand. Not persisted: it is about the panel that
  // is on screen now, and a desk left open from yesterday is not a preference.
  paletteOpen: new Set()
};

const $ = (id) => document.getElementById(id);
const t = (key) => i18n[state.locale][key] || key;
const localized = (value) => (value && typeof value === "object" ? value[state.locale] || value.zh : value);
const agentName = (agent) => ({ trade: "Trade", product: "Product", tpdd: "Ethics & TPDD", lookup: "Lookup", briefing: "Briefing", memo: "Memo" })[agent] || agent;
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

// A section heading, in the three forms a model actually writes them:
// a markdown heading, a line that is nothing but bold text, and a short label
// followed by a colon and nothing else.
const HEADING = /^\s{0,3}#{1,4}\s+(.+?)\s*#*$/;
const BOLD_LINE = /^\s*\*\*(.+?)\*\*[：:]?\s*$/;
// Short, because "结论：" is a heading and a whole sentence ending in a colon is
// not. Colons are ordinary punctuation in this material.
const LABEL_LINE = /^\s*([^\s：:][^：:]{0,11})[：:]\s*$/;

// A label with its content on the same line — 事实：…… — which is how a
// compliance summary is usually written. Rendering it as an undifferentiated
// paragraph loses the one piece of structure the writer supplied.
const LABELLED = /^\s*([^\s：:][^：:]{0,11})[：:]\s*(\S.*)$/;

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
    if (!line.trim()) continue;

    const heading = line.match(HEADING) || line.match(BOLD_LINE) || line.match(LABEL_LINE);
    if (heading) { out.push(`<h4 class="prose-head">${formatInline(heading[1])}</h4>`); continue; }

    const labelled = line.match(LABELLED);
    if (labelled) {
      out.push(`<p class="prose-labelled"><b>${formatInline(labelled[1])}</b>${formatInline(labelled[2])}</p>`);
      continue;
    }
    out.push(`<p>${formatInline(line)}</p>`);
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


// The start panel states three counts — how many gems, how many skills, how many
// sources hold records — and all three arrive after it first paints. Without
// this it renders 8 gems, 0 skills and 0 sources and never corrects itself,
// which is a claim about the system rather than a stale label.
function refreshStartCounts() {
  if (!$("startPanel").classList.contains("hidden")) renderStartPanel();
}

function renderGemNav() {
  const pinned = workspaceGemIds();
  // Two lines, because a desk is chosen for what it covers rather than by its
  // name. "物项与许可台" and "第三方尽调" are indistinguishable to anyone who has
  // not already learned which is which.
  const row = (gem, extra = "") => `
    <li${extra}>
      <button type="button" data-gem="${gem.id}" class="${state.activeGem?.id === gem.id ? "active" : ""}" title="${esc(localized(gem.name))} ${esc(gem.command)}">
        ${gemIconMarkup(gem)}
        <span class="gem-name">${esc(localized(gem.name))}</span>
        <small class="gem-sub">${esc(localized(gem.summary))}</small>
      </button>
    </li>`;

  // The three desks are always here, and they are not pinned.
  //
  // Pinning is a choice about shortcuts; a desk is the lane itself, and there
  // are exactly three. Making them a default pin would have meant telling "never
  // touched" apart from "unpinned every one of them", which workspaceGemIds
  // cannot do — localStorage.getItem returns null for the first and JSON.parse
  // gives [] for the second, and both come out of that function as []. A reader
  // who removed all three would have found them back after a reload.
  const desks = allGems().filter((gem) => gem.desk);
  // The sidebar is the workspace, not the catalogue — the palette is the
  // catalogue. Showing all eight here made pinning meaningless, because it only
  // reordered a list that already held everything.
  const shown = allGems().filter((gem) => !gem.desk
    && (pinned.includes(gem.id) || state.activeGem?.id === gem.id));
  $("gemNav").innerHTML = desks.map((gem) => row(gem)).join("")
    + shown.map((gem, index) => row(gem, index === 0 ? ' class="gem-nav-cut"' : "")).join("");
}

async function loadGems() {
  try {
    const response = await fetch("/api/gems");
    if (!response.ok) return;
    const data = await response.json();
    // Handed to the shared module rather than kept here: the composer, the
    // palette, the sidebar and the guide all read the catalogue from there, and
    // a second list on this side is how they would come to disagree.
    setCustomGems(data.gems || []);
    state.sourceOptions = data.sources || [];
  } catch { /* the built-in eight are enough to work with */ }
  restoreActiveGem();
  renderGemNav();
  refreshStartCounts();
}

async function loadSkills() {
  try {
    const response = await fetch("/api/skills");
    if (!response.ok) return;
    state.skills = (await response.json()).skills || [];
  } catch { /* the workbench works without them */ }
  renderSkillNav();
  refreshStartCounts();
}

// The skills the current gem offers. Same call the palette makes, so a command
// listed here is a command / will accept, and one that is not is not.
function visibleSkills() {
  return skillsForGem(state.activeGem, state.skills);
}

function renderSkillNav() {
  const shown = visibleSkills();
  // Said out loud when a gem is narrowing the list, because a skill that is
  // simply absent looks the same as one that was never written.
  const scoped = shown.length !== state.skills.length;
  $("skillScope").textContent = scoped
    ? t("skillScoped").replace("{gem}", localized(state.activeGem.name)).replace("{n}", state.skills.length - shown.length)
    : "";
  $("skillScope").classList.toggle("hidden", !scoped);
  $("skillNav").innerHTML = shown.length
    ? shown.map((skill) => `
      <li>
        <button type="button" data-skill="${esc(skill.command)}" title="${esc(skill.summary)}">
          <span class="gem-icon is-skill" aria-hidden="true">/</span>
          <span class="gem-name"><code>/${esc(skill.command)}</code><em>${esc(skill.name)}</em></span>
          <small class="gem-sub">${esc(skill.summary)}</small>
        </button>
        <button type="button" class="gem-drop" data-skill-delete="${esc(skill.id)}" title="${esc(t("skillDelete"))}" aria-label="${esc(t("skillDelete"))}">
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </li>`).join("")
    : `<li class="gem-nav-empty">${esc(t(state.skills.length ? "skillNoneHere" : "skillEmpty"))}</li>`;
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

// Said next to the list rather than in a toast, because it is a standing
// property of this deployment, not an event.
function renderHistoryDurability() {
  const note = $("historyVolatile");
  if (!note) return;
  note.textContent = t("historyVolatile");
  note.classList.toggle("hidden", state.historyPersistent);
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
      retireUnansweredAsks(turn.analysisPath);
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
    renderFlowPanel(last?.analysisPath, { analysed: (last?.results || []).map((item) => item.agent) });
    renderCaseNav();
    closeDrawer();
    $("threadInner").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    // The reason, not just the toast. A swallowed exception here is a case that
    // will not open with nothing anywhere saying why.
    console.error("Opening a case failed:", error);
    toast(t("historyOpenFailed"));
  }
}

function renderHeroFigure() {
  const lanes = [
    { key: "trade", label: "Trade" },
    { key: "product", label: "Product" },
    { key: "tpdd", label: "Ethics & TPDD" }
  ];
  // The three lanes and the six connector lines share one set of grid rows.
  //
  // They used to be separate columns — a fan that stretched to the figure's full
  // height beside a lane column that sized to its own content — so the moment
  // anything made the figure taller than the lanes, the fan's thirds spread
  // wider than the boxes and the outer two lines missed by 26px. In the same
  // rows they cannot miss: each line is centred in the row its box is in.
  $("heroFigure").innerHTML = `
    <span class="hf-node hf-q">${esc(t("hfQuestion"))}</span>
    <div class="hf-fan" aria-hidden="true"><i></i><i></i><i></i></div>
    ${/* No row written into the markup: the CSP is style-src 'self', so a style
          attribute is dropped without a word. Column 3 is empty otherwise, so
          auto-placement puts the three in rows 1, 2 and 3 in document order. */ ""}
    ${lanes.map((lane) => `
      <span class="hf-node hf-agent lane-${lane.key}"><em></em>${esc(lane.label)}</span>`).join("")}
    <div class="hf-fan hf-fan-in" aria-hidden="true"><i></i><i></i><i></i></div>
    <span class="hf-node hf-answer">${esc(t("hfAnswer"))}</span>`;
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

  // A row per region rather than a card per region. Three bordered cards inside
  // a bordered module is three frames around one subject; on one line each, the
  // name, the count and the tiles read left to right as one sentence.
  $("sourceMosaic").innerHTML = groups.map((group) => {
    const sources = data.sources.filter((source) => bucket(source) === group.key);
    if (!sources.length) return "";
    const live = sources.filter((source) => ["success", "fallback_snapshot"].includes(source.sync?.status)).length;
    return `
      <div class="mosaic-row">
        <span class="mosaic-name">${esc(group.label)}</span>
        <b class="mosaic-count">${live}/${sources.length}</b>
        <div class="mosaic-tiles">${sources.map((source) => `
          <a class="tile tone-${tone(source.sync?.status)}" href="/data-sources.html"
             title="${esc(source.sourceId)} · ${esc(source.sync?.status || "not_synced")}${source.sync?.recordCount ? ` · ${source.sync.recordCount}` : ""}"></a>`).join("")}</div>
      </div>`;
  }).join("");
}

function renderStartPanel() {
  renderHeroFigure();
  renderSourceMosaic();
  // The three things the composer does, by what you type into it. Pinning had one
  // of the two rows; it is a convenience, and what a reader needs first is that
  // the same box runs a review, a saved procedure or a raw lookup depending on
  // the first character.
  const rows = [
    ["/", t("teachSlashTitle"), t("teachSlashBody").replace("{n}", allGems().length).replace("{s}", state.skills.length)],
    ["@", t("teachAtTitle"), t("teachAtBody").replace("{n}", (state.coverage?.sources || []).filter((source) => source.sync?.recordCount > 0).length)],
    ["＋", t("teachMakeTitle"), t("teachMakeBody")]
  ];
  $("startTeach").innerHTML = rows.map(([key, title, body]) => `
    <div class="teach-row">
      <kbd>${esc(key)}</kbd>
      <div><strong>${esc(title)}</strong><span>${esc(body)}</span></div>
    </div>`).join("");

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
    ${/* No chip when the gem requires nothing. "必填 0/0" is a control that
          reports on an empty list and opens onto one — the coordinator takes
          any question, and saying so as a fraction says nothing. */ ""}
    ${facts.length ? `<button type="button" class="facts-toggle ${met === facts.length ? "complete" : ""}" data-facts-toggle aria-expanded="${state.factsOpen}">
      ${t("factsShort")} ${met}/${facts.length} ${state.factsOpen ? "⌃" : "⌄"}
    </button>` : ""}
    <button type="button" class="gem-drop" data-gem-detail="${gem.id}" title="${esc(t("gemDetail"))}" aria-label="${esc(t("gemDetail"))}">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
    </button>
    ${/* Nothing to close on the coordinator: leaving a gem comes back here, so
          the × would be a control whose result is the state it is already in. */ ""}
    ${gem.coordinator ? "" : `<button type="button" class="gem-drop" data-gem-drop aria-label="remove gem">
      <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>`}
    ${state.factsOpen && facts.length ? `
      <div class="facts-panel">
        <ul>${facts.map((fact) => `<li class="${fact.met ? "met" : ""}">${esc(factLabel(fact, state.locale))}</li>`).join("")}</ul>
        <div class="facts-sources">${gem.boundSources.length ? `${t("boundLabel")}: ${gem.boundSources.map(esc).join(" · ")}` : t("gemNoSources")}</div>
      </div>` : ""}`;
  renderGemNav();
}

// A gem is who is answering, and it stays until the reader changes it.
//
// It used to be the mode of one composer: chosen, used, and dropped by the next
// new conversation, which made picking a specialist a thing you did per question
// rather than a place you were working. On Google's arrangement you are in a gem
// — a new conversation is a new conversation with the same assistant — so the
// selection outlives the thread and the page, and the only ways out are the ×,
// Escape, and picking a different one.
const ACTIVE_GEM_KEY = "compliance-active-gem";

function activateGem(gemId, { focus = true } = {}) {
  const gem = GEM_BY_ID.get(gemId);
  if (!gem) return;
  state.activeGem = gem;
  state.factsOpen = false;
  localStorage.setItem(ACTIVE_GEM_KEY, gem.id);
  closePalette();
  const input = $("questionInput");
  input.placeholder = localized(gem.placeholder) || t("placeholder");
  renderActiveGem();
  renderSkillNav();
  updateRouteHint();
  if (focus) input.focus();
}

// Leaving a gem returns to the coordinator, not to nothing. There is no "no
// assistant" state: closing a specialist means going back to the desk that
// takes anything, which is what the composer did before it had a name for it.
function clearGem({ focus = false } = {}) {
  state.factsOpen = false;
  localStorage.removeItem(ACTIVE_GEM_KEY);
  activateGem(DEFAULT_GEM_ID, { focus });
}

// Restored after the catalogues load, not at boot: a custom gem is not in
// GEM_BY_ID until loadGems has answered, so restoring earlier would silently
// drop exactly the gems a reader built for themselves.
function restoreActiveGem() {
  const id = localStorage.getItem(ACTIVE_GEM_KEY);
  if (state.activeGem) return;
  if (!id || !GEM_BY_ID.has(id)) return activateGem(DEFAULT_GEM_ID, { focus: false });
  activateGem(id, { focus: false });
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
  // Set aside, not dropped. A direct source query is not a question for any
  // assistant, so none is shown while one is open — but closing it used to
  // leave the reader nowhere, having silently unselected the desk they were at.
  state.gemBeforeSource = state.activeGem?.id || null;
  state.activeGem = null;
  closePalette();
  setComposer(prefill);
  $("questionInput").placeholder = t("sourceQueryPlaceholder");
  renderActiveGem();
  updateRouteHint();
  renderFlowPanel(null);
  syncSubmitState();
  $("questionInput").focus();
}

function clearSourceQuery() {
  state.sourceQuery = null;
  const back = state.gemBeforeSource;
  state.gemBeforeSource = null;
  $("questionInput").placeholder = t("placeholder");
  activateGem(back && GEM_BY_ID.has(back) ? back : DEFAULT_GEM_ID, { focus: false });
  updateRouteHint();
  renderFlowPanel(null);
  syncSubmitState();
}

function paletteQuery() {
  const value = $("questionInput").value;
  // The palette only opens on a slash that starts the draft, so a URL or a date
  // typed mid-sentence never hijacks the composer.
  const match = value.match(/^\/([\w-]*)$/);
  return match ? match[1] : null;
}

function openPalette(query) {
  // Skills sit in the same list as gems because they share the one namespace the
  // composer parses: a leading /token, and the reader is choosing what to run,
  // not what kind of thing it is. They are grouped apart so the difference is
  // still visible — a gem checks its inputs against bound sources, a skill is a
  // procedure somebody wrote.
  const needle = String(query || "").toLowerCase();
  const skills = visibleSkills().filter((skill) => !needle
    || skill.command.includes(needle) || skill.name.toLowerCase().includes(needle));
  state.palette = { open: true, items: [...paletteGems(query), ...skills], index: 0, query: String(query || "").trim() };
  renderPalette();
}

// The demotion, and the reason it is not a matter of hiding things.
//
// The eight used to be one flat list of peers, four of which lead the same
// lane. Grouping them under the desks says so, but grouping alone still puts
// eight narrow entries in front of somebody who wanted to pick a place to work.
// So with an empty draft the list is the three desks and the one action, and a
// desk's narrower entries appear when you are at that desk or you open it.
//
// Typing is never narrowed: /ecc finds /eccn from anywhere. That is what keeps
// this a demotion rather than a removal — the catalogue is all still reachable
// by the means people actually reach it by, and only the first screen is
// opinionated about where to start.
function paletteGems(query) {
  const matched = matchGems(query);
  if (String(query || "").trim()) return matched;
  const open = new Set([deskFor(state.activeGem), ...state.paletteOpen].filter(Boolean));
  return matched.filter((gem) => gem.desk || gem.group === "action" || gem.group === "custom"
    || open.has(deskFor(gem)));
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
  const skills = items.filter((item) => item.procedure);
  // Which desks have entries the empty list is holding back, so the header can
  // say how many rather than hiding the fact that it is hiding anything.
  const held = {};
  if (!state.palette.query) {
    for (const gem of GEMS) if (!gem.desk && !items.includes(gem)) held[gem.group] = (held[gem.group] || 0) + 1;
  }
  host.innerHTML = groups.concat(Object.keys(held)).filter((group, index, all) => all.indexOf(group) === index).map((group) => `
    <div class="palette-group">
      <div class="palette-group-label">${esc(localized(GEM_GROUPS[group]))}${held[group]
        ? `<button type="button" class="pg-more" data-open-group="${esc(group)}">${esc(t("paletteMore").replace("{n}", held[group]))}</button>`
        : ""}</div>
      ${items.filter((gem) => gem.group === group).map((gem) => `
        <button type="button" class="palette-item ${items.indexOf(gem) === index ? "active" : ""}" data-gem="${gem.id}" role="option">
          ${gemIconMarkup(gem)}
          <span><strong>${esc(localized(gem.name))}</strong><small>${esc(localized(gem.summary))}</small></span>
          ${/* Hollow or filled, not two shades of the same star. Pinned and not
                pinned differed only by colour, and a colour difference on a 12px
                glyph at the end of a busy row is a difference nobody has to
                notice. The shape is the state; the colour just agrees with it. */ ""}
          ${/* No star on a desk. The sidebar holds all three whatever the pin
                store says, so the control would have been one that changed
                nothing a reader could see. */ ""}
          ${gem.desk ? "" : `<span class="palette-pin ${workspaceGemIds().includes(gem.id) ? "on" : ""}" data-pin="${gem.id}" role="button" tabindex="-1"
                title="${esc(t(workspaceGemIds().includes(gem.id) ? "gemRemove" : "gemAdd"))}">${workspaceGemIds().includes(gem.id) ? "★" : "☆"}</span>`}
        </button>`).join("")}
    </div>`).join("")
    + (skills.length ? `<div class="palette-group">
      <div class="palette-group-label">${esc(t("skillsLabel"))}</div>
      ${skills.map((skill) => `
        <button type="button" class="palette-item ${items.indexOf(skill) === index ? "active" : ""}" data-skill="${esc(skill.command)}" role="option">
          <span class="gem-icon is-skill" aria-hidden="true">/</span>
          <span><strong>${esc(skill.name)}</strong><small>${esc(skill.summary)}</small></span>
          <code class="palette-cmd">/${esc(skill.command)}</code>
        </button>`).join("")}
    </div>` : "")
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
  setComposer("");
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
      <div class="gem-spec-row"><dt>${t("gemFacts")}</dt><dd><div class="chip-row">${gem.requiredFacts.map((fact) => `<span class="chip">${esc(factLabel(fact, state.locale))}</span>`).join("")}</div></dd></div>
      ${/* Named on the card because it is the one property that changes what the
            reader can reach next, and it is invisible until they select the gem
            and notice the list got shorter. */ ""}
      <div class="gem-spec-row"><dt>${t("gemSkills")}</dt><dd>${skillsForGem(gem, state.skills).length
        ? `<div class="chip-row">${skillsForGem(gem, state.skills).map((skill) => `<span class="chip mono">/${esc(skill.command)}</span>`).join("")}</div>`
          + (gem.skillIds?.length ? "" : `<p class="sp-note">${esc(t("gemSkillsAllNote"))}</p>`)
        : esc(t(state.skills.length ? "skillNoneHere" : "skillEmpty"))}</dd></div>
      <div class="gem-spec-row"><dt>${t("gemOutput")}</dt><dd>${esc(localized(gem.outputTemplate))}</dd></div>
      <div class="gem-spec-row"><dt>${t("gemBacking")}</dt><dd>${gemBackingMarkup(gem)}</dd></div>
    </dl>
    <div class="card-actions">
      ${gem.desk ? "" : `<button class="btn" data-toggle-workspace="${gem.id}" type="button">${pinned ? t("gemRemove") : t("gemAdd")}</button>`}
      <button class="btn btn-primary" data-use-gem="${gem.id}" type="button">${t("gemUse")}</button>
    </div>`;
  $("gemDialog").showModal();
}

/* ----------------------------------------------------------- rendering */

function riskLabel(level) { return t(`risk${level.charAt(0).toUpperCase()}${level.slice(1)}`); }

// What this question is going to do, said before it is sent. The hint used to
// list specialist agents for every question, from its own copy of the routing
// rules — so a question the run answers as a lookup, opening no procedure at
// all, was announced as a compliance review, and selecting the briefing gem
// changed nothing about what the hint claimed. It asks the shared judgement now,
// which is the one the run itself makes.
// What the lanes on this path will ask for, fetched once from the procedure the
// server actually runs rather than restated here. Telling the reader up front is
// cheaper for them than being asked halfway through — and now that the run no
// longer stops, it is the only place the asking can happen early.
const laneAsks = new Map();
fetch("/api/procedures").then((response) => response.json()).then((procedures) => {
  for (const lane of procedures.lanes || []) {
    laneAsks.set(lane.lane, lane.steps.flatMap((step) => step.asks || []));
  }
  updateRouteHint();
}).catch(() => { /* the hint is an aid; without it the run still asks in the path */ });

function updateRouteHint() {
  const value = $("questionInput").value.trim();
  const host = $("routeHint");
  document.querySelector(".slash-hint").classList.toggle("hidden", Boolean(state.sourceQuery));
  if (state.sourceQuery) { host.innerHTML = `<span>${esc(t("lookupMode"))}</span>`; return; }
  if (!value) { host.innerHTML = ""; return; }

  const verdict = judgeIntent({ question: value, gemKind: state.activeGem?.kind || null });
  if (!verdict.review) {
    const what = verdict.kind === "lookup" ? t("intentLookup")
      : verdict.kind === "briefing" ? t("intentBriefing") : t("intentMemo");
    host.innerHTML = `<span class="route-kind">${esc(what)}</span><span>${esc(t("intentNoReview"))}</span>`;
    return;
  }
  // Which words put a lane on the path, on the tag itself. "Why is third-party
  // diligence being checked" is answered by the question, not by this system's
  // say-so — and where nothing matched, the hint says every lane runs rather
  // than showing three tags as though the question had been understood.
  host.innerHTML = `<span class="route-kind">${esc(t("intentReview"))}</span>`
    + verdict.agents.map((agent) => {
      const why = (verdict.reasons[agent] || []).join(" · ");
      return `<span class="route-tag"${why ? ` title="${esc(why)}"` : ""}>${esc(agentName(agent))}</span>`;
    }).join("")
    + (verdict.matched ? "" : `<span>${esc(t("intentAllLanes"))}</span>`)
    + willAskMarkup(verdict.agents);
}

// The fields this question will run into, minus the ones already supplied.
// Capped: a list of every field a review can ask for is a form, and a form in
// front of the question is what the single input box exists to avoid.
function willAskMarkup(agents) {
  const supplied = new Set(Object.entries(state.declaredFacts || {}).filter(([, value]) => String(value).trim()).map(([field]) => field));
  const asks = [];
  const seen = new Set();
  for (const agent of agents) {
    for (const ask of laneAsks.get(agent) || []) {
      if (!ask?.field || supplied.has(ask.field) || seen.has(ask.field)) continue;
      seen.add(ask.field);
      asks.push(ask.label.split(" / ")[0]);
    }
  }
  if (!asks.length) return "";
  const shown = asks.slice(0, 4);
  return `<span class="route-asks">${esc(t("willAsk"))}${esc(shown.join(" · "))}`
    + (asks.length > shown.length ? esc(t("willAskMore").replace("{n}", asks.length - shown.length)) : "")
    + "</span>";
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

// The flow rail: every step of the path as a node, so what has run, what is
// running and what has not been reached is answerable at a glance. The body of
// the answer only carries steps that have executed, and this is where the rest
// of the plan stays visible.
// Settled means the step is closed: established, declared by the user, or handed
// to a human. Reached-but-blocked is not progress.

// Shown at full height, folded into a summary line, or not drawn at all. Both
// sides use this so a step cannot be visible on one and absent on the other.
const FLOW_STATE = {
  skipped: { cls: "skipped", mark: "–" },
  confirmed: { cls: "done", mark: "✓" },
  not_applicable: { cls: "na", mark: "–" },
  declared: { cls: "declared", mark: "◐" },
  evidence_needed: { cls: "blocked", mark: "!" },
  review_required: { cls: "review", mark: "▲" },
  not_reached: { cls: "todo", mark: "" },
  pending: { cls: "todo", mark: "" }
};

// The last path the rail drew, so a redraw triggered by an interaction rather than
// by a stream event still has something to draw.
let lastFlowPath = null;
let lastAnalysed = [];
const collectedPath = () => lastFlowPath;

// A lookup has no analysis path, so the rail sat on "ask a question and the
// progress appears here" for the whole of it — half the screen given over to
// telling the reader that the thing they are doing is not the thing this panel
// is for. What belongs there instead is what they are looking at: which source,
// what it is for, how much of it there is and when it was captured. The reason a
// reader opens a source directly is usually to check a claim the analysis made
// about it, and that check needs the source's own terms in front of them.
function sourcePanelMarkup(source) {
  const sync = source.sync || {};
  const stale = sync.status === "fallback_snapshot";
  const rows = [
    [t("srcAuthority"), source.authority],
    [t("srcCountry"), source.country],
    [t("srcUpdates"), source.updateFrequency],
    [t("srcCaptured"), String(sync.capturedAt || sync.completedAt || "").slice(0, 10)]
  ].filter(([, value]) => value);

  return `
    <div class="src-panel">
      <div class="sp-head"><h3>${esc(source.sourceName || source.sourceId)}</h3>
        <span class="sp-count">${(sync.recordCount || 0).toLocaleString()}</span></div>
      <p class="sp-id">@${esc(source.sourceId)}</p>
      ${source.purpose ? `<p class="sp-purpose">${esc(localized(source.purpose))}</p>` : ""}
      <dl class="sp-facts">${rows.map(([label, value]) => `
        <div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
      ${stale ? `<p class="sp-stale">${esc(t("sourceArchived"))}</p>` : ""}
      ${source.attribution ? `<p class="sp-note">${esc(localized(source.attribution))}</p>` : ""}
      ${source.websiteUrl ? `<a class="sp-link" href="${esc(source.websiteUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("rsOpen"))}</a>` : ""}
      <p class="sp-boundary">${esc(t("srcBoundary"))}</p>
    </div>`;
}

// path === null means "redraw what is already there" — a stage or a lane changed
// and the path has not. clearFlowPanel is how a panel is actually emptied, and
// the two were the same call for a while, which is why a new conversation opened
// with the previous run's steps still in the rail.
function clearFlowPanel() {
  lastFlowPath = null;
  lastAnalysed = [];
  renderFlowPanel(null);
}

// The right column exists only when it has something in it.
//
// On the home page and on a new conversation it was two headings, an empty-state
// sentence and a zero — a fifth of the width spent saying nothing yet. Worse, it
// said it beside the one screen that is meant to teach what to type, so the eye
// went to the emptiest thing on the page.
//
// Derived rather than toggled at each call site: the panel's content comes from
// three unrelated places — a run's path, a source lookup, the evidence list —
// and a flag set by each of them is a flag one of them will forget to clear.
// state.busy is in the list so the column is already there when the first step
// arrives, instead of appearing under the reader a second into the run.
function syncEvidenceVisibility() {
  const has = Boolean(state.busy || lastFlowPath || state.sourceQuery
    || $("evidenceList").querySelector(".source-card"));
  $("app").classList.toggle("no-evidence", !has);
}

function renderFlowPanel(path, options = {}) {
  if (path) lastFlowPath = path;
  else path = lastFlowPath;
  // Which lanes a specialist has reported on, carried the same way the path is.
  //
  // visibleLanes draws a lane once it has been analysed even if nothing in it
  // settled, and the body passed that set while the rail passed nothing — so a
  // lane whose specialist had reported appeared on the left and not on the
  // right. It is the last of the inputs the two panels did not share.
  if (options.analysed) lastAnalysed = options.analysed;
  options = { ...options, analysed: options.analysed || lastAnalysed };
  // Set while a continuation is running so the rail marks the step it started
  // from rather than recomputing one from a path that has not caught up.
  if (state.resumingStep) options = { ...options, currentStep: state.resumingStep };
  const panel = $("flowPanel");
  // Same fields into both, or the rail nominates a step the reader has already
  // declined as the one blocking the run.
  const declined = state.unavailableFacts;
  const markup = flowMarkup(path, { ...options, declined, firstBlocked: path ? firstBlockedStep(path, declined) : null });
  // While a source is open the panel belongs to that source, not to an analysis
  // path that this kind of question never produces.
  const sourceView = !markup && state.sourceQuery ? sourcePanelMarkup(state.sourceQuery) : "";
  panel.innerHTML = markup || sourceView || `<p class="evidence-empty">${esc(t("flowEmpty"))}</p>`;
  hydrateBars(panel);
  // Below the breakpoint that hides the right column the rail has to live
  // somewhere, so the same markup is mirrored into the answer and CSS picks one.
  document.querySelectorAll(".flow-inline").forEach((host) => { host.innerHTML = markup; hydrateBars(host); });
  syncEvidenceVisibility();
}

// One row, so the folded list and the open one cannot describe the same step
// differently. The rail's fold used to be a dead count line while the body's was
// expandable and named what was inside — a reader who skipped ownership could
// see it named on the left and had no way to reach it on the right.
function flowStepRow(item, { asking, options, triggered, muted = false } = {}) {
  // The declined fields have to reach here too. Without them the fold said "2
  // skipped" and every row inside it drew the "!" of a live question, because the
  // enclosing laneView knew about the declined fields and the row did not.
  const view = stepState(item, options?.declined);
  const shape = FLOW_STATE[view] || FLOW_STATE[item.status] || FLOW_STATE.pending;
  const current = !muted && item.id === asking;
  // "Running" used to mean only "a continuation is in flight", so during an
  // ordinary run — the whole of retrieval, screening and the specialists — the
  // rail marked a step as current and said nothing about whether anything was
  // happening to it. A reader watching a static rail cannot tell work from a hang.
  const isRunning = current && Boolean(options?.currentStep || options?.activeLane || options?.stage);
  const title = [view === "skipped" ? t("stSkipped") : label(STEP_STATUS_VOCAB, item.status, state.locale), item.needs?.[0] || item.basis?.[0] || ""]
    .filter(Boolean).join(" — ");
  return `
    <li class="fl-step ${shape.cls} ${current ? "current" : ""} ${isRunning ? "is-running" : ""}">
      <button type="button" data-flow-step="${esc(item.id)}" title="${esc(title)}">
        <span class="fl-node" aria-hidden="true">${shape.mark}</span>
        ${triggered?.has(item.id) ? `<span class="fl-trigger" title="${esc(t("stepTriggered"))}">＋</span>` : ""}
        <span class="fl-text">${esc(item.title)}</span>
      </button>
    </li>`;
}

function flowMarkup(path, options = {}) {
  if (!path?.lanes?.length) return "";
  // Two counts that could not be reconciled, and the reader was right to ask.
  //
  // The header counts the whole run, which is the true size of it. The list
  // below draws what visibleLanes returns, and that deliberately stops at the
  // lane holding the open question — one question at a time — so later lanes are
  // withheld along with their steps. Neither number was wrong; what was missing
  // was any sign that the difference existed, so "4/12" sat above a single lane
  // reading "4/5" with nothing to explain the other seven.
  //
  // The header stays the whole run. What is withheld is said out loud at the foot
  // of the rail, which is the only thing that makes the two add up — and it says
  // why, because "5/12" beside a finished answer otherwise reads as a run that
  // stopped early. Nothing stopped: the later lanes were never reached, and that
  // is exactly what makes the conclusion interim rather than closed.
  // state.unavailableFacts here too, not options.declined. The same function was
  // reading one for firstBlockedStep and laneView and the other for the lane set,
  // so a declined field could change which steps a lane shows without changing
  // which lanes are shown.
  const drawn = visibleLanes(path, {
    activeLane: options.activeLane, declined: state.unavailableFacts,
    allowInput: true, analysed: options.analysed || []
  });
  const steps = path.lanes.flatMap((lane) => lane.steps);
  const shownIds = new Set(drawn.map((lane) => lane.lane));
  const withheld = path.lanes.filter((lane) => !shownIds.has(lane.lane) && lane.steps.length);
  const withheldSteps = withheld.reduce((sum, lane) => sum + lane.steps.length, 0);
  // Both halves of the difference, or the sentence only explains one of them.
  // Saying "seven more steps" accounts for 12 against the 5 shown, but leaves a
  // header reading 5 settled above a lane reading 4 — the fifth is settled in a
  // lane that is not on screen, and unsaid that is just a second unexplained
  // number under the first.
  const withheldDone = withheld.reduce((sum, lane) => sum + lane.steps.filter(isDone).length, 0);
  // Progress counts what is settled, not what has merely been reached. A step
  // waiting on evidence had been counted as done, so answering six questions in a
  // row moved the number not at all — the one place a reader looks to see that
  // their answers are getting somewhere.
  const executed = steps.filter(isDone).length;
  // Three meanings of "current" and the rail kept picking the wrong one. While a
  // continuation is in flight it is the step the reader just submitted — the one
  // showing "continuing the analysis" — and computing a fresh guess put the rail
  // on a later step the body was not working on. While a specialist is running it
  // is that lane. Otherwise it is the question waiting on the reader.
  const asking = currentStepId(path, options);
  // The local wrapper already reads state.unavailableFacts; passing a second
  // argument would look like it decided something and would not.
  const blocked = options.firstBlocked ?? firstBlockedStep(path);
  // What the run came to, not how far along it is.
  //
  // A fraction over a part-filled bar is a progress reading, and a progress
  // reading on a finished review says it stalled: "5/17" beside a written
  // conclusion asks "did it not run?" when the answer is that it ran everything
  // and 5 of the 17 steps could be settled on what the question carried. The
  // other twelve are not pending — they are short of evidence, or they were
  // never reached because an earlier step was. So the bar shows the make-up of
  // the outcome in three parts rather than one moving edge, and the three
  // numbers say which is which.
  // One number per status, not three buckets.
  //
  // The first bucket was labelled 已确认 and held everything isDone counts —
  // confirmed, declared and not applicable together. On a run where the reader
  // had supplied several facts that read "11 已确认" when three were confirmed,
  // five were declared and unverified, and three did not apply. Declared is the
  // one this system may never let drift into confirmed, and a tally that merges
  // them is exactly that drift. Each status now reports itself, under its own
  // name and in its own colour, both from STEP_STATUS_VOCAB so the tally, the
  // bar and the step marks cannot disagree.
  const ORDER = ["confirmed", "declared", "not_applicable", "evidence_needed", "review_required", "not_reached", "pending"];
  const counts = new Map();
  for (const item of steps) counts.set(item.status, (counts.get(item.status) || 0) + 1);
  // The short name for a tally, the full one for a step. "已声明，待核验" is the
  // right label above a step the reader just filled in and too long to sit five
  // abreast in a 316px column; the short forms already exist for the legend.
  const SHORT = { confirmed: "stConfirmed", declared: "stDeclared", evidence_needed: "stEvidence", not_reached: "stNotReached", pending: "stPending" };
  const tally = ORDER.filter((status) => counts.get(status)).map((status) => ({
    status, n: counts.get(status), vocab: STEP_STATUS_VOCAB[status],
    name: SHORT[status] ? t(SHORT[status]) : label(STEP_STATUS_VOCAB, status, state.locale)
  }));
  const share = (n) => Math.round((n / steps.length) * 100);
  const running = Boolean(options.activeLane || options.stage);

  return `
    <div class="flow-head">
      <h3>${esc(t("flowTitle"))}</h3>
      <span class="flow-count">${running ? `${executed}/${steps.length}` : esc(t("flowDone"))}</span>
    </div>
    <div class="flow-bar${running ? "" : " is-mix"}" role="img" aria-label="${executed}/${steps.length}">
      ${running ? `<span class="fb-fill" data-bar="${share(executed)}"></span>`
        : tally.map((part) => `<span class="fb-part tone-${esc(part.vocab.tone)}" data-bar="${share(part.n)}"></span>`).join("")}
    </div>
    ${running ? "" : `<p class="flow-tally">
      ${tally.map((part) => `<span class="ft-part"><b class="tone-${esc(part.vocab.tone)}">${part.n}</b> ${esc(part.name)}</span>`).join(`<span class="ft-sep">·</span>`)}
      <span class="ft-of">${esc(t("flowOf").replace("{n}", steps.length))}</span>
    </p>`}
    ${drawn.map((lane) => {
      // The same view the body draws, from the same rule, so the two panels
      // cannot list different steps for one run.
      // The lane's own question, from the shared rule — not the run's single
      // current step handed to every lane, which is what made the two panels
      // list different steps for the same run.
      const view = laneView(lane, {
        question: laneQuestion(lane, { blocked, runningStep: asking, declined: options.declined }),
        declined: options.declined
      });
      const triggered = new Set((path.triggered || []).map((edge) => edge.to?.step));
      const laneFolded = view.folded;
      const running = options.activeLane === lane.lane;
      return `
      <section class="flow-lane ${running ? "running" : ""}">
        <div class="fl-head">
          <span class="fl-label">${esc(lane.label)}</span>
          ${running ? `<span class="thinking-dot" aria-hidden="true"></span><span class="fl-running">${esc(t("laneRunning"))}</span>` : ""}
          <span class="fl-progress">${view.settled}/${view.total}</span>
        </div>
        <ol class="fl-steps">${view.shown.map((item) => flowStepRow(item, { asking, options, triggered })).join("")}</ol>
        ${view.unreached ? `<p class="fl-rest">${esc(t("laneUnreached").replace("{n}", view.unreached))}</p>` : ""}
        ${laneFolded.length ? `<details class="fl-folded">
          <summary>${esc(t("flowFolded").replace("{n}", laneFolded.length))}</summary>
          <ol class="fl-steps">${laneFolded.map((item) => flowStepRow(item, { asking, options, triggered, muted: true })).join("")}</ol>
        </details>` : ""}
      </section>`;
    }).join("")}
    ${withheldSteps ? `<p class="flow-rest">${esc(t(withheldDone ? "flowRestDone" : "flowRest")
        .replace("{n}", withheldSteps).replace("{done}", withheldDone)
        .replace("{lanes}", withheld.map((lane) => lane.label).join("、")))}</p>` : ""}
    <div class="flow-legend">
      <span class="fl-key done">✓ ${esc(t("stConfirmed"))}</span>
      <span class="fl-key blocked">! ${esc(t("stEvidence"))}</span>
      <span class="fl-key todo">○ ${esc(t("stNotReached"))}</span>
    </div>`;
}

function renderEvidence(sources) {
  $("sourceCount").textContent = sources.length;
  if (!sources.length) {
    $("evidenceList").innerHTML = `<p class="evidence-empty">${t("evidenceEmpty")}</p>`;
    syncEvidenceVisibility();
    return;
  }
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
      ${/* What a failure here costs, because "获取失败" beside a source whose data
            is synced on the coverage page reads as that source being broken. It is
            not the same thing: these cards are reference documents a specialist
            reads, and list screening never touches them — it runs on the ingested
            records. Saying so is a statement about how the system is wired, not a
            claim about this particular source's data, which these ids cannot
            support: the failing page is ofac-50-rule and the synced lists are
            ofac-ownership and ofac-sls. */ ""}
      ${["unavailable", "metadata_only"].includes(source.liveStatus)
        ? `<p class="source-note">${esc(t("sourceFellBack"))}</p>` : ""}
    </article>`).join("");
  syncEvidenceVisibility();
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
// A declaration can be corrected. What the reader typed is the one thing on the
// page they are certain about — and it was the one thing they could not change:
// once submitted, the form was replaced by the answer it produced, and a
// mistyped registration number could only be fixed by asking the whole question
// again. The form is re-offered carrying what was declared, so a correction is
// an edit rather than a restart.
// A choice between register records is not a value to pick off a list of eight
// country codes, and it was being drawn as one: a full-width bordered box of
// monospace text, sitting directly above a real text input that had the same
// border, the same radius and the same width. It read as a second field to type
// into.
//
// The option carries its own structure — name｜country city｜LEI — so it is laid
// out as a record: the name leads, the things that distinguish it follow in
// smaller type, and a radio mark says the row is to be chosen rather than filled
// in. data-value keeps the whole original string, because that is what the
// answer is parsed back out of.
const RECORD_PARTS = /\s*｜\s*/;

function choiceMarkup(option, field, selected, asRecord) {
  const attrs = `data-field="${esc(field)}" data-value="${esc(option)}"`;
  // A country code or a percentage band is a value, and a chip is the right
  // shape for it.
  if (!asRecord) {
    return `<button type="button" class="si-choice${selected ? " on" : ""}" ${attrs}>${esc(option)}</button>`;
  }
  // Every option in a record group is drawn as a record, including "none of
  // these" — it is one of the same mutually exclusive answers, and rendering it
  // as a chip left it stretched across the group and centred while everything
  // above it was left aligned. It simply has no second line.
  const [title, ...meta] = option.split(RECORD_PARTS);
  return `<button type="button" class="si-choice si-record${selected ? " on" : ""}" ${attrs}>
            <span class="si-radio" aria-hidden="true"></span>
            <span class="si-record-text">
              <span class="si-record-title">${esc(title)}</span>
              ${meta.length ? `<span class="si-record-meta">${esc(meta.join(" · "))}</span>` : ""}
            </span>
          </button>`;
}

function stepInputsMarkup(item, { values = null, collapsed = false, outstanding = false } = {}) {
  const filled = (field) => (values ? String(values[field] ?? "") : "");
  return `
    <div class="step-inputs${collapsed ? " si-collapsed" : ""}"${outstanding ? " data-outstanding" : ""} data-step="${esc(item.id)}">
      ${item.inputs.filter((input) => input.kind !== "choice" || input.options?.length).map((input) => input.kind === "choice"
        ? (() => {
          // One option carrying a separator makes the whole group a record
          // choice, so the group is laid out one way rather than per option.
          const asRecords = input.options.some((option) => RECORD_PARTS.test(option));
          return `<div class="si-row">
             <span class="si-label">${esc(input.label)}</span>
             <div class="si-choices${asRecords ? " si-choices-records" : ""}">${input.options.map((option) =>
              choiceMarkup(option, input.field, filled(input.field) === option, asRecords)).join("")}</div>
           </div>`;
        })()
        : `<div class="si-row">
             <span class="si-label">${esc(input.label)}</span>
             <input class="si-text" type="text" data-field="${esc(input.field)}" maxlength="300" value="${esc(filled(input.field))}" placeholder="${esc(t("declarePlaceholder"))}">
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
// Which step is being asked is the server's answer, not the client's guess. They
// were computed independently and drifted the moment a user declined a question:
// the run moved past it, the page recomputed the same step from the path and asked
// again, and declining did nothing for ever. The path carries the run's own answer
// now, and this only fills in for a path that predates it.
// The shared rules, supplied with this page's declined fields. The rules live in
// status-vocabulary.js so the rail, the body and the tests all read one
// definition; what a given reader has passed over is this page's business.
const isAskable = (item) => askable(item, state.unavailableFacts);
const stepState = (item) => state_(item, state.unavailableFacts);

const firstBlockedStep = (path) => blockedStep(path, state.unavailableFacts);

// A fact the question did not carry is a fact the reader has not got.
//
// The run used to end pointing at the first thing it could not settle, and the
// page went there: a finished answer, and then the reader put back inside the
// analysis at a step waiting to be filled in. But a transaction described
// without a registration number is almost never one where the number was to
// hand and got left out — it is one where nobody has it, or nobody knows where
// it is kept. Asking again on the page changes none of that; it only moves the
// reader away from the answer.
//
// So an ask that went unanswered in the question is not asked again. The fields
// go into the same list the reader's own "not available" fills, which makes the
// steps read as skipped rather than waiting, and every consequence follows from
// that one fact: no step is blocking, so nothing is marked as current, nothing
// scrolls back into the path, and the closing lane is drawn. What is missing is
// said once, in the conclusion, where 建议补充 already lists it by field.
//
// Supplying it later still works and still continues the same review: the form
// stays in the answer, collapsed and silent, and a follow-up typed into the
// composer is routed to it.
function retireUnansweredAsks(path) {
  const fields = (path?.lanes || []).flatMap((lane) => lane.steps)
    .filter((step) => step.status === "evidence_needed")
    .flatMap((step) => (step.inputs || []).map((input) => input.field))
    .filter(Boolean);
  // No guard against a declared field: a step whose fact was supplied carries
  // status "declared", not "evidence_needed", so it is never collected here. The
  // guard only ever excluded a field that a later turn had answered, which left
  // an earlier turn's step still reading as one waiting to be filled in.
  const known = new Set(state.unavailableFacts);
  const added = [...new Set(fields.filter((field) => !known.has(field)))];
  if (added.length) state.unavailableFacts = [...state.unavailableFacts, ...added];
}

// "Why these steps" answered from data the plan already carries: which words in
// the question selected the check, which published procedure supplies its steps,
// and which steps had no provision and were planned by the system.
// Where the path came from, one line per check: what selected it, which
// published procedure supplies its steps, and how many of those steps had no
// provision and were planned here. It was three labelled rows per check, twelve
// rows of preamble before any analysis, saying the same thing at greater length.
// The briefing, before any step runs.
//
// A compliance review is not a verdict that arrives; it is a procedure someone
// agreed to follow. So the answer opens by saying which scopes the question falls
// into and why, which published procedure governs each, and the steps that
// procedure lays down — in the order they will be worked through. Where no
// procedure exists the step says it was designed here rather than borrowing the
// authority of one that was not.
//
// It lists the whole plan while the body below shows only what has run, which is
// what makes progress legible: the plan is stated once, the work arrives against
// it, and the flow rail is the same list again.
function derivationMarkup(path) {
  // Only the gates. What the scope list carried is now on the lanes themselves.
  //
  // It named every scope, why it was selected and which procedure governs it —
  // and then the body named the same scopes again with their steps and status.
  // Two lists of the same four things, the first one arriving before any
  // analysis. What was not duplicated was the matched terms and the procedure
  // link, so those moved down to the lane they describe rather than being lost
  // with the block that held them.
  //
  // The gates stay here and stay first. They are the record of a review that was
  // shortened — which steps were not run, and under which rule — and nothing
  // else on the page says it. Silent shortening is the one thing a compliance
  // tool must not do.
  const gates = path?.triage || [];
  if (!gates.length) return "";
  return `
    <section class="briefing">
      <ul class="bf-triage">
        ${gates.map((gate) => `<li><span class="bt-mark">−</span>${esc(gate.because)}<span class="bt-cite">${esc(gate.cite)}</span></li>`).join("")}
      </ul>
    </section>`;
}

// Streamed reasoning always looks the same wherever it appears: a label saying
// whose it is, the text, and a placeholder that runs until the first token lands.
// Without the placeholder the gap between "started" and "first token" — several
// seconds on a live model — looks like nothing happening at all.
function streamBoxMarkup(attr) {
  return `<div class="stream-box" ${attr}>
    <div class="sb-who"></div>
    <div class="sb-text"></div>
    <div class="sb-dots" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>`;
}

// The text pane is the scroller, so a long run stays inside its own box instead
// of pushing the rest of the answer down the page, and it follows the output.
function setStream(box, who, text) {
  if (!box) return;
  if (who !== null) box.querySelector(".sb-who").textContent = who || "";
  const pane = box.querySelector(".sb-text");
  pane.textContent = text || "";
  box.classList.toggle("is-live", Boolean(who) || Boolean(text));
  box.classList.toggle("is-waiting", !text);
  pane.scrollTop = pane.scrollHeight;
}

function pathMarkup(path, grounding, options = {}) {
  if (!path?.lanes?.length) return "";
  // The declined fields belong in here as much as in laneView below. Left out,
  // the final render re-offered the very step the reader had said they had
  // nothing for, as the one thing blocking the run.
  // Why this lane opened and which procedure supplies its steps, keyed by lane.
  // It used to be a list of its own above the answer, alongside a second list of
  // the same lanes; here it is attached to the lane it is about.
  const derivedBy = new Map((path.derivation || []).map((row) => [row.lane, row]));
  const blocked = options.allowInput === false ? null : firstBlockedStep(path, state.unavailableFacts);
  // The step a later answer would belong to, whether or not anything is waiting
  // on it — which, since asks are retired, is never.
  const outstanding = options.allowInput === false ? null
    : path.lanes.flatMap((lane) => lane.steps).find((item) => item.status === "evidence_needed" && item.inputs?.length)?.id || null;
  // The same step the rail marks, from the same rule. Two panels naming
  // different steps as current is the fault this pair has had in a dozen forms,
  // and it is also what left the body with nothing to scroll to.

  const activeLane = options.activeLane || null;
  const doneLanes = options.doneLanes || new Set();
  const results = options.results || [];
  const settled = (item) => SETTLED_STATUS.has(item.status);
  // Forward-only reveal, per lane. A lane that has been analysed keeps everything
  // it established plus its own next open question; a lane that has not run is not
  // drawn at all. Deciding this globally hid whole lanes that had just produced a
  // verdict and findings, because their reached steps were all blocked and only
  // the first blocked step in the whole path was being shown — two thirds of a
  // finished analysis simply disappeared.
  // One definition of "still being asked", used everywhere.
  //
  // This was decided independently in three places — which lane to draw, which
  // step in it is the question, and where to stop drawing — and they disagreed the
  // moment a reader declined something. A declined step stays outstanding but is
  // no longer a question, so a lane holding only declined steps is finished with
  // the reader and the page must move on to the next one. Getting that wrong
  // stalled the run twice with no question on the page and no conclusion.
  const askable = isAskable;
  // A step that is on the board because an earlier finding put it there. Shown
  // on the step itself: a check that appears mid-review reads as arbitrary
  // unless it says what required it.
  const triggers = new Map((path.triggered || []).map((edge) => [edge.to?.step, edge]));
  const triggerFor = (id) => {
    const edge = triggers.get(id);
    if (!edge) return null;
    return { note: `${state.locale === "en" ? edge.en : edge.zh}${edge.because ? `（${edge.because}）` : ""}${edge.cite ? ` — ${edge.cite}` : ""}` };
  };
  // The same step the rail marks, from the same rule. Two panels naming
  // different steps as current is the fault this pair has had in a dozen forms,
  // and it is also what left the body with nothing to scroll to.
  const runningStep = currentStepId(path, { ...options, declined: state.unavailableFacts, firstBlocked: blocked });
  const analysed = new Set(results.map((item) => item.agent));

  // Strictly one check at a time. Lanes are drawn in order and drawing stops at
  // the first one still waiting on the reader — so while Trade has a question
  // open, Product is not on the page at all, however much of it retrieval happened
  // to settle. How much is left overall is the flow rail's job, which is why the
  // rail always shows every lane.
  const ordered = visibleLanes(path, {
    activeLane, declined: state.unavailableFacts,
    allowInput: options.allowInput !== false, analysed: [...analysed]
  });

  const lanes = ordered
    .map((lane) => {
      const question = laneQuestion(lane, { blocked, runningStep, declined: state.unavailableFacts });
      // A step whose conditions never arose is finished business: it needs no
      // reading and no action. Kept, because why it did not arise is part of the
      // record, but folded into one line so it does not sit at full height among
      // the steps that did happen. The rule is shared with the rail, so the two
      // panels cannot list different steps for one run.
      const view = laneView(lane, { question, declined: state.unavailableFacts });
      const notApplicable = view.folded;
      const steps = view.shown;
      const result = results.find((item) => item.agent === lane.lane);
      const running = options.runningLanes ? options.runningLanes.has(lane.lane) : lane.lane === activeLane;
      if (!steps.length && !result && !running) return "";
      const laneState = running ? "running" : doneLanes.has(lane.lane) ? "done" : "";
      return `
        <section class="path-lane ${laneState}" data-lane="${esc(lane.lane)}">
          <div class="path-lane-label">
            ${esc(lane.label)}
            ${/* The specialist's own verdict and one-line reading belong to its
                  lane. They used to sit in a separate collapsed trace at the foot
                  of the answer, detached from the steps they explain. */ ""}
            ${result ? `<span class="risk-chip risk-${esc(result.riskLevel)}">${esc(riskLabel(result.riskLevel))}</span>` : ""}
            ${running ? `<span class="thinking-dot" aria-hidden="true"></span><span class="lane-state">${esc(t("laneRunning"))}</span>` : ""}
            ${(() => {
              const row = derivedBy.get(lane.lane);
              if (!row) return "";
              const why = row.matchedTerms?.length
                ? row.matchedTerms.map((term) => `<code>${esc(term)}</code>`).join("")
                : `<span class="ll-why">${esc(t(`derivMatch_${row.matchedBy}`))}</span>`;
              const std = row.methodology?.kind === "official" && row.methodology.label
                ? (row.methodology.url
                  ? `<a class="ll-std" href="${esc(row.methodology.url)}" target="_blank" rel="noopener noreferrer">${esc(row.methodology.label)}</a>`
                  : `<span class="ll-std">${esc(row.methodology.label)}</span>`)
                : `<span class="ll-std ll-none">${esc(t("briefNoStandard"))}</span>`;
              return `<span class="lane-meta">${why}${std}</span>`;
            })()}
          </div>
          ${result?.summary ? `<p class="lane-verdict">${esc(result.summary)}</p>` : ""}
          <ol class="path-steps">${steps.map((item) => {
            const passedOver = state_(item, state.unavailableFacts) === "skipped";
            const stepTone = passedOver ? "muted" : tone(STEP_STATUS_VOCAB, item.status);
            const mark = passedOver ? "–" : (STEP_STATUS_VOCAB[item.status]?.mark || "·");
            const asking = item.id === blocked;   // one form at a time, path order
            // A settled step opens shut.
            //
            // Every step showed every line it stood on, always — nine list
            // sources one per line, the method behind each comparison, the
            // provisions consulted. Measured across stored cases that working is
            // 58% of the words in an answer, and almost all of it belongs to
            // steps that came out settled. It is audit material and it is worth
            // keeping; it is not what someone reads to learn what the answer is.
            //
            // So what is unresolved stays open — that is the part still in play —
            // and what is settled shows its verdict and its provision with the
            // working one click behind the same toggle that was always there.
            // Shut once a step is no longer live. Settled steps are audit
            // material; a retired ask is the same — it will not be filled in
            // here, and what it wanted is listed in the conclusion. Only a
            // declared step stays open, because a reader who just supplied
            // something should see what it did.
            const shut = (SETTLED_STATUS.has(item.status) || passedOver)
              && item.status !== "declared" && item.id !== blocked;
            return `
            <li class="path-step tone-${stepTone} ${shut ? "shut" : "open"} ${asking ? "asking" : ""} ${passedOver ? "passed-over" : ""} ${item.id === runningStep ? "running" : ""}" data-step-id="${esc(item.id)}">
              <span class="step-mark" aria-hidden="true">${mark}</span>
              <div class="step-body">
                <button type="button" class="step-head" data-step-toggle aria-expanded="${shut ? "false" : "true"}">
                  <strong>${esc(item.title)}</strong>
                  <span class="step-status">${esc(passedOver ? t("stSkipped") : label(STEP_STATUS_VOCAB, item.status, state.locale))}</span>
                  ${triggerFor(item.id) ? `<span class="step-trigger" title="${esc(triggerFor(item.id).note)}">${esc(t("stepTriggered"))}</span>` : ""}
                  ${item.cite ? `<span class="step-cite ${item.methodology === "derived" ? "derived" : ""}" title="${esc(item.citeNote || "")}">${esc(item.cite)}</span>` : ""}
                </button>
                <div class="step-detail-wrap">
                  ${item.basis.length ? `<ul class="step-basis">${item.basis.map((line) => {
                    const sourceRef = String(line).match(/^([a-z0-9-]{4,32})[：:]/);
                    const known = sourceRef && (state.coverage?.sources || []).some((source) => source.sourceId === sourceRef[1]);
                    // Text and button in one cell. The list item is a two-column
                    // grid — a label and the line — so a button left as a sibling
                    // of the text became a third grid item and dropped to its own
                    // row, a database icon sitting alone under every source line.
                    return `<li><span class="basis-line">${formatInline(line)}${known ? `<button type="button" class="jump-source" data-jump-source="${esc(sourceRef[1])}" title="${esc(t("jumpSource"))}">⛁</button>` : ""}</span></li>`;
                  }).join("")}</ul>` : ""}
                  ${item.needs.length ? `<ul class="step-needs">${item.needs.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>` : ""}
                  ${stepDetailMarkup(item, grounding)}
                  ${/* Stated, not asked. The run does not wait for this and the
                        conclusion above was already written without it; an open
                        input box under a finished answer says otherwise, and read
                        as the analysis having stopped for the reader. The fields
                        are still here, one click away, because supplying the fact
                        does still carry the review further. */ ""}
                  ${/* No sentence and no link: nothing is being asked. The fields
                        are still here, collapsed and unannounced, because a fact
                        typed into the composer afterwards is routed to them and
                        carries the same review further. */ ""}
                  ${outstanding === item.id ? stepInputsMarkup(item, { collapsed: true, outstanding: true }) : ""}
                  ${!asking && item.status === "declared" && item.inputs?.length ? `
                    <p class="step-redo"><button type="button" class="si-redo">${esc(t("declareRedo"))}</button></p>
                    ${stepInputsMarkup(item, { values: state.declaredFacts, collapsed: true })}` : ""}
                </div>
              </div>
            </li>`;
          }).join("")}</ol>
          ${view.unreached ? `<p class="lane-rest">${esc(t("laneUnreached").replace("{n}", view.unreached))}</p>` : ""}
          ${notApplicable.length ? `<details class="lane-na">
            <summary>${esc(t("naCount").replace("{n}", notApplicable.length))}</summary>
            <ul>${notApplicable.map((item) => `<li><b>${esc(item.title)}</b>${item.basis?.[0] ? ` — ${formatInline(item.basis[0])}` : ""}</li>`).join("")}</ul>
          </details>` : ""}
          ${result?.findings?.length ? `<p class="lane-findings-label">${esc(t("laneFindings"))}</p><ul class="lane-findings">${result.findings.map((finding) => `
            <li><b>${esc(finding.title)}</b> ${formatInline(finding.detail)}${(finding.evidenceSourceIds || []).length
              ? `<span class="cite">${finding.evidenceSourceIds.map((id) => `<span>${esc(id)}</span>`).join("")}</span>` : ""}</li>`).join("")}</ul>` : ""}
          ${streamBoxMarkup(`data-lane-stream="${esc(lane.lane)}"`)}
        </section>`;
    });

  return `
    <section class="analysis-path">
      ${derivationMarkup(path)}
      <div class="flow-inline">${flowMarkup(path, options)}</div>
      ${lanes.join("")}
    </section>`;
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

// The five conditions, drawn from what was computed rather than from what a
// model said about it.
//
// This is the one block on the page that does not depend on a model having run:
// clearance is decided in code, before the lanes start, and each condition
// carries the provision it rests on. Showing it is what lets a reader check the
// conclusion instead of taking it — and, when a case does not clear, see which
// condition stopped it rather than being told the file is incomplete.
// The lane in the reader's language. agentName() is the short English tag the
// route chips use; inside a Chinese answer body "Product" is the wrong register
// and, more to the point, does not match the name the same lane carries in the
// flow rail two panels away.
const laneLabel = (lane) =>
  (state.locale === "en" ? AGENT_META[lane]?.name : AGENT_META[lane]?.nameZh) || agentName(lane);

function clearanceMarkup(clearance) {
  if (!clearance?.checks?.length) return "";
  const unmet = clearance.checks.filter((check) => !check.met);
  const open = clearance.openSteps?.length || 0;
  // Unmet first. A reader opening this is looking for what to do next, and that
  // is never in the list of things already settled.
  const ordered = [...unmet, ...clearance.checks.filter((check) => check.met)];
  const verdict = clearance.cleared
    ? t("clearanceCleared")
    : unmet.length ? t("clearanceBlocked").replace("{n}", unmet.length) : "";
  // The verdict sentence, and the five conditions behind it.
  //
  // The sentence already says the thing a reader needs — all five met, or how
  // many are not, or that an open step blocks a clear conclusion anyway. Under
  // it sat the five conditions restated in full, each with its state, its lanes,
  // its reason and its provision, saying the same thing at five times the
  // length. It is what the verdict stands on, so it stays; it is not what the
  // verdict is, so it is not the default view.
  return `
    <div class="answer-extra is-clearance">
      ${verdict ? `<p class="cl-verdict ${clearance.cleared ? "ok" : "blocked"}">${esc(verdict)}</p>` : ""}
      ${open ? `<p class="cl-open">${esc(t("clearanceOpen").replace("{n}", open))}</p>` : ""}
      <details class="cl-detail">
      <summary>${esc(t("clearanceTitle"))}</summary>
      <p class="ae-note">${esc(t("clearanceNote"))}</p>
      <ol class="cl-list">
        ${ordered.map((check) => `
          <li class="cl-item ${check.met ? "met" : "unmet"}">
            <span class="cl-mark" aria-hidden="true">${check.met ? "✓" : "!"}</span>
            <div>
              <span class="cl-title">${esc(check.title)}</span>
              <span class="cl-state">${esc(check.met ? t("clearanceMet") : t("clearanceUnmet"))}</span>
              ${check.lanes.map((lane) => `<span class="cl-lane">${esc(laneLabel(lane))}</span>`).join("")}
              <p class="cl-because">${formatInline(check.because)}</p>
              ${check.cite ? `<p class="cl-cite">${esc(check.cite)}</p>` : ""}
            </div>
          </li>`).join("")}
      </ol>
      </details>
    </div>`;
}

// Which ones, not just how many.
//
// An outstanding item means the analysis is not finished, so it does not present
// a conclusion as if it were. The verdict on incomplete facts is still shown —
// withholding it would hide the reasoning that has been done — but it is labelled
// as interim and folded away, and what leads is the request for what is missing.
function conclusionMarkup(data) {
  const synthesis = data.synthesis;
  // The run stopped at a question, so there is no conclusion and nothing to put
  // at the foot of the answer. The last thing on screen is the question itself,
  // which is where the reader should be looking.
  if (!synthesis) return `<section class="conclusion"></section>`;
  const steps = (data.analysisPath?.lanes || []).flatMap((lane) => lane.steps);
  const outstanding = steps.filter((item) => item.status === "evidence_needed");
  const suggested = data.actionPlan?.suggested || [];
  const limits = data.grounding?.limitations || [];
  // Both of these hang off the conclusion, and both need saying what they are.
  // The suggestions arrived as an unlabelled block of imperatives directly under
  // the summary, with nothing to explain where they came from or what weight they
  // carry — and flush against the frame, because the answer box carries no padding
  // of its own and its head brings its own.
  const block = (label, note, items, cls) => (items.length ? `
    <div class="answer-extra ${cls}">
      <div class="ae-label">${esc(label)}</div>
      ${note ? `<p class="ae-note">${esc(note)}</p>` : ""}
      <ul>${items.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>
    </div>` : "");
  // Folded for the same reason. What bounds a conclusion has to be reachable
  // from it and does not have to be read before it.
  const foldedBlock = (label, note, items, cls) => (items.length ? `
    <div class="answer-extra ${cls}">
      <details><summary>${esc(label)}${esc(t("countSuffix").replace("{n}", items.length))}</summary>
        ${note ? `<p class="ae-note">${esc(note)}</p>` : ""}
        <ul>${items.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>
      </details>
    </div>` : "");
  const limitsBlock = foldedBlock(t("limitations"), "", limits, "is-limits");
  // What is missing, as things to supply rather than as a count.
  //
  // The conclusion said "尚有 N 项未补齐" and named the first three steps, which
  // tells a reader how far short the answer falls and nothing about what to do
  // about it — the actual fields lived only in the collapsed form beside the
  // step, further down and behind a click. They belong with the other advice the
  // answer gives, because supplying them is the recommended action.
  const askFor = outstanding.map((step) => {
    const fields = (step.inputs || []).map((input) => localized(input.label).split(" / ")[0]);
    return fields.length ? `**${localized(step.title)}** — ${fields.join("、")}` : `**${localized(step.title)}**`;
  });
  const askBlock = () => block(t("askFor"), t("declareNote"), askFor, "is-askfor");
  const suggestedBlock = () => foldedBlock(t("planSuggested"), t("planSuggestedNote"), suggested, "is-suggested");
  // Above the limits and below the verdict: it is the working behind the verdict,
  // not a caveat on it. Absent for a briefing, a lookup or a memo, which have no
  // clearance to assess and never carry the field.
  const clearanceBlock = clearanceMarkup(data.grounding?.clearance);

  // Only an assessment carries a risk level. A briefing, a lookup or a memo
  // answers a question of fact, and stamping "待定" on it claims an assessment
  // was attempted and came back inconclusive — when none was attempted at all.
  const risk = synthesis.overallRisk;
  const verdict = `
    <div class="answer-head${risk ? "" : " no-risk"}">
      ${risk ? `<span class="risk-mark risk-${esc(risk)}">${esc(riskLabel(risk))}</span>` : ""}
      <div>
        <h3>${esc(synthesis.headline)}</h3>
        <div class="prose">${formatBlock(synthesis.executiveSummary)}</div>
      </div>
    </div>`;

  // One stable wrapper whatever the state, because a patched answer has to be
  // findable: the open form and the closed form are different elements, and
  // patching on the closed one silently left a stale footer behind.
  if (!outstanding.length) {
    return `<section class="conclusion"><section class="answer">${verdict}
      ${suggestedBlock()}
      ${clearanceBlock}
      ${limitsBlock}
    </section></section>`;
  }

  // Where the analysis is waiting is where it says so and where it is answered:
  // the prompt stays at the step, not here, because the thing to act on should
  // not be the furthest thing from the thing it is about.
  //
  // But the judgement itself is shown. Collapsing it behind a summary line meant
  // a long analysis ended in one grey sentence, with the specialists' actual
  // conclusion, its risk level and its limits all hidden — and "not closed" is a
  // qualification on a result, not a reason to withhold one. So the result is
  // open and the qualification labels it.
  return `
    <section class="conclusion"><section class="answer is-interim">
      <p class="interim-flag">${esc(t("interimVerdict"))} · ${esc(t("notClosed").replace("{n}", outstanding.length))}</p>
      ${verdict}
      ${askBlock()}
      ${suggestedBlock()}
      ${clearanceBlock}
      ${limitsBlock}
    </section></section>`;
}

function answerMarkup(data) {
  const synthesis = data.synthesis;

  return `
      <span class="avatar" aria-hidden="true">CH</span>
      <div>
        <div class="msg-meta">
          <span class="tag">${esc(data.id)}</span><span class="sep">·</span>
          <span>${t("liveLabel")}</span><span class="sep">·</span>
          <span>${t("routedTo")} ${data.agents.map(agentName).join(", ")}</span>
        </div>

        ${/* The conclusion is last, where the work ends. Printing it first meant
              reading the verdict, then the reasoning that produced it, then
              scrolling back — and it put the synthesis text far from where it had
              streamed. Everything now runs in one direction. */ ""}
        ${pathMarkup(data.analysisPath, data.grounding, { allowInput: true, results: data.results })}

        ${conclusionMarkup(data)}

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
      <div data-live-synthesis></div>
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
function renderSteps(node, done, current, detail = "") {
  // A resumed run writes into an answer that has already been rendered, so the
  // live scaffold is gone. Progress then shows on the path itself.
  const host = node.querySelector("[data-live-steps]");
  if (!host) return;
  // Carried across the rebuild. The clock re-finds its node every tick, so it
  // survives on its own, but the fresh node is empty until the next second — and
  // a counter that blinks out whenever the line beneath it changes is worse than
  // no counter on the one screen whose job is to show that time is passing.
  const elapsed = host.querySelector("[data-elapsed]")?.textContent || "";
  host.innerHTML = current
    ? `<span class="tick" aria-hidden="true"></span>${esc(t(`step_${current}`))}${detail ? `<span class="live-detail">${esc(detail)}</span>` : ""}<span class="live-elapsed" data-elapsed>${esc(elapsed)}</span>`
    : "";
}

// A specialist takes the better part of a minute. Without a clock the wait is
// indistinguishable from a hang — which is exactly how it was reported.
// Ticks until its node leaves the document, so it needs no teardown: the
// continuation's line is replaced when the run finishes and removed when it
// fails, and the clock stops either way.
//
// It exists because a slow run and a stuck one look identical. Retrieval and the
// first specialist call can take a while before anything streams, and with a
// bare pulsing dot there is nothing to tell a reader which of the two they are
// watching.
function tickUntilDetached(node) {
  if (!node) return;
  const started = Date.now();
  const id = setInterval(() => {
    if (!node.isConnected) return clearInterval(id);
    node.textContent = `${Math.round((Date.now() - started) / 1000)}s`;
  }, 1000);
  node.textContent = "0s";
}

function startElapsed(node) {
  const started = Date.now();
  const tick = () => {
    const target = node.querySelector("[data-elapsed]");
    if (target) target.textContent = `${Math.round((Date.now() - started) / 1000)}s`;
  };
  tick();
  return setInterval(tick, 1000);
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

    // Four cells, two by two, with the way into the register as the fourth.
    //
    // 中国来源 is not among them: the region rows directly below print the same
    // 7/11, and a number stated twice inside one module is the thing this module
    // was merged to stop.
    //
    // The third cell is fallbacks, or failures when there are any — a failed sync
    // is the one of the two that needs attention, and both are always spelled out
    // in full on the sidebar's data-status line, so nothing is lost by the cell
    // showing one at a time.
    const third = failed.length
      ? { value: String(failed.length), label: t("failedSources"), bad: true }
      : { value: String(fallback.length), label: t("fallbackSources"), warn: fallback.length > 0 };
    $("coverageStrip").innerHTML = [
      { value: `${synced.length}/${data.sources.length}`, label: t("sourcesSynced") },
      { value: records.toLocaleString(), label: t("listRecords") },
      third
    ].map((cell) => `<div class="coverage-cell ${cell.bad ? "is-bad" : ""} ${cell.warn ? "is-warn" : ""}"><b>${esc(cell.value)}</b><span>${esc(cell.label)}</span></div>`).join("")
      + `<a class="coverage-cell cc-more" href="/data-sources.html">${esc(t("coverageMore"))}</a>`;

    renderGemNav();
    renderSourceMosaic();
    refreshStartCounts();
  } catch (error) {
    // Coverage is informational and the workbench stays usable without it, but
    // swallowing the reason entirely makes a failure here impossible to find.
    console.error("Coverage load failed:", error);
  }
}

/* ------------------------------------------------------------- analysis */

const PARTY_FIELDS = [
  ["entityNameEn", { zh: "英文名", en: "English name" }], ["commonNames", { zh: "常用名", en: "Common names" }],
  ["aliases", { zh: "别名", en: "Aliases" }], ["country", { zh: "国别", en: "Country" }],
  ["addresses", { zh: "地址", en: "Address" }], ["address", { zh: "地址", en: "Address" }],
  ["registrationNumber", { zh: "注册号", en: "Registration" }], ["noticeNumber", { zh: "公告", en: "Notice" }],
  ["effectiveFrom", { zh: "生效", en: "Effective" }], ["measures", { zh: "措施", en: "Measures" }],
  ["restrictionType", { zh: "限制类型", en: "Restriction" }], ["sourceList", { zh: "所属名单", en: "On list" }],
  ["programs", { zh: "项目", en: "Programmes" }]
];
const TEXT_FIELDS = [
  ["part", { zh: "所属部分", en: "Part" }], ["effectiveDate", { zh: "版本日期", en: "Version date" }],
  ["noticeNumber", { zh: "公告", en: "Notice" }], ["publishedAt", { zh: "发布", en: "Published" }],
  ["effectiveFrom", { zh: "生效", en: "Effective" }], ["measureType", { zh: "类型", en: "Type" }]
];

// An address arrives from the publisher as a structured record, and the browser
// was printing it as one: {"address":"172 Xibin Rd…","city":"Daqing","state":null,
// "postal_code":"163453","country":"CN"}. That is the field a reader most often
// came here to read, rendered as the thing they least wanted to see. Structured
// values are flattened into their non-empty parts, in the order they were given,
// and anything genuinely unprintable is dropped rather than dumped.
function flatten(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(", ");
  return Object.values(value).map(flatten).filter(Boolean).join(", ");
}

function fieldValue(value) {
  if (Array.isArray(value)) {
    const parts = value.map(flatten).filter(Boolean);
    // The count is the honest way to say a list was cut, rather than trailing off
    // and letting the reader assume they saw all of it.
    return parts.slice(0, 4).join(" · ") + (parts.length > 4 ? ` · +${parts.length - 4}` : "");
  }
  return flatten(value);
}

function recordMarkup(record) {
  const isParty = Boolean(record.entityName || record.entityNameEn);
  const title = record.entityName || record.noticeTitle || record.title || record.recordId || "—";
  const template = isParty ? PARTY_FIELDS : TEXT_FIELDS;
  const rows = template
    .map(([key, label]) => [localized(label), fieldValue(record[key])])
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
      ${record.matchDisposition && t(`disp_${record.matchDisposition}`)
        ? `<div class="rec-warn">${esc(t(`disp_${record.matchDisposition}`))}</div>` : ""}
    </article>`;
}

// Setting the composer's text goes through here, because assigning to .value
// fires no input event — so every programmatic fill was leaving the send button
// in whatever state the last keystroke had put it in. Prefilling a question and
// then refusing to send it is a particularly bad version of that.
function setComposer(value) {
  $("questionInput").value = value;
  syncSubmitState();
}

// Whether the send button can be pressed, decided in one place.
//
// It was being toggled from inside the two run paths and nowhere else, so an
// empty box in lookup mode — which is a request to browse the whole source, and
// the placeholder says so — sat behind a button that looked and behaved as
// though there were nothing to send. An empty box in ordinary mode is genuinely
// unsendable, and now says so rather than accepting the click and answering with
// a toast.
function syncSubmitState() {
  const empty = !$("questionInput").value.trim();
  const button = $("submitBtn");
  // While an analysis is running the button stops it. It used to grey out, which
  // left a run with no way out of it at all: four model calls and a minute of
  // waiting, and nothing to press.
  const running = state.busy && Boolean(state.run);
  button.classList.toggle("is-running", running);
  button.disabled = running ? false : state.busy || (empty && !state.sourceQuery);
  button.setAttribute("aria-label", t(running ? "stopRun" : "send"));
  button.title = running ? t("stopRun") : "";
}

// The step an answer is still waiting on, if the last one is.
//
// An open review has a form on screen asking for something. Anything the reader
// types while it is there is far more likely to be that answer than a new
// transaction to review — "无第三方参与，没有代理经销商以及中间方" is not a
// scenario, it is the third-party step being answered in the composer instead of
// in the box. Sent as a new question it started a whole second review of a
// sentence with no counterparty, no item and no destination in it.
function pendingStepForm() {
  const answers = [...document.querySelectorAll(".msg-assistant")];
  const last = answers.at(-1);
  // Collapsed still counts. Hiding the form was a decision about what a finished
  // answer should look like, not about whether a fact typed afterwards still
  // belongs to the step that wanted it. Named by data-outstanding rather than by
  // document order: a step already declared carries a collapsed form of its own,
  // and that one sits earlier in the answer.
  return last?.querySelector(".step-inputs[data-outstanding]:not(.submitted)") || null;
}

// Whether a message reads as a new transaction rather than as an answer.
//
// Deliberately crude and deliberately biased towards continuing. The step shows
// what it recorded and against which field, so a wrong guess is visible and the
// reader can start over; guessing the other way silently abandons a review in
// progress and re-runs every specialist on a sentence that describes no
// transaction. An export verb or a long message reads as a new scenario.
const NEW_SCENARIO = /(出口|进口|销售|采购|转口|再出口|export|import|re-?export|ship|sell|supply)/i;
const readsAsNewScenario = (text) => text.length > 120 || NEW_SCENARIO.test(text);

// Ends the run the reader is watching. The request is aborted, which drops the
// connection — the server notices and stops before the next specialist rather
// than finishing and filing a case nobody asked it to keep.
function stopRun() {
  if (!state.run) return;
  state.run.abort();
  state.run = null;
}

async function runSourceQuery(event, options = {}) {
  if (event) event.preventDefault();
  if (state.busy) return;
  const source = options.source || state.sourceQuery;
  // No terms is a request to browse the source rather than an empty query: a list
  // you can page through is how you find out what a source actually holds.
  const query = options.query !== undefined ? options.query : $("questionInput").value.trim();
  const offset = Number(options.offset) || 0;

  if (!options.replace) setComposer("");
  state.busy = true; syncSubmitState(); syncEvidenceVisibility();

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
      <section class="lookup-out" data-lookup="${esc(source.sourceId)}" data-lookup-query="${esc(query)}" data-lookup-offset="${offset}">
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
      </section>`;
    // The panel is the output. A lookup is not a turn in a conversation — nobody
    // asked the system anything, they opened a drawer — so it does not go in the
    // thread, and paging through 25,921 records does not fill the thread with a
    // record of clicks.
    const panel = $("flowPanel");
    panel.innerHTML = sourcePanelMarkup(source) + markup;
    hydrateBars(panel);
    panel.scrollTop = 0;
  } catch (error) {
    toast(`${t("error")}: ${error.message}`);
  } finally {
    state.busy = false; syncSubmitState();
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
  replace(".analysis-path", pathMarkup(data.analysisPath, data.grounding, { allowInput: true, results: data.results }));
  // The conclusion changes shape as items close — an open analysis and a closed
  // one are different blocks — so it is replaced whole rather than patched field
  // by field.
  replace(".conclusion", conclusionMarkup(data));
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
  // No model, no answer. There used to be a rules mode to fall back to, which
  // meant an unconfigured deployment still produced something that read like an
  // analysis; refusing is the honest behaviour and the only one that cannot be
  // mistaken for a result.
  if (!config.apiKey && !state.serverModelConfigured) { toast(t("needKey")); return openSettings(); }
  // The code is checked before the request rather than after: a rejected live
  // call would otherwise land as a failed analysis in the thread.
  if (state.liveModelBlocked) { toast(t("access_code_unset")); return; }
  if (state.accessPasswordRequired && !accessHeaders()["x-access-password"]) { toast(t("accessRequired")); return openSettings(); }

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
    setComposer("");
    updateRouteHint();
    renderActiveGem();
  }

  state.busy = true;
  state.run = new AbortController();
  syncSubmitState();
  syncEvidenceVisibility();

  const live = resuming || createLiveMessage();
  if (!resuming) { live.dataset.question = question; live.dataset.gem = gem?.id || ""; }
  live.classList.toggle("resuming", Boolean(resuming));
  const done = new Set();
  const collected = { agents: [], sources: [] };
  // Lane progress is kept outside the DOM so a redraw can restore the streamed
  // text: the path is re-rendered whenever a lane starts or finishes.
  // runningLanes, not one activeLane: the three specialists start together, so
  // "the lane that started last" stopped meaning "the lane that is running".
  // activeLane survives alongside it because the stage banner and the scroll
  // still need one lane to point at.
  const progress = { activeLane: null, runningLanes: new Set(), doneLanes: new Set(), text: {}, summary: {}, index: 0, total: 0, clock: null, stage: null };

  // Each delta carries the whole readable text of the call that produced it, not
  // an increment — the projection re-normalizes whitespace, so diffing against the
  // last send would fail its own monotonicity check and silence the agent. That
  // means a new specialist's first delta REPLACES the previous one's text wherever
  // it is written. In a continuation everything was being written to the single
  // box under the submitted form, so the box appeared to wipe itself and start
  // over three times a run. It is still one box — that is where a continuation
  // should be read — but it now says whose reasoning it is showing, and each lane
  // keeps its own copy so nothing is lost by the handover.
  // Exactly one surface is live at a time. Writing the same text into both the
  // resume box and the lane's own box put two boxes streaming at once, which is
  // indistinguishable from two specialists running at once — the opposite of what
  // sequential execution is meant to show. Keeping a second copy was meant to make
  // the handover lossless; the label on the box already does that job.
  // The synthesis writes below the path and above the conclusion it is producing,
  // in a box of its own, created on demand so a run that never reaches synthesis
  // leaves no empty frame behind.
  function synthesisBox() {
    // A resumed answer was rendered by answerMarkup and has no live scaffold, so
    // the host is created next to the conclusion it is about to replace.
    let host = live.querySelector("[data-live-synthesis]");
    if (!host) {
      const anchor = live.querySelector(".conclusion") || live.querySelector(".analysis-path");
      if (!anchor) return null;
      host = document.createElement("div");
      host.setAttribute("data-live-synthesis", "");
      anchor.parentNode.insertBefore(host, anchor);
    }
    if (!host.firstElementChild) host.innerHTML = streamBoxMarkup("data-synthesis-stream");
    return host.firstElementChild;
  }

  function streamInto(lane, who, text) {
    // The closing summary is not about the step the reader just answered, so it
    // does not go in that step's box. During a continuation everything else does
    // — that box is where a continuation should be read — but writing the final
    // conclusion inside "ownership aggregation" said the run was still working on
    // a step it had finished with two turns earlier.
    const box = lane === "review"
      ? synthesisBox()
      : live.querySelector("[data-resume-stream]")
        || live.querySelector(`[data-lane-stream="${CSS.escape(lane)}"]`);
    setStream(box, who, text);
    // The box scrolls itself, so the page only follows while the reader is
    // already at the bottom of it.
    const thread = $("thread");
    if (thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120) thread.scrollTop = thread.scrollHeight;
  }

  // Lane state and streamed reasoning are written into the path that is already
  // rendered, rather than replacing it. Nothing the reader is looking at moves.
  function markLanes() {
    const path = live.querySelector(".analysis-path");
    if (!path) return;
    for (const laneNode of path.querySelectorAll(".path-lane")) {
      const lane = laneNode.dataset.lane;
      laneNode.classList.toggle("running", progress.runningLanes.has(lane));
      laneNode.classList.toggle("done", progress.doneLanes.has(lane));
      // While a continuation is running the resume box is the live surface, so
      // lane boxes are left alone rather than repopulated with finished text that
      // would read as a second stream still going.
      if (live.querySelector("[data-resume-stream]")) continue;
      // Every lane that has produced text shows it. This was gated on the one
      // active lane because only one ever ran at a time; three now do.
      if (lane !== "review" && progress.text[lane] !== undefined) {
        setStream(laneNode.querySelector("[data-lane-stream]"), null, progress.text[lane]);
      }
    }
  }

  // Between the plan going up and the first specialist speaking, retrieval and
  // screening run for seconds with nothing on screen changing — which reads as a
  // hang. It cannot go in a lane's own box: lanes are revealed as they run, and
  // during this window none has, so there is no lane box to write into and
  // nothing would have appeared. It goes under the framework instead, which is
  // exactly what the reader is looking at, and says which stage is running.
  function showStageWaiting() {
    const host = live.querySelector("[data-live-path]");
    const existing = host?.querySelector("[data-stage-wait]");
    if (!host || progress.activeLane || !progress.stage) return existing?.remove();
    const label = t(`step_${progress.stage}`);
    if (existing) return void (existing.querySelector(".sb-who").textContent = label);
    host.insertAdjacentHTML("beforeend",
      `<div class="stream-box is-live is-waiting" data-stage-wait>
        <div class="sb-who">${esc(label)}</div>
        <div class="sb-text"></div>
        <div class="sb-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>`);
  }

  // The body follows the work, but only when it has left the screen. The one
  // deliberate scroll at the end of a run is what puts the reader on the question
  // waiting for them; this is the same restraint applied while the run is going —
  // a lane that scrolled out of view while the previous one finished is brought
  // back, and a lane already visible is left exactly where it is. Scrolling on
  // every event would take the page away from a reader who is reading.
  // The part of the thread a reader can actually see.
  //
  // The top bars float over their scrollers, so the thread's own rectangle
  // starts 48px above the first pixel of it that is not behind the workspace
  // header. Measured against the raw rectangle, a step sitting in that strip
  // counts as visible and nothing scrolls to it — which is what "it stopped
  // following the running step" was.
  function visibleThread() {
    const box = $("thread").getBoundingClientRect();
    const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar-h")) || 0;
    return { top: box.top + bar, bottom: box.bottom };
  }

  function followRunning() {
    // The step, not the lane. Following the lane worked while a lane was shorter
    // than the viewport; at six steps the header scrolls into view once, the
    // guard below then reports "already visible", and the frontier walks off the
    // bottom of the screen with nothing bringing it back.
    const lane = progress.activeLane || collected.path?.lanes?.[0]?.lane;
    const node = live.querySelector(".path-step.running")
      || live.querySelector(".path-step.asking")
      || (lane ? live.querySelector(`.path-lane[data-lane="${CSS.escape(lane)}"]`) : null);
    if (!node) return;
    const box = node.getBoundingClientRect();
    const view = visibleThread();
    if (box.top >= view.top + 20 && box.top <= view.bottom - 80) return;
    // Not smooth. A smooth scroll is animated and therefore asynchronous, and the
    // next path event replaces the very node being scrolled to — which cancels
    // the animation part-way and leaves the reader wherever it got to, or more
    // often nowhere at all. Following a running process is also not a case where
    // easing helps: the work moved, and the page should already be there.
    node.scrollIntoView({ block: "start" });
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
      allowInput: false, activeLane: progress.activeLane, runningLanes: progress.runningLanes, doneLanes: progress.doneLanes,
      results: collected.agents, stage: progress.stage, currentStep: state.resumingStep
    });
    // drawPath rebuilt the markup, so every lane that has written text gets it
    // back. This restored only the active lane, from when only one lane could be
    // writing; three write at once now and the other two would go blank on every
    // path event.
    for (const [lane, text] of Object.entries(progress.text)) {
      if (lane === "review" || text === undefined) continue;
      setStream(host.querySelector(`[data-lane-stream="${CSS.escape(lane)}"]`), null, text);
    }
    for (const lane of openLanes) host.querySelector(`[data-lane="${CSS.escape(lane)}"]`)?.setAttribute("data-open", "1");
  }

  renderSteps(live, done, "routed");

  const onEvent = (event) => {
    if (event.type === "routed") {
      done.add("routed");
      progress.total = event.agents.length;
      const meta = live.querySelector("[data-live-meta]");
      if (meta) meta.innerHTML =
        `<span class="tag">${esc(event.id)}</span><span class="sep">·</span>`
        + `<span>${t("liveLabel")}</span><span class="sep">·</span>`
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
      // A continuation replans before it re-resolves, so the first path of the
      // turn is a bare plan with nothing settled in it. The body already ignored
      // it and kept the path the reader was reading; the rail took it and reset
      // to an unresolved plan until the resolved one arrived — the two panels
      // showing different runs, briefly, which is the fault this pair has had in
      // a dozen forms. Ignored outright, so nothing downstream can pick it up:
      // the stage handler was reading it back out of collected.path.
      if (resuming && event.path?.planned) return;
      collected.path = event.path;
      drawPath();
      // drawPath rebuilds the lane markup, so the waiting box has to be put back
      // — otherwise announcing a stage and then resolving the path wipes the one
      // sign that anything is happening.
      showStageWaiting();
      renderFlowPanel(event.path, { activeLane: progress.activeLane, stage: progress.stage, analysed: [...progress.doneLanes] });
      // Steps close here, one at a time, so this is the event where the running
      // step moves. Scrolling only on stage and agent_start meant the page
      // followed a lane starting and then sat still through everything the lane
      // actually did.
      followRunning();
    }
    // A path with no specialists — a lookup, a briefing, a memo — used to sit on
    // "retrieving official sources" for the whole of its work, with no clock and
    // no label of its own. Reading four notice sources takes long enough for the
    // page to look like nothing is happening.
    if (event.type === "stage") {
      done.add("routed");
      // A detail arriving under the stage already showing is the same stage
      // naming what it is doing — grounding says which register it is reading.
      // Restarting the clock there would reset the elapsed time several times
      // inside one wait, which is the opposite of what the clock is for.
      const sameStage = progress.stage === event.key;
      if (!sameStage) clearInterval(progress.clock);
      renderSteps(live, done, event.key, event.detail ? t(`ground_${event.detail}`) : "");
      if (!sameStage) progress.clock = startElapsed(live);
      // And inside the path, where the analysis will appear. A line at the top of
      // the answer saying "screening and structured facts" is easy to miss above a
      // framework that is not moving; the reader is looking at the lanes, so the
      // lane about to run is where it has to be said.
      progress.stage = event.key;
      if (!sameStage) {
        showStageWaiting();
        renderFlowPanel(collected.path, { activeLane: progress.activeLane, stage: progress.stage, analysed: [...progress.doneLanes] });
        followRunning();
      }
      return;
    }
    if (event.type === "agent_start") {
      // The lane becomes the active one, so the reasoning about to stream lands
      // inside the steps it is reasoning about.
      progress.activeLane = event.agent;
      progress.runningLanes.add(event.agent);
      // Retrieval and screening are over once a specialist speaks. Leaving the
      // stage set would put the waiting animation back on the first lane every
      // time a lane finished and the next had not yet started — and again on the
      // final path event, so a finished answer would end on a spinner.
      progress.stage = null;
      showStageWaiting();
      progress.index = (progress.index || 0) + 1;
      clearInterval(progress.clock);
      renderSteps(live, done, "agents", `${agentName(event.agent)} · ${progress.index}/${progress.total}`);
      progress.clock = startElapsed(live);
      drawPath();
      // Label and placeholder go up immediately; the first token can be seconds away.
      streamInto(event.agent, `${agentName(event.agent)} · ${progress.index}/${progress.total}`, "");
      renderFlowPanel(collected.path, { activeLane: progress.activeLane, stage: progress.stage, analysed: [...progress.doneLanes] });
      followRunning();
    }
    // A provider that ignores stream: true degrades to one update at the end,
    // which is indistinguishable from a broken feature unless it is said.
    if (event.type === "stream_mode" && event.streaming === false && !live.querySelector("[data-stream-notice]")) {
      live.querySelector("[data-live-steps]")?.insertAdjacentHTML("afterend",
        `<p class="live-note stream-notice" data-stream-notice>${esc(t("noStreamNotice"))}</p>`);
    }
    if (event.type === "agent_delta") {
      progress.text[event.agent] = event.text;
      streamInto(event.agent, `${agentName(event.agent)} · ${progress.index}/${progress.total}`, event.text);
    }
    if (event.type === "agent") {
      collected.agents.push(event.result);
      progress.doneLanes.add(event.result.agent);
      progress.summary[event.result.agent] = event.result;
      progress.runningLanes.delete(event.result.agent);
      if (progress.activeLane === event.result.agent) progress.activeLane = null;
      drawPath();
      renderFlowPanel(collected.path, { activeLane: progress.activeLane, stage: progress.stage, analysed: [...progress.doneLanes] });
    }
    if (event.type === "synthesis_delta") {
      progress.text.review = event.text;
      streamInto("review", t("step_synthesizing"), event.text);
    }
    if (event.type === "synthesizing") {
      done.add("agents");
      progress.activeLane = "review";
      progress.runningLanes.clear();
      clearInterval(progress.clock);
      renderSteps(live, done, "synthesizing");
      progress.clock = startElapsed(live);
      streamInto("review", t("step_synthesizing"), "");
      drawPath();
      renderFlowPanel(collected.path, { activeLane: progress.activeLane, stage: progress.stage, analysed: [...progress.doneLanes] });
    }
  };

  try {
    const response = await fetch("/api/assess/stream", {
      method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() },
      signal: state.run.signal,
      body: JSON.stringify({ question, locale: state.locale, config, history: priorHistory, threadId: ensureThreadId(), gemId: gem?.id || null, declaredFacts: state.declaredFacts, unavailableFacts: state.unavailableFacts })
    });
    if (response.status === 401) { toast(t("accessRequired")); openSettings(); throw new Error(t("accessRequired")); }
    // The server refuses live calls when it has a key but no code to check it
    // against. There is nothing to drop into now, so this is a dead end that
    // says why rather than a quiet downgrade — an operator has to set
    // ACCESS_PASSWORD.
    if (response.status === 503) {
      state.liveModelBlocked = true;
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

    if (finished.synthesis) {
      state.conversation.push({ role: "assistant", content: `${finished.synthesis.headline}\n${finished.synthesis.executiveSummary}` });
    }
    live.id = `answer-${finished.id}`;
    // Before anything is drawn from it, so both panels and the scroll all see a
    // run with nothing outstanding to wait on.
    retireUnansweredAsks(finished.analysisPath);
    // Patching replaces whole sections, which changes their height. The offset of
    // the message is measured across the swap and the scroll corrected by the
    // difference, so the page does not slide under the reader.
    const thread = $("thread");
    const before = live.getBoundingClientRect().top;
    live.querySelector("[data-live-synthesis]")?.remove();
    if (resuming) patchAnswer(live, finished);
    else live.innerHTML = answerMarkup(finished);
    const shift = live.getBoundingClientRect().top - before;
    if (resuming && Math.abs(shift) > 1) thread.scrollTop += shift;
    hydrateBars(live);
    // Cleared before the rail is drawn, or the rail keeps marking the step the
    // finished run started from as still running.
    state.resumingStep = null;
    renderFlowPanel(finished.analysisPath, { analysed: (finished.results || []).map((item) => item.agent) });
    live.classList.remove("resuming");
    state.resumingStep = null;
    renderEvidence(finished.sources || []);
    // One deliberate scroll, and only one: to the conclusion.
    //
    // It used to go to the step still waiting on the reader, from when the run
    // stopped at that step and there was no conclusion to go to. There is one
    // now, it is what the reader has been waiting through the run for, and it is
    // at the very bottom of a long answer — so leaving the page wherever the
    // last streamed lane left it is leaving the reader above the only part that
    // answers their question. What is outstanding is named inside it.
    //
    // setTimeout rather than requestAnimationFrame: rAF does not fire while the
    // tab is hidden, so a run finished in a background tab would never move at
    // all — the reader returns to a page stopped mid-analysis with the answer
    // somewhere below the fold and no sign of it.
    setTimeout(() => {
      const answer = live.querySelector(".conclusion .answer") || live.querySelector(".conclusion");
      if (!answer) return;
      const box = answer.getBoundingClientRect();
      const view = visibleThread();
      if (box.top < view.top + 20 || box.top > view.bottom - 80) {
        answer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    // An action does not stay. /case-memo takes a thread that has already been
    // analysed and writes it up — leaving it selected would mean every question
    // after it is also a memo, which is not a place anybody works from. The
    // field that decides this is the one the orchestrator already routes on.
    //
    // Here rather than in the finally: a run that failed or was stopped has not
    // produced the memo, and dropping the gem then would make the reader pick
    // it again to retry the thing that just did not happen.
    if (state.activeGem?.kind === "memo") clearGem();
    loadCases();
  } catch (error) {
    // Stopping is not failing. The reader asked for this, so it gets no error
    // card and no toast — but it does get said, plainly and on the message
    // itself, because a partial analysis that looks finished is the one outcome
    // this must not produce. Nothing was saved: the server drops a run whose
    // reader has gone.
    if (error.name === "AbortError") {
      live.classList.remove("resuming");
      live.querySelectorAll("[data-resume-stream]").forEach((node) => node.remove());
      live.querySelectorAll(".step-inputs.submitted").forEach((host) => host.classList.remove("submitted"));
      // Into the content column, not onto the message. An assistant message is a
      // 24px avatar column beside the body, so appending to the message itself
      // put the line in the avatar column and wrapped it one character wide.
      const body = live.querySelector(":scope > div") || live;
      body.insertAdjacentHTML("beforeend", `<p class="run-stopped">${esc(t("runStopped"))}</p>`);
      return;
    }
    // A failure part-way through a continuation must not discard the answer the
    // reader already has; the submitted values are re-offered instead.
    if (resuming) {
      live.classList.remove("resuming");
      // A failed continuation used to leave everything it had put up still
      // running: the "continuing the analysis" line with its pulsing dot, the
      // empty stream box, and the inputs still disabled from the submit. The
      // reader was left watching a spinner that would never stop, on a form
      // they could no longer touch — which is what "it just loads forever"
      // was. The toast had already come and gone.
      live.querySelectorAll("[data-resume-stream], .si-done").forEach((node) => node.remove());
      live.querySelectorAll(".step-inputs.submitted, .step-inputs.skipped").forEach((host) => {
        host.classList.remove("submitted", "skipped");
        host.closest(".path-step")?.classList.remove("answered");
        host.querySelectorAll("input, button").forEach((control) => { control.disabled = false; });
        host.insertAdjacentHTML("beforeend",
          `<p class="si-error">${esc(t("resumeFailed"))}${esc(error.message)}</p>`);
      });
    } else {
      live.innerHTML = `
        <span class="avatar" aria-hidden="true">CH</span>
        <div><section class="answer"><div class="answer-head">
          <span class="risk-mark risk-unknown">!</span>
          <div><h3>${t("error")}</h3><p>${esc(error.message)}</p></div>
        </div></section></div>`;
    }
    // The toast carries the message and nothing else. Without the stack in the
    // console, a client-side failure mid-run is only diagnosable by guessing
    // which field was missing from the result.
    console.error("Analysis failed:", error);
    toast(`${t("error")}: ${error.message}`);
  } finally {
    clearInterval(progress.clock);
    state.resumingStep = null;
    state.run = null;
    state.busy = false;
    syncSubmitState();
    // A run that failed before it produced a path leaves the column holding
    // nothing, and busy is no longer keeping it open on its own.
    syncEvidenceVisibility();
  }
}

// A new conversation, not a new assistant. The gem survives it — that is the
// whole of "常驻": you are in a gem, and starting over inside it is still inside
// it. Leaving is the × on the composer row, or Escape.
function newConversation() {
  clearFlowPanel();
  state.conversation = [];
  state.threadId = null;
  state.declaredFacts = {};
  state.unavailableFacts = [];
  $("threadInner").innerHTML = "";
  $("startPanel").classList.remove("hidden");
  setComposer("");
  renderActiveGem();
  renderEvidence([]);
  updateRouteHint();
  $("questionInput").focus();
}

/* -------------------------------------------------------------- settings */

// "Ready" means a live call would actually be accepted: a model to call, and
// the access code the server will ask for. Anything less cannot run a question.
function liveModelReady() {
  if (state.liveModelBlocked) return false;
  if (state.accessPasswordRequired && !localStorage.getItem("compliance-access-password")) return false;
  return state.serverModelConfigured || Boolean(sessionStorage.getItem("compliance-api-key"));
}

// A status light rather than a switch. It used to toggle between live and rules
// mode; with nothing to toggle to, what is left to say is whether a question can
// be answered at all — and if not, the click opens the place to fix it.
//
// It sits on the settings entry in the sidebar foot, beside the data-source
// light, because that is where the other "is this deployment working" states
// already are, and because clicking it goes to the screen that fixes it.
function updateModePill() {
  const item = $("settingsBtn");
  const ready = liveModelReady();
  item.classList.toggle("ok", ready);
  item.classList.toggle("warn", !ready);
  item.title = state.liveModelBlocked ? t("access_code_unset")
    : state.accessPasswordRequired && !ready ? t("accessRequired")
      : ready ? t("runtimeReady") : t("runtimeMissing");
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
  $("serverModelName").textContent = [state.serverEndpoint, state.serverModel].filter(Boolean).join(" · ");
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
  if (key) sessionStorage.setItem("compliance-api-key", key);
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
    state.serverModel = capabilities.model || null;
    state.serverEndpoint = capabilities.endpoint || null;
    state.accessPasswordRequired = Boolean(capabilities.accessPasswordRequired);
    state.liveModelBlocked = Boolean(capabilities.liveModelBlocked);
    // Only false says anything: null means the server could not tell, and a
    // guess would be worse than silence.
    state.historyPersistent = capabilities.historyPersistent !== false;
    renderHistoryDurability();
    document.querySelector('#settingsBtn .side-label').textContent = t(state.serverModelConfigured ? "accessSettings" : "modelSettings");
    updateModePill();
  } catch { /* The pill stays on its default until discovery succeeds. */ }
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
  renderHistoryDurability();
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
  // The rail too. Its contents are built in JavaScript rather than carried on
  // data-i18n attributes, so switching to English left "提交一个问题后…" sitting
  // under an English heading — and, once a run had happened, every lane label
  // and status in the panel beside an answer that had switched.
  renderSkillNav();
  renderFlowPanel(null);
  // On the attribute, not in the span's text: applyLocale rewrites the text of
  // every [data-i18n] element, so a tag written inside one is erased the first
  // time the language changes.
  // first-of-type: the hint under the label is a direct child span too, and
  // without it every optional field carried the tag twice.
  document.querySelectorAll(".field.opt > span:first-of-type").forEach((label) => {
    label.dataset.optional = t("optional");
  });
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
  syncSubmitState();
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
  // Opens a desk's narrower entries in place. It does not select the desk: a
  // reader looking at what is under Trade has not said they want Trade.
  const more = event.target.closest("[data-open-group]");
  if (more) {
    event.stopPropagation();
    const gem = GEMS.find((item) => item.group === more.dataset.openGroup);
    if (gem) state.paletteOpen.add(deskFor(gem));
    return openPalette(paletteQuery() || "");
  }
  const pin = event.target.closest("[data-pin]");
  if (pin) {
    event.stopPropagation();
    const added = toggleWorkspaceGem(pin.dataset.pin);
    renderGemNav();
    renderPalette();
    return toast(added ? t("gemAdded") : t("gemRemoved"));
  }
  // The command, not the procedure. A skill runs by being typed, so choosing one
  // does what typing it would have done and leaves the reader to write the
  // question after it.
  const skillPick = event.target.closest("[data-skill]");
  if (skillPick) {
    setComposer(`/${skillPick.dataset.skill} `);
    closePalette();
    $("questionInput").focus();
    return;
  }
  const button = event.target.closest("[data-gem]");
  if (!button) return;
  setComposer("");
  activateGem(button.dataset.gem);
});

$("starterGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-starter]");
  if (!button) return;
  const scenario = scenarios[state.locale].find((item) => item.id === button.dataset.starter);
  if (!scenario) return;
  setComposer(scenario.question);
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
const onWorkspaceClick = (event) => {
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
    setComposer(t("escalatePrefix").replace("{q}", escalate.dataset.escalate));
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
  // Declining has to move the analysis on. The run now stops at the question it
  // is waiting for, so collapsing the form and doing nothing else left the whole
  // thing wedged: the only way forward was to type something the user had just
  // said they did not have.
  //
  // The step stays outstanding — a declined question is not an answered one — but
  // the fields are recorded so the run continues past it instead of stopping
  // there again.
  const skip = event.target.closest(".si-skip");
  if (skip) {
    const host = skip.closest(".step-inputs");
    host.classList.add("skipped");
    host.closest(".path-step")?.classList.add("answered");
    // Every control except the way back. Disabling the whole form disabled the
    // "fill in" link inside it too, so the one control whose entire purpose is to
    // undo this state was the one that stopped responding to clicks.
    host.querySelectorAll("input, button:not(.si-reopen)").forEach((control) => { control.disabled = true; });
    const fields = [...host.querySelectorAll("[data-field]")].map((node) => node.dataset.field);
    state.unavailableFacts = [...new Set([...state.unavailableFacts, ...fields])];
    const answer = host.closest(".msg-assistant");
    if (answer?.dataset.question) {
      // Deliberately not resumingStep. That marks the step the rail should hold
      // on while a continuation runs, which is right for a submitted answer —
      // that step is being worked on. A declined one is the opposite: it has
      // been passed over, and holding the rail there left it pointing at a step
      // the body had already moved past and marking it as running.
      state.resumingStep = null;
      // No resume stream box here, and this is the same distinction as the line
      // above rather than a separate one. A submitted answer makes its own step
      // the live surface — the reader just wrote something there and the run is
      // working on it. A declined step is being walked past, so parking the live
      // stream and a ticking clock inside it said "ownership aggregation, 40s,
      // trade 1/1" about a step the rail on the right had already greyed out as
      // skipped. The two panels were describing different runs again.
      //
      // With no box to prefer, streamInto falls through to the lane's own panel,
      // which is where the work actually is, and followRunning carries the reader
      // to it — so the click still visibly does something, just not here.
      host.insertAdjacentHTML("beforeend", `<div class="si-done">
        <span class="sis-label">${esc(t("declareSkippedLabel"))}</span>
        <span class="sis-state">${esc(t("declareSkippedContinued"))}</span>
      </div>`);
      renderFlowPanel(null, {});
      return analyze(null, { continueIn: answer });
    }
    return;
  }
  const redo = event.target.closest(".si-redo");
  if (redo) {
    const host = redo.closest(".step-detail-wrap")?.querySelector(".step-inputs.si-collapsed");
    if (!host) return;
    host.classList.remove("si-collapsed");
    // Only .step-redo now — nothing is asked on the page any more, so the only
    // link of this kind left is "change this answer" on a declared step.
    redo.closest(".step-redo")?.remove();
    host.querySelector(".si-text")?.focus();
    return;
  }
  const reopen = event.target.closest(".si-reopen");
  if (reopen) {
    const host = reopen.closest(".step-inputs");
    host.classList.remove("skipped");
    host.closest(".path-step")?.classList.remove("answered");
    host.querySelectorAll("input, button").forEach((control) => { control.disabled = false; });
    const fields = new Set([...host.querySelectorAll("[data-field]")].map((node) => node.dataset.field));
    state.unavailableFacts = state.unavailableFacts.filter((field) => !fields.has(field));
    return;
  }
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
  host.closest(".path-step")?.classList.add("answered");
  host.querySelectorAll("input, button:not(.si-reopen)").forEach((control) => { control.disabled = true; });
  host.insertAdjacentHTML("beforeend", `
    <div class="si-done">
      <span class="sis-label">${esc(t("declaredAdded"))}</span>
      <span class="sis-values">${labels.map(esc).join("；")}</span>
      <span class="thinking-dot" aria-hidden="true"></span>
      <span class="sis-state">${esc(t("declareContinuing"))}</span>
      <span class="sis-elapsed"></span>
    </div>
    ${streamBoxMarkup("data-resume-stream")}`);
  tickUntilDetached(host.querySelector(".si-done .sis-elapsed"));

  // The same analysis carries on with one more fact, inside the answer already on
  // screen — not a new question producing a second answer below it.
  const answer = host.closest(".msg-assistant");
  if (answer?.dataset.question) {
    state.resumingStep = host.closest(".path-step")?.dataset.stepId || null;
    renderFlowPanel(null, {});
    return analyze(null, { continueIn: answer });
  }
  setComposer(`${t("declarePrefix")}${labels.join("；")}`);
  $("questionForm").requestSubmit();};
$("threadInner").addEventListener("click", onWorkspaceClick);
// The lookup output lives in the right panel now, and its paging, escalate and
// browse-all buttons are the same buttons — so the same handler has to hear
// them there. Two copies of this logic is how the two panels came to disagree
// about everything else.
$("flowPanel").addEventListener("click", onWorkspaceClick);

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

// Submitting while a run is going means stopping it: the button is the stop
// button then, and Enter in the composer has to mean the same thing the button
// says.
$("questionForm").addEventListener("submit", (event) => {
  if (state.busy && state.run) { event.preventDefault(); return stopRun(); }
  // A message typed while a step is still asking is that step's answer, and the
  // review carries on with it rather than starting a second one. Routed through
  // the form the step already owns, so there is one path for a declared fact and
  // one place where the analysis resumes.
  const pending = pendingStepForm();
  const text = $("questionInput").value.trim();
  if (pending && text.length >= 2 && !readsAsNewScenario(text)) {
    event.preventDefault();
    const field = pending.querySelector(".si-text");
    if (field) {
      field.value = text;
      setComposer("");
      pending.querySelector(".si-submit")?.click();
      return;
    }
  }
  return analyze(event);
});
$("newChatBtn").addEventListener("click", newConversation);

$("skillNav").addEventListener("click", (event) => {
  const kill = event.target.closest("[data-skill-delete]");
  if (kill) {
    fetch(`/api/skills/${encodeURIComponent(kill.dataset.skillDelete)}`, { method: "DELETE" })
      .then(() => loadSkills()).catch(() => toast(t("error")));
    return;
  }
  const pick = event.target.closest("[data-skill]");
  if (pick) {
    setComposer(`/${pick.dataset.skill} `);
    $("questionInput").focus();
  }
});

// A gem is four fields, so the dialog is four sections rather than one form of
// eight inputs. The sources are checkboxes over the real registry — an id typed
// by hand is a line in the prompt naming a source that does not exist — and a
// required fact is a label and the words that would appear in a draft carrying
// it, which is the part a regular expression was doing and nobody can be asked
// to write.
function renderGemSourcePicker() {
  const groups = {};
  for (const source of state.sourceOptions) (groups[source.country || "—"] ||= []).push(source);
  $("gemSourcePicker").innerHTML = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    .map(([country, list]) => `
      <div class="sp-group"><span class="sp-country">${esc(country)}</span>
        ${list.map((source) => `
          <label class="sp-item" title="${esc(source.sourceName || source.sourceId)}">
            <input type="checkbox" value="${esc(source.sourceId)}">
            <code>${esc(source.sourceId)}</code>
          </label>`).join("")}
      </div>`).join("");
}

// Ticking none is a real answer, and it means all of them — so the picker says
// so rather than leaving an empty box to be read as "none".
function renderGemSkillPicker() {
  $("gemSkillPicker").innerHTML = state.skills.length
    ? `<div class="sp-group"><span class="sp-country">${esc(t("gemSkillsAll"))}</span>
        ${state.skills.map((skill) => `
          <label class="sp-item" title="${esc(skill.summary)}">
            <input type="checkbox" value="${esc(skill.id)}">
            <code>/${esc(skill.command)}</code>
          </label>`).join("")}
      </div>`
    : `<p class="field-hint">${esc(t("skillEmpty"))}</p>`;
}

function addGemFactRow(fact = {}) {
  $("gemFactRows").insertAdjacentHTML("beforeend", `
    <div class="fact-row">
      <input class="fact-label" maxlength="40" placeholder="${esc(t("gemFactName"))}" value="${esc(fact.label || "")}">
      <input class="fact-keywords" maxlength="240" placeholder="${esc(t("gemFactWords"))}" value="${esc((fact.keywords || []).join("、"))}">
      <button type="button" class="gem-drop" data-fact-drop aria-label="${esc(t("skillDelete"))}">
        <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
    </div>`);
}

$("gemAddBtn").addEventListener("click", () => {
  $("gemForm").reset();
  $("gemError").classList.add("hidden");
  $("gemFactRows").innerHTML = "";
  renderGemSourcePicker();
  renderGemSkillPicker();
  addGemFactRow();
  $("gemDialog").showModal();
});
$("gemCancel").addEventListener("click", () => $("gemDialog").close());
$("gemFactAdd").addEventListener("click", () => addGemFactRow());
$("gemFactRows").addEventListener("click", (event) => {
  event.target.closest("[data-fact-drop]")?.closest(".fact-row")?.remove();
});
$("gemForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    name: $("gemNameInput").value,
    command: $("gemCommandInput").value,
    summary: $("gemSummaryInput").value,
    instruction: $("gemInstructionInput").value,
    boundSources: [...$("gemSourcePicker").querySelectorAll("input:checked")].map((box) => box.value),
    skillIds: [...$("gemSkillPicker").querySelectorAll("input:checked")].map((box) => box.value),
    requiredFacts: [...$("gemFactRows").querySelectorAll(".fact-row")].map((row) => ({
      label: row.querySelector(".fact-label").value,
      keywords: row.querySelector(".fact-keywords").value.split(/[、,，\s]+/).filter(Boolean)
    })).filter((fact) => fact.label.trim())
  };
  try {
    const response = await fetch("/api/gems", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    $("gemDialog").close();
    toast(t("gemSaved"));
    await loadGems();
  } catch (error) {
    const box = $("gemError");
    box.textContent = error.message;
    box.classList.remove("hidden");
  }
});

$("skillAddBtn").addEventListener("click", () => {
  $("skillForm").reset();
  $("skillError").classList.add("hidden");
  $("skillDialog").showModal();
});
$("skillCancel").addEventListener("click", () => $("skillDialog").close());
$("skillForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    name: $("skillNameInput").value,
    command: $("skillCommandInput").value,
    summary: $("skillSummaryInput").value,
    procedure: $("skillProcedureInput").value
  };
  try {
    const response = await fetch("/api/skills", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    // The server's own message, not a generic one: it is the only thing that
    // knows the command collided with a built-in gem rather than being malformed.
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    $("skillDialog").close();
    toast(t("skillSaved"));
    await loadSkills();
  } catch (error) {
    const box = $("skillError");
    box.textContent = error.message;
    box.classList.remove("hidden");
  }
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
  setComposer(scenario.question);
  // Some scenarios are a prepared file, not just a question: they carry the
  // declarations a reviewer would already have to hand. Those go into the
  // declared facts, where they stay visible and editable — never asserted by
  // the analysis on their own.
  if (scenario.facts) state.declaredFacts = { ...state.declaredFacts, ...scenario.facts };
  $("scenarioDialog").close();
  updateRouteHint();
  if (state.activeGem) renderActiveGem();
  $("questionInput").focus();
});

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
setRail(state.rail);
setEvidenceCollapsed(state.evidenceCollapsed);
applyLocale(state.locale);
renderEvidence([]);
loadGems();
loadSkills();
renderFlowPanel(null);
syncSubmitState();
loadRuntimeCapabilities();
loadCases();

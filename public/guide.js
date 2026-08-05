import { GEMS, GEM_GROUPS } from "/gems.js";

// The figures on this page are read from the coverage API rather than written
// into the copy. A guide that states counts in prose goes stale the first time
// a source is added, and a compliance tool claiming coverage it no longer has
// is worse than one that says nothing.

const copy = {
  zh: {
    brandSub: "合规情报原型", back: "返回对话", coverage: "数据覆盖",
    kicker: "COMPLIANCE HUB · PROTOTYPE",
    title: "出口管制工作台",
    lead: "一个输入框提问，Master Agent 自动路由到贸易、产品和第三方尽调 Agent，返回一份带证据链的统一答案——并且始终说明这份答案站在什么数据上。",
    scope: ["美国 · 中国", "仅出口管制", "{sources} 个已实现数据源", "{gems} 个 Gem"],

    kindsLabel: "系统能做什么", kindsTitle: "四种工作，只有一种是审查",
    kindsLead: "把每个问题都当成合规审查是错的。「这个料号的 ECCN 是多少」没有交易方、没有目的地、没有交易，跑一遍审查程序只会得到一段与提问无关的通用话。所以问题先分流，四条路各有各的产出和边界。",
    kindsHeads: ["类型", "什么时候走这条", "产出", "不做什么"],
    kinds: [
      ["合规审查", "描述了一笔交易——有交易方、物项、目的地或最终用户", "按已公布程序逐步执行，每步带条文依据；缺资料就停在那一步问你；结论带风险等级与边界", "不放行交易。最后一步永远是人工复核"],
      ["直接查询", "问一个已登记的值：料号的 ECCN、管制编码的含义、某主体是否在某份清单上", "单步检索，直接给值和来源；查不到时说明查了哪些记录、答案在谁那里", "不推断。未收录不等于不受管制"],
      ["监管简报", "问一段时间内发布了什么变化", "按公告汇总：新增多少家、分别进了哪份清单、来自哪些国家，再逐份列出动作与公告号", "不判断这些变化是否影响某笔交易——那是审查"],
      ["案件备忘录", "把本会话已完成的分析整理成文书", "记录既有结论与证据来源", "不产生新判断。会话为空时直接说没有可整理的内容"]
    ],
    kindsGemNote: "Gem 声明自己属于哪一类，所以选中 /reg-brief 不会触发受限方筛查。但描述了交易的问题始终走审查——不论选了哪个 Gem。",

    autoLabel: "自动完成的部分", autoTitle: "不该让人手填的，就别问",
    autoLead: "每问一次就要填一堆表格，是这类工具最劝退的地方。凡是公开数据能回答的，先查再问。",
    autoItems: [
      ["交易主体", "问题里写「客户 Aveox Technologies」就够了。系统在已同步名单里模糊匹配到登记名称，多个候选时取最相近的两个一并带入下一步。名称相似不等于同一主体，区分交给身份要素消歧。"],
      ["股权穿透", "自动查 GLEIF 全球法人识别编码库，取直接母公司与最终母公司。GLEIF 的母公司指会计合并母公司，不含持股比例——所以命中名单时仍会要你提供合计持股。"],
      ["物项分类", "NVIDIA 1,352 个料号、AMD 8,554 个料号的厂商公开分类表已接入，按 part number 直接查 ECCN、HTS、CCATS。厂商声明不是分类决定。"],
      ["路径长度", "按已陈述的事实分流：无第三方则不启尽调通道，EAR99 则无国别矩阵可查。每次跳过都写明触发它的事实和条文，「不确定」永远不缩短路径。"]
    ],
    capLabel: "对外能力", capTitle: "一条线可以问另一条线什么",
    capLead: "跨线的问题不经 Agent 互相对话，而是走一份具名的能力注册表：入参是声明的，答案带条文出处，是规则的就用代码算。同一份注册表可以对外发布——`npm run mcp` 以 MCP 工具提供，`/api/capabilities` 直接可读。",
    capHeads: ["能力", "由哪条线作答", "回答什么", "依据"],
    capNote: "每次调用都记录谁问的、哪条线答的、依据哪条条文，并写在发起调用的那一步上。答案还会带上它站在什么之上：检索了哪些来源、命中哪些记录，或者明说它只站在用户声明上、未经核验。",
    lanesLabel: "覆盖范围", lanesTitle: "三条合规线",
    lanes: [
      ["Trade", "受限方筛查与身份消歧", "美国 CSL / OFAC / EAR 744；中国管控名单与不可靠实体清单；欧盟、台湾、日本、UFLPA、美国防部 1260H"],
      ["Product", "物项归类与许可判定", "美国 ECCN → 管制理由 → 国别矩阵 → 许可例外；中国两用物项管制编码与许可证目录；日本輸出貿易管理令别表"],
      ["Ethics-TPDD", "与出口管制相关的第三方尽调", "最终用户、UBO、费用与付款路径、规避模式"]
    ],
    lanesNote: "不在范围内：产品准入类合规（FCC、CCC、RoHS、能效）。",
    laneHeads: ["领域", "做什么", "主要来源"],

    dataLabel: "数据基础", dataTitle: "接的是什么",
    figures: ["登记数据源", "已实现 adapter", "已同步", "兜底快照", "名单记录"],
    cnTitle: "中国侧",
    cnBody: "商务部两用物项管制公告、管控名单／关注名单、不可靠实体清单、许可证管理目录。走的是官网自身的公开接口，不绕过任何验证码。",
    cnPoints: [
      "公告会解析出中文名、英文名、常用名称、地址与邮编。",
      "公告标题里的“将 10 家美国实体……”被用作解析自检：数量对不上就标记 extractionComplete: false，该批记录不当作完整名单使用。",
      "公告之间的暂停、调整、废止关系记录在 supersedesNotices。一条措施是否仍然生效必须结合这些关系判断。"
    ],
    fallbackTitle: "兜底快照",
    fallbackBody: "中国来源在部分海外节点无法访问。此时自动启用随仓库提交的时点副本，但绝不冒充实时数据：状态是独立的 fallback_snapshot，指示灯为黄色而非绿色，回答里会写明采集日期。",
    statusTitle: "证据状态的五种含义",
    statuses: [
      ["实时获取", "本次请求真实抓取到的页面正文", "ok"],
      ["已采集副本", "实时抓取失败，回落到此前采集的官方文本，带采集日期", "warn"],
      ["仅引用", "该发布方拒绝自动访问（如 OECD 返回 403），只引用不抓取", "muted"],
      ["元数据", "只有来源标题与说明，没有正文", "muted"],
      ["获取失败", "既抓不到也没有采集副本", "crit"]
    ],

    procLabel: "审查程序", procTitle: "一共五套程序，四套是别人定的",
    procLead: "步骤序列不是这个产品编的。美国出口管制有官方的编号决策程序，所有权穿透有 OFAC 的公开口径，第三方尽调有 DOJ 明列的考察因素——照着走并且逐条引用，才是「为什么是这些步骤」这个问题的答案。下表由代码里的流程定义直接生成，不是另抄一份。",
    procHeads: ["程序", "发布方", "本系统步骤", "决定什么"],
    procPurpose: {
      ear732: "物项和交易到底受不受管、归到哪个编码、去哪个目的地要不要许可。系统里最长的一条，贸易线和产品线都从它取步骤。",
      ofac50: "名单检索解决不了的那部分：间接持股和合并持股。被列名主体合计持有 50% 以上的公司，即使自己不在名单上也同样受限。",
      eccp: "第三方该不该用、用之前查什么、合作期间怎么持续看着。DOJ 用它评价一家公司的合规体系是否名副其实。",
      prcDualUse: "中国两用物项的管制依据与许可申请材料要求。",
      derived: "官方程序没有对应步骤、但不做就没法继续的环节。系统自己加的都标在这里，不混进官方引用里。"
    },
    procDerivedTag: "非官方",
    procDerivedNote: "「系统按问题结构生成」不是官方程序，所以它在开场说明和右侧流程里都单独标注。把自己设计的步骤说成官方要求，是这份文档最不该出现的东西。",
    procPrcNote: "两用物项出口管制条例目前只作为**数据来源**被引用，没有自己的步骤序列：中国出口问题走的是「物项与许可」这条线的步骤（结构取自 EAR Part 732），检索的是中国的管制清单、许可证目录和商务部公告。中国侧没有公布编号决策树，所以这里不硬造一个对称结构——但这也意味着这条线的步骤标题读起来是美国口径。",
    procStepsTitle: "每条线的步骤", procStepUnit: "步", procStepsNote: "点开查看该条线的完整步骤与条文依据。",
    procStepHeads: ["#", "步骤", "依据", "需要你提供"],
    procAsksNone: "—",
    procGemTitle: "每个 Gem 从哪条线起步",
    procGemLead: "Gem 决定分析从哪条线开始，不决定只走哪条线——路由会根据问题本身追加其他线。下表是起步位置和它对应的程序。",
    procGemHeads: ["Gem", "起步线", "起步程序", "可能追加"],
    procLaneNames: { trade: "Trade — 受限方与主体", product: "Product — 物项与许可", tpdd: "Ethics & TPDD — 第三方", review: "结案", lookup: "查询", briefing: "监管变化简报", memo: "案件备忘录" },
    useLabel: "使用方法", useTitle: "在输入框键入 /",
    useLead: "上下键选择 Gem，回车确认。每个 Gem 绑定五样东西：产出类型、指令、数据源白名单、必填事实清单、输出模板。产出类型决定它走哪条路——/reg-brief 是简报，不会触发受限方筛查；必填事实清单则让系统在提交前就知道自己缺什么，而不是让模型悄悄猜。",
    gemsLabel: "可用 Gem", gemBound: "个来源", gemRecords: "条记录", gemUnsynced: "个未同步", gemNone: "不绑定外部来源",
    streamTitle: "一步一步，问完再分析",
    streamBody: "回答按顺序自上而下产生，遇到缺资料就停在那一步问你，不绕过缺口继续。",
    streamPoints: [
      "开场先说明本次落在哪些审查范围、每个范围遵循哪份已公布的程序、步骤有哪些——右侧执行流程就是同一份清单。",
      "缺资料时分析停在那一步、就地提示、就地填写。有未决问题时不出结论——在刚承认的缺口上写判断，正是本工具要避免的。",
      "补齐后从停下的地方继续，正文只画已执行的步骤，整体计划始终在右侧。",
      "三个专业 Agent 依次执行而非并发。代价是实时模型下总耗时约为三次调用之和，换来的是可跟读的顺序。"
    ],
    triageTitle: "该短的短",
    triageBody: "EAR Part 732 自己列了 29 步，但人工审查不会每次全跑。系统按已陈述的事实分流：无第三方则不启第三方尽调通道；低于 de minimis 则分类及下游不适用；EAR99 则无国别矩阵单元可查。每一次跳过都在开场说明里写明触发它的事实和条文，「不确定」永远不缩短路径。",
    otherTitle: "其他入口",
    otherPoints: [
      "左侧栏点击 Gem 直接使用，再点一次查看它的完整规格。",
      "「测试场景」提供 16 个预置情景。多数只填入输入框；C 开头的三个是完整卷宗，会同时把已声明事实填好，因此能一次跑到结论——它们是用来看「条件逐项满足时系统怎么说」的。",
      "左下角数据状态可进入数据覆盖页，查看每个来源的同步状态、记录数与校验和。",
      "左上角显示模型是否已配置。分析全部由实时模型运行——没有模型时系统直接拒答，不会用模板凑出一个看起来像分析的结果。"
    ],

    demoLabel: "演示脚本", demoTitle: "同一套逻辑，两种结论",
    demoLead: "选 /screen-party，先后粘贴下面两段。两个结论都来自真实抓取的商务部公告2026年第23号，不是预设的演示数据。",
    demoHit: "命中", demoCall: "判定",
    demos: [
      { q: "客户 Aveox Technologies (Shenzhen) Co., Ltd.，注册号 91440300778812XKA，中国深圳，直销客户",
        hit: "艾维奥克斯公司 · Aveox, Inc.",
        cmp: [["国别", "冲突", "CN vs US", 0], ["地址", "冲突", "深圳 vs Simi Valley, CA", 0], ["注册号", "缺失", "名单未提供", 2]],
        call: "疑似误报 —— 身份要素冲突", kind: "fp" },
      { q: "我们打算向 Red Cat Holdings, Inc. 出售 20 台服务器",
        hit: "红猫控股公司 · Red Cat Holdings, Inc.",
        cmp: [["国别", "一致", "US vs US", 1], ["地址", "一致", "South Salt Lake, UT", 1], ["常用名", "一致", "Red Cat", 1]],
        call: "建议升级人工确认", kind: "esc" }
    ],
    demoNote: "两者都不是终局判定。疑似误报仍要求人工用注册证据确认，系统不会自动放行；建议升级也不等于确认命中。",

    limitLabel: "边界", limitTitle: "必须知道的限制",
    limits: [
      "不构成法律意见，不做交易放行。输出仅用于研究与风险分流，最终结论需要 Compliance / Legal 人工审查。",
      "内部主数据是合成的。产品、业务伙伴、交易均为演示用途，全部标记 dataClass: synthetic，分类值标记 unverified_demo_value。",
      "名单检索只产生 potential match。系统不会输出 Confirmed Match，也不会仅凭红旗认定某家公司是空壳公司或存在违法行为。",
      "来源缺失不等于无风险。未同步的名单来源会被如实列出，而不是当作“已检查且干净”。"
    ],
    todoTitle: "尚未完成的部分",
    todos: [
      "国别矩阵已解析出 203 行国别与管制理由，但「目的地与管制理由」一步目前只引用条文编号，尚未自动读取该矩阵。",
      "中国侧没有公布编号决策树，因此物项线的步骤序列取自 EAR Part 732；中国问题走同一序列，检索的是中国清单与公告，步骤标题读起来是美国口径。",
      "34 个数据源中有 14 个当前不被任何分析步骤读取——验证码限制、条文类、或编码口径不匹配。数据覆盖页逐个标注了是哪一种。",
      "韩国战略物资清单没有可自动获取的途径，只能人工查阅。",
      "官方的 ECCN ↔ 欧盟／瓦森纳对照表并不存在，跨制度比对只能按管制编号结构推导，属于参考而非查表。",
      "中国海关总署（HS 编码、税则）全线返回 412 反爬，单一窗口有验证码，均不在自动化范围内。",
      "中国官方来源没有开放数据授权。内部原型可用，对外发布前需法务确认。",
      "请勿输入商业秘密、个人敏感信息或未公开交易数据。"
    ],
    footer: "数据状态与来源明细见"
  },
  en: {
    brandSub: "Compliance intelligence", back: "Back to chat", coverage: "Data coverage",
    kicker: "COMPLIANCE HUB · PROTOTYPE",
    title: "Export control workbench",
    lead: "Ask through one composer. The Master Agent routes to the trade, product and third-party diligence agents and returns one answer with its evidence chain — and always states what that answer stands on.",
    scope: ["US · China", "Export control only", "{sources} sources implemented", "{gems} gems"],

    kindsLabel: "What it does", kindsTitle: "Four kinds of work, one of them a review",
    kindsLead: "Treating every question as a compliance review is wrong. \u201cWhat is this part\u2019s ECCN\u201d has no counterparty, no destination and no transaction; running it through a procedure returns a general paragraph unrelated to what was asked. So questions are routed first, and each path has its own output and its own limits.",
    kindsHeads: ["Kind", "When it applies", "What it produces", "What it will not do"],
    kinds: [
      ["Compliance review", "A transaction is described \u2014 a party, an item, a destination or an end user", "The published procedure step by step, each step citing its provision; it stops at a step where evidence is missing; the conclusion carries a risk level and its limits", "Release a transaction. The last step is always human review"],
      ["Direct lookup", "A published value is asked for: a part\u2019s ECCN, what a control code means, whether a party is on a named list", "One step: the value and its source. Where it is not held, which records were read and who would know", "Infer. Absent from this data is not absent from control"],
      ["Regulatory briefing", "What was published over a period", "The period totalled \u2014 how many entities added, to which list, from where \u2014 then each notice with its action and number", "Judge whether any of it reaches a given transaction; that is a review"],
      ["Case memo", "Write up analysis already performed in this session", "The conclusions and their evidence, recorded", "Produce new judgements. Over an empty session it says there is nothing to write up"]
    ],
    kindsGemNote: "A gem declares which kind it is, so selecting /reg-brief does not open a party screening. A question that describes a transaction still gets the review, whichever gem is selected.",

    autoLabel: "Resolved automatically", autoTitle: "What should not have to be typed",
    autoLead: "Filling in forms on every question is what makes tools like this unusable. Anything public data can answer is looked up before it is asked for.",
    autoItems: [
      ["The counterparty", "\u201cCustomer Aveox Technologies\u201d in the question is enough: the name is matched against the synced lists, and where more than one entity survives, the two closest go forward. A similar name is not the same entity \u2014 telling them apart is what identity resolution is for."],
      ["Ownership", "The GLEIF register is queried for direct and ultimate parent. GLEIF\u2019s parent is the accounting consolidating parent and carries no percentages, so where a list matches, the aggregate holding is still asked for."],
      ["Item classification", "NVIDIA\u2019s 1,352 parts and AMD\u2019s 8,554 are ingested \u2014 ECCN, HTS and CCATS by part number. A vendor\u2019s statement is not a classification decision."],
      ["Path length", "Triage on stated facts: no third party means no diligence lane, EAR99 means no Country Chart cell to read. Every omission names the fact and the provision behind it, and uncertainty never shortens the path."]
    ],
    capLabel: "Capabilities", capTitle: "What one lane can ask another",
    capLead: "A question that crosses lanes does not become a conversation between agents. It goes through a named registry: inputs are declared, answers carry the provision that makes them binding, and anything that is a rule is computed in code. The same registry can be served outside — `npm run mcp` publishes it as MCP tools, and `/api/capabilities` reads it directly.",
    capHeads: ["Capability", "Answered by", "What it answers", "Provision"],
    capNote: "Every call records who asked, which lane answered and under which provision, on the step that made it. The answer also carries what it stands on: the sources searched and the records matched, or the plain statement that it rests on an unverified user declaration.",
    lanesLabel: "Scope", lanesTitle: "Three compliance lanes",
    lanes: [
      ["Trade", "Restricted-party screening and identity resolution", "US CSL / OFAC / EAR 744; PRC control and unreliable-entity lists; EU, Taiwan, Japan, UFLPA, DoD 1260H"],
      ["Product", "Item classification and licence determination", "US ECCN → reasons for control → country chart → exceptions; PRC control codes and licence catalogue; Japan's export control tables"],
      ["Ethics-TPDD", "Third-party diligence tied to export control", "End user, UBO, fees and payment path, circumvention patterns"]
    ],
    lanesNote: "Out of scope: market-access compliance (FCC, CCC, RoHS, energy efficiency).",
    laneHeads: ["Lane", "What it does", "Main sources"],

    dataLabel: "Data", dataTitle: "What it is connected to",
    figures: ["Registered sources", "Adapters implemented", "Synced", "Bundled copies", "List records"],
    cnTitle: "The PRC side",
    cnBody: "MOFCOM dual-use control notices, control list / watch list, Unreliable Entity List and the licence catalogue, through the sites' own public endpoints. No CAPTCHA is bypassed.",
    cnPoints: [
      "Designations are parsed into Chinese name, English name, common names, address and postcode.",
      "The count stated in the notice title is used as a parser self-check: a mismatch sets extractionComplete: false and the batch is not treated as a complete list.",
      "Suspend, adjust and repeal links between notices are recorded in supersedesNotices. Whether a measure is in force must be read together with them."
    ],
    fallbackTitle: "Bundled fallback",
    fallbackBody: "PRC sources are unreachable from some hosting regions. A committed point-in-time copy is used instead, and never presented as live: the state is a separate fallback_snapshot, the indicator is amber rather than green, and the answer states the capture date.",
    statusTitle: "What each evidence state means",
    statuses: [
      ["Live", "Page text actually retrieved during this request", "ok"],
      ["Archived copy", "Live retrieval failed; falls back to previously captured official text, with its capture date", "warn"],
      ["Cited only", "The publisher refuses automated access (OECD answers 403), so it is cited without fetching", "muted"],
      ["Metadata", "Title and description only, no body text", "muted"],
      ["Unavailable", "Neither reachable nor previously captured", "crit"]
    ],

    procLabel: "Procedures", procTitle: "Five procedures, four of them somebody else's",
    procLead: "The step sequences are not this product's invention. US export control has an official numbered decision procedure, ownership aggregation has OFAC's published position, and third-party diligence has the factors DOJ sets out — following them and citing each step is what answers \u201cwhy these steps\u201d. The table below is generated from the procedure definitions in the code, not transcribed alongside them.",
    procHeads: ["Procedure", "Published by", "Steps here", "What it decides"],
    procPurpose: {
      ear732: "Whether an item and a transaction are subject to the rules at all, what it classifies as, and whether that destination needs a licence. The longest one here; both the trade and product lanes take steps from it.",
      ofac50: "The part list screening cannot settle: indirect and aggregated ownership. A company owned 50% or more in total by designated parties is restricted even when it is not itself listed.",
      eccp: "Whether to engage a third party, what to check first, and how to keep watching for the life of the relationship. DOJ uses it to judge whether a compliance programme is real.",
      prcDualUse: "The PRC basis for dual-use control and what a licence application must contain.",
      derived: "Steps the official procedures have no equivalent for but which nothing can proceed without. Anything this system added is marked here rather than folded into an official citation."
    },
    procDerivedTag: "not official",
    procDerivedNote: "\u201cDesigned here\u201d is not an official procedure, so it is labelled separately in the opening briefing and in the execution rail. Presenting a step we designed as something a regulator requires is the one thing this page must not do.",
    procPrcNote: "The PRC dual-use regulation is currently cited as a **source** only; it has no step sequence of its own. A China export question runs the Item & licence lane, whose structure comes from EAR Part 732, while searching the PRC control list, licence catalogue and MOFCOM notices. China publishes no numbered decision tree, so no symmetrical one is invented here — but it does mean those step titles read in US terms.",
    procStepsTitle: "The steps in each lane", procStepUnit: "steps", procStepsNote: "Open a lane for its full sequence and the provision behind each step.",
    procStepHeads: ["#", "Step", "Basis", "What it asks you for"],
    procAsksNone: "\u2014",
    procGemTitle: "Where each gem starts",
    procGemLead: "A gem decides which lane the analysis opens with, not which lanes run — routing adds the others from the question itself. Below is the starting point and the procedure it belongs to.",
    procGemHeads: ["Gem", "Opening lane", "Opening procedure", "May add"],
    procLaneNames: { trade: "Trade — parties", product: "Product — item & licence", tpdd: "Ethics & TPDD", review: "Close", lookup: "Lookup", briefing: "Regulatory briefing", memo: "Case memo" },
    useLabel: "How to use", useTitle: "Press / in the composer",
    useLead: "Arrow keys select a gem, Enter confirms. A gem binds five things: what it produces, the instruction, the bound-source whitelist, the facts it requires, and the output template. The first decides which path it takes \u2014 /reg-brief is a briefing and never opens a party screening \u2014 and the fourth is what makes a gem more than a saved prompt: the interface knows what is missing before anything is submitted.",
    gemsLabel: "Available gems", gemBound: "sources", gemRecords: "records", gemUnsynced: "not synced", gemNone: "no bound sources",
    streamTitle: "One step at a time",
    streamBody: "The answer is produced in one direction, top to bottom, and stops at the step that needs something from you rather than analysing around the gap.",
    streamPoints: [
      "It opens by stating which review scopes the question falls into, which published procedure governs each, and the steps that procedure lays down — the flow rail on the right is the same list.",
      "Where a fact is missing the analysis stops at that step and asks there. No conclusion is drawn while a question is open: an assessment written over a gap the run has just stopped at is the thing this is trying not to produce.",
      "Supplying it continues from where it stopped. The body draws only what has run; the whole plan stays on the right.",
      "The three specialists run consecutively rather than at once. The cost is that a live run takes about as long as its three calls added together; the gain is a sequence a reader can follow."
    ],
    triageTitle: "Short where it should be short",
    triageBody: "EAR Part 732 numbers its own steps 1 through 29, and no reviewer runs all of them every time. Steps are closed on stated facts: no third party means the third-party lane does not arise; below de minimis means classification and everything downstream do not; EAR99 means there is no Country Chart cell to read. Every omission is shown with the fact and the provision that allowed it, and an undecided answer never shortens anything.",
    otherTitle: "Other entry points",
    otherPoints: [
      "Click a gem in the sidebar to use it; click again to see its full specification.",
      "Test scenarios offers 16 presets. Most only fill the composer; the three beginning with C are complete files that also fill in the declared facts, so they run through to a conclusion — they are there to show what the system says when every condition is met.",
      "The data status at the bottom left opens the coverage page: sync state, record counts and checksums per source.",
      "The top bar shows whether a model is configured. Every analysis runs on the live model: with none reachable the system refuses rather than assembling something that reads like one."
    ],

    demoLabel: "Demo script", demoTitle: "One logic, two outcomes",
    demoLead: "Select /screen-party and paste each in turn. Both outcomes come from a genuinely retrieved MOFCOM notice (2026 No. 23), not from staged demo data.",
    demoHit: "Match", demoCall: "Disposition",
    demos: [
      { q: "Customer Aveox Technologies (Shenzhen) Co., Ltd., registration 91440300778812XKA, Shenzhen China, direct customer",
        hit: "艾维奥克斯公司 · Aveox, Inc.",
        cmp: [["Country", "conflict", "CN vs US", 0], ["Address", "conflict", "Shenzhen vs Simi Valley, CA", 0], ["Reg. no.", "missing", "not in the listing", 2]],
        call: "Likely false positive — identity elements conflict", kind: "fp" },
      { q: "We plan to sell 20 servers to Red Cat Holdings, Inc.",
        hit: "红猫控股公司 · Red Cat Holdings, Inc.",
        cmp: [["Country", "agree", "US vs US", 1], ["Address", "agree", "South Salt Lake, UT", 1], ["Common name", "agree", "Red Cat", 1]],
        call: "Escalate for human confirmation", kind: "esc" }
    ],
    demoNote: "Neither is a final determination. A likely false positive still requires human confirmation against registration evidence; an escalation is not a confirmed match.",

    limitLabel: "Limits", limitTitle: "What you must know",
    limits: [
      "Not legal advice and not a transaction clearance. Output is for research and triage; conclusions require human compliance or legal review.",
      "Internal master data is synthetic. Products, partners and transactions are demo fixtures, all marked dataClass: synthetic with classifications marked unverified_demo_value.",
      "Screening only produces a potential match. The system never returns a confirmed match, and never concludes from red flags alone that a company is a shell or has acted unlawfully.",
      "A missing source is not an absence of risk. Unsynced list sources are listed as such rather than treated as checked and clean."
    ],
    todoTitle: "Not finished yet",
    todos: [
      "The Country Chart is parsed to 203 country rows, but the destination step still cites the provision rather than reading the chart automatically.",
      "China publishes no numbered decision tree, so the item lane takes its sequence from EAR Part 732. A PRC question runs that sequence against PRC lists, which means those step titles read in US terms.",
      "Fourteen of the thirty-four sources are read by no analysis step \u2014 CAPTCHA-gated, provision text, or organised on a different code system. The coverage page says which for each.",
      "Korea's strategic goods list has no automatable route; it stays a manual lookup.",
      "No official ECCN-to-EU or ECCN-to-Wassenaar crosswalk exists. Cross-regime comparison is derived from the control-number structure and is advisory, not a lookup.",
      "China Customs (HS codes, tariff) answers non-browser clients with 412, and Single Window is CAPTCHA-gated. Both are out of scope rather than pending.",
      "Chinese official sources carry no open-data licence. Fine for an internal prototype; get counsel before anything customer-facing.",
      "Do not enter trade secrets, sensitive personal data or confidential transaction details."
    ],
    footer: "Per-source status and detail live in"
  }
};

const state = { locale: localStorage.getItem("compliance-locale") || "zh", coverage: null, procedures: null, capabilities: null };
const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
const c = () => copy[state.locale];
const localized = (value) => (value && typeof value === "object" ? value[state.locale] || value.zh : value);

function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem("compliance-theme", theme); }

function figures() {
  const data = state.coverage;
  if (!data) return c().figures.map((label) => ({ value: "—", label }));
  const synced = data.sources.filter((s) => s.sync?.status === "success");
  const fallback = data.sources.filter((s) => s.sync?.status === "fallback_snapshot");
  const adapters = data.sources.filter((s) => s.adapter?.implemented);
  const records = [...synced, ...fallback].reduce((n, s) => n + (s.sync.recordCount || 0), 0);
  return [
    { value: String(data.sources.length), label: c().figures[0] },
    { value: String(adapters.length), label: c().figures[1] },
    { value: String(synced.length), label: c().figures[2] },
    { value: String(fallback.length), label: c().figures[3], warn: fallback.length > 0 },
    { value: records.toLocaleString(), label: c().figures[4] }
  ];
}

function gemBacking(gem) {
  if (!gem.boundSources.length || !state.coverage) return null;
  const byId = new Map(state.coverage.sources.map((s) => [s.sourceId, s]));
  const known = gem.boundSources.filter((id) => byId.has(id)).map((id) => byId.get(id));
  if (!known.length) return null;
  const usable = known.filter((s) => ["success", "fallback_snapshot"].includes(s.sync?.status));
  return {
    total: known.length,
    records: usable.reduce((n, s) => n + (s.sync.recordCount || 0), 0),
    missing: known.length - usable.length
  };
}

// Rendered only when the endpoint answered, like the procedures above. A page
// that guesses at what the system exposes to the outside is worse than one that
// stays quiet — and the point of this section is that a capability cannot be
// published without the provision that makes its answer binding, so a listing
// that invented one would defeat it.
function capabilitiesSection() {
  const t = c();
  const list = state.capabilities;
  if (!list?.length) return "";
  return `
    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.capLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.capTitle)}</h2>
        <p>${esc(t.capLead)}</p>
        <div class="table-wrap"><table>
          <thead><tr>${t.capHeads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
          <tbody>${list.map((item) => `
            <tr>
              <td><b>${esc(item.title)}</b><br><code>${esc(item.id)}</code></td>
              <td>${esc(item.providerName)}</td>
              <td>${esc(item.summary)}</td>
              <td>${esc(item.cite)}</td>
            </tr>`).join("")}</tbody>
        </table></div>
        <p class="guide-note">${esc(t.capNote)}</p>
      </div>
    </section>`;
}

// Rendered only when the endpoint answered. A procedures section that guesses
// at the procedures would be worse than one that is absent.
function proceduresSection() {
  const t = c();
  const data = state.procedures;
  if (!data) return "";
  const laneName = (lane) => t.procLaneNames[lane] || lane;
  const byId = Object.fromEntries(data.methodologies.map((item) => [item.id, item]));
  // A bold run in the copy carries the sentence's actual claim, so it is kept
  // rather than escaped away with the rest.
  const strong = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return `
    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.procLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.procTitle)}</h2>
        <p>${esc(t.procLead)}</p>

        <div class="table-wrap"><table>
          <thead><tr>${t.procHeads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
          <tbody>${data.methodologies.map((item) => `<tr>
            <td>${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer noopener">${esc(item.label)}</a>` : esc(item.label)}
              ${item.kind === "derived" ? `<span class="proc-tag">${esc(t.procDerivedTag)}</span>` : ""}</td>
            <td>${esc(item.authority || "—")}</td>
            <td class="proc-count">${item.stepCount ? `${item.stepCount}` : "0"}${item.lanes.length ? `<span>${item.lanes.map(laneName).map((name) => name.split(" — ")[0]).join(" · ")}</span>` : ""}</td>
            <td>${esc(t.procPurpose[item.id] || "")}</td>
          </tr>`).join("")}</tbody>
        </table></div>
        <p class="guide-note">${strong(t.procPrcNote)}</p>
        <p class="guide-note">${esc(t.procDerivedNote)}</p>

        <h3>${esc(t.procStepsTitle)}</h3>
        <p class="guide-note">${esc(t.procStepsNote)}</p>
        ${data.lanes.map((lane) => `
          <details class="proc-lane">
            <summary><b>${esc(laneName(lane.lane))}</b><span>${esc(byId[lane.methodology]?.label || lane.methodology)}</span><em>${lane.steps.length} ${esc(t.procStepUnit)}</em></summary>
            <div class="table-wrap"><table>
              <thead><tr>${t.procStepHeads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
              <tbody>${lane.steps.map((step, index) => `<tr>
                <td class="proc-n">${index + 1}</td>
                <td>${esc(step.title)}</td>
                <td><code>${esc(step.cite || "—")}</code>${step.methodology !== lane.methodology ? `<span class="proc-tag">${esc(byId[step.methodology]?.label || step.methodology)}</span>` : ""}${step.note ? `<span class="proc-note">${esc(step.note)}</span>` : ""}</td>
                <td>${step.asks.length ? step.asks.map((ask) => esc(ask)).join("<br>") : esc(t.procAsksNone)}</td>
              </tr>`).join("")}</tbody>
            </table></div>
          </details>`).join("")}

        <h3>${esc(t.procGemTitle)}</h3>
        <p>${esc(t.procGemLead)}</p>
        <div class="table-wrap"><table>
          <thead><tr>${t.procGemHeads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
          <tbody>${GEMS.map((gem) => {
            const lead = data.gemLeadLane[gem.id] || "trade";
            const leadPlan = data.lanes.find((lane) => lane.lane === lead);
            const others = data.lanes
              .filter((lane) => lane.lane !== lead && lane.lane !== "review" && lane.methodology !== leadPlan?.methodology)
              .map((lane) => byId[lane.methodology]?.label || lane.methodology);
            return `<tr>
              <td><code>${esc(gem.command)}</code><span class="proc-note">${esc(localized(gem.name))}</span></td>
              <td>${esc(laneName(lead))}</td>
              <td>${esc(byId[leadPlan?.methodology]?.label || "—")}</td>
              <td>${[...new Set(others)].map((label) => esc(label)).join(" · ")}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>
    </section>`;
}

function render() {
  const t = c();
  const adapters = state.coverage ? state.coverage.sources.filter((s) => s.adapter?.implemented).length : "—";

  $("guideMain").innerHTML = `
    <section class="guide-masthead">
      <p class="eyebrow">${esc(t.kicker)}</p>
      <h1>${esc(t.title)}</h1>
      <p class="guide-lead">${esc(t.lead)}</p>
      <div class="scope-row">${t.scope
        .map((s) => `<span>${esc(s.replace("{sources}", adapters).replace("{gems}", GEMS.length))}</span>`).join("")}</div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.kindsLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.kindsTitle)}</h2>
        <p>${esc(t.kindsLead)}</p>
        <div class="table-wrap"><table>
          <thead><tr>${t.kindsHeads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
          <tbody>${t.kinds.map((row) => `<tr>${row.map((cell, index) => `<td>${index === 0 ? `<b>${esc(cell)}</b>` : esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>
        <p class="guide-note">${esc(t.kindsGemNote)}</p>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.autoLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.autoTitle)}</h2>
        <p>${esc(t.autoLead)}</p>
        <ul class="guide-list auto-list">${t.autoItems.map(([name, detail]) => `
          <li><b>${esc(name)}</b>${esc(detail)}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.lanesLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.lanesTitle)}</h2>
        <div class="table-wrap"><table>
          <thead><tr>${t.laneHeads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${t.lanes.map((row) => `<tr>${row.map((cell, i) => `<td${i === 0 ? "" : ""}>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>
        <p class="guide-note">${esc(t.lanesNote)}</p>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.dataLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.dataTitle)}</h2>
        <div class="coverage-summary guide-figures">${figures().map((f) => `
          <article><div><strong class="${f.warn ? "is-warn" : ""}">${esc(f.value)}</strong><span>${esc(f.label)}</span></div></article>`).join("")}</div>

        <h3>${esc(t.cnTitle)}</h3>
        <p>${esc(t.cnBody)}</p>
        <ul class="guide-list">${t.cnPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>

        <h3>${esc(t.fallbackTitle)}</h3>
        <p>${esc(t.fallbackBody)}</p>

        <h3>${esc(t.statusTitle)}</h3>
        <div class="status-table">${t.statuses.map(([name, meaning, kind]) => `
          <div><span class="status-pill ${esc(kind)}">${esc(name)}</span><span>${esc(meaning)}</span></div>`).join("")}</div>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.useLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.useTitle)}</h2>
        <p>${esc(t.useLead)}</p>

        <h3>${esc(t.gemsLabel)}</h3>
        <div class="guide-gems">${GEMS.map((gem) => {
          const b = gemBacking(gem);
          const meta = b
            ? `${b.total} ${t.gemBound}${b.records ? ` · ${b.records.toLocaleString()} ${t.gemRecords}` : ""}${b.missing ? ` · <span class="warn">${b.missing} ${t.gemUnsynced}</span>` : ""}`
            : t.gemNone;
          return `<article>
            <div class="guide-gem-head"><span class="gem-icon">${esc(gem.icon)}</span>
              <strong>${esc(localized(gem.name))}</strong><code>${esc(gem.command)}</code></div>
            <p>${esc(localized(gem.summary))}</p>
            <div class="guide-gem-meta">${meta}</div>
          </article>`;
        }).join("")}</div>

        <h3>${esc(t.streamTitle)}</h3>
        <p>${esc(t.streamBody)}</p>
        <ul class="guide-list">${t.streamPoints.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>

        <h3>${esc(t.triageTitle)}</h3>
        <p>${esc(t.triageBody)}</p>

        <h3>${esc(t.otherTitle)}</h3>
        <ul class="guide-list">${t.otherPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
    </section>

    ${proceduresSection()}
    ${capabilitiesSection()}

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.demoLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.demoTitle)}</h2>
        <p>${esc(t.demoLead)}</p>
        <div class="verdicts">${t.demos.map((d) => `
          <article class="verdict ${esc(d.kind)}">
            <header>${esc(d.q)}</header>
            <div class="verdict-out">
              <div><span class="verdict-label">${esc(t.demoHit)}</span><span>${esc(d.hit)}</span></div>
              <div class="cmp">${d.cmp.map(([k, v, detail, kind]) => `
                <div><span class="k">${esc(k)}</span><span class="${kind === 1 ? "agree" : kind === 0 ? "conflict" : "k"}">${esc(v)}</span><span class="v">${esc(detail)}</span></div>`).join("")}</div>
              <div><span class="verdict-label">${esc(t.demoCall)}</span><span class="verdict-call">${esc(d.call)}</span></div>
            </div>
          </article>`).join("")}</div>
        <p class="guide-note">${esc(t.demoNote)}</p>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.limitLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.limitTitle)}</h2>
        <div class="guide-limit">${t.limits.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
        <h3>${esc(t.todoTitle)}</h3>
        <ul class="guide-list">${t.todos.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <p class="guide-note">${esc(t.footer)} <a href="/data-sources.html">${esc(t.coverage)}</a>.</p>
      </div>
    </section>`;
}

// The catalogue is written in both languages on the server, so switching sides
// refetches rather than translating on the page. Section headings around
// untranslated capability titles is exactly the half-English answer this whole
// interface was corrected for.
function loadCapabilities() {
  fetch(`/api/capabilities?locale=${state.locale}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => { if (data?.capabilities) { state.capabilities = data.capabilities; render(); } })
    .catch(() => { /* the section simply does not render */ });
}

function applyLocale(locale) {
  state.locale = locale;
  localStorage.setItem("compliance-locale", locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  $("brandSub").textContent = c().brandSub;
  $("backLabel").textContent = c().back;
  $("coverageLink").textContent = c().coverage;
  $("guideZh").classList.toggle("active", locale === "zh");
  $("guideEn").classList.toggle("active", locale === "en");
  render();
  loadCapabilities();
}

$("guideZh").addEventListener("click", () => applyLocale("zh"));
$("guideEn").addEventListener("click", () => applyLocale("en"));
$("guideTheme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

setTheme(localStorage.getItem("compliance-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
applyLocale(state.locale);

fetch("/api/procedures")
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => { if (data) { state.procedures = data; render(); } })
  .catch(() => { /* the section simply does not render */ });

fetch("/api/data-sources")
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => { if (data) { state.coverage = data; render(); } })
  .catch(() => { /* the guide stands on its own; the figures simply stay blank */ });

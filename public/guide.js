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
      ["合规审查", "描述了一笔交易——有交易方、物项、目的地或最终用户", "按已公布程序逐步执行，每步带条文依据；缺资料不停下，跑完给出阶段性判断并列出还缺什么；结论带风险等级与边界", "不放行交易。最后一步永远是人工复核"],
      ["直接查询", "问一个已登记的值：料号的 ECCN、管制编码的含义、某主体是否在某份清单上", "单步检索，直接给值和来源；查不到时说明查了哪些记录、答案在谁那里", "不推断。未收录不等于不受管制"],
      ["监管简报", "问一段时间内发布了什么变化", "按公告汇总：新增多少家、分别进了哪份清单、来自哪些国家，再逐份列出动作与公告号", "不判断这些变化是否影响某笔交易——那是审查"],
      ["案件备忘录", "在对话里说「把上面的整理成备忘录」——没有对应的 Gem，说一句就行", "记录既有结论与证据来源", "不产生新判断。会话为空时直接说没有可整理的内容；描述了交易的问题仍然走审查，哪怕里面出现「备忘录」三个字"]
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
      ["缓存命中", "距上次抓取不足 24 小时，直接用缓存，完全不出网；带缓存时长", "ok"],
      ["已采集副本", "实时抓取失败，回落到此前抓过的正文，带采集日期并标注为过期", "warn"],
      ["入库存档", "缓存也没有，回落到已同步记录里存的同一篇官方文本", "warn"],
      ["仅引用", "该发布方拒绝自动访问（如 OECD 返回 403），只引用不抓取", "muted"],
      ["元数据", "只有来源标题与说明，没有正文", "muted"],
      ["获取失败", "既抓不到、也没有缓存和存档 —— 明说没取到，不用摘要冒充原文", "crit"]
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
    useLead: "两层，一屏都列出来。上面是常驻台：合规总控台（没选时的默认，按问题自动分流），以及贸易、物项与许可、第三方尽调三条线，正是首页图上那三个框；选中一张台就坐在上面，问什么都按那条线的完整流程走，直到你换一张或按 ×。下面是每张台的窄化入口：同一条线，问题已经指向了其中一段。每个入口都是一个可以一直待着的位置。\n每个 Gem 绑定五样东西：产出类型、指令、数据源白名单、必填事实清单、输出模板。产出类型决定它走哪条路——/reg-brief 是简报，不会触发受限方筛查；必填事实清单则让系统在提交前就知道自己缺什么，而不是让模型悄悄猜。",
    gemsLabel: "可用 Gem", gemBound: "个来源", gemRecords: "条记录", gemUnsynced: "个未同步", gemNone: "不绑定外部来源",
    buildTitle: "自己建 Gem 和 Skill",
    buildLead: "左侧栏 Gems 和 Skills 两个标题旁边各有一个 ＋。内置了一个 Skill（/reg-impact 监管变化影响评估），它在代码里，删不掉也不会被同名覆盖；其余都是自己建的。两者不是并列关系：Gem 是「谁在回答」，选中后一直挂着；Skill 挂在 Gem 下面，是这一问怎么做。",
    cmpGem: {
      title: "Gem — 常驻，四样字段每样都被消费",
      lead: "选中后命令从输入框消失，一直保持到你换一个或按 ×——开新对话、刷新页面都还在它里面。",
      points: [
        "类型决定跑不跑完整审查流程（审查 / 直查 / 简报 / 备忘录）",
        "指令发给三条专业线",
        "绑定的数据源会写进问题：只依据这些来源",
        "「问题需包含的事实」在你按发送之前就提示还缺什么",
        "自建的填关键词，内置八个用正则——关键词更松，但这个提示从不拦提交，漏判的代价是少一句提醒",
        "自建 Gem 还能指定挂哪几个 Skill；不指定就是自建 Skill 全都能用，内置八个都是这样"
      ]
    },
    cmpSkill: {
      title: "Skill — 一段流程说明，挂在当前 Gem 下",
      lead: "命令留在文本里，服务端解析掉之后把这段话追加到模型的系统提示末尾。",
      points: [
        "左侧列表和 / 面板只列当前 Gem 挂着的那几个；不在名单里的，服务端也不会执行",
        "不绑定数据源，也不要求问题里必须包含什么",
        "它标明是你自己的流程，并附一句：不是证据，不放宽任何规则",
        "声明过的值仍然是声明，没有证据的步骤不因它而闭合"
      ]
    },
    buildNamespace: "两者共用一个斜杠命名空间。新建时会同时对照内置 Gem、已有的自建 Gem 和 Skill，撞名直接拒绝并说明被谁占了——否则面板里会出现两个同名条目。",
    atTitle: "键入 @ — 直查数据源，不做判定",
    atBody: "在输入框开头打 @ 会列出已入库的来源，选一个之后按实体名、公告号或条文关键词翻它的原始记录。",
    atPoints: [
      "返回的是来源自己的条目，带采集时间和出处，不是判定结论",
      "答案里每条依据旁边的 ⛁ 也跳到这里，用来核对那一句站在什么上面",
      "时点副本会标明它是副本以及采集日期，不会冒充当前数据"
    ],
    streamTitle: "一步一步，问完再分析",
    streamBody: "回答按顺序自上而下产生。缺资料不打断：跑完后在结论旁列出还缺哪几项，补上任意一项就接着往下判。",
    streamPoints: [
      "开场先说明本次落在哪些审查范围、每个范围遵循哪份已公布的程序、步骤有哪些——右侧执行流程就是同一份清单。",
      "缺资料时分析照常跑完，结论标为「阶段性判断」并列出未闭合的步骤，就地可填。只要还有一步未闭合，就不会出清晰结论——在缺口上写一个看起来已定案的判断，正是本工具要避免的。",
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

    clearLabel: "结案", clearTitle: "五个条件，分属三条线",
    clearLead: "「可以结案」不是模型的判断，是代码算出来的。五个条件写在 src/clearance.js 里，每条都必须被问题或声明里真实说出的事实满足，每条都带它依据的条文。它们在三条专业线开跑之前就算完了，而且不进三条线——直接给主 Agent 综合，并约束它给出的风险等级：五条全过时「低风险」才成立，没过时不允许写「低」。",
    clearHeads: ["条件", "怎样才算满足", "依据", "谁负责"],
    clearItems: [
      ["名单筛查", "已筛过官方名单（必含美国综合筛查名单）且零命中", "§ 732.3(g) · Supp. No. 3 to Part 732", "贸易线"],
      ["物项分类", "EAR99，或受控美国原产内容低于 de minimis 门槛", "Part 774 CCL · § 738.3 · § 734.4", "产品线"],
      ["最终目的地", "已声明，且落在免许可目的地白名单内（19 个国家）", "Part 738 Country Chart · Part 740", "产品线"],
      ["第三方参与", "问题明确说明是直接交易，无代理、经销或中间方", "DOJ ECCP — Third-Party Management", "尽调线"],
      ["最终用途", "已声明，且不落入 § 744 列举的敏感用途", "§ 744 General Prohibition Five", "产品线 + 尽调线"]
    ],
    clearGateTitle: "还有第六道闸",
    clearGateBody: "五条全过，但路径上还留着任何一个在等证据的步骤，依然不出清晰结论。五个绿勾配一个开着的步骤，正是一份「看起来完成了但没有」的卷宗。",
    clearPoints: [
      "沉默永远不算通过。没说目的地不等于目的地没问题；没提中间商不等于没有中间商——界面上写的就是「未提及不等于没有」。",
      "免许可目的地是白名单，不是黑名单。没人写规则的国家不会漏成「没问题」。",
      "「不确定 / 未知 / 待定 / n/a / TBD」这类占位符不算已声明，否则一个占位符就能换来一次放行。",
      "否定句能被读懂：「无军事或核相关用途」是否认，不会被当成提到了军事用途；但「不转售，用于导弹项目」的后半句照样命中。",
      "五个条件会逐条显示在答案里：满足 / 未满足、原因、负责的条线，满足的带条文出处。未满足的不带——还没有成立的事实供条文附着。",
      "「可结案」的含义是「在这些事实、这些条文下不产生许可要求」，永远不是「批准」。人工复核那一步照常在，本系统不做交易放行。"
    ],

    memLabel: "记忆与进化", memTitle: "系统记住什么，又怎样自己变好",
    memLead: "两件常被混为一谈的事：一次会话里的上下文，和跨会话留下的案件记录。前者进模型，后者不进。",
    memPoints: [
      "会话内：最近 6 轮对话连同这次的问题一起发给模型，专业线和综合各一份。",
      "跨会话：案件历史存在 threads 与 turns 两张表里，上限 100 个会话、每个会话 30 轮，超出按最近使用裁剪。",
      "重开一个历史案件时，恢复的是案件编号与已声明的事实，对话本身不恢复——模型看不到上次的措辞，只看到这次的事实，旧表述带不偏新结论。",
      "声明的事实一路累积。补一项就针对它继续判，走的就是这条路径，不是把整个问题重问一遍。",
      "历史能否活过重新部署取决于有没有挂持久卷。容器文件系统是临时的，数据覆盖页会如实说明当前是哪一种。"
    ],
    evoTitle: "案件信号：每次运行留一行",
    evoBody: "每次运行还会写一行结构化信号，和裁剪写在同一个事务里，但被刻意排除在裁剪之外——案件历史是给人看的，可以过期；信号是用来度量系统本身的，一裁剪趋势就断了。信号记的是结构不是原文：意图、开了哪几条线、路由词有没有命中、停在哪一步、补了哪些字段、还剩几步未闭合。",
    evoMetricsTitle: "四个指标，两张表",
    evoMetrics: [
      ["兜底率", "问题里没有任何路由词命中、三条线全开的比例。衡量词表覆盖不覆盖得住人真实的写法。"],
      ["打断率", "运行中途停下来问人的比例。"],
      ["每案轮次", "一个案件平均来回几次。"],
      ["未闭合结案", "结束时仍留有等证据步骤的次数。"]
    ],
    evoTablesNote: "另有两张表直接指出下一步改哪里：最常卡住的步骤，以及被问了才补的字段——后者每一项都是输入框本可以一开始就问的。",
    evoLineTitle: "可以自动改的，和绝不自动改的",
    evoLine: [
      ["可以", "路由词表、Gem 的必需字段、匹配阈值（只许向召回放宽）、同步频率、探针语料"],
      ["绝不", "五个结案条件、触发门与它们的条文、跨线依赖边、任何能力的条文出处、「声明不等于已核验证据」"]
    ],
    evoNote: "右边每一项都指向一条法规，而法规不会因为模型认为该改就改。自动化的产出是提案不是提交：包含改动、哪些案例为证、一个改前失败改后通过的测试，以及全套测试结果，由人合并。另外，每案轮次绝不能单独优化——一个被奖励「少问几轮」的模型会学会少问，未闭合步骤是它的对手项。",
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
      "36 个数据源中有 14 个当前不被任何分析步骤读取——验证码限制、条文类、或编码口径不匹配。数据覆盖页逐个标注了是哪一种。",
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
      ["Case memo", "Ask for it in the conversation \u2014 \u201cwrite the above up as a memo\u201d. There is no gem for it; saying so is enough", "The conclusions and their evidence, recorded", "Produce new judgements. Over an empty session it says there is nothing to write up, and a question that describes a transaction still gets the review even with the word in it"]
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
      ["Cached", "Fetched less than 24 hours ago, so the network is not touched at all; the age is shown", "ok"],
      ["Stale copy", "Live retrieval failed; the previously fetched text is used and labelled as out of date", "warn"],
      ["Archived", "No cache either, so the same official text is taken from the synced records", "warn"],
      ["Cited only", "The publisher refuses automated access (OECD answers 403), so it is cited without fetching", "muted"],
      ["Metadata", "Title and description only, no body text", "muted"],
      ["Unavailable", "Neither reachable, cached nor archived — said plainly, never papered over with a summary", "crit"]
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
    useLead: "Two levels, all of it on one screen. The desks come first: Compliance Hub \u2014 the default when nothing is chosen, routing by what is asked \u2014 then Trade, Item & licence and Third-party diligence, the three lanes on the home page. Choosing one seats you there: whatever you ask runs that lane's full procedure, until you pick another or press \u00d7. Below each desk are its narrower entries \u2014 the same lane with the question already pointed at one part of it. Every entry is a place you can stay.\nA gem binds five things: what it produces, the instruction, the bound-source whitelist, the facts it requires, and the output template. The first decides which path it takes \u2014 /reg-brief is a briefing and never opens a party screening \u2014 and the fourth is what makes a gem more than a saved prompt: the interface knows what is missing before anything is submitted.",
    gemsLabel: "Available gems", gemBound: "sources", gemRecords: "records", gemUnsynced: "not synced", gemNone: "no bound sources",
    buildTitle: "Build your own gems and skills",
    buildLead: "A ＋ sits beside each of the two sidebar headings. One skill ships with the product \u2014 /reg-impact, regulatory-change impact \u2014 and it lives in the code, so it cannot be deleted and nothing can take its command; the rest are yours. They are not siblings: a gem is who is answering and stays selected, and skills hang under it as how this one question should be done.",
    cmpGem: {
      title: "Gem \u2014 it stays, and all four fields are consumed",
      lead: "Choosing one clears the command from the composer and keeps it until you pick another or press \u00d7 \u2014 a new conversation and a page reload are both still inside it.",
      points: [
        "Its kind decides whether a review procedure runs at all (review / lookup / briefing / memo)",
        "Its instruction goes to the three specialist lanes",
        "Its bound sources are written into the question: rely on these only",
        "Its required facts tell you what the question is missing before you press send",
        "A custom one uses keywords where the built-in eight use regular expressions \u2014 looser, but this hint never blocks a submission, so a miss costs a prompt rather than an answer",
        "A custom gem can also name the skills that hang under it; naming none means every skill you wrote is available, which is what all eight built-ins do"
      ]
    },
    cmpSkill: {
      title: "Skill \u2014 one procedure, under the gem you are in",
      lead: "The command stays in the text; the server parses it off and appends the procedure to the model's system prompt.",
      points: [
        "The sidebar and the / palette list only what the current gem carries, and the server will not run one it does not",
        "It binds no sources and requires nothing of the question",
        "It arrives labelled as your own procedure, with a line saying it is not evidence and relaxes nothing",
        "A declared value is still declared, and no step without evidence is settled by it"
      ]
    },
    buildNamespace: "They share one slash namespace. Creating either checks the built-in gems, the custom gems and the skills at once, and a collision is refused with the holder named \u2014 otherwise the palette would list two entries answering to one command.",
    atTitle: "Type @ \u2014 query a source, no determination",
    atBody: "Typing @ at the start of the composer lists the ingested sources; pick one and search its own records by entity name, notice number or keyword.",
    atPoints: [
      "It returns the source's own entries with their capture time and provenance, not a determination",
      "The \u26C1 beside a step's basis in an answer opens the same view, to check what that line stands on",
      "A point-in-time copy says it is one and gives its capture date; it never presents as current data"
    ],
    streamTitle: "One step at a time",
    streamBody: "The answer is produced in one direction, top to bottom, and stops at the step that needs something from you rather than analysing around the gap.",
    streamPoints: [
      "It opens by stating which review scopes the question falls into, which published procedure governs each, and the steps that procedure lays down — the flow rail on the right is the same list.",
      "Where a fact is missing the run does not stop. It finishes, writes the assessment it can support, and names what is still outstanding beside it — labelled interim, and barred from reading as cleared while any step is open. Supplying one of those facts later in the conversation carries on from there rather than starting the procedure again.",
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

    clearLabel: "Clearance", clearTitle: "Five conditions, across three lanes",
    clearLead: "\u201cThis clears\u201d is not the model\u0027s judgement; it is computed in code. The five conditions live in src/clearance.js, each has to be met by something the question or the declarations actually state, and each carries the provision it rests on. They are worked out before any specialist runs, and they do not go to the specialists at all \u2014 they go straight to the master agent\u0027s synthesis, where they bound the risk level it may give: low is only available when all five hold, and forbidden when they do not.",
    clearHeads: ["Condition", "What meets it", "Provision", "Lane answerable"],
    clearItems: [
      ["List screening", "Official lists searched (the US Consolidated Screening List among them) with no match", "\u00a7 732.3(g) \u00b7 Supp. No. 3 to Part 732", "Trade"],
      ["Item classification", "EAR99, or controlled US-origin content below the de minimis threshold", "Part 774 CCL \u00b7 \u00a7 738.3 \u00b7 \u00a7 734.4", "Product"],
      ["Final destination", "Stated, and on the licence-free destination list (19 countries)", "Part 738 Country Chart \u00b7 Part 740", "Product"],
      ["Third party", "The question states a direct transaction with no agent, distributor or intermediary", "DOJ ECCP \u2014 Third-Party Management", "TPDD"],
      ["End use", "Stated, and not among the uses prohibited by \u00a7 744", "\u00a7 744 General Prohibition Five", "Product + TPDD"]
    ],
    clearGateTitle: "And a sixth gate",
    clearGateBody: "All five met, with any step on the path still waiting on evidence, still does not clear. Five green ticks against an open step is exactly the shape of a file that looks finished and is not.",
    clearPoints: [
      "Silence is never a pass. An unstated destination is not a safe destination; an unmentioned intermediary is not an absent one \u2014 the reason the interface gives is literally \u201cnot mentioned is not an answer\u201d.",
      "Licence-free destinations are an allow-list, not a block-list. A country nobody wrote a rule for cannot fall through into \u201cfine\u201d.",
      "Placeholders \u2014 unknown, TBD, n/a \u2014 do not count as stated, or a placeholder would buy a clearance.",
      "Denials are read as denials: \u201cno military or nuclear application\u201d does not count as mentioning a military use, while \u201cno resale, for a missile programme\u201d still matches on its second half.",
      "The five are shown one by one in the answer: met or not, why, which lane answers for it, and the provision where one holds. An unmet condition carries none \u2014 there is nothing yet for a provision to attach to.",
      "Cleared means \u201cno licence requirement arises on these facts under these provisions\u201d, never \u201capproved\u201d. The human review step stands; this system does not release transactions."
    ],

    memLabel: "Memory & evolution", memTitle: "What it remembers, and how it improves",
    memLead: "Two things that get conflated: context within one session, and the case record that outlives it. The first goes to the model; the second does not.",
    memPoints: [
      "Within a session: the last six exchanges go to the model alongside the current question, once for each specialist and once for the synthesis.",
      "Across sessions: case history lives in threads and turns \u2014 100 threads, 30 turns each, pruned by least recently used.",
      "Reopening a case restores the case id and the facts already declared, not the conversation. The model sees this run\u0027s facts rather than last run\u0027s wording, so an old phrasing cannot pull a new conclusion.",
      "Declared facts accumulate. Stopping to ask and resuming from the break uses that, rather than re-asking the whole question.",
      "Whether history survives a redeploy depends on a mounted volume. The container filesystem is ephemeral, and the coverage page says which one is in force."
    ],
    evoTitle: "Case signals: one row per run",
    evoBody: "Each run also writes one structured row, in the same transaction as the pruning and deliberately outside it \u2014 case history is for people and may expire, signals measure the system itself and a pruned trend is no trend. Signals record structure, not prose: the intent, which lanes opened, whether any routing term matched, where it stopped, which fields were supplied, how many steps were left open.",
    evoMetricsTitle: "Four numbers, two lists",
    evoMetrics: [
      ["Fallback rate", "Runs where nothing in the question matched a routing term and every lane ran. The headline number for how well the vocabulary covers how people write."],
      ["Ask rate", "How often a run stopped and interrupted the reader."],
      ["Rounds per thread", "How many exchanges a case takes."],
      ["Open at close", "Cases that ended still holding a step waiting on evidence."]
    ],
    evoTablesNote: "Two lists say where to look next: which steps most often stop a run, and which fields were supplied only after being asked for. Every entry in the second is a field the composer could have asked for up front.",
    evoLineTitle: "What may change itself, and what may not",
    evoLine: [
      ["May", "Routing vocabulary, a gem\u0027s required facts, match thresholds (toward recall only), sync cadence, the probe corpus"],
      ["Never", "The five clearance conditions, the triage gates and their citations, cross-lane dependency edges, any capability\u0027s provision, \u201ca declaration is not verified evidence\u201d"]
    ],
    evoNote: "Everything on the right points at a provision, and provisions do not change because a model concluded they should. What automation produces is a proposal, not a commit: the diff, which recorded cases are the evidence, a test that fails before and passes after, and the result of the existing suite \u2014 merged by a person. And rounds per thread must never be optimised alone: a model rewarded for fewer rounds learns to ask for less, and open-at-close is the counterweight.",
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
      "Fourteen of the thirty-six sources are read by no analysis step \u2014 CAPTCHA-gated, provision text, or organised on a different code system. The coverage page says which for each.",
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
                <td>${step.asks.length ? step.asks.map((ask) => esc(ask.label)).join("<br>") : esc(t.procAsksNone)}</td>
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
        ${/* Split on the newline rather than rendered as one block: esc() puts
              the \n through as a space, so the two paragraphs ran together into
              a wall. */ ""}
        ${t.useLead.split("\n").map((para) => `<p>${esc(para)}</p>`).join("")}

        <h3>${esc(t.gemsLabel)}</h3>
        ${/* Desks first, then everything else, so the page shows the shape the
              palette does rather than one flat run of ten cards. */ ""}
        <div class="guide-gems">${[...GEMS].sort((a, b) => Number(Boolean(b.desk)) - Number(Boolean(a.desk))).map((gem) => {
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

        ${/* Three entry points, one composer. What the eight gems are is above;
              what a reader can add and how a raw lookup differs from a review is
              the part the page did not have at all. */ ""}
        <h3>${esc(t.buildTitle)}</h3>
        <p>${esc(t.buildLead)}</p>
        <div class="guide-compare">
          ${[["gem", t.cmpGem], ["skill", t.cmpSkill]].map(([kind, col]) => `
            <article class="cmp-${esc(kind)}">
              <h4>${esc(col.title)}</h4>
              <p>${esc(col.lead)}</p>
              <ul class="guide-list">${col.points.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
            </article>`).join("")}
        </div>
        <p class="guide-note">${esc(t.buildNamespace)}</p>

        <h3>${esc(t.atTitle)}</h3>
        <p>${esc(t.atBody)}</p>
        <ul class="guide-list">${t.atPoints.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>

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
      <div class="guide-gutter">${esc(t.clearLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.clearTitle)}</h2>
        <p>${esc(t.clearLead)}</p>
        <div class="table-wrap"><table>
          <thead><tr>${t.clearHeads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${t.clearItems.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>
        <h3>${esc(t.clearGateTitle)}</h3>
        <p>${esc(t.clearGateBody)}</p>
        <ul class="guide-list">${t.clearPoints.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="guide-reg">
      <div class="guide-gutter">${esc(t.memLabel)}</div>
      <div class="guide-body">
        <h2>${esc(t.memTitle)}</h2>
        <p>${esc(t.memLead)}</p>
        <ul class="guide-list">${t.memPoints.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>

        <h3>${esc(t.evoTitle)}</h3>
        <p>${esc(t.evoBody)}</p>
        <h3>${esc(t.evoMetricsTitle)}</h3>
        <dl class="guide-defs">${t.evoMetrics.map(([term, body]) => `<dt>${esc(term)}</dt><dd>${esc(body)}</dd>`).join("")}</dl>
        <p class="guide-note">${esc(t.evoTablesNote)}</p>

        <h3>${esc(t.evoLineTitle)}</h3>
        <dl class="guide-defs">${t.evoLine.map(([term, body]) => `<dt>${esc(term)}</dt><dd>${esc(body)}</dd>`).join("")}</dl>
        <p class="guide-note">${esc(t.evoNote)}</p>
      </div>
    </section>

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

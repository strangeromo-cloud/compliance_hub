// What each source is for, in the review.
//
// The registry already carries `notes`, but those are technical: how the source
// is fetched, what its format limits are. They answer "how do we get it" and not
// "what is it for", and the second is what a compliance reader needs when they
// are looking at thirty-four cards and deciding whether the coverage is enough.
//
// `usedIn` names the steps that actually read it. A source that is ingested and
// read by nothing is not a failure — several are here because a reviewer wants
// to search them directly — but it should not look like part of the analysis
// when it is not. A test holds every registry entry to having an entry here, so
// a new source cannot arrive without someone deciding what it is for.

export const SOURCE_PURPOSE = {
  // ---- Restricted-party screening
  "trade-csl": {
    zh: "受限方筛查的主名单。它是聚合体：25,921 条里含 OFAC SDN、BIS 实体清单、被拒绝人员清单、未核实清单、军事最终用户清单、国务院 ITAR 除名等十余份。判定「可结案」时唯一必须已同步的美国名单。",
    en: "The main list for party screening, and an aggregate: OFAC's SDN plus BIS's Entity, Denied Persons, Unverified and Military End User lists and more. The one US list that must be synced before a case can clear.",
    usedIn: ["search_lists", "name_match", "identity_resolution", "clearance"],
    // Not a separate source: the same list, matched by its publisher instead of
    // by us. Stated here so the page can say the option exists and whether it is
    // switched on.
    optionalApi: {
      credential: "TRADE_GOV_API_KEY",
      zh: "ITA 还提供官方检索接口，对同一份名单做发布方自己的模糊匹配。配置 TRADE_GOV_API_KEY 后，名称比对由发布方判定并与本机比对分开呈现；未配置时功能不减，筛查照常用本机快照。申请地址 developer.trade.gov（免费；该站 2026-07-28 起证书过期，暂时无法访问）。",
      en: "The ITA also offers a search API — the publisher's own fuzzy matching over this same list. With TRADE_GOV_API_KEY set, name comparison is answered by the publisher and shown separately from ours; without it nothing is lost and screening runs on the local snapshot. Free at developer.trade.gov, whose certificate expired on 2026-07-28 and is currently unreachable."
    }
  },
  "ofac-sls": {
    zh: "OFAC 自有发布口径的制裁名单。内容已被 trade-csl 覆盖，保留它是因为 OFAC 按自己的节奏发布，可能比聚合的 CSL 更新。",
    en: "OFAC's own feed. Its designations are already inside trade-csl; it is kept because OFAC publishes on its own schedule and can be fresher than the aggregate.",
    usedIn: ["search_lists"]
  },
  "eu-fsf": {
    zh: "欧盟统一金融制裁名单。用于筛查欧盟侧的被列名主体，覆盖美国名单之外的欧盟自主措施。",
    en: "The EU's consolidated financial sanctions list — EU designations that do not appear on US lists.",
    usedIn: ["search_lists", "name_match"]
  },
  "un-consolidated": {
    zh: "联合国安理会统一名单。安理会决议指定的主体，是各国名单的共同上游。",
    en: "The UN Security Council consolidated list — the common upstream of most national lists.",
    usedIn: ["search_lists"]
  },
  "uk-sanctions": {
    zh: "英国制裁名单。2026 年 1 月起是英国唯一的现行指定来源，此前的 OFSI 名单已转为存档。",
    en: "The UK's sanctions list; since January 2026 the sole current UK designation source.",
    usedIn: ["search_lists"]
  },
  "tw-shtc": {
    zh: "台湾战略性高科技货品的实体名单，由经济部国际贸易署发布，11,664 条。用于筛查台湾侧的管制对象。",
    en: "Taiwan's strategic high-tech commodities entity list, published by the trade administration.",
    usedIn: ["search_lists", "name_match"]
  },
  "jp-meti-eul": {
    zh: "日本经产省最终用户清单。列出被认定存在大规模杀伤性武器扩散顾虑的境外主体。",
    en: "Japan's METI End User List — foreign entities of proliferation concern.",
    usedIn: ["search_lists", "name_match"]
  },
  "us-uflpa": {
    zh: "美国《维吾尔强迫劳动预防法》实体清单。命中意味着货物进入美国时被推定为强迫劳动产品，与出口管制并列但机制不同。",
    en: "The UFLPA entity list. A hit means goods are presumed to be forced-labour products on entry into the US — a separate mechanism from export control.",
    usedIn: ["search_lists", "name_match"]
  },
  "us-dod-1260h": {
    zh: "美国国防部依 1260H 条款认定的中国军工企业清单。本身不直接禁止交易，但触发投资限制并作为最终用户风险的强指标。",
    en: "The DoD's Section 1260H list of Chinese military companies. Not itself a trade prohibition, but an investment restriction and a strong end-user risk signal.",
    usedIn: ["search_lists", "name_match"]
  },
  "china-control-entities": {
    zh: "中国出口管制管控名单与关注名单公告。既用于筛查，也是「监管变化简报」的公告来源之一，并作为中英文名互查的桥梁。",
    en: "PRC control-list and watch-list notices. Used for screening, as a source for the regulatory briefing, and as the bridge between Chinese and English names.",
    usedIn: ["search_lists", "name_match", "briefing", "name_bridge"]
  },
  "china-unreliable-entity": {
    zh: "中国不可靠实体清单。对被列名外国主体施加贸易与投资限制，由不可靠实体清单工作机制发布。",
    en: "The PRC Unreliable Entity List — trade and investment restrictions on designated foreign entities.",
    usedIn: ["search_lists", "name_match", "briefing", "name_bridge"]
  },
  "china-countermeasures": {
    zh: "中国反制与制裁决定。目前仅登记，未接入任何分析步骤——反制措施的形式差异大，尚无稳定的结构化来源。",
    en: "PRC countermeasure and sanctions decisions. Registered only; no analysis step reads it yet, because these measures take too many shapes to normalise reliably.",
    usedIn: []
  },
  "sam-exclusions": {
    zh: "美国联邦采购除名名录。与出口管制无关，用于判断主体是否被排除在联邦采购之外；目前未接入分析步骤。",
    en: "US federal procurement exclusions. Not an export-control list; registered for procurement screening and not read by any analysis step.",
    usedIn: []
  },

  // ---- Item, classification and licensing
  "bis-ear": {
    zh: "EAR 总则条文。作为引用底本，供 Agent 在需要时检索原文；分类判断本身依赖下面几个具体部分。",
    en: "The EAR's general provisions, ingested so the text can be cited; the classification steps rely on the specific parts below.",
    usedIn: []
  },
  "bis-ear-732": {
    zh: "EAR Part 732「使用 EAR 的步骤」。这是产品线和贸易线全部步骤序列的来源——本系统的审查顺序不是自创的，就是照它排的。",
    en: "EAR Part 732, Steps for Using the EAR. The published procedure the product and trade lanes take their step sequence from.",
    usedIn: ["methodology:ear732"]
  },
  "bis-ear-734": {
    zh: "EAR Part 734，管辖范围、de minimis 与外国直接产品规则。「是否受 EAR 管辖」一步引用的就是它的条文编号；已接入的原文供引用与直查，该步骤本身不读取本地快照。",
    en: "EAR Part 734 — scope, de minimis and the Foreign Direct Product rules. The jurisdiction step cites it by provision; the ingested text is here to be quoted and searched, not read by that step.",
    usedIn: []
  },
  "bis-ear-740": {
    zh: "EAR Part 740 许可例外。「许可例外」一步引用其条文编号；已接入的原文供人工查阅，该步骤不读取本地快照。",
    en: "EAR Part 740 — licence exceptions. The licence-exception step cites it by provision; the ingested text is for reading, not read by that step.",
    usedIn: []
  },
  "bis-ear-744": {
    zh: "EAR Part 744 与实体清单（Supplement No. 4）。十项一般禁令中与最终用户、最终用途相关部分的条文来源；「十项一般禁令」一步引用其编号，未直接读取本地快照。",
    en: "EAR Part 744 and the Entity List supplement — the end-user and end-use prohibitions. The prohibitions step cites it by provision rather than reading the snapshot.",
    usedIn: []
  },
  "bis-ccl": {
    zh: "商业管制清单（EAR Part 774）。ECCN 的权威定义所在；查「4A090.a 是什么」直接读它。",
    en: "The Commerce Control List (EAR Part 774) — where an ECCN is actually defined. A code lookup reads it directly.",
    usedIn: ["classify", "lookup:meaning_of_code"]
  },
  "bis-country-chart": {
    zh: "商业国别矩阵（EAR Part 738），已解析出 203 行国别与管制理由。「目的地与管制理由」一步引用其编号；矩阵本身可在数据源直查中按国别查阅，该步骤尚未自动读取。",
    en: "The Commerce Country Chart (EAR Part 738), parsed to 203 country rows. The destination step cites it by provision; the chart is searchable directly but that step does not yet read it automatically.",
    usedIn: []
  },
  "nvidia-export": {
    zh: "NVIDIA 公布的出口分类表，1,352 个料号。按 part number 查 ECCN、HTS 与 TPP；厂商对自家产品的声明，不是分类决定。",
    en: "NVIDIA's published classification table, 1,352 parts — ECCN, HTS and TPP by part number. The manufacturer's statement about its own product, not a classification decision.",
    usedIn: ["identify_item", "lookup:classification_of_part"]
  },
  "amd-export": {
    zh: "AMD 产品主表，8,554 个料号，含 ECCN、HTS、CCATS 编号与是否满足 3A090.a.1，并带分类数据截止日期。",
    en: "AMD's product master, 8,554 parts — ECCN, HTS, CCATS number and whether it meets 3A090.a.1, with the date the classification data was current.",
    usedIn: ["identify_item", "lookup:classification_of_part"]
  },
  "china-control-list": {
    zh: "中国两用物项出口管制清单，189 个管制编码。编码结构与 ECCN 同构（行业、物项类型、管制理由），是中国侧归类的依据。",
    en: "The PRC dual-use control list, 189 codes structured like an ECCN — industry, item type, reason for control.",
    usedIn: ["lookup:meaning_of_code"]
  },
  "china-export-licence-goods": {
    zh: "出口许可证管理货物目录，1,159 个海关商品编号。目前仅供数据源直查，未接入分析步骤——它按 HS 编码组织，而分析路径按 ECCN 走。",
    en: "The PRC export-licence goods catalogue, 1,159 customs codes. Searchable directly but not read by any step: it is organised by HS code and the path runs on ECCNs.",
    usedIn: []
  },
  "china-dual-use": {
    zh: "商务部两用物项管制公告。既是中国侧管制制度的条文依据，也是「监管变化简报」的主要公告来源。",
    en: "MOFCOM's dual-use control notices — both the PRC regime's own provisions and the main source for the regulatory briefing.",
    usedIn: ["methodology:prcDualUse", "briefing"]
  },
  "china-licence-catalogue": {
    zh: "中国进出口许可证管理目录。判断某类两用物项出口是否需要许可证时的目录依据，并纳入简报的公告范围。",
    en: "The PRC import/export licence administration catalogue, and part of the briefing's notice range.",
    usedIn: ["briefing"]
  },
  "jp-export-control": {
    zh: "日本輸出貿易管理令与货物等省令的管制别表。目前仅供直查，未接入分析步骤——本系统的物项线按美中两侧编码运行。",
    en: "Japan's export control order and its item tables. Searchable directly; no step reads it, because the item lane runs on US and PRC codes.",
    usedIn: []
  },

  // ---- Third-party diligence
  "doj-eccp": {
    zh: "DOJ 企业合规程序评价指引。第三方尽调整条线五个步骤的程序依据——它提供的是方法而不是数据。",
    en: "DOJ's Evaluation of Corporate Compliance Programs. The published basis for all five third-party diligence steps: it supplies the method, not data.",
    usedIn: ["methodology:eccp"]
  },
  "gleif-lei": {
    zh: "全球法人识别编码库。所有权穿透一步自动检索它，取直接母公司与最终母公司；GLEIF 的母公司指会计合并母公司，不含持股比例。",
    en: "The global LEI register. The ownership step queries it for direct and ultimate parent — GLEIF's parent is the accounting consolidating parent and carries no percentages.",
    usedIn: ["ownership"]
  },
  "sec-edgar": {
    zh: "美国证券交易委员会公开披露库。上市公司的股权与关联方披露来源；目前仅登记，尚未接入所有权步骤。",
    en: "SEC public filings — ownership and related-party disclosure for listed issuers. Registered; not yet read by the ownership step.",
    usedIn: []
  },
  "companies-house": {
    zh: "英国公司注册处，含 25% 以上实益所有人（PSC）登记。需要 API key，未配置时不参与分析。",
    en: "UK Companies House, including its register of persons with significant control. Needs an API key; inert without one.",
    usedIn: []
  },
  "china-company-registry": {
    zh: "国家企业信用信息公示系统。中国工商登记的权威来源，但有验证码，只能人工查询——本系统不绕过验证码。",
    en: "China's national enterprise credit information system: the authoritative PRC registry, CAPTCHA-gated and therefore manual only. This system does not bypass CAPTCHAs.",
    usedIn: []
  },
  "credit-china": {
    zh: "信用中国。行政处罚与失信信息，同样有验证码，保留为人工核查入口。",
    en: "Credit China — administrative penalties and discredited-entity records. CAPTCHA-gated, kept as a manual cross-check.",
    usedIn: []
  },
  "china-enforcement": {
    zh: "中国执行信息公开网。被执行人与失信被执行人信息，验证码限制，人工查询入口。",
    en: "China's enforcement disclosure site — judgment debtors and defaulters. CAPTCHA-gated, manual only.",
    usedIn: []
  }
};

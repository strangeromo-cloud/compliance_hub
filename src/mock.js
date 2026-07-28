import { classifyQuestionIntent, isChinaDualUseQuestion } from "./question-intent.js";

const zh = {
  trade: {
    summary: "检测到受限交易方或所有权筛查问题，需要确认具体法律实体与交易内容。",
    findings: [
      { title: "交易方筛查", detail: "品牌名不足以完成筛查；必须确认具体 legal entity、注册地址及其交易角色。", evidenceSourceIds: ["trade-csl", "bis-entity-list"] },
      { title: "限制范围", detail: "Entity List 风险通常与受 EAR 管辖的商品、软件或技术有关，不能仅凭“服务”二字判断允许或禁止。", evidenceSourceIds: ["bis-end-user"] }
    ],
    missingInfo: ["具体签约实体和地址", "提供的商品、软件、技术或服务内容", "最终用户和最终用途"],
    recommendedActions: ["完成 exact entity screening", "确认交易标的是否受 EAR 管辖", "交由 Trade Compliance/Legal 复核"]
  },
  product: {
    summary: "检测到产品出口管制问题；产品、路线、最终用户和最终用途必须共同分析。",
    findings: [
      { title: "产品分类", detail: "H100 属于先进计算出口管制重点产品，但产品名称本身不能替代准确型号和 ECCN。", evidenceSourceIds: ["bis-classify", "nvidia-10k"] },
      { title: "运输路线", detail: "加拿大属于中转地时，不会取代墨西哥作为最终目的地；还需确认最终安装地和是否再次转运。", evidenceSourceIds: ["bis-end-user"] }
    ],
    missingInfo: ["准确 part number / 系统形态", "ultimate consignee 与 ultimate parent", "最终安装地点与 end use"],
    recommendedActions: ["取得厂商分类信息", "核对最终用户与母公司所在地", "在发货前完成许可证判断"]
  },
  tpdd: {
    summary: "检测到第三方尽调问题；当前信息可识别风险指标，但不足以认定对方是空壳公司。",
    findings: [
      { title: "商业合理性", detail: "高额成功费、第三方收款或模糊服务范围需要补充商业理由与定价依据。", evidenceSourceIds: ["doj-eccp"] },
      { title: "所有权与经营实质", detail: "应核实 UBO、办公和员工信息、过往项目及银行账户所有权。", evidenceSourceIds: ["oecd-third-party"] }
    ],
    missingInfo: ["注册文件和 UBO declaration", "服务 deliverables 与佣金基准", "合同主体与收款主体关系"],
    recommendedActions: ["启动增强尽调", "取得银行账户证明和业务推荐信", "在补件完成前暂停 onboarding"]
  }
};

const en = {
  trade: {
    summary: "A restricted-party or ownership-screening issue was detected. Confirm the exact legal entity and transaction scope.",
    findings: [
      { title: "Party screening", detail: "A brand name is insufficient. Confirm the legal entity, registered address, and role in the transaction.", evidenceSourceIds: ["trade-csl", "bis-entity-list"] },
      { title: "Scope of restrictions", detail: "Entity List risk generally concerns items subject to the EAR. A service label alone does not establish that the activity is permitted or prohibited.", evidenceSourceIds: ["bis-end-user"] }
    ],
    missingInfo: ["Contracting entity and address", "Goods, software, technology, or service scope", "End user and end use"],
    recommendedActions: ["Complete exact-entity screening", "Determine EAR jurisdiction", "Escalate to Trade Compliance/Legal"]
  },
  product: {
    summary: "A product export-control issue was detected. Product, route, end user, and end use must be assessed together.",
    findings: [
      { title: "Product classification", detail: "H100 is a focus of advanced-computing controls, but the product name does not replace the exact part number and ECCN.", evidenceSourceIds: ["bis-classify", "nvidia-10k"] },
      { title: "Shipping route", detail: "A transit through Canada does not replace Mexico as the ultimate destination. Confirm the installation location and any onward transfer.", evidenceSourceIds: ["bis-end-user"] }
    ],
    missingInfo: ["Exact part number / system form", "Ultimate consignee and parent", "Installation location and end use"],
    recommendedActions: ["Obtain manufacturer classification", "Screen end user and parent location", "Complete license analysis before shipment"]
  },
  tpdd: {
    summary: "Third-party due-diligence indicators were detected. They do not by themselves establish that the party is a shell company.",
    findings: [
      { title: "Business rationale", detail: "A high success fee, third-party payment, or vague scope requires a documented rationale and pricing benchmark.", evidenceSourceIds: ["doj-eccp"] },
      { title: "Ownership and substance", detail: "Verify UBO, office and employee evidence, references, and bank-account ownership.", evidenceSourceIds: ["oecd-third-party"] }
    ],
    missingInfo: ["Incorporation documents and UBO declaration", "Deliverables and fee benchmark", "Relationship between contracting and payment entities"],
    recommendedActions: ["Perform enhanced due diligence", "Obtain bank proof and references", "Pause onboarding pending evidence"]
  }
};

function contextualFinding(agent, locale, question = "") {
  const q = question.toLowerCase();
  const isEn = locale === "en";
  const finding = (titleZh, detailZh, titleEn, detailEn, evidenceSourceIds) => ({
    title: isEn ? titleEn : titleZh,
    detail: isEn ? detailEn : detailZh,
    evidenceSourceIds
  });

  if (agent === "trade") {
    if (/false positive|误报|名称近似|similar/.test(q)) return finding("名单误报消解", "名称近似只能产生 potential match；应比较国家、地址、注册号、别名和其他身份字段后记录 disposition。", "Potential-match resolution", "Name similarity creates only a potential match. Compare country, address, registration number, aliases, and other identifiers before documenting the disposition.", ["trade-csl"]);
    if (/55%|30%|25%|ownership|所有权|持股/.test(q)) return finding("合计所有权", "应核查多名受限股东的直接和间接持股是否需要合计计算，并取得完整股权链，不能只筛查客户名称。", "Aggregated ownership", "Assess whether direct and indirect interests of multiple blocked owners must be aggregated and obtain the full ownership chain; screening the customer name alone is insufficient.", ["ofac-50-rule"]);
    if (/被拒|rejected|货代|freight.forwarder|第三方付款|third.party payment/.test(q)) return finding("规避组合风险", "拒单后更换收货方、引入货代和无关付款方是需要整体升级审查的交易模式，而不是一张全新的低风险订单。", "Circumvention pattern", "Rerouting a rejected order through a forwarder and unrelated payer is a combined escalation pattern, not a new low-risk order.", ["bis-end-user", "trade-csl"]);
    if (/最终用户|ultimate user|ultimate end user|中国客户|customer in china/.test(q)) return finding("最终用户与表面买方不一致", "表面买方和最终用户不一致会改变受限方、最终用途及许可分析，需要取得完整流转链和最终用户声明。", "Buyer and ultimate user differ", "A mismatch between buyer and ultimate user changes party, end-use, and licensing analysis. Obtain the complete distribution chain and end-user statement.", ["bis-end-user"]);
  }

  if (agent === "product") {
    if (/h100/.test(q) && /\b(app|tpp|eccn)\b|算力值|分类值/.test(q)) return finding(
      "H100 官方分类数值",
      "严格来说，NVIDIA 公开分类表没有给 H100 单颗 GPU 一个通用 APP 值，而是按具体形态公布 TPP per GPU：H100 PCIe 为 12,224，H100 NVL 为 14,144，HGX H100 SXM5 为 15,840；这些记录的 ECCN 均为 4A090.a。APP 是 Category 4 计算机/系统层面的申报指标，需要具体整机配置才能计算。",
      "Official H100 classification values",
      "Strictly speaking, NVIDIA does not publish one universal APP value for an H100 GPU. Its public table reports TPP per GPU by form factor: 12,224 for H100 PCIe, 14,144 for H100 NVL, and 15,840 for HGX H100 SXM5; the listed ECCN is 4A090.a. APP is a Category 4 computer/system-level application metric and requires the exact system configuration.",
      ["nvidia-export", "bis-classify"]
    );
    if (/vpn|encryption|加密/.test(q)) return finding("加密产品分类", "应基于准确硬件型号、固件、加密功能、厂商 ECCN/CCATS 信息及最终用户类型评估 ENC 等路径，不能仅凭“网络设备”判断。", "Encryption classification", "Assess the exact hardware, firmware, cryptographic functions, manufacturer ECCN/CCATS information, and end-user type before considering ENC or other paths.", ["bis-classify"]);
    if (/镓|gallium|中国两用|prc dual.use/.test(q)) return finding("中国两用物项范围", "需要把材料纯度、形态、技术参数与中国现行两用物项清单和许可规则对应，并核查最终用户与最终用途。", "PRC dual-use scope", "Map purity, form, and technical parameters to current PRC dual-use lists and licensing rules, then verify the end user and end use.", ["china-dual-use-list-faq", "china-dual-use-license-guide"]);
    if (/h100/.test(q)) return finding("先进计算产品", "H100 商品名不足以完成判断；需要准确 part number、系统形态、厂商分类、最终收货方、母公司、安装地和最终用途。", "Advanced-computing item", "The H100 product name is insufficient. Confirm part number, system form, manufacturer classification, ultimate consignee, parent, installation site, and end use.", ["bis-classify", "nvidia-export", "nvidia-10k"]);
    if (/bom|部件|component/.test(q)) return finding("BOM 级分类", "整机判断需要追溯受控美国原产和中国两用部件、软件与技术，不能只依据整机商品描述。", "BOM-level classification", "The finished-item analysis must trace controlled US-origin and PRC dual-use components, software, and technology instead of relying only on the product description.", ["bis-classify", "china-dual-use-list-faq"]);
  }

  if (agent === "tpdd") {
    if (/共享办公|shared.office|无员工|no public employee|拒绝.*ubo|refuses.*ubo/.test(q)) return finding("经营实质红旗", "共享地址、缺少人员信息和拒绝披露 UBO 是增强尽调触发因素，但不足以单独认定对方为空壳公司。", "Business-substance indicators", "A shared address, limited employee evidence, and refusal to disclose UBO trigger enhanced diligence but do not alone prove that the party is a shell company.", ["doj-eccp", "oecd-third-party"]);
    if (/政府招标|government tender|个人账户|individual account/.test(q)) return finding("政府交易与个人收款", "承诺影响政府采购、成功费和个人账户收款需要核查 PEP/政府关系、服务范围、费用基准及可验证履约。", "Government tender and personal payment", "Claims of influence over procurement, success fees, and payment to an individual require PEP/official-link checks, scope, fee benchmarking, and verifiable performance.", ["doj-eccp"]);
    if (/bvi|成功费|success fee/.test(q)) return finding("费用与离岸付款", "高额成功费和 BVI 账户需要形成商业理由、费用基准、账户所有权及合同主体与收款主体关系的证据链。", "Fee and offshore payment", "A high success fee and BVI account require evidence of business rationale, fee benchmark, account ownership, and the relationship between contracting and payment entities.", ["doj-eccp", "oecd-third-party"]);
    if (/货代|freight.forwarder|第三方付款|third.party payment|unrelated third party/.test(q)) return finding("交易路径异常", "货代与无关第三方付款削弱交易透明度，需要核实实际买方、最终受益方、付款理由和账户所有权。", "Opaque transaction path", "A forwarder and unrelated payer reduce transaction transparency. Verify the real buyer, ultimate beneficiary, payment rationale, and account ownership.", ["doj-eccp"]);
    if (/关联公司|affiliate account|affiliate/.test(q)) return finding("合同方与收款方不一致", "向关联公司账户预付款需要证明关联关系、商业理由、发票与银行账户所有权，并确认不存在资金转移安排。", "Contracting and payment entities differ", "Prepayment to an affiliate requires proof of relationship, business rationale, invoice and bank ownership, and confirmation that the arrangement is not a funds-diversion mechanism.", ["doj-eccp"]);
  }
  return null;
}

function h100MetricResult(locale, question) {
  const isEn = locale === "en";
  const asksEccn = /\beccn\b/i.test(question);
  const asksTpp = /\btpp\b/i.test(question);
  const finding = contextualFinding("product", locale, question);
  if (asksEccn) return {
    agent: "product",
    riskLevel: "unknown",
    summary: isEn ? "NVIDIA's published H100 records list ECCN 4A090.a." : "NVIDIA 公开的 H100 分类记录所列 ECCN 为 4A090.a。",
    findings: finding ? [finding] : [],
    missingInfo: isEn ? ["Exact H100 form factor or NVIDIA part number if record-level confirmation is needed"] : ["如需逐条确认记录，请提供准确的 H100 形态或 NVIDIA part number"],
    recommendedActions: isEn ? ["Match the exact item to NVIDIA's export-classification record"] : ["用准确产品形态对照 NVIDIA 出口分类记录"]
  };
  if (asksTpp) return {
    agent: "product",
    riskLevel: "unknown",
    summary: isEn ? "H100 TPP depends on form factor: 12,224 for PCIe, 14,144 for NVL, and 15,840 for HGX H100 SXM5." : "H100 的 TPP 因形态而异：PCIe 为 12,224，NVL 为 14,144，HGX H100 SXM5 为 15,840。",
    findings: finding ? [finding] : [],
    missingInfo: isEn ? ["Exact H100 form factor or NVIDIA part number"] : ["准确的 H100 形态或 NVIDIA part number"],
    recommendedActions: isEn ? ["Use the TPP value for the matching form factor"] : ["使用与准确形态匹配的 TPP 数值"]
  };
  return {
    agent: "product",
    riskLevel: "unknown",
    summary: isEn ? "There is no single H100 APP value; NVIDIA publishes TPP per GPU by form factor." : "H100 没有一个通用 APP 值；NVIDIA 按具体形态公布 TPP per GPU。",
    findings: finding ? [finding] : [],
    missingInfo: isEn ? ["Exact H100 form factor or NVIDIA part number", "System configuration if APP is required"] : ["准确的 H100 形态或 NVIDIA part number", "如需 APP，则需提供整机配置"],
    recommendedActions: isEn ? ["Use the matching manufacturer record", "Calculate APP only for the identified Category 4 system"] : ["使用与准确型号匹配的厂商分类记录", "仅针对已确定的 Category 4 整机计算 APP"]
  };
}

function chinaDualUsePolicyResult(locale, context) {
  const isEn = locale === "en";
  return {
    agent: "product",
    riskLevel: "unknown",
    summary: isEn
      ? "China applies a list-based dual-use export-control regime supplemented by temporary controls, destination/entity measures, and risk-based catch-all controls."
      : "中国对两用物项实行以统一清单为核心，并辅以临时管制、特定目的地/主体措施和风险兜底要求的出口管制制度。",
    findings: isEn ? [
      { title: "Legal framework", detail: "The Export Control Law took effect on 1 December 2020. State Council Order No. 792, the Regulations on Export Control of Dual-Use Items, took effect on 1 December 2024.", evidenceSourceIds: ["china-dual-use-regulation"] },
      { title: "What is controlled", detail: "The unified list can cover goods, software, technology, services and related technical data. Technology can include technical materials and technical support.", evidenceSourceIds: ["china-dual-use-list-faq"] },
      { title: "How a case is decided", detail: "Check the exact item and technical parameters against the list and current notices, then assess temporary controls, destination/entity measures, end user, end use and any catch-all risk before deciding whether a license is required.", evidenceSourceIds: ["china-dual-use-regulation", "china-dual-use-license-guide"] }
    ] : [
      { title: "法律框架", detail: "《中华人民共和国出口管制法》自2020年12月1日起施行；国务院令第792号《中华人民共和国两用物项出口管制条例》自2024年12月1日起施行。", evidenceSourceIds: ["china-dual-use-regulation"] },
      { title: "管制对象", detail: "统一清单可覆盖货物、软件、技术、服务及相关技术资料等数据；技术还可能包括技术资料和技术支持。", evidenceSourceIds: ["china-dual-use-list-faq"] },
      { title: "判断机制", detail: "应先用准确型号和技术指标对照统一清单及现行公告，再检查临时管制、特定目的地或主体措施、最终用户、最终用途及法定风险兜底要求，最后判断是否需要许可证。", evidenceSourceIds: ["china-dual-use-regulation", "china-dual-use-license-guide"] },
      { title: "许可与申报", detail: "许可材料需要准确说明商品技术指标、出口商、进口商、最终用户、最终用途、最终目的地及合同等信息；海关申报还需核对当年度许可证管理目录。", evidenceSourceIds: ["china-dual-use-license-guide", "china-dual-use-license-directory"] }
    ],
    missingInfo: [],
    recommendedActions: isEn
      ? ["For an item-specific result, provide the product name, model, composition and technical specifications", "Confirm destination, importer, ultimate end user and end use", "Check the current unified list and later MOFCOM notices as of the intended export date"]
      : ["如需判断具体产品，请提供品名、型号、成分和关键技术指标", "补充目的国、进口商、最终用户和最终用途", "按拟出口日期核对统一清单及此后商务部公告"]
  };
}

function listMatchResult(locale, context) {
  const matches = context.listMatches || [];
  if (!matches.length) return null;
  const isEn = locale === "en";
  const examples = matches.slice(0, 5).map((match) => `${match.entityName} — ${match.sourceList}${match.licenseReviewPolicy ? `; ${match.licenseReviewPolicy}` : ""}`).join("；");
  return {
    agent: "trade",
    riskLevel: "high",
    summary: isEn ? `${matches.length} potential CSL name matches were found in the local official snapshot; identity resolution is required.` : `在本地官方 CSL 快照中找到 ${matches.length} 条潜在名称命中，必须进一步完成法律实体识别。`,
    findings: [{
      title: isEn ? "Structured list results" : "结构化名单结果",
      detail: `${examples}${isEn ? ". These are potential matches, not confirmed matches." : "。这些只是 potential match，不是 confirmed match。"}`,
      evidenceSourceIds: ["trade-csl"]
    }],
    missingInfo: isEn ? ["Exact legal name", "Registered address and registration number", "Transaction role and ownership chain"] : ["准确法律实体名称", "注册地址和注册号", "交易角色及完整所有权链"],
    recommendedActions: isEn ? ["Resolve each potential match using identifiers", "Open the underlying list record and restriction terms", "Assess ownership and the actual transaction scope"] : ["使用地址、注册号等身份字段逐条消除潜在命中", "查看底层名单条目及具体限制条件", "继续核查所有权和实际交易范围"]
  };
}

function productRestrictionResult(locale, question) {
  const isEn = locale === "en";
  const h100 = /h100/i.test(question);
  return {
    agent: "product",
    riskLevel: h100 ? "high" : "unknown",
    summary: h100
      ? (isEn ? "H100 is classified under ECCN 4A090.a in NVIDIA's published records, but the license outcome still depends on the exact form, destination, parties and end use." : "NVIDIA公开记录将H100相关形态列为ECCN 4A090.a，但许可证结论仍取决于准确形态、目的地、交易方和最终用途。")
      : (isEn ? "A product name alone is insufficient to determine whether the item is controlled or whether a license is required." : "仅凭产品名称不能判断是否属于管制物项或是否需要许可证。"),
    findings: [{
      title: isEn ? "Required decision chain" : "产品受限判断链",
      detail: isEn ? "Identify the exact part and technical parameters, determine jurisdiction and classification, check destination controls, screen all parties, review end user/end use, and only then decide license, exception or prohibition status." : "应依次确认准确型号和技术指标、管辖与分类、目的地管制、全部交易方、最终用户和最终用途，之后才能判断许可证、许可例外或禁止状态。",
      evidenceSourceIds: h100 ? ["nvidia-export", "bis-classify"] : ["bis-classify", "china-dual-use-list-faq"]
    }],
    missingInfo: isEn ? ["Exact model or part number", "Technical specifications and origin", "Destination, consignee, ultimate end user and end use"] : ["准确型号或part number", "技术规格及原产地", "目的地、收货方、最终用户和最终用途"],
    recommendedActions: isEn ? ["Obtain the manufacturer classification", "Match the item to the applicable official control list", "Complete party and end-use screening before shipment"] : ["取得厂商分类资料", "与适用的官方管制清单逐项比对", "发货前完成交易方和最终用途筛查"]
  };
}

export function createMockAgentResult(agent, locale, question = "", context = {}) {
  const intent = context.intent || classifyQuestionIntent(question);
  if (agent === "product" && intent === "product_metric" && /h100/i.test(question)) return h100MetricResult(locale, question);
  if (agent === "product" && isChinaDualUseQuestion(question) && intent === "policy_lookup") return chinaDualUsePolicyResult(locale, context);
  if (agent === "trade") {
    const match = listMatchResult(locale, context);
    if (match) return match;
  }
  if (agent === "product" && intent === "product_restriction") return productRestrictionResult(locale, question);
  const content = (locale === "en" ? en : zh)[agent];
  const contextual = contextualFinding(agent, locale, question);
  return {
    agent,
    riskLevel: agent === "product" ? "medium" : "high",
    ...content,
    findings: contextual ? [contextual, ...content.findings] : content.findings
  };
}

export function createMockSynthesis(results, locale, question = "", context = {}) {
  if (/h100/i.test(question) && /\beccn\b/i.test(question)) {
    return {
      overallRisk: "unknown",
      headline: locale === "en" ? "H100 is listed under ECCN 4A090.a" : "H100 的 ECCN 为 4A090.a",
      executiveSummary: results[0].summary,
      nextStep: results[0].recommendedActions[0]
    };
  }
  if (/h100/i.test(question) && /\btpp\b/i.test(question)) {
    return {
      overallRisk: "unknown",
      headline: locale === "en" ? "H100 TPP varies by form factor" : "H100 的 TPP 因产品形态而异",
      executiveSummary: results[0].summary,
      nextStep: results[0].recommendedActions[0]
    };
  }
  if (/h100/i.test(question) && /\bapp\b|算力值/i.test(question)) {
    return {
      overallRisk: "unknown",
      headline: locale === "en" ? "H100 has no single universal APP value" : "H100 没有一个通用的 APP 值",
      executiveSummary: locale === "en"
        ? "NVIDIA's public classification table reports TPP per GPU: H100 PCIe 12,224; H100 NVL 14,144; HGX H100 SXM5 15,840. The listed ECCN is 4A090.a. APP applies to a Category 4 computer/system and depends on its configuration."
        : "NVIDIA 公开分类表按形态给出 TPP per GPU：H100 PCIe 12,224；H100 NVL 14,144；HGX H100 SXM5 15,840；对应记录的 ECCN 为 4A090.a。APP 属于 Category 4 计算机/系统层面的指标，取决于整机配置。",
      nextStep: locale === "en" ? "Provide the exact part number or server configuration if you need a classification or APP calculation for a specific item." : "如需判断某一具体产品，请补充 part number；如确实需要 APP，请提供服务器/整机配置。"
    };
  }
  const intent = context.intent || classifyQuestionIntent(question);
  const first = results[0];
  if (isChinaDualUseQuestion(question) && intent === "policy_lookup") {
    return {
      overallRisk: "unknown",
      headline: locale === "en" ? "China uses a unified-list plus risk-based dual-use control regime" : "中国两用物项实行“统一清单 + 风险兜底”的出口管制制度",
      executiveSummary: [first.summary, ...first.findings.slice(0, 3).map((finding) => finding.detail)].join(locale === "en" ? " " : " "),
      nextStep: locale === "en" ? "Provide the exact product and transaction facts if you want an item-specific controlled-status or licensing assessment." : "如果要继续判断某个产品是否受限，请补充准确型号、技术指标、目的地、最终用户和最终用途。"
    };
  }
  if (intent === "party_screening" && context.listMatches?.length) {
    return { overallRisk: "high", headline: locale === "en" ? "Official-list potential matches require identity resolution" : "官方名单存在潜在命中，需要完成实体消歧", executiveSummary: `${first.summary} ${first.findings[0]?.detail || ""}`.trim(), nextStep: first.recommendedActions[0] };
  }
  if (intent === "product_restriction") {
    return { overallRisk: first.riskLevel, headline: locale === "en" ? "Controlled status requires classification plus transaction facts" : "产品是否受限必须结合分类与交易事实判断", executiveSummary: `${first.summary} ${first.findings[0]?.detail || ""}`.trim(), nextStep: first.recommendedActions.join(locale === "en" ? "; " : "；") };
  }
  if (intent === "third_party_diligence") {
    return { overallRisk: results.some((result) => result.riskLevel === "high") ? "high" : "unknown", headline: locale === "en" ? "Third-party diligence scope identified from the stated red flags" : "已根据问题中的风险指标确定第三方尽调范围", executiveSummary: `${first.summary} ${first.findings[0]?.detail || ""}`.trim(), nextStep: first.recommendedActions.join(locale === "en" ? "; " : "；") };
  }
  const highCount = results.filter((result) => result.riskLevel === "high").length;
  return {
    overallRisk: highCount ? "high" : "medium",
    headline: first?.findings?.[0]?.title || (locale === "en" ? "Question-specific compliance review" : "针对当前问题的合规分析"),
    executiveSummary: results.map((result) => result.summary).join(locale === "en" ? " " : "；"),
    nextStep: first?.recommendedActions?.[0] || (locale === "en" ? "Collect the missing facts and route the case to the appropriate reviewer." : "补齐缺失信息并交由相应审核人员复核。")
  };
}

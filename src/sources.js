export const SOURCES = [
  {
    id: "trade-csl",
    agents: ["trade"],
    authority: "U.S. International Trade Administration",
    title: "Consolidated Screening List",
    titleZh: "美国综合筛查清单（CSL）",
    url: "https://www.trade.gov/consolidated-screening-list",
    summary: "Official consolidated screening-list guidance and tools. A potential match requires follow-up against the underlying official list and restriction terms."
  },
  {
    id: "bis-end-user",
    agents: ["trade", "product"],
    authority: "U.S. Bureau of Industry and Security",
    title: "End-user and end-use controls",
    titleZh: "BIS 最终用户与最终用途管制",
    url: "https://www.bis.gov/licensing/guidance-on-end-user-and-end-use-controls-and-us-person-controls",
    summary: "BIS guidance on Entity List, restricted-party, end-user and end-use controls under the EAR."
  },
  {
    id: "bis-entity-list",
    agents: ["trade"],
    authority: "U.S. Bureau of Industry and Security",
    title: "EAR Part 744 and Entity List",
    titleZh: "EAR 第 744 部分与实体清单",
    url: "https://www.bis.gov/entity-list",
    summary: "Current EAR Part 744 entries and licensing policies, including Entity List restrictions."
  },
  {
    id: "ofac-50-rule",
    agents: ["trade", "tpdd"],
    authority: "U.S. Office of Foreign Assets Control",
    title: "OFAC 50 Percent Rule FAQ",
    titleZh: "OFAC 50% 所有权规则",
    url: "https://ofac.treasury.gov/faqs/401",
    summary: "Official explanation of indirect ownership under OFAC's 50 Percent Rule."
  },
  {
    id: "bis-classify",
    agents: ["product"],
    authority: "U.S. Bureau of Industry and Security",
    title: "Classify your item",
    titleZh: "BIS 产品分类指南",
    url: "https://www.bis.gov/licensing/classify-your-item",
    summary: "Official guidance explaining ECCNs and how product classification supports license analysis."
  },
  {
    id: "nvidia-export",
    agents: ["product"],
    authority: "NVIDIA",
    title: "NVIDIA export classification",
    titleZh: "NVIDIA 出口分类信息",
    url: "https://www.nvidia.com/en-us/about-nvidia/company-policies/export-regulations/",
    summary: "Manufacturer-provided ECCN, TPP and product export-classification information where available."
  },
  {
    id: "nvidia-10k",
    agents: ["product", "trade"],
    authority: "U.S. SEC / NVIDIA filing",
    title: "NVIDIA FY2026 Form 10-K",
    titleZh: "NVIDIA 2026 财年 Form 10-K",
    url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm",
    summary: "NVIDIA's public filing describing current export-control impacts on H100 and other advanced-computing products."
  },
  {
    id: "china-dual-use-regulation",
    agents: ["product", "trade"],
    authority: "State Council / MOFCOM",
    title: "PRC Regulations on Export Control of Dual-Use Items (State Council Order No. 792)",
    titleZh: "中华人民共和国两用物项出口管制条例（国务院令第792号）",
    // The National Laws database renders client-side and yields no text to a
    // fetch; MOFCOM publishes the same regulation as server-rendered HTML.
    url: "https://exportcontrol.mofcom.gov.cn/article/zcfg/gnzcfg/gzjgfxwj/202410/1057.html",
    canonicalUrl: "https://flk.npc.gov.cn/detail?fileId=&id=ff808181927f0e7b019294a6bf08358f&type=",
    summary: "The governing PRC administrative regulation for dual-use exports, effective 1 December 2024.",
    keywords: ["中国", "PRC", "dual-use", "两用物项", "policy", "政策", "法规", "license", "许可"]
  },
  {
    id: "china-dual-use-list-faq",
    agents: ["product", "trade"],
    authority: "China Export Control Information / MOFCOM",
    title: "Official FAQ on the PRC Dual-Use Export Control List",
    titleZh: "中华人民共和国两用物项出口管制清单官方问答",
    url: "https://exportcontrol.mofcom.gov.cn/article/cjwt/202605/1271.html",
    summary: "Official explanation of the unified list, coding, covered goods, software, technology and technical support.",
    keywords: ["中国", "PRC", "dual-use", "两用物项", "清单", "编码", "技术", "软件", "policy", "政策"]
  },
  {
    id: "china-dual-use-license-guide",
    agents: ["product", "trade"],
    authority: "China Export Control Information / MOFCOM",
    title: "Dual-Use Export License Application Guide",
    titleZh: "两用物项出口许可申请填报指南",
    url: "https://exportcontrol.mofcom.gov.cn/article/cjwt/202504/1135.html",
    summary: "Official application guidance covering classification, technical descriptions, parties, end user, end use and supporting documents.",
    keywords: ["两用物项", "许可", "申请", "最终用户", "最终用途", "技术参数", "license", "end use"]
  },
  {
    id: "china-dual-use-license-directory",
    agents: ["product", "trade"],
    authority: "MOFCOM / General Administration of Customs",
    title: "2026 Catalogue of Import and Export License Administration for Dual-Use Items and Technologies",
    titleZh: "2026年度两用物项和技术进出口许可证管理目录",
    url: "https://exportcontrol.mofcom.gov.cn/article/hgfw/lywxcx/gzqd/202601/1203.html",
    summary: "Official annual customs-facing licensing catalogue effective 1 January 2026; it replaced the 2025 catalogue.",
    keywords: ["两用物项", "目录", "海关", "许可证", "HS", "license", "customs"]
  },
  {
    id: "doj-eccp",
    agents: ["tpdd"],
    authority: "U.S. Department of Justice",
    title: "Evaluation of Corporate Compliance Programs",
    titleZh: "DOJ 企业合规项目评估指南",
    url: "https://www.justice.gov/criminal/criminal-fraud/page/file/937501",
    summary: "DOJ guidance on risk-based third-party due diligence, business rationale, payment, performance and ongoing monitoring."
  },
  {
    id: "oecd-third-party",
    agents: ["tpdd"],
    authority: "OECD",
    title: "Corruption risks in commodity trading transactions",
    titleZh: "OECD 交易与第三方腐败风险",
    url: "https://www.oecd.org/en/publications/typology-of-corruption-risks-in-commodity-trading-transactions_590e80e8-en/full-report/component-4.html",
    summary: "OECD discussion of beneficial ownership, anonymous shell companies, intermediaries and transaction red flags.",
    // OECD refuses automated requests with 403. Cited by reference rather than
    // retried into a permanent failure.
    fetchPolicy: "citation_only"
  },
  {
    id: "unodc-corruption",
    agents: ["tpdd"],
    authority: "United Nations Office on Drugs and Crime",
    title: "UNODC guidance on corruption and beneficial ownership",
    titleZh: "UNODC 反腐败与受益所有权指引",
    url: "https://www.unodc.org/unodc/en/corruption/index.html",
    summary: "UN guidance on corruption typologies, beneficial ownership transparency and third-party integrity risk."
  }
];

export function sourcesForAgents(agentIds, question = "") {
  const selected = SOURCES.filter((source) => source.agents.some((agent) => agentIds.includes(agent)));
  const unique = [...new Map(selected.map((source) => [source.id, source])).values()];
  const text = question.toLowerCase();
  const chinaControlQuestion = /中国|商务部|海关|\bprc\b|\bchina\b/i.test(question) && /两用物项|受限|管制|出口|dual.use|restricted|export control/i.test(question);
  if (chinaControlQuestion) {
    const chinaSources = unique.filter((source) => source.id.startsWith("china-dual-use-"));
    const diligenceSources = agentIds.includes("tpdd") ? unique.filter((source) => source.agents.includes("tpdd")) : [];
    const screeningSources = agentIds.includes("trade") && /交易方|最终用户|end.user|party|screening/i.test(question)
      ? unique.filter((source) => ["trade-csl", "bis-end-user"].includes(source.id)) : [];
    return [...new Map([...chinaSources, ...screeningSources, ...diligenceSources].map((source) => [source.id, source])).values()];
  }
  if (/h100|h200|nvidia|英伟达/i.test(question)) {
    const narrowMetricQuery = /\b(eccn|app|tpp|ccats|hts)\b|分类值|算力值/i.test(question)
      && !/路线|中转|运输|目的地|最终用户|最终用途|许可证|许可|route|transit|shipping|destination|end.user|end.use|licen[cs]e/i.test(question);
    const relevantIds = new Set(narrowMetricQuery
      ? ["nvidia-export", "bis-classify"]
      : ["nvidia-export", "nvidia-10k", "bis-classify", "bis-end-user"]);
    if (agentIds.includes("trade")) ["trade-csl", "bis-entity-list", "ofac-50-rule"].forEach((id) => relevantIds.add(id));
    if (agentIds.includes("tpdd")) ["doj-eccp", "oecd-third-party"].forEach((id) => relevantIds.add(id));
    return unique.filter((source) => relevantIds.has(source.id));
  }
  if (/华为|huawei|名单|screening|entity list|sdn|制裁|sanction/i.test(question)) {
    return unique.filter((source) => source.agents.includes("tpdd") || ["trade-csl", "bis-end-user", "bis-entity-list", "ofac-50-rule"].includes(source.id));
  }
  return unique.map((source, index) => ({
    source,
    index,
    score: (source.keywords || []).reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 3 : 0), 0)
      + (text.includes(source.title.toLowerCase()) || text.includes((source.titleZh || "").toLowerCase()) ? 5 : 0)
  })).sort((a, b) => b.score - a.score || a.index - b.index).map(({ source }) => source);
}

// Gem catalog.
//
// A gem's kind says what it produces, which decides whether a review procedure
// applies at all:
//
//   review    a transaction to examine — the full procedure
//   lookup    a value that is published somewhere — answered, not reviewed,
//             when the question is one (a question that describes a transaction
//             still gets the procedure, whichever gem is selected)
//   briefing  what changed over a window — read the notices, order them
//   memo      write up a case that has already been analysed
//
// A gem is four things bound together:
//   instruction     what the specialist agents are told to produce
//   boundSources    the sourceIds this gem is allowed to reason from
//   requiredFacts   what must be known before an answer is worth anything
//   outputTemplate  the shape of the result
//
// requiredFacts is the part that makes a gem more than a saved prompt: it lets
// the interface show what is still missing BEFORE submitting, instead of the
// model quietly guessing and the gap only surfacing in the answer.

export const GEM_GROUPS = {
  custom: { zh: "自建", en: "Yours" },
  screening: { zh: "名单筛查", en: "Screening" },
  classification: { zh: "物项与许可", en: "Item & licence" },
  diligence: { zh: "第三方尽调", en: "Third-party diligence" },
  data: { zh: "数据与输出", en: "Data & output" }
};

export const GEMS = [
  {
    id: "screen-party",
    kind: "review",
    command: "/screen-party",
    icon: "SP",
    group: "screening",
    name: { zh: "主体筛查", en: "Party screening" },
    summary: {
      zh: "对交易方做中美双边名单筛查，并用身份要素区分真实命中与误报。",
      en: "Screen a counterparty against US and PRC lists and separate a real hit from a false positive."
    },
    instruction: {
      zh: "对给定主体做受限方筛查。先给出命中或未命中的结论，再逐条列出比对的身份要素（名称、别名、国别、注册号、地址）及其一致或冲突状态。名称相似但身份要素冲突时，明确说明这是疑似误报以及还需要哪些注册证据才能定论。",
      en: "Screen the named party. State the outcome first, then list every identity element compared (name, aliases, country, registration number, address) and whether it agrees or conflicts. Where the name is similar but identity elements conflict, say it is a likely false positive and state what registration evidence would settle it."
    },
    boundSources: ["trade-csl", "ofac-sls", "china-control-entities", "china-unreliable-entity", "bis-ear-744"],
    requiredFacts: [
      { key: "legalName", zh: "法律实体全称", en: "Full legal entity name", match: /[一-龥A-Za-z][一-龥A-Za-z0-9.,&()\- ]{4,}/ },
      { key: "country", zh: "注册国家/地区", en: "Country of registration", match: /国家|注册地|country|registered in|美国|中国|德国|新加坡|日本|印度|墨西哥|荷兰|\bUS\b|\bCN\b|\bDE\b|\bSG\b/i },
      { key: "registrationNumber", zh: "注册号 / 统一社会信用代码", en: "Registration number / USCC", match: /注册号|统一社会信用代码|uscc|registration (number|no)|\buei\b|\blei\b|[0-9A-Z]{9,20}/i },
      { key: "role", zh: "交易角色", en: "Transaction role", match: /客户|供应商|经销商|代理|最终用户|收货|customer|vendor|supplier|distributor|consignee|end.?user/i }
    ],
    outputTemplate: { zh: "筛查结论 · 身份要素比对表 · 引用的名单条目与公告号 · 待补证据", en: "Screening outcome · identity comparison table · cited list entries and notice numbers · outstanding evidence" },
    placeholder: { zh: "例：客户 Aveox Technologies (Shenzhen) Co., Ltd.，注册号 91440300778812XKA，中国深圳，直销客户。", en: "e.g. Customer Aveox Technologies (Shenzhen) Co., Ltd., registration 91440300778812XKA, Shenzhen China, direct customer." }
  },
  {
    id: "eccn",
    kind: "lookup",
    command: "/eccn",
    icon: "EC",
    group: "classification",
    name: { zh: "美国物项归类", en: "US item classification" },
    summary: {
      zh: "确定 ECCN 与管制理由，区分已确立的分类事实和尚未成立的许可结论。",
      en: "Establish the ECCN and reasons for control, separating settled classification facts from an unsettled licence conclusion."
    },
    instruction: {
      zh: "确定物项的 ECCN 与管制理由。分别说明：已确立的分类事实、控制状态是否成立、许可结论是否成立、以及阻碍结论的缺失事实。产品名称本身不决定分类，必须依据准确型号或 part number 与技术参数。",
      en: "Determine the ECCN and reasons for control. State separately: the classification facts that are established, whether controlled status is established, whether a licence conclusion is established, and which missing facts prevent one. A product name alone never determines classification."
    },
    boundSources: ["bis-ccl", "bis-classify", "nvidia-export", "amd-export", "internal-master-data"],
    requiredFacts: [
      { key: "partNumber", zh: "准确型号 / part number", en: "Exact model / part number", match: /[A-Z]{2}-\d{4}|part\s*(number|no)|型号|900-\d{5}|h100|h200|\bpn\b/i },
      { key: "specs", zh: "关键技术参数", en: "Key technical parameters", match: /参数|规格|tpp|app|性能|频率|加密|位数|bit|ghz|spec|parameter|performance/i },
      { key: "origin", zh: "原产地", en: "Country of origin", match: /原产地|产地|制造地|origin|manufactured in|made in/i }
    ],
    outputTemplate: { zh: "ECCN 与管制理由 · 依据的条目原文 · 分类置信度 · 缺失参数", en: "ECCN and reasons for control · cited list text · classification confidence · missing parameters" },
    placeholder: { zh: "例：TS-6200-DM 机架服务器，含 TPM 2.0 与 64 核 CPU，中国合肥制造。", en: "e.g. TS-6200-DM rack server with TPM 2.0 and a 64-core CPU, manufactured in Hefei, China." }
  },
  {
    id: "cn-dual-use",
    kind: "lookup",
    command: "/cn-dual-use",
    icon: "CN",
    group: "classification",
    name: { zh: "中国两用物项判定", en: "PRC dual-use check" },
    summary: {
      zh: "对照统一管制清单与许可证目录，判断从中国出口是否需要两用物项许可。",
      en: "Check the unified control list and licence catalogue for a dual-use licence requirement on export from China."
    },
    instruction: {
      zh: "判断物项是否落入中国两用物项管制清单。给出管制编码、对应公告文号与生效日期，并核对该公告是否已被后续公告暂停、调整或废止。列出申请许可所需的技术资料、最终用户和最终用途材料。",
      en: "Determine whether the item falls under the PRC dual-use control list. Give the control code, the notice number and its effective date, and check whether that notice has since been suspended, adjusted or repealed. List the technical, end-user and end-use documents a licence application requires."
    },
    boundSources: ["china-dual-use", "china-licence-catalogue", "china-dual-use-regulation", "china-dual-use-license-guide"],
    requiredFacts: [
      { key: "item", zh: "物项名称与材质/成分", en: "Item name and material", match: /物项|材料|成分|器件|模块|设备|item|material|component|module/i },
      { key: "specs", zh: "技术参数", en: "Technical parameters", match: /参数|规格|纯度|含量|频率|功率|spec|parameter|purity|frequency/i },
      { key: "destination", zh: "最终目的地", en: "Final destination", match: /目的地|出口到|运往|destination|export to|ship to/i },
      { key: "endUse", zh: "最终用户与最终用途", en: "End user and end use", match: /最终用户|最终用途|用于|end.?user|end.?use|used for/i }
    ],
    outputTemplate: { zh: "管制编码与公告文号 · 生效/暂停状态 · 许可要求 · 申报材料清单", en: "Control code and notice number · in-force or suspended status · licence requirement · document checklist" },
    placeholder: { zh: "例：PT-7700-GA 镓基射频功放模块，从深圳出口至德国电信客户，用于基站维修。", en: "e.g. PT-7700-GA gallium RF amplifier module exported from Shenzhen to a German telecom customer for base-station repair." }
  },
  {
    id: "de-minimis",
    kind: "review",
    command: "/de-minimis",
    icon: "DM",
    group: "classification",
    name: { zh: "美国管辖判定", en: "US jurisdiction check" },
    summary: {
      zh: "境外制造产品是否受 EAR 管辖：de minimis 比例与外国直接产品规则。",
      en: "Whether a foreign-made product is subject to the EAR: de minimis percentage and the foreign direct product rules."
    },
    instruction: {
      zh: "判断境外制造的产品是否 subject to the EAR。先走 Part 734：受控美国原产内容的价值占比、适用的 de minimis 门槛、以及是否触发外国直接产品规则。说明该判定成立与否，再决定是否需要继续做 ECCN 与许可分析。不要用整机原产地代替含量计算。",
      en: "Determine whether a foreign-made product is subject to the EAR. Work through Part 734 first: the value share of controlled US-origin content, the applicable de minimis threshold, and whether a foreign direct product rule is triggered. Only then decide whether ECCN and licence analysis is reached. Do not substitute the finished-good origin for the content calculation."
    },
    boundSources: ["bis-ear-734", "bis-ear", "bis-ccl", "internal-master-data"],
    requiredFacts: [
      { key: "partNumber", zh: "产品型号", en: "Product model", match: /[A-Z]{2}-\d{4}|型号|part\s*(number|no)/i },
      { key: "mfgCountry", zh: "制造国", en: "Country of manufacture", match: /制造|生产|工厂|manufactured|produced|made in|合肥|深圳|hefei|shenzhen/i },
      { key: "usContent", zh: "受控美国原产内容占比", en: "Controlled US-origin content share", match: /美国.*内容|含量|占比|us content|de minimis|\d+(\.\d+)?\s*%/i },
      { key: "destination", zh: "目的地国家", en: "Destination country", match: /目的地|出口到|运往|destination|export to|ship to/i }
    ],
    outputTemplate: { zh: "是否 subject to the EAR · de minimis 计算依据 · FDP 触发判断 · 下一步分析", en: "Subject to the EAR or not · de minimis basis · FDP trigger assessment · next analysis step" },
    placeholder: { zh: "例：TS-6200-DM 在合肥制造，受控美国原产内容 28%，出口至印度企业数据中心。", en: "e.g. TS-6200-DM manufactured in Hefei with 28% controlled US-origin content, exported to an enterprise data centre in India." }
  },
  {
    id: "licence",
    kind: "review",
    command: "/licence",
    icon: "LP",
    group: "classification",
    name: { zh: "许可判定路径", en: "Licence determination path" },
    summary: {
      zh: "ECCN → 管制理由 → 国别矩阵 → 许可例外，逐步给出许可结论或缺口。",
      en: "ECCN to reasons for control to the country chart to licence exceptions, step by step."
    },
    instruction: {
      zh: "按顺序执行许可判定：ECCN → 管制理由 → Commerce Country Chart 对应目的国 → 是否需要许可 → 是否可能适用 Part 740 许可例外。每一步都要给出依据条文，并说明哪一步因缺少事实而无法推进。不要跳过任何一步直接给结论。",
      en: "Run the licence determination in order: ECCN, reasons for control, the Commerce Country Chart cell for the destination, whether a licence is required, and whether a Part 740 exception may apply. Cite the provision at each step and say which step is blocked for want of facts. Never skip to the conclusion."
    },
    boundSources: ["bis-ccl", "bis-country-chart", "bis-ear-740", "bis-ear", "bis-ear-744"],
    requiredFacts: [
      { key: "eccn", zh: "ECCN", en: "ECCN", match: /\b\d[A-E]\d{3}\b|eccn|ear99/i },
      { key: "destination", zh: "目的地国家", en: "Destination country", match: /目的地|出口到|运往|destination|export to|ship to/i },
      { key: "endUser", zh: "最终用户", en: "End user", match: /最终用户|收货方|end.?user|consignee/i },
      { key: "endUse", zh: "最终用途", en: "End use", match: /最终用途|用于|end.?use|used for/i }
    ],
    outputTemplate: { zh: "逐步判定链 · 每步引用条文 · 许可结论或阻塞点 · 可能适用的例外", en: "Step chain · provision cited at each step · licence conclusion or blocking gap · candidate exceptions" },
    placeholder: { zh: "例：ECCN 4A090.a 的 AI 训练系统，从美国出口至墨西哥经销商，最终安装地待确认。", en: "e.g. An ECCN 4A090.a AI training system exported from the US to a Mexican distributor, final installation site unconfirmed." }
  },
  {
    id: "tpdd",
    kind: "review",
    command: "/tpdd",
    icon: "DD",
    group: "diligence",
    name: { zh: "第三方尽调", en: "Third-party diligence" },
    summary: {
      zh: "评估商业合理性、UBO、费用与付款路径，把红旗当作问题而不是结论。",
      en: "Assess business rationale, UBO, fees and payment path, treating red flags as questions rather than findings."
    },
    instruction: {
      zh: "对第三方开展尽调评估。逐项分析法律存续、受益所有权、商业合理性、服务范围、费用水平和付款路径。红旗只能作为需要证据的问题提出，不得据此认定对方是空壳公司或存在违法行为。给出所需文件清单和持续监控要求。",
      en: "Assess the third party. Work through legal existence, beneficial ownership, business rationale, scope of services, fee level and payment path. Red flags may only be raised as questions requiring evidence; never conclude that the party is a shell company or has acted unlawfully. Produce a document checklist and ongoing-monitoring requirements."
    },
    boundSources: ["doj-eccp", "oecd-third-party", "gleif-lei", "companies-house", "sec-edgar", "ofac-50-rule"],
    requiredFacts: [
      { key: "partyName", zh: "第三方全称与注册地", en: "Third-party name and place of registration", match: /[一-龥A-Za-z][一-龥A-Za-z0-9.,&()\- ]{4,}/ },
      { key: "service", zh: "服务范围与交付物", en: "Scope of services and deliverables", match: /服务|交付|职责|顾问|代理|分销|service|deliverable|scope|consult|distribut/i },
      { key: "fee", zh: "费用结构", en: "Fee structure", match: /费用|佣金|成功费|折扣|返点|fee|commission|success fee|retainer|\d+\s*%/i },
      { key: "payment", zh: "收款主体与账户所在地", en: "Payee entity and account location", match: /付款|收款|账户|汇款|payment|account|remit|payee|bvi|hk|香港|离岸/i },
      { key: "ubo", zh: "受益所有权", en: "Beneficial ownership", match: /ubo|受益所有|实际控制|股东|beneficial owner|shareholder|ownership/i }
    ],
    outputTemplate: { zh: "风险等级 · 红旗与对应证据要求 · 文件清单 · 持续监控建议", en: "Risk level · red flags with the evidence each requires · document checklist · monitoring plan" },
    placeholder: { zh: "例：新顾问 Silverline Advisory Ltd.（BVI），要求 15% 成功费付至 BVI 账户，未披露 UBO。", en: "e.g. New consultant Silverline Advisory Ltd. (BVI) requests a 15% success fee to a BVI account and has not disclosed its UBO." }
  },
  {
    id: "reg-brief",
    kind: "briefing",
    command: "/reg-brief",
    icon: "RB",
    group: "data",
    name: { zh: "监管变化简报", en: "Regulatory change brief" },
    summary: {
      zh: "汇总已同步来源中的新增、暂停与废止公告，并标出影响到的内部主数据。",
      en: "Summarize new, suspended and repealed notices in the synchronized sources and flag the internal records they touch."
    },
    instruction: {
      zh: "基于已同步的官方来源，汇总指定期间内的监管变化。按公告文号、发布日期、措施类型和生效日期列出，并明确标注被暂停、调整或废止的早期公告。指出这些变化命中了哪些内部主数据记录。不要凭记忆补充未同步来源的内容。",
      en: "Summarize regulatory changes in the requested window from the synchronized official sources only. List them by notice number, publication date, measure type and effective date, and mark which earlier notices were suspended, adjusted or repealed. Identify the internal master-data records affected. Do not fill gaps from memory for sources that are not synchronized."
    },
    boundSources: ["china-dual-use", "china-control-entities", "china-unreliable-entity", "china-licence-catalogue", "bis-ear-744"],
    requiredFacts: [
      { key: "window", zh: "时间范围", en: "Time window", match: /最近|近|本周|本月|上周|上月|\d{4}\s*年|\d+\s*(天|周|月)|last|past|recent|since|\bweek\b|\bmonth\b/i }
    ],
    outputTemplate: { zh: "变化清单（文号/日期/类型/生效） · 沿革关系 · 内部影响面 · 建议动作", en: "Change list (notice, date, type, effective) · supersession links · internal impact · recommended actions" },
    placeholder: { zh: "例：汇总最近 6 个月中国出口管制管控名单和两用物项公告的变化。", en: "e.g. Summarize changes to the PRC control list and dual-use notices over the past six months." }
  },
  {
    id: "case-memo",
    kind: "memo",
    command: "/case-memo",
    icon: "MM",
    group: "data",
    name: { zh: "案件备忘录", en: "Case memo" },
    summary: {
      zh: "把当前对话整理成带证据链和结论边界的备忘录，供人工复核归档。",
      en: "Turn the current thread into a memo with an evidence chain and explicit limits, ready for human review."
    },
    instruction: {
      zh: "将本次对话整理成合规备忘录。结构为：事实摘要、已确立结论、未确立事项、依据来源（含检索时间和快照标识）、缺失信息、建议动作、复核要求。明确区分哪些是官方来源支持的结论，哪些是待人工确认的推断。备忘录不构成法律意见。",
      en: "Turn this thread into a compliance memo: facts, established conclusions, unestablished points, sources cited with retrieval time and snapshot identifier, missing information, recommended actions, and the review required. Separate what the official sources support from what remains an inference awaiting human confirmation. The memo is not legal advice."
    },
    boundSources: [],
    requiredFacts: [
      { key: "thread", zh: "至少一轮已完成的分析", en: "At least one completed analysis", match: /.{10,}/ }
    ],
    outputTemplate: { zh: "事实 · 已确立结论 · 未确立事项 · 证据链 · 缺失信息 · 复核要求", en: "Facts · established · unestablished · evidence chain · gaps · review required" },
    placeholder: { zh: "例：把上面关于 Red Cat Holdings 的筛查整理成备忘录，供法务复核。", en: "e.g. Turn the Red Cat Holdings screening above into a memo for legal review." }
  }
];

export const GEM_BY_ID = new Map(GEMS.map((gem) => [gem.id, gem]));

// The eight plus whatever the reader built. The custom ones are loaded at
// runtime and handed in here, so every lookup below sees one catalogue: a gem is
// a gem to the composer, the palette and the sidebar, and only the badge on its
// card says which kind of thing wrote it.
let customGems = [];
export function setCustomGems(list) {
  customGems = Array.isArray(list) ? list : [];
  for (const gem of customGems) GEM_BY_ID.set(gem.id, gem);
}
export const allGems = () => [...GEMS, ...customGems];

// Which required facts the current draft appears to supply. This is a drafting
// aid, not a validation gate: it never blocks submission, because a heuristic
// must not be able to stop a user from asking a question.
export function factCoverage(gem, text) {
  const value = String(text || "");
  return (gem.requiredFacts || []).map((fact) => ({ ...fact, met: factMet(fact, value) }));
}

// A built-in fact carries a regular expression; one a reader wrote carries a
// list of words. Both answer the same question — does the draft appear to supply
// this — so both are answered here rather than at the two call sites, which is
// how the sidebar and the composer would come to disagree about the same draft.
//
// The keyword form is looser on purpose: /[0-9A-Z]{9,20}/ notices a registration
// number nobody named, a word list does not. It costs a prompt, never an answer,
// because this has never been allowed to block a submission.
function factMet(fact, value) {
  if (fact.match instanceof RegExp) return fact.match.test(value);
  const words = Array.isArray(fact.keywords) ? fact.keywords : [];
  return words.some((word) => word && value.toLowerCase().includes(String(word).toLowerCase()));
}

// The label of a fact, whichever form it is in. The built-in eight carry zh/en;
// a custom one carries one label, in whatever language it was written.
export function factLabel(fact, locale = "zh") {
  return fact.label || fact[locale] || fact.zh || fact.key || "";
}

// The skills a gem offers, on Google's arrangement: a gem is who is answering
// and stays selected, and skills hang under it rather than beside it.
//
// A gem that names none offers all of them, and that is the rule for every
// built-in — they were written before skills existed and cannot name ids for
// procedures a reader has not written yet. Only a custom gem whose author
// ticked a set narrows anything, which keeps the default from ever hiding a
// reader's own work from them.
//
// One function, because the sidebar list and the / palette have to answer this
// identically: a skill listed in one and missing from the other is a command
// that appears usable and is not.
export function skillsForGem(gem, skills) {
  const list = Array.isArray(skills) ? skills : [];
  const allowed = gem?.skillIds;
  if (!Array.isArray(allowed) || !allowed.length) return list;
  return list.filter((skill) => allowed.includes(skill.id));
}

export function matchGems(query) {
  const needle = String(query || "").replace(/^\//, "").toLowerCase().trim();
  if (!needle) return allGems();
  return allGems().filter((gem) =>
    gem.command.slice(1).toLowerCase().includes(needle)
    || gem.id.includes(needle)
    || (typeof gem.name === "string"
      ? gem.name.toLowerCase().includes(needle)
      : Object.values(gem.name).some((name) => name.toLowerCase().includes(needle)))
  );
}

const WORKSPACE_KEY = "compliance-workspace-gems";

export function workspaceGemIds() {
  try { return JSON.parse(localStorage.getItem(WORKSPACE_KEY)) || []; } catch { return []; }
}

export function toggleWorkspaceGem(gemId) {
  const current = workspaceGemIds();
  const next = current.includes(gemId) ? current.filter((id) => id !== gemId) : [...current, gemId];
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
  return next.includes(gemId);
}

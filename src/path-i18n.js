// The analysis path in English.
//
// The path was written in one language and stayed that way: lane names, step
// titles and the labels on every input field came back in Chinese however the
// interface was set. A reader on the English side got an English conclusion over
// a Chinese procedure.
//
// Translating at the boundary rather than inside the resolvers is deliberate.
// The alternative — a locale branch at every string — puts a conditional inside
// every piece of compliance logic, where the logic is the thing that has to stay
// readable. Here the resolvers keep writing one language and this maps what they
// produced.
//
// A string with no entry passes through unchanged. That is visible rather than
// silent: the coverage test below fails when a fixed term has no translation, so
// a new step cannot be added without one.

const TERMS = {
  // Lanes
  "Trade — 受限方与主体": "Trade — parties and restrictions",
  "Product — 物项与许可": "Product — item and licensing",
  "Ethics & TPDD — 第三方": "Ethics & TPDD — third parties",
  "结案": "Closing",
  "查询": "Lookup",
  "监管变化简报": "Regulatory briefing",
  "案件备忘录": "Case memo",

  // Trade steps
  "确定交易主体的法律实体": "Identify the counterparty's legal entity",
  "检索受限方名单": "Search the restricted-party lists",
  "名称匹配": "Name matching",
  "身份要素消歧": "Identity resolution",
  "所有权穿透（50% 聚合）": "Ownership aggregation (50 Percent Rule)",
  "所有权穿透（OFAC 50% 聚合）": "Ownership aggregation (OFAC 50 Percent Rule)",
  "母公司名单筛查": "Screen the parent company",

  // Product steps
  "确定物项（准确型号或 part number）": "Identify the item (exact model or part number)",
  "是否受 EAR 管辖（de minimis / 外国直接产品）": "Subject to the EAR? (de minimis / foreign direct product)",
  "分类（ECCN）": "Classification (ECCN)",
  "目的地与管制理由（Country Chart）": "Destination and reasons for control (Country Chart)",
  "十项一般禁令（最终用户、最终用途、禁运、知情）": "The ten general prohibitions (end user, end use, embargo, knowledge)",
  "许可例外": "Licence exceptions",

  // Third-party diligence steps
  "商业合理性、服务范围与费用": "Commercial rationale, scope of services and fees",
  "主体存续与注册信息": "Legal existence and registration",
  "受益所有权": "Beneficial ownership",
  "收款主体与付款路径": "Payee and payment route",
  "持续监控与再评估": "Ongoing monitoring and reassessment",

  // Closing, lookup, briefing, memo
  "Compliance / Legal 人工复核": "Compliance / Legal human review",
  "在已接入数据中检索": "Search the ingested data",
  "按时间顺序汇总已发布公告": "Published notices, in order",
  "整理本会话已产出的结论与证据": "Assemble this session's conclusions and evidence",
  "系统按问题结构生成": "Planned by the system from the structure of the question",

  // Citations that are words rather than provisions, and the note under each
  // step saying why it sits where it does in the procedure.
  "前置要件": "Prerequisite",
  "直接查询": "Direct lookup",
  "直接汇总": "Direct roll-up",
  "文书产出": "Document output",
  "本系统边界": "The boundary of this system",
  "BIS Know Your Customer 指引要求先确定实际交易方": "BIS Know Your Customer guidance requires the actual counterparty to be established first",
  "General Prohibition Four — 被拒绝出口权利的人员": "General Prohibition Four — persons denied export privileges",
  "同上；名称命中本身不是最终判定": "As above; a name match is not itself a determination",
  "以身份要素而非名称字符串区分真实命中与误报": "A true match is told from a false positive by identity elements, not by the name string",
  "间接与合计持股需穿透计算，名单检索不解决": "Indirect and aggregate holdings have to be computed through the chain; list screening does not settle them",
  "官方 Steps 未列此步；没有准确型号则后续无法进行": "The official Steps do not list this one; without an exact model nothing downstream can proceed",
  "官方顺序要求先判管辖，再谈分类": "The official order settles jurisdiction before classification",
  "Classification —— 对照 CCL（Part 774）": "Classification — against the CCL (Part 774)",
  "目的地 + 管制理由查 Commerce Country Chart（Part 738）": "Destination plus reasons for control, read from the Commerce Country Chart (Part 738)",
  "确认是否有可用的 License Exception": "Whether any License Exception is available",
  "DOJ 要求先说明为何需要该第三方，以及合同是否具体描述服务": "DOJ asks first why the third party is needed, and whether the contract describes the services specifically",
  "基于风险的尽调": "Risk-based due diligence",
  "同上；与 OFAC 50% 聚合互为输入": "As above; this and OFAC 50 Percent aggregation feed each other",
  "付款机制控制": "Controls over the payment mechanism",
  "DOJ 明确要求覆盖整个合作关系存续期，而非仅准入时点": "DOJ requires the whole life of the relationship to be covered, not only the point of onboarding",
  "问题问的是一个已登记的值，不是一笔交易；没有交易就没有可审查的程序": "The question asks for a recorded value, not about a transaction; with no transaction there is no procedure to run",
  "问题问的是一段时间内发布了什么，不是一笔交易；没有交易就没有可审查的程序": "The question asks what was published over a period, not about a transaction; with no transaction there is no procedure to run",
  "备忘录记录既有分析，不产生新的判断": "A memo records existing analysis; it produces no new judgement",
  "系统不做交易放行": "This system does not release transactions",

  // Input labels
  "法律实体全称": "Full legal entity name",
  "注册号 / 统一社会信用代码": "Registration number / unified social credit code",
  "注册国别": "Country of registration",
  "注册地址": "Registered address",
  "股权结构（如：A 持股 30%、B 持股 25%）": "Shareholding structure (e.g. A holds 30%, B holds 25%)",
  "准确型号 / part number": "Exact model / part number",
  "受控美国原产内容占比": "Controlled US-origin content",
  "已知的 ECCN 或中国管制编码": "Known ECCN or PRC control code",
  "最终目的地": "Final destination",
  "最终用户与最终用途": "End user and end use",
  "费用结构与交付物": "Fee structure and deliverables",
  "注册证明文件情况": "Registration documents held",
  "受益所有人": "Beneficial owners",
  "收款主体与账户所在地": "Payee and account location",

  // Field options
  "不确定": "Not known",

  // Step explanations. Only the literal ones: a line that carries a party name,
  // a source id or a count is written where the data is and is not this system's
  // vocabulary to translate.
  "准确型号或 part number；产品系列名无法定位管制条目":
    "An exact model or part number; a product family name cannot locate a control entry",
  "受控美国原产内容的价值占比，以及是否使用美国技术或软件（FDP）":
    "The value share of controlled US-origin content, and whether US technology or software was used (FDP)",
  "关键技术参数与厂商分类信息": "Key technical parameters and the manufacturer's classification",
  "分类成立后方可查 Country Chart": "The Country Chart can only be read once classification is established",
  "最终用户、最终用途与实际交易链；General Prohibitions 需逐项过":
    "End user, end use and the actual transaction chain; the General Prohibitions are worked through one by one",
  "管辖、分类与国别矩阵成立后方可判断是否有可用的 License Exception":
    "A licence exception can only be assessed once jurisdiction, classification and the Country Chart are settled",
  "以上步骤的结论与证据需经人工确认；系统不做交易放行":
    "The conclusions and evidence above require human confirmation; this system does not release transactions",
  "注册号（双方之一缺失，无法比对）": "Registration number (missing on one side, so no comparison is possible)",
  "完整股权结构与受益所有权证据；名单检索不解决间接或合计持股":
    "The full shareholding structure and beneficial ownership evidence; list screening does not settle indirect or aggregate holdings",
  "该名称在 GLEIF 中无登记记录；未持有 LEI 的实体需另行取得股权证据":
    "This name has no GLEIF record; an entity without an LEI needs ownership evidence from elsewhere",
  "需取得对应证明文件": "The corresponding documents have to be obtained",
  "尚未设定复审周期与触发条件": "No review interval or trigger has been set",
  "法律实体全称（含注册后缀）": "The full legal entity name, including its registered suffix",
  "尚无已同步的受限方名单来源，需先完成同步": "No restricted-party list is synced yet; sync one first",
  "名单来源同步后方可进行": "Available once a list source has been synced",
  "无名称命中，本步骤不适用": "No name matched, so this step does not arise",
  "本次未命中任何受限方名单，因此不存在需要计算合计持股的被列名主体":
    "Nothing matched a restricted-party list, so there is no designated party whose aggregate holding needs computing",
  "名称相似不等于同一主体：下一步按注册号、国别和地址逐项比对":
    "A similar name is not the same entity: the next step compares registration number, country and address",
  "问题中提供了带法律后缀的实体名称": "The question gives an entity name with a legal suffix",
  "备忘录记录既有结论与证据，不产生新的判断":
    "A memo records existing conclusions and evidence; it produces no new judgement",
  "本会话尚无已完成的分析可供整理；请先提交一个情景完成审查，再生成备忘录":
    "This session has no completed analysis to write up. Submit a scenario, complete the review, then ask for the memo"
};

export const translateTerm = (value, locale) => (locale === "en" ? TERMS[value] || value : value);

// A line the resolvers built by interpolation, carried in both languages.
//
// The fixed vocabulary above can be mapped after the fact because it is a
// closed set of literals. "已检索 8 个来源，共 51,220 条" cannot: the sentence is
// assembled around data, so the only place both versions can exist is where it
// is written. bi() is what the resolvers use to write it once in each language;
// everything downstream treats the pair as a line.
export const bi = (zh, en) => ({ zh, en });

const isPair = (line) => line && typeof line === "object" && typeof line.zh === "string";

// Resolves a line to the reader's language whichever form it arrives in: a pair
// picks its side, a plain string goes through the term table.
export const localizeLine = (line, locale) =>
  (isPair(line) ? (locale === "en" ? line.en : line.zh) : translateTerm(line, locale));

export const localizeLines = (lines, locale) => (lines || []).map((line) => localizeLine(line, locale));

// Everything the interface shows from a path, put through the table. Only the
// fixed vocabulary is translated; a line carrying data — a party name, a notice
// number, a date — passes through as written, which is correct: those are not
// this system's words.
export function localizePath(path, locale) {
  if (!path?.lanes) return path;
  const term = (value) => translateTerm(value, locale);
  return {
    ...path,
    lanes: path.lanes.map((lane) => ({
      ...lane,
      label: term(lane.label),
      steps: lane.steps.map((step) => ({
        ...step,
        title: term(step.title),
        // The provenance under each step title — the provision it comes from and
        // the note saying why it sits where it does — is as much part of the
        // procedure as the title, and was left in Chinese under an English path.
        cite: localizeLine(step.cite, locale),
        citeNote: localizeLine(step.citeNote, locale),
        basis: localizeLines(step.basis, locale),
        needs: localizeLines(step.needs, locale),
        inputs: (step.inputs || []).map((input) => ({
          ...input,
          label: term(input.label),
          options: input.options ? input.options.map(term) : input.options
        }))
      }))
    })),
    // How the path was arrived at: which methodology each lane follows and which
    // of its steps this system planned rather than took from the procedure.
    basis: (path.basis || []).map((row) => ({ ...row, label: term(row.label) })),
    derivation: (path.derivation || []).map((row) => ({
      ...row,
      label: term(row.label),
      methodology: row.methodology ? { ...row.methodology, label: term(row.methodology.label) } : row.methodology,
      plannedSteps: (row.plannedSteps || []).map(term)
    })),
    // Why the path is shorter than the published procedure. These lines are the
    // system's own reasoning about scope, so they belong to the reader's
    // language as much as any step title does — they were being shown in Chinese
    // above an English path.
    triage: (path.triage || []).map((gate) => ({
      ...gate,
      because: localizeLine(gate.because, locale),
      cite: localizeLine(gate.cite, locale)
    }))
  };
}

export const TRANSLATABLE_TERMS = Object.freeze(TERMS);

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
        basis: localizeLines(step.basis, locale),
        needs: localizeLines(step.needs, locale),
        inputs: (step.inputs || []).map((input) => ({
          ...input,
          label: term(input.label),
          options: input.options ? input.options.map(term) : input.options
        }))
      }))
    })),
    derivation: (path.derivation || []).map((row) => ({ ...row, label: term(row.label) }))
  };
}

export const TRANSLATABLE_TERMS = Object.freeze(TERMS);

// The analysis path.
//
// The path is planned before any work happens, then resolved as evidence
// arrives. That order matters: a path computed afterwards is a narrative fitted
// to whatever was found, whereas a path declared up front commits to the steps
// the question has to pass and then reports honestly which of them closed. It
// also means the structure the user watches fill in is the same structure the
// conclusion is presented in.
//
//   pending          planned, not yet attempted
//   declared         the user supplied the fact, but nobody has verified it
//   confirmed        settled, and `basis` says on what
//   evidence_needed  reached but blocked, and `needs` says by what
//   not_reached      an earlier step must settle first
//   not_applicable   the conditions for this step do not arise, so it needs no work
//   review_required  only a person can close this
//
// Statuses are never taken from the model's own account of its work. A model
// asked whether a step is confirmed will say yes; "confirmed" here has to mean
// something a reviewer can check.


import { triage } from "./triage.js";
import { bi, localizeLine, translateTerm } from "./path-i18n.js";
import { triggeredDependencies } from "./lane-dependencies.js";
import { invokeCapability, licenceExceptionOutcome } from "./agent-capabilities.js";

// Published methodologies the path follows.
//
// The step sequences below are not this product's invention: US export control
// has an official numbered decision procedure (EAR Part 732), ownership
// aggregation has published OFAC guidance, and third-party diligence has the
// DOJ's stated factors. Following them and citing them is what makes a path
// defensible — a reviewer asking "why these steps" gets a provision, not an
// opinion.
//
// Where no official procedure exists the path says so rather than implying one.
// The PRC side in particular has no numbered decision tree, so its lane is
// organised around the regulation's own requirements instead of being forced
// into a symmetry that does not exist.
export const METHODOLOGIES = {
  ear732: {
    id: "ear732",
    label: "EAR Part 732 — Steps for Using the EAR",
    authority: "U.S. Bureau of Industry and Security",
    kind: "official",
    sourceId: "bis-ear-732",
    url: "https://www.ecfr.gov/current/title-15/part-732"
  },
  ofac50: {
    id: "ofac50",
    label: "OFAC 50 Percent Rule",
    authority: "U.S. Office of Foreign Assets Control",
    kind: "official",
    sourceId: "ofac-50-rule",
    url: "https://ofac.treasury.gov/faqs/401"
  },
  eccp: {
    id: "eccp",
    label: "DOJ Evaluation of Corporate Compliance Programs — Third-Party Management",
    authority: "U.S. Department of Justice",
    kind: "official",
    sourceId: "doj-eccp",
    url: "https://www.justice.gov/criminal/criminal-fraud/page/file/937501"
  },
  prcDualUse: {
    id: "prcDualUse",
    label: "两用物项出口管制条例 + 出口许可申请填报指南",
    authority: "国务院 / 商务部",
    kind: "official",
    sourceId: "china-dual-use",
    url: "https://exportcontrol.mofcom.gov.cn/article/zcfg/gnzcfg/gzjgfxwj/202410/1057.html"
  },
  derived: {
    id: "derived",
    label: "系统按问题结构生成",
    authority: null,
    kind: "derived",
    sourceId: null,
    url: null
  }
};

// The declared sequence per lane, each step carrying the provision it comes
// from. Order follows the official procedure, not convenience.
const LANE_PLANS = {
  trade: {
    label: "Trade — 受限方与主体",
    methodology: "ear732",
    steps: [
      ["identify_party", "确定交易主体的法律实体", { field: "legalName", kind: "text", label: "法律实体全称" },
        { cite: "Supplement No. 3 to Part 732", note: "BIS Know Your Customer 指引要求先确定实际交易方" }],
      ["search_lists", "检索受限方名单", null,
        { cite: "§ 732.3(g) Step 12", note: "General Prohibition Four — 被拒绝出口权利的人员" }],
      ["name_match", "名称匹配", null,
        { cite: "§ 732.3(g) Step 12", note: "同上；名称命中本身不是最终判定" }],
      ["identity_resolution", "身份要素消歧", [
        { field: "registrationNumber", kind: "text", label: "注册号 / 统一社会信用代码" },
        { field: "country", kind: "choice", label: "注册国别", options: ["CN", "US", "DE", "SG", "JP", "IN", "MX", "NL"] },
        { field: "address", kind: "text", label: "注册地址" }
      ], { cite: "Supplement No. 3 to Part 732", note: "以身份要素而非名称字符串区分真实命中与误报" }],
      ["ownership", "所有权穿透（50% 聚合）", { field: "ownership", kind: "text", label: "股权结构（如：A 持股 30%、B 持股 25%）" },
        { cite: "OFAC 50 Percent Rule FAQ 401", methodology: "ofac50", note: "间接与合计持股需穿透计算，名单检索不解决" }]
    ]
  },
  product: {
    label: "Product — 物项与许可",
    methodology: "ear732",
    steps: [
      ["identify_item", "确定物项（准确型号或 part number）", { field: "partNumber", kind: "text", label: "准确型号 / part number" },
        { cite: "前置要件", methodology: "derived", note: "官方 Steps 未列此步；没有准确型号则后续无法进行" }],
      ["jurisdiction", "是否受 EAR 管辖（de minimis / 外国直接产品）", { field: "usContent", kind: "choice", label: "受控美国原产内容占比", options: ["< 10%", "10–25%", "> 25%", "不确定"] },
        { cite: "§ 732.2 Steps 1–6 · Supplement No. 2", note: "官方顺序要求先判管辖，再谈分类" }],
      ["classify", "分类（ECCN）", { field: "eccn", kind: "text", label: "已知的 ECCN 或中国管制编码" },
        { cite: "§ 732.3(b) Step 7", note: "Classification —— 对照 CCL（Part 774）" }],
      ["destination_chart", "目的地与管制理由（Country Chart）", { field: "destination", kind: "text", label: "最终目的地" },
        { cite: "§ 732.3(b)–(c) Steps 8–9", note: "目的地 + 管制理由查 Commerce Country Chart（Part 738）" }],
      ["prohibitions", "十项一般禁令（最终用户、最终用途、禁运、知情）", { field: "endUse", kind: "text", label: "最终用户与最终用途" },
        { cite: "§ 732.3(g) Steps 12–29", note: "General Prohibitions One–Ten" }],
      ["licence_exception", "许可例外", null,
        { cite: "§ 732.4 · Part 740", note: "确认是否有可用的 License Exception" }]
    ]
  },
  tpdd: {
    label: "Ethics & TPDD — 第三方",
    methodology: "eccp",
    steps: [
      ["rationale_fees", "商业合理性、服务范围与费用", { field: "fees", kind: "text", label: "费用结构与交付物" },
        { cite: "ECCP — Third-Party Management", note: "DOJ 要求先说明为何需要该第三方，以及合同是否具体描述服务" }],
      ["legal_existence", "主体存续与注册信息", { field: "registrationDocs", kind: "text", label: "注册证明文件情况" },
        { cite: "ECCP — Risk-Based Due Diligence", note: "基于风险的尽调" }],
      ["beneficial_ownership", "受益所有权", { field: "ubo", kind: "text", label: "受益所有人" },
        { cite: "ECCP — Risk-Based Due Diligence", note: "同上；与 OFAC 50% 聚合互为输入" }],
      ["payment_path", "收款主体与付款路径", { field: "payee", kind: "text", label: "收款主体与账户所在地" },
        { cite: "ECCP — Controls / Payment", note: "付款机制控制" }],
      ["ongoing_monitoring", "持续监控与再评估", null,
        { cite: "ECCP — Management of Relationships", note: "DOJ 明确要求覆盖整个合作关系存续期，而非仅准入时点" }]
    ]
  },
  lookup: {
    label: "查询",
    methodology: "derived",
    steps: [["data_lookup", "在已接入数据中检索", null,
      { cite: "直接查询", methodology: "derived", note: "问题问的是一个已登记的值，不是一笔交易；没有交易就没有可审查的程序" }]]
  },
  briefing: {
    label: "监管变化简报",
    methodology: "derived",
    steps: [["notice_timeline", "按时间顺序汇总已发布公告", null,
      { cite: "直接汇总", methodology: "derived", note: "问题问的是一段时间内发布了什么，不是一笔交易；没有交易就没有可审查的程序" }]]
  },
  memo: {
    label: "案件备忘录",
    methodology: "derived",
    steps: [["case_writeup", "整理本会话已产出的结论与证据", null,
      { cite: "文书产出", methodology: "derived", note: "备忘录记录既有分析，不产生新的判断" }]]
  },
  review: {
    label: "结案",
    methodology: "derived",
    steps: [["human_review", "Compliance / Legal 人工复核", null,
      { cite: "本系统边界", methodology: "derived", note: "系统不做交易放行" }]]
  }
};

// A gem states which lane its question is really about, so the plan leads with
// it instead of always presenting the lanes in a fixed order.
export const GEM_LEAD_LANE = {
  "screen-party": "trade",
  eccn: "product",
  "cn-dual-use": "product",
  "de-minimis": "product",
  licence: "product",
  tpdd: "tpdd",
  "reg-brief": "trade",
  "case-memo": "review"
};

// What the guide page renders. Written out from the plans rather than
// transcribed into the page, because a documented procedure that has drifted
// from the executed one is worse than no page at all: it describes a review
// nobody performs.
export function describeProcedures() {
  const lanes = Object.entries(LANE_PLANS).map(([lane, plan]) => ({
    lane,
    label: plan.label,
    methodology: plan.methodology,
    steps: plan.steps.map(([id, title, inputs, source]) => ({
      id,
      title,
      cite: source?.cite || null,
      note: source?.note || null,
      methodology: source?.methodology || plan.methodology,
      asks: (inputs ? [].concat(inputs) : []).map((input) => input.label)
    }))
  }));
  const steps = lanes.flatMap((item) => item.steps);
  return {
    methodologies: Object.values(METHODOLOGIES).map((methodology) => ({
      ...methodology,
      stepCount: steps.filter((step) => step.methodology === methodology.id).length,
      lanes: lanes.filter((item) => item.steps.some((step) => step.methodology === methodology.id)).map((item) => item.lane)
    })),
    lanes,
    gemLeadLane: GEM_LEAD_LANE,
    stepCount: steps.length
  };
}

// Every field the path can ask a user for, derived from the plans themselves.
//
// The server used to keep its own hand-written copy of this list to validate
// declarations against. The two drifted: `endUse` was asked for by the general
// prohibitions step and missing from the server's copy, so that answer was
// dropped on arrival, the step never settled, and the user was asked the same
// question again after a full two-and-a-half minute run. A list that must match
// another list will eventually not, so there is now only one.
export const DECLARABLE_FIELDS = Object.freeze([...new Set(
  Object.values(LANE_PLANS).flatMap((plan) => plan.steps.flatMap(([, , inputs]) =>
    (inputs ? [].concat(inputs) : []).map((input) => input.field)))
)]);

// A single-lane plan, sharing the shape every other plan has so nothing
// downstream needs to know which kind it is looking at.
function laneOnly(lane) {
  const plan = LANE_PLANS[lane];
  const lanes = [{
    lane,
    label: plan.label,
    leading: true,
    methodology: plan.methodology,
    steps: plan.steps.map(([id, title, inputs, source]) => ({
      id, title, status: "pending", basis: [], needs: [],
      inputs: inputs ? [].concat(inputs) : [],
      cite: source?.cite || null,
      citeNote: source?.note || null,
      methodology: source?.methodology || plan.methodology
    }))
  }];
  return {
    lanes,
    summary: summarize(lanes),
    planned: true,
    basis: [METHODOLOGIES[plan.methodology]].filter(Boolean),
    followsOfficial: METHODOLOGIES[plan.methodology]?.kind === "official",
    triage: [],
    // The same row shape every other plan produces. Inventing a shorter one here
    // meant the briefing read matchedTerms off an object that did not have it and
    // took the whole answer down with it.
    derivation: lanes.map((group) => {
      const official = group.steps.filter((item) => METHODOLOGIES[item.methodology]?.kind === "official");
      return {
        lane: group.lane,
        label: group.label,
        leading: true,
        matchedBy: group.lane === "lookup" ? "direct_lookup" : "gem_kind",
        matchedTerms: [],
        methodology: METHODOLOGIES[group.methodology] || null,
        stepCount: group.steps.length,
        officialStepCount: official.length,
        plannedStepCount: group.steps.length - official.length,
        plannedSteps: group.steps.filter((item) => METHODOLOGIES[item.methodology]?.kind !== "official").map((item) => item.title)
      };
    })
  };
}

export function planAnalysisPath({ agents = [], gemId = null, routeReasons = {}, routeMatched = true, question = "", declaredFacts = {} } = {}) {
  // Triage before planning: a lane the procedure does not reach for is never put
  // on the board, rather than put there and then explained away.
  const gates = triage({ question, facts: declaredFacts });
  // A lookup is its own lane and never runs alongside the review lanes: the
  // question asks for a stored value, so there is no transaction to review and
  // no closing decision to route to a person.
  if (agents.length === 1 && ["lookup", "briefing", "memo"].includes(agents[0])) return laneOnly(agents[0]);

  const routed = ["trade", "product", "tpdd"].filter((lane) => agents.includes(lane));
  const kept = routed.filter((lane) => !gates.droppedLanes.includes(lane));
  // Triage narrows a review; it does not abolish one. If closing a gate would
  // leave nothing to analyse, the question was routed on that lane alone and the
  // honest response is to run it, not to answer with an empty path.
  const order = kept.length ? kept : routed;
  const lead = GEM_LEAD_LANE[gemId];
  if (lead && order.includes(lead)) order.splice(order.indexOf(lead), 1), order.unshift(lead);

  const lanes = [...order, "review"].map((lane) => ({
    lane,
    label: LANE_PLANS[lane].label,
    leading: lane === lead,
    methodology: LANE_PLANS[lane].methodology,
    steps: LANE_PLANS[lane].steps.map(([id, title, inputs, source]) => ({
      id, title, status: "pending", basis: [], needs: [],
      inputs: inputs ? [].concat(inputs) : [],
      // Where this step comes from. A step without a provision says so.
      cite: source?.cite || null,
      citeNote: source?.note || null,
      methodology: source?.methodology || LANE_PLANS[lane].methodology
    }))
  }));
  // The methodologies actually in play, so the interface can show the path's
  // own basis instead of asking the reader to take it on trust.
  const used = [...new Set(lanes.flatMap((group) => group.steps.map((item) => item.methodology)))];
  return {
    lanes,
    summary: summarize(lanes),
    planned: true,
    basis: used.map((id) => METHODOLOGIES[id]).filter(Boolean)
      .sort((left, right) => (left.kind === "official" ? 0 : 1) - (right.kind === "official" ? 0 : 1)),
    followsOfficial: used.some((id) => METHODOLOGIES[id]?.kind === "official"),
    // What triage closed, and on what. A path shorter than the published
    // procedure has to say which rule allowed each omission.
    triage: gates.applied,
    // How this path came to exist. "Why these steps, in this order" is a fair
    // question of any compliance conclusion, and the answer is checkable: which
    // words in the question selected the check, which published procedure supplies
    // its steps, and which steps had no provision and were planned here instead.
    derivation: lanes.map((group) => {
      const official = group.steps.filter((item) => METHODOLOGIES[item.methodology]?.kind === "official");
      return {
        lane: group.lane,
        label: group.label,
        leading: group.leading,
        matchedBy: group.lane === "review" ? "always" : group.leading ? "gem" : routeMatched && routeReasons[group.lane]?.length ? "question_terms" : "no_term_matched_all_lanes_run",
        matchedTerms: routeReasons[group.lane] || [],
        methodology: METHODOLOGIES[group.methodology] || null,
        stepCount: group.steps.length,
        officialStepCount: official.length,
        // Steps the system added because the procedure has no equivalent. Named
        // so they are never mistaken for a cited requirement.
        plannedStepCount: group.steps.length - official.length,
        plannedSteps: group.steps.filter((item) => METHODOLOGIES[item.methodology]?.kind !== "official").map((item) => item.title)
      };
    }),
    gemId
  };
}

function summarize(lanes) {
  const all = lanes.flatMap((group) => group.steps);
  return {
    total: all.length,
    pending: all.filter((item) => item.status === "pending").length,
    confirmed: all.filter((item) => item.status === "confirmed").length,
    declared: all.filter((item) => item.status === "declared").length,
    evidenceNeeded: all.filter((item) => item.status === "evidence_needed").length,
    notReached: all.filter((item) => item.status === "not_reached").length,
    notApplicable: all.filter((item) => item.status === "not_applicable").length
  };
}

const CONTROL_CODE = /\b\d[A-E]\d{3}(?:\.[a-z0-9]+)*/i;
const PART_NUMBER = /\b[A-Z]{2}-\d{4}-[A-Z0-9]{2}\b/;
const LEGAL_SUFFIX = /(co\.?,?\s*ltd|corporation|corp\.?|inc\.?|gmbh|s\.?a\.?r\.?l|pte\.?\s*ltd|b\.?v\.?|a\.?s\.?|有限公司|股份有限公司|集团)/i;
const PERCENT = /\d+(?:\.\d+)?\s*%/;

function step(id, title, status, { basis = [], needs = [] } = {}) {
  return { id, title, status, basis, needs };
}

// Missing-information lines the specialists produced, filtered to the ones that
// plausibly belong to a given step. The agents already say what they lack; this
// routes those statements to the step they block rather than inventing new ones.
function needsMatching(results, agent, pattern) {
  const seen = new Set();
  for (const result of results || []) {
    if (agent && result.agent !== agent) continue;
    for (const item of result.missingInfo || []) {
      const text = String(item).trim();
      if (text && pattern.test(text) && !seen.has(text)) seen.add(text);
    }
  }
  return [...seen].slice(0, 4);
}

// A lookup reports what was searched and what came back. When nothing came back
// that is a finding, not a gap in the reader's information: they are told which
// records were read and where the answer actually lives, rather than being asked
// for something they came here to be told.
function lookupSteps(grounding) {
  const lookup = grounding.lookup;
  if (!lookup) return [step("data_lookup", "在已接入数据中检索", "not_reached", {})];
  const searched = [
    ...lookup.searched.map((source) => `已检索 ${source.label}`),
    ...(lookup.unavailable || []).map((source) => `未检索 ${source.label}（该来源未同步）`)
  ];
  if (lookup.found.length) {
    return [step("data_lookup", "在已接入数据中检索", "confirmed", {
      basis: [
        ...lookup.found.map((item) => `${item.subject}：${item.field} ${item.value}${item.synthetic ? "（合成演示数据）" : ""}`),
        ...searched
      ]
    })];
  }
  // Absent from the data is a finding, not an outstanding item. Reporting it as
  // evidence_needed made a completed search read as an unfinished analysis with
  // something for the reader to supply — there is nothing they can supply; the
  // records simply do not contain it.
  return [step("data_lookup", "在已接入数据中检索", "confirmed", {
    basis: [
      `${lookup.asked.join("、")} 不在已接入的数据中；未收录不等于不受管制`,
      ...searched,
      lookup.elsewhere
    ]
  })];
}

// A briefing reports what it read and over what window, because a summary whose
// window is unstated cannot be checked and a summary of sources that were not
// synced is a summary of nothing.
function briefingSteps(grounding) {
  const brief = grounding.briefing;
  if (!brief) return [step("notice_timeline", "按时间顺序汇总已发布公告", "not_reached", {})];
  const basis = [
    bi(`窗口：${brief.window.since} 起至今（${brief.window.days} 天，${brief.window.stated ? "取自问题" : "默认，问题未指定"}）`,
      `Window: ${brief.window.since} to today (${brief.window.days} days, ${brief.window.stated ? "taken from the question" : "default; none was stated"})`),
    ...brief.searched.map((source) => bi(
      `已检索 ${source.label}（${source.recordCount} 条${source.fallback ? "，时点副本" : ""}）`,
      `Read ${source.sourceId} (${source.recordCount} records${source.fallback ? ", committed copy" : ""})`)),
    ...brief.unavailable.map((source) => bi(
      `未检索 ${source.label}（该来源未同步）`, `Not read: ${source.sourceId} (not synced)`))
  ];
  if (!brief.items.length) {
    return [step("notice_timeline", "按时间顺序汇总已发布公告", "confirmed",
      { basis: [...basis, bi("该窗口内没有已收录的公告；这不代表期间没有发布，只代表已同步的来源里没有",
        "No ingested notice falls in this window. That is not the same as nothing having been published — only that the synced sources hold none.")] })];
  }
  return [step("notice_timeline", "按时间顺序汇总已发布公告", "confirmed",
    { basis: [bi(`共 ${brief.items.length} 项变化`, `${brief.items.length} changes`), ...basis] })];
}

// A memo does not analyse; it writes up what was analysed. With nothing to write
// up it says so rather than producing an empty document.
function memoSteps(grounding) {
  const turns = grounding.memo?.turns || 0;
  if (!turns) {
    return [step("case_writeup", "整理本会话已产出的结论与证据", "evidence_needed",
      { needs: ["本会话尚无已完成的分析可供整理；请先提交一个情景完成审查，再生成备忘录"] })];
  }
  return [step("case_writeup", "整理本会话已产出的结论与证据", "confirmed",
    { basis: [bi(`已整理本会话 ${turns} 轮分析`, `Assembled from ${turns} prior turns in this session`),
      "备忘录记录既有结论与证据，不产生新的判断"] })];
}

function tradeSteps(question, grounding, results, declaredFacts = {}) {
  const steps = [];
  const screened = grounding.screening?.screenedSources || [];
  const unsynced = grounding.screening?.unsyncedSources || [];
  const matches = grounding.listMatches || [];
  const internal = (grounding.internalParties || []).flatMap((entry) => entry.internalMatches || []);

  // The party step resolves from the corpus before it resorts to asking.
  //
  // It used to settle only when the question carried a legal suffix, so
  // "客户 Aveox Technologies" stopped the whole run to ask for a name the
  // system could already find — and typing it changed nothing anyone could see.
  // Candidates carry their score and the name they matched on, and where there
  // is more than one, both go forward: which of them it is belongs to identity
  // resolution, on registration number and address, not to a similarity number.
  const candidates = grounding.partyCandidates || [];
  const namedEntity = LEGAL_SUFFIX.test(question);
  steps.push(step("identify_party", "确定交易主体的法律实体",
    candidates.length || namedEntity ? "confirmed" : "evidence_needed",
    candidates.length
      ? {
        basis: [
          ...candidates.map((candidate) => bi(
            `候选主体：${candidate.entityName}（${candidate.sourceId}，匹配于「${candidate.matchedName}」，相似度 ${candidate.matchScore}）`,
            `Candidate: ${candidate.entityName} (${candidate.sourceId}, matched on "${candidate.matchedName}", score ${candidate.matchScore})`)),
          candidates.length > 1
            ? bi(`问题中的名称对应多个候选，取最相近的 ${candidates.length} 个继续后续步骤`,
              `The name matches more than one entity; the ${candidates.length} closest go forward`)
            : bi("问题中的名称在已同步来源中检索到一个候选", "One candidate was found in the synced sources"),
          "名称相似不等于同一主体：下一步按注册号、国别和地址逐项比对"
        ]
      }
      : namedEntity
        ? { basis: ["问题中提供了带法律后缀的实体名称"] }
        : { needs: ["法律实体全称（含注册后缀）", ...needsMatching(results, "trade", /实体|名称|地址|注册/)] }));

  steps.push(step("search_lists", "检索受限方名单",
    screened.length ? "confirmed" : "evidence_needed",
    screened.length
      ? {
        basis: screened.map((source) => {
          const count = Number(source.recordCount).toLocaleString();
          const at = String(source.capturedAt).slice(0, 10);
          const copy = source.provenance === "bundled_fallback_snapshot";
          return bi(`${source.sourceId}：${count} 条，采集于 ${at}${copy ? "（时点副本）" : ""}`,
            `${source.sourceId}: ${count} records, captured ${at}${copy ? " (committed copy)" : ""}`);
        }),
        needs: unsynced.length
          ? [bi(`以下来源未同步，本次未检索：${unsynced.join("、")}`,
            `Not searched because they are not synced: ${unsynced.join(", ")}`)]
          : []
      }
      : { needs: [bi("尚无已同步的受限方名单来源，需先完成同步", "No restricted-party list is synced yet; sync one first")] }));

  // What a match means depends on the item: § 744.11 attaches to items subject
  // to the EAR, so a designated party and an item outside the EAR's reach is a
  // different finding from a designated party and an item inside it. That is the
  // product lane's question, so it is asked rather than assumed.
  const jurisdiction = matches.length
    ? invokeCapability("product.item_jurisdiction", { caller: "name_match", context: { grounding, facts: declaredFacts } })
    : null;

  if (!screened.length) {
    steps.push(step("name_match", "名称匹配", "not_reached", { needs: ["名单来源同步后方可进行"] }));
  } else {
    steps.push(step("name_match", "名称匹配",
      "confirmed",
      matches.length
        ? { basis: matches.slice(0, 3).map((match) => {
          const name = match.entityName || match.matchedName;
          const identical = match.matchBasis === "normalized_name_identical";
          const notice = match.noticeNumber ? `，${match.noticeNumber}` : "";
          const noticeEn = match.noticeNumber ? `, ${match.noticeNumber}` : "";
          return bi(`${name}：相似度 ${match.matchScore}，${identical ? "规范化后名称完全一致" : match.matchBasis}${notice}`,
            `${name}: score ${match.matchScore}, ${identical ? "identical after normalisation" : match.matchBasis}${noticeEn}`);
        }).concat(jurisdiction ? [jurisdiction.line] : []) }
        : { basis: [(() => {
          const total = screened.reduce((n, s) => n + s.recordCount, 0).toLocaleString();
          return bi(`在已同步来源中未发现名称命中（共检索 ${total} 条）`,
            `No name matched in the synced sources (${total} records searched)`);
        })()] }));
  }

  if (!matches.length && candidates.length) {
    // Nothing was screened as a designated name, but the party step did resolve
    // candidates — so there is something to disambiguate after all, and saying
    // "not applicable" here would drop what the previous step just found.
    steps.push(step("identity_resolution", "身份要素消歧", "evidence_needed",
      {
        basis: candidates.map((candidate) => bi(`待消歧：${candidate.entityName}（${candidate.sourceId}）`,
          `To disambiguate: ${candidate.entityName} (${candidate.sourceId})`)),
        needs: [bi(`需提供该主体的注册国别、注册号和注册地址，以在 ${candidates.length} 个候选之间做出区分`,
          `Country of registration, registration number and address, to tell the ${candidates.length} candidates apart`)]
      }));
  } else if (!matches.length) {
    // Nothing matched, so there is nothing to disambiguate. That is a step with no
    // work in it, not a step waiting on earlier work — counting it as outstanding
    // made a finished analysis read as one that had stopped short.
    steps.push(step("identity_resolution", "身份要素消歧", "not_applicable", { basis: ["无名称命中，本步骤不适用"] }));
  } else if (!internal.length) {
    steps.push(step("identity_resolution", "身份要素消歧", "evidence_needed",
      { needs: ["需提供该主体的注册国别、注册号和注册地址，才能与名单条目逐项比对"] }));
  } else {
    // A comparison only settles the step if every element was actually
    // comparable. An element with no value on either side proves nothing.
    const unavailable = internal.flatMap((item) => (item.identityComparisons || []).filter((row) => row.status === "unavailable"));
    const decided = internal.filter((item) => item.matchDisposition && item.matchDisposition !== "below_review_threshold");
    const label = { country: "注册国别", registration_number: "注册号", address: "注册地址" };
    const labelEn = { country: "country of registration", registration_number: "registration number", address: "registered address" };
    steps.push(step("identity_resolution", "身份要素消歧",
      unavailable.length ? "evidence_needed" : "confirmed",
      {
        basis: decided.map((item) => {
          const rows = (item.identityComparisons || []).filter((row) => row.status !== "unavailable");
          const zh = rows.map((row) => `${label[row.element] || row.element}${row.status === "conflict" ? "冲突" : "一致"}`).join("、");
          const en = rows.map((row) => `${labelEn[row.element] || row.element} ${row.status === "conflict" ? "conflicts" : "agrees"}`).join(", ");
          const entry = item.designatedEntity || null;
          return bi(`${item.entityName} vs ${entry || "名单条目"}：${zh || "无可比要素"}`,
            `${item.entityName} vs ${entry || "the list entry"}: ${en || "no comparable elements"}`);
        }),
        needs: [...new Map(unavailable.map((row) => [row.element, bi(
          `${label[row.element] || row.element}（双方之一缺失，无法比对）`,
          `${labelEn[row.element] || row.element} (missing on one side, so no comparison is possible)`)])).values()]
      }));
  }

  // Ownership is never settled from a name list. Saying so explicitly is the
  // point: a clean name check is routinely mistaken for a clean party.
  //
  // The register does answer half of it. GLEIF publishes the accounting
  // consolidating parent of every LEI that declared one, so "who sits above this
  // company" no longer has to be typed — but it publishes no percentages, and
  // the 50 Percent Rule is about percentages. So the chain is reported as what
  // it is, and where a designated name is in play the aggregate still has to be
  // established by someone.
  const chain = grounding.ownership;
  const chainFound = chain?.subject && (chain.directParent || chain.ultimateParent);
  const chainLines = chainFound
    ? [
      bi(`GLEIF 登记主体：${chain.subject.name}（LEI ${chain.subject.lei}${chain.subject.country ? `，${chain.subject.country}` : ""}）`,
        `GLEIF record: ${chain.subject.name} (LEI ${chain.subject.lei}${chain.subject.country ? `, ${chain.subject.country}` : ""})`),
      chain.directParent
        ? bi(`直接母公司：${chain.directParent.name}（LEI ${chain.directParent.lei}）`,
          `Direct parent: ${chain.directParent.name} (LEI ${chain.directParent.lei})`)
        : bi("该实体未申报直接母公司", "The entity has declared no direct parent"),
      chain.ultimateParent
        ? bi(`最终母公司：${chain.ultimateParent.name}（LEI ${chain.ultimateParent.lei}）`,
          `Ultimate parent: ${chain.ultimateParent.name} (LEI ${chain.ultimateParent.lei})`)
        : bi("该实体未申报最终母公司", "The entity has declared no ultimate parent"),
      bi(chain.meaning, "GLEIF's parent is the accounting consolidating parent, self-declared and LOU-validated. It carries no shareholding percentage, and the 50 Percent Rule turns on percentages — so the chain is a lead, not a conclusion.")
    ]
    : [];

  if (chainFound && !matches.length) {
    // A chain from the register, and no designated name anywhere in the case.
    // Nothing here is decided by a percentage nobody has, so the step reports the
    // chain and says what it does not establish rather than demanding a
    // structure the user would be copying out of the same register.
    steps.push(step("ownership", "所有权穿透（OFAC 50% 聚合）", "confirmed",
      { basis: [...chainLines, "本次未命中任何受限方名单，因此不存在需要计算合计持股的被列名主体"] }));
  } else {
    steps.push(step("ownership", "所有权穿透（OFAC 50% 聚合）", "evidence_needed", {
      basis: chainLines,
      needs: [
        chainFound
          ? bi("名单存在潜在命中，需按 OFAC 50% 规则计算被列名主体的直接与间接合计持股；GLEIF 不公布持股比例",
            "A list matched, so the designated party's direct and indirect holdings must be aggregated under the 50 Percent Rule; GLEIF publishes no percentages")
          : "完整股权结构与受益所有权证据；名单检索不解决间接或合计持股",
        ...(chain?.noConfidentMatch ? [(() => {
          const rejected = chain.rejected.map((item) => item.name).slice(0, 2);
          return bi(`GLEIF 中未找到与该名称完全一致的登记实体（返回但未采信：${rejected.join("、")}）`,
            `No GLEIF record matches this name exactly (returned but not used: ${rejected.join(", ")})`);
        })()] : []),
        ...(chain?.notInRegister ? ["该名称在 GLEIF 中无登记记录；未持有 LEI 的实体需另行取得股权证据"] : []),
        ...needsMatching(results, null, /ubo|受益所有|股权|所有权|持股/i)
      ]
    }));
  }

  // A step that exists because an earlier one found something. Placed after
  // ownership, because that is what produced the name it screens.
  const parentScreening = grounding.parentScreening || [];
  if (parentScreening.length) {
    const hits = parentScreening.flatMap((entry) => entry.hits.map((hit) => ({ ...hit, parent: entry.parent })));
    const sourceCount = parentScreening[0]?.screened?.length || 0;
    steps.push(step("parent_screening", "母公司名单筛查",
      hits.length ? "evidence_needed" : "confirmed",
      hits.length
        ? {
          basis: hits.map((hit) => bi(
            `${hit.parent.name} 在 ${hit.sourceId} 中潜在命中「${hit.entityName}」（相似度 ${hit.matchScore}）`,
            `${hit.parent.name} draws a potential match on "${hit.entityName}" in ${hit.sourceId} (score ${hit.matchScore})`)),
          needs: [bi("需按 OFAC 50% 规则计算该母公司对本交易方的直接与间接合计持股",
            "The parent's direct and indirect holding in this counterparty has to be aggregated under the 50 Percent Rule")]
        }
        : {
          basis: parentScreening.map((entry) => bi(
            `${entry.parent.name}：在 ${sourceCount} 个已同步名单中未发现命中`,
            `${entry.parent.name}: no match across ${sourceCount} synced lists`))
        }));
  }

  return steps;
}

function productSteps(question, grounding, results, declaredFacts = {}) {
  const steps = [];
  const facts = grounding.facts || [];
  const classificationFacts = facts.filter((fact) => /eccn|tpp|管制编码|分类/i.test(fact.fact || ""));
  const hasPartNumber = PART_NUMBER.test(question) || /part\s*number|型号/i.test(question);
  const hasCode = CONTROL_CODE.test(question);

  steps.push(step("identify_item", "确定物项（准确型号或 part number）",
    hasPartNumber || hasCode ? "confirmed" : "evidence_needed",
    hasPartNumber || hasCode
      ? { basis: [hasCode ? "问题中给出了管制编码" : "问题中给出了型号或 part number"] }
      : { needs: ["准确型号或 part number；产品系列名无法定位管制条目", ...needsMatching(results, "product", /型号|part|参数|规格/i)] }));

  // Official order: scope of the EAR before classification.
  const hasContent = PERCENT.test(question) && /美国|us|含量|content|de\s*minimis/i.test(question);
  steps.push(step("jurisdiction", "是否受 EAR 管辖（de minimis / 外国直接产品）",
    hasContent ? "confirmed" : "evidence_needed",
    hasContent
      ? { basis: ["问题中给出了受控美国原产内容占比"] }
      : { needs: ["受控美国原产内容的价值占比，以及是否使用美国技术或软件（FDP）", ...needsMatching(results, "product", /原产|含量|管辖|de\s*minimis/i)] }));

  steps.push(step("classify", "分类（ECCN）",
    classificationFacts.length ? "confirmed" : "evidence_needed",
    classificationFacts.length
      ? { basis: classificationFacts.slice(0, 3).map((fact) => `${fact.sourceId}${fact.noticeNumber ? `（${fact.noticeNumber}）` : ""}：${String(fact.fact).slice(0, 90)}`) }
      : { needs: ["关键技术参数与厂商分类信息", ...needsMatching(results, "product", /参数|分类|eccn|编码/i)] }));

  const classified = classificationFacts.length > 0;
  const hasDestination = /目的地|出口到|运往|destination|export to|ship to/i.test(question);
  steps.push(step("destination_chart", "目的地与管制理由（Country Chart）",
    !classified ? "not_reached" : hasDestination ? "evidence_needed" : "evidence_needed",
    !classified
      ? { needs: ["分类成立后方可查 Country Chart"] }
      : { needs: ["最终目的地，以及该 ECCN 的管制理由在 Country Chart 上对应的单元", ...needsMatching(results, "product", /目的地|国别|矩阵/i)] }));

  steps.push(step("prohibitions", "十项一般禁令（最终用户、最终用途、禁运、知情）", "evidence_needed",
    { needs: ["最终用户、最终用途与实际交易链；General Prohibitions 需逐项过", ...needsMatching(results, "product", /最终用户|最终用途|用途|禁令/i)] }));

  // The one place this lane cannot answer for itself. Whether a Part 740
  // exception survives is decided by who the counterparty is, which is the trade
  // lane's question — so it is asked, and the answer is recorded with the lane
  // that gave it. Until now the dependency graph could only state this rule;
  // nothing enforced it, and the step went on saying "awaiting an earlier step"
  // while a designated party sat in the same answer.
  const exceptions = licenceExceptionOutcome({ grounding, facts: declaredFacts });
  steps.push(step("licence_exception", "许可例外", exceptions.status || "not_reached",
    exceptions.status
      ? { basis: exceptions.basis, needs: exceptions.needs }
      : { basis: exceptions.basis, needs: ["管辖、分类与国别矩阵成立后方可判断是否有可用的 License Exception"] }));

  return steps;
}

function tpddSteps(question, grounding, results) {
  // Ordered as the DOJ states it: business rationale first, then diligence,
  // then the payment mechanism, then monitoring across the relationship.
  const rules = [
    ["rationale_fees", "商业合理性、服务范围与费用", /费用|佣金|成功费|折扣|返点|服务|交付|合理性/i],
    ["legal_existence", "主体存续与注册信息", /注册|执照|存续|营业|登记/i],
    ["beneficial_ownership", "受益所有权", /ubo|受益所有|股东|股权/i],
    ["payment_path", "收款主体与付款路径", /付款|收款|账户|汇款|payment/i],
    ["ongoing_monitoring", "持续监控与再评估", /监控|复审|再评估|定期|monitor/i]
  ];
  return rules.map(([id, title, pattern]) => {
    const needs = needsMatching(results, "tpdd", pattern);
    return step(id, title, "evidence_needed",
      { needs: needs.length ? needs : [id === "ongoing_monitoring" ? "尚未设定复审周期与触发条件" : "需取得对应证明文件"] });
  });
}

// Resolves a plan against whatever evidence exists so far. Called more than
// once during a run: after grounding, the screening steps can close; after the
// specialists report, their statements of what they lack fill the rest. A step
// with nothing yet to decide it stays pending rather than being guessed at.
export function resolveAnalysisPath(plan, { question, grounding, results = [], declaredFacts = {}, templated = false, final = false }) {
  const resolvers = {
    trade: () => tradeSteps(question, grounding, results, declaredFacts),
    product: () => productSteps(question, grounding, results, declaredFacts),
    tpdd: () => tpddSteps(question, grounding, results),
    lookup: () => lookupSteps(grounding),
    briefing: () => briefingSteps(grounding),
    memo: () => memoSteps(grounding),
    review: () => [step("human_review", "Compliance / Legal 人工复核", "review_required",
      { needs: ["以上步骤的结论与证据需经人工确认；系统不做交易放行"] })]
  };

  // Step-level triage. A step the procedure does not reach for is marked as not
  // arising, with the fact and the provision that closed it — never silently
  // dropped, and never on a guess: a gate that cannot decide leaves the step
  // standing.
  const gates = triage({ question, facts: declaredFacts });

  // The specialists run one at a time, so a lane can close as soon as its own
  // specialist has reported rather than waiting for the whole run. The closing
  // step is different: it summarizes every lane, so it stays until the end.
  const reported = new Set(results.map((result) => result.agent));
  const lanes = plan.lanes.map((group) => {
    if (!final && group.lane === "review") return group;
    // TPDD reads the specialist's own findings, so before it reports there is
    // nothing honest to say about that lane.
    if (!final && group.lane === "tpdd" && !reported.has("tpdd")) return group;
    const resolved = new Map(resolvers[group.lane]().map((item) => [item.id, item]));
    return {
      ...group,
      // A resolver may add a step the plan did not have: a dependency fired and
      // put it there. Those are appended rather than dropped for not matching a
      // planned id.
      steps: [...group.steps.map((planned) => {
        const item = resolved.get(planned.id);
        if (!item) return planned;
        // Provenance belongs to the plan. Resolution decides status only, so the
        // citation must survive it rather than being rebuilt by each resolver.
        const keep = { inputs: planned.inputs || [], cite: planned.cite, citeNote: planned.citeNote, methodology: planned.methodology };
        // A step appended by a dependency has no inputs, and the path is resolved
        // more than once — so on the second pass that step arrives here as a
        // planned one. Nothing may assume the plan's shape.
        const answered = (planned.inputs || []).filter((input) => String(declaredFacts[input.field] || "").trim());
        // A declaration moves a blocked step forward but never to settled: the
        // value came from the person asking, and nobody has checked it.
        if (item.status === "evidence_needed" && answered.length) {
          return {
            ...item,
            ...keep,
            status: "declared",
            // The label is a fixed term and the value is the user's own words, so
            // the line is written in both languages here rather than translated
            // afterwards — the value passes through untouched either way.
            basis: [...item.basis, ...answered.map((input) => bi(
              `${input.label}：${declaredFacts[input.field]}（用户声明，未核验）`,
              `${translateTerm(input.label, "en")}: ${declaredFacts[input.field]} (declared by the user, unverified)`))],
            // A need can be a bilingual pair rather than a string — matching on
            // the Chinese side, because the input labels this compares against
            // are written there. Assuming a string threw, and the whole analysis
            // failed the moment a declaration answered a step with a paired need.
            needs: item.needs.filter((need) => !answered.some((input) =>
              localizeLine(need, "zh").includes(input.label.split(" / ")[0])))
          };
        }
        const gated = gates.droppedSteps.get(item.id);
        if (gated && item.status !== "confirmed" && item.status !== "declared") {
          // Both halves of this line are written in two languages, so the line
          // is assembled per language rather than concatenated once — including
          // its own wrapper word, which was Chinese whatever the reader had set.
          return { ...item, ...keep, status: "not_applicable", needs: [],
            basis: [bi(`${localizeLine(gated.because, "zh")}（依据 ${localizeLine(gated.cite, "zh")}）`,
              `${localizeLine(gated.because, "en")} (under ${localizeLine(gated.cite, "en")})`)] };
        }
        return { ...item, ...keep };
      }), ...[...resolved.values()]
        .filter((item) => !group.steps.some((planned) => planned.id === item.id))
        .map((item) => ({ inputs: [], ...item }))]
    };
  });

  // Why a triggered step is on the board. Held on the path so the interface can
  // say "this is here because ownership found a parent" instead of presenting it
  // as though it had always been part of the procedure.
  const triggered = triggeredDependencies(grounding);
  return { ...plan, lanes, summary: summarize(lanes), planned: false, templated, final, triggered };
}

// One action list, ordered by the path's own dependencies.
//
// Recommended actions and a separate "next step" said the same thing twice and
// left the reader deciding which to trust. The path already knows what blocks
// what, so the actions are derived from it: each one names the step it unblocks,
// and they come in the order the steps have to close. Whatever the specialists
// suggested that does not map onto a step is kept at the end rather than
// dropped.
// Built from the localized path, deliberately. Every action here is a step's own
// "needs" line restated as something to do, and those lines exist in two
// languages: reading the raw path put Chinese needs — and, where a need was a
// bilingual pair rather than a string, the text "[object Object]" — into an
// English action list.
export function buildActionPlan(path, results = [], locale = "zh") {
  const actions = [];
  const claimed = new Set();

  // One action can unblock several steps — "registration documents and a UBO
  // declaration" closes both the existence check and the beneficial-ownership
  // check. Recording every step it unblocks is what lets the same evidence be
  // listed once without any step losing its entry: dropping the repeat outright
  // is what left six blocked steps with nothing to do about them.
  const byNeed = new Map();
  for (const lane of path?.lanes || []) {
    for (const item of lane.steps) {
      if (item.status === "declared") {
        actions.push({
          action: locale === "en"
            ? `Verify what the user declared: ${item.inputs.map((input) => input.label).join(", ")}`
            : `核验用户声明的信息：${item.inputs.map((input) => input.label).join("、")}`,
          unblocks: [item.title], lane: lane.lane, kind: "verify"
        });
        continue;
      }
      if (item.status !== "evidence_needed") continue;
      for (const need of item.needs) {
        const text = String(need).trim();
        if (!text) continue;
        const existing = byNeed.get(text);
        if (existing) { if (!existing.unblocks.includes(item.title)) existing.unblocks.push(item.title); continue; }
        claimed.add(text);
        const action = { action: text, unblocks: [item.title], lane: lane.lane, kind: "unblock" };
        byNeed.set(text, action);
        actions.push(action);
      }
    }
  }

  // Steps waiting only on an earlier step are not actions; they are the
  // consequence of the actions above, and saying so prevents them reading as
  // forgotten work.
  const blocked = (path?.lanes || []).flatMap((lane) => lane.steps)
    .filter((item) => item.status === "not_reached")
    .map((item) => item.title);

  const suggested = [];
  for (const result of results) {
    for (const item of result.recommendedActions || []) {
      const text = String(item).trim().replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "");
      // Only keep a suggestion that is not already covered by an unblocking
      // action, so the list does not repeat itself.
      if (!text || claimed.has(text) || suggested.includes(text)) continue;
      if ([...claimed].some((need) => need.includes(text) || text.includes(need))) continue;
      suggested.push(text);
    }
  }

  const review = (path?.lanes || []).flatMap((lane) => lane.steps).find((item) => item.status === "review_required");
  // Capped, but never silently: a list that shows 8 of 12 while the flow rail
  // shows 11 blocked steps reads as the two disagreeing, when in fact the list
  // had quietly thrown work away.
  const CAP = 20;
  return {
    actions: actions.slice(0, CAP),
    omittedActions: Math.max(0, actions.length - CAP),
    suggested: suggested.slice(0, 5),
    blocked: blocked.slice(0, 6),
    closing: review ? review.title : null
  };
}

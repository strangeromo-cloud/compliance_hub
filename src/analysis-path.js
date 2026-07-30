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
//   review_required  only a person can close this
//
// Statuses are never taken from the model's own account of its work. A model
// asked whether a step is confirmed will say yes; "confirmed" here has to mean
// something a reviewer can check.


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
  review: {
    label: "结案",
    methodology: "derived",
    steps: [["human_review", "Compliance / Legal 人工复核", null,
      { cite: "本系统边界", methodology: "derived", note: "系统不做交易放行" }]]
  }
};

// A gem states which lane its question is really about, so the plan leads with
// it instead of always presenting the lanes in a fixed order.
const GEM_LEAD_LANE = {
  "screen-party": "trade",
  eccn: "product",
  "cn-dual-use": "product",
  "de-minimis": "product",
  licence: "product",
  tpdd: "tpdd",
  "reg-brief": "trade",
  "case-memo": "review"
};

export function planAnalysisPath({ agents = [], gemId = null, routeReasons = {}, routeMatched = true } = {}) {
  const order = ["trade", "product", "tpdd"].filter((lane) => agents.includes(lane));
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
    notReached: all.filter((item) => item.status === "not_reached").length
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

function tradeSteps(question, grounding, results) {
  const steps = [];
  const screened = grounding.screening?.screenedSources || [];
  const unsynced = grounding.screening?.unsyncedSources || [];
  const matches = grounding.listMatches || [];
  const internal = (grounding.internalParties || []).flatMap((entry) => entry.internalMatches || []);

  const namedEntity = LEGAL_SUFFIX.test(question);
  steps.push(step("identify_party", "确定交易主体的法律实体",
    namedEntity ? "confirmed" : "evidence_needed",
    namedEntity
      ? { basis: ["问题中提供了带法律后缀的实体名称"] }
      : { needs: ["法律实体全称（含注册后缀）", ...needsMatching(results, "trade", /实体|名称|地址|注册/)] }));

  steps.push(step("search_lists", "检索受限方名单",
    screened.length ? "confirmed" : "evidence_needed",
    screened.length
      ? {
        basis: screened.map((source) => `${source.sourceId}：${Number(source.recordCount).toLocaleString()} 条，采集于 ${String(source.capturedAt).slice(0, 10)}${source.provenance === "bundled_fallback_snapshot" ? "（时点副本）" : ""}`),
        needs: unsynced.length ? [`以下来源未同步，本次未检索：${unsynced.join("、")}`] : []
      }
      : { needs: ["尚无已同步的受限方名单来源，需先完成同步"] }));

  if (!screened.length) {
    steps.push(step("name_match", "名称匹配", "not_reached", { needs: ["名单来源同步后方可进行"] }));
  } else {
    steps.push(step("name_match", "名称匹配",
      "confirmed",
      matches.length
        ? { basis: matches.slice(0, 3).map((match) => `${match.entityName || match.matchedName}：相似度 ${match.matchScore}，${match.matchBasis === "normalized_name_identical" ? "规范化后名称完全一致" : match.matchBasis}${match.noticeNumber ? `，${match.noticeNumber}` : ""}`) }
        : { basis: [`在已同步来源中未发现名称命中（共检索 ${screened.reduce((n, s) => n + s.recordCount, 0).toLocaleString()} 条）`] }));
  }

  if (!matches.length) {
    steps.push(step("identity_resolution", "身份要素消歧", "not_reached", { needs: ["无名称命中，无需消歧"] }));
  } else if (!internal.length) {
    steps.push(step("identity_resolution", "身份要素消歧", "evidence_needed",
      { needs: ["需提供该主体的注册国别、注册号和注册地址，才能与名单条目逐项比对"] }));
  } else {
    // A comparison only settles the step if every element was actually
    // comparable. An element with no value on either side proves nothing.
    const unavailable = internal.flatMap((item) => (item.identityComparisons || []).filter((row) => row.status === "unavailable"));
    const decided = internal.filter((item) => item.matchDisposition && item.matchDisposition !== "below_review_threshold");
    const label = { country: "注册国别", registration_number: "注册号", address: "注册地址" };
    steps.push(step("identity_resolution", "身份要素消歧",
      unavailable.length ? "evidence_needed" : "confirmed",
      {
        basis: decided.map((item) => {
          const compared = (item.identityComparisons || []).filter((row) => row.status !== "unavailable")
            .map((row) => `${label[row.element] || row.element}${row.status === "conflict" ? "冲突" : "一致"}`).join("、");
          return `${item.entityName} vs ${item.designatedEntity || "名单条目"}：${compared || "无可比要素"}`;
        }),
        needs: [...new Set(unavailable.map((row) => `${label[row.element] || row.element}（双方之一缺失，无法比对）`))]
      }));
  }

  // Ownership is never settled from a name list. Saying so explicitly is the
  // point: a clean name check is routinely mistaken for a clean party.
  steps.push(step("ownership", "所有权穿透（OFAC 50% 聚合）", "evidence_needed",
    { needs: ["完整股权结构与受益所有权证据；名单检索不解决间接或合计持股", ...needsMatching(results, null, /ubo|受益所有|股权|所有权|持股/i)] }));

  return steps;
}

function productSteps(question, grounding, results) {
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

  steps.push(step("licence_exception", "许可例外", "not_reached",
    { needs: ["管辖、分类与国别矩阵成立后方可判断是否有可用的 License Exception"] }));

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
    trade: () => tradeSteps(question, grounding, results),
    product: () => productSteps(question, grounding, results),
    tpdd: () => tpddSteps(question, grounding, results),
    review: () => [step("human_review", "Compliance / Legal 人工复核", "review_required",
      { needs: ["以上步骤的结论与证据需经人工确认；系统不做交易放行"] })]
  };

  const lanes = plan.lanes.map((group) => {
    // TPDD and the closing step depend on the specialists, so before they
    // report there is nothing honest to say about them.
    if (!final && (group.lane === "tpdd" || group.lane === "review")) return group;
    const resolved = new Map(resolvers[group.lane]().map((item) => [item.id, item]));
    return {
      ...group,
      steps: group.steps.map((planned) => {
        const item = resolved.get(planned.id);
        if (!item) return planned;
        // Provenance belongs to the plan. Resolution decides status only, so the
        // citation must survive it rather than being rebuilt by each resolver.
        const keep = { inputs: planned.inputs, cite: planned.cite, citeNote: planned.citeNote, methodology: planned.methodology };
        const answered = planned.inputs.filter((input) => String(declaredFacts[input.field] || "").trim());
        // A declaration moves a blocked step forward but never to settled: the
        // value came from the person asking, and nobody has checked it.
        if (item.status === "evidence_needed" && answered.length) {
          return {
            ...item,
            ...keep,
            status: "declared",
            basis: [...item.basis, ...answered.map((input) => `${input.label}：${declaredFacts[input.field]}（用户声明，未核验）`)],
            needs: item.needs.filter((need) => !answered.some((input) => need.includes(input.label.split(" / ")[0])))
          };
        }
        return { ...item, ...keep };
      })
    };
  });

  return { ...plan, lanes, summary: summarize(lanes), planned: false, templated, final };
}

// One action list, ordered by the path's own dependencies.
//
// Recommended actions and a separate "next step" said the same thing twice and
// left the reader deciding which to trust. The path already knows what blocks
// what, so the actions are derived from it: each one names the step it unblocks,
// and they come in the order the steps have to close. Whatever the specialists
// suggested that does not map onto a step is kept at the end rather than
// dropped.
export function buildActionPlan(path, results = []) {
  const actions = [];
  const claimed = new Set();

  for (const lane of path?.lanes || []) {
    for (const item of lane.steps) {
      if (item.status === "declared") {
        actions.push({
          action: `核验用户声明的信息：${item.inputs.map((input) => input.label).join("、")}`,
          unblocks: item.title, lane: lane.lane, kind: "verify"
        });
        continue;
      }
      if (item.status !== "evidence_needed") continue;
      for (const need of item.needs) {
        const text = String(need).trim();
        if (!text || claimed.has(text)) continue;
        claimed.add(text);
        actions.push({ action: text, unblocks: item.title, lane: lane.lane, kind: "unblock" });
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
  return {
    actions: actions.slice(0, 8),
    suggested: suggested.slice(0, 5),
    blocked: blocked.slice(0, 6),
    closing: review ? review.title : null
  };
}

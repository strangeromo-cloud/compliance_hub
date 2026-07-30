// The analysis path: the ordered steps a compliance question actually has to
// pass through, each marked with whether it is settled and what it rests on.
//
// Statuses are derived from data the system genuinely holds — a synchronized
// source, a parsed notice, an identity element that was actually comparable.
// They are never taken from the model's own account of its work: a model asked
// whether a step is confirmed will happily say yes, and "confirmed" here has to
// mean something a reviewer can check.
//
//   confirmed        the step is settled, and `basis` says on what
//   evidence_needed  the step is reached but blocked, and `needs` says by what
//   not_reached      an earlier step must settle first
//   review_required  only a person can close this

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

  steps.push(step("classify", "归类（ECCN / 中国管制编码）",
    classificationFacts.length ? "confirmed" : "evidence_needed",
    classificationFacts.length
      ? { basis: classificationFacts.slice(0, 3).map((fact) => `${fact.sourceId}${fact.noticeNumber ? `（${fact.noticeNumber}）` : ""}：${String(fact.fact).slice(0, 90)}`) }
      : { needs: ["关键技术参数与厂商分类信息", ...needsMatching(results, "product", /参数|分类|eccn|编码/i)] }));

  const hasContent = PERCENT.test(question) && /美国|us|含量|content|de\s*minimis/i.test(question);
  steps.push(step("jurisdiction", "管辖判定（EAR 734 de minimis / FDP）",
    hasContent ? "confirmed" : "evidence_needed",
    hasContent
      ? { basis: ["问题中给出了受控美国原产内容占比"] }
      : { needs: ["受控美国原产内容的价值占比，以及是否使用美国技术或软件（FDP）", ...needsMatching(results, "product", /原产|含量|管辖|de\s*minimis/i)] }));

  steps.push(step("licence_path", "许可判定（管制理由 → 国别矩阵 → 例外）", "not_reached",
    { needs: ["归类与管辖成立后方可进行；还需最终目的地、最终用户与最终用途", ...needsMatching(results, "product", /目的地|最终用户|最终用途|许可/i)] }));

  return steps;
}

function tpddSteps(question, grounding, results) {
  const rules = [
    ["legal_existence", "核实主体存续与注册信息", /注册|执照|存续|营业|登记/i],
    ["beneficial_ownership", "确认受益所有权", /ubo|受益所有|股东|股权/i],
    ["rationale_fees", "评估商业合理性与费用水平", /费用|佣金|成功费|服务|交付|合理性/i],
    ["payment_path", "核查收款主体与付款路径", /付款|收款|账户|汇款|payment/i]
  ];
  return rules.map(([id, title, pattern]) => {
    const needs = needsMatching(results, "tpdd", pattern);
    return step(id, title, "evidence_needed",
      { needs: needs.length ? needs : ["需取得对应证明文件"] });
  });
}

export function buildAnalysisPath({ question, agents, grounding, results }) {
  const lanes = [];
  if (agents.includes("trade")) lanes.push({ lane: "trade", label: "Trade — 受限方与主体", steps: tradeSteps(question, grounding, results) });
  if (agents.includes("product")) lanes.push({ lane: "product", label: "Product — 物项与许可", steps: productSteps(question, grounding, results) });
  if (agents.includes("tpdd")) lanes.push({ lane: "tpdd", label: "Ethics & TPDD — 第三方", steps: tpddSteps(question, grounding, results) });

  lanes.push({
    lane: "review",
    label: "结案",
    steps: [step("human_review", "Compliance / Legal 人工复核", "review_required",
      { needs: ["以上步骤的结论与证据需经人工确认；系统不做交易放行"] })]
  });

  const all = lanes.flatMap((group) => group.steps);
  return {
    lanes,
    summary: {
      total: all.length,
      confirmed: all.filter((item) => item.status === "confirmed").length,
      evidenceNeeded: all.filter((item) => item.status === "evidence_needed").length,
      notReached: all.filter((item) => item.status === "not_reached").length
    }
  };
}

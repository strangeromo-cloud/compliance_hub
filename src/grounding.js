import { readNormalized } from "./data-layer/storage.js";
import { classifyQuestionIntent, isChinaDualUseQuestion } from "./question-intent.js";
import { findNamesMentioned, matchParty } from "./entity-matching.js";
import { findBom, findInternalParties, findProducts, manufacturerFactsFor } from "./internal-data.js";

// Every synchronized restricted-party source is screened, so adding an adapter
// widens screening coverage without touching this file.
const PARTY_LIST_SOURCES = [
  { sourceId: "trade-csl", label: "U.S. Consolidated Screening List" },
  { sourceId: "ofac-sls", label: "OFAC Sanctions List Service" },
  { sourceId: "china-control-entities", label: "PRC export control control list / watch list" },
  { sourceId: "china-unreliable-entity", label: "PRC Unreliable Entity List" },
  { sourceId: "un-consolidated", label: "UN Security Council Consolidated List" },
  { sourceId: "uk-sanctions", label: "UK Sanctions List" }
];

const CHINA_NOTICE_SOURCES = ["china-dual-use", "china-licence-catalogue"];

async function loadListRecords() {
  const loaded = await Promise.all(PARTY_LIST_SOURCES.map(async (source) => {
    const snapshot = await readNormalized(source.sourceId);
    if (!snapshot?.records?.length) return null;
    // Notice-type records describe a measure, not a party; only party records
    // belong in a screening pass.
    const records = snapshot.records.filter((record) => record.recordType !== "notice");
    return { ...source, capturedAt: snapshot.capturedAt, isFallback: Boolean(snapshot.isFallback), records };
  }));
  return loaded.filter(Boolean);
}

async function screenQuestionParties(question) {
  const sources = await loadListRecords();
  if (!sources.length) return { matches: [], screenedSources: [], unsyncedSources: PARTY_LIST_SOURCES.map((source) => source.sourceId) };

  const matches = [];
  for (const source of sources) {
    for (const hit of findNamesMentioned(question, source.records, { limit: 6 })) {
      const [scored] = matchParty({ name: hit.matchedName }, [hit.record], { limit: 1, threshold: 0.5 });
      // The raw record is kept so an internal party can later be compared
      // against it with its own country, registration number and address.
      if (scored) matches.push({ ...scored, sourceId: source.sourceId, sourceLabel: source.label, capturedAt: source.capturedAt, designatedRecord: hit.record });
    }
  }

  const screenedIds = new Set(sources.map((source) => source.sourceId));
  return {
    matches: matches.slice(0, 12),
    screenedSources: sources.map((source) => ({ sourceId: source.sourceId, label: source.label, recordCount: source.records.length, capturedAt: source.capturedAt, provenance: source.isFallback ? "bundled_fallback_snapshot" : "live_sync" })),
    fallbackSources: sources.filter((source) => source.isFallback).map((source) => ({ sourceId: source.sourceId, capturedAt: source.capturedAt })),
    unsyncedSources: PARTY_LIST_SOURCES.filter((source) => !screenedIds.has(source.sourceId)).map((source) => source.sourceId)
  };
}

// PRC control facts now come from the ingested official notices rather than a
// hardcoded paragraph, so they carry a notice number and an effective date.
async function chinaNoticeFacts(question) {
  const facts = [];
  for (const sourceId of CHINA_NOTICE_SOURCES) {
    const snapshot = await readNormalized(sourceId);
    if (!snapshot?.records?.length) continue;
    const relevant = snapshot.records
      .filter((record) => record.recordType !== "guidance" && record.noticeAction !== "repeal")
      .sort((left, right) => String(right.publishedAt || "").localeCompare(String(left.publishedAt || "")))
      .slice(0, 4);
    for (const record of relevant) {
      facts.push({
        sourceId,
        noticeNumber: record.noticeNumber,
        effectiveFrom: record.effectiveFrom,
        sourceUrl: record.sourceUrl,
        fact: `${record.noticeTitle}${record.effectiveFrom ? `（自 ${record.effectiveFrom} 起）` : ""}${record.controlCodes?.length ? `；涉及管制编码 ${record.controlCodes.slice(0, 8).join("、")}` : ""}`
      });
    }
  }
  const codesMentioned = [...String(question).matchAll(/\b\d[A-E]\d{3}(?:\.[a-z0-9]+)*/gi)].map((match) => match[0]);
  if (codesMentioned.length) {
    const snapshot = await readNormalized("china-dual-use");
    for (const record of snapshot?.records || []) {
      const hit = (record.controlCodes || []).find((code) => codesMentioned.some((mentioned) => code.toLowerCase().startsWith(mentioned.toLowerCase())));
      if (hit) facts.push({ sourceId: "china-dual-use", noticeNumber: record.noticeNumber, effectiveFrom: record.effectiveFrom, sourceUrl: record.sourceUrl, fact: `管制编码 ${hit} 出现在 ${record.noticeNumber || record.noticeTitle}。` });
    }
  }
  return facts.slice(0, 8);
}

// Re-screens each internal candidate against the designated record using the
// internal party's own identity elements. Screening only the name can never
// clear a hit; screening the identity can.
async function internalPartiesFor(match) {
  const candidates = await findInternalParties(match.matchedName, { limit: 3 });
  if (!match.designatedRecord) return candidates;
  return candidates.map((candidate) => {
    const [resolved] = matchParty(
      { name: candidate.entityName, country: candidate.country, registrationNumber: candidate.registrationNumber, address: candidate.address },
      [match.designatedRecord],
      { limit: 1, threshold: 0.5 }
    );
    if (!resolved) return candidate;
    return {
      ...candidate,
      designatedEntity: resolved.entityName,
      designationNoticeNumber: resolved.noticeNumber,
      identityComparisons: resolved.identityComparisons,
      matchScore: resolved.matchScore,
      matchDisposition: resolved.matchDisposition
    };
  });
}

async function productFacts(question) {
  const facts = [];
  for (const record of await manufacturerFactsFor(question)) {
    facts.push({
      sourceId: "nvidia-export",
      fact: `${record.model}（${record.formFactor}）: TPP per GPU ${record.tppPerGpu}, ECCN ${record.eccn}. 该表的字段是 TPP per GPU，不是 APP；APP 取决于具体系统配置。`
    });
  }

  const partNumbers = [...String(question).matchAll(/\b[A-Z]{2}-\d{4}-[A-Z0-9]{2}\b/g)].map((match) => match[0]);
  for (const partNumber of partNumbers.slice(0, 3)) {
    const [product] = await findProducts(partNumber);
    if (!product) continue;
    const bom = await findBom(product.partNumber);
    const controlledParts = (bom?.levels || []).flatMap((level) => [level, ...(level.children || [])])
      .filter((component) => component.eccnUs && component.eccnUs !== "EAR99");
    facts.push({
      sourceId: "internal-master-data",
      dataClass: "synthetic",
      fact: `内部主数据（合成演示数据）: ${product.partNumber} 声明 ECCN ${product.eccnUs}`
        + `${product.cnControlCode ? `、中国管制编码 ${product.cnControlCode}` : ""}`
        + `，原产地 ${product.originCountry}，制造地 ${product.manufacturingSite}，受控美国原产内容占比 ${product.usContentPercent}%`
        + `${controlledParts.length ? `，BOM 中受控件 ${controlledParts.length} 项（${controlledParts.slice(0, 3).map((component) => `${component.componentId} ${component.eccnUs}`).join("；")}）` : ""}`
        + `。该分类为演示派生值（${product.classificationConfidence}），不能作为实际分类依据。`
    });
  }
  return facts;
}

export async function collectGrounding(question, agents = []) {
  const intent = classifyQuestionIntent(question);
  const grounding = { intent, facts: [], listMatches: [], internalParties: [], screening: null, limitations: [] };

  if (isChinaDualUseQuestion(question)) grounding.facts.push(...await chinaNoticeFacts(question));
  grounding.facts.push(...await productFacts(question));

  if (agents.includes("trade") || agents.includes("tpdd")) {
    const screening = await screenQuestionParties(question);
    grounding.listMatches = screening.matches;
    grounding.screening = { screenedSources: screening.screenedSources, fallbackSources: screening.fallbackSources, unsyncedSources: screening.unsyncedSources };
    if (screening.unsyncedSources.length) {
      grounding.limitations.push(`以下名单来源尚未同步，本次未筛查：${screening.unsyncedSources.join("、")}。来源缺失不等于无风险。`);
    }
    if (screening.fallbackSources.length) {
      // Surfaced as a limitation, not a footnote: the reader has to know the
      // screening ran against a stored copy that later notices may supersede.
      grounding.limitations.push(
        `以下来源本机未同步，本次使用随仓库提交的时点快照：${screening.fallbackSources.map((source) => `${source.sourceId}（${String(source.capturedAt).slice(0, 10)}）`).join("、")}。`
        + "快照之后发布的新增、暂停或废止公告不在其中，依赖结论前必须重新同步。"
      );
    }
    if (!screening.screenedSources.length) {
      grounding.limitations.push("没有任何受限方名单已同步到本机，本次回答不包含任何名单筛查结果。");
    }
  }

  if (grounding.listMatches.length) {
    grounding.limitations.push(
      "名单检索只产生 potential match；必须用法律实体、地址、注册号和交易角色消除误报。",
      "名单命中不解决 OFAC 50 Percent Rule 的完整所有权判断。"
    );
    const seen = new Set();
    for (const match of grounding.listMatches.slice(0, 4)) {
      if (!match.matchedName || seen.has(match.matchedName)) continue;
      seen.add(match.matchedName);
      // The point of screening is what it hits inside the company, so an
      // external designation is joined back to internal master data. The
      // internal record supplies country, registration number and address, so
      // the comparison runs in the direction that can actually clear a name hit.
      const internal = await internalPartiesFor(match);
      if (internal.length) grounding.internalParties.push({ designationName: match.matchedName, designationSource: match.sourceId, noticeNumber: match.noticeNumber, internalMatches: internal });
    }
    if (grounding.internalParties.length) {
      grounding.limitations.push("内部主数据为合成演示数据，命中仅用于演示外部名单与内部主数据的关联方式。");
      if (grounding.internalParties.some((entry) => entry.internalMatches.some((item) => item.matchDisposition === "likely_false_positive_identity_elements_conflict"))) {
        grounding.limitations.push("存在身份要素冲突的命中，系统判定为疑似误报；该判定仍需人工用注册证据确认，不能自动放行。");
      }
    }
  }

  return grounding;
}

export function groundingContext(grounding) {
  const screening = grounding.screening
    ? `Screened list sources: ${grounding.screening.screenedSources.map((source) => `${source.sourceId} (${source.recordCount} records, captured ${source.capturedAt}, ${source.provenance})`).join("; ") || "none"}`
      + `\nNot synchronized, therefore not screened: ${grounding.screening.unsyncedSources.join(", ") || "none"}`
      + (grounding.screening.fallbackSources?.length
        ? `\nScreened against a bundled point-in-time copy rather than a live sync: ${grounding.screening.fallbackSources.map((source) => source.sourceId).join(", ")}. Say so in the answer; later notices may supersede it.`
        : "")
    : "Party screening was not applicable to this question.";

  return [
    `Question intent: ${grounding.intent}`,
    screening,
    grounding.facts.length ? `Verified facts:\n${grounding.facts.map((item) => `- [${item.sourceId}]${item.noticeNumber ? ` [${item.noticeNumber}]` : ""} ${item.fact}`).join("\n")}` : "Verified facts: none",
    grounding.listMatches.length ? `Structured-list potential matches:\n${JSON.stringify(grounding.listMatches, null, 2)}` : "Structured-list potential matches: none",
    grounding.internalParties.length ? `Internal master-data records touched by those designations (SYNTHETIC demo data):\n${JSON.stringify(grounding.internalParties, null, 2)}` : "Internal master-data impact: none found",
    grounding.limitations.length ? `Limitations:\n${grounding.limitations.map((item) => `- ${item}`).join("\n")}` : "Limitations: none"
  ].join("\n\n");
}

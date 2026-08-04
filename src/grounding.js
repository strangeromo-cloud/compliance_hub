import { readNormalized } from "./data-layer/storage.js";
import { classifyQuestionIntent, isChinaDualUseQuestion } from "./question-intent.js";
import { findNamesMentioned, fuzzyPartyCandidates, matchParty } from "./entity-matching.js";
import { findBom, findInternalParties, findProducts, manufacturerFactsFor } from "./internal-data.js";
import { resolveOwnership } from "./ownership.js";
import { bi } from "./path-i18n.js";
import { isConfigured as cslApiConfigured, searchName } from "./data-layer/csl-search.js";

// Every synchronized restricted-party source is screened, so adding an adapter
// widens screening coverage without touching this file.
const PARTY_LIST_SOURCES = [
  { sourceId: "trade-csl", label: "U.S. Consolidated Screening List" },
  { sourceId: "ofac-sls", label: "OFAC Sanctions List Service" },
  { sourceId: "china-control-entities", label: "PRC export control control list / watch list" },
  { sourceId: "china-unreliable-entity", label: "PRC Unreliable Entity List" },
  { sourceId: "un-consolidated", label: "UN Security Council Consolidated List" },
  { sourceId: "uk-sanctions", label: "UK Sanctions List" },
  // Gaps the US Consolidated Screening List does not carry. Taiwan's list is the
  // most China-relevant of them and has no machine-readable official route.
  { sourceId: "eu-fsf", label: "EU Consolidated Financial Sanctions List" },
  { sourceId: "tw-shtc", label: "Taiwan Strategic High-Tech Commodities Entity List" },
  { sourceId: "jp-meti-eul", label: "Japan METI End User List" },
  { sourceId: "us-uflpa", label: "UFLPA Entity List" },
  { sourceId: "us-dod-1260h", label: "DoD Section 1260H Chinese Military Companies" }
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

// Who the question is about, as far as the corpus can tell.
//
// Screening asks "does a designated name appear here"; this asks "which known
// entity is this". They need different tests — a partial name a user actually
// typed never appears verbatim in a register — so the party step no longer has
// to stop and ask for a name the system could already find.
//
// Two candidates at most, because that is what a reviewer can carry: enough to
// keep the real one when a name is ambiguous, few enough that the following
// steps stay about resolving between them rather than listing them.
async function resolveCounterparties(question, sources) {
  const pool = sources.flatMap((source) => source.records.map((record) => ({ ...record, sourceId: source.sourceId })));
  if (!pool.length) return [];
  return fuzzyPartyCandidates(question, pool, { limit: 2 }).map((candidate) => ({
    entityName: candidate.entityName,
    matchedName: candidate.matchedName,
    sourceId: candidate.sourceId,
    matchScore: candidate.matchScore,
    matchBasis: candidate.matchBasis,
    country: candidate.record.countryCode || candidate.record.country || null,
    registrationNumber: candidate.record.registrationNumber || null,
    sourceUrl: candidate.record.sourceUrl || null
  }));
}

// The publisher's own matcher, for the names the question actually mentions.
//
// It answers only for trade-csl and only when a key is configured. Its hits are
// kept apart from the local comparison's, because "the ITA's matcher says these
// are the same name" and "our token overlap says so" are different claims and a
// reviewer is entitled to know which one they are reading.
async function officialScreening(question, sources) {
  if (!cslApiConfigured()) return null;
  const csl = sources.find((source) => source.sourceId === "trade-csl");
  if (!csl) return null;

  // The names to put to it are the ones already found in the question, so the
  // API is asked about parties the user wrote rather than about the whole text.
  const names = [...new Set(findNamesMentioned(question, csl.records, { limit: 4 }).map((hit) => hit.matchedName))];
  if (!names.length) return null;

  const searched = [];
  for (const name of names.slice(0, 3)) {
    const result = await searchName(name);
    if (result) searched.push(result);
  }
  if (!searched.length) return null;
  return {
    queries: searched.map((item) => item.query),
    unavailable: searched.filter((item) => item.unavailable).map((item) => item.unavailable),
    hits: searched.flatMap((item) => item.hits)
  };
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

  const official = await officialScreening(question, sources).catch(() => null);

  const screenedIds = new Set(sources.map((source) => source.sourceId));
  return {
    matches: matches.slice(0, 12),
    official,
    // The loaded records themselves, so counterparty resolution can run over the
    // same corpus that was screened rather than loading it a second time.
    sources,
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
      .filter((record) => !["guidance", "regulation"].includes(record.recordType) && record.noticeAction !== "repeal")
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
async function internalPartiesFor(match, declared = {}) {
  const candidates = await findInternalParties(match.matchedName, { limit: 3 });
  if (!match.designatedRecord) return candidates;
  return candidates.map((candidate) => {
    // A value the user supplied fills a gap the internal record did not have.
    // It is tracked separately, because a declaration is not verified evidence
    // and the interface has to be able to say which is which.
    const declaredUsed = [];
    const withDeclared = (field, value) => {
      if (value || !declared[field]) return value;
      declaredUsed.push(field);
      return declared[field];
    };
    const subject = {
      name: candidate.entityName,
      country: withDeclared("country", candidate.country),
      registrationNumber: withDeclared("registrationNumber", candidate.registrationNumber),
      address: withDeclared("address", candidate.address)
    };
    const [resolved] = matchParty(subject, [match.designatedRecord], { limit: 1, threshold: 0.5 });
    if (!resolved) return candidate;
    return {
      ...candidate,
      designatedEntity: resolved.entityName,
      designationNoticeNumber: resolved.noticeNumber,
      identityComparisons: resolved.identityComparisons.map((row) => ({
        ...row,
        // Marks which side of this comparison came from a declaration.
        declared: declaredUsed.includes({ country: "country", registration_number: "registrationNumber", address: "address" }[row.element])
      })),
      matchScore: resolved.matchScore,
      matchDisposition: resolved.matchDisposition,
      declaredFields: declaredUsed
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

export async function collectGrounding(question, agents = [], declaredFacts = {}) {
  const intent = classifyQuestionIntent(question);
  const grounding = { intent, facts: [], listMatches: [], internalParties: [], screening: null, limitations: [] };

  if (isChinaDualUseQuestion(question)) grounding.facts.push(...await chinaNoticeFacts(question));
  grounding.facts.push(...await productFacts(question));

  if (agents.includes("trade") || agents.includes("tpdd")) {
    const screening = await screenQuestionParties(question);
    grounding.listMatches = screening.matches;
    grounding.screening = { screenedSources: screening.screenedSources, fallbackSources: screening.fallbackSources, unsyncedSources: screening.unsyncedSources, official: screening.official || null };
    if (screening.official?.hits?.length) {
      grounding.limitations.push(
        `以下名称经 ITA 官方检索接口（Consolidated Screening List，fuzzy_name）比对：${screening.official.queries.join("、")}；`
        + "该结果为发布方自身的匹配判定，与本机快照的比对分开呈现。"
      );
    }
    if (screening.official?.unavailable?.length) {
      grounding.limitations.push(`ITA 官方检索接口本次不可用（${screening.official.unavailable[0]}），已回落到本机快照比对。`);
    }
    grounding.partyCandidates = await resolveCounterparties(question, screening.sources || []);
    // The corporate chain for whoever the party step settled on. A declared legal
    // name is preferred over a matched candidate: the user naming their own
    // counterparty outranks this system's guess at it.
    const subject = String(declaredFacts.legalName || "").trim() || grounding.partyCandidates[0]?.entityName || null;
    if (subject) grounding.ownership = await resolveOwnership(subject).catch(() => null);

    // The parent, screened in its own right. This is the whole point of
    // resolving the chain: a company owned in aggregate by designated parties is
    // restricted even when its own name is clean, and until now the parent was
    // found and then never looked up.
    const chain = grounding.ownership;
    const parents = [chain?.directParent, chain?.ultimateParent]
      .filter((parent) => parent?.name)
      .filter((parent, index, all) => all.findIndex((other) => other.name === parent.name) === index);
    if (parents.length && screening.sources?.length) {
      grounding.parentScreening = parents.map((parent) => {
        const hits = screening.sources.flatMap((source) =>
          fuzzyPartyCandidates(parent.name, source.records, { limit: 2 })
            .map((hit) => ({ ...hit, sourceId: source.sourceId, sourceLabel: source.label })));
        return { parent, hits, screened: screening.sources.map((source) => source.sourceId) };
      });
      if (grounding.parentScreening.some((entry) => entry.hits.length)) {
        grounding.limitations.push(bi(
          "母公司在受限方名单中出现潜在命中：合计持股达到 50% 时，子公司同样受限，必须完成穿透计算。",
          "A parent company drew a potential match on a restricted-party list. Where aggregate ownership reaches 50%, the subsidiary is restricted too, and the aggregation has to be completed."));
      }
    }
    if (screening.unsyncedSources.length) {
      grounding.limitations.push(bi(
        `以下名单来源尚未同步，本次未筛查：${screening.unsyncedSources.join("、")}。来源缺失不等于无风险。`,
        `Not screened because they are not synced: ${screening.unsyncedSources.join(", ")}. A missing source is not an absence of risk.`));
    }
    if (screening.fallbackSources.length) {
      // Surfaced as a limitation, not a footnote: the reader has to know the
      // screening ran against a stored copy that later notices may supersede.
      const stale = screening.fallbackSources.map((source) => `${source.sourceId}（${String(source.capturedAt).slice(0, 10)}）`).join("、");
      const staleEn = screening.fallbackSources.map((source) => `${source.sourceId} (${String(source.capturedAt).slice(0, 10)})`).join(", ");
      grounding.limitations.push(bi(
        `以下来源本机未同步，本次使用随仓库提交的时点快照：${stale}。快照之后发布的新增、暂停或废止公告不在其中，依赖结论前必须重新同步。`,
        `These sources are not synced on this host, so a point-in-time copy committed with the repository was used: ${staleEn}. Additions, suspensions and revocations published since that copy are not in it; re-sync before relying on this conclusion.`
      ));
    }
    if (!screening.screenedSources.length) {
      grounding.limitations.push(bi("没有任何受限方名单已同步到本机，本次回答不包含任何名单筛查结果。",
        "No restricted-party list is synced on this host, so this answer contains no screening result at all."));
    }
  }

  if (grounding.listMatches.length) {
    grounding.limitations.push(
      bi("名单检索只产生 potential match；必须用法律实体、地址、注册号和交易角色消除误报。",
        "List screening produces potential matches only; legal entity, address, registration number and transaction role are what resolve a false positive."),
      bi("名单命中不解决 OFAC 50 Percent Rule 的完整所有权判断。",
        "A list hit does not settle the ownership question the OFAC 50 Percent Rule asks.")
    );
    const seen = new Set();
    for (const match of grounding.listMatches.slice(0, 4)) {
      if (!match.matchedName || seen.has(match.matchedName)) continue;
      seen.add(match.matchedName);
      // The point of screening is what it hits inside the company, so an
      // external designation is joined back to internal master data. The
      // internal record supplies country, registration number and address, so
      // the comparison runs in the direction that can actually clear a name hit.
      const internal = await internalPartiesFor(match, declaredFacts);
      if (internal.length) grounding.internalParties.push({ designationName: match.matchedName, designationSource: match.sourceId, noticeNumber: match.noticeNumber, internalMatches: internal });
    }
    if (grounding.internalParties.length) {
      grounding.limitations.push(bi("内部主数据为合成演示数据，命中仅用于演示外部名单与内部主数据的关联方式。",
        "The internal master data is synthetic demonstration data; a hit only shows how an external list would join to it."));
      if (grounding.internalParties.some((entry) => entry.internalMatches.some((item) => item.matchDisposition === "likely_false_positive_identity_elements_conflict"))) {
        grounding.limitations.push(bi("存在身份要素冲突的命中，系统判定为疑似误报；该判定仍需人工用注册证据确认，不能自动放行。",
        "A hit whose identity elements conflict is reported as a likely false positive. That still has to be confirmed against registration evidence by a person; nothing is released automatically."));
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
    // What ownership resolution found, and what screening the parent produced.
    // Both were computed, shown on the path, and withheld from the specialist
    // that had to reason about them.
    grounding.ownership
      ? `Ownership chain (GLEIF, accounting consolidation — carries no shareholding percentage):\n${JSON.stringify(grounding.ownership, null, 2)}`
      : "Ownership chain: not resolved",
    grounding.parentScreening?.length
      ? `Parent screened in its own right:\n${JSON.stringify(grounding.parentScreening, null, 2)}`
      : "Parent screening: not applicable",
    // The answers other lanes gave, with the provision behind each. Stated as
    // findings the specialist must reason from, not as suggestions.
    grounding.crossLane?.length
      ? `Answers from the other lanes — treat each as established, and cite the provision given:\n${grounding.crossLane.map((call) => `- [${call.id}] ${call.en} (${call.cite})`).join("\n")}`
      : "Cross-lane answers: none",
    grounding.limitations.length ? `Limitations:\n${grounding.limitations.map((item) => `- ${item}`).join("\n")}` : "Limitations: none"
  ].join("\n\n");
}

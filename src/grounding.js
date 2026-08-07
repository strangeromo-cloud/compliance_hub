import { readNormalized } from "./data-layer/storage.js";
import { classifyQuestionIntent, isChinaDualUseQuestion } from "./question-intent.js";
import { findNamesMentioned, fuzzyPartyCandidates, matchParty, normalizeEntityName } from "./entity-matching.js";
import { findBom, findInternalParties, findProducts, manufacturerFactsFor } from "./internal-data.js";
import { resolveOwnership, statedOwnership } from "./ownership.js";
import { beneficialOwners } from "./sec-edgar.js";
import { aggregateOwnership, buildOwnershipGraph } from "./ownership-graph.js";
import { bi } from "./path-i18n.js";
import { isConfigured as cslApiConfigured, searchName } from "./data-layer/csl-search.js";

// A reported shareholder is screened on the name it filed under, and only an
// agreeing name counts.
//
// Everywhere else in this file screening scans free text, where a partial name
// has to be accepted because that is how a name appears in a sentence. A
// Schedule 13D/G holder is not free text — it is a legal name in a filed field,
// and a designated party holding five per cent of a US issuer files under its
// own name, which the lists also carry. So the two names have to agree after
// normalisation, or differ only in spelling.
//
// Containment is deliberately not enough here. "VANGUARD" is a real entry on the
// Consolidated Screening List, and the general-purpose matcher reports it inside
// "Vanguard Capital Management" — which is the shareholder of record of most of
// the S&P 500. A screening line that fires on almost every US-listed company
// teaches the reader to skip it, and then it is worse than absent.
// A spelling variant counts, but not one claimed at the bottom of the band.
//
// The character tier scores a near-twin from 0.55 up. At the floor the claim is
// only "these differ by one character in six", which for a short list entry is
// arithmetic rather than evidence: across 36 real shareholder names taken from
// ten US issuers, the only thing it produced was NOMURA HOLDINGS matching OURA
// at 0.56. Two more sit just above it and are equally wrong — Rostech to PROTEH
// at 0.59, Aeroflot to Aerofalcon at 0.61.
//
// Real transliteration variants land clear of them: Gasprom Neft reaches Gazprom
// Neft at 0.69, Rosnjeft reaches Rosneft at 0.71. The floor goes in the gap.
const HOLDER_SPELLING_FLOOR = 0.65;

// Han characters, plus the kana that appear in Japanese company names.
const CJK_NAME = /[一-鿿぀-ヿ]/;

// Exported so the boundary can be pinned to the names that set it rather than
// re-derived from a number in a diff.
export const holderMatches = (hit) => hit.matchBasis === "normalized_name_identical"
  || (hit.matchBasis === "character_similarity" && hit.matchScore >= HOLDER_SPELLING_FLOOR);

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
    // Screened again under the name the register holds in the other language.
    //
    // The US lists are entirely in Latin script, so a Chinese question could
    // never reach them however the matching was tuned — and returned nothing,
    // which reads as a clean party. GLEIF publishes the entity's own declared
    // alternative-language legal name, so the counterparty can be screened under
    // both without translating anything.
    const screenAlso = async (names, sources) => {
      const found = [];
      for (const name of names) {
        for (const source of sources) {
          for (const hit of matchParty(name, source.records, { limit: 3, threshold: 0.75 })) {
            found.push({ ...hit, sourceId: source.sourceId, sourceLabel: source.label, viaName: name });
          }
        }
      }
      return found;
    };

    // The corporate chain for whoever the party step settled on. A declared legal
    // name is preferred over a matched candidate: the user naming their own
    // counterparty outranks this system's guess at it.
    const subject = String(declaredFacts.legalName || "").trim() || grounding.partyCandidates[0]?.entityName || null;
    // Which register record the reviewer said this is. Several entities can
    // carry one name once the legal form is normalised away, and where the
    // register separates them by nothing but country the choice is not this
    // system's to make. The answer arrives as the option text, so the identifier
    // is read back out of it — a 20-character LEI is unmistakable in a sentence,
    // and picking "none of these" leaves none to find, which is also an answer.
    const declaredSubject = String(declaredFacts.ownershipSubject || "").trim();
    if (subject) {
      grounding.ownership = await resolveOwnership(subject, {
        chosenLei: declaredSubject.match(/\b[A-Z0-9]{20}\b/)?.[0] || null,
        answered: Boolean(declaredSubject)
      }).catch(() => null);
    }
    // What the Treasury has said about this name, alongside what GLEIF says about
    // its accounts. They answer different questions and neither answers the 50
    // Percent Rule, so both are carried and both say what they are.
    if (subject) grounding.statedOwnership = await statedOwnership(subject).catch(() => null);
    // The only public source that attaches a number to a holding. GLEIF says who
    // sits above the company and OFAC says a relationship exists; neither states
    // a share, so the aggregate the 50 Percent Rule turns on had to be typed in
    // by hand. A Schedule 13D/G states it in a field — for a US registered
    // issuer, above five per cent, as beneficial ownership rather than equity.
    if (subject) grounding.beneficialOwners = await beneficialOwners(subject).catch(() => null);

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
    // The five-per-cent holders, screened in their own right. This is the point
    // of retrieving them: a designated party holding a stated share of the
    // counterparty is the input to the 50 Percent Rule, and until now it was a
    // search someone had to run by hand against a structure they had typed.
    const owners = grounding.beneficialOwners?.holders || [];
    if (owners.length && screening.sources?.length) {
      grounding.holderScreening = owners.map((holder) => ({
        holder,
        hits: screening.sources.flatMap((source) =>
          // The basis set is what filters, not the score: a spelling variant
          // scores 0.55–0.75 by design, so a high threshold would drop the
          // Gazprom/Gasprom case this is meant to catch before the basis is
          // ever looked at.
          // Filtered before it is cut down, never after. Containment scores 0.85
          // and a spelling variant 0.69, so asking for the top two and then
          // dropping the containment matches returns nothing while the real hit
          // sits at rank five — "Gasprom Neft" found "Gazprom Neft" and lost it
          // to two names that merely contained a word.
          matchParty(holder.name, source.records, { limit: 40, threshold: 0.55 })
            .filter(holderMatches)
            .slice(0, 2)
            .map((hit) => ({ ...hit, sourceId: source.sourceId, sourceLabel: source.label }))),
        screened: screening.sources.map((source) => source.sourceId)
      }));
      if (grounding.holderScreening.some((entry) => entry.hits.length)) {
        grounding.limitations.push(bi(
          "已申报的 5% 以上持有人中出现受限方名单潜在命中：必须完成 OFAC 50% 合计持股计算。申报的是 13d-3 受益所有权而非股权比例，且关联申报人会就同一批股份各报一次，不能直接相加。",
          "A reported holder above five per cent drew a potential match on a restricted-party list. The 50 Percent Rule aggregation has to be completed. What is filed is Rule 13d-3 beneficial ownership, not equity, and affiliated filers report the same shares more than once — the figures cannot simply be added."));
      }
    }

    // The register's other-language name for this counterparty, screened in its
    // own right and merged into the case's matches. A hit reached this way is a
    // hit — it is the same legal entity under the name its own register records
    // — so it carries which name found it rather than appearing as though the
    // question had contained it.
    // Read off the resolution as a whole, not off a resolved subject: both of
    // SMIC's register records are lapsed, so there is no subject to walk and the
    // English legal name is still exactly what the screening needs.
    const bridgeNames = (grounding.ownership?.otherNames || [])
      .filter((name) => normalizeEntityName(name) && normalizeEntityName(name) !== normalizeEntityName(subject || ""));
    if (bridgeNames.length && screening.sources?.length) {
      const viaOtherName = await screenAlso(bridgeNames, screening.sources);
      if (viaOtherName.length) {
        grounding.listMatches = [...grounding.listMatches, ...viaOtherName];
        grounding.limitations.push(bi(
          `该交易方在 GLEIF 登记的另一语言法定名称为「${bridgeNames.join("、")}」，以该名称另行筛查命中 ${viaOtherName.length} 条：${[...new Set(viaOtherName.map((hit) => hit.entityName))].slice(0, 3).join("、")}。美国各名单均无中文条目，仅以中文名提问无法比对到它们。`,
          `The register holds this counterparty's declared alternative-language legal name as "${bridgeNames.join(", ")}". Screening under that name returned ${viaOtherName.length} match(es): ${[...new Set(viaOtherName.map((hit) => hit.entityName))].slice(0, 3).join(", ")}. The US lists carry no Chinese entries, so a question written in Chinese alone cannot reach them.`));
      }
    }

    // A question in a script the lists do not use, and nothing found. That is
    // not a clean party — it is a comparison that could not be made, and the two
    // must never arrive at the reader looking the same.
    if (!grounding.listMatches.length && CJK_NAME.test(String(subject || question))) {
      const latinOnly = screening.sources.filter((source) => !source.records.some((record) => CJK_NAME.test(record.entityName || "")));
      if (latinOnly.length) {
        grounding.limitations.push(bi(
          `本次以中文名称筛查，但以下来源不含任何中文条目，因此对它们而言这次比对没有实际发生：${latinOnly.map((source) => source.sourceId).join("、")}。未命中不等于未被列名，需以该主体的英文法定名称重新筛查。`,
          `The screening ran on a Chinese name, and these sources contain no Chinese entries at all, so against them no comparison actually took place: ${latinOnly.map((source) => source.sourceId).join(", ")}. No match is not evidence of no listing; re-screen under the party's English legal name.`));
      }
    }

    // The four sources, composed and aggregated the way the rule works, rather
    // than read one hop each and left for the reader to combine. This is where a
    // designated party three levels up becomes visible, and where "supply the
    // shareholding structure" turns into "this one percentage would settle it".
    if (subject) {
      // An unsynced source resolves to null rather than rejecting, so the
      // absence has to be read off the value and not caught.
      const stated = await readNormalized("ofac-ownership").catch(() => null);
      const graph = buildOwnershipGraph({
        statedEdges: stated?.records || [],
        chain: grounding.ownership,
        filed: grounding.beneficialOwners,
        declaredText: declaredFacts.ownership || "",
        subject
      });
      grounding.ownershipAggregate = aggregateOwnership(graph, subject, {
        // Names this case's own screening hits as designated, so a party matched
        // on a list in this run counts in the aggregate even where OFAC's
        // published graph has never mentioned it.
        designated: (grounding.listMatches || []).map((match) => match.entityName).filter(Boolean)
      });
      if (grounding.ownershipAggregate.verdict === "blocked") {
        grounding.limitations.push(bi(
          `按 OFAC 50% 规则合计，已知被列名主体对该交易方的持股达到 ${grounding.ownershipAggregate.known}%，达到或超过 50% 的门槛：该主体本身即受限，无需另行列名。`,
          `Aggregated under the 50 Percent Rule, designated parties are known to hold ${grounding.ownershipAggregate.known}% of this counterparty, at or above the threshold. The entity is itself restricted without needing to be listed.`));
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

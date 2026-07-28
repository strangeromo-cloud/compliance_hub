// Prototype-grade name normalization and candidate scoring.
//
// This is deliberately explainable rather than clever: every match reports what
// it matched on and which identity elements were compared, because a screening
// result that cannot be explained cannot be reviewed. It is NOT production
// exact/fuzzy matching, and it never produces a confirmed match on its own.

const LEGAL_SUFFIXES = [
  "incorporated", "inc", "corporation", "corp", "company", "co", "limited", "ltd", "llc", "llp", "lp", "plc",
  "gmbh", "ag", "kg", "mbh", "bv", "nv", "sa", "sas", "sarl", "srl", "spa", "ab", "as", "oy", "pte", "pty",
  "pvt", "kk", "kabushiki", "kaisha", "holdings", "holding", "group"
];

const CHINESE_SUFFIXES = ["有限公司", "股份有限公司", "有限责任公司", "集团有限公司", "集团", "公司", "株式会社"];

export function normalizeEntityName(name = "") {
  let value = String(name).toLowerCase().normalize("NFKC");
  for (const suffix of CHINESE_SUFFIXES) value = value.replaceAll(suffix, " ");
  value = value
    .replace(/[.,'"`’‘“”()（）\[\]{}<>&/\\|:;!?*#+]/g, " ")
    .replace(/[-—–_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = value.split(" ").filter((token) => token && !LEGAL_SUFFIXES.includes(token));
  return (tokens.length ? tokens : value.split(" ").filter(Boolean)).join(" ").trim();
}

export function nameTokens(name = "") {
  return new Set(normalizeEntityName(name).split(" ").filter((token) => token.length > 1));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export function scoreNameMatch(query, candidate) {
  const normalizedQuery = normalizeEntityName(query);
  const normalizedCandidate = normalizeEntityName(candidate);
  if (!normalizedQuery || !normalizedCandidate) return { score: 0, basis: "no_comparable_name" };
  if (normalizedQuery === normalizedCandidate) return { score: 1, basis: "normalized_name_identical" };
  if (normalizedQuery.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedQuery)) {
    return { score: 0.85, basis: "one_normalized_name_contains_the_other" };
  }
  const overlap = jaccard(nameTokens(query), nameTokens(candidate));
  if (overlap >= 0.5) return { score: Math.min(0.8, 0.45 + overlap * 0.4), basis: "token_overlap" };
  return { score: overlap, basis: overlap ? "weak_token_overlap" : "no_overlap" };
}

function candidateNames(record) {
  return [record.entityName, record.entityNameEn, record.legalName, ...(record.aliases || []), ...(record.otherNames || [])]
    .filter((name) => typeof name === "string" && name.trim());
}

// Identity elements are what actually resolves a name hit. Reporting them as
// agree / conflict / unavailable is the difference between "possible match" and
// a usable review decision.
function compareIdentity(query, record) {
  const comparisons = [];
  const recordCountry = record.countryCode || record.country || (record.countries || [])[0] || null;
  if (query.country && recordCountry) {
    comparisons.push({ element: "country", status: String(query.country).toUpperCase() === String(recordCountry).toUpperCase() ? "agree" : "conflict", queryValue: query.country, recordValue: recordCountry });
  } else if (query.country || recordCountry) {
    comparisons.push({ element: "country", status: "unavailable", queryValue: query.country || null, recordValue: recordCountry || null });
  }
  const recordRegistration = record.registrationNumber || (record.identificationNumbers || []).map((id) => id.number).filter(Boolean)[0] || null;
  if (query.registrationNumber && recordRegistration) {
    comparisons.push({ element: "registration_number", status: query.registrationNumber === recordRegistration ? "agree" : "conflict", queryValue: query.registrationNumber, recordValue: recordRegistration });
  } else {
    comparisons.push({ element: "registration_number", status: "unavailable", queryValue: query.registrationNumber || null, recordValue: recordRegistration });
  }
  const recordAddress = (record.addresses || []).map((address) => (typeof address === "string" ? address : [address.address1, address.city, address.country].filter(Boolean).join(" "))).filter(Boolean)[0] || record.address || null;
  if (query.address && recordAddress) {
    const overlap = jaccard(nameTokens(query.address), nameTokens(recordAddress));
    comparisons.push({ element: "address", status: overlap >= 0.4 ? "agree" : "conflict", queryValue: query.address, recordValue: recordAddress });
  } else if (recordAddress) {
    comparisons.push({ element: "address", status: "unavailable", queryValue: null, recordValue: recordAddress });
  }
  return comparisons;
}

// A name hit whose country and registration number both conflict is the classic
// false positive. Saying so is more useful than returning a bare score.
function disposition(score, comparisons) {
  const conflicts = comparisons.filter((comparison) => comparison.status === "conflict");
  const agreements = comparisons.filter((comparison) => comparison.status === "agree");
  if (score >= 0.85 && agreements.length && !conflicts.length) return "strong_potential_match_escalate_for_human_confirmation";
  if (score >= 0.85 && conflicts.length >= 2) return "likely_false_positive_identity_elements_conflict";
  if (score >= 0.85) return "potential_match_requires_identity_review";
  if (score >= 0.6) return "weak_potential_match_requires_identity_review";
  return "below_review_threshold";
}

export function matchParty(query, records, { limit = 10, threshold = 0.55 } = {}) {
  const subject = typeof query === "string" ? { name: query } : query;
  const scored = [];
  for (const record of records) {
    let best = { score: 0, basis: "no_overlap", matchedName: null };
    for (const name of candidateNames(record)) {
      const result = scoreNameMatch(subject.name, name);
      if (result.score > best.score) best = { ...result, matchedName: name };
    }
    if (best.score < threshold) continue;
    const identityComparisons = compareIdentity(subject, record);
    scored.push({
      sourceId: record.sourceId || null,
      recordId: record.recordId || null,
      entityName: record.entityName || record.legalName || null,
      entityNameEn: record.entityNameEn || null,
      aliases: (record.aliases || []).slice(0, 5),
      sourceList: record.sourceList || record.measureType || null,
      noticeNumber: record.noticeNumber || null,
      restrictionType: record.restrictionType || record.restrictionSummary || null,
      effectiveFrom: record.effectiveFrom || null,
      sourceUrl: record.sourceUrl || null,
      matchScore: Math.round(best.score * 100) / 100,
      matchBasis: best.basis,
      matchedName: best.matchedName,
      identityComparisons,
      matchDisposition: disposition(best.score, identityComparisons)
    });
  }
  return scored.sort((left, right) => right.matchScore - left.matchScore).slice(0, limit);
}

// Finds designated names that literally appear in a free-text question, so the
// hub can screen whoever the user actually mentioned without a hardcoded alias
// table. Short names are skipped because they generate noise, not signal.
export function findNamesMentioned(text, records, { limit = 12, minLength = 4 } = {}) {
  const haystack = ` ${normalizeEntityName(text)} `;
  const rawHaystack = String(text).toLowerCase();
  const hits = [];
  for (const record of records) {
    for (const name of candidateNames(record)) {
      const normalized = normalizeEntityName(name);
      if (normalized.length < minLength) continue;
      const mentioned = haystack.includes(` ${normalized} `) || haystack.includes(`${normalized} `) && normalized.length >= 6
        ? true
        : rawHaystack.includes(name.toLowerCase()) && name.length >= minLength;
      if (!mentioned) continue;
      hits.push({ record, matchedName: name });
      break;
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

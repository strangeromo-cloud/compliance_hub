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

// Candidate legal entities for the party a question is about.
//
// findNamesMentioned below requires a designated name to appear in the question
// literally. That is the right test for screening — a hit has to be traceable to
// words the user actually wrote — but it is the wrong one for working out who
// the counterparty is: "Aveox Technologies" in a question never reaches "Aveox
// Technologies (Shenzhen) Co., Ltd." in a register, so the step gave up and
// asked the user to type a name the system already had.
//
// This scores every known entity against the question's own words instead.
// Corporate filler is not evidence of anything — half the register contains
// "technologies" — so a candidate has to share a token that is actually
// distinctive, and enough of its own name to be that name rather than a
// coincidence.
//
// What it produces are candidates, never an identification. Identity resolution
// is the step that settles which one, on registration number, country and
// address; this only says which ones are worth putting to it.
const CORPORATE_FILLER = new Set([
  "technologies", "technology", "tech", "systems", "system", "solutions", "solution", "industries",
  "industrial", "international", "global", "trading", "trade", "electronics", "electronic",
  "engineering", "instruments", "equipment", "materials", "digital", "data", "science", "sciences",
  "development", "manufacturing", "machinery", "energy", "new", "national", "state", "china", "shanghai",
  "beijing", "shenzhen", "科技", "技术", "电子", "国际", "实业", "贸易", "发展", "工业", "设备", "材料"
]);

const CJK = /[\u4e00-\u9fff\u3040-\u30ff]/;

// A word carries enough information to be evidence on its own only if it is both
// uncommon and long. "B-CAT" is a real alias in the screening list, and without
// this any question mentioning a cat matched Beijing China Aviation Technology —
// the same failure as the alias "IFIC" matching inside "classification".
const carriesAlone = (token) => !CORPORATE_FILLER.has(token) && (CJK.test(token) ? token.length >= 3 : token.length >= 5);
const worthCounting = (token) => !CORPORATE_FILLER.has(token) && (CJK.test(token) ? token.length >= 2 : token.length >= 3);

export function fuzzyPartyCandidates(question, records, { limit = 2, threshold = 0.5 } = {}) {
  const asked = nameTokens(question);
  const askedText = normalizeEntityName(question);
  if (!asked.size && !askedText) return [];
  const scored = [];

  for (const record of records) {
    let best = null;
    for (const name of candidateNames(record)) {
      const normalized = normalizeEntityName(name);
      if (!normalized) continue;

      // CJK names are written without spaces, so there is nothing to tokenize
      // and containment is the only usable test. Latin names get the token
      // comparison below, which is what reaches a register entry from a partial
      // name the user actually typed.
      if (CJK.test(normalized)) {
        if (normalized.length >= 3 && askedText.includes(normalized)) {
          const score = 0.9;
          if (!best || score > best.score) best = { score, matchedName: name, covered: 1 };
        }
        continue;
      }

      const tokens = nameTokens(name);
      if (!tokens.size) continue;
      const shared = [...tokens].filter((token) => asked.has(token));
      const meaningful = shared.filter(worthCounting);
      if (!meaningful.length) continue;
      // One word is only enough when that word could not plausibly be anything
      // else; two independent words are enough on their own.
      if (meaningful.length < 2 && !meaningful.some(carriesAlone)) continue;
      // How much of the candidate's own name the question accounts for. Scoring
      // the other way round would rank a one-word entity above a full name
      // simply for being short.
      const covered = shared.length / tokens.size;
      if (covered < threshold) continue;
      const score = Math.min(0.95, covered * 0.7 + Math.min(meaningful.length, 3) * 0.1);
      if (!best || score > best.score) best = { score, matchedName: name, covered };
    }
    if (best) {
      scored.push({
        record,
        entityName: record.entityName || record.legalName || best.matchedName,
        matchedName: best.matchedName,
        sourceId: record.sourceId || null,
        matchScore: Math.round(best.score * 100) / 100,
        matchBasis: best.covered === 1 ? "every_word_of_the_name_appears" : "distinctive_token_overlap"
      });
    }
  }

  scored.sort((left, right) => right.matchScore - left.matchScore
    || String(left.entityName).length - String(right.entityName).length);

  // One entity per candidate. The same company is listed more than once across
  // and within sources — differing in case, punctuation, or nothing at all — and
  // returning it twice fills both slots with a choice that is not a choice. The
  // point of keeping two is to carry a real ambiguity forward.
  const distinct = [];
  const seen = new Set();
  for (const candidate of scored) {
    const key = normalizeEntityName(candidate.entityName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distinct.push(candidate);
    if (distinct.length >= Math.max(1, limit)) break;
  }
  return distinct;
}

// Finds designated names that literally appear in a free-text question, so the
// hub can screen whoever the user actually mentioned without a hardcoded alias
// table. Short names are skipped because they generate noise, not signal.
// A short Latin alias has to appear as a word, not as a run of letters inside
// one. Without this, "IFIC" matched inside "classification" and reported Iran
// Foreign Investment Company for any English question that used the word, and
// "NADA" matched inside "Canada". Both were real screening hits on the page.
//
// CJK names are exempt: written without spaces, they have no word boundary to
// test, and the minimum length already keeps them from matching fragments.
const LATIN_ONLY = /^[\x20-\x7e]+$/;
const boundary = (character) => character === undefined || !/[a-z0-9]/i.test(character);

function mentionsAsWord(haystack, needle) {
  if (!LATIN_ONLY.test(needle)) return haystack.includes(needle);
  for (let from = 0; ; from += 1) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    if (boundary(haystack[at - 1]) && boundary(haystack[at + needle.length])) return true;
    from = at;
  }
}

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
        : name.length >= minLength && mentionsAsWord(rawHaystack, name.toLowerCase());
      if (!mentioned) continue;
      hits.push({ record, matchedName: name });
      break;
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

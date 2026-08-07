// The corporate parent chain, from the register that publishes it.
//
// The ownership step asked the user to type a shareholding structure. For a
// company with a Legal Entity Identifier that is asking for something already
// published: GLEIF holds the direct and ultimate parent of every LEI that has
// declared one, free, without a key.
//
// What GLEIF's parent relationship means, precisely, because the difference
// decides what this can be used for:
//
//   It is the ACCOUNTING CONSOLIDATING parent — the entity that prepares
//   consolidated financial statements including this one. It is declared by the
//   entity itself and validated by the issuing LOU.
//
//   It is NOT a shareholding percentage. GLEIF publishes no percentages at all.
//
// OFAC's 50 Percent Rule turns on ownership in the aggregate, so a consolidating
// parent is evidence about the chain and never the conclusion. It answers "who
// sits above this company", which is the question a reviewer cannot answer from
// a name — and leaves "how much do they own" open, which is the question the
// user still has to.

import { readNormalized } from "./data-layer/storage.js";
import { fetchPublicFile } from "./data-layer/http.js";
import { nameVariants, normalizeEntityName, scoreNameMatch } from "./entity-matching.js";

// The registry entry this resolver is the implementation of, so the coverage
// page's claim that the ownership step reads it can be checked against code.
export const SOURCE_ID = "gleif-lei";
const API = "https://api.gleif.org/api/v1/lei-records";
const ACCEPT = "application/vnd.api+json";

// Which registrations may be used, stated as what is allowed rather than as what
// is forbidden.
//
// It was a deny-list — DUPLICATE, ANNULLED, MERGED, RETIRED, TRANSFERRED — and
// LAPSED was not on it, so a lapsed registration passed as usable. Asking for
// "Ericsson" resolved to Ericsson Limited in Hong Kong, whose LEI had lapsed,
// and its parents were then reported as this counterparty's chain. Anything the
// register invents next would have been let through the same way; a list of what
// counts cannot fail open.
const MEANING = "GLEIF 的母公司关系指会计合并母公司（由实体自行申报、发行机构校验），不含持股比例；OFAC 50% 规则需要的是合计持股，因此该链条是线索而非结论。";

// How many records a person can usefully be shown at once. Past this the list
// stops being a choice and becomes a search result, and a search result is what
// the reviewer came here to avoid.
const MAX_CHOICES = 6;
// Containment — the register holds a name that has this one inside it.
const NEAR_ENOUGH_TO_OFFER = 0.85;

const USABLE_REGISTRATION = new Set(["ISSUED", "PENDING_TRANSFER", "PENDING_ARCHIVAL"]);
const registrationOf = (item) => String(item.registrationStatus || "").toUpperCase();
const usableRegistration = (item) => USABLE_REGISTRATION.has(registrationOf(item));

// A live registration outranks a lapsed one, and an active entity a dissolved
// one. Both are the register's own statements about standing, and neither was
// being read: the previous sort looked only at entity status, so among three
// equally-named records it settled nothing and left whatever order the API
// happened to return.
const rank = (item) => (usableRegistration(item) ? 0 : 1) * 2 + (item.status === "ACTIVE" ? 0 : 1);
const byStanding = (left, right) => rank(left) - rank(right);

// A candidate as a person has to read it to choose. The names are identical by
// construction, so everything that distinguishes them is here.
const present = (item) => ({
  lei: item.lei,
  name: item.name,
  country: item.country,
  city: item.city,
  status: item.status,
  registrationStatus: item.registrationStatus,
  sourceUrl: item.sourceUrl
});

async function gleif(url) {
  const file = await fetchPublicFile(url, { accept: ACCEPT, maxBytes: 4 * 1024 * 1024, attempts: 2 });
  return JSON.parse(file.bytes.toString("utf8"));
}

const describe = (record) => {
  const entity = record?.attributes?.entity || {};
  const address = entity.legalAddress || {};
  return {
    lei: record?.id || null,
    name: entity.legalName?.name || null,
    country: address.country || null,
    city: address.city || null,
    status: entity.status || null,
    // The register's own verdict on the record. Two LEIs carry the legal name
    // VOLKSWAGEN AKTIENGESELLSCHAFT and GLEIF marks one of them DUPLICATE — so
    // which to use is published, not something to guess at or to surface as an
    // ambiguity for the reader to resolve.
    registrationStatus: record?.attributes?.registration?.status || null,
    // The register's own page, so a reviewer can check the claim rather than
    // take this system's word for the chain.
    sourceUrl: record?.id ? `https://search.gleif.org/#/record/${record.id}` : null
  };
};

// One step up and the top of the chain. GLEIF exposes the whole tree, but a
// reviewer resolving a counterparty needs the immediate holder and the entity
// that consolidates it; everything between is detail for a case that has already
// been escalated.
async function parentsOf(lei) {
  const relations = {};
  for (const kind of ["direct-parent", "ultimate-parent"]) {
    try {
      const payload = await gleif(`${API}/${encodeURIComponent(lei)}/${kind}`);
      if (payload?.data) relations[kind] = describe(payload.data);
    } catch (error) {
      // A 404 here is the register saying "this entity declared none", which is
      // a finding. Anything else is a failure to look, and the two must not be
      // reported as the same thing.
      relations[kind] = error.status === 404 ? null : { unavailable: String(error.message).slice(0, 120) };
    }
  }
  return relations;
}

export async function resolveOwnership(name, { chosenLei = null, answered = false } = {}) {
  const legalName = String(name || "").trim();
  if (legalName.length < 3) return null;

  // A record the user picked is fetched by its identifier, not searched for
  // again. The search is what was ambiguous; re-running it and hoping the same
  // record comes back would put the answer at the mercy of the thing that
  // needed a person in the first place.
  if (chosenLei) {
    const subject = await gleif(`${API}/${encodeURIComponent(chosenLei)}`)
      .then((payload) => describe(payload?.data))
      .catch(() => null);
    if (subject?.lei) {
      const relations = await parentsOf(subject.lei);
      return {
        queried: legalName,
        subject,
        // Who settled the identity travels with the answer: this chain was not
        // resolved from the name, it was confirmed by the reviewer.
        identifiedBy: "user",
        otherCandidates: [],
        directParent: relations["direct-parent"] || null,
        ultimateParent: relations["ultimate-parent"] || null,
        meaning: MEANING
      };
    }
  }

  // Ask the register the way it records, not the way people write.
  //
  // Volkswagen AG is registered as VOLKSWAGEN AKTIENGESELLSCHAFT, and asking for
  // the abbreviation returned six subsidiaries without the company among them —
  // the lookup was failing on the query, not on the matching. Both forms are
  // asked for.
  //
  // Two filters, pooled, because neither finds the entity on its own.
  //
  // `entity.legalName` matches on words, and the words in a legal name include
  // its legal form. Asking it for "Samsung Electronics Co., Ltd." returned
  // TRANSLINK (LTD) LTD, an entity literally called "Ltd", and Konya Maritime
  // LTD — three companies that share nothing with the query but the word Ltd,
  // and the real Samsung was in none of the twenty-five rows.
  //
  // `fulltext` searches the record rather than the name field and finds what the
  // other misses: "Robert Bosch Gesellschaft mit beschränkter Haftung" comes
  // back first for "Robert Bosch", where the name filter never returned it. It
  // is noisier — a query for "Ericsson" leads with a Swedish person of that
  // surname — which is why the pool is ranked here rather than trusted in the
  // order the register returned it.
  const returned = [];
  const seenLei = new Set();
  let reached = false;
  for (const variant of nameVariants(legalName)) {
    for (const filter of ["entity.legalName", "fulltext"]) {
      let payload;
      try {
        payload = await gleif(`${API}?filter%5B${filter}%5D=${encodeURIComponent(variant)}&page%5Bsize%5D=100`);
        reached = true;
      } catch (error) {
        if (!reached && !returned.length) return { queried: legalName, unavailable: String(error.message).slice(0, 160), candidates: [] };
        continue;
      }
      for (const record of payload?.data || []) {
        const item = describe(record);
        if (!item.lei || seenLei.has(item.lei)) continue;
        seenLei.add(item.lei);
        returned.push(item);
      }
    }
  }
  if (!returned.length) return { queried: legalName, candidates: [], notInRegister: true };

  // The register's name filter is not an exact match. Searching for
  // "Huawei Technologies Co., Ltd." returns TRANSLINK (LTD) LTD in the United
  // Kingdom as its first result — a different company entirely. Walking that
  // one's parents would attribute another company's ownership to this
  // counterparty, which is the worst thing this lookup could do, so a candidate
  // has to actually be the name that was asked for.
  // Identical after normalisation, and nothing less.
  //
  // A containment score of 0.85 accepted "Volkswagen Autoversicherung AG" for
  // "Volkswagen AG" and reported Allianz SE as the parent — a different company,
  // a different owner, in a compliance file. The cost of being strict is that a
  // user occasionally types a chain the register already had; the cost of being
  // loose is a wrong owner presented as a looked-up fact. Those are not
  // comparable.
  //
  // What strictness does not do is settle which of several identically named
  // records is meant. Normalisation folds the legal form, so SAMSUNG ELECTRONICS
  // GMBH in Germany, SAMSUNG ELECTRONICS COMPANY LIMITED in India and SAMSUNG
  // ELECTRONICS HOLDING GMBH all reduce to one string and all score 1.0. Taking
  // the first was a coin toss reported as a lookup. Where the register cannot
  // separate them, neither can this, and the answer is to ask rather than to
  // pick — the reviewer knows which company they are trading with.
  const scored = returned.map((item) => ({ ...item, match: scoreNameMatch(legalName, item.name) }));
  const candidates = scored
    .filter((item) => item.match.basis === "normalized_name_identical")
    .filter(usableRegistration)
    .map((item) => ({ ...item, matchScore: item.match.score }))
    .sort(byStanding);

  if (!candidates.length) {
    // Nothing carries the name exactly. The pool still holds records that
    // contain it, and where there are few of them they are worth offering: a
    // reviewer who typed "Robert Bosch" recognises "Robert Bosch Gesellschaft
    // mit beschränkter Haftung" instantly.
    //
    // Where there are many, they are not worth offering. "Bosch" contains-matches
    // ninety-two entities including two Dutch dairy farms, and six of those
    // presented as a choice is a lottery with the system's authority behind it.
    // The useful answer there is that the name is too generic to identify a
    // company, which is a thing the reviewer can act on.
    const near = scored
      .filter((item) => item.match.score >= NEAR_ENOUGH_TO_OFFER)
      .filter(usableRegistration)
      .sort((left, right) => right.match.score - left.match.score || byStanding(left, right));
    return {
      queried: legalName,
      candidates: [],
      noConfidentMatch: true,
      ...(near.length && near.length <= MAX_CHOICES
        ? { suggestions: near.map(present) }
        : near.length > MAX_CHOICES ? { tooGeneric: near.length } : {}),
      // What the register did return and why it was not used, so the reader can
      // see this was a deliberate rejection rather than an empty search — and
      // can recognise their company if it is in the list under another name.
      rejected: scored.slice(0, 3).map((item) => ({
        name: item.name, lei: item.lei, country: item.country,
        why: item.match.basis === "one_normalized_name_contains_the_other"
          ? "名称相近但不完全相同，不能据此归属所有权"
          : "名称不匹配"
      }))
    };
  }

  // Several records carry this name and the register ranks none of them above
  // the others. Walking one would produce a tree of parents belonging to
  // whichever company the API happened to return first, which is worse than
  // none — so nothing is walked and the choice goes to the reviewer.
  const contenders = candidates.filter((item) => rank(item) === rank(candidates[0]));
  // The reviewer was shown these and chose none of them. That is an answer — the
  // register does not hold the counterparty under this name — and it must not
  // send the question round again, nor quietly fall back to walking the first
  // candidate, which is the coin toss the question was asked to avoid.
  if (contenders.length > 1 && answered) {
    return { queried: legalName, candidates: [], noConfidentMatch: true, noneOfTheCandidates: true };
  }
  if (contenders.length > 1) {
    return {
      queried: legalName,
      ambiguous: true,
      // Country, city and identifier, because the names are identical after
      // normalisation and there is nothing in the name left to choose on.
      candidates: contenders.slice(0, MAX_CHOICES).map(present),
      moreCandidates: Math.max(0, contenders.length - MAX_CHOICES),
      meaning: MEANING
    };
  }

  // Only the best match is walked. Walking several would produce a tree of
  // parents belonging to different companies, which is worse than none.
  const subject = candidates[0];
  const relations = await parentsOf(subject.lei);

  return {
    queried: legalName,
    subject,
    identifiedBy: "name",
    otherCandidates: candidates.slice(1),
    directParent: relations["direct-parent"] || null,
    ultimateParent: relations["ultimate-parent"] || null,
    // Carried with the result so no caller has to remember it.
    meaning: MEANING
  };
}

// What OFAC itself says about who holds this party.
//
// GLEIF answers "who consolidates this company's accounts", which is a lead. This
// answers a different and narrower question: has the Treasury stated an ownership
// relationship involving this name. Where it has, that statement is the reason a
// party is on the list, and a reader looking at a match deserves it without
// running a second search.
//
// It cannot do the 50 Percent Rule and the caller must not present it as though
// it could. Every edge in the source connects two parties that are already
// designated, and none carries a share — the unlisted company held 50% by two
// designated owners, which is the case the rule exists for, appears in no
// sanctions list by construction.
export async function statedOwnership(name) {
  const query = String(name || "").trim();
  if (query.length < 3) return null;
  const { records } = await readNormalized("ofac-ownership").catch(() => ({ records: [] }));
  if (!records?.length) return null;

  const target = normalizeEntityName(query);
  const hits = [];
  for (const record of records) {
    const asset = normalizeEntityName(record.entityName || "");
    const owner = normalizeEntityName(record.ownerName || "");
    // Both directions matter: a reader wants to know who holds this party and
    // what this party holds, and one query should answer both.
    const side = asset === target ? "owned_by" : owner === target ? "owns" : null;
    if (!side) continue;
    hits.push({
      side,
      owner: record.ownerName,
      asset: record.entityName,
      ownerDesignated: record.ownerDesignated,
      assetDesignated: record.assetDesignated,
      role: record.role,
      percentage: record.percentage || null,
      sourceUrl: record.sourceUrl
    });
    if (hits.length >= 8) break;
  }
  if (!hits.length) return null;
  return {
    queried: query,
    hits,
    // Carried with the result, because a relationship with no share attached is
    // evidence of a relationship and nothing more.
    meaning: "OFAC 声明的所有权关系不含持股比例，且其两端通常都已被列名；它说明一条命中为何存在，不能用来计算 50% 合计持股。"
  };
}

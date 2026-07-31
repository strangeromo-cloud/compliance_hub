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

import { fetchPublicFile } from "./data-layer/http.js";
import { scoreNameMatch } from "./entity-matching.js";

const API = "https://api.gleif.org/api/v1/lei-records";
const ACCEPT = "application/vnd.api+json";

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

export async function resolveOwnership(name) {
  const legalName = String(name || "").trim();
  if (legalName.length < 3) return null;

  let payload;
  try {
    payload = await gleif(`${API}?filter%5Bentity.legalName%5D=${encodeURIComponent(legalName)}&page%5Bsize%5D=3`);
  } catch (error) {
    return { queried: legalName, unavailable: String(error.message).slice(0, 160), candidates: [] };
  }

  const returned = (payload?.data || []).map(describe).filter((item) => item.lei);
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
  const scored = returned.map((item) => ({ ...item, match: scoreNameMatch(legalName, item.name) }));
  const candidates = scored
    .filter((item) => item.match.basis === "normalized_name_identical")
    .map((item) => ({ ...item, matchScore: item.match.score }));

  if (!candidates.length) {
    return {
      queried: legalName,
      candidates: [],
      noConfidentMatch: true,
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

  // Only the best match is walked. Walking several would produce a tree of
  // parents belonging to different companies, which is worse than none.
  const subject = candidates[0];
  const relations = await parentsOf(subject.lei);

  return {
    queried: legalName,
    subject,
    otherCandidates: candidates.slice(1),
    directParent: relations["direct-parent"] || null,
    ultimateParent: relations["ultimate-parent"] || null,
    // Carried with the result so no caller has to remember it.
    meaning: "GLEIF 的母公司关系指会计合并母公司（由实体自行申报、发行机构校验），不含持股比例；OFAC 50% 规则需要的是合计持股，因此该链条是线索而非结论。"
  };
}

// The publisher's own matcher over the publisher's own list.
//
// Screening currently runs a hand-written comparison over a downloaded copy of
// the Consolidated Screening List. That is defensible — every match reports what
// it matched on — but it is this system's opinion of whether two names are the
// same, and the International Trade Administration publishes its own answer to
// that question over the same data, with fuzzy_name=true.
//
// Where a key is configured, the official matcher answers for trade-csl and its
// verdict is labelled as the publisher's. Where it is not, nothing changes: the
// local snapshot is screened exactly as before. A screening tool must not
// silently depend on a service it may not be able to reach.
//
// Getting a key: https://developer.trade.gov — free, no cost, one form. As of
// 2026-07-28 that host serves an expired certificate for *.trade.gov, so signup
// is unavailable to anyone until Commerce renews it.

import { fetchPublicFile } from "./http.js";

const SEARCH = "https://data.trade.gov/consolidated_screening_list/v1/search";
export const CREDENTIAL = "TRADE_GOV_API_KEY";

export const isConfigured = () => Boolean(process.env[CREDENTIAL]);

// The API returns its own match scores and the source list each hit belongs to,
// which is exactly what the local matcher has to reconstruct.
function normalize(hit) {
  const addresses = (hit.addresses || [])
    .map((address) => [address.address, address.city, address.country].filter(Boolean).join(" "))
    .filter(Boolean);
  return {
    sourceId: "trade-csl",
    recordId: hit.id || null,
    entityName: hit.name || null,
    aliases: hit.alt_names || [],
    sourceList: hit.source || null,
    country: hit.countries?.[0] || null,
    addresses,
    registrationNumber: (hit.ids || []).map((id) => id.number).filter(Boolean)[0] || null,
    restrictionType: hit.federal_register_notice || null,
    sourceUrl: hit.source_information_url || null,
    // The publisher's own score, kept under its own name so it is never confused
    // with the local comparison's.
    officialScore: typeof hit.score === "number" ? hit.score : null,
    matchedBy: "ita_consolidated_screening_list_api",
    humanReviewRequired: true
  };
}

// One name at a time, because the API scores per query and a combined query
// would return hits that cannot be attributed back to a name the user wrote.
export async function searchName(name, { limit = 5 } = {}) {
  const key = process.env[CREDENTIAL];
  if (!key) return null;
  const query = String(name || "").trim();
  if (query.length < 3) return null;

  const url = `${SEARCH}?name=${encodeURIComponent(query)}&fuzzy_name=true&size=${limit}`;
  try {
    const file = await fetchPublicFile(url, {
      accept: "application/json",
      headers: { "subscription-key": key },
      maxBytes: 4 * 1024 * 1024,
      attempts: 2
    });
    const payload = JSON.parse(file.bytes.toString("utf8"));
    return {
      query,
      total: payload.total ?? (payload.results || []).length,
      hits: (payload.results || []).map(normalize)
    };
  } catch (error) {
    // A screening lookup that fails must not look like a screening lookup that
    // found nothing. The caller falls back to the local snapshot and says so.
    return { query, unavailable: String(error.message).slice(0, 160), hits: [] };
  }
}

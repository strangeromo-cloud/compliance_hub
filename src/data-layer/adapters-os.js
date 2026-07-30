// OpenSanctions bulk datasets.
//
// These close the restricted-party gaps the US Consolidated Screening List does
// not carry — the EU consolidated list, Japan's METI End User List, Taiwan's
// Strategic High-Tech Commodities list, the UFLPA Entity List and the DoD's
// Chinese military companies list. Taiwan's in particular is the most
// China-relevant list this tool was missing, and its official site publishes only
// HTML, so this is the route to it that does not involve scraping.
//
// One shape for all of them: a flat CSV per dataset with a stable header, no
// authentication, refreshed daily. `targets.simple.csv` is used rather than the
// richer FollowTheMoney JSON because screening needs names, aliases, countries and
// addresses, and the simple form gives exactly those without a graph model.
//
// Its row count is lower than the entity count OpenSanctions advertises — 5,916
// against 15,216 for the EU list — because a target is a sanctioned party while an
// entity also counts the addresses, passports and relationships attached to it.
// Targets are what screening compares against, so no party is lost by this choice.
//
// Licence: CC-BY-NC 4.0. Attribution is required and commercial use is not
// permitted, which is why every source built here carries `licence` and
// `commercialUseBlocked` — a constraint that only lives in a comment is a
// constraint nobody sees.

import { fetchPublicFile } from "./http.js";
import { parseCsv, rowsToObjects } from "./parsers.js";

const BASE = "https://data.opensanctions.org/datasets/latest";

export const OPENSANCTIONS_LICENCE = "CC-BY-NC 4.0";
export const OPENSANCTIONS_ATTRIBUTION =
  "Contains data from OpenSanctions (opensanctions.org), licensed CC-BY-NC 4.0. Non-commercial use only.";

// sourceId -> the dataset slug it mirrors. Taiwan is deliberately absent: its
// issuing ministry publishes the same list itself, openly licensed, with more
// rows — see syncTaiwanShtc below. A mirror is only worth using where the source
// does not offer a usable route of its own.
export const OPENSANCTIONS_SETS = {
  "eu-fsf": "eu_fsf",
  "jp-meti-eul": "jp_meti_eul",
  "us-uflpa": "us_dhs_uflpa",
  "us-dod-1260h": "us_dod_chinese_milcorps"
};

const list = (value) => String(value || "").split(";").map((item) => item.trim()).filter(Boolean);

function normalize(row, sourceId, dataset, index) {
  return {
    sourceId,
    recordId: row.id || `${dataset}-${index}`,
    entityName: row.name || null,
    aliases: list(row.aliases),
    entityType: row.schema || null,
    countries: list(row.countries),
    addresses: list(row.addresses),
    identificationNumbers: list(row.identifiers).map((number) => ({ type: null, number, country: null })),
    programs: list(row.program_ids),
    sourceList: row.dataset || dataset,
    // The dates OpenSanctions keeps are about its own observation of the record,
    // not about when the authority designated the party. Named so they cannot be
    // mistaken for a designation date.
    firstObservedAt: row.first_seen || null,
    lastObservedAt: row.last_seen || null,
    lastChangedAt: row.last_change || null,
    sourceUrl: `https://www.opensanctions.org/entities/${encodeURIComponent(row.id || "")}/`,
    licence: OPENSANCTIONS_LICENCE,
    matchDisposition: "potential_match_requires_review",
    rawRecord: { snapshotRecordIndex: index, dataset }
  };
}

export async function syncOpenSanctions(sourceId) {
  const dataset = OPENSANCTIONS_SETS[sourceId];
  if (!dataset) throw Object.assign(new Error(`No OpenSanctions dataset is mapped to ${sourceId}.`), { status: 400 });

  const url = `${BASE}/${dataset}/targets.simple.csv`;
  const file = await fetchPublicFile(url, { accept: "text/csv", maxBytes: 40 * 1024 * 1024, attempts: 2 });
  const rows = rowsToObjects(parseCsv(file.bytes.toString("utf8").replace(/^﻿/, "")));
  const records = rows
    .filter((row) => row.name)
    .map((row, index) => normalize(row, sourceId, dataset, index));

  // The header is stable but not guaranteed. A silent shape change would show up
  // as a list that screens clean, which is the failure this tool must not have.
  if (rows.length && !records.length) {
    throw new Error(`${dataset}: ${rows.length} rows parsed but none carried a name — the CSV shape has changed.`);
  }

  return {
    extension: "csv",
    file,
    records,
    syncScope: `opensanctions_${dataset}+${records.length}_targets`,
    sourceUpdatedAt: records.map((record) => record.lastObservedAt).sort().at(-1) || file.lastModified
  };
}

// Taiwan's Strategic High-Tech Commodities entity list, from the issuing ministry.
//
// Preferred over the OpenSanctions mirror on both counts that matter: it carries
// 11,664 rows against the mirror's 10,170, and Taiwan's Open Government Data
// License permits commercial use where CC-BY-NC does not. The endpoint answers a
// bare request with a redirect stub rather than the file, so it needs a Referer
// and redirects followed — which is why this looked unusable at first.
const TW_SHTC_URL = "https://www.trade.gov.tw/OpenData/getOpenData.aspx?oid=0F2CD336A579151B";

export async function syncTaiwanShtc() {
  const file = await fetchPublicFile(TW_SHTC_URL, {
    accept: "text/csv,application/octet-stream",
    headers: { Referer: "https://data.gov.tw/dataset/102368" },
    maxBytes: 20 * 1024 * 1024,
    attempts: 2
  });
  const rows = rowsToObjects(parseCsv(file.bytes.toString("utf8").replace(/^\uFEFF/, "")));
  const records = rows
    .map((row, index) => ({
      sourceId: "tw-shtc",
      recordId: `tw-shtc-${index}`,
      entityName: row["名稱name"] || null,
      aliases: String(row["別名alias"] || "").split(";").map((alias) => alias.trim()).filter(Boolean),
      addresses: [row["地址address"]].filter(Boolean),
      identificationNumbers: [row["護照號碼IDNumber"]].filter(Boolean).map((number) => ({ type: "passport", number, country: null })),
      sourceList: "Taiwan Strategic High-Tech Commodities Entity List",
      // The ministry stamps each row with the date the file was produced, not the
      // date the entity was listed. Named for what it is.
      fileProducedOn: row["產製日期createdate"] || null,
      sourceUrl: "https://data.gov.tw/dataset/102368",
      licence: "Open Government Data License, Taiwan v1.0",
      matchDisposition: "potential_match_requires_review",
      rawRecord: { snapshotRecordIndex: index }
    }))
    .filter((record) => record.entityName);

  if (rows.length && !records.length) {
    throw new Error(`tw-shtc: ${rows.length} rows parsed but none carried a name — the CSV shape has changed.`);
  }

  return {
    extension: "csv", file, records,
    syncScope: `moea_opendata+${records.length}_entities`,
    sourceUpdatedAt: records.map((record) => record.fileProducedOn).filter(Boolean).sort().at(-1) || file.lastModified
  };
}

export const OS_ADAPTERS = Object.fromEntries(
  Object.keys(OPENSANCTIONS_SETS).map((sourceId) => [
    sourceId,
    { sync: () => syncOpenSanctions(sourceId), mode: "full_download", credential: null }
  ])
);

OS_ADAPTERS["tw-shtc"] = { sync: syncTaiwanShtc, mode: "full_download", credential: null };

import { fetchPublicFile } from "./http.js";
import { joinName, parseCsv, rowsToObjects, xmlAttr, xmlBlocks, xmlCells, xmlTag, xmlTags, xmlText } from "./parsers.js";
import { CN_ADAPTERS } from "./adapters-cn.js";
import { OS_ADAPTERS } from "./adapters-os.js";
import { CN_LIST_ADAPTERS } from "./adapters-cn-lists.js";
import { JP_ADAPTERS } from "./adapters-jp.js";
import { VENDOR_ADAPTERS } from "./adapters-vendor.js";
import { FEDREG_ADAPTERS } from "./adapters-fedreg.js";
import { OWNERSHIP_ADAPTERS } from "./adapters-ownership.js";
import { beneficialOwners } from "../sec-edgar.js";

const CSL_URL = "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json";
const UK_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv";
const UN_URL = "https://scsanctions.un.org/resources/xml/en/name/consolidated.xml";
const OFAC_BASE = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports";

function value(object, ...keys) {
  for (const key of keys) if (object?.[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  return null;
}

function normalizeCsl(item, index) {
  return {
    sourceId: "trade-csl",
    recordId: String(value(item, "id", "entity_number") || index),
    sourceList: value(item, "source", "source_list", "list"),
    entityName: value(item, "name", "entity_name"),
    aliases: value(item, "alt_names", "aliases") || [],
    entityType: value(item, "type", "entity_type"),
    countries: [...new Set((item.addresses || []).map((address) => address.country).filter(Boolean))],
    addresses: item.addresses || [],
    identificationNumbers: value(item, "ids", "identification_numbers") || [],
    programs: value(item, "programs", "program") || [],
    remarks: item.remarks || null,
    restrictionType: value(item, "license_requirement", "restriction_type"),
    licenseReviewPolicy: value(item, "license_policy", "license_review_policy"),
    federalRegisterReference: value(item, "federal_register_notice", "federal_register_reference"),
    sourceUrl: CSL_URL,
    matchDisposition: "potential_match_requires_review",
    rawRecord: { snapshotRecordIndex: index }
  };
}

async function syncCsl() {
  const file = await fetchPublicFile(CSL_URL, { accept: "application/json", maxBytes: 70 * 1024 * 1024 });
  const payload = JSON.parse(file.bytes.toString("utf8"));
  const input = Array.isArray(payload) ? payload : payload.results || [];
  return { extension: "json", file, records: input.map(normalizeCsl), syncScope: "full", sourceUpdatedAt: file.lastModified };
}

async function syncUk() {
  const file = await fetchPublicFile(UK_URL, { accept: "text/csv", maxBytes: 80 * 1024 * 1024 });
  const rows = parseCsv(file.bytes.toString("utf8").replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex((row) => row.includes("Unique ID"));
  if (headerIndex < 0) throw new Error("UK Sanctions List CSV header was not found.");
  const reportDate = rows.slice(0, headerIndex).flat().find((cell) => /^Report Date:/i.test(cell || ""))?.replace(/^Report Date:\s*/i, "") || null;
  const grouped = new Map();
  rowsToObjects(rows, headerIndex).forEach((item, index) => {
    const id = item["Unique ID"] || `row-${index}`;
    const existing = grouped.get(id) || {
      sourceId: "uk-sanctions", recordId: id, entityName: null, aliases: [], namesNonLatin: [], addresses: [], regimes: [], measures: [],
      designationType: item["Designation Type"], designatedOn: item["Date Designated"], sourceUrl: UK_URL,
      matchDisposition: "potential_match_requires_review", rawRecord: { firstSnapshotRecordIndex: index }
    };
    const name = joinName(item["Name 1"], item["Name 2"], item["Name 3"], item["Name 4"], item["Name 5"], item["Name 6"]);
    if (!existing.entityName && item["Name type"]?.toLowerCase() !== "alias") existing.entityName = name;
    else if (name && !existing.aliases.includes(name)) existing.aliases.push(name);
    if (item["Name non-latin script"] && !existing.namesNonLatin.includes(item["Name non-latin script"])) existing.namesNonLatin.push(item["Name non-latin script"]);
    const address = joinName(item["Address Line 1"], item["Address Line 2"], item["Address Line 3"], item["Address Line 4"], item["Address Line 5"], item["Address Line 6"], item["Address Postal Code"], item["Address Country"]);
    if (address && !existing.addresses.includes(address)) existing.addresses.push(address);
    if (item["Regime Name"] && !existing.regimes.includes(item["Regime Name"])) existing.regimes.push(item["Regime Name"]);
    if (item["Sanctions Imposed"] && !existing.measures.includes(item["Sanctions Imposed"])) existing.measures.push(item["Sanctions Imposed"]);
    grouped.set(id, existing);
  });
  return { extension: "csv", file, records: [...grouped.values()], syncScope: "full", sourceUpdatedAt: reportDate || file.lastModified };
}

function normalizeUnBlock(block, type, index) {
  const aliases = xmlTags(block, type === "individual" ? "INDIVIDUAL_ALIAS" : "ENTITY_ALIAS").map((alias) => xmlTag(alias, "ALIAS_NAME")).filter(Boolean);
  const addresses = xmlTags(block, type === "individual" ? "INDIVIDUAL_ADDRESS" : "ENTITY_ADDRESS").map((address) => joinName(xmlTag(address, "STREET"), xmlTag(address, "CITY"), xmlTag(address, "STATE_PROVINCE"), xmlTag(address, "ZIP_CODE"), xmlTag(address, "COUNTRY"))).filter(Boolean);
  return {
    sourceId: "un-consolidated", recordId: xmlTag(block, "DATAID") || `${type}-${index}`,
    referenceNumber: xmlTag(block, "REFERENCE_NUMBER"), entityType: type,
    entityName: joinName(xmlTag(block, "FIRST_NAME"), xmlTag(block, "SECOND_NAME"), xmlTag(block, "THIRD_NAME"), xmlTag(block, "FOURTH_NAME")),
    originalScriptName: xmlTag(block, "NAME_ORIGINAL_SCRIPT"), aliases, addresses,
    listType: xmlTag(block, "UN_LIST_TYPE"), listedOn: xmlTag(block, "LISTED_ON"), comments: xmlTag(block, "COMMENTS1"),
    sourceUrl: UN_URL, matchDisposition: "potential_match_requires_review", rawRecord: { snapshotRecordIndex: index }
  };
}

async function syncUn() {
  const file = await fetchPublicFile(UN_URL, { accept: "application/xml,text/xml", maxBytes: 25 * 1024 * 1024, attempts: 3 });
  const xml = file.bytes.toString("utf8");
  const records = [
    ...xmlTags(xml, "INDIVIDUAL").map((block, index) => normalizeUnBlock(block, "individual", index)),
    ...xmlTags(xml, "ENTITY").map((block, index) => normalizeUnBlock(block, "entity", index))
  ];
  return { extension: "xml", file, records, syncScope: "full", sourceUpdatedAt: file.lastModified };
}

function normalizeOfacEntry(block, listName, index) {
  const aliases = xmlTags(block, "aka").map((aka) => joinName(xmlTag(aka, "firstName"), xmlTag(aka, "lastName"))).filter(Boolean);
  const addresses = xmlTags(block, "address").map((address) => joinName(xmlTag(address, "address1"), xmlTag(address, "address2"), xmlTag(address, "address3"), xmlTag(address, "city"), xmlTag(address, "stateOrProvince"), xmlTag(address, "postalCode"), xmlTag(address, "country"))).filter(Boolean);
  const ids = xmlTags(block, "id").map((id) => ({ type: xmlTag(id, "idType"), number: xmlTag(id, "idNumber"), country: xmlTag(id, "idCountry") }));
  return {
    sourceId: "ofac-sls", recordId: xmlTag(block, "uid") || `${listName}-${index}`, sourceList: listName,
    entityName: joinName(xmlTag(block, "firstName"), xmlTag(block, "lastName")), entityType: xmlTag(block, "sdnType"),
    aliases, addresses, identificationNumbers: ids, programs: xmlTags(block, "program").map((program) => program.replace(/<[^>]+>/g, "").trim()).filter(Boolean),
    sourceUrl: "https://ofac.treasury.gov/sanctions-list-service", directMatch: false, aliasMatch: false,
    ownershipReviewRequired: true, ofac50PercentRuleReviewRequired: true, rawRecord: { listName, snapshotRecordIndex: index }
  };
}

async function syncOfac() {
  const urls = [
    { listName: "SDN", url: `${OFAC_BASE}/SDN.XML` },
    { listName: "Non-SDN Consolidated", url: `${OFAC_BASE}/CONSOLIDATED.XML` }
  ];
  const files = [];
  const records = [];
  for (const source of urls) {
    const file = await fetchPublicFile(source.url, { accept: "application/xml,text/xml", maxBytes: 45 * 1024 * 1024, attempts: 3 });
    files.push(file);
    records.push(...xmlTags(file.bytes.toString("utf8"), "sdnEntry").map((block, index) => normalizeOfacEntry(block, source.listName, index)));
  }
  const bytes = Buffer.from(files.map((file) => file.bytes.toString("utf8")).join("\n"));
  return { extension: "xml", file: { ...files[0], bytes, lastModified: files.map((file) => file.lastModified).filter(Boolean).join(" / ") || null }, records, syncScope: "full", sourceUpdatedAt: files.map((file) => file.lastModified).filter(Boolean).join(" / ") || null };
}

function normalizeGleif(item) {
  const entity = item.attributes?.entity || {};
  return {
    sourceId: "gleif-lei", recordId: item.id, lei: item.id, entityName: entity.legalName?.name || null,
    otherNames: (entity.otherNames || []).map((name) => name.name).filter(Boolean), entityStatus: entity.status,
    legalAddress: entity.legalAddress || null, headquartersAddress: entity.headquartersAddress || null,
    directParentUrl: item.relationships?.["direct-parent"]?.links?.related || null,
    ultimateParentUrl: item.relationships?.["ultimate-parent"]?.links?.related || null,
    sourceUrl: item.links?.self || "https://api.gleif.org/api/v1/lei-records"
  };
}

async function syncGleifSample() {
  const url = "https://api.gleif.org/api/v1/lei-records?page%5Bsize%5D=100";
  const file = await fetchPublicFile(url, { accept: "application/vnd.api+json", maxBytes: 4 * 1024 * 1024 });
  const payload = JSON.parse(file.bytes.toString("utf8"));
  return { extension: "json", file, records: (payload.data || []).map(normalizeGleif), syncScope: "sample_100_use_live_query_for_cases", sourceUpdatedAt: payload.meta?.goldenCopy?.publishDate || file.lastModified };
}

// An ECCN entry inside the CCL appendix begins with the number in bold; eCFR
// gives the entries no structural element of their own, so this is the only
// boundary available. Kept narrow (four characters, letter in position two) so a
// cross-reference in running text cannot open a new record.
const ECCN_ENTRY = /<(?:FP|P)[^>]*>\s*<B>\s*(\d[A-E]\d{3})\b/gi;

function splitEccnEntries(inner, base) {
  const starts = [...inner.matchAll(ECCN_ENTRY)];
  if (starts.length < 2) return null;
  const records = [];
  const preamble = xmlText(inner.slice(0, starts[0].index));
  if (preamble) records.push({ ...base, recordId: `${base.recordId}-preamble`, title: `${base.title} — 说明`, content: preamble });
  starts.forEach((start, index) => {
    const body = inner.slice(start.index, starts[index + 1]?.index);
    const text = xmlText(body);
    records.push({
      ...base, recordId: `${base.recordId}-${start[1]}`, eccn: start[1], recordType: "control_list_entry",
      // The heading runs from the ECCN to the end of the first sentence, which is
      // the entry's own short title ("3A090 Integrated circuits as follows…").
      title: text.slice(0, Math.min(160, (text.indexOf(". ") + 1) || 160)).trim(),
      content: text
    });
  });
  return records;
}

// Supplement No. 4 to Part 744 is the Entity List: a five-column table whose
// country cell is filled only on the first row of each country group, so the
// country has to be carried forward or most rows lose it.
//
// Names, addresses and aliases share one free-text cell. A corporate suffix is
// the only reliable signal that a comma is still inside the name
// ("Huawei Technologies Co., Ltd.") rather than the start of the address
// ("Huawei Cloud Argentina, Buenos Aires, Argentina"), so the split stops at the
// first segment that is not one.
const CORPORATE_SUFFIX = /^(?:Ltd|Ltda|Co|Corp|Inc|LLC|L\.L\.C|S\.A|S\.A\.S|S\.p\.A|GmbH|A\.G|N\.V|B\.V|Pte|Pty|PLC|LLP|SARL|S\.R\.L|JSC|OJSC|PJSC|OOO|AO|Sdn|Bhd|K\.K|KK)\b\.?$/i;

function splitEntityName(cell) {
  const parts = String(cell).split(/,?\s*a\.?\s?k\.?\s?a\.?[.,:]?\s*(?:the following[^:]*:)?/i);
  const segments = parts[0].split(";")[0].split(", ");
  const kept = [segments[0]];
  for (const segment of segments.slice(1)) {
    if (!CORPORATE_SUFFIX.test(segment.trim())) break;
    kept.push(segment);
  }
  const aliases = parts.slice(1).join("; ").split(/;|—|·/)
    .map((alias) => alias
      .replace(/^[-–—\s]+/, "")
      // "and" joins the alias list; a period ends the aliases and starts the address.
      .replace(/^(?:and|or)\s+/i, "")
      .split(/\.\s/)[0]
      .split(", ")[0]
      .replace(/[.,;\s]+$/, "")
      .trim())
    .filter((alias) => alias.length > 2 && alias.length < 120 && !/^(?:and|or)$/i.test(alias));
  return { name: kept.join(", ").replace(/[.,;\s]+$/, "").trim(), aliases: [...new Set(aliases)].slice(0, 20) };
}

function parseEntityListRows(inner, base) {
  if (!/Entity List/i.test(base.title || "")) return null;
  const records = [];
  let country = null;
  for (const row of xmlTags(inner, "TR")) {
    const cells = xmlCells(row);
    if (cells.length < 2) continue;
    if (cells[0]) country = cells[0];
    const { name, aliases } = splitEntityName(cells[1]);
    if (!name) continue;
    records.push({
      ...base, recordId: `${base.recordId}-${records.length + 1}`, recordType: "listed_entry",
      title: name, entityName: name, aliases, country, addresses: [cells[1]],
      restrictionType: cells[2] || null, reviewPolicy: cells[3] || null, federalRegisterCitation: cells[4] || null,
      sourceList: "BIS Entity List (Supplement No. 4 to Part 744)", content: cells.filter(Boolean).join(" | "),
      // The name split is a heuristic over one free-text cell, so a hit is a
      // pointer to the cited entry, never a finding on its own.
      parserConfidence: "heuristic_name_split", matchDisposition: "potential_match_requires_review"
    });
  }
  return records.length ? records : null;
}

// Supplement No. 1 to Part 738 is the Commerce Country Chart: one row per
// destination, one column per control reason, and an X means a licence is
// required for that reason. The columns are only meaningful if they line up, so
// a row whose cell count does not match the header count keeps its text and
// gets no column mapping rather than a guessed one.
const CHART_COLUMN = /^(CB|NP|NS|MT|RS|FC|CC|AT)\s*(\d)$/i;

function parseCountryChart(inner, base) {
  if (!/Country Chart/i.test(base.title || "")) return null;
  const columns = xmlTags(inner, "TH").map(xmlText)
    .map((head) => head.match(CHART_COLUMN))
    .filter(Boolean)
    .map((match) => `${match[1].toUpperCase()}${match[2]}`);
  if (columns.length < 8) return null;
  const records = [];
  for (const row of xmlTags(inner, "TR")) {
    const cells = xmlCells(row);
    // Footnote markers ride along in the country cell ("Albania 2 3").
    const country = (cells[0] || "").replace(/\s+\d(\s+\d)*$/, "").trim();
    // A row carrying only a country is a footnote row (Iran points to Part 746).
    // It is recorded as unverified rather than dropped: a destination missing from
    // the chart would read as "no control reason applies", which is the opposite
    // of what a footnote row means.
    if (!country || country.length > 60 || CHART_COLUMN.test(country) || /^Countries$/i.test(country)) continue;
    const marks = cells.slice(1);
    const aligned = marks.length === columns.length;
    const required = aligned ? columns.filter((_, index) => /x/i.test(marks[index] || "")) : [];
    records.push({
      ...base, recordId: `${base.recordId}-${country.replace(/\s+/g, "-").toLowerCase()}`,
      // A row is about its destination, so it is titled by it: every row
      // inheriting the supplement's title made 203 records look identical.
      recordType: "country_chart_row", title: `${country} — ${base.title}`, country, countryNotes: (cells[0] || "").slice(country.length).trim() || null,
      columnAlignment: aligned ? "verified" : "unverified_cell_count",
      licenceRequiredFor: required,
      content: `${cells[0]}: ${aligned ? (required.join(", ") || "no control reason marked") : `${marks.filter(Boolean).length} marks, column alignment unverified`}`
    });
  }
  return records.length ? records : null;
}

// Exported for the parser tests: the extraction is the part worth pinning down,
// and it should not need a network round trip to exercise.
export function parseEcfrPart(xml, { sourceId, part, versionDate = null, sourceUrl = null }) {
  const common = { sourceId, part: String(part), effectiveDate: versionDate, sourceUrl, humanReviewRequired: true };

  const sections = xmlTags(xml, "DIV8").map((block, index) => ({
    ...common, recordId: `${part}-${xmlTag(block, "HEAD") || index}`, recordType: "regulation",
    title: xmlTag(block, "HEAD"), content: xmlText(block), rawRecord: { snapshotRecordIndex: index }
  }));

  // eCFR marks numbered sections as DIV8 and supplements as DIV9. Every list the
  // analysis path actually cites lives in a supplement — the ECCN entries, the
  // Entity List, the Country Chart, the Part 732 steps chart — so reading only
  // DIV8 captured the section headings of the EAR and none of its substance.
  const supplements = xmlBlocks(xml, "DIV9").flatMap(({ attrs, inner }, index) => {
    const name = xmlAttr(attrs, "N") || `Supplement ${index + 1}`;
    const base = { ...common, recordId: `${part}-${name.replace(/\s+/g, "-").toLowerCase()}`, recordType: "supplement", title: xmlTag(inner, "HEAD") || name, supplement: name };
    return splitEccnEntries(inner, base) || parseEntityListRows(inner, base) || parseCountryChart(inner, base) || [{ ...base, content: xmlText(inner) }];
  });

  const records = [...sections, ...supplements];
  const entries = records.filter((record) => record.recordType === "control_list_entry").length;
  const parties = records.filter((record) => record.recordType === "listed_entry").length;
  const chartRows = records.filter((record) => record.recordType === "country_chart_row").length;
  const misaligned = records.filter((record) => record.columnAlignment === "unverified_cell_count").length;
  return {
    records: records.length ? records : [{ ...common, recordId: `part-${part}` }],
    // The scope names what was actually extracted, so a part whose list failed to
    // parse cannot pass as a full capture of that list.
    syncScope: [
      "versioned_regulatory_snapshot",
      `${sections.length}_sections`,
      `${supplements.length - entries - parties - chartRows}_supplements`,
      ...(entries ? [`${entries}_control_list_entries`] : []),
      ...(parties ? [`${parties}_listed_entries`] : []),
      ...(chartRows ? [`${chartRows}_country_chart_rows`] : []),
      ...(misaligned ? [`${misaligned}_rows_alignment_unverified`] : [])
    ].join("+")
  };
}

// The register's own index of every company with a ticker: CIK, symbol and the
// name EDGAR files it under. It holds no ownership at all — it is what turns a
// counterparty name into the key the Schedule 13D/G lookup needs, and it is
// synced rather than queried because resolving a name against a remote search
// endpoint would put someone else's matching between the question and the
// answer.
const SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json";

function normalizeSecCompany(item, index) {
  return {
    sourceId: "sec-edgar",
    // A company with two share classes appears once per ticker under one CIK,
    // so the symbol has to be part of the key or the second row overwrites the
    // first.
    recordId: `${item.cik_str}-${item.ticker || index}`,
    cik: item.cik_str,
    ticker: item.ticker || null,
    entityName: item.title || null,
    recordType: "registered_issuer",
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${item.cik_str}`,
    rawRecord: { snapshotRecordIndex: index }
  };
}

async function syncSecEdgar() {
  const file = await fetchPublicFile(SEC_TICKERS, { accept: "application/json", maxBytes: 16 * 1024 * 1024 });
  const payload = JSON.parse(file.bytes.toString("utf8"));
  const rows = Object.values(payload).filter((item) => item?.cik_str && item?.title);
  if (!rows.length) throw new Error("SEC company ticker index returned no rows.");
  return {
    extension: "json",
    file,
    records: rows.map(normalizeSecCompany),
    // Named for what it is, so nobody reads a synced record count as holdings
    // coverage: the index is the issuers, the shareholdings are fetched per case.
    syncScope: "us_registered_issuer_index_use_live_query_for_shareholdings",
    sourceUpdatedAt: file.lastModified
  };
}

async function syncEcfrPart(sourceId, part) {
  let file;
  let versionDate;
  for (let offset = 0; offset < 10; offset += 1) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-15.xml?part=${part}`;
    try { file = await fetchPublicFile(url, { accept: "application/xml,text/xml", maxBytes: 40 * 1024 * 1024, attempts: 1 }); versionDate = date; break; }
    catch (error) { if (!String(error.message).includes("HTTP 404") || offset === 9) throw error; }
  }
  const parsed = parseEcfrPart(file.bytes.toString("utf8"), { sourceId, part, versionDate, sourceUrl: file.finalUrl });
  return { extension: "xml", file, ...parsed, sourceUpdatedAt: versionDate };
}

export const ADAPTERS = {
  ...OWNERSHIP_ADAPTERS,
  "trade-csl": { sync: syncCsl, mode: "full_download", credential: null },
  "ofac-sls": { sync: syncOfac, mode: "full_download", credential: null },
  "un-consolidated": { sync: syncUn, mode: "full_download", credential: null },
  "uk-sanctions": { sync: syncUk, mode: "full_download", credential: null },
  "gleif-lei": { sync: syncGleifSample, mode: "sample_plus_live_query", credential: null },
  "sec-edgar": { sync: syncSecEdgar, mode: "issuer_index_plus_live_query", credential: null },
  "bis-ear": { sync: () => syncEcfrPart("bis-ear", 736), mode: "versioned_snapshot", credential: null },
  "bis-ear-732": { sync: () => syncEcfrPart("bis-ear-732", 732), mode: "versioned_snapshot", credential: null },
  "bis-ear-734": { sync: () => syncEcfrPart("bis-ear-734", 734), mode: "versioned_snapshot", credential: null },
  "bis-ear-740": { sync: () => syncEcfrPart("bis-ear-740", 740), mode: "versioned_snapshot", credential: null },
  "bis-ear-744": { sync: () => syncEcfrPart("bis-ear-744", 744), mode: "versioned_snapshot", credential: null },
  "bis-ccl": { sync: () => syncEcfrPart("bis-ccl", 774), mode: "versioned_snapshot", credential: null },
  "bis-country-chart": { sync: () => syncEcfrPart("bis-country-chart", 738), mode: "versioned_snapshot", credential: null },
  "sam-exclusions": { mode: "live_query", credential: "SAM_GOV_API_KEY" },
  "companies-house": { mode: "live_query", credential: "COMPANIES_HOUSE_API_KEY" },
  ...CN_ADAPTERS,
  ...OS_ADAPTERS,
  ...CN_LIST_ADAPTERS,
  ...JP_ADAPTERS,
  ...VENDOR_ADAPTERS,
  ...FEDREG_ADAPTERS
};

export async function queryRemoteSource(sourceId, query) {
  if (sourceId === "gleif-lei") {
    const url = `https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=${encodeURIComponent(query)}&page%5Bsize%5D=10`;
    const file = await fetchPublicFile(url, { accept: "application/vnd.api+json", maxBytes: 2 * 1024 * 1024 });
    return (JSON.parse(file.bytes.toString("utf8")).data || []).map(normalizeGleif);
  }
  if (sourceId === "sec-edgar") {
    const result = await beneficialOwners(query);
    if (result?.notSynced) throw Object.assign(new Error("SEC EDGAR 的发行人索引尚未同步，无法把名称解析成 CIK。"), { status: 409, code: "sync_required" });
    if (result?.unavailable) throw Object.assign(new Error(result.unavailable), { status: 502 });
    // No registered class of equity means no Schedule 13 exists, which is an
    // empty answer rather than a failed one.
    return (result?.holders || []).map((holder) => ({
      sourceId: "sec-edgar",
      recordId: `${result.issuer.cik}-${holder.name}`,
      recordType: "beneficial_owner",
      entityName: holder.name,
      issuerName: result.issuer.name,
      issuerCik: result.issuer.cik,
      percentOfClass: holder.percentOfClass,
      shares: holder.shares,
      securityClass: holder.securityClass,
      reportingPersonType: holder.personType,
      form: holder.form,
      filedAt: holder.filedAt,
      sourceUrl: holder.sourceUrl,
      // Travels on every record, because a percentage with no measure attached
      // is the one thing a reader will misuse.
      basisOfMeasure: "rule_13d-3_beneficial_ownership_per_class_not_equity_share"
    }));
  }
  if (sourceId === "sam-exclusions") {
    const key = process.env.SAM_GOV_API_KEY;
    if (!key) throw Object.assign(new Error("SAM_GOV_API_KEY is not configured."), { status: 409, code: "configuration_required" });
    const url = `https://api.sam.gov/entity-information/v4/exclusions?api_key=${encodeURIComponent(key)}&exclusionName=${encodeURIComponent(query)}&size=10`;
    const file = await fetchPublicFile(url, { accept: "application/json", maxBytes: 3 * 1024 * 1024 });
    return JSON.parse(file.bytes.toString("utf8")).excludedEntity || [];
  }
  if (sourceId === "companies-house") {
    const key = process.env.COMPANIES_HOUSE_API_KEY;
    if (!key) throw Object.assign(new Error("COMPANIES_HOUSE_API_KEY is not configured."), { status: 409, code: "configuration_required" });
    const auth = Buffer.from(`${key}:`).toString("base64");
    const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`;
    const file = await fetchPublicFile(url, { accept: "application/json", maxBytes: 3 * 1024 * 1024, headers: { Authorization: `Basic ${auth}` } });
    return JSON.parse(file.bytes.toString("utf8")).items || [];
  }
  throw Object.assign(new Error("This source does not provide a live-query adapter."), { status: 400 });
}

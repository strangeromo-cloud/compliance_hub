import { fetchPublicFile } from "./http.js";
import { joinName, parseCsv, rowsToObjects, xmlTag, xmlTags } from "./parsers.js";
import { CN_ADAPTERS } from "./adapters-cn.js";

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

async function syncEcfrPart(sourceId, part) {
  let file;
  let versionDate;
  for (let offset = 0; offset < 10; offset += 1) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-15.xml?part=${part}`;
    try { file = await fetchPublicFile(url, { accept: "application/xml,text/xml", maxBytes: 40 * 1024 * 1024, attempts: 1 }); versionDate = date; break; }
    catch (error) { if (!String(error.message).includes("HTTP 404") || offset === 9) throw error; }
  }
  const xml = file.bytes.toString("utf8");
  const sections = xmlTags(xml, "DIV8").map((block, index) => ({
    sourceId, recordId: `${part}-${xmlTag(block, "HEAD") || index}`, part: String(part), title: xmlTag(block, "HEAD"),
    content: block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), effectiveDate: versionDate,
    sourceUrl: file.finalUrl, rawRecord: { snapshotRecordIndex: index }, humanReviewRequired: true
  }));
  return { extension: "xml", file, records: sections.length ? sections : [{ sourceId, recordId: `part-${part}`, part: String(part), effectiveDate: versionDate, sourceUrl: file.finalUrl, humanReviewRequired: true }], syncScope: "versioned_regulatory_snapshot_requires_parser_review", sourceUpdatedAt: versionDate };
}

export const ADAPTERS = {
  "trade-csl": { sync: syncCsl, mode: "full_download", credential: null },
  "ofac-sls": { sync: syncOfac, mode: "full_download", credential: null },
  "un-consolidated": { sync: syncUn, mode: "full_download", credential: null },
  "uk-sanctions": { sync: syncUk, mode: "full_download", credential: null },
  "gleif-lei": { sync: syncGleifSample, mode: "sample_plus_live_query", credential: null },
  "bis-ear": { sync: () => syncEcfrPart("bis-ear", 736), mode: "versioned_snapshot", credential: null },
  "bis-ear-732": { sync: () => syncEcfrPart("bis-ear-732", 732), mode: "versioned_snapshot", credential: null },
  "bis-ear-734": { sync: () => syncEcfrPart("bis-ear-734", 734), mode: "versioned_snapshot", credential: null },
  "bis-ear-740": { sync: () => syncEcfrPart("bis-ear-740", 740), mode: "versioned_snapshot", credential: null },
  "bis-ear-744": { sync: () => syncEcfrPart("bis-ear-744", 744), mode: "versioned_snapshot", credential: null },
  "bis-ccl": { sync: () => syncEcfrPart("bis-ccl", 774), mode: "versioned_snapshot", credential: null },
  "bis-country-chart": { sync: () => syncEcfrPart("bis-country-chart", 738), mode: "versioned_snapshot", credential: null },
  "sam-exclusions": { mode: "live_query", credential: "SAM_GOV_API_KEY" },
  "companies-house": { mode: "live_query", credential: "COMPANIES_HOUSE_API_KEY" },
  ...CN_ADAPTERS
};

export async function queryRemoteSource(sourceId, query) {
  if (sourceId === "gleif-lei") {
    const url = `https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=${encodeURIComponent(query)}&page%5Bsize%5D=10`;
    const file = await fetchPublicFile(url, { accept: "application/vnd.api+json", maxBytes: 2 * 1024 * 1024 });
    return (JSON.parse(file.bytes.toString("utf8")).data || []).map(normalizeGleif);
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

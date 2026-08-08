// Shareholdings with the percentage attached, which is the part nothing else had.
//
// The ownership step has been asking the user to type a share structure because
// no source it could reach published one. GLEIF gives the accounting
// consolidating parent and states no percentage; OFAC's own ownership graph
// carries 5,047 edges and not one of them has a share on it. So "who owns 50% of
// this company" was always a question the reviewer answered by hand.
//
// A Schedule 13D/G is the exception. Anyone acquiring beneficial ownership of
// more than 5% of a class of registered equity has to file one, and since
// 18 December 2024 it has to be filed as structured XML rather than as a
// document — `<classPercent>6.4</classPercent>`, in a named field, machine
// readable, free, no key, no captcha.
//
// What that number is, precisely, because the difference decides what it can
// close:
//
//   It is BENEFICIAL ownership under Rule 13d-3 — voting power or dispositive
//   power over the shares. An asset manager reporting 8% holds the votes, not
//   the equity. OFAC's 50 Percent Rule turns on OWNERSHIP in the aggregate.
//   These are different measures and the filing does not convert between them.
//
//   It is per CLASS. A company with Class A and Class B has two denominators,
//   and percentages from different classes must not be added.
//
//   Affiliated filers double count: a fund complex and its adviser each report
//   the same shares. A sum across filers can exceed the shares outstanding.
//
// So this does not compute the aggregate, and no caller may present it as
// though it had. What it does is turn "list every shareholder yourself" into
// "here are the holders above five per cent, by name and by share, and they have
// been screened" — which is the input to the aggregation rather than a
// substitute for it. Everyone below 5% remains unreported by construction, and a
// company with no registered class of equity files nothing at all.

import { readNormalized } from "./data-layer/storage.js";
import { fetchPublicFile } from "./data-layer/http.js";
import { xmlCells, xmlTag, xmlTags } from "./data-layer/parsers.js";
import { normalizeEntityName, scoreNameMatch } from "./entity-matching.js";

// The registry entry this resolver implements, so the coverage page's claim can
// be checked against code rather than taken on trust.
export const SOURCE_ID = "sec-edgar";
const SUBMISSIONS = "https://data.sec.gov/submissions/CIK";
const ARCHIVE = "https://www.sec.gov/Archives/edgar/data";

// Only the structured filings. The paper-era `SC 13G` is the same disclosure in
// an HTML document, and scraping a percentage out of a cover-page table would
// put a parsed guess where this reports a filed field. Reading nothing before
// December 2024 is a stated limit; reading it wrongly would not be.
const STRUCTURED_FORM = /^SCHEDULE 13[DG](\/A)?$/i;
const STRUCTURED_FROM = "2024-12-18";

// One issuer's filings, newest first. Twenty covers a widely held company's
// current filers with room for the amendments that supersede them; a fund
// complex that files fifty times a year would otherwise turn one review into a
// hundred requests against a rate-limited public service.
const MAX_FILINGS = 20;

// The proxy statement's ownership table, which is the other half of the picture.
//
// A Schedule 13D/G is event-driven: it is filed on crossing five per cent and
// amended on a material change, so a holder whose stake has been steady for years
// files nothing. Apple's structured schedules yield one holder. Its proxy yields
// two — Vanguard at 9.63% and BlackRock at 7.10% — because Item 403 of Regulation
// S-K requires the company to table EVERY holder above five per cent as of a
// stated record date. Complete as of a date, rather than whatever happened to be
// filed lately.
//
// It is the same measure as the schedules — Rule 13d-3 beneficial ownership — and
// often literally the same numbers: Apple's footnote says the Vanguard figure
// comes from a 13G/A filed on 29 July 2025. So the two are merged per holder
// rather than added, newest wins, and which document each came from travels with
// it.
const PROXY_FORM = /^DEF ?14A$/i;
// A percentage worth aggregating. The table also lists every director and officer,
// almost all of them shown as "*" for under one per cent; they are not holders in
// the sense the 50 Percent Rule means, and a name-by-name list of the board is a
// different lane's question.
const PROXY_MIN_PERCENT = 5;

// The first number in a cell, and only the first.
//
// A share cell reads "1,043,713,019 (3)" — the number followed by its footnote
// marker. Stripping every non-digit concatenated the two into 10,437,130,193,
// ten times the real holding. The arithmetic check below caught it, which is what
// the check is for, but a reading that cannot be checked has to be right the
// first time.
const firstNumber = (value) => {
  const match = String(value).replace(/&#160;|&nbsp;/gi, " ").match(/\d[\d,]*(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) || null : null;
};

const plainText = (value) => String(value).replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/gi, " ").replace(/\s+/g, " ");

// Candidate denominators, chosen later by whether they reconcile.
//
// The obvious approaches both fail. A document-wide search for "outstanding"
// returned 4,092,836 for Apple where the answer was 14,697,926,000 — a proxy says
// "outstanding" about equity compensation plans and buybacks too. Anchoring on
// the text just above the table fixes Apple and breaks Microsoft, whose count
// sits in the meeting notice thousands of words earlier and reads "shares of
// common stock outstanding" rather than "issued and outstanding".
//
// So no prose heuristic decides it. Every plausible count is collected, and the
// one that makes the table's own rows add up is the one used — the rows validate
// the denominator rather than the other way round. A document where nothing
// reconciles reports its rows as unchecked instead of guessing.
function outstandingCandidates(document) {
  const text = plainText(document);
  const found = new Set();
  for (const match of text.matchAll(/([\d][\d,]{6,})[^.]{0,140}?outstanding/gi)) {
    const value = firstNumber(match[1]);
    if (value && value >= 1_000_000) found.add(value);
  }
  return [...found];
}

// Within a percentage point, or within a quarter of the stated figure. A cell
// read from the wrong column is wrong by orders of magnitude; a company computing
// its percentage on a slightly different base is wrong by a rounding.
const reconciles = (shares, outstanding, percent) => {
  const off = Math.abs((shares / outstanding) * 100 - percent);
  return off <= 1 || off <= percent * 0.25;
};

// The table is found by what its header says. Its COLUMNS are then read from the
// data, not from the header, because header wording is not a layout.
//
// Microsoft's amount column is headed "Amount and Nature of Beneficial Ownership
// as of 09/30/2025". Picking the name column by matching /beneficial owner/
// selected that one, so every holder came out named "664,882,153¹" — a share
// count in the name field, which is the sort of thing that then gets screened
// against a sanctions list. Apple's header happens to read "Name of Beneficial
// Owner" and worked by luck.
//
// Within a row the three values identify themselves: the percentage is the cell
// carrying %, the holding is a large bare number, and the name is the cell with
// letters in it. That holds across both layouts and does not depend on either
// company's choice of words.
const OWNERSHIP_TABLE = /beneficial owner(?:ship)?/i;
const PERCENT_HEADER = /percent/i;

const rowCells = (row) => {
  const data = xmlCells(row, "td").filter((cell) => cell !== "");
  const heads = xmlCells(row, "th").filter((cell) => cell !== "");
  return data.length >= heads.length ? data : heads;
};

const PERCENT_CELL = /(\d{1,3}(?:\.\d+)?)\s*%/;
// A holding: digits and separators, and long enough not to be a footnote marker.
// A holding: digits and separators, optionally trailed by a footnote marker —
// "1,415,826,462 (2)" or "664,882,153¹".
const NUMBER_CELL = /^[\d,]{4,}\s*(?:\(\d+\)|[^\w\s]{1,2})?$/;

// A name has to be a name. A cell that is mostly digits is a share count that
// landed in the wrong column, and letting it through would put it into screening.
function holderName(cell) {
  const raw = String(cell || "").replace(/\s*\(\d+\)\s*$/, "").trim();
  if (!/\p{L}{3}/u.test(raw)) return null;
  const letters = (raw.match(/\p{L}/gu) || []).length;
  if (letters < raw.replace(/\s/g, "").length * 0.4) return null;
  // Proxies often run the holder's address into the same cell: "The Vanguard
  // Group, Inc. 100 Vanguard Blvd., Malvern, PA 19355". Cut at the street number.
  const cut = raw.replace(/\s+\d+\s+\p{L}.*$/u, "").trim();
  // And they qualify the group: Ford's table reads "BlackRock, Inc. and certain
  // of its affiliates" for the holding its own 13G/A files as "BlackRock, Inc."
  // Left in, the same holder counts twice in the aggregate — 8.4% from the
  // schedule beside 8.36% from the proxy — and neither gets screened under the
  // name the lists carry.
  const named = (cut.length >= 4 ? cut : raw)
    .replace(/,?\s+and\s+(?:certain\s+)?(?:of\s+)?(?:its\s+)?(?:affiliates?|related\s+entities|subsidiaries)\b.*$/iu, "")
    .replace(/[,;\s]+$/, "")
    .trim();
  return named.length >= 4 ? named : cut || raw;
}

export function parseProxyOwnership(document) {
  const source = String(document);
  const candidates = outstandingCandidates(source);
  for (const table of xmlTags(source, "table")) {
    // Two columns is a legitimate layout — Ford's table carries names and
    // percentages and no count — so the floor is two. What keeps this from
    // matching arbitrary tables is the header test below, not the column count.
    const rows = xmlTags(table, "tr").map(rowCells).filter((cells) => cells.length >= 2);
    const header = rows.find((cells) => cells.some((cell) => OWNERSHIP_TABLE.test(cell)) && cells.some((cell) => PERCENT_HEADER.test(cell)));
    if (!header) continue;
    const securityClass = header.find((cell) => PERCENT_HEADER.test(cell)) || null;

    // Read the rows first, then settle the denominator on them.
    const raw = [];
    for (const cells of rows.slice(rows.indexOf(header) + 1)) {
      const percentCell = cells.findIndex((cell) => PERCENT_CELL.test(cell));
      if (percentCell < 0) continue;
      const percent = Number(cells[percentCell].match(PERCENT_CELL)[1]);
      if (!Number.isFinite(percent) || percent < PROXY_MIN_PERCENT || percent > 100) continue;

      const name = cells.slice(0, percentCell).map(holderName).find(Boolean);
      if (!name || name.length > 120) continue;
      const shares = cells.slice(0, percentCell)
        .filter((cell) => NUMBER_CELL.test(cell.trim()))
        .map(firstNumber).filter(Boolean).sort((left, right) => right - left)[0] || null;

      raw.push({ name, shares, percentOfClass: percent, securityClass });
    }
    if (!raw.length) continue;

    // The denominator is whichever candidate the rows themselves agree with, and
    // "most rows" rather than "any row" so a coincidence cannot win against the
    // real figure.
    const withShares = raw.filter((row) => row.shares);
    let outstanding = null;
    let agreed = 0;
    for (const candidate of candidates) {
      const hits = withShares.filter((row) => reconciles(row.shares, candidate, row.percentOfClass)).length;
      if (hits > agreed) { agreed = hits; outstanding = candidate; }
    }

    const holders = [];
    const rejected = [];
    for (const row of raw) {
      // Only a row that had a holding AND a settled denominator can be checked.
      // One that reconciles is used and marked; one that contradicts the figure
      // the rest of the table agrees on is a misread and is dropped, with what it
      // read reported. A row with no holding to check is used unchecked — the
      // percentage came from the cell carrying the % sign, which is not the part
      // that goes wrong.
      if (row.shares && outstanding) {
        if (!reconciles(row.shares, outstanding, row.percentOfClass)) {
          rejected.push({ ...row, against: outstanding, computed: Math.round((row.shares / outstanding) * 10_000) / 100 });
          continue;
        }
        holders.push({ ...row, arithmeticChecked: true });
        continue;
      }
      holders.push({ ...row, arithmeticChecked: false });
    }
    return {
      holders, rejected, sharesOutstanding: outstanding,
      // True only when every row was reconciled against the document's own share
      // count. Anything less says so rather than passing as verified.
      checked: holders.length > 0 && holders.every((holder) => holder.arithmeticChecked)
    };
  }
  return { holders: [], rejected: [], sharesOutstanding: null, checked: false };
}

// The class a schedule is filed on, reduced to the letter that identifies it.
//
// A filer covers one class per schedule and amends that schedule, so keying a
// filer's latest statement by class is right — but the title is free text.
// BlackRock filed the same class as "A" in February and "Class A Stock" in July,
// and treating those as two classes left the superseded 8.7% standing beside the
// current 4.6% as though the holder held both.
export function classKey(title) {
  return String(title || "")
    .toLowerCase()
    .split(",")[0]
    .replace(/\bpar value.*$/, " ")
    .replace(/\b(?:common|ordinary|capital|class|stock|shares?|units?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function json(url, maxBytes) {
  const file = await fetchPublicFile(url, { accept: "application/json", maxBytes, attempts: 2 });
  return JSON.parse(file.bytes.toString("utf8"));
}

// A filing carries one cover page per reporting person — a group files together
// and each member reports its own share. The name appears again in the signature
// block, so the fields are read inside the cover-page block and never from the
// document as a whole.
export function parseSchedule13(xml) {
  const securityClass = xmlTag(xml, "securitiesClassTitle");
  const persons = xmlTags(xml, "coverPageHeaderReportingPersonDetails").map((block) => {
    const percent = Number(xmlTag(block, "classPercent"));
    const shares = Number(xmlTag(block, "reportingPersonBeneficiallyOwnedAggregateNumberOfShares"));
    return {
      name: xmlTag(block, "reportingPersonName"),
      // A filer that has sold down files a final amendment reporting 0.0, which
      // is a fact about today's holding and not a parse failure.
      percentOfClass: Number.isFinite(percent) ? percent : null,
      shares: Number.isFinite(shares) ? shares : null,
      // IA is an investment adviser, IN a natural person, CO a corporation. The
      // code is what separates "a fund votes these shares" from "a person owns
      // this company", which is the distinction the 50 Percent Rule cares about.
      personType: xmlTag(block, "typeOfReportingPerson") || null,
      securityClass
    };
  }).filter((person) => person.name);
  return {
    // Which company the filing is ABOUT. A company's own filing list contains
    // both directions — the schedules other people filed about it, and the ones
    // it filed about companies it holds. Intel's list carries a 79.8% position,
    // and that is Intel holding Mobileye, not somebody holding 79.8% of Intel.
    // Without this field the two are indistinguishable and the second reads as
    // the first, which in a compliance file is the ownership chain backwards.
    issuerCik: Number(String(xmlTag(xml, "issuerCik") || "").replace(/\D/g, "")) || null,
    issuerName: xmlTag(xml, "issuerName"),
    securityClass,
    persons
  };
}

// Name to Central Index Key, from the register's own ticker index.
//
// Held to the same bar as the GLEIF lookup — identical after normalisation and
// nothing less. A near match here would attribute one company's shareholders to
// another inside a compliance file, and the normalisation already folds the
// legal form, so "NVIDIA Corporation" reaches "NVIDIA CORP" without loosening
// anything.
function resolveIssuer(records, legalName) {
  const scored = records
    .map((record) => ({ record, match: scoreNameMatch(legalName, record.entityName) }))
    .filter((item) => item.match.basis === "normalized_name_identical");
  if (!scored.length) return null;
  return scored[0].record;
}

export async function beneficialOwners(name) {
  const legalName = String(name || "").trim();
  if (legalName.length < 3) return null;

  const { records } = await readNormalized(SOURCE_ID).catch(() => ({ records: [] }));
  // Not synced is not "no shareholders". It is this system not having looked,
  // and the step has to be able to tell the reader which one happened.
  if (!records?.length) return { queried: legalName, notSynced: true };

  const issuer = resolveIssuer(records, legalName);
  // No registered class of equity in the United States, so no Schedule 13 exists
  // to read. True of every private company and every foreign issuer without a US
  // listing — the common case, not an error.
  if (!issuer) return { queried: legalName, notRegistered: true };

  const cik = Number(issuer.cik);
  let submissions;
  try {
    submissions = await json(`${SUBMISSIONS}${String(cik).padStart(10, "0")}.json`, 24 * 1024 * 1024);
  } catch (error) {
    return { queried: legalName, issuer, unavailable: String(error.message).slice(0, 160) };
  }

  const recent = submissions.filings?.recent || {};
  const filings = (recent.form || [])
    .map((form, index) => ({
      form,
      filedAt: recent.filingDate?.[index] || "",
      accession: recent.accessionNumber?.[index] || "",
      document: recent.primaryDocument?.[index] || ""
    }))
    .filter((filing) => STRUCTURED_FORM.test(filing.form)
      && filing.filedAt >= STRUCTURED_FROM
      && /primary_doc\.xml$/i.test(filing.document))
    .sort((left, right) => right.filedAt.localeCompare(left.filedAt))
    .slice(0, MAX_FILINGS);

  // How many structured filings existed against how many were read, so a company
  // whose filer list was truncated says so rather than presenting a partial
  // holder list as the whole one.
  const available = (recent.form || []).filter((form, index) =>
    STRUCTURED_FORM.test(form) && (recent.filingDate?.[index] || "") >= STRUCTURED_FROM).length;

  const inbound = new Map();
  const outbound = new Map();
  let read = 0;
  for (const filing of filings) {
    let parsed;
    const folder = `${ARCHIVE}/${cik}/${filing.accession.replaceAll("-", "")}`;
    try {
      const file = await fetchPublicFile(`${folder}/primary_doc.xml`, { accept: "application/xml,text/xml", maxBytes: 4 * 1024 * 1024, attempts: 2 });
      parsed = parseSchedule13(file.bytes.toString("utf8"));
    } catch {
      // One unreadable filing is not a reason to abandon the other nineteen; the
      // count of what was read travels with the result.
      continue;
    }
    read += 1;
    const aboutThisCompany = parsed.issuerCik === cik;
    const into = aboutThisCompany ? inbound : outbound;
    for (const person of parsed.persons) {
      // An amendment supersedes the filer's own earlier statement, including the
      // final one reporting a sold-down position. Newest wins — keyed by filer
      // and class going in, by target and class going out.
      const key = aboutThisCompany
        ? `${person.name.toLowerCase()}::${classKey(person.securityClass)}`
        : `${parsed.issuerCik}::${classKey(person.securityClass)}`;
      const existing = into.get(key);
      if (existing && existing.filedAt >= filing.filedAt) continue;
      into.set(key, {
        ...person,
        ...(aboutThisCompany ? {} : { issuerName: parsed.issuerName, issuerCik: parsed.issuerCik }),
        filedAt: filing.filedAt,
        form: filing.form,
        sourceUrl: `${folder}/${filing.document}`
      });
    }
  }

  const held = (map) => [...map.values()]
    .filter((entry) => (entry.percentOfClass || 0) > 0)
    .sort((left, right) => (right.percentOfClass || 0) - (left.percentOfClass || 0));
  const holdings = held(outbound);

  // The proxy's table, merged in. This is where the holders the schedules cannot
  // see come from: Apple's structured schedules name one, its proxy names two.
  const proxyFiling = (recent.form || [])
    .map((form, index) => ({ form, filedAt: recent.filingDate?.[index] || "", accession: recent.accessionNumber?.[index] || "", document: recent.primaryDocument?.[index] || "" }))
    .filter((filing) => PROXY_FORM.test(filing.form) && /\.html?$/i.test(filing.document))
    .sort((left, right) => right.filedAt.localeCompare(left.filedAt))[0] || null;

  let proxy = null;
  if (proxyFiling) {
    const folder = `${ARCHIVE}/${cik}/${proxyFiling.accession.replaceAll("-", "")}`;
    try {
      const file = await fetchPublicFile(`${folder}/${proxyFiling.document}`, { accept: "text/html", maxBytes: 24 * 1024 * 1024, attempts: 2 });
      proxy = { ...parseProxyOwnership(file.bytes.toString("utf8")), filedAt: proxyFiling.filedAt, form: proxyFiling.form, sourceUrl: `${folder}/${proxyFiling.document}` };
    } catch {
      // One unreadable proxy is not a reason to discard the schedules.
      proxy = null;
    }
  }

  // Merged per holder, never added. The two documents report the same measure and
  // often the same underlying filing — Apple's proxy footnote cites the very
  // 13G/A this also reads — so the later statement supersedes the earlier one and
  // the document it came from travels with it.
  // A schedule's percentage is a filed named field, not a number parsed out of a
  // table, so arithmetic checking does not apply to it — null rather than false,
  // which would read as "checked and failed".
  const merged = new Map(held(inbound).map((holder) => [normalizeEntityName(holder.name), { ...holder, document: holder.form, arithmeticChecked: null }]));
  for (const holder of proxy?.holders || []) {
    const key = normalizeEntityName(holder.name);
    const existing = merged.get(key);
    if (existing && existing.filedAt >= proxy.filedAt) continue;
    merged.set(key, { ...holder, filedAt: proxy.filedAt, document: proxy.form, sourceUrl: proxy.sourceUrl, personType: null, form: proxy.form });
  }
  const holders = [...merged.values()].sort((left, right) => (right.percentOfClass || 0) - (left.percentOfClass || 0));

  return {
    queried: legalName,
    issuer: { cik, name: issuer.entityName, ticker: issuer.ticker || null, sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` },
    // Who holds this company.
    holders,
    // What this company holds in others, from the schedules it filed itself. Not
    // what the ownership step was asking for, but it is the same chain read
    // downward, and it arrived in the same request.
    holdings,
    // Filers whose latest statement reports a position they no longer hold. Kept
    // as a count rather than dropped: it is the difference between "nobody else
    // filed" and "somebody filed to say they had left".
    exited: Math.max(0, inbound.size - held(inbound).length),
    // Where the proxy's contribution came from and whether its rows were checked
    // against the document's own share count. A table that could not be checked
    // says so rather than passing as verified.
    proxy: proxy
      ? { form: proxy.form, filedAt: proxy.filedAt, sharesOutstanding: proxy.sharesOutstanding, arithmeticChecked: proxy.checked, rejectedRows: proxy.rejected.length, sourceUrl: proxy.sourceUrl }
      : null,
    filingsRead: read,
    filingsAvailable: available,
    // The submissions feed returns roughly the last thousand filings of every
    // kind. For a company that files daily that window can start after the
    // structured schedules began, in which case some 5% holders are outside it
    // and the holder list is not the whole one.
    windowCoversStructuredEra: (recent.filingDate || []).length === 0
      || (recent.filingDate || []).reduce((earliest, date) => (date < earliest ? date : earliest), "9999") <= STRUCTURED_FROM,
    asOf: holders[0]?.filedAt || null,
    // Carried with the result so no caller has to remember any of it.
    meaning: "两个来源：持有人自己申报的 Schedule 13D/G，以及公司在 DEF 14A 委托说明书里按记录日公布的持股表。两者口径相同，都是 13d-3 项下的受益所有权（表决权或处分权），并非股权比例，且按证券类别分别计算；同一持有人在两处出现时取较新的一次，不相加。关联申报人会就同一批股份各报一次，相加前须确认彼此无关联。这些是 OFAC 50% 合计持股计算的输入，不是计算结果。仍然不在其中的：5% 以下持有人依规则不申报；没有委托说明书或其中无持股表的发行人；以及全部非美国注册发行人与私营公司 —— 名单为空或偏短不等于没有 5% 以上股东。"
  };
}

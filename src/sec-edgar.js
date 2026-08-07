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
import { xmlTag, xmlTags } from "./data-layer/parsers.js";
import { scoreNameMatch } from "./entity-matching.js";

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
  const holders = held(inbound);
  const holdings = held(outbound);

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
    exited: inbound.size - holders.length,
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
    meaning: "Schedule 13D/G 报告的是 13d-3 项下的受益所有权（表决权或处分权），并非股权比例，且按证券类别分别计算；关联申报人会就同一批股份各报一次，不能相加。它给出 5% 以上持有人的名称与比例，是 OFAC 50% 合计持股计算的输入，不是计算结果。两类持有人不在其中：5% 以下者依规则不申报；2024 年 12 月前已申报且此后无重大变动者无需修订，因而不在结构化数据内 —— 名单为空或偏短不等于没有 5% 以上股东。"
  };
}

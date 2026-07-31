// US regulatory changes, from the register that publishes them.
//
// The briefing could only answer for China: MOFCOM notices were ingested and
// nothing on the US side was. But the Entity List does not change by itself —
// every addition, removal and licence-policy change is published in the Federal
// Register first, with an effective date, and the Consolidated Screening List
// only reflects it afterwards. Asking "what changed in the last six months" and
// getting an answer about one jurisdiction is a worse answer than saying so.
//
// Free, no key, no rate limit worth working around. Two agencies matter here:
// BIS writes the EAR and the Entity List, OFAC writes the sanctions programmes.

import { fetchPublicFile } from "./http.js";

const API = "https://www.federalregister.gov/api/v1/documents.json";

const AGENCIES = [
  { slug: "industry-and-security-bureau", label: "BIS", en: "Bureau of Industry and Security", zh: "美国工业与安全局（BIS）" },
  { slug: "foreign-assets-control-office", label: "OFAC", en: "Office of Foreign Assets Control", zh: "美国海外资产控制办公室（OFAC）" }
];

// Two years, so a briefing can be asked for a window longer than six months
// without the answer quietly being truncated by what was fetched.
const WINDOW_DAYS = 730;
const PER_PAGE = 100;

const FIELDS = [
  "document_number", "title", "publication_date", "effective_on",
  "type", "action", "html_url", "abstract", "agencies"
];

// What the document did, from its own type and action line. The register states
// both; nothing here is inferred from the prose.
export function classifyDocument(doc) {
  const action = `${doc.action || ""} ${doc.title || ""}`;
  // Order matters: "Interim final rule." contains "final rule", so the narrower
  // test has to run first or every interim rule is reported as a final one —
  // which is the difference between a rule that is settled and one still open
  // to comment.
  if (/interim final/i.test(doc.action || "")) return "rule_interim";
  if (/\bfinal rule\b/i.test(doc.action || "")) return "rule_final";
  if (/proposed rule/i.test(doc.action || "") || doc.type === "Proposed Rule") return "rule_proposed";
  if (/\badd(ition|ing|s)?\b.*entity list|entity list.*\badd/i.test(action)) return "entity_list_addition";
  if (/remov(al|ing|es)?.*entity list|entity list.*remov/i.test(action)) return "entity_list_removal";
  if (doc.type === "Notice") return "notice";
  return "other";
}

export function parseFederalRegister(payloads) {
  const records = [];
  const seen = new Set();
  for (const { agency, results } of payloads) {
    for (const doc of results || []) {
      if (!doc.document_number || seen.has(doc.document_number)) continue;
      seen.add(doc.document_number);
      records.push({
        sourceId: "us-federal-register",
        recordId: doc.document_number,
        noticeNumber: doc.document_number,
        noticeTitle: doc.title || null,
        // The date it takes effect where the register gives one, because that is
        // the date a transaction is judged against — not the date it was printed.
        publishedAt: doc.publication_date || null,
        effectiveFrom: doc.effective_on || doc.publication_date || null,
        documentType: doc.type || null,
        action: doc.action || null,
        changeType: classifyDocument(doc),
        issuingAuthorities: [agency.label],
        agencyName: agency.en,
        abstract: (doc.abstract || "").slice(0, 600) || null,
        sourceUrl: doc.html_url || null,
        humanReviewRequired: true
      });
    }
  }
  return records.sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)));
}

export async function syncFederalRegister() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const payloads = [];
  let raw = "";

  for (const agency of AGENCIES) {
    const url = new URL(API);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("order", "newest");
    url.searchParams.append("conditions[agencies][]", agency.slug);
    url.searchParams.append("conditions[publication_date][gte]", since);
    for (const field of FIELDS) url.searchParams.append("fields[]", field);

    const file = await fetchPublicFile(url.toString(), { accept: "application/json", maxBytes: 8 * 1024 * 1024, attempts: 2 });
    const text = file.bytes.toString("utf8");
    raw += text;
    payloads.push({ agency, results: JSON.parse(text).results || [] });
  }

  const records = parseFederalRegister(payloads);
  if (!records.length) throw new Error("The Federal Register returned no BIS or OFAC documents; the query or the feed has changed.");
  return {
    extension: "json",
    file: { bytes: Buffer.from(raw, "utf8"), finalUrl: API, etag: null },
    records,
    syncScope: `federal_register+${AGENCIES.map((agency) => agency.label).join("_")}+${records.length}_documents+${WINDOW_DAYS}d`,
    sourceUpdatedAt: records[0]?.effectiveFrom || null
  };
}

export const FEDREG_ADAPTERS = {
  "us-federal-register": { sync: syncFederalRegister, mode: "versioned_snapshot", credential: null }
};

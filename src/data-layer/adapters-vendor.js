// Manufacturer export classifications, from the vendors that issue them.
//
// A part number's ECCN is the manufacturer's own statement about its own
// product. There is no register to look it up in: BIS publishes the control list
// but not who is on it, so for a specific part the vendor's published table is
// the primary source, and every other answer is derived from it.
//
// Two vendors, two very different publications:
//
//   NVIDIA  a JSON endpoint behind the export-regulations page, one row per
//           part with TPP, HTS and ECCN. It answers only with browser-shaped
//           headers, so those are sent — this is the page's own API, not a
//           private one, and no credential is involved.
//
//   AMD     a PDF of the whole product master, refreshed periodically and dated
//           inside the document. Extraction gives one table cell per line, so
//           rows are assembled by counting from each part number.
//
// Neither is a classification decision. A vendor states what it classified the
// part as and when; an exporter is still responsible for its own classification
// and for whether that is still current.

import { fetchPublicFile } from "./http.js";
import { extractPdfText } from "./pdf-text.js";

const NVIDIA_API = "https://api-prod.nvidia.com/services/eccn/v1/getECCN";
const NVIDIA_PAGE = "https://www.nvidia.com/en-us/about-nvidia/company-policies/export-regulations/";
const AMD_PDF = "https://www.amd.com/content/dam/amd/en/documents/legal/product-master.pdf";
const AMD_PAGE = "https://www.amd.com/en/legal/compliance/trade-compliance.html";

// The endpoint answers 403 to a plain request. These are the headers the page's
// own script sends; nothing here defeats an access control, and there is no
// credential — the data is published for exactly this purpose.
const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nvidia.com",
  Referer: "https://www.nvidia.com/"
};

// "NULL" arrives as a string in this feed, and storing it would put the word
// NULL in front of a reviewer as though it were a classification.
const value = (input) => {
  const text = String(input ?? "").trim();
  return !text || text.toUpperCase() === "NULL" ? null : text;
};

export function parseNvidiaParts(payload) {
  const rows = Array.isArray(payload) ? payload : (payload?.data || payload?.results || payload?.parts || []);
  return rows.map((row) => ({
    sourceId: "nvidia-export",
    recordId: value(row.part_number) || String(row.id),
    partNumber: value(row.part_number),
    description: value(row.part_description),
    partType: value(row.part_type),
    eccn: value(row.nveccn),
    htsUs: value(row.nv_hts),
    // NVIDIA's own field is TPP per GPU, not APP. Naming it plainly keeps the
    // two from being read as interchangeable.
    tppPerGpu: value(row.tpp),
    lifecycleState: value(row.state),
    vendor: "NVIDIA",
    sourceUrl: NVIDIA_PAGE,
    humanReviewRequired: true
  })).filter((record) => record.partNumber);
}

export async function syncNvidiaExport() {
  const file = await fetchPublicFile(NVIDIA_API, {
    accept: "application/json",
    headers: BROWSER_HEADERS,
    maxBytes: 20 * 1024 * 1024,
    attempts: 2
  });
  const records = parseNvidiaParts(JSON.parse(file.bytes.toString("utf8")));
  if (!records.length) throw new Error("NVIDIA returned no part records; the feed shape has changed.");
  return {
    extension: "json", file, records,
    syncScope: `nvidia_export_classification+${records.length}_parts`,
    sourceUpdatedAt: null
  };
}

// The table is Product Number | US ECCN | US HS | CCATS | Meets 3A090.a.1, and
// extraction yields one cell per line. Anchoring on the part number and reading
// the next four cells is what turns that back into rows — the same approach the
// PRC licence catalogue needs, for the same reason.
const AMD_PART = /^[0-9A-Z]{2,}-[0-9A-Z-]+$/i;
const AMD_ECCN = /^(?:EAR99|[0-9][A-E][0-9]{3}(?:\.[a-z0-9.]+)?)$/i;
const AMD_HS = /^\d{8,12}$/;

export function parseAmdParts(text, classificationDate) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const records = [];
  const seen = new Set();

  for (let at = 0; at < lines.length; at += 1) {
    const partNumber = lines[at];
    if (!AMD_PART.test(partNumber) || seen.has(partNumber)) continue;
    const eccn = lines[at + 1];
    const hts = lines[at + 2];
    // A part number is only the start of a row if what follows it looks like the
    // rest of one. Without both checks, any hyphenated token in the document
    // would take the next four lines with it.
    if (!AMD_ECCN.test(eccn || "") || !AMD_HS.test(hts || "")) continue;
    seen.add(partNumber);
    records.push({
      sourceId: "amd-export",
      recordId: partNumber,
      partNumber,
      eccn,
      htsUs: hts,
      ccats: lines[at + 3] || null,
      meets3A090a1: /^[YN]$/i.test(lines[at + 4] || "") ? lines[at + 4].toUpperCase() : null,
      vendor: "AMD",
      classificationDate: classificationDate || null,
      sourceUrl: AMD_PAGE,
      humanReviewRequired: true
    });
  }
  return records;
}

export async function syncAmdExport() {
  const file = await fetchPublicFile(AMD_PDF, {
    accept: "application/pdf",
    headers: { Referer: AMD_PAGE },
    maxBytes: 40 * 1024 * 1024,
    attempts: 2
  });
  const text = extractPdfText(file.bytes);
  // The document dates itself; that date belongs on every row, because "AMD says
  // 5A992.c" means little without "as of when".
  const classificationDate = text.match(/Classification Data as of\s+([^\n]+)/i)?.[1]?.trim() || null;
  const records = parseAmdParts(text, classificationDate);
  if (!records.length) throw new Error("AMD's product master yielded no rows; its layout has changed.");
  return {
    extension: "pdf", file, records,
    syncScope: `amd_export_classification+${records.length}_parts`,
    sourceUpdatedAt: classificationDate
  };
}

export const VENDOR_ADAPTERS = {
  "nvidia-export": { sync: syncNvidiaExport, mode: "versioned_snapshot", credential: null },
  "amd-export": { sync: syncAmdExport, mode: "versioned_snapshot", credential: null }
};

// Japan's export control law, from the e-Gov law API.
//
// The best-structured official source in the region: XML and JSON, no key, no
// registration, and the appended tables — 別表第一 of the Export Trade Control
// Order, which is where the controlled goods actually live — arrive as real table
// markup rather than as prose in a PDF.
//
// Licence is 政府標準利用規約 2.0, which is CC BY-compatible: caching,
// redistribution and commercial use are all permitted with attribution. That
// makes it a better citizen of this tool than the OpenSanctions mirrors, which
// are non-commercial only.

import { fetchPublicFile } from "./http.js";
import { xmlTag, xmlTags, xmlText } from "./parsers.js";

const BASE = "https://laws.e-gov.go.jp/api/2";

// The instruments that carry the control lists. The ministerial ordinance is the
// one with the numeric thresholds; the order alone gives categories without the
// specifications that decide whether an item is caught.
export const JP_LAWS = [
  { lawId: "324CO0000000378", title: "輸出貿易管理令", role: "export_control_order" },
  { lawId: "403M50000400049", title: "貨物等省令（輸出令別表第一及び外国為替令別表の規定に基づき貨物又は技術を定める省令）", role: "specifications" },
  { lawId: "355CO0000000260", title: "外国為替令", role: "foreign_exchange_order" }
];

// An appended table becomes one record per row, keeping the row's cells joined so
// a reader can see what the row actually said. The tables are legal prose in a
// grid, not a tidy dataset, so no attempt is made to split thresholds out of it —
// that would be inventing structure the source does not have.
function tableRecords(xml, law) {
  const records = [];
  for (const appendix of xmlTags(xml, "AppdxTable")) {
    const title = xmlTag(appendix, "AppdxTableTitle") || "別表";
    xmlTags(appendix, "TableRow").forEach((row, index) => {
      const cells = xmlTags(row, "TableColumn").map(xmlText).filter(Boolean);
      if (!cells.length) return;
      records.push({
        sourceId: "jp-export-control",
        recordId: `${law.lawId}-${title}-${index}`,
        lawId: law.lawId,
        lawTitle: law.title,
        appendix: title,
        // The first cell of these tables is the item number; the rest is the text
        // that decides whether something falls under it.
        itemNumber: cells[0] || null,
        content: cells.join(" ").slice(0, 2000),
        sourceUrl: `https://laws.e-gov.go.jp/law/${law.lawId}`,
        licence: "政府標準利用規約 2.0 (CC BY compatible)",
        humanReviewRequired: true
      });
    });
  }
  return records;
}

export async function syncJapanExportControl() {
  const records = [];
  const files = [];
  for (const law of JP_LAWS) {
    const file = await fetchPublicFile(`${BASE}/law_file/xml/${law.lawId}`, {
      accept: "application/xml,text/xml",
      maxBytes: 30 * 1024 * 1024,
      attempts: 2
    });
    files.push(file);
    const xml = file.bytes.toString("utf8");
    const rows = tableRecords(xml, law);
    // An order with no appended table means the API returned something other than
    // the law — better to say so than to record an empty control list.
    if (!rows.length && law.role !== "foreign_exchange_order") {
      throw new Error(`${law.lawId} returned no appended tables; the response shape has changed.`);
    }
    records.push(...rows);
  }

  return {
    extension: "xml",
    file: files[0],
    records,
    syncScope: `egov_law_api+${JP_LAWS.length}_instruments+${records.length}_rows`,
    sourceUpdatedAt: null
  };
}

export const JP_ADAPTERS = {
  "jp-export-control": { sync: syncJapanExportControl, mode: "versioned_snapshot", credential: null }
};

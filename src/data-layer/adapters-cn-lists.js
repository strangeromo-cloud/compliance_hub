// China's control list and licence catalogues, from the PDFs that publish them.
//
// MOFCOM publishes the dual-use control list and the licence catalogues as PDF
// and nothing else — no CSV, no API, and the item-level lookup on its own site is
// CAPTCHA-gated. The documents do carry a text layer, so they are read rather
// than scraped, using the extractor in pdf-text.js.
//
// Two documents, two different jobs:
//
//   control list       the Chinese analogue of the CCL. Codes are structured
//                      exactly like an ECCN — industry, item type, control
//                      reason — which is what lets the product lane reason about
//                      Chinese controls the same way it reasons about US ones.
//
//   licence catalogue  customs commodity codes that require an export licence.
//                      This is the only free official HS-level control mapping
//                      found on either side.
//
// Both are annual documents behind announcement pages whose attachment links
// carry opaque per-file tokens, so the announcement is fetched first and the
// attachment link read out of it. A hardcoded attachment URL would break at the
// next revision and, worse, would keep serving last year's list.

import { fetchPublicFile } from "./http.js";
import { extractPdfText } from "./pdf-text.js";

const CONTROL_LIST_PDF = "https://exportcontrol.mofcom.gov.cn/upload/uploadfile/attach/202606/12/20260612151240357.pdf";
const CONTROL_LIST_PAGE = "https://exportcontrol.mofcom.gov.cn/article/hgfw/lywxcx/gzqd/202411/1067.html";
const EXPORT_LICENCE_PAGE = "https://xkzj.mofcom.gov.cn/tzgg/art/2026/art_c21114e6c05b42fb8aeb86fe8734aa61.html";

// The control code's own structure, as the list itself defines it. Decoding it
// gives the same axes an ECCN has, which is what makes the two comparable.
const INDUSTRY = {
  0: "核材料、设施与设备",
  1: "专用材料和相关设备、化学制品、微生物和毒素",
  2: "材料加工",
  3: "电子",
  4: "计算机",
  5: "电信与信息安全",
  6: "传感与激光",
  7: "导航与航空电子",
  8: "海洋技术",
  9: "航空航天与推进"
};

const ITEM_TYPE = {
  A: "系统、设备与部件",
  B: "试验、检验与生产设备",
  C: "材料",
  D: "软件",
  E: "技术"
};

const CONTROL_REASON = {
  0: "常规物项",
  1: "导弹相关（MTCR）",
  2: "核相关（NSG）",
  3: "生化相关（AG/CWC）",
  4: "监控化学品",
  5: "临时管制",
  9: "其他国家安全事由"
};

export function decodeControlCode(code) {
  const match = /^(\d)([A-E])(\d)(\d{2})$/.exec(String(code || "").trim());
  if (!match) return null;
  const [, industry, itemType, reason] = match;
  return {
    industry: INDUSTRY[industry] || null,
    itemType: ITEM_TYPE[itemType] || null,
    // Named as derived, because the mapping is the list's own stated convention
    // rather than a field printed against each entry.
    controlReasonDerived: CONTROL_REASON[reason] || null
  };
}

// The document's contents pages pad each entry with a dot leader to a page
// number, so a code appears twice: once in the contents with a truncated
// description, once in the body with the real one.
//
// Cutting the document at the last contents line loses entries — 23 of 189 —
// because the contents and the body interleave in the extracted stream. So
// nothing is cut. The dot leader is treated as the end of a description instead,
// and where a code appears twice the longer description wins, which is always the
// body's.
const DOT_LEADER = /\.{5,}/;

export function parseControlList(text, sourceUrl) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const records = [];
  lines.forEach((line, index) => {
    if (!/^\d[A-E]\d{3}$/.test(line)) return;
    // The description runs to the next control code; bare numbers are page
    // furniture and are dropped.
    const description = [];
    for (let at = index + 1; at < lines.length && description.length < 40; at += 1) {
      if (/^\d[A-E]\d{3}$/.test(lines[at])) break;
      if (DOT_LEADER.test(lines[at])) break;
      if (/^\d{1,3}$/.test(lines[at])) continue;
      description.push(lines[at]);
    }
    records.push({
      sourceId: "china-control-list",
      recordId: line,
      controlCode: line,
      ...decodeControlCode(line),
      description: description.join("").slice(0, 1200) || null,
      sourceUrl,
      humanReviewRequired: true
    });
  });
  // One entry per code, keeping the longest description where a code appears
  // more than once.
  const best = new Map();
  for (const record of records) {
    const existing = best.get(record.controlCode);
    if (!existing || (record.description || "").length > (existing.description || "").length) {
      best.set(record.controlCode, record);
    }
  }
  return [...best.values()];
}

export async function syncChinaControlList() {
  const file = await fetchPublicFile(CONTROL_LIST_PDF, { accept: "application/pdf", maxBytes: 30 * 1024 * 1024, attempts: 2 });
  const records = parseControlList(extractPdfText(file.bytes), CONTROL_LIST_PAGE);
  if (!records.length) throw new Error("No control codes were found in the PDF; its layout has changed.");
  return {
    extension: "pdf", file, records,
    syncScope: `mofcom_control_list+${records.length}_control_codes`,
    sourceUpdatedAt: null
  };
}

// The catalogue is a table: 序号 | 货物种类 | 海关商品编号 | 货物名称 | 单位.
// Extraction gives one cell per line, so a row is assembled around the customs
// code — the only field with a shape reliable enough to anchor on.
export function parseLicenceCatalogue(text, sourceUrl, sourceId) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const records = [];
  const seen = new Set();
  lines.forEach((line, index) => {
    if (!/^\d{10}$/.test(line) || seen.has(line)) return;
    seen.add(line);
    // The goods name follows the code; the category precedes it.
    const name = lines.slice(index + 1, index + 4).find((value) => /[一-鿿]/.test(value) && !/^\d/.test(value)) || null;
    const category = [...lines.slice(Math.max(0, index - 4), index)].reverse()
      .find((value) => /[一-鿿]/.test(value) && !/^\d/.test(value)) || null;
    records.push({
      sourceId,
      recordId: line,
      customsCode: line,
      goodsName: name,
      goodsCategory: category,
      licenceRequired: true,
      sourceUrl,
      humanReviewRequired: true
    });
  });
  return records;
}

// The attachment link carries a per-file token, so it is read from the
// announcement rather than hardcoded — a fixed URL would silently keep serving
// the superseded year's catalogue.
async function attachmentUrl(pageUrl) {
  const page = await fetchPublicFile(pageUrl, { accept: "text/html", maxBytes: 5 * 1024 * 1024 });
  const html = page.bytes.toString("utf8");
  const href = html.match(/href="(\/api-gateway\/[^"]*document\/download[^"]*)"/)?.[1];
  if (!href) throw new Error("The announcement page carries no attachment link; its layout has changed.");
  return new URL(href.replace(/&amp;/g, "&"), pageUrl).toString();
}

export async function syncChinaExportLicenceGoods() {
  const url = await attachmentUrl(EXPORT_LICENCE_PAGE);
  const file = await fetchPublicFile(url, {
    accept: "application/pdf",
    headers: { Referer: EXPORT_LICENCE_PAGE },
    maxBytes: 30 * 1024 * 1024,
    attempts: 2
  });
  const records = parseLicenceCatalogue(extractPdfText(file.bytes), EXPORT_LICENCE_PAGE, "china-export-licence-goods");
  if (!records.length) throw new Error("No customs codes were found in the catalogue; its layout has changed.");
  return {
    extension: "pdf", file, records,
    syncScope: `mofcom_export_licence_catalogue+${records.length}_customs_codes`,
    sourceUpdatedAt: null
  };
}

export const CN_LIST_ADAPTERS = {
  "china-control-list": { sync: syncChinaControlList, mode: "versioned_snapshot", credential: null },
  "china-export-licence-goods": { sync: syncChinaExportLicenceGoods, mode: "versioned_snapshot", credential: null }
};

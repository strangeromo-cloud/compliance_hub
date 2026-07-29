import { fetchPublicFile } from "./http.js";
import { htmlLinks, normalizeChineseText, stripHtml } from "./parsers.js";

const EXPORT_CONTROL_BASE = "https://exportcontrol.mofcom.gov.cn";
const EXPORT_CONTROL_LIST_API = `${EXPORT_CONTROL_BASE}/edi_ecms_web_front/front/column/getColumnList`;
const SECURITY_BUREAU_BASE = "https://aqygzj.mofcom.gov.cn";
const SECURITY_BUREAU_UNIT_API = `${SECURITY_BUREAU_BASE}/api-gateway/jpaas-publish-server/front/page/build/unit`;

// The MOFCOM export-control site only emits UTF-8 when the request looks like the
// site's own XHR call. Without these headers it replaces every Chinese character
// with "?" while still returning HTTP 200, so the headers are not optional.
const XHR_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "X-Requested-With": "XMLHttpRequest"
};

// Column IDs on exportcontrol.mofcom.gov.cn. 9 carries the control lists, the
// licence catalogue and the announcements that suspend or repeal earlier ones.
const EXPORT_CONTROL_COLUMNS = {
  controlList: 9,
  domesticRegulation: 10,
  faq: 17
};

// The security bureau publishes the control-list / watch-list designations here.
// These ids come from the page's own unitbuild.js parameters.
const SECURITY_BUREAU_COLUMN = {
  parseType: "bulidstatic",
  webId: "b28941ad4e064442856787562c9a4961",
  tplSetId: "DDBav9QvwJVbs9iznQVmO",
  pageType: "column",
  tagId: "信息列表",
  editType: "null",
  pageId: "79d6d2c4e44d458180d37dd4f0996645"
};

const NOTICE_NUMBER_PATTERN = /((?:商务部|海关总署|工业和信息化部|国家密码局|国家药监局|公安部|应急管理部|生态环境部|、|\s)*公告\s*(\d{4})\s*年\s*第\s*(\d+)\s*号)/g;
const CONTROL_CODE_PATTERN = /\b(\d[A-E]\d{3})((?:\.[a-z0-9]+)*)/g;
const AUTHORITY_NAMES = ["商务部", "海关总署", "工业和信息化部", "国家密码局", "国家药监局", "公安部", "应急管理部", "生态环境部", "外交部", "国家国防科技工业局"];

function absoluteUrl(base, path) {
  try { return new URL(path, base).toString(); } catch { return path; }
}

function noticeNumbers(text) {
  return [...new Set([...String(text).matchAll(NOTICE_NUMBER_PATTERN)].map((match) => `${match[2]}年第${match[3]}号`))];
}

function primaryNoticeNumber(text) {
  const tagged = String(text).match(/【发布文号】\s*([^\s【\n]+)/);
  if (tagged) return tagged[1];
  const first = noticeNumbers(text)[0];
  return first ? `商务部公告${first}` : null;
}

function issuingAuthorities(text) {
  const head = String(text).slice(0, 400);
  return AUTHORITY_NAMES.filter((authority) => head.includes(authority));
}

function publishedDate(text) {
  const tagged = String(text).match(/【发文日期】\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const source = tagged || String(text).match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!source) return null;
  return `${source[1]}-${String(source[2]).padStart(2, "0")}-${String(source[3]).padStart(2, "0")}`;
}

function effectiveFrom(text) {
  const explicit = String(text).match(/自\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日起/);
  if (explicit) return `${explicit[1]}-${String(explicit[2]).padStart(2, "0")}-${String(explicit[3]).padStart(2, "0")}`;
  if (/自\s*(?:本公告)?\s*(?:发布|公布)\s*之日起|自即日起/.test(text)) return publishedDate(text);
  return null;
}

// A notice is only useful if we know whether it issues, suspends, adjusts or
// repeals an earlier one. Getting this wrong is worse than not storing it.
// The title states what this notice does; the body usually also names the
// earlier notices being repealed, so the title has to win.
function classifyAction(scope) {
  if (/暂停实施/.test(scope)) return "suspend";
  if (/调整实施/.test(scope)) return "adjust";
  if (/移出|移除/.test(scope)) return "remove";
  if (/列入.*(?:管控名单|关注名单|不可靠实体清单)/.test(scope)) return "designate";
  if (/(?:公布|发布|印发)/.test(scope)) return "issue";
  if (/废止|不再适用/.test(scope)) return "repeal";
  if (/实施出口管制|加强.*出口管制|进行了调整/.test(scope)) return "issue";
  return null;
}

function noticeAction(title, text) {
  return classifyAction(String(title)) || classifyAction(String(text).slice(0, 800)) || "other";
}

function measureType(title, text) {
  const scope = `${title} ${String(text).slice(0, 800)}`;
  if (/不可靠实体清单/.test(scope)) return "unreliable_entity_list";
  if (/管控名单/.test(scope)) return "export_control_control_list";
  if (/关注名单/.test(scope)) return "export_control_watch_list";
  if (/许可证管理目录/.test(scope)) return "licence_catalogue";
  if (/出口管制清单/.test(scope)) return "dual_use_control_list";
  if (/临时管制|实施出口管制|出口管制的公告|加强.*出口管制|管理目录/.test(scope)) return "item_control_measure";
  return "other_notice";
}

function controlCodes(text) {
  return [...new Set([...String(text).matchAll(CONTROL_CODE_PATTERN)].map((match) => `${match[1]}${match[2] || ""}`))].slice(0, 200);
}

function hsCodes(text) {
  const codes = [];
  for (const match of String(text).matchAll(/参考海关商品编号[：:]\s*([0-9\s、，,]+)/g)) {
    for (const code of match[1].split(/[、，,\s]+/)) {
      if (/^\d{8,10}$/.test(code)) codes.push(code);
    }
  }
  return [...new Set(codes)].slice(0, 200);
}

async function fetchExportControlColumn(columnID, pageNumber = 1) {
  const file = await fetchPublicFile(EXPORT_CONTROL_LIST_API, {
    method: "POST",
    body: new URLSearchParams({ pageNumber: String(pageNumber), columnID: String(columnID), title: "" }).toString(),
    accept: "application/json, text/javascript, */*; q=0.01",
    headers: XHR_HEADERS,
    maxBytes: 12 * 1024 * 1024,
    attempts: 3
  });
  const text = file.bytes.toString("utf8");
  if (/"title":"[^"]*\?\?\?/.test(text)) throw new Error("MOFCOM returned mojibake instead of UTF-8; the XHR headers were rejected.");
  return { file, payload: JSON.parse(text) };
}

async function noticeAttachments(articleUrl) {
  try {
    const file = await fetchPublicFile(articleUrl, { accept: "text/html", maxBytes: 4 * 1024 * 1024, attempts: 1 });
    return htmlLinks(file.bytes.toString("utf8"), /\.(pdf|docx?|xlsx?|zip)(\?|$)|document\/download/i)
      .map((link) => ({ name: link.text || null, url: absoluteUrl(articleUrl, link.href) }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function normalizeExportControlNotice(row, index) {
  const url = absoluteUrl(EXPORT_CONTROL_BASE, row.url || row.htmlUrl || "");
  const title = normalizeChineseText(row.title || "");
  const content = normalizeChineseText(row.content || "");
  const notice = primaryNoticeNumber(`${title}\n${content}`);
  const referenced = noticeNumbers(content).filter((number) => !notice || !notice.includes(number));
  const action = noticeAction(title, content);
  return {
    sourceId: "china-dual-use",
    recordId: notice ? `${notice}-${index}` : `notice-${index}`,
    noticeNumber: notice,
    noticeTitle: title,
    measureType: measureType(title, content),
    noticeAction: action,
    // "suspend"/"repeal"/"adjust" notices point at earlier notices. Without this
    // link a reader can conclude a measure is in force after it was suspended.
    supersedesNotices: ["suspend", "repeal", "adjust"].includes(action) ? referenced : [],
    referencedNotices: referenced,
    issuingAuthorities: issuingAuthorities(`${title}\n${content}`),
    publishedAt: row.publishTimeStr ? String(row.publishTimeStr).slice(0, 10) : publishedDate(content),
    effectiveFrom: effectiveFrom(content),
    controlCodes: controlCodes(content),
    hsCodes: hsCodes(content),
    contentText: content,
    attachments: [],
    sourceUrl: url,
    humanReviewRequired: true,
    rawRecord: { columnName: row.columnName || null, snapshotRecordIndex: index }
  };
}

// Guidance articles are cited alongside the notices, and a deployment that
// cannot reach MOFCOM cannot fetch them at request time either. Capturing them
// here means the citation still resolves to the official text.
function normalizeGuidance(row, index) {
  const notice = normalizeExportControlNotice(row, index);
  return { ...notice, recordType: "guidance", measureType: "official_guidance", noticeAction: "guidance" };
}

async function syncChinaDualUseNotices() {
  const { file, payload } = await fetchExportControlColumn(EXPORT_CONTROL_COLUMNS.controlList);
  const rows = payload?.pageInfo?.rows || [];
  if (!rows.length) throw new Error("MOFCOM control-list column returned no rows.");
  const records = rows.map(normalizeExportControlNotice);

  // Best effort: guidance enriches the corpus but its absence must not fail the
  // control-list sync, which is the part that matters.
  // The column API returns an empty body for a few articles. Those are fetched
  // from the article page instead, so a cited document still has its text.
  async function backfillContent(record) {
    if (record.contentText) return record;
    try {
      const page = await fetchPublicFile(record.sourceUrl, { accept: "text/html", maxBytes: 4 * 1024 * 1024, attempts: 1 });
      return { ...record, contentText: stripHtml(page.bytes.toString("utf8")).slice(0, 20000), contentFrom: "article_page" };
    } catch { return record; }
  }

  try {
    // The column pages at 20; cited guidance sits beyond the first page.
    for (let page = 1; page <= 2; page += 1) {
      const guidance = await fetchExportControlColumn(EXPORT_CONTROL_COLUMNS.faq, page);
      const rows = guidance.payload?.pageInfo?.rows || [];
      const normalized = rows.map((row, index) => normalizeGuidance(row, records.length + index));
      records.push(...await Promise.all(normalized.map(backfillContent)));
      if (page >= (guidance.payload?.pageInfo?.maxPageNum || 1)) break;
    }
  } catch { /* control-list notices are still valid on their own */ }

  try {
    const laws = await fetchExportControlColumn(EXPORT_CONTROL_COLUMNS.domesticRegulation);
    const rows = (laws.payload?.pageInfo?.rows || []).map((row, index) => ({
      ...normalizeExportControlNotice(row, records.length + index),
      recordType: "regulation", measureType: "regulation", noticeAction: "regulation"
    }));
    records.push(...await Promise.all(rows.map(backfillContent)));
  } catch { /* the notices remain the primary payload */ }
  // Attachments carry the actual list PDFs, so fetch them for the newest notices.
  for (const record of records.slice(0, 12)) {
    record.attachments = await noticeAttachments(record.sourceUrl);
  }
  return {
    extension: "json",
    file,
    records,
    syncScope: "official_notice_corpus_requires_human_qa",
    sourceUpdatedAt: records.map((record) => record.publishedAt).filter(Boolean).sort().at(-1) || null
  };
}

async function syncChinaLicenceCatalogue() {
  const { file, payload } = await fetchExportControlColumn(EXPORT_CONTROL_COLUMNS.controlList);
  const rows = payload?.pageInfo?.rows || [];
  const records = rows
    .map(normalizeExportControlNotice)
    .filter((record) => record.measureType === "licence_catalogue")
    .map((record) => ({ ...record, sourceId: "china-licence-catalogue", supersededByLaterEdition: /已废止/.test(record.noticeTitle) }));
  if (!records.length) throw new Error("No licence-catalogue notice was found in the MOFCOM control-list column.");
  for (const record of records.slice(0, 4)) {
    record.attachments = await noticeAttachments(record.sourceUrl);
  }
  return {
    extension: "json",
    file,
    records,
    syncScope: "annual_catalogue_notices_attachment_snapshot_only",
    sourceUpdatedAt: records.map((record) => record.publishedAt).filter(Boolean).sort().at(-1) || null
  };
}

async function fetchSecurityBureauNotices(pages = 2) {
  const articles = [];
  let lastFile = null;
  for (let page = 1; page <= pages; page += 1) {
    const query = new URLSearchParams({ ...SECURITY_BUREAU_COLUMN, paramJson: JSON.stringify({ pageNo: page, pageSize: 15 }) });
    const file = await fetchPublicFile(`${SECURITY_BUREAU_UNIT_API}?${query}`, {
      accept: "application/json, text/javascript, */*; q=0.01",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      maxBytes: 4 * 1024 * 1024,
      attempts: 2
    });
    lastFile = file;
    const payload = JSON.parse(file.bytes.toString("utf8"));
    const html = payload?.data?.html || "";
    for (const link of htmlLinks(html, /art_[0-9a-f]{32}\.html$/)) {
      const url = absoluteUrl(SECURITY_BUREAU_BASE, link.href);
      if (!articles.some((article) => article.url === url)) articles.push({ url, listTitle: link.text || null });
    }
  }
  if (!articles.length) throw new Error("The MOFCOM security bureau listing returned no announcements.");
  return { articles, file: lastFile };
}

// Designation notices number their entities "1." / "1、" and label the fields
// with either "地址：" or the spaced form "地 址：". Some notices add
// "常用名称：" — the trade names actually used in transactions, which matter
// more for screening than the official Chinese rendering of the name.
const ORDINAL_PATTERN = /(?:^|\s)(\d{1,3})\s*[.、]\s*(?=\S)/g;
const FIELD_ADDRESS = /地\s*址\s*[：:]\s*([\s\S]{2,240}?)(?=\s*(?:邮\s*编|常用名称|其他名称|曾用名)\s*[：:]|$)/;
const FIELD_POSTCODE = /邮\s*编\s*[：:]\s*([A-Za-z0-9][A-Za-z0-9\- ]{1,14})/;
const FIELD_ALIASES = /(?:常用名称|其他名称|曾用名)\s*[：:]\s*([^\n]{1,200})/;

const COUNTRY_HINTS = [
  ["Italy", "IT"], ["Germany", "DE"], ["France", "FR"], ["Poland", "PL"], ["Netherlands", "NL"],
  ["Czech Republic", "CZ"], ["Bulgaria", "BG"], ["Lithuania", "LT"], ["Japan", "JP"],
  ["United States", "US"], ["USA", "US"], ["U.S.A", "US"], ["Canada", "CA"], ["United Kingdom", "GB"],
  ["India", "IN"], ["Taiwan", "TW"], ["Korea", "KR"], ["Singapore", "SG"]
];

function addressCountry(address) {
  const match = COUNTRY_HINTS.find(([name]) => new RegExp(name.replace(/\./g, "\\."), "i").test(address));
  return match ? { countryName: match[0], countryCode: match[1] } : { countryName: null, countryCode: null };
}

// Splitting on the ordinals first, then reading fields inside each block, keeps
// the parser working across both label styles and tolerates extra fields.
// The ordinals must run 1,2,3… so numbered paragraphs elsewhere in the notice
// are not mistaken for designations.
function designationBlocks(scope) {
  const markers = [...scope.matchAll(ORDINAL_PATTERN)]
    .map((match) => ({ ordinal: Number(match[1]), from: match.index, start: match.index + match[0].length }));
  const kept = [];
  let expected = 1;
  for (const marker of markers) {
    if (marker.ordinal !== expected) continue;
    kept.push(marker);
    expected += 1;
  }
  return kept.map((marker, index) => ({
    ordinal: marker.ordinal,
    text: scope.slice(marker.start, kept[index + 1]?.from ?? scope.length).slice(0, 600)
  }));
}

function parseDesignatedEntities(text, context) {
  const attachmentStart = text.search(/附件[\s\S]{0,60}?(?:管控名单|关注名单|不可靠实体清单)/);
  const scope = attachmentStart >= 0 ? text.slice(attachmentStart) : text;
  const entities = [];
  for (const block of designationBlocks(scope)) {
    const address = normalizeChineseText(block.text.match(FIELD_ADDRESS)?.[1] || "");
    // For name-only notices the block runs into the page footer, so the name has
    // to be taken from the first line rather than everything before "地址：".
    const heading = normalizeChineseText((address ? block.text.split(/地\s*址\s*[：:]/)[0] : block.text.split("\n")[0]) || "");
    // Some notices give the address, others only "中文名（English Name）".
    // Requiring one of the two keeps numbered prose out of the entity list.
    if (!address && !/[（(][^）)]{2,140}[）)]\s*$/.test(heading)) continue;
    const bracketed = heading.match(/[（(]([^）)]{1,140})[）)]\s*$/);
    const entityName = normalizeChineseText(bracketed ? heading.slice(0, bracketed.index) : heading);
    if (!entityName || entityName.length > 80) continue;
    const entityNameEn = bracketed ? normalizeChineseText(bracketed[1]) : null;
    const commonNames = (block.text.match(FIELD_ALIASES)?.[1] || "")
      .split(/[,，、;；]/).map((name) => normalizeChineseText(name)).filter(Boolean);
    entities.push({
      sourceId: context.sourceId,
      recordId: `${context.noticeNumber || context.sourceUrl}-${block.ordinal}`,
      listOrdinal: block.ordinal,
      entityName,
      entityNameEn,
      aliases: [...new Set([entityNameEn, ...commonNames].filter(Boolean))],
      addresses: address ? [address] : [],
      postalCode: block.text.match(FIELD_POSTCODE)?.[1]?.trim() || null,
      ...addressCountry(`${address} ${entityNameEn || ""}`),
      measureType: context.measureType,
      restrictionSummary: context.restrictionSummary,
      noticeNumber: context.noticeNumber,
      noticeTitle: context.noticeTitle,
      publishedAt: context.publishedAt,
      effectiveFrom: context.effectiveFrom,
      issuingAuthorities: context.issuingAuthorities,
      sourceUrl: context.sourceUrl,
      matchDisposition: "potential_match_requires_identity_review",
      humanReviewRequired: true
    });
  }
  return entities;
}

function restrictionSummary(text) {
  const measures = String(text).match(/并采取以下措施[：:]([\s\S]{0,600}?)(?:本公告自|附件)/);
  if (measures) return normalizeChineseText(measures[1]).replace(/\s+/g, " ").slice(0, 500);
  // Otherwise start after the document header so the site breadcrumbs and
  // "来源/类型" chrome do not end up quoted as the restriction.
  const body = String(text).split(/【发文日期】[^\n]*\n?/).at(-1) || text;
  const operative = body.match(/根据《[\s\S]{0,900}?(?=本公告自|附件|$)/);
  return normalizeChineseText(operative ? operative[0] : body).replace(/\s+/g, " ").slice(0, 500);
}

async function collectSecurityBureauRecords(sourceId, keep) {
  const { articles, file } = await fetchSecurityBureauNotices(2);
  const notices = [];
  const entities = [];
  for (const article of articles) {
    let text;
    try {
      const page = await fetchPublicFile(article.url, { accept: "text/html", maxBytes: 6 * 1024 * 1024, attempts: 1 });
      text = stripHtml(page.bytes.toString("utf8"));
    } catch {
      continue;
    }
    const title = normalizeChineseText(article.listTitle || text.split("\n")[0] || "");
    const type = measureType(title, text);
    if (!keep(type)) continue;
    const context = {
      sourceId,
      noticeNumber: primaryNoticeNumber(`${title}\n${text}`),
      noticeTitle: title,
      measureType: type,
      restrictionSummary: restrictionSummary(text),
      publishedAt: publishedDate(text),
      effectiveFrom: effectiveFrom(text),
      issuingAuthorities: issuingAuthorities(`${title}\n${text}`),
      sourceUrl: article.url
    };
    const designated = parseDesignatedEntities(text, context);
    entities.push(...designated);
    // The notice title states how many entities it designates ("将10家美国实体…"),
    // which gives the parser a free self-check. A mismatch means the extraction
    // is incomplete and the records must not be treated as a full list.
    const declared = title.match(/(\d+)\s*家/);
    const declaredEntityCount = declared ? Number(declared[1]) : null;
    notices.push({
      ...context,
      recordType: "notice",
      recordId: context.noticeNumber || article.url,
      noticeAction: noticeAction(title, text),
      referencedNotices: noticeNumbers(text).filter((number) => !context.noticeNumber?.includes(number)),
      designatedEntityCount: designated.length,
      declaredEntityCount,
      extractionComplete: declaredEntityCount === null ? null : declaredEntityCount === designated.length,
      humanReviewRequired: true
    });
  }
  return { notices, entities, file };
}

async function syncChinaControlEntities() {
  const { notices, entities, file } = await collectSecurityBureauRecords(
    "china-control-entities",
    (type) => type === "export_control_control_list" || type === "export_control_watch_list"
  );
  if (!notices.length) throw new Error("No control-list or watch-list designation notice was retrieved.");
  return {
    extension: "json",
    file,
    records: [...entities, ...notices.map((notice) => ({ ...notice, sourceId: "china-control-entities" }))],
    syncScope: "recent_designation_notices_entity_resolution_requires_human_qa",
    sourceUpdatedAt: notices.map((notice) => notice.publishedAt).filter(Boolean).sort().at(-1) || null
  };
}

async function syncChinaUnreliableEntity() {
  const { notices, entities, file } = await collectSecurityBureauRecords(
    "china-unreliable-entity",
    (type) => type === "unreliable_entity_list"
  );
  return {
    extension: "json",
    file,
    // An empty result is a real answer here: no UEL notice appeared in the
    // monitored window. It must not be recorded as a failed sync.
    records: [...entities, ...notices.map((notice) => ({ ...notice, sourceId: "china-unreliable-entity" }))],
    syncScope: notices.length ? "recent_uel_notices" : "no_uel_notice_in_monitored_window",
    sourceUpdatedAt: notices.map((notice) => notice.publishedAt).filter(Boolean).sort().at(-1) || null
  };
}

export const CN_ADAPTERS = {
  "china-dual-use": { sync: syncChinaDualUseNotices, mode: "official_notice_monitor", credential: null },
  "china-licence-catalogue": { sync: syncChinaLicenceCatalogue, mode: "official_notice_monitor", credential: null },
  "china-control-entities": { sync: syncChinaControlEntities, mode: "official_notice_monitor", credential: null },
  "china-unreliable-entity": { sync: syncChinaUnreliableEntity, mode: "official_notice_monitor", credential: null }
};

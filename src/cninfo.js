// The top ten shareholders of a Chinese listed company, from the disclosure site
// the exchanges designate.
//
// This is the China half of the ownership question, and it is the half with no
// structured route. GLEIF publishes no percentages. SEC EDGAR covers US
// registered issuers and nothing else. cninfo — 巨潮资讯网, the site the Shenzhen
// and Shanghai exchanges designate for statutory disclosure — reaches every A
// share, needs no key and no captcha, and publishes the shareholding table four
// times a year inside the periodic report. But it publishes it as a PDF.
//
// So this reads a number out of a document, which is the thing the rest of this
// system avoids doing. It is worth being exact about why that is acceptable here
// and what stops it going wrong.
//
// The extracted text is a flat token stream — the table's columns are gone — and
// the two exchanges do not lay the table out the same way. Shenzhen puts 股东性质
// between the name and the numbers; Shanghai's STAR board puts it after them,
// adds a 报告期内增减 column in front of the holding, and its largest holder is
// named in Latin. Anchoring on 股东性质, which is what this first did, read one
// exchange and returned nothing at all for the other.
//
// One thing holds across both: a large holding immediately followed by a small
// percentage. That pair is the anchor; everything else is read around it.
//
// The guard is arithmetic, and it is stronger here than on the US side. Each row
// carries BOTH the holding and the percentage, so each row implies a total share
// count of its own. Ten rows of one table must imply the same total. Where they
// agree the parse is sound; a row that implies a different company is a misread
// and is dropped. Nothing here needs to find a stated total to be checked
// against — the table checks itself, which is what makes reading a number out of
// a PDF defensible at all.
//
// Coverage, stated because it bounds every answer: listed companies only. A
// private Chinese company discloses none of this, and the register that would
// (国家企业信用信息公示系统) is behind a captcha and stays manual.

import { readNormalized } from "./data-layer/storage.js";
import { fetchPublicFile } from "./data-layer/http.js";
import { extractPdfText } from "./data-layer/pdf-text.js";
import { normalizeEntityName } from "./entity-matching.js";

export const SOURCE_ID = "cninfo";
const INDEX = "https://www.cninfo.com.cn/new/data/szse_stock.json";
const QUERY = "https://www.cninfo.com.cn/new/hisAnnouncement/query";
const STATIC = "https://static.cninfo.com.cn";
// The site serves its own front end; a request without one is refused.
const REFERER = "https://www.cninfo.com.cn/new/commonUrl?url=disclosure/list/notice";

// 证券简称 carries market decoration that is not part of the name: the A or B
// marks the share class of one company, and ST marks it as under special
// treatment. 京东方A and 京东方B are one issuer filing one annual report.
const shortName = (value) => String(value || "").replace(/^\*?ST\s*/i, "").replace(/[AB]$/, "").trim();

// Where the shareholding section begins, in the wordings the two exchanges use.
// Anchoring on the table's own heading is what keeps a number from an unrelated
// table being read as a holding.
const SECTION = /前十名股东持股情况|前\s*10\s*名股东持股情况|持股\s*5%\s*以上的股东或前\s*10\s*名股东持股情况|前十名股东、前十名流通股东/;
// And where it ends, before the notes that follow.
const SECTION_END = /上述股东关联关系|战略投资者或一般法人因配售新股|前\s*10\s*名无限售条件股东|前十名无限售条件股东|表决权恢复的优先股/;

// What survives flattening, in both layouts.
//
// The Shenzhen format puts 股东性质 between the name and the numbers; Shanghai's
// STAR board puts it after them, adds a 报告期内增减 column before the holding, and
// its largest holder is named in Latin (HKSCC NOMINEES LIMITED). Anchoring on
// 股东性质 read one and returned nothing for the other.
//
// One thing holds across both: a large holding immediately followed by a small
// percentage. Everything else — how many columns precede it, which side the
// nature sits on, what script the name is in — varies. So that pair is the
// anchor, and the arithmetic below decides whether the right number was taken:
// on the STAR row "237,375,542 4,479,200,864 55.99", picking the increase rather
// than the holding implies a company an order of magnitude smaller than the
// other nine rows do, and is dropped.
const ROW = /([\d][\d,]{5,})\s+(\d{1,2}(?:\.\d{1,2})?)(?![\d,.])/g;

// The nature vocabulary, removed before the name is read rather than used to
// find it — it is the one token that appears on either side of the name.
const NATURE = /(?:境\s*[内外]\s*(?:法\s*人|自\s*然\s*人)|国\s*有\s*法\s*人|其\s*他|未\s*知)/g;

// A name: Han characters or Latin letters. Digits are allowed inside one — index
// funds are named for the indices they track, 沪深300 — but a comma-grouped
// number is a neighbouring column, never part of a name, so it terminates the run.
const NAME_RUN = /[一-鿿][一-鿿A-Za-z0-9（）()＊*－—\-·、&\s]*|[A-Za-z][A-Za-z.&'\-\s]{3,}/g;

// The words a column header ends on, immediately before the first data row.
const LAST_COLUMN_WORD = /(?:股份状态|股东性质|期末持股数量|报告期内增减|全称|数量|情况|比例)/g;

// The table's own furniture, stripped before the name is looked for.
//
// In a flattened table the header runs straight into the first row, so the first
// shareholder came out named "以上的股东或前10名股东持股情况（不含通过转融通出借股份）
// 股东名称股东性质报". Filtering runs by what they start with was not enough —
// the run began mid-heading. These are removed wherever they appear instead.
const FURNITURE = /持股\s*5%\s*以上的股东或前\s*10\s*名股东持股情况|前十名股东持股情况|前\s*10\s*名股东持股情况|不含通过转融通出借股份|持有有限售条件的?股份数量|持有无限售条件的?股份数量|质押[、,]?\s*标记或冻结情况|报告期内增减变?动?情?况?|期末持股数量|股东名称（全称）|股东名称|股东性质|持股数量|持股比例|股份状态|股份总数|以上的股东或前\s*10\s*名|单位[：:]\s*股|全称|比例|数量|情况|无限售|有限售/g;

const count = (value) => Number(String(value).replace(/,/g, "")) || null;

// Two implied totals agree if they are within two per cent of each other.
// Rounding a holding to two decimals moves the implied total by a fraction of a
// per cent; taking the wrong column moves it by an order of magnitude.
const AGREEMENT = 0.02;

export function parseShareholders(text) {
  const body = String(text || "");
  const from = body.search(SECTION);
  if (from < 0) return { holders: [], rejected: [], impliedShares: null, agreed: false, sectionFound: false };
  const rest = body.slice(from);
  const to = rest.search(SECTION_END);
  const region = to > 0 ? rest.slice(0, to) : rest.slice(0, 6000);

  const raw = [];
  let previousEnd = 0;
  ROW.lastIndex = 0;
  for (const match of region.matchAll(ROW)) {
    const between = region.slice(previousEnd, match.index);
    previousEnd = match.index + match[0].length;
    const shares = count(match[1]);
    const percent = Number(match[2]);
    if (!shares || !percent || percent > 100) continue;

    // The name is the last thing before the numbers that reads like one, once the
    // table's furniture and the nature token are out of the way.
    // The first row is the awkward one: its stretch of text starts at the section
    // heading, so the whole column header sits in front of the name with no
    // separator a Han-character run would stop at. Cutting after the last column
    // word handles it in one step, where stripping the headings one by one kept
    // leaving residue — the extractor hyphenates them differently in every
    // report. Later rows contain none of these words, so the cut is a no-op.
    LAST_COLUMN_WORD.lastIndex = 0;
    const header = [...between.matchAll(LAST_COLUMN_WORD)].at(-1);
    const afterHeader = header ? between.slice(header.index + header[0].length) : between;
    FURNITURE.lastIndex = 0;
    NATURE.lastIndex = 0;
    NAME_RUN.lastIndex = 0;
    const cleaned = afterHeader.replace(FURNITURE, " ").replace(NATURE, " ");
    const name = [...cleaned.matchAll(NAME_RUN)]
      .map((run) => run[0]
        // Whitespace between Han characters is the extractor's line wrapping and
        // goes; between Latin words it is part of the name and stays. Collapsing
        // both left HKSCC NOMINEES LIMITED as one token, which matches nothing on
        // a list that carries it as three.
        // Full-width punctuation counts as Chinese for this: a name broken across
        // lines at "－集团本级－ 自有资金" is one name, not two words.
        .replace(/\s+/g, (space, at, whole) => {
          const chinese = /[一-鿿（）－—·、，]/;
          return chinese.test(whole[at - 1] || "") && chinese.test(whole[at + space.length] || "") ? "" : " ";
        })
        .trim()
        // A row can open with a placeholder where a column is not applicable —
        // "无-鑫芯（香港）投资有限公司" — and close with the next column's digits.
        .replace(/^[无\s\-—－·、,，.]+/, "")
        .replace(/[\s\-—－·、,，.0-9]+$/, "")
        .trim())
      .filter((run) => run.length >= 2)
      .at(-1) || null;
    if (!name || name.length > 80) continue;
    raw.push({ name, shares, percentOfClass: percent });
  }
  if (!raw.length) return { holders: [], rejected: [], impliedShares: null, agreed: false, sectionFound: true };

  // Each row implies a total. The median of them is the table's own answer, and
  // every row is then checked against it.
  const implied = raw.map((row) => (row.shares / row.percentOfClass) * 100).sort((left, right) => left - right);
  const median = implied[Math.floor(implied.length / 2)];
  const holders = [];
  const rejected = [];
  for (const row of raw) {
    const own = (row.shares / row.percentOfClass) * 100;
    if (Math.abs(own - median) / median > AGREEMENT) {
      rejected.push({ ...row, impliedShares: Math.round(own) });
      continue;
    }
    holders.push(row);
  }
  return {
    holders,
    rejected,
    impliedShares: Math.round(median),
    // True only when every row read agreed with the rest. A table where one row
    // had to be dropped is reported as such rather than as a clean read.
    agreed: holders.length > 0 && rejected.length === 0,
    sectionFound: true
  };
}

// The listed company a counterparty name refers to.
//
// The index carries 证券简称 — the exchange's short name — while a counterparty is
// named by its legal name, so the relationship is containment by construction:
// 平安银行 inside 平安银行股份有限公司. That is the direction accepted, and only
// that direction.
//
// Containment is what put Allianz SE in a file as Volkswagen's parent, so it does
// not stand alone here. 东方 is contained in 北京京东方科技集团股份有限公司 and is a
// different listed company entirely; the longer match is the more specific one
// and wins, and where the best two are the same length the choice goes to the
// reviewer rather than to whichever the index listed first.
export function resolveListedCompany(records, legalName) {
  const target = normalizeEntityName(legalName);
  if (!target) return { candidates: [] };
  const byName = new Map();
  for (const record of records) {
    const short = shortName(record.shortName);
    const normalized = normalizeEntityName(short);
    if (!normalized || normalized.length < 2 || !target.includes(normalized)) continue;
    // A and B shares of one issuer collapse to one company; it files one report.
    if (!byName.has(normalized)) byName.set(normalized, { shortName: short, code: record.code, orgId: record.orgId, matched: normalized.length });
  }
  const candidates = [...byName.values()].sort((left, right) => right.matched - left.matched);
  if (!candidates.length) return { candidates: [] };
  if (candidates.length === 1 || candidates[0].matched > candidates[1].matched) {
    return { company: candidates[0], candidates };
  }
  return { ambiguous: true, candidates };
}

async function post(url, form) {
  const file = await fetchPublicFile(url, {
    method: "POST",
    body: new URLSearchParams(form).toString(),
    accept: "application/json",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: REFERER },
    maxBytes: 4 * 1024 * 1024,
    attempts: 2
  });
  return JSON.parse(file.bytes.toString("utf8"));
}

export async function topShareholders(name) {
  const legalName = String(name || "").trim();
  if (legalName.length < 3) return null;

  const { records } = await readNormalized(SOURCE_ID).catch(() => ({ records: [] })) || { records: [] };
  if (!records?.length) return { queried: legalName, notSynced: true };

  const resolved = resolveListedCompany(records, legalName);
  if (resolved.ambiguous) return { queried: legalName, ambiguous: true, candidates: resolved.candidates.slice(0, 6) };
  if (!resolved.company) return { queried: legalName, notListed: true };
  const company = resolved.company;

  let listing;
  try {
    listing = await post(QUERY, {
      stock: `${company.code},${company.orgId}`,
      tabName: "fulltext", pageSize: "10", pageNum: "1",
      column: company.code.startsWith("6") || company.code.startsWith("9") ? "sse" : "szse",
      category: "category_ndbg_szsh", isHLtitle: "true"
    });
  } catch (error) {
    return { queried: legalName, company, unavailable: String(error.message).slice(0, 160) };
  }

  // The annual report itself, not its summary: 年度报告摘要 carries the headline
  // figures and drops the shareholding table.
  const report = (listing.announcements || [])
    .filter((item) => /年度报告/.test(item.announcementTitle || "") && !/摘要|英文|更正|修订/.test(item.announcementTitle || ""))
    .sort((left, right) => (right.announcementTime || 0) - (left.announcementTime || 0))[0];
  if (!report) return { queried: legalName, company, noReport: true };

  let parsed;
  const sourceUrl = `${STATIC}/${String(report.adjunctUrl).replace(/^\/+/, "")}`;
  try {
    const file = await fetchPublicFile(sourceUrl, { accept: "application/pdf", maxBytes: 64 * 1024 * 1024, attempts: 2, headers: { Referer: REFERER } });
    parsed = parseShareholders(await extractPdfText(file.bytes));
  } catch (error) {
    return { queried: legalName, company, unavailable: String(error.message).slice(0, 160) };
  }

  return {
    queried: legalName,
    company,
    report: { title: report.announcementTitle, publishedAt: new Date(Number(report.announcementTime)).toISOString().slice(0, 10), sourceUrl },
    holders: parsed.holders,
    rejected: parsed.rejected,
    impliedShares: parsed.impliedShares,
    tableAgreed: parsed.agreed,
    sectionFound: parsed.sectionFound,
    meaning: "数据来自公司年度报告中「前 10 名股东持股情况」表，由 PDF 文本解析得到，并以各行「持股数量 ÷ 持股比例」相互校验（各行隐含的总股本必须一致，不一致的行会被丢弃并报告）。它是登记在册的股东，不等于受益所有人，也不含 5% 以下与非上市主体；披露为季度时点，不是当前持股。"
  };
}

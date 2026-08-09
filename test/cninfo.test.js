import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShareholders, resolveListedCompany } from "../src/cninfo.js";

// The two layouts, as the PDF extractor actually renders them: a flat token
// stream with the columns gone and the line wrapping left in. Both fragments
// below are taken from real annual reports.
//
// Shenzhen (平安银行): 股东性质 sits between the name and the numbers.
const SHENZHEN = `持股 5% 以上的股东或前 10 名股东持股情况（不含通过转融通出借股份） 股东名称 股东性质 报告期末 持股数量 持股 比例 （ % ） 报告期内 增减变动情况 持有有限售 条件的股份 数量 质押 、 标记或冻结 情况 股份状态 数量
中国平安保险（集团）股 份有限公司－集团本级－ 自有资金 境内法人 9,618,540,236 49.56 - - 9,618,540,236 - -
中国平安人寿保险股份有 限公司－自有资金 境内法人 1,186,100,488 6.11 - - 1,186,100,488 - -
香港中央结算有限公司 境 外 法人 628,291,149 3.24 (118,590,574) - 628,291,149 - -
上述股东关联关系或一致行动的说明`;

// Shanghai's STAR board (中芯国际): 股东性质 comes AFTER the numbers, a
// 报告期内增减 column comes BEFORE the holding, and the largest holder is Latin.
const STAR = `前十名股东持股情况 （不含通过转融通出借股份） 股东名称 （全称） 报告期内增减 期末持股数量 比例 (%) 持有有限 售条件股 份数量 质押 、 标记 或冻结情况 股东 性质 股份 状态 数量
HKSCC NOMINEES LIMITED 237,375,542 4,479,200,864 55.99 - 未知 - 未知
大唐控股（香港）投资有限公司 8,190,000 1,125,042,595 14.06 - 未知 - 未知
无 - 鑫芯（香港）投资有限公司 -234,312,781 382,902,023 4.79 - 未知 - 未知
上述股东关联关系或一致行动的说明`;

test("both exchanges' layouts are read, and the holder is not the column beside it", () => {
  // Anchoring on 股东性质 read Shenzhen and returned nothing at all for the STAR
  // board, which puts it on the other side of the numbers. The anchor is the
  // holding-then-percentage pair, which is the one thing both share.
  const sz = parseShareholders(SHENZHEN);
  assert.deepEqual(sz.holders.map((holder) => holder.percentOfClass), [49.56, 6.11, 3.24]);
  assert.equal(sz.holders[0].name, "中国平安保险（集团）股份有限公司－集团本级－自有资金");
  assert.equal(sz.holders[0].shares, 9_618_540_236);

  const star = parseShareholders(STAR);
  assert.deepEqual(star.holders.map((holder) => holder.percentOfClass), [55.99, 14.06, 4.79]);
  // On this row the holding is the SECOND number: "237,375,542 4,479,200,864
  // 55.99" opens with the period's change. Taking the first would imply a company
  // an order of magnitude smaller than the other rows do.
  assert.equal(star.holders[0].shares, 4_479_200_864);
  // Latin names keep their spaces — a list carries HKSCC NOMINEES LIMITED as
  // three words, and collapsing them matches nothing.
  assert.equal(star.holders[0].name, "HKSCC NOMINEES LIMITED");
  // A row can open with a placeholder where a column does not apply.
  assert.equal(star.holders[2].name, "鑫芯（香港）投资有限公司");
});

test("the column header is not read as the first shareholder", () => {
  // In a flattened table the header runs straight into the first row with no
  // separator a Han-character run stops at, so the first holder came out named
  // "以上的股东或前10名股东持股情况（不含通过转融通出借股份）股东名称股东性质报".
  for (const document of [SHENZHEN, STAR]) {
    const first = parseShareholders(document).holders[0].name;
    assert.equal(/股东名称|股东性质|持股比例|持股情况|股份状态/.test(first), false, first);
  }
});

test("the table checks itself, and a row that contradicts it is dropped", () => {
  // This is what makes reading a number out of a PDF defensible: every row
  // carries both a holding and a percentage, so all of them must imply the same
  // total share count.
  const sz = parseShareholders(SHENZHEN);
  assert.equal(sz.agreed, true);
  assert.ok(Math.abs(sz.impliedShares - 19_404_348_634) / 19_404_348_634 < 0.01, String(sz.impliedShares));

  const broken = SHENZHEN.replace("628,291,149 3.24", "62,829,114,900 3.24");
  const parsed = parseShareholders(broken);
  assert.equal(parsed.agreed, false, "a row implying a different company must not pass");
  assert.equal(parsed.rejected.length, 1);
  assert.equal(parsed.rejected[0].name, "香港中央结算有限公司");
  assert.deepEqual(parsed.holders.map((holder) => holder.percentOfClass), [49.56, 6.11]);
});

test("a number outside the shareholding section is never read as a holding", () => {
  assert.equal(parseShareholders("本期营业收入 1,234,567,890 增长 5.2%").sectionFound, false);
  assert.deepEqual(parseShareholders("本期营业收入 1,234,567,890 增长 5.2%").holders, []);
});

// The index carries 证券简称; a counterparty is named by its legal name.
const INDEX = [
  { shortName: "平安银行", code: "000001", orgId: "gssz0000001" },
  { shortName: "京东方A", code: "000725", orgId: "gssz0000725" },
  { shortName: "京东方B", code: "200725", orgId: "gssz0200725" },
  { shortName: "*ST东方", code: "600811", orgId: "gssh0600811" },
  { shortName: "万科A", code: "000002", orgId: "gssz0000002" }
];

test("a legal name resolves to the listed company, and the longer match wins", () => {
  assert.equal(resolveListedCompany(INDEX, "平安银行股份有限公司").company.code, "000001");
  // 东方 is contained in 北京京东方科技集团股份有限公司 and is a different listed
  // company. Containment alone is what put Allianz SE in a file as Volkswagen's
  // parent; the more specific match is the one taken.
  const bo = resolveListedCompany(INDEX, "北京京东方科技集团股份有限公司");
  assert.equal(bo.company.shortName, "京东方");
  assert.equal(bo.candidates.length, 2, "the rejected candidate is still reported");
  // A and B shares are one issuer filing one report.
  assert.equal(bo.candidates.filter((item) => item.shortName === "京东方").length, 1);
  // The market decoration is not part of the name.
  assert.equal(resolveListedCompany(INDEX, "万科企业股份有限公司").company.code, "000002");
});

test("a company whose short name is not inside its legal name is reported unfound", () => {
  // 浪潮电子信息产业股份有限公司 lists as 浪潮信息, which is not a run of its legal
  // name. Saying so beats guessing at the nearest thing.
  assert.deepEqual(resolveListedCompany(INDEX, "浪潮电子信息产业股份有限公司").candidates, []);
  assert.equal(resolveListedCompany(INDEX, "浪潮电子信息产业股份有限公司").company, undefined);
});

import { strict as assert } from "node:assert";
import { deflateSync } from "node:zlib";
import test from "node:test";
import { extractPdfText } from "../src/data-layer/pdf-text.js";
import { decodeControlCode, parseControlList, parseLicenceCatalogue } from "../src/data-layer/adapters-cn-lists.js";

// A PDF built the way MOFCOM's are: Identity-H glyph codes that mean nothing
// without the font's ToUnicode map, and one positioning operator per glyph.
function buildPdf({ glyphs, cmap }) {
  const content = deflateSync(Buffer.from(
    "BT /FT1 12 Tf 0.05 0 0 -0.05 100 700 Tm\n"
    + glyphs.map((code, index) => `${index ? "10 0 TD" : ""}<${code}>Tj\n`).join("")
    + "ET"
  , "latin1"));
  const toUnicode = deflateSync(Buffer.from(
    `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n${cmap.length} beginbfchar\n`
    + cmap.map(([code, unicode]) => `<${code}> <${unicode}>`).join("\n")
    + "\nendbfchar\nendcmap\nend\nend", "latin1"));

  const objects = [
    "<</Type /Page /Resources <</Font <</FT1 2 0 R>>>> /Contents 4 0 R>>",
    "<</Type /Font /Subtype /Type0 /BaseFont /TEST+Font /Encoding /Identity-H /ToUnicode 3 0 R>>",
    { dict: `<</Filter /FlateDecode /Length ${toUnicode.length}>>`, stream: toUnicode },
    { dict: `<</Filter /FlateDecode /Length ${content.length}>>`, stream: content }
  ];
  const parts = [Buffer.from("%PDF-1.7\n", "latin1")];
  objects.forEach((object, index) => {
    parts.push(Buffer.from(`${index + 1} 0 obj `, "latin1"));
    if (typeof object === "string") parts.push(Buffer.from(`${object}\nendobj\n`, "latin1"));
    else {
      parts.push(Buffer.from(`${object.dict}\nstream\n`, "latin1"), object.stream,
        Buffer.from("\nendstream\nendobj\n", "latin1"));
    }
  });
  parts.push(Buffer.from("%%EOF\n", "latin1"));
  return Buffer.concat(parts);
}

test("Identity-H glyph codes are decoded through the font's ToUnicode map", () => {
  // The failure this pins: reading the hex of a text operator as UTF-16 units
  // rather than as bytes yields nothing at all, because the pairing happens twice.
  const pdf = buildPdf({
    glyphs: ["0003", "0004", "0005"],
    cmap: [["0003", "4E2D"], ["0004", "56FD"], ["0005", "0033"]]
  });
  assert.equal(extractPdfText(pdf).replace(/\s+/g, ""), "中国3");
});

test("a glyph-per-operator layout does not become one character per line", () => {
  // Every glyph here is placed by its own TD with dy=0, which is how these
  // documents are typeset. Treating each move as a line break returned text one
  // character tall and made every control code unfindable.
  const pdf = buildPdf({
    glyphs: ["0003", "0004", "0005", "0006", "0007"],
    cmap: [["0003", "0031"], ["0004", "0043"], ["0005", "0033"], ["0006", "0035"], ["0007", "0031"]]
  });
  const text = extractPdfText(pdf);
  assert.match(text, /1C351/, "the code must survive as one token");
});

test("a PDF with no text layer is reported, not returned empty", () => {
  const scan = Buffer.from("%PDF-1.7\n1 0 obj <</Type /Page>>\nendobj\n%%EOF\n", "latin1");
  assert.throws(() => extractPdfText(scan), /ToUnicode|no text|scan/i);
});

test("a control code decodes into the axes an ECCN also has", () => {
  assert.deepEqual(decodeControlCode("3C003"), {
    industry: "电子", itemType: "材料", controlReasonDerived: "常规物项"
  });
  assert.deepEqual(decodeControlCode("1C351"), {
    industry: "专用材料和相关设备、化学制品、微生物和毒素", itemType: "材料", controlReasonDerived: "生化相关（AG/CWC）"
  });
  assert.equal(decodeControlCode("not-a-code"), null);
});

test("an entry listed in the contents as well as the body keeps the body's text", () => {
  // Cutting the document at the last contents line lost 23 of 189 codes, because
  // the two interleave once extracted. Both occurrences are read instead, and the
  // longer description wins.
  const text = [
    "3C003", "锑相关物项", "..............................", "12",   // contents
    "3C003", "锑相关物项：以下之一的锑化合物，纯度高于百分之九十九。"          // body
  ].join("\n");
  const records = parseControlList(text, "https://example.test/list");
  assert.equal(records.length, 1, "one record per code");
  assert.match(records[0].description, /纯度高于百分之九十九/);
  assert.ok(!records[0].description.includes("."), "the dot leader must not leak into the text");
});

test("a licence-catalogue row is assembled around its customs code", () => {
  const text = ["序号", "货物种类", "海关商品编号", "货物名称", "单位",
    "1", "活牛", "0102290000", "非改良种用家牛", "千克/头"].join("\n");
  const [record] = parseLicenceCatalogue(text, "https://example.test/cat", "china-export-licence-goods");
  assert.equal(record.customsCode, "0102290000");
  assert.equal(record.goodsName, "非改良种用家牛");
  assert.equal(record.goodsCategory, "活牛");
  assert.equal(record.licenceRequired, true);
});

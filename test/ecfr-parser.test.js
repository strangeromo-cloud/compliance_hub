import { strict as assert } from "node:assert";
import test from "node:test";
import { parseEcfrPart } from "../src/data-layer/adapters.js";
import { xmlCells } from "../src/data-layer/parsers.js";

// Structures copied from the eCFR XML for title 15, shortened. The shapes that
// matter are: sections are DIV8, supplements are DIV9, ECCN entries open with the
// number in bold, and table cells may be self-closing.
const part = (body) => `<DIV5 N="774" TYPE="PART"><HEAD>PART 774</HEAD>${body}</DIV5>`;
const section = (n, head) => `<DIV8 N="${n}" TYPE="SECTION"><HEAD>&#xA7; ${n} ${head}</HEAD><P>Body of ${n}.</P></DIV8>`;

test("a self-closing table cell keeps its column position", () => {
  // The failure this pins: a greedy `<TD[^>]*(?:/>|>…</TD>)` merges the empty
  // cell with the one after it, shifting every later column left by one.
  const row = `<TD>China</TD><TD>X</TD><TD/><TD>X</TD><TD class="c"/><TD>X</TD>`;
  assert.deepEqual(xmlCells(row), ["China", "X", "", "X", "", "X"]);
});

test("supplements are captured, not only numbered sections", () => {
  const xml = part(`${section("774.1", "Introduction.")}
    <DIV9 N="Supplement No. 6 to Part 774" TYPE="APPENDIX"><HEAD>Supplement No. 6 to Part 774&#x2014;Sensitive List</HEAD><P>Items on the Sensitive List.</P></DIV9>`);
  const { records, syncScope } = parseEcfrPart(xml, { sourceId: "bis-ccl", part: 774 });
  assert.equal(records.filter((record) => record.recordType === "regulation").length, 1);
  const supplement = records.find((record) => record.recordType === "supplement");
  assert.equal(supplement.supplement, "Supplement No. 6 to Part 774");
  assert.match(supplement.content, /Sensitive List/);
  assert.match(syncScope, /1_sections\+1_supplements/);
});

test("numeric entities are decoded so cited text is readable", () => {
  const xml = part(section("774.1", "Introduction."));
  const [record] = parseEcfrPart(xml, { sourceId: "bis-ccl", part: 774 }).records;
  assert.match(record.title, /^§ 774\.1/);
  assert.ok(!record.title.includes("&#x"));
});

test("the CCL appendix becomes one record per ECCN entry", () => {
  const xml = part(`<DIV9 N="Supplement No. 1 to Part 774" TYPE="APPENDIX"><HEAD>Supplement No. 1 to Part 774&#x2014;The Commerce Control List</HEAD>
    <P>Category 3 preamble.</P>
    <P><B>3A090</B> Integrated circuits as follows (see List of Items Controlled). Details for 3A090 including 3A001 cross reference.</P>
    <P><B>3A991</B> Other integrated circuits. Details.</P></DIV9>`);
  const { records, syncScope } = parseEcfrPart(xml, { sourceId: "bis-ccl", part: 774 });
  const entries = records.filter((record) => record.recordType === "control_list_entry");
  assert.deepEqual(entries.map((entry) => entry.eccn), ["3A090", "3A991"]);
  // A cross-reference inside an entry must not open a record of its own.
  assert.match(entries[0].content, /3A001 cross reference/);
  assert.match(entries[0].title, /^3A090 Integrated circuits/);
  assert.match(syncScope, /2_control_list_entries/);
});

test("the Entity List splits a name from its address but keeps the whole cell", () => {
  const xml = `<DIV5 N="744" TYPE="PART"><DIV9 N="Supplement No. 4 to Part 744" TYPE="APPENDIX"><HEAD>Supplement No. 4 to Part 744&#x2014;Entity List</HEAD>
    <TABLE><TR><TH>Country</TH><TH>Entity</TH><TH>License requirement</TH><TH>License review policy</TH><TH>Federal Register citation</TH></TR>
    <TR><TD>CHINA, PEOPLE'S REPUBLIC OF</TD><TD>Huawei Technologies Co., Ltd., Bantian, Shenzhen, China; and</TD><TD>For all items subject to the EAR.</TD><TD>Presumption of denial</TD><TD>84 FR 22961, 5/21/19.</TD></TR>
    <TR><TD/><TD>Huawei Cloud Argentina, Buenos Aires, Argentina; and</TD><TD>For all items subject to the EAR.</TD><TD>Presumption of denial</TD><TD>87 FR 6026, 2/3/22.</TD></TR></TABLE></DIV9></DIV5>`;
  const entries = parseEcfrPart(xml, { sourceId: "bis-ear-744", part: 744 }).records
    .filter((record) => record.recordType === "listed_entry");
  // A comma before a corporate suffix stays inside the name; a comma before a
  // place name ends it. Trailing separator punctuation is normalized away.
  assert.equal(entries[0].entityName, "Huawei Technologies Co., Ltd");
  assert.equal(entries[1].entityName, "Huawei Cloud Argentina");
  // The country cell is empty on continuation rows and must carry forward.
  assert.equal(entries[1].country, "CHINA, PEOPLE'S REPUBLIC OF");
  assert.equal(entries[0].federalRegisterCitation, "84 FR 22961, 5/21/19.");
  // The full cell is preserved, so a heuristic split can always be checked.
  assert.match(entries[1].addresses[0], /Buenos Aires/);
  assert.equal(entries[0].matchDisposition, "potential_match_requires_review");
});

test("the Country Chart maps X marks to control reasons only when columns line up", () => {
  const headers = ["CB 1", "CB 2", "CB 3", "NP 1", "NP 2", "NS 1", "NS 2", "MT 1", "RS 1", "RS 2"];
  const xml = `<DIV5 N="738" TYPE="PART"><DIV9 N="Supplement No. 1 to Part 738" TYPE="APPENDIX"><HEAD>Supplement No. 1 to Part 738&#x2014;Commerce Country Chart</HEAD>
    <TABLE><TR><TH>Countries</TH>${headers.map((head) => `<TH>${head}</TH>`).join("")}</TR>
    <TR><TD>Canada</TD><TD>X</TD><TD/><TD/><TD/><TD/><TD/><TD/><TD/><TD/><TD/></TR>
    <TR><TD>Albania 2 3</TD><TD>X</TD><TD>X</TD><TD/><TD>X</TD><TD/><TD>X</TD><TD/><TD/><TD/><TD/></TR>
    <TR><TD>Iran 1</TD></TR></TABLE></DIV9></DIV5>`;
  const rows = parseEcfrPart(xml, { sourceId: "bis-country-chart", part: 738 }).records
    .filter((record) => record.recordType === "country_chart_row");
  const canada = rows.find((row) => row.country === "Canada");
  assert.deepEqual(canada.licenceRequiredFor, ["CB1"]);
  assert.equal(canada.columnAlignment, "verified");
  const albania = rows.find((row) => row.country === "Albania");
  // Footnote markers ride in the country cell and are kept separately.
  assert.equal(albania.countryNotes, "2 3");
  assert.deepEqual(albania.licenceRequiredFor, ["CB1", "CB2", "NP1", "NS1"]);
  // A short row is reported as unverified rather than mapped to a guess: a
  // shifted X would change which licence the answer says is required.
  const iran = rows.find((row) => row.country === "Iran");
  assert.equal(iran.columnAlignment, "unverified_cell_count");
  assert.deepEqual(iran.licenceRequiredFor, []);
});

test("a part with no parsable division still yields one record", () => {
  const { records } = parseEcfrPart("<DIV5 N=\"999\"></DIV5>", { sourceId: "bis-ear", part: 999 });
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, "part-999");
});

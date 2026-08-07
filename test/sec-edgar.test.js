import { test } from "node:test";
import assert from "node:assert/strict";
import { classKey, parseSchedule13 } from "../src/sec-edgar.js";
import { holderMatches } from "../src/grounding.js";

// A Schedule 13D/G as SEC has published it since 18 December 2024: structured
// XML with the share in a named field, one cover-page block per reporting
// person, and the filer's name repeated in the signature block below.
const filing = ({ issuerCik = "0001084869", issuerName = "1-800-Flowers.com Inc", securityClass = "Class A Common Stock", persons = [] }) => `<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/schedule13g">
  <headerData><submissionType>SCHEDULE 13G</submissionType></headerData>
  <formData>
    <coverPageHeader>
      <securitiesClassTitle>${securityClass}</securitiesClassTitle>
      <issuerInfo>
        <issuerCik>${issuerCik}</issuerCik>
        <issuerName>${issuerName}</issuerName>
      </issuerInfo>
    </coverPageHeader>
${persons.map((person) => `    <coverPageHeaderReportingPersonDetails>
      <reportingPersonName>${person.name}</reportingPersonName>
      <reportingPersonBeneficiallyOwnedNumberOfShares>
        <soleVotingPower>${person.shares || 0}.00</soleVotingPower>
        <sharedVotingPower>0.00</sharedVotingPower>
      </reportingPersonBeneficiallyOwnedNumberOfShares>
      <reportingPersonBeneficiallyOwnedAggregateNumberOfShares>${person.shares || 0}.00</reportingPersonBeneficiallyOwnedAggregateNumberOfShares>
      <classPercent>${person.percent}</classPercent>
      <typeOfReportingPerson>${person.type || "IA"}</typeOfReportingPerson>
    </coverPageHeaderReportingPersonDetails>`).join("\n")}
    <items><item4><classPercent>See Row (11) of the Reporting Person's cover page.</classPercent></item4></items>
    <signatureInformation>
      <reportingPersonName>${persons[0]?.name || ""}</reportingPersonName>
    </signatureInformation>
  </formData>
</edgarSubmission>`;

test("the filed share is read from the reporting person's own cover page", () => {
  const parsed = parseSchedule13(filing({
    persons: [
      { name: "Fund 1 Investments, LLC", percent: "14.64", shares: 5_300_000, type: "OO" },
      { name: "Mitchell Jacobson", percent: "6.4", shares: 2_329_850, type: "IN" }
    ]
  }));

  assert.equal(parsed.persons.length, 2, "a group files one cover page per member and each reports its own share");
  assert.deepEqual(parsed.persons.map((person) => person.percentOfClass), [14.64, 6.4]);
  assert.equal(parsed.persons[0].shares, 5_300_000);
  // The code separates "a fund votes these shares" from "a person owns this
  // company", which is the distinction the 50 Percent Rule turns on.
  assert.deepEqual(parsed.persons.map((person) => person.personType), ["OO", "IN"]);
  // Item 4 also carries a classPercent, and its value is the sentence
  // "See Row (11) of the Reporting Person's cover page." Reading the percentage
  // from the document rather than from inside the cover-page block would take
  // that sentence, or the first block's number for every filer in the group.
  assert.ok(parsed.persons.every((person) => Number.isFinite(person.percentOfClass)));
});

test("a filing is attributed to the company it is about, not the company that filed it", () => {
  // Intel's own filing list carries a 79.8% position. That is Intel holding
  // Mobileye — not somebody holding 79.8% of Intel. Both directions arrive in
  // one submissions feed, and only the issuer CIK tells them apart; reading the
  // second as the first would put the ownership chain in a compliance file
  // upside down.
  const outbound = parseSchedule13(filing({
    issuerCik: "0001910139", issuerName: "Mobileye Global Inc.",
    persons: [{ name: "INTEL CORP", percent: "79.8", type: "HC" }]
  }));
  assert.equal(outbound.issuerCik, 1910139, "the leading zeros of a CIK are padding, not digits");
  assert.notEqual(outbound.issuerCik, 50863, "the subject is Mobileye; Intel is the filer");

  const inbound = parseSchedule13(filing({
    issuerCik: "0000050863", issuerName: "INTEL CORP",
    persons: [{ name: "Vanguard Capital Management", percent: "6.52" }]
  }));
  assert.equal(inbound.issuerCik, 50863);
});

test("one class written four ways is one class, so a later amendment supersedes", () => {
  // BlackRock filed the same class as "A" in February and "Class A Stock" in
  // July. Keyed on the raw title those are two classes, and the superseded 8.7%
  // stood beside the current 4.6% as though the holder held both.
  const same = ["A", "Class A Stock", "Class A Common Stock, par value $0.01 per share", "Class A common stock"];
  assert.equal(new Set(same.map(classKey)).size, 1, same.map(classKey).join(" | "));

  assert.notEqual(classKey("Class A Common Stock"), classKey("Class B Common Stock"),
    "two lettered classes have two denominators and must not be merged");
  assert.notEqual(classKey("Class A Common Stock"), classKey("Common Stock"),
    "an unlettered common stock is not evidence that it is the Class A");

  // The filed title survives for display: the key is for matching amendments to
  // what they amend, and a reader still needs to see which class was reported.
  const parsed = parseSchedule13(filing({ securityClass: "Class A Stock", persons: [{ name: "BlackRock, Inc.", percent: "4.6", type: "HC" }] }));
  assert.equal(parsed.persons[0].securityClass, "Class A Stock");
});

// Every case below is a real pair, measured against the Consolidated Screening
// List: 36 shareholder names taken from ten US issuers on one side, known
// designated entities on the other.
test("a shareholder is screened on an agreeing name, not a contained one", () => {
  const hit = (matchBasis, matchScore) => ({ matchBasis, matchScore });

  // Bare containment is the failure this rule exists to stop. VANGUARD is a real
  // Consolidated Screening List entry and Vanguard Capital Management is the
  // shareholder of record of most of the S&P 500; a line that fires on almost
  // every US-listed company teaches the reader to skip it.
  assert.equal(holderMatches(hit("one_normalized_name_contains_the_other", 0.85)), false);
  assert.equal(holderMatches(hit("token_overlap", 0.8)), false);
  assert.equal(holderMatches(hit("every_word_of_the_name_appears", 0.8)), false);

  // A filed legal name that agrees with a listed one is the whole point.
  assert.equal(holderMatches(hit("normalized_name_identical", 1)), true);

  // Spelling variants above the floor, both real: Gasprom Neft reaches Gazprom
  // Neft at 0.69, Rosnjeft reaches Rosneft at 0.71.
  assert.equal(holderMatches(hit("character_similarity", 0.69)), true);
  assert.equal(holderMatches(hit("character_similarity", 0.71)), true);

  // Below the floor, and all three are wrong: NOMURA HOLDINGS to OURA at 0.56,
  // Rostech to PROTEH at 0.59, Aeroflot to Aerofalcon at 0.61. A four-letter
  // list entry scores highly against anything of similar shape, which is
  // arithmetic rather than evidence.
  assert.equal(holderMatches(hit("character_similarity", 0.56)), false, "NOMURA HOLDINGS is not OURA");
  assert.equal(holderMatches(hit("character_similarity", 0.59)), false, "Rostech is not PROTEH");
  assert.equal(holderMatches(hit("character_similarity", 0.61)), false, "Aeroflot is not Aerofalcon");
});

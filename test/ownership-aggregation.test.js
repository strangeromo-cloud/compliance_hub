import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateOwnership, buildOwnershipGraph, parseDeclaredOwnership } from "../src/ownership-graph.js";

// OFAC's own edge shape, which carries a relationship and never a percentage.
const stated = (ownerName, entityName, extra = {}) =>
  ({ ownerName, entityName, percentage: null, ownerDesignated: true, assetDesignated: false, role: "Owned or Controlled By", ...extra });

const graphOf = (parts) => buildOwnershipGraph({ subject: "Acme Trading Co., Ltd.", ...parts });
const aggregate = (parts, options) => aggregateOwnership(graphOf(parts), "Acme Trading Co., Ltd.", options);

const filedBy = (holders) => ({ issuer: { name: "Acme Trading Co., Ltd." }, holders: holders.map(([name, percentOfClass]) => ({ name, percentOfClass, securityClass: "Common Stock", filedAt: "2026-02-17" })) });

test("shares held by different designated parties add up to the threshold", () => {
  // Neither holding reaches 50 and the entity is restricted anyway. This is the
  // aggregation the rule is named for, and no single source could see it: the
  // relationships come from OFAC, the percentages from two separate filings.
  const result = aggregate({
    statedEdges: [stated("Blocked Alpha", "Acme Trading Co., Ltd."), stated("Blocked Beta", "Acme Trading Co., Ltd.")],
    filed: filedBy([["Blocked Alpha", 25], ["Blocked Beta", 25]])
  });

  assert.equal(result.verdict, "blocked");
  assert.equal(result.known, 50);
  assert.equal(result.via.length, 2);
  // Two filings contributed, and affiliated filers report the same shares twice,
  // so the reader has to be told to check they are unrelated before relying on
  // the sum.
  assert.equal(result.doubleCountRisk, true);
});

test("a stake held by nobody designated does not count towards the threshold", () => {
  const result = aggregate({ filed: filedBy([["Vanguard Capital Management", 80]]) });
  assert.equal(result.known, 0, "an ordinary shareholder's 80% is not blocked ownership");
  assert.equal(result.verdict, "not_established");
});

test("the rule re-applies down a chain rather than diluting along it", () => {
  // A blocked person holding 50% of Midco blocks Midco outright. Midco's 50% of
  // the counterparty then blocks the counterparty — at 50, not at 25. Treating
  // this as a product is the single most likely way to get the rule wrong.
  const result = aggregateOwnership(buildOwnershipGraph({
    statedEdges: [stated("Blocked Alpha", "Midco Holdings Ltd")],
    // The declared share belongs to the middle company, so that is the subject
    // the declaration is read against.
    subject: "Midco Holdings Ltd",
    declaredText: "Blocked Alpha 持股 50%",
    filed: { issuer: { name: "Acme Trading Co., Ltd." }, holders: [{ name: "Midco Holdings Ltd", percentOfClass: 50, securityClass: "Common", filedAt: "2026-01-01" }] }
  }), "Acme Trading Co., Ltd.");

  assert.equal(result.verdict, "blocked");
  assert.equal(result.known, 50, "50% of a blocked entity is 50%, not 25%");
});

test("an established relationship with no size to it becomes one answerable question", () => {
  // What the step used to ask for was the whole shareholding structure, which
  // nobody types from memory. What is actually missing is one number, and it can
  // be named.
  const result = aggregate({ chain: { subject: { name: "Acme Trading Co., Ltd." }, directParent: { name: "Blocked Alpha" }, ultimateParent: null }, statedEdges: [stated("Blocked Alpha", "Somewhere Else Ltd")] });

  assert.equal(result.verdict, "undetermined");
  assert.equal(result.known, 0);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].owner, "Blocked Alpha");
  assert.equal(result.missing[0].measure, "accounting_consolidation");
});

test("a percentage from one source answers the question another source left open", () => {
  // GLEIF names the parent and publishes no share; the reviewer supplies it. The
  // relationship must not still be listed as missing a number that has just been
  // given for it.
  const result = aggregate({
    chain: { subject: { name: "Acme Trading Co., Ltd." }, directParent: { name: "Blocked Alpha" }, ultimateParent: null },
    statedEdges: [stated("Blocked Alpha", "Somewhere Else Ltd")],
    declaredText: "Blocked Alpha 持股 62%"
  });

  assert.equal(result.verdict, "blocked");
  assert.equal(result.known, 62);
  assert.deepEqual(result.missing, [], "the parent's share was supplied, so nothing is outstanding for that edge");
});

test("a total below the threshold is never reported as a clearance", () => {
  const result = aggregate({
    statedEdges: [stated("Blocked Alpha", "Acme Trading Co., Ltd.")],
    filed: filedBy([["Blocked Alpha", 10]])
  });
  assert.equal(result.verdict, "not_established");
  assert.match(result.meaning, /未达 50% 不构成排除/);
  assert.equal(result.known, 10);
});

test("a cross-holding does not send the traversal round forever", () => {
  const result = aggregate({
    statedEdges: [stated("Acme Trading Co., Ltd.", "Ring Two Ltd", { ownerDesignated: false }), stated("Ring Two Ltd", "Acme Trading Co., Ltd.", { ownerDesignated: false })]
  });
  assert.ok(result.verdict);
});

test("a shareholding is read from what a person wrote, and only what they wrote", () => {
  const edges = parseDeclaredOwnership("A 集团持股 30%、B 有限公司 持股 25%", "Target Co");
  assert.equal(edges.length, 2);
  assert.deepEqual(edges.map((edge) => edge.percent), [30, 25]);
  assert.equal(edges[0].measure, "declared");
  assert.equal(parseDeclaredOwnership("Blocked Alpha holds 62%", "Target Co")[0].percent, 62);

  // A number this misreads becomes a number in a 50 Percent Rule calculation, so
  // anything that is not plainly a shareholding is left for the reader.
  assert.deepEqual(parseDeclaredOwnership("股权结构不详，待补充", "Target Co"), []);
  assert.deepEqual(parseDeclaredOwnership("增值税率 13%", "Target Co"), []);
  assert.deepEqual(parseDeclaredOwnership("A 持股 250%", "Target Co"), [], "an impossible share is a parse failure, not a holding");
});

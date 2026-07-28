import test from "node:test";
import assert from "node:assert/strict";
import { findNamesMentioned, matchParty, normalizeEntityName } from "../src/entity-matching.js";

const DESIGNATED = {
  sourceId: "china-control-entities",
  recordId: "商务部公告2026年第23号-1",
  entityName: "艾维奥克斯公司",
  entityNameEn: "Aveox, Inc.",
  aliases: ["Aveox, Inc.", "AVEOX"],
  addresses: ["2265A Ward Ave., Simi Valley, CA, USA"],
  countryCode: "US",
  noticeNumber: "商务部公告2026年第23号",
  measureType: "export_control_control_list"
};

test("name normalization strips legal suffixes in both scripts", () => {
  assert.equal(normalizeEntityName("Aveox, Inc."), "aveox");
  assert.equal(normalizeEntityName("AVEOX TECHNOLOGIES CO., LTD."), "aveox technologies");
  assert.equal(normalizeEntityName("北京示例科技有限公司"), "北京示例科技");
});

test("a same-name party in a different country with a conflicting address is reported as a likely false positive", () => {
  const [result] = matchParty(
    { name: "Aveox Technologies (Shenzhen) Co., Ltd.", country: "CN", address: "88 Technology Road, 深圳市" },
    [DESIGNATED],
    { limit: 1 }
  );
  assert.equal(result.matchDisposition, "likely_false_positive_identity_elements_conflict");
  const country = result.identityComparisons.find((item) => item.element === "country");
  assert.equal(country.status, "conflict");
});

test("a party whose identity elements agree is escalated rather than cleared", () => {
  const [result] = matchParty(
    { name: "Aveox, Inc.", country: "US", address: "2265A Ward Ave., Simi Valley, CA, USA" },
    [DESIGNATED],
    { limit: 1 }
  );
  assert.equal(result.matchDisposition, "strong_potential_match_escalate_for_human_confirmation");
});

test("no match is ever returned as confirmed or as a clearance", () => {
  const dispositions = new Set([
    ...matchParty({ name: "Aveox, Inc.", country: "US" }, [DESIGNATED]).map((item) => item.matchDisposition),
    ...matchParty({ name: "Aveox Shenzhen", country: "CN" }, [DESIGNATED]).map((item) => item.matchDisposition)
  ]);
  for (const disposition of dispositions) {
    assert.doesNotMatch(disposition, /confirmed|cleared|approved|no_risk/i, `disposition ${disposition}`);
  }
});

test("designated names are detected inside a free-text question without an alias table", () => {
  const hits = findNamesMentioned("我们打算向 Aveox, Inc. 出售服务器", [DESIGNATED]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].record.recordId, DESIGNATED.recordId);
});

test("an unrelated question produces no name hits", () => {
  assert.equal(findNamesMentioned("请解释中国两用物项许可申请流程", [DESIGNATED]).length, 0);
});

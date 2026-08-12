import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A database of its own, and the reason this is a file rather than another test
// in router.test.js.
//
// HUB_DB_PATH is read when db.js loads, and db.js loads the first time anything
// imports anything that touches storage. Setting the variable inside a test and
// importing with a ?query suffix does not help: the suffix makes a fresh copy of
// the module you name, and that copy still imports "./data-layer/db.js" by its
// plain specifier — the same already-resolved instance, still pointing at the
// development database. The first version of this test passed while quietly
// writing its fixtures into data/runtime/hub.db.
const DIR = mkdtempSync(join(tmpdir(), "hub-gem-skills-"));
process.env.HUB_DB_PATH = join(DIR, "test.db");

const { closeDb } = await import("../src/data-layer/db.js");
const skills = await import("../src/skills.js");
const gems = await import("../src/gems-custom.js");

after(() => { closeDb(); rmSync(DIR, { recursive: true, force: true }); });

test("a gem carries its skills, and the server will not run one it does not", () => {
  // Google's arrangement: the gem is who is answering and stays selected, and
  // the skills hang under it. The sidebar and the / palette both hide the ones
  // the current gem does not carry — but hiding a command in an interface while
  // the server still honours it is a suggestion, not a rule. Anything that can
  // POST a question can type any slash it likes.
  //
  // So the check sits where the command becomes a procedure. This test is the
  // difference between the two: it never touches the interface.
  const mine = skills.createSkill({
    name: "第三方快查", command: "tp-quick", summary: "一段自己的流程",
    procedure: "先核实法律存在，再看付款路径，最后列出还缺的材料。"
  });
  const other = skills.createSkill({
    name: "分类信息收集", command: "cls-facts", summary: "另一段流程",
    procedure: "列出判定 ECCN 需要的技术参数、来源和未决项。"
  });

  const narrow = gems.createCustomGem({
    name: "尽调助手", command: "dd-desk", summary: "只做第三方尽调",
    instruction: "以证据优先的方式审查第三方身份、付款与履约风险。",
    skillIds: [mine.id]
  });
  const open = gems.createCustomGem({
    name: "总控助手", command: "hub-desk", summary: "什么都问",
    instruction: "先识别问题范围，再路由到相关专业域，并说明缺什么。"
  });

  // Under the gem that carries it, the command is consumed and the rest of the
  // line is the question.
  const carried = skills.parseInvocation("/tp-quick 这家供应商要求打到香港关联方账户", narrow.id);
  assert.equal(carried.skill?.id, mine.id);
  assert.equal(carried.question, "这家供应商要求打到香港关联方账户");

  // Under a gem that does not, the same command runs nothing — and the text is
  // left as the reader wrote it rather than silently edited.
  const refused = skills.parseInvocation("/cls-facts 这家供应商要求打到香港关联方账户", narrow.id);
  assert.equal(refused.skill, null, "a skill the selected gem does not carry must not reach the model");
  assert.equal(refused.question, "/cls-facts 这家供应商要求打到香港关联方账户",
    "and the question stays as typed — deleting a line of somebody's question is worse than a stray slash");

  // Naming none means all of them. Every built-in gem is in this state, and so
  // is a custom one whose author ticked nothing: the skills are the reader's
  // own, and a default that hid them would hide their own work from them.
  assert.equal(skills.parseInvocation("/cls-facts 分类问题", open.id).skill?.id, other.id);
  assert.equal(skills.parseInvocation("/cls-facts 分类问题", "screen-party").skill?.id, other.id,
    "a built-in gem names no skills and must therefore carry all of them");
  assert.equal(skills.parseInvocation("/cls-facts 分类问题", null).skill?.id, other.id,
    "and so must no gem at all");

  // A skill deleted after a gem bound it leaves an id pointing at nothing. That
  // is an ordinary state of the world, not a corrupt gem: the binding that
  // remains still holds, and the missing one simply matches nothing.
  skills.deleteSkill(other.id);
  assert.equal(skills.parseInvocation("/tp-quick 还在", narrow.id).skill?.id, mine.id);
  assert.equal(skills.parseInvocation("/cls-facts 没了", open.id).skill, null);
});

test("an id for a skill that does not exist never reaches a gem", () => {
  // Dropped at the door rather than refused, because a skill can be deleted
  // after a gem bound it — a stale id is a normal state, and a gem that refused
  // to save because of one would be unfixable from the form that saves it. What
  // must not happen is a gem storing an id nobody can explain.
  const real = skills.createSkill({
    name: "留下的", command: "kept-one", summary: "还在",
    procedure: "这一段留着，用来确认真实的 id 会被保留下来。"
  });
  const gem = gems.createCustomGem({
    name: "混合助手", command: "mixed-desk", summary: "一真一假",
    instruction: "以证据优先的方式回答，并说明缺什么材料才能定论。",
    skillIds: [real.id, "skill-does-not-exist"]
  });
  assert.deepEqual(gem.skillIds, [real.id]);
});

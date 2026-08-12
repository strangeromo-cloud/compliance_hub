// Gems a reader wrote, in the same shape the built-in eight have.
//
// A skill is a paragraph. A gem is four things, and all four are consumed: kind
// decides whether a review procedure runs at all, instruction opens the question
// sent to the model, boundSources is appended to it as the whitelist to reason
// from, and requiredFacts is what lets the composer say what is missing before
// anything is submitted.
//
// requiredFacts is where a custom gem cannot be the same as a built-in one. The
// eight carry regular expressions, and a regular expression is not a thing to
// ask a compliance reviewer for. Here a fact is a label and a list of words, and
// the matcher is built from the words. That is looser — /[0-9A-Z]{9,20}/ catches
// a registration number nobody spelled out, and a keyword list does not — and
// looser in the safe direction: the coverage hint is a drafting aid that never
// blocks a submission, so a fact it fails to notice costs a prompt, not an
// answer.

import { db } from "./data-layer/db.js";
import { DATA_SOURCE_REGISTRY } from "./data-source-registry.js";
import { commandOwner } from "./command-registry.js";
import { listSkills } from "./skills.js";

const KINDS = new Set(["review", "lookup", "briefing", "memo"]);
const COMMAND = /^[a-z0-9][a-z0-9-]{1,39}$/;
const KNOWN_SOURCES = new Set(DATA_SOURCE_REGISTRY.map((source) => source.sourceId));

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function text(value, field, { min, max }) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < min || trimmed.length > max) fail(`${field}需要 ${min}–${max} 个字符`);
  return trimmed;
}

// Escaped, because these are words somebody typed. A label containing a bracket
// would otherwise be a syntax error at best and a matcher that matches the wrong
// thing at worst.
const escapeForRegex = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function factMatcher(keywords) {
  const words = keywords.map((word) => escapeForRegex(word)).filter(Boolean);
  return words.length ? `(${words.join("|")})` : "";
}

function normalizeFact(input, index) {
  const label = text(input?.label, `第 ${index + 1} 项必填事实的名称`, { min: 1, max: 40 });
  const keywords = [...new Set((Array.isArray(input?.keywords) ? input.keywords : String(input?.keywords || "").split(/[、,，\s]+/))
    .map((word) => String(word).trim()).filter(Boolean))];
  if (!keywords.length) fail(`「${label}」至少需要一个关键词`);
  if (keywords.some((word) => word.length > 40)) fail(`「${label}」的关键词过长`);
  return { key: input?.key || `fact-${index + 1}`, label, keywords, source: "keywords" };
}

export function normalizeCustomGem(input = {}) {
  const command = String(input.command ?? "").trim().replace(/^\/+/, "").toLowerCase();
  if (!COMMAND.test(command)) fail("斜杠命令需为 2–40 个小写字母、数字或连字符，且以字母或数字开头");

  const kind = KINDS.has(input.kind) ? input.kind : "review";

  // Checked against the registry rather than taken on trust. An id that is not a
  // source is a line in the prompt telling the model to rely on something that
  // does not exist, which reads to it as a source it simply cannot see.
  const boundSources = [...new Set((Array.isArray(input.boundSources) ? input.boundSources : []).map(String))];
  const unknown = boundSources.filter((id) => !KNOWN_SOURCES.has(id));
  if (unknown.length) fail(`不认识这些数据源：${unknown.join("、")}`);

  const facts = Array.isArray(input.requiredFacts) ? input.requiredFacts : [];
  if (facts.length > 8) fail("必填事实最多 8 项");

  // Which skills this gem offers. Empty means all of them, and that is the
  // honest default rather than a shortcut: every skill here was written by the
  // reader, so a gem that named none and was read as naming none would hide the
  // reader's own procedures from them.
  //
  // Unknown ids are dropped rather than refused. A skill can be deleted after a
  // gem bound it, so a stale id is an ordinary state of the world, not bad input
  // — and a gem that refused to save because of one would be unfixable from the
  // form that saves it.
  const known = new Set(listSkills().map((skill) => skill.id));
  const skillIds = [...new Set((Array.isArray(input.skillIds) ? input.skillIds : []).map(String))]
    .filter((id) => known.has(id));

  return {
    id: String(input.id || `gem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    custom: true,
    kind,
    command: `/${command}`,
    icon: (input.icon || command.slice(0, 2)).toUpperCase().slice(0, 2),
    group: "custom",
    name: text(input.name, "名称", { min: 2, max: 80 }),
    summary: text(input.summary, "说明", { min: 2, max: 240 }),
    instruction: text(input.instruction, "指令", { min: 10, max: 6000 }),
    boundSources,
    skillIds,
    requiredFacts: facts.map(normalizeFact),
    outputTemplate: String(input.outputTemplate || "").trim().slice(0, 240),
    placeholder: String(input.placeholder || "").trim().slice(0, 240),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function listCustomGems() {
  return db().prepare("SELECT payload FROM custom_gems ORDER BY created_at DESC").all()
    .map((row) => { try { return JSON.parse(row.payload); } catch { return null; } })
    .filter(Boolean);
}

export function createCustomGem(input) {
  const gem = normalizeCustomGem(input);
  // The whole namespace, skills included: the palette lists both under / and the
  // composer parses one token without knowing which kind it belongs to.
  const owner = commandOwner(gem.command);
  if (owner) fail(owner.kind === "builtin-gem"
    ? `${gem.command} 是内置 Gem 的命令，换一个`
    : `${gem.command} 已被一个自建 ${owner.kind === "gem" ? "Gem" : "Skill"} 占用`, 409);
  db().prepare("INSERT INTO custom_gems (gem_id, command, created_at, payload) VALUES (?, ?, ?, ?)")
    .run(gem.id, gem.command, gem.createdAt, JSON.stringify(gem));
  return gem;
}

export function deleteCustomGem(id) {
  return db().prepare("DELETE FROM custom_gems WHERE gem_id = ?").run(String(id || "")).changes > 0;
}

// The kind of any gem, built-in or not. The orchestrator asks this to decide
// whether a review procedure runs, and a custom gem that answered nothing here
// would silently fall back to the full procedure whatever it was created as.
export function customGemKind(gemId) {
  return listCustomGems().find((gem) => gem.id === gemId)?.kind || null;
}

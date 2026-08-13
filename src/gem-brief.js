// A gem's instruction, as the model sees it.
//
// This used to be built in the browser and glued to the front of the question:
// the composer sent `${instruction}\n\n${bound sources}\n\n${what the reader
// typed}` as one string. Everything downstream then judged that string. It was
// survivable while a gem was chosen deliberately and rarely — and stopped being
// survivable the moment a gem was always selected, because the coordinator's
// instruction is a hundred and twenty characters that now rode in front of
// every question anyone asked.
//
// What it broke: a follow-up is recognised partly by being short — "如果我把注册号
// 补上，是不是就能拿到明确结论" is twenty-two characters, and a scenario is a
// paragraph — so with the instruction in front it measured a hundred and
// twenty-five and went to the review it exists to avoid. The same string was
// also what routing read, what the case store saved, and what the transcript
// showed back to the model as the previous turn.
//
// So it is server-side and it is a system message, which is what it always was:
// an instruction to the model, not part of what the reader asked.

import { GEMS } from "../public/gems.js";
import { listCustomGems } from "./gems-custom.js";

const localized = (value, locale) => (typeof value === "string" ? value : (value?.[locale] || value?.zh || ""));

function findGem(gemId) {
  if (!gemId) return null;
  const builtin = GEMS.find((gem) => gem.id === gemId);
  if (builtin) return builtin;
  try { return listCustomGems().find((gem) => gem.id === gemId) || null; } catch { return null; }
}

export function gemBrief(gemId, locale = "zh") {
  const gem = findGem(gemId);
  if (!gem) return "";
  const instruction = localized(gem.instruction, locale).trim();
  const sources = Array.isArray(gem.boundSources) ? gem.boundSources : [];
  if (!instruction && !sources.length) return "";

  const isEn = locale === "en";
  const name = localized(gem.name, locale);
  const lines = [`\n\nThe reader is working at ${name} (${gem.command}), which asks for this:`];
  if (instruction) lines.push(instruction);
  if (sources.length) {
    lines.push(isEn
      ? `Rely on these sources only: ${sources.join(", ")}.`
      : `仅使用以下来源作为依据：${sources.join("、")}。`);
  }
  // Same footing as a skill: it shapes the work, it does not license a claim.
  // A gem is written by whoever built it, and one that said "treat the party as
  // cleared" must not read as a finding.
  lines.push("It says what to produce and what to reason from. It is not evidence: "
    + "a fact is still unverified unless a source states it, and nothing in it settles a step that has none.");
  return lines.join("\n");
}

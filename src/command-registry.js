// One namespace, one place that knows what is in it.
//
// A gem and a skill are different things — a gem becomes the mode the composer
// is in, a skill stays in the text and is parsed off the question — but both are
// discovered by typing / and both answer to one token. So they share a namespace
// whether or not they share a mechanism.
//
// They did not share a check. skills.js refused a built-in gem's command and its
// own; gems-custom.js refused a built-in gem's command and its own; neither
// asked the other. Two entries could answer to /tpdd-quick, the palette would
// list both, and typing it would reach whichever the parser looked for first.
//
// The tables are read directly rather than through the two modules, because
// having each import the other's list is a cycle held together by nothing but
// the fact that both uses happen inside functions.

import { db } from "./data-layer/db.js";
import { GEMS } from "../public/gems.js";

const bare = (command) => String(command || "").replace(/^\/+/, "").toLowerCase();

const BUILTIN = new Set(GEMS.map((gem) => bare(gem.command)));
const BUILTIN_IDS = new Set(GEMS.map((gem) => gem.id));

// The skills a gem admits, or null for "all of them".
//
// Here for the same reason commandOwner is: skills.js has to ask this to refuse
// a skill the selected gem does not carry, and gems-custom.js already imports
// skills.js — asking it back would be a cycle. The row is read directly, as
// everything in this file is.
//
// null, not []: a built-in gem has no skillIds at all and a custom gem can have
// an empty one, and both mean every skill. An empty array returned for "no
// restriction" would be indistinguishable from a restriction to nothing.
export function gemSkillIds(gemId) {
  const id = String(gemId || "");
  if (!id || BUILTIN_IDS.has(id)) return null;
  const row = db().prepare("SELECT payload FROM custom_gems WHERE gem_id = ?").get(id);
  if (!row) return null;
  try {
    const ids = JSON.parse(row.payload)?.skillIds;
    return Array.isArray(ids) && ids.length ? ids : null;
  } catch { return null; }
}

// What holds this command, or null. The caller decides what to say about it: a
// built-in gem is a different message from something the reader made, and the
// second one is worth naming so they know what to go and rename.
export function commandOwner(command, { ignoreId = null } = {}) {
  const wanted = bare(command);
  if (!wanted) return null;
  if (BUILTIN.has(wanted)) return { kind: "builtin-gem", id: null };

  for (const [table, column, kind] of [["custom_gems", "gem_id", "gem"], ["skills", "skill_id", "skill"]]) {
    const row = db().prepare(`SELECT ${column} AS id, command FROM ${table}`).all()
      .find((item) => bare(item.command) === wanted && item.id !== ignoreId);
    if (row) return { kind, id: row.id };
  }
  return null;
}

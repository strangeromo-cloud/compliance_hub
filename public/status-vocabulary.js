// One vocabulary for every status the product shows.
//
// The workbench and the coverage page previously each carried their own labels,
// which drifted: "archived copy" in the evidence panel and "fallback snapshot"
// on the coverage page were describing overlapping things under different names.
// A compliance tool cannot afford a reader to wonder whether two words mean the
// same state, so the labels live here and both pages read from them.

// How a source's stored data was obtained.
export const SYNC_STATUS = {
  success:                { zh: "已同步",     en: "Synced",           tone: "ok" },
  fallback_snapshot:      { zh: "兜底快照",   en: "Bundled copy",     tone: "warn" },
  syncing:                { zh: "同步中",     en: "Syncing",          tone: "warn" },
  failed:                 { zh: "同步失败",   en: "Sync failed",      tone: "crit" },
  // The snapshot is real and dated; only the attempt to refresh it failed. Told
  // apart from "failed" because the two call for different actions.
  refresh_failed:         { zh: "刷新失败",   en: "Refresh failed",   tone: "warn" },
  configuration_required: { zh: "待配置",     en: "Needs config",     tone: "muted" },
  not_synced:             { zh: "未同步",     en: "Not synced",       tone: "muted" }
};

// How the text behind a citation was obtained for this particular answer.
export const EVIDENCE_STATUS = {
  live:          { zh: "实时获取",   en: "Live",          tone: "ok" },
  cached:        { zh: "缓存",       en: "Cached",        tone: "ok" },
  cached_stale:  { zh: "缓存已过期", en: "Cached, stale", tone: "warn" },
  // Distinct from a source-level bundled copy: the live page failed and the
  // text came from the ingested corpus instead.
  archived:      { zh: "已采集副本", en: "Archived copy", tone: "warn" },
  citation_only: { zh: "仅引用",     en: "Cited only",    tone: "muted" },
  metadata_only: { zh: "元数据",     en: "Metadata",      tone: "muted" },
  not_fetched:   { zh: "未获取",     en: "Not fetched",   tone: "muted" },
  unavailable:   { zh: "获取失败",   en: "Unavailable",   tone: "crit" }
};

// Where an analysis step stands.
export const STEP_STATUS_VOCAB = {
  pending:         { zh: "待执行",       en: "Planned",              tone: "pending", mark: "○" },
  confirmed:       { zh: "已确认",       en: "Settled",              tone: "ok",      mark: "✓" },
  declared:        { zh: "已声明，待核验", en: "Declared, unverified", tone: "declared", mark: "◐" },
  evidence_needed: { zh: "需更多证据",   en: "Evidence needed",      tone: "warn",    mark: "!" },
  // A step with no work in it. Distinct from not_reached, which is work that is
  // still waiting: one is finished business, the other is outstanding.
  not_applicable:  { zh: "不适用",       en: "Not applicable",   tone: "muted", mark: "–" },
  not_reached:     { zh: "待前序步骤",   en: "Awaiting earlier step", tone: "muted",  mark: "·" },
  review_required: { zh: "需人工复核",   en: "Human review",         tone: "crit",    mark: "▲" }
};

export function label(vocabulary, key, locale = "zh") {
  const entry = vocabulary[key];
  return entry ? entry[locale] || entry.zh : key;
}

export function tone(vocabulary, key) {
  return vocabulary[key]?.tone || "muted";
}


export const SETTLED_STATUS = new Set(["confirmed", "declared", "review_required", "not_applicable"]);

// What a step is, right now, in one place.
//
// The rail and the body each worked this out for themselves, and each got it
// wrong in a different way: the rail did not know a step had been declined, it
// counted an inapplicable step as the one being worked on, and it drew declined
// steps the body had hidden entirely. Three symptoms, one cause — "which step is
// current" meant three things and was coordinated by hand.
//
//   done      settled, nothing outstanding
//   declared  answered by the reader, unverified
//   asking    the step the reader is being asked to answer now
//   skipped   the reader declined it; outstanding, but not a question any more
//   na        the procedure does not reach for it
//   review    only a person can close it
//   pending   not reached yet

// One definition of "this step is still asking the reader something", used by the
// body and by the rail.
//
// They had a copy each, and the rail's did not know about declined fields. So
// after a reader clicked 暂无 on identity resolution, the body moved on to the
// ownership step while the rail went on pointing at the one just passed over —
// two different answers to the same question, three feet apart on screen.
//
// The declined fields are passed in rather than read from page state: this
// module is shared with the coverage page and imported by tests, and a function
// that reaches for a global is neither.
export function isAskable(item, declined = []) {
  if (item?.status !== "evidence_needed" || !item.inputs?.length) return false;
  const passed = new Set(declined);
  return !item.inputs.every((input) => passed.has(input.field));
}

export function stepState(item, declined = []) {
  if (!item) return "pending";
  if (item.status === "evidence_needed" && item.inputs?.length) {
    return isAskable(item, declined) ? "asking" : "skipped";
  }
  return {
    confirmed: "done", declared: "declared", not_applicable: "na",
    review_required: "review", evidence_needed: "asking",
    not_reached: "pending", pending: "pending"
  }[item.status] || "pending";
}

export const FOLDED = new Set(["na", "skipped"]);

// Which step the rail should mark. One definition, because there are three
// meanings of "current" here and picking the wrong one is how the two panels
// ended up disagreeing with each other.
export function currentStepId(path, options = {}) {
  if (options.currentStep) return options.currentStep;
  const runningLane = options.activeLane
    ? path.lanes.find((lane) => lane.lane === options.activeLane)
    // Before the first specialist starts, the work is retrieval and screening —
    // which belongs to the first lane. Falling through to "the first blocked
    // step" pointed the rail at a question waiting on the reader while the run
    // was busy elsewhere.
    : (options.stage ? path.lanes[0] : null);
  if (!runningLane) return options.firstBlocked ?? null;

  // Settled means settled, and a step the procedure does not reach for is
  // settled — the body folds it into "N not applicable". Hand-rolling the test
  // as "not confirmed and not declared" let the rail pick an inapplicable step
  // and mark it as running while the body had folded it out of sight.
  const open = runningLane.steps.find((item) => !SETTLED_STATUS.has(item.status));
  if (open) return open.id;

  // A lane can be running with every one of its steps already settled: grounding
  // closes the screening steps before the specialist writes a word about them.
  // Returning null then left the rail marking nothing at all while the body
  // showed that lane working — two panels three feet apart disagreeing about
  // whether anything was happening. The rail points at the last step it actually
  // draws for that lane instead.
  return runningLane.steps.filter((item) => !FOLDED.has(stepState(item, options.declined))).at(-1)?.id || null;
}


// Which of a lane's steps each panel draws, and which it folds away.
//
// The body and the rail had a rule each. The body revealed forward — what is
// settled, what is being asked, what was passed over — and the rail drew the
// whole plan, so the rail listed steps the body had not reached and a reader
// comparing them found two different lists for one run. They agreed on the
// folded count and disagreed on everything above it.
//
// One rule now, and it is the body's: a panel shows what has happened, because
// a step nobody has reached yet has nothing to say about this question. What is
// still ahead is carried by the counts, which is where a number belongs.
export function laneView(lane, { question = null, declined = [] } = {}) {
  const steps = lane?.steps || [];
  const reached = steps.filter((item) =>
    SETTLED_STATUS.has(item.status) || item.id === question || stepState(item, declined) === "skipped");
  return {
    shown: reached.filter((item) => !FOLDED.has(stepState(item, declined))),
    folded: reached.filter((item) => FOLDED.has(stepState(item, declined))),
    settled: steps.filter((item) => SETTLED_STATUS.has(item.status)).length,
    total: steps.length
  };
}

// The first step still waiting on the reader, which is where a run has stopped.
// The run's own answer wins where it has one: the two were computed
// independently and drifted the moment a reader declined a question — the run
// moved on and the page recomputed the same step and asked again.
export function firstBlockedStep(path, declined = []) {
  if (path?.awaitingInput?.step) return path.awaitingInput.step;
  if (path?.awaitingInput === null && path?.final) return null;
  for (const lane of path?.lanes || []) {
    for (const item of lane.steps) if (isAskable(item, declined)) return item.id;
  }
  return null;
}

// Which lanes each panel draws.
//
// Sharing the step rule was not enough: the body also revealed lane by lane —
// closing is not drawn while a question is outstanding, and nothing past the
// lane holding that question is drawn at all — while the rail drew every lane
// always. So the two lists still differed by whole sections, which is what a
// reader sees when they say the panels do not match.
//
// One rule, the body's. What is still ahead is carried by the counts.
export function visibleLanes(path, { activeLane = null, declined = [], allowInput = true, analysed = [] } = {}) {
  const blocked = firstBlockedStep(path, declined);
  const seen = new Set(analysed);
  const out = [];
  for (const lane of path?.lanes || []) {
    if (lane.lane === "review") {
      // The closing step is only drawn once there is something to close.
      if (!blocked && allowInput) out.push(lane);
      continue;
    }
    // The lane holding the question must be drawn even if nothing in it has run
    // yet — questions are asked before their lane is analysed.
    if (seen.has(lane.lane) || lane.lane === activeLane
      || lane.steps.some((item) => SETTLED_STATUS.has(item.status))
      || lane.steps.some((item) => item.id === blocked)) out.push(lane);
    if (lane.steps.some((item) => isAskable(item, declined))) break;
  }
  return out;
}

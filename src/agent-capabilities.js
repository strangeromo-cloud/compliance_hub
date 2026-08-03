// What one agent can ask another for.
//
// The three specialists ran side by side and never spoke. Where a question
// genuinely crossed between them — is this party listed, is this item subject to
// the EAR — the fact travelled through the shared grounding block and each agent
// read it independently, which works but says nothing about who is answerable
// for the answer. A capability is that missing thing: a named question one lane
// asks another, with the provision that makes the answer binding.
//
// Deterministic first, and this is the whole design constraint. Whether a Part
// 740 exception survives a § 744 designation is a rule, not a judgement, so it
// is computed in code and cites the rule. A capability may fall back to the
// provider's model only where the question really does need judgement, and when
// it does the answer has to be labelled as that agent's opinion rather than a
// fact. The reason is this system's one load-bearing property: every conclusion
// traces to a provision and a dataset. If "trade asks product" became "trade's
// model call contains product's model output", provenance would degrade from a
// chain into a conversation — which is what the dependency graph, the triage
// gates and the clearance conditions were all written to avoid.
//
// run() is pure over its declared inputs rather than reaching into a run's
// context, and the inputs are declared rather than implied. That is what lets
// the same capability be served outside this process later — as an MCP tool or a
// skill — without being rewritten: the adapter that fills the inputs from a
// live run is separate, and describeCapabilities() already emits the catalogue
// such a server would publish.

import { bi } from "./path-i18n.js";

const LANE_ZH = { trade: "贸易合规 Agent", product: "产品出口管制 Agent", tpdd: "第三方尽调 Agent" };
const LANE_EN = { trade: "trade compliance", product: "product export control", tpdd: "third-party diligence" };

// A capability answers for a lane, so the lane is part of the identifier: a
// reader tracing a conclusion can see which specialist was answerable without
// looking anything up, and a published tool name carries the same information.
export const CAPABILITIES = {
  "trade.party_status": {
    provider: "trade",
    title: { zh: "交易方名单状态", en: "Counterparty list status" },
    summary: {
      zh: "判断本次交易中是否有主体被列名，或经股权合计持有而被视为受限。",
      en: "Whether any party to the transaction is designated, by name or through aggregate ownership."
    },
    cite: "§ 732.3(g) · OFAC 50 Percent Rule FAQ 401",
    input: [
      { name: "matches", type: "array", required: true, zh: "本次名单检索的命中记录", en: "Matches from this screening run" },
      { name: "parentHits", type: "array", required: false, zh: "母公司筛查的命中记录", en: "Matches from screening the parent" },
      { name: "sourcesSearched", type: "number", required: true, zh: "已检索的名单来源数", en: "How many list sources were searched" }
    ],
    run({ matches = [], parentHits = [], sourcesSearched = 0 }) {
      // A screening that could not run is not a screening that found nothing,
      // and the caller has to be able to tell the difference before relying on
      // "no match" for anything.
      if (!sourcesSearched) {
        return {
          answer: "not_searched",
          zh: "没有已同步的名单来源，本次未做筛查",
          en: "No list source is synced, so no screening was performed"
        };
      }
      const listed = matches.length > 0;
      const parentListed = parentHits.length > 0;
      const subject = matches[0]?.entityName || matches[0]?.matchedName || parentHits[0]?.entityName || null;
      return {
        answer: listed || parentListed ? "potential_match" : "no_match",
        subject,
        viaParent: !listed && parentListed,
        zh: listed ? `交易方在已筛查名单中存在 ${matches.length} 条潜在命中`
          : parentListed ? "交易方本身未命中，但其母公司在已筛查名单中存在潜在命中"
            : `在 ${sourcesSearched} 个已同步名单来源中未发现命中`,
        en: listed ? `${matches.length} potential match${matches.length === 1 ? "" : "es"} for the counterparty in the lists searched`
          : parentListed ? "The counterparty itself did not match, but its parent has a potential match in the lists searched"
            : `Nothing matched across the ${sourcesSearched} synced list sources`
      };
    }
  },

  "product.item_jurisdiction": {
    provider: "product",
    title: { zh: "物项是否受 EAR 管辖", en: "Whether the item is subject to the EAR" },
    summary: {
      zh: "按已声明的分类或受控美国原产内容占比，判断物项是否受 EAR 管辖。",
      en: "Whether the item is subject to the EAR, from the declared classification or controlled US-content share."
    },
    cite: "§ 734.3 · § 734.4 de minimis",
    input: [
      { name: "eccn", type: "string", required: false, zh: "已声明的 ECCN", en: "Declared ECCN" },
      { name: "usContent", type: "string", required: false, zh: "受控美国原产内容占比", en: "Controlled US-origin content share" }
    ],
    run({ eccn = "", usContent = "" }) {
      const content = String(usContent).trim();
      const code = String(eccn).trim();
      if (/^<\s*10%$/.test(content)) {
        return {
          answer: "not_subject",
          zh: "受控美国原产内容低于 de minimis 门槛，物项不因此受 EAR 管辖",
          en: "Controlled US-origin content is below the de minimis threshold, so the item is not subject to the EAR on that basis"
        };
      }
      if (code) {
        return {
          answer: "subject",
          zh: `已声明分类为 ${code}，物项受 EAR 管辖`,
          en: `Declared as ${code}, so the item is subject to the EAR`
        };
      }
      // Silence is not an answer here either. An unstated jurisdiction leaves
      // the question open rather than resolving it in either direction.
      return {
        answer: "unknown",
        zh: "尚未确定管辖：既未声明分类，也未给出受控美国原产内容占比",
        en: "Jurisdiction is unsettled: neither a classification nor a controlled US-content share has been stated"
      };
    }
  }
};

// A capability that cannot say which provision makes its answer binding is this
// system's opinion wearing an agent's name, so the registry is checked at load
// rather than trusted.
for (const [id, capability] of Object.entries(CAPABILITIES)) {
  if (!capability.cite || !capability.title?.zh || !capability.title?.en || typeof capability.run !== "function") {
    throw new Error(`Capability ${id} is missing a provision, a title or an implementation`);
  }
  if (!id.startsWith(`${capability.provider}.`)) {
    throw new Error(`Capability ${id} must be namespaced under its provider lane`);
  }
  if (!Array.isArray(capability.input)) throw new Error(`Capability ${id} must declare its inputs`);
}

// The catalogue, as a published tool list would state it. Kept here rather than
// in whatever serves it, so a capability cannot be exposed without the provision
// that makes its answer binding travelling with it.
export function describeCapabilities(locale = "zh") {
  const side = (pair) => (locale === "en" ? pair.en : pair.zh);
  return Object.entries(CAPABILITIES).map(([id, capability]) => ({
    id,
    provider: capability.provider,
    providerName: locale === "en" ? LANE_EN[capability.provider] : LANE_ZH[capability.provider],
    title: side(capability.title),
    summary: side(capability.summary),
    cite: capability.cite,
    input: capability.input.map((field) => ({
      name: field.name, type: field.type, required: Boolean(field.required), description: side(field)
    }))
  }));
}

// How a live run fills a capability's declared inputs. Separate from run() on
// purpose: the capability is pure over named arguments, and this is the only
// piece that knows what a run's context looks like — so publishing the same
// capability elsewhere replaces this adapter and nothing else.
export function argsFromRun(id, { grounding = {}, facts = {} } = {}) {
  if (id === "trade.party_status") {
    return {
      matches: grounding.listMatches || [],
      parentHits: (grounding.parentScreening || []).flatMap((entry) => entry.hits || []),
      sourcesSearched: (grounding.screening?.screenedSources || []).length
    };
  }
  if (id === "product.item_jurisdiction") {
    return { eccn: facts.eccn || "", usContent: facts.usContent || "" };
  }
  throw new Error(`No run adapter for capability: ${id}`);
}

const MAX_DEPTH = 4;

// One call, recorded. The record is the point: a step that reached its
// conclusion by asking another lane says so, names the lane, and carries the
// provision — the same standard the path holds every other line to.
export function invokeCapability(id, { caller = null, args = null, context = null, stack = [] } = {}) {
  const capability = CAPABILITIES[id];
  if (!capability) throw new Error(`No such capability: ${id}`);
  // A lane asking itself, or a cycle through a third, would produce an answer
  // that depends on the answer — so it is refused rather than unwound.
  if (stack.includes(id)) throw new Error(`Capability cycle: ${[...stack, id].join(" -> ")}`);
  if (stack.length >= MAX_DEPTH) throw new Error(`Capability chain too deep: ${[...stack, id].join(" -> ")}`);

  const resolved = args || argsFromRun(id, context || {});
  for (const field of capability.input) {
    if (field.required && resolved[field.name] === undefined) {
      throw new Error(`Capability ${id} requires input "${field.name}"`);
    }
  }

  const result = capability.run(resolved);
  return {
    id,
    caller,
    provider: capability.provider,
    cite: capability.cite,
    title: bi(capability.title.zh, capability.title.en),
    ...result,
    // What the caller shows: who was asked, what they said, under which rule.
    line: bi(
      `调用 ${LANE_ZH[capability.provider]} 的能力「${capability.title.zh}」：${result.zh}（${capability.cite}）`,
      `Asked the ${LANE_EN[capability.provider]} agent for ${lowerFirst(capability.title.en)}: ${result.en} (${capability.cite})`
    )
  };
}

const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1);

// Whether Part 740 exceptions survive what trade found. This is the rule the
// dependency graph could only state and nothing enforced: the licence-exception
// step went on saying "awaiting an earlier step" while a designated party sat in
// the same answer. It is a rule rather than a judgement, so it is computed here,
// through the capability the product lane would ask for, and cites the provision
// that decides it.
export function licenceExceptionOutcome(context, caller = "licence_exception") {
  const party = invokeCapability("trade.party_status", { caller, context });
  if (party.answer === "potential_match") {
    return {
      status: "evidence_needed",
      party,
      basis: [party.line],
      needs: [bi(
        "Part 740 的许可例外对 § 744 项下被列名主体普遍不适用；先完成身份消歧，再判断是否仍有可用例外（§ 744.11 · § 740.2(a)）",
        "The Part 740 exceptions are generally unavailable to parties designated under Part 744. Resolve identity first, then assess whether any exception remains available (§ 744.11 · § 740.2(a))"
      )]
    };
  }
  return { status: null, party, basis: [party.line], needs: [] };
}

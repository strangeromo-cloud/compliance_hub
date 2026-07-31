// What one step's finding obliges another step to check.
//
// The three lanes ran side by side and never spoke. That is wrong about the
// subject: in export control the consequential facts are precisely the ones that
// cross from one lane to another. Ownership resolution finds a parent company —
// and nothing screened that parent. A designated party appears — and the licence
// exception step carried on as though the exceptions were still open.
//
// The dependencies are data, not prose in a prompt. That makes them three
// things a prompt is not: deterministic, testable, and explainable — a step that
// exists because of an earlier finding can say which finding put it there,
// instead of appearing for reasons the reader has to take on trust.
//
// Each edge states the provision that makes the check obligatory. A trigger with
// no rule behind it is this system's opinion about what is prudent, which is not
// what a path is for.

export const LANE_DEPENDENCIES = [
  {
    id: "parent_screening",
    // Ownership gives a name; a name has to be screened like any other.
    from: { lane: "trade", step: "ownership", finding: "parent_chain" },
    to: { lane: "trade", step: "parent_screening" },
    relationship: "requires_verification",
    cite: "OFAC 50 Percent Rule FAQ 401 · § 732.3(g)",
    zh: "所有权穿透查到母公司后，母公司本身必须再做名单筛查——被列名主体合计持股 50% 以上的公司同样受限，而这一步只有在知道母公司是谁之后才可能做。",
    en: "Once ownership resolves a parent, the parent has to be screened in its own right: a company owned 50% or more in aggregate by designated parties is restricted too, and that check is only possible once the parent is known."
  },
  {
    id: "listed_party_blocks_exceptions",
    from: { lane: "trade", step: "name_match", finding: "list_hit" },
    to: { lane: "product", step: "licence_exception" },
    relationship: "constrains",
    cite: "§ 744.11 · § 740.2(a)",
    zh: "交易方命中受限方名单时，大多数许可例外不再可用——Part 740 的例外对 Part 744 项下被列名主体普遍不适用。许可例外一步不能脱离筛查结果单独判断。",
    en: "Where a party matches a restricted list, most licence exceptions cease to be available: the Part 740 exceptions are generally unavailable to parties designated under Part 744. The licence-exception step cannot be assessed in isolation from the screening result."
  }
];

// The edges that fire, given what the analysis has actually found. Kept separate
// from applying them so the reasons can be shown next to the steps they created.
export function triggeredDependencies(grounding) {
  const fired = [];
  const chain = grounding?.ownership;
  if (chain?.subject && (chain.directParent || chain.ultimateParent)) {
    fired.push({
      ...LANE_DEPENDENCIES.find((edge) => edge.id === "parent_screening"),
      because: chain.ultimateParent?.name || chain.directParent?.name
    });
  }
  if ((grounding?.listMatches || []).length) {
    fired.push({
      ...LANE_DEPENDENCIES.find((edge) => edge.id === "listed_party_blocks_exceptions"),
      because: grounding.listMatches[0].entityName || grounding.listMatches[0].matchedName
    });
  }
  return fired;
}

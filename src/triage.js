// Triage: deciding how much of the procedure this question actually needs.
//
// The published procedures are long — EAR Part 732 alone numbers its steps 1
// through 29 — and running every step on every question is not how a review is
// done. A reviewer answers a few branching questions first and most transactions
// end there: the item is not controlled, the party is not listed, there is no
// intermediary. The full tree is what a trigger opens.
//
// Two rules govern everything here, because shortening a compliance review is
// exactly where a tool can do harm:
//
//   1. A step is only dropped on a stated fact and a stated provision. "Probably
//      fine" is not a gate. Every gate below names what closed it and under which
//      rule, and that text is shown to the user, not just logged.
//
//   2. A gate closes a step only when the procedure itself makes it moot — the
//      Country Chart applies to items with an ECCN, so it does not arise for
//      EAR99; third-party diligence is about third parties, so it does not arise
//      when there are none. None of these are judgements about risk being low.
//
// Anything a gate does not close stays in the path. Uncertainty never shortens
// it: an unanswered or ambiguous fact leaves every downstream step standing.

const NO_THIRD_PARTY = /(?:直销|直接(?:销售|供货|出口|发运)|无(?:中间商|代理|经销商|第三方)|没有(?:中间商|代理|经销商|第三方)|end.customer directly|direct sale|no (?:agent|intermediary|distributor|third.party))/i;
const THIRD_PARTY = /代理商|代理|经销商|分销商|中间商|中介|顾问|咨询公司|第三方|agent|intermediar|distributor|reseller|consultant|broker|freight.forwarder|货代/i;

// A declared classification of EAR99 means the item is subject to the EAR but on
// no Commerce Control List entry.
const EAR99 = /^\s*ear\s*-?\s*99\s*$/i;

// De minimis: foreign-made items with controlled US content at or below the
// threshold are not subject to the EAR on that basis (§ 734.4). The form offers
// this as a band, so only the unambiguous band closes the gate.
const BELOW_DE_MINIMIS = /^<\s*10%$/;

export const GATES = [
  {
    id: "no_third_party",
    // Whole lane, not a step: DOJ's third-party factors are about managing third
    // parties. With none in the transaction there is nothing for them to govern.
    dropsLane: "tpdd",
    cite: "DOJ ECCP — Third-Party Management",
    decide({ question }) {
      if (NO_THIRD_PARTY.test(question)) return { closed: true, because: "问题描述为直接交易，未涉及代理、经销或中间方" };
      if (THIRD_PARTY.test(question)) return { closed: false };
      // Silence is not an answer. A transaction that says nothing about how it is
      // routed may well have an intermediary nobody mentioned.
      return { closed: false };
    }
  },
  {
    id: "not_subject_to_ear",
    dropsSteps: ["classify", "destination_chart", "licence_exception", "prohibitions"],
    cite: "§ 734.4 de minimis · § 732.2 Steps 1–6",
    decide({ facts }) {
      if (BELOW_DE_MINIMIS.test(String(facts.usContent || "").trim())) {
        return { closed: true, because: "受控美国原产内容低于 de minimis 门槛，物项不因此受 EAR 管辖" };
      }
      return { closed: false };
    }
  },
  {
    id: "ear99",
    // An EAR99 item has no ECCN, so there is no Country Chart cell to read and no
    // ECCN-based licence exception to consider. The general prohibitions still
    // apply — end-user, end-use and embargo do not depend on classification — so
    // that step is deliberately not dropped here.
    dropsSteps: ["destination_chart", "licence_exception"],
    cite: "§ 738.3 Country Chart 适用于列名 ECCN · Part 740",
    decide({ facts }) {
      if (EAR99.test(String(facts.eccn || ""))) {
        return { closed: true, because: "分类为 EAR99，不在管制清单上，无 Country Chart 单元可查、无基于 ECCN 的许可例外" };
      }
      return { closed: false };
    }
  }
];

// What the gates close, given what is known. Returns the lanes to leave out of
// the plan and the steps to mark as not arising, each with the fact and the
// provision behind it — a shortened path has to be able to explain itself.
export function triage({ question = "", facts = {} } = {}) {
  const droppedLanes = [];
  const droppedSteps = new Map();
  const applied = [];

  for (const gate of GATES) {
    const verdict = gate.decide({ question, facts });
    if (!verdict.closed) continue;
    applied.push({ id: gate.id, because: verdict.because, cite: gate.cite, dropsLane: gate.dropsLane || null, dropsSteps: gate.dropsSteps || [] });
    if (gate.dropsLane) droppedLanes.push(gate.dropsLane);
    for (const stepId of gate.dropsSteps || []) {
      if (!droppedSteps.has(stepId)) droppedSteps.set(stepId, { because: verdict.because, cite: gate.cite, gate: gate.id });
    }
  }

  return { droppedLanes, droppedSteps, applied };
}

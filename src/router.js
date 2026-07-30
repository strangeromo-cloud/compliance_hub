const RULES = {
  trade: [
    /华为|huawei|entity list|restricted part|sanction|制裁|限制名单|交易对方|交易方|party.screening|screening|sdn|ofac|denied|ownership|所有权|最终用户|end.user|最终用途|end.use|名单命中|list match|false positive/i
  ],
  product: [
    /h100|h200|gpu|cpu|chip|芯片|eccn|app|tpp|product|产品|export|出口|reexport|转运|transit|墨西哥|mexico|加拿大|canada|dual.use|两用物项|encryption|加密|服务器|server|高性能计算|计算卡|显卡/i
  ],
  tpdd: [
    /tpdd|third.party|due diligence|shell compan|空壳|第三方|中间商|顾问|经销商|distributor|consultant|commission|佣金|ubo|beneficial owner|实际控制|pep|离岸|offshore|付款|货代|freight.forwarder|成功费|success fee|共享办公|shared.office|政府招标|government tender|尽职调查|尽调|咨询公司|代理商|分销商|中介|支付|回佣/i
  ]
};

// "无中间商" mentions an intermediary in order to deny it. Matching the noun and
// ignoring the negation routed a direct sale into third-party diligence — and then
// triage, reading the same sentence correctly, removed the only lane it had been
// routed to and left nothing to analyse.
// The negation covers a run of them, not just the next word: "不涉及第三方顾问"
// denies both nouns, and stopping at the first left the second to match.
const PARTY_NOUN = "中间商|中介|代理商|代理|经销商|分销商|第三方|顾问|咨询公司|货代";
const NEGATED = new RegExp(`(?:无|没有|不涉及|未涉及|不通过|非)\\s*(?:(?:${PARTY_NOUN})\\s*[、和与或]?\\s*){1,4}`, "g");

function readable(question) {
  return String(question).replace(NEGATED, " ");
}

export function routeQuestion(question, fallback = true) {
  const text = readable(question);
  const matches = Object.entries(RULES)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([agent]) => agent);

  return matches.length ? matches : fallback ? ["trade", "product", "tpdd"] : [];
}

// Which words in the question put a lane on the path. "Why are you checking
// third-party diligence" deserves an answer from the question itself, not a
// claim that the system decided so.
export function routeReasons(question) {
  const reasons = {};
  const text = readable(question);
  for (const [agent, patterns] of Object.entries(RULES)) {
    const hits = patterns.flatMap((pattern) => [...text.matchAll(new RegExp(pattern.source, "gi"))].map((match) => match[0]));
    const unique = [...new Set(hits.map((hit) => hit.trim()).filter(Boolean))];
    if (unique.length) reasons[agent] = unique.slice(0, 6);
  }
  // No term matched, so every lane runs. Saying that plainly beats implying the
  // question was understood well enough to narrow it.
  return { reasons, matched: Object.keys(reasons).length > 0 };
}

export const AGENT_META = {
  trade: {
    name: "Trade Compliance Agent",
    nameZh: "贸易合规 Agent",
    color: "blue"
  },
  product: {
    name: "Product Export Control Agent",
    nameZh: "产品出口管制 Agent",
    color: "green"
  },
  tpdd: {
    name: "Ethics & TPDD Compliance Agent",
    nameZh: "道德合规与第三方尽调 Agent",
    color: "violet"
  }
};

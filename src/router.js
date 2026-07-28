const RULES = {
  trade: [
    /华为|huawei|entity list|restricted part|sanction|制裁|限制名单|交易对方|交易方|party.screening|screening|sdn|ofac|denied|ownership|所有权|最终用户|end.user|最终用途|end.use|名单命中|list match|false positive/i
  ],
  product: [
    /h100|h200|gpu|cpu|chip|芯片|eccn|app|tpp|product|产品|export|出口|reexport|转运|transit|墨西哥|mexico|加拿大|canada|dual.use|两用物项|encryption|加密/i
  ],
  tpdd: [
    /tpdd|third.party|due diligence|shell compan|空壳|第三方|中间商|顾问|经销商|distributor|consultant|commission|佣金|ubo|beneficial owner|实际控制|pep|离岸|offshore|付款|货代|freight.forwarder|成功费|success fee|共享办公|shared.office|政府招标|government tender/i
  ]
};

export function routeQuestion(question, fallback = true) {
  const matches = Object.entries(RULES)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(question)))
    .map(([agent]) => agent);

  return matches.length ? matches : fallback ? ["trade", "product", "tpdd"] : [];
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

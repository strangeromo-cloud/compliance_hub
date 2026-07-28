export function classifyQuestionIntent(question = "") {
  const text = String(question).toLowerCase();
  if (/\b(app|tpp|eccn|hts|ccats)\b|算力值|分类值|编码是多少|值是多少/.test(text)) return "product_metric";
  if (/policy|政策|法规|法律依据|规则是什么|要求是什么|regulation|rule|框架/.test(text)) return "policy_lookup";
  if (/是否.*(受限|管制|限制)|是不是.*(受限|管制)|是否需要.*许可|需要.*许可证|is .*restricted|license required|controlled item/.test(text)) return "product_restriction";
  if (/名单|screening|list match|entity list|sdn|制裁|交易对方|华为|huawei/.test(text)) return "party_screening";
  if (/tpdd|due diligence|尽调|空壳|shell compan|ubo|顾问|经销商|付款|佣金|成功费/.test(text)) return "third_party_diligence";
  return "scenario_assessment";
}

export function isChinaDualUseQuestion(question = "") {
  return /中国|境内|商务部|海关|prc|china|chinese/i.test(question) && /两用物项|dual.use|出口管制|export control/i.test(question);
}

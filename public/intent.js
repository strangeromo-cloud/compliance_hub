// What the user is actually asking for, decided once.
//
// The page had its own copy of the routing rules — a hand-written set of regexes
// in app.js that guessed which specialists a question would reach, so the
// composer could show a hint before the question was sent. Two copies of a rule
// diverge, and these had: the hint promised "Product export control agent" for
// "what is part 100-000000009's ECCN", a question the server answers as a lookup
// and never routes to an agent at all. It knew nothing about gems either, so
// selecting the regulatory-briefing gem still showed three agent tags for a run
// that opens no review procedure.
//
// So the rules live here, in public/, and the server imports them — the same
// direction the gem catalogue already travels (src/gem-kinds.js reads
// public/gems.js) and for the same reason: one list, no drift.
//
// What the browser can decide, it decides exactly. Whether a question is a
// lookup rather than a review turns on lookupSubject() alone — resolveLookup()
// returns an answer for anything lookupSubject() matches, even when the data
// holds nothing — so the page's judgement is the server's judgement, not an
// approximation of it. What the browser cannot decide it does not claim: the
// content of that answer needs the database, and only the run knows it.

const RULES = {
  trade: [
    // The Chinese half was thinner than the English: "screening" put a question
    // on the trade lane and 筛查 did not, "entity list" did and 实体清单 did not.
    // So "客户 X，请做受限方筛查" — a question whose entire subject is restricted-
    // party screening — matched only 产品 and ran as a product question.
    // 名单 subsumes the narrower 限制名单 and 名单命中 it replaces: in export
    // control a 名单 is a restricted-party list, where 清单 is ambiguous between
    // the Entity List and the Control List and is deliberately not matched bare.
    /华为|huawei|entity list|实体清单|restricted part|受限方|被列名|sanction|制裁|名单|交易对方|交易方|party.screening|screening|筛查|sdn|ofac|denied|ownership|所有权|股权穿透|穿透|持股|母公司|实际控制人|50%|50 percent|最终用户|end.user|最终用途|end.use|list match|false positive/i
  ],
  product: [
    // The lane is item and licensing, so the words a reviewer actually writes
    // about both belong here: a licence question, a classification question and
    // a Country Chart question were all falling through to "nothing matched".
    // 管制 is matched only in a compound — bare, it is as much 出口管制管控名单 as
    // it is 管制编码, and it would pull party screening onto this lane.
    /h100|h200|gpu|cpu|chip|芯片|eccn|ccl|hts|ccats|app|tpp|product|产品|物项|型号|料号|part number|export|出口|reexport|转运|transit|墨西哥|mexico|加拿大|canada|dual.use|两用物项|encryption|加密|服务器|server|高性能计算|计算卡|显卡|licen|许可|管制清单|管制编码|管制号|管制理由|分类|归类|classification|国别矩阵|country chart|de minimis|最低含量|原产内容|外国直接产品|foreign direct product|\bfdp\b/i
  ],
  tpdd: [
    // Same widening on this side: 受益所有人 is the Chinese for a term that was
    // only matched in English, and the DOJ factors this lane works through —
    // commercial rationale, scope of services, the payment route — had no words
    // of their own here at all.
    /tpdd|third.party|due diligence|背景调查|shell compan|空壳|第三方|中间商|顾问|经销商|distributor|consultant|commission|佣金|ubo|beneficial owner|受益所有人|实际控制|pep|离岸|offshore|付款|收款|打款|汇款|账户|货代|freight.forwarder|成功费|success fee|商业合理性|服务范围|共享办公|shared.office|政府招标|government tender|尽职调查|尽调|咨询公司|代理商|代理|分销商|中介|支付|回佣/i
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

const PART_NUMBER = /\b[0-9A-Z]{2,6}-[0-9A-Z]{3,}(?:-[0-9A-Z]+)*\b/gi;
const ECCN = /\b(\d[A-E]\d{3}(?:\.[a-z](?:\.\d+)?)?)\b/g;

const ASKS_CLASSIFICATION = /\beccn\b|分类|管制编码|管制号|归类|classification/i;
const ASKS_MEANING = /是什么|什么意思|指的是|含义|定义|what is|means|meaning/i;
// A question that also describes a transaction is not a lookup, whatever else it
// contains: the moment a destination or a counterparty is in play, the procedure
// is the point.
const DESCRIBES_TRANSACTION = /出口到|运往|发运|销售给|卖给|客户|最终用户|代理商|经销商|中间商|目的地|是否需要许可|能否交易|ship to|export to|end user|customer|licen[cs]e required/i;

// Which list a question is actually asking about. Naming one is a constraint:
// "is Huawei on the Entity List" is answered by the Entity List, and screening
// eleven other sources to answer it produces hits nobody asked about and a
// diligence procedure nobody wanted.
//
// The tag is the sourceList value the record itself carries, because the CSL is
// an aggregate: the Entity List and the SDN list live inside the same source and
// can only be told apart per record.
export const LIST_TAGS = [
  { tag: "entity_list", match: /entity list|实体清单|\bel\b/i, sourceIds: ["trade-csl"], recordList: /entity list/i, label: "BIS 实体清单（Entity List）" },
  { tag: "denied_persons", match: /denied person|dpl|拒绝清单/i, sourceIds: ["trade-csl"], recordList: /denied persons/i, label: "BIS 被拒绝人员清单（DPL）" },
  { tag: "unverified", match: /unverified list|\buvl\b|未核实清单/i, sourceIds: ["trade-csl"], recordList: /unverified/i, label: "BIS 未核实清单（UVL）" },
  { tag: "military_end_user", match: /military end user|\bmeu\b|军事最终用户/i, sourceIds: ["trade-csl"], recordList: /military end user/i, label: "BIS 军事最终用户清单（MEU）" },
  { tag: "sdn", match: /\bsdn\b|specially designated|特别指定|ofac/i, sourceIds: ["trade-csl", "ofac-sls"], recordList: /specially designated/i, label: "OFAC SDN 清单" },
  { tag: "uflpa", match: /uflpa|维吾尔|强迫劳动/i, sourceIds: ["us-uflpa"], recordList: null, label: "UFLPA 实体清单" },
  { tag: "1260h", match: /1260h|中国军工企业|chinese military compan/i, sourceIds: ["us-dod-1260h"], recordList: null, label: "美国国防部 1260H 清单" },
  { tag: "unreliable_entity", match: /不可靠实体/i, sourceIds: ["china-unreliable-entity"], recordList: null, label: "中国不可靠实体清单" },
  { tag: "china_control", match: /管控名单|中国管控/i, sourceIds: ["china-control-entities"], recordList: null, label: "中国出口管制管控名单" }
];

const ASKS_MEMBERSHIP = /是否(在|被列入|属于)|在不在|有没有(被)?列入|是不是在|列入了吗|被列入|is .* on the|appear on|listed on|included in/i;

const unique = (values) => [...new Set(values)];

export function lookupSubject(question = "") {
  const text = String(question);
  if (DESCRIBES_TRANSACTION.test(text)) return null;

  const parts = unique((text.match(PART_NUMBER) || []).map((value) => value.toUpperCase()))
    // An ECCN looks nothing like a part number, but a control code such as
    // 4A090.a would match neither; keeping them apart avoids searching for a
    // classification as though it were a product.
    .filter((value) => !/^\d[A-E]\d{3}/i.test(value));
  const codes = unique([...text.matchAll(ECCN)].map((match) => match[1].toUpperCase()));

  if (parts.length && ASKS_CLASSIFICATION.test(text)) return { kind: "classification_of_part", parts, codes };
  if (codes.length && (ASKS_MEANING.test(text) || ASKS_CLASSIFICATION.test(text))) return { kind: "meaning_of_code", parts, codes };

  // "Is X on the Entity List" is a membership question. It is answered by
  // searching that list — not by opening a diligence procedure that goes on to
  // ask about beneficial ownership, which is a different question nobody asked.
  const tags = LIST_TAGS.filter((entry) => entry.match.test(text));
  if (ASKS_MEMBERSHIP.test(text) && (tags.length || /名单|清单|list/i.test(text))) {
    return { kind: "list_membership", tags, parts, codes };
  }
  return null;
}

// Asking, in the conversation, for what was just analysed to be written up.
//
// /case-memo used to be the only way here, and removing it left the write-up
// unreachable — the router has no memo terms, so "把上面的筛查整理成备忘录" came
// back as a fresh trade review of a question that describes no transaction.
//
// Two conditions, and the second is the one that matters. The phrasing alone is
// not enough: "客户要求我们出一份备忘录说明该产品不受管制" is a transaction with
// the word in it, and writing it up instead of reviewing it would answer a
// question nobody asked. So it must also either point at this session — 上面,
// 以上, 本次, 刚才 — or be short enough that the request is the whole of it.
//
// The rule the product states elsewhere still holds and this sits under it: a
// question that describes a transaction gets the review.
const MEMO_PHRASE = /(整理|归纳|汇总|写|出|生成|做)[成一份个的份]{0,3}\s*(案件)?(备忘录|memo)|(write|draft|turn)[^.?!]{0,40}\b(memo|memorandum)\b|\bcase memo\b/i;
const MEMO_SCOPE = /上面|以上|上述|本次|这次|本会话|刚才|前面|刚刚|above|this (session|thread|conversation)|so far/i;
const MEMO_BRIEF = 18;

export function isMemoRequest(question = "") {
  const text = String(question).trim();
  if (!MEMO_PHRASE.test(text)) return false;
  if (MEMO_SCOPE.test(text)) return true;
  // Short enough that the request is all there is. Counted in characters for
  // Chinese and in words for English, because 18 of one is not 18 of the other.
  const words = text.split(/\s+/).filter(Boolean).length;
  return /[一-龥]/.test(text) ? text.length <= MEMO_BRIEF : words <= 8;
}

// The whole judgement, in the order the run makes it — because the order is the
// judgement. A gem that produces a briefing or a memo settles it before anything
// else is read: those questions name no counterparty and no item, and running a
// review procedure over one produced a party-screening step for a question with
// no party in it. Then a lookup, which is a question about a recorded value and
// has no transaction to review. Only what is left is a compliance review, and
// only then does it matter which lanes it needs.
export function judgeIntent({ question = "", gemKind = null } = {}) {
  const text = String(question).trim();
  const intent = classifyQuestionIntent(text);

  if (gemKind === "briefing" || gemKind === "memo") {
    return { kind: gemKind, review: false, agents: [], intent, reasons: {}, matched: true, because: "gem" };
  }
  if (!text) return { kind: "empty", review: false, agents: [], intent, reasons: {}, matched: false, because: null };

  // Before the lookup, because "把上面的 ECCN 整理成备忘录" carries a part number
  // and is still a request to write up rather than a question about a value.
  if (isMemoRequest(text)) {
    return { kind: "memo", review: false, agents: [], intent, reasons: {}, matched: true, because: "asked" };
  }

  const subject = lookupSubject(text);
  if (subject) {
    return { kind: "lookup", review: false, agents: [], intent, reasons: {}, matched: true, because: subject.kind };
  }

  const routed = routeQuestion(text, false);
  const { reasons, matched } = routeReasons(text);
  return {
    kind: "review",
    review: true,
    // No term matched, so every lane runs. The page says so rather than showing
    // three tags as though the question had been understood well enough to
    // narrow it.
    agents: routed.length ? routed : ["trade", "product", "tpdd"],
    intent,
    reasons,
    matched,
    because: null
  };
}

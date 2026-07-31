// When the facts support saying so, saying so.
//
// Every rules-mode conclusion came back as high or medium risk, whatever the
// question said. A direct sale of an EAR99 laptop to a long-standing German
// customer produced the same "requires human review" as a listed party in an
// embargoed destination. That is not caution; it is a review that does not read
// its inputs, and a reviewer who is told everything is serious learns to ignore
// the tool.
//
// So this decides one narrow thing: whether the stated facts affirmatively
// support a clear outcome. Every condition below has to be met by something the
// question or the declarations actually say. The two rules that govern triage
// govern this too, and harder, because clearing is the direction in which a
// mistake does damage:
//
//   1. Silence is never a pass. An unstated destination, an unstated end use or
//      an unscreened list leaves the case unresolved — not clear.
//
//   2. Every condition carries the provision it rests on, and the conclusion
//      states its conditions. "Clear" here means "no licence requirement arises
//      on these facts under these provisions", never "approved".
//
// What it does not do: release anything. The review step stands, because the
// system does not release transactions. What changes is whether that step is a
// formality on a clean file or the place a blocked case stops.

const NO_THIRD_PARTY = /(?:直销|直接(?:销售|供货|出口|发运)|无(?:中间商|代理|经销商|第三方)|没有(?:中间商|代理|经销商|第三方)|end.customer directly|direct sale|no (?:agent|intermediary|distributor|third.party))/i;

const EAR99 = /^\s*ear\s*-?\s*99\s*$/i;
const BELOW_DE_MINIMIS = /^<\s*10%$/;

// Destinations for which an EAR99 item needs no licence on destination grounds.
// An allow-list, not a block-list: a country nobody wrote a rule for must not
// fall through into "fine". These are Country Group A:1 members plus the other
// close partners the prototype uses in its fixtures.
const UNRESTRICTED_DESTINATIONS = [
  [/德国|germany/i, "德国"], [/法国|france/i, "法国"], [/荷兰|netherlands/i, "荷兰"],
  [/英国|united kingdom|\buk\b/i, "英国"], [/日本|japan/i, "日本"], [/韩国|south korea|korea, republic/i, "韩国"],
  [/加拿大|canada/i, "加拿大"], [/澳大利亚|australia/i, "澳大利亚"], [/意大利|italy/i, "意大利"],
  [/西班牙|spain/i, "西班牙"], [/瑞典|sweden/i, "瑞典"], [/丹麦|denmark/i, "丹麦"],
  [/挪威|norway/i, "挪威"], [/芬兰|finland/i, "芬兰"], [/比利时|belgium/i, "比利时"],
  [/奥地利|austria/i, "奥地利"], [/瑞士|switzerland/i, "瑞士"], [/爱尔兰|ireland/i, "爱尔兰"],
  [/新西兰|new zealand/i, "新西兰"]
];

// End uses that carry their own prohibition regardless of classification
// (§ 744). One of these in the file stops a clear outcome outright.
const SENSITIVE = "核|军事|军用|导弹|生化|武器|弹药|监控|情报|超级计算|军民融合|nuclear|militar|missile|chemical weapon|biolog|munition|surveillance|intelligence|supercomput";
const PROHIBITED_END_USE = new RegExp(SENSITIVE, "i");

// "无军事或核相关用途" and "no military or nuclear application" state the
// absence of a prohibited end use. Testing the sentence for those words alone
// reads a denial as an admission — the same mistake the router made when
// "无中间商" counted as mentioning an intermediary, and here it would block a
// case that is clean precisely because the declarant said so.
//
// The negation has to sit against the term, with a coordinated list allowed
// after it, so that only the denial is removed. Anything further away in the
// sentence stays and is still tested: "no resale, to be used in a missile
// programme" must not clear.
const NEGATED_END_USE = [
  new RegExp(`(?:无|非|不(?:用于|涉及|作)|没有)(?:\\s*(?:${SENSITIVE}|相关|等|类)\\s*[、和或及与/]?){1,6}(?:用途|使用|应用|目的)?`, "gi"),
  new RegExp(`\\bno(?:t)?\\s+(?:a\\s+|any\\s+)?(?:\\w+\\s+){0,2}(?:${SENSITIVE})\\w*(?:\\s*(?:or|and|,)\\s*(?:\\w+\\s+){0,2}(?:${SENSITIVE})\\w*)*`, "gi")
];

const withoutDenials = (text) => NEGATED_END_USE.reduce((acc, pattern) => acc.replace(pattern, " "), String(text));

const stated = (value) => {
  const text = String(value ?? "").trim();
  // Answers the form accepts that decide nothing. Treating these as facts is
  // how a placeholder becomes a clearance.
  if (!text || /^(不确定|未知|待定|n\/a|na|unknown|tbd|已提供|-|—)$/i.test(text)) return null;
  return text;
};

// Only the declared destination counts. Reading it out of the question meant any
// mention of a permitted country cleared the case — "我们在德国有分公司，客户在
// 伊朗" would have found 德国 and stopped looking. The destination is a field the
// path asks for; if it has not been answered, the case is not ready.
function destinationOf(facts) {
  const declared = stated(facts.destination);
  const hit = declared ? UNRESTRICTED_DESTINATIONS.find(([pattern]) => pattern.test(declared)) : null;
  return { declared, name: hit?.[1] || null, unrestricted: Boolean(hit) };
}

// The list a US export conclusion cannot be drawn without.
//
// trade-csl is the aggregate: of its 25,921 records, 19,181 are OFAC's SDN list
// and the rest are the Entity List, DPL, UVL, MEU, ITAR Debarred, SSI, CMIC and
// the remaining Treasury and State lists. ofac-sls is a direct-from-OFAC copy of
// a subset of it, so requiring it as well would demand a second download of
// records already screened — and it answers 403 to many hosts.
//
// Everything else a deployment has not synced is a stated limit on the scope of
// the conclusion rather than a silent gap; the conclusion names them.
const REQUIRED_LISTS = ["trade-csl"];

// Each returns either a met condition, with the provision it rests on, or the
// reason it is not met. The reason is what the answer shows when a case does not
// clear, so it has to name the missing fact rather than say "insufficient".
function conditions({ question, facts, grounding }) {
  const checks = [];
  const screening = grounding?.screening || null;
  const matches = grounding?.listMatches || [];
  const destination = destinationOf(facts);
  const endUse = stated(facts.endUse);

  const unsynced = screening?.unsyncedSources || [];
  const missingRequired = REQUIRED_LISTS.filter((sourceId) => unsynced.includes(sourceId));
  checks.push(matches.length === 0 && screening?.screenedSources?.length && !missingRequired.length
    ? { id: "screening", met: true, cite: "§ 732.3(g) · Supplement No. 3 to Part 732", because: `已筛查 ${screening.screenedSources.length} 个官方名单来源（含 CSL，其中包含 OFAC SDN 与 BIS 实体清单），无名称命中` }
    : {
      id: "screening", met: false,
      because: matches.length ? `名单存在 ${matches.length} 条潜在命中，需先完成身份消歧`
        : missingRequired.length ? `美国综合筛查名单（trade-csl）尚未同步，本次未筛查——来源缺失不等于无风险，请先在「数据覆盖」页同步一次`
          : "尚未对交易方完成官方名单筛查"
    });

  const eccn = stated(facts.eccn);
  const usContent = stated(facts.usContent);
  if (EAR99.test(eccn || "")) {
    checks.push({ id: "classification", met: true, cite: "Part 774 CCL · § 738.3", because: "分类为 EAR99：受 EAR 管辖但不在管制清单上，无 Country Chart 单元可查" });
  } else if (BELOW_DE_MINIMIS.test(usContent || "")) {
    checks.push({ id: "classification", met: true, cite: "§ 734.4 de minimis", because: "受控美国原产内容低于 de minimis 门槛，物项不因此受 EAR 管辖" });
  } else {
    checks.push({ id: "classification", met: false, because: eccn ? `分类为 ${eccn}，属列名 ECCN，需继续查管制理由与目的地矩阵` : "尚未确定分类（ECCN 或 de minimis 判定）" });
  }

  checks.push(destination.unrestricted
    ? { id: "destination", met: true, cite: "Part 738 Commerce Country Chart · Part 740", because: `目的地为${destination.name}，非禁运或武器禁运目的地` }
    : { id: "destination", met: false, because: destination.declared ? `目的地「${destination.declared}」不在本系统的免许可目的地清单内，需逐项核对国别矩阵与制裁措施` : "尚未说明最终目的地" });

  checks.push(NO_THIRD_PARTY.test(question)
    ? { id: "third_party", met: true, cite: "DOJ ECCP — Third-Party Management", because: "问题描述为直接交易，未涉及代理、经销或中间方" }
    : { id: "third_party", met: false, because: "未说明是否存在代理、经销商或中间方——未提及不等于没有" });

  const endUseText = withoutDenials(`${endUse || ""} ${question}`);
  checks.push(endUse && !PROHIBITED_END_USE.test(endUseText)
    ? { id: "end_use", met: true, cite: "§ 744 General Prohibition Five", because: `最终用途已声明为「${endUse}」，未落入 § 744 列举的禁止用途` }
    : { id: "end_use", met: false, because: endUse ? `声明的最终用途「${endUse}」触及 § 744 列举的敏感用途，需要单独判断` : "尚未声明最终用户与最终用途" });

  return checks;
}

// A clear outcome only where every condition is met and nothing on the path is
// still waiting on an answer. An open question anywhere means the file is
// incomplete, and an incomplete file does not clear.
export function assessClearance({ question = "", facts = {}, grounding = {}, path = null } = {}) {
  const checks = conditions({ question, facts, grounding });
  const unmet = checks.filter((check) => !check.met);
  const open = (path?.lanes || []).flatMap((lane) => lane.steps).filter((step) => step.status === "evidence_needed");

  return {
    cleared: unmet.length === 0 && open.length === 0,
    checks,
    unmet,
    openSteps: open.map((step) => step.title),
    // Stated with the conclusion, because a clearance that does not carry its
    // own conditions is indistinguishable from an approval.
    conditions: [
      "以上事实由申报方陈述，未经独立核验；任一事实变化即需重新判断。",
      "无许可要求不等于无记录义务：仍须按 § 762 保存出口记录五年。",
      // Which lists went unscreened is already stated by grounding, so it is not
      // repeated here.
      "本结论仅覆盖美国 EAR 与本次已筛查的名单，不含目的国进口管制、制裁或其他法域要求。"
    ]
  };
}

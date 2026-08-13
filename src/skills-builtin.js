// The skill that ships with the product.
//
// Its own module, not skills.js, because command-registry.js has to see these
// commands to refuse a reader creating one under them — and skills.js imports
// command-registry.js. A list with no dependencies of its own breaks that,
// which is the same shape as public/gems.js sitting under src/gem-kinds.js.

// One skill ships with the product, on the same footing as the built-in gems:
// it is in the code, not in the database, so it cannot be deleted and cannot
// come back after being deleted. A row seeded on first boot would have needed a
// marker to tell "never seeded" from "the reader removed it", and getting that
// wrong resurrects something somebody threw away.
//
// It is a regulatory-impact procedure rather than another screening or
// classification one, because those are gems: they bind sources and check the
// question for facts, and a skill can do neither. What a skill can do is say how
// the work should be laid out, and "what does this change mean for us" is a
// question the lanes answer well but never organise on their own.
//
// example is what the scenario library shows. A gem carries a placeholder for
// the same purpose; a skill had nowhere to put one, so every skill in the
// library was a command with no demonstration of how to use it.
export const BUILTIN_SKILLS = [
  {
    id: "skill-reg-impact",
    builtin: true,
    command: "reg-impact",
    // Bilingual, because this one ships with the product. A skill a reader wrote
    // is in whatever language they wrote it in and stays there; this one appeared
    // under an English heading in Chinese.
    name: { zh: "监管变化影响评估", en: "Regulatory change impact" },
    summary: {
      zh: "先确定条文改了什么，再逐层评估它落在哪些业务、产品、供应链和内部控制上。",
      en: "Establish what a provision changed, then work outward to the businesses, products, supply chain and internal controls it lands on."
    },
    procedure: [
      "按以下顺序处理，每一步说清楚依据的是哪一份正文：",
      "1. 变化本身：旧状态、新状态、改动的条款、发布日、生效日、过渡期。只拿到摘要时标明这是摘要级初判，不要推测条文差异。",
      "2. 适用性：这项变化是直接适用、可能直接适用、间接影响、不太可能适用，还是信息不足以判断。逐条说明理由。",
      "3. 落点：涉及哪些产品线、地区、供应商、制造与物流、渠道与客户、服务、数据与 AI 流程。没有依据的落点不要列。",
      "4. 内部政策与控制：除非问题里给了内部材料，否则一律作为「待确认项」提出——候选政策、候选控制、可能的责任人、可能的缺口，并写明需要什么材料才能确认。",
      "5. 动作：立即要做的、需要排期的、有截止日触发点的、需要法务或人工复核的，分开列。"
    ].join("\n"),
    example: {
      zh: "美国 BIS 上个月更新了先进计算物项的管制范围，对我们意味着什么？",
      en: "BIS updated the scope of controls on advanced computing items last month — what does that mean for us?"
    },
    createdAt: "2026-08-12T00:00:00.000Z"
  }
];

// Who owns this company, aggregated the way the rule actually works.
//
// Four sources say something about ownership and none of them was composed with
// any other. OFAC states 5,047 relationships and the step read one hop of them.
// GLEIF names a parent and the step read one hop. A Schedule 13D/G names the
// holders above five per cent and the step read one hop. The user typed a
// structure into a text box and nothing read it at all. A designated party three
// levels above a counterparty was, in every case, invisible.
//
// What the rule requires, precisely, because the shape of the computation
// follows from it:
//
//   OFAC's 50 Percent Rule blocks an entity owned in the aggregate, directly or
//   indirectly, 50 per cent or more by one or more blocked persons. Two things
//   follow. Shares held by DIFFERENT blocked persons ADD — 25% from one and 25%
//   from another reaches the threshold. And the rule does NOT multiply down a
//   chain: a blocked person holding 50% of A blocks A, and A holding 50% of B
//   then blocks B outright, not at 25%.
//
// So it is a closure over a graph, iterated until nothing more changes — not a
// lookup, which is what it has been.
//
// The honest limit, stated here because everything below depends on it: the edge
// set is never known to be complete. A total below 50 per cent therefore never
// clears anything. It narrows the question — and narrowing it is the point, since
// the step's alternative is to ask a person to supply an entire shareholding
// structure from memory. What this can do is say which single percentage would
// settle the matter, and that is a question someone can actually answer.

import { normalizeEntityName } from "./entity-matching.js";

// What a percentage on an edge is a percentage OF. They are not interchangeable
// and a reader adding them together is making a claim none of the publishers
// make, so the measure travels on every edge and is reported with every total.
export const MEASURES = {
  stated_control: { percent: false, label: "OFAC 声明的所有权或控制关系（不含比例）" },
  accounting_consolidation: { percent: false, label: "GLEIF 会计合并母公司（不含比例）" },
  beneficial_13d3: { percent: true, label: "SEC Schedule 13D/G 受益所有权（13d-3，按证券类别）" },
  declared: { percent: true, label: "用户填报股权结构（未核验）" }
};

const key = (name) => normalizeEntityName(name || "");

function addEdge(edges, edge) {
  if (!edge.owner || !edge.asset) return;
  const ownerKey = key(edge.owner);
  const assetKey = key(edge.asset);
  // An entity does not own itself, and the registers do say so: GLEIF returns a
  // record as its own ultimate parent where no other was declared. Left in, it
  // becomes a self-loop that the traversal has to defend against forever.
  if (!ownerKey || !assetKey || ownerKey === assetKey) return;
  edges.push({ ...edge, ownerKey, assetKey });
}

// A shareholding written by a person, which is the only place a percentage
// entered this system before the filings did.
//
// Deliberately narrow. It reads "名称 持股 30%" and "Name holds 30%" and nothing
// cleverer, because a number this misreads becomes a number in a 50 Percent Rule
// calculation. Anything it cannot parse is left for the reader rather than
// guessed at.
const DECLARED_SHARE = /([\p{L}\p{N}][\p{L}\p{N}\s.,&'’()-]{1,60}?)\s*(?:持股|持有|占股|holds?|owns?)\s*(?:约|about\s*)?(\d{1,3}(?:\.\d+)?)\s*%/giu;

export function parseDeclaredOwnership(text, asset) {
  const edges = [];
  if (!text || !asset) return edges;
  for (const match of String(text).matchAll(DECLARED_SHARE)) {
    const percent = Number(match[2]);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
    addEdge(edges, {
      owner: match[1].replace(/^[、,，;；和及]+/u, "").trim(),
      asset,
      percent,
      measure: "declared",
      sourceId: "user_declaration"
    });
  }
  return edges;
}

// One edge list out of every source that says anything about who holds whom.
export function buildOwnershipGraph({ statedEdges = [], chain = null, filed = null, declaredText = "", subject = null } = {}) {
  const edges = [];
  const designated = new Set();

  for (const record of statedEdges) {
    addEdge(edges, {
      owner: record.ownerName,
      asset: record.entityName,
      // OFAC publishes none. Recorded as an edge with no number rather than
      // dropped: the relationship is the finding, and the missing number is
      // exactly what the aggregation will ask for.
      percent: record.percentage ? Number(String(record.percentage).replace(/[^\d.]/g, "")) || null : null,
      measure: "stated_control",
      sourceId: "ofac-ownership",
      role: record.role || null,
      sourceUrl: record.sourceUrl || null
    });
    if (record.ownerDesignated) designated.add(key(record.ownerName));
    if (record.assetDesignated) designated.add(key(record.entityName));
  }

  if (chain?.subject) {
    for (const [relation, parent] of [["direct", chain.directParent], ["ultimate", chain.ultimateParent]]) {
      if (!parent?.name) continue;
      addEdge(edges, {
        owner: parent.name, asset: chain.subject.name, percent: null,
        measure: "accounting_consolidation", sourceId: "gleif-lei",
        role: `${relation} parent`, sourceUrl: parent.sourceUrl || null
      });
    }
  }

  for (const holder of filed?.holders || []) {
    addEdge(edges, {
      owner: holder.name, asset: filed.issuer.name, percent: holder.percentOfClass,
      measure: "beneficial_13d3", sourceId: "sec-edgar",
      securityClass: holder.securityClass, asOf: holder.filedAt, sourceUrl: holder.sourceUrl || null
    });
  }

  edges.push(...parseDeclaredOwnership(declaredText, subject));

  const byAsset = new Map();
  for (const edge of edges) {
    if (!byAsset.has(edge.assetKey)) byAsset.set(edge.assetKey, []);
    byAsset.get(edge.assetKey).push(edge);
  }
  return { edges, designated, ownersOf: (name) => byAsset.get(key(name)) || [] };
}

const THRESHOLD = 50;

// Walk up from the counterparty and aggregate at every level.
//
// Returns three things a reader needs and had none of: whether the rule is
// reached on what is known, how much is accounted for, and — where it is not
// reached — which specific percentages would settle it.
export function aggregateOwnership(graph, target, { designated = [], maxDepth = 6 } = {}) {
  const listed = new Set([...graph.designated, ...designated.map(key)]);
  const memo = new Map();
  const inProgress = new Set();

  const evaluate = (entityKey, name, depth) => {
    // Listed in its own right, which is the screening step's finding and not
    // this one's. No total is reported for it: nobody holds 100% of it, it is
    // simply on a list, and putting a number there would invent one.
    if (listed.has(entityKey)) return { verdict: "designated", known: null, missing: [], via: [] };
    if (memo.has(entityKey)) return memo.get(entityKey);
    // A cycle is a cross-holding, not an error. It contributes nothing on the
    // way round rather than recursing forever, and the outer visit still counts
    // whatever it can establish on its own.
    if (inProgress.has(entityKey) || depth >= maxDepth) {
      return { verdict: "not_established", known: 0, missing: [], via: [], truncated: true };
    }
    inProgress.add(entityKey);

    let known = 0;
    const via = [];
    const missing = [];
    const measures = new Set();
    // One relationship can arrive from several sources, and only some of them
    // carry a number: GLEIF names the parent, the user supplies its share. Asking
    // again for a percentage another source already gave would put a question on
    // the board that has just been answered.
    const quantified = new Set(graph.ownersOf(name)
      .filter((edge) => edge.percent !== null && edge.percent !== undefined)
      .map((edge) => edge.ownerKey));
    for (const edge of graph.ownersOf(name)) {
      const owner = evaluate(edge.ownerKey, edge.owner, depth + 1);
      // An owner that is itself blocked passes its whole stake through: the rule
      // does not dilute down a chain, it re-applies at each level.
      if (owner.verdict !== "designated" && owner.verdict !== "blocked") continue;
      if (edge.percent === null || edge.percent === undefined) {
        // The relationship is established and the size of it is not. This is the
        // question worth asking a person, and it is a far smaller question than
        // "supply the shareholding structure".
        if (!quantified.has(edge.ownerKey)) {
          missing.push({ owner: edge.owner, asset: edge.asset, measure: edge.measure, sourceId: edge.sourceId, role: edge.role || null, ownerVerdict: owner.verdict });
        }
        continue;
      }
      known += edge.percent;
      measures.add(edge.measure);
      via.push({ owner: edge.owner, percent: edge.percent, measure: edge.measure, sourceId: edge.sourceId, asOf: edge.asOf || null, ownerVerdict: owner.verdict });
    }

    inProgress.delete(entityKey);
    const result = {
      verdict: known >= THRESHOLD ? "blocked" : missing.length ? "undetermined" : "not_established",
      known: Math.round(known * 100) / 100,
      via,
      missing,
      measures: [...measures],
      // Two filings can report the same shares — a fund and its adviser each
      // disclose the holding — so a total built from more than one of them is
      // not a sum a reader may rely on without checking the filers are
      // unrelated.
      doubleCountRisk: via.filter((item) => item.measure === "beneficial_13d3").length > 1,
      // Percentages of different things were added to reach this number.
      mixedMeasures: measures.size > 1
    };
    memo.set(entityKey, result);
    return result;
  };

  const result = evaluate(key(target), target, 0);
  return {
    target,
    ...result,
    threshold: THRESHOLD,
    // Said once, here, so no caller can present a total below the threshold as a
    // clearance: the edge set is not known to be complete, and an ownership
    // relationship nobody published is not an ownership relationship that does
    // not exist.
    meaning: "该合计基于本系统已知的所有权关系。未达 50% 不构成排除：边集不保证完整，且 GLEIF 与 OFAC 均不公布持股比例。"
  };
}

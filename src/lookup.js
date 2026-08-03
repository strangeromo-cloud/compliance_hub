// Answering a question instead of reviewing it.
//
// "100-000000009 这个 AMD 的 ECCN 是什么" is a lookup. It has no counterparty, no
// destination and no transaction; there is nothing for a compliance procedure to
// work on. Putting it through one produced three lanes, a set of steps, and the
// sentence "产品、路线、最终用户和最终用途必须共同分析" — true in general,
// unrelated to what was asked, and not the number the reader wanted.
//
// So a lookup is answered from what has been ingested, and the answer says which
// records were searched. That last part is the whole point when nothing is
// found: "not in the data here" is a useful answer and a different one from "no
// such classification exists", and only the first is something this system can
// actually say.

import { LIST_TAGS, lookupSubject } from "../public/intent.js";

export { lookupSubject };
import { readNormalized } from "./data-layer/storage.js";
import { manufacturerFactsFor, findProducts } from "./internal-data.js";

// A part number is a manufacturer's own identifier, and every vendor writes them
// differently — NVIDIA's 900-21010-0000-000, AMD's 100-000000009, a Lenovo
// TX-1140. Matching a shape rather than a vocabulary is what lets an unfamiliar
// vendor's number be recognised as one.
// The vendors' own published tables, which are the primary source for a part
// number: BIS publishes the control list but not which product is on it, so for
// a specific part the manufacturer's statement is the answer and everything else
// is derived from it.
const VENDOR_TABLES = [
  { sourceId: "nvidia-export", label: "NVIDIA 公开出口分类表" },
  { sourceId: "amd-export", label: "AMD 产品主表（Product Master）" }
];

async function classificationOfPart(parts) {
  const found = [];
  const searched = [];
  const unavailable = [];
  const wanted = parts.map((part) => part.toUpperCase());

  for (const table of VENDOR_TABLES) {
    const snapshot = await readNormalized(table.sourceId);
    // A table that holds no data was not searched, and saying nothing about it
    // lets "not in the ingested data" stand for two different things: the part
    // is absent from a table that was read, or the table that would answer was
    // never fetched. For an AMD part number with AMD's own master unsynced, the
    // second is the entire answer.
    if (!snapshot?.records?.length) {
      unavailable.push({ sourceId: table.sourceId, label: table.label });
      continue;
    }
    searched.push({
      sourceId: table.sourceId,
      fallback: Boolean(snapshot.isFallback),
      label: `${table.label}（${snapshot.records.length} 条${snapshot.capturedAt ? `，采集于 ${String(snapshot.capturedAt).slice(0, 10)}` : ""}${snapshot.isFallback ? "，随仓库提交的时点副本" : ""}）`
    });
    for (const record of snapshot.records) {
      const number = String(record.partNumber || "").toUpperCase();
      if (!number || !wanted.some((part) => number === part || number.startsWith(`${part}-`))) continue;
      found.push({
        subject: record.partNumber,
        value: record.eccn,
        field: "ECCN",
        detail: [
          record.vendor ? `${record.vendor} 公布` : null,
          record.description || null,
          record.htsUs ? `US HTS ${record.htsUs}` : null,
          record.tppPerGpu ? `TPP per GPU ${record.tppPerGpu}` : null,
          record.ccats ? `CCATS ${record.ccats}` : null,
          record.meets3A090a1 ? `Meets 3A090.a.1: ${record.meets3A090a1}` : null,
          record.classificationDate ? `分类数据截至 ${record.classificationDate}` : null
        ].filter(Boolean).join("；"),
        sourceId: table.sourceId,
        sourceUrl: record.sourceUrl,
        // A point-in-time copy answering as though it were the current table is
        // the one mistake this tool must not make, so the tag travels with the
        // value rather than being inferred from the source id.
        fallback: Boolean(snapshot.isFallback),
        humanReviewRequired: true
      });
      if (found.length >= 6) break;
    }
  }

  const manufacturer = await manufacturerFactsFor(parts.join(" ")).catch(() => []);
  searched.push({ sourceId: "manufacturer-classification", label: "厂商公开出口分类记录" });
  for (const record of manufacturer) {
    found.push({
      subject: record.model,
      value: record.eccn,
      field: "ECCN",
      detail: `形态 ${record.formFactor}${record.tppPerGpu ? `，TPP per GPU ${record.tppPerGpu}` : ""}`,
      sourceId: "manufacturer-classification",
      humanReviewRequired: true
    });
  }

  searched.push({ sourceId: "internal-master-data", label: "内部主数据（合成演示数据）" });
  for (const part of parts.slice(0, 3)) {
    const [product] = await findProducts(part).catch(() => []);
    if (!product) continue;
    found.push({
      subject: product.partNumber,
      value: product.eccnUs,
      field: "ECCN",
      detail: `内部声明值，分类置信度 ${product.classificationConfidence}；合成演示数据，不能作为实际分类依据`,
      sourceId: "internal-master-data",
      synthetic: true,
      humanReviewRequired: true
    });
  }

  return { found, searched, unavailable };
}

async function meaningOfCode(codes) {
  const found = [];
  const searched = [];

  const ccl = await readNormalized("bis-ccl");
  if (ccl?.records?.length) {
    searched.push({ sourceId: "bis-ccl", label: `美国管制清单 CCL（${ccl.records.length} 条，采集于 ${String(ccl.capturedAt).slice(0, 10)}）` });
    for (const code of codes) {
      const entry = ccl.records.find((record) => new RegExp(`^${code.split(".")[0]}\\b`).test(String(record.title || "")));
      if (!entry) continue;
      found.push({
        subject: code,
        value: String(entry.title).slice(0, 200),
        field: "CCL 条目",
        detail: String(entry.content || "").replace(/\s+/g, " ").slice(0, 400),
        sourceId: "bis-ccl",
        sourceUrl: entry.sourceUrl,
        humanReviewRequired: true
      });
    }
  }

  const cn = await readNormalized("china-control-list");
  if (cn?.records?.length) {
    searched.push({ sourceId: "china-control-list", label: `中国两用物项管制清单（${cn.records.length} 条）` });
    for (const code of codes) {
      const entry = cn.records.find((record) => record.controlCode === code.split(".")[0]);
      if (!entry) continue;
      found.push({
        subject: entry.controlCode,
        value: `${entry.industry} · ${entry.itemType} · ${entry.controlReasonDerived}`,
        field: "中国管制编码",
        detail: String(entry.description || "").slice(0, 400),
        sourceId: "china-control-list",
        sourceUrl: entry.sourceUrl,
        humanReviewRequired: true
      });
    }
  }

  return { found, searched };
}

// Membership is answered by searching the named list and nothing else.
//
// The party's name is taken from the question with the same fuzzy matcher the
// party step uses, so a partial name still reaches the register entry. What is
// reported is a potential match with its identity elements — never a
// confirmation, because a name is not an identity — but the question asked was
// whether the name appears, and that has an answer.
// PRC sources publish both the Chinese and the English name of the same entity;
// US lists publish only the English one. So "华为是否在 Entity List 中" cannot be
// answered by matching characters against an English register — and answering
// "not found" would be wrong for the wrong reason.
//
// The bridge is a record that carries both. Finding 华为 in a PRC list yields its
// English name, and that is what the English list is searched for. The bridge is
// reported, because an answer that silently changed the name it searched for is
// not checkable.
async function englishNamesFor(question) {
  const { fuzzyPartyCandidates } = await import("./entity-matching.js");
  if (!/[\u4e00-\u9fff]/.test(question)) return [];
  const bridged = [];
  for (const sourceId of ["china-control-entities", "china-unreliable-entity"]) {
    const snapshot = await readNormalized(sourceId);
    if (!snapshot?.records?.length) continue;
    for (const candidate of fuzzyPartyCandidates(question, snapshot.records, { limit: 2 })) {
      const english = candidate.record?.entityNameEn
        || (candidate.record?.aliases || []).find((alias) => /^[\x20-\x7e]+$/.test(alias));
      if (english) bridged.push({ chinese: candidate.entityName, english, sourceId });
    }
  }
  return bridged;
}

async function listMembership(question, tags) {
  const { fuzzyPartyCandidates } = await import("./entity-matching.js");
  const chosen = tags.length ? tags : LIST_TAGS;
  const bridges = await englishNamesFor(question);
  // A Chinese name against an English-language register is not a search that
  // returned nothing — it is a search that could not run. Reporting it as "not
  // listed" would have answered 华为是否在 Entity List 中 with a flat no, which
  // is both wrong and the most damaging way to be wrong.
  const unsearchable = /[\u4e00-\u9fff]/.test(question) && !bridges.length
    ? "问题中的主体以中文给出，而所查清单以英文登记，且未能在已接入的中国来源中找到对应英文名。本次检索无法覆盖该主体——这不是「未命中」，是「查不了」。请改用英文法定名称重试。"
    : null;
  // The question plus whatever English names it resolves to, so one pass over
  // each list covers both.
  const searchText = [question, ...bridges.map((bridge) => bridge.english)].join(" ");
  const found = [];
  const searched = [];
  const seenSource = new Set();

  for (const tag of chosen) {
    for (const sourceId of tag.sourceIds) {
      const snapshot = await readNormalized(sourceId);
      if (!snapshot?.records?.length) continue;
      // Only the records belonging to the list that was named. The CSL holds a
      // dozen lists at once, so answering "is it on the Entity List" from the
      // whole file would report an SDN hit as an Entity List hit.
      const records = tag.recordList
        ? snapshot.records.filter((record) => tag.recordList.test(String(record.sourceList || "")))
        : snapshot.records;
      if (!records.length) continue;
      const key = `${sourceId}:${tag.tag}`;
      if (!seenSource.has(key)) {
        seenSource.add(key);
        searched.push({ sourceId, label: `${tag.label}（${records.length} 条${snapshot.capturedAt ? `，采集于 ${String(snapshot.capturedAt).slice(0, 10)}` : ""}${snapshot.isFallback ? "，时点副本" : ""}）` });
      }
      for (const candidate of fuzzyPartyCandidates(searchText, records, { limit: 3 })) {
        found.push({
          subject: candidate.entityName,
          value: tag.label,
          field: "命中清单",
          detail: `匹配于「${candidate.matchedName}」，相似度 ${candidate.matchScore}${candidate.record?.sourceList ? `；条目所属：${candidate.record.sourceList}` : ""}`,
          sourceId,
          humanReviewRequired: true
        });
      }
    }
  }
  if (bridges.length) {
    searched.push({
      sourceId: bridges[0].sourceId,
      label: `中文名经中国来源解析为英文名后检索：${bridges.map((bridge) => `${bridge.chinese} → ${bridge.english}`).join("、")}`
    });
  }
  return { found, searched, unsearchable };
}

// Where the answer lives when this system does not have it. Naming the publisher
// is the difference between a dead end and a next step.
const ELSEWHERE = {
  classification_of_part: "厂商自己的出口分类页面是权威来源（例如 NVIDIA、AMD、Intel 各自的 export classification 页）；厂商未公布时，由出口商自行分类或向 BIS 申请 CCATS。",
  meaning_of_code: "美国编码见 15 CFR Part 774 Supplement No. 1；中国编码见商务部两用物项出口管制清单。",
  list_membership: "未在所查清单中命中，不代表在其他清单中也没有，也不代表所有权穿透后不受限；如需完整判断请提交交易情形做受限方审查。"
};

export async function resolveLookup(question) {
  const subject = lookupSubject(question);
  if (!subject) return null;

  const { found, searched, unsearchable, unavailable = [] } = subject.kind === "classification_of_part"
    ? await classificationOfPart(subject.parts)
    : subject.kind === "list_membership"
      ? await listMembership(question, subject.tags)
      : await meaningOfCode(subject.codes);

  return {
    unsearchable: unsearchable || null,
    // Sources that would have been searched and could not be. Named, because the
    // difference between "read and absent" and "never read" is the whole answer
    // when the missing one is the vendor's own table.
    unavailable,
    kind: subject.kind,
    asked: subject.kind === "classification_of_part" ? subject.parts
      : subject.kind === "list_membership" ? [String(question).slice(0, 60)]
        : subject.codes,
    found,
    searched,
    elsewhere: ELSEWHERE[subject.kind]
  };
}

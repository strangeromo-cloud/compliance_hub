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

import { readNormalized } from "./data-layer/storage.js";
import { manufacturerFactsFor, findProducts } from "./internal-data.js";

// A part number is a manufacturer's own identifier, and every vendor writes them
// differently — NVIDIA's 900-21010-0000-000, AMD's 100-000000009, a Lenovo
// TX-1140. Matching a shape rather than a vocabulary is what lets an unfamiliar
// vendor's number be recognised as one.
const PART_NUMBER = /\b[0-9A-Z]{2,6}-[0-9A-Z]{3,}(?:-[0-9A-Z]+)*\b/gi;
const ECCN = /\b(\d[A-E]\d{3}(?:\.[a-z](?:\.\d+)?)?)\b/g;
const CN_CONTROL_CODE = /\b(\d[A-E]\d{3})\b/g;

const ASKS_CLASSIFICATION = /\beccn\b|分类|管制编码|管制号|归类|classification/i;
const ASKS_MEANING = /是什么|什么意思|指的是|含义|定义|what is|means|meaning/i;
// A question that also describes a transaction is not a lookup, whatever else it
// contains: the moment a destination or a counterparty is in play, the procedure
// is the point.
const DESCRIBES_TRANSACTION = /出口到|运往|发运|销售给|卖给|客户|最终用户|代理商|经销商|中间商|目的地|是否需要许可|能否交易|ship to|export to|end user|customer|licen[cs]e required/i;

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
  return null;
}

async function classificationOfPart(parts) {
  const found = [];
  const searched = [];

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

  return { found, searched };
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

// Where the answer lives when this system does not have it. Naming the publisher
// is the difference between a dead end and a next step.
const ELSEWHERE = {
  classification_of_part: "厂商自己的出口分类页面是权威来源（例如 NVIDIA、AMD、Intel 各自的 export classification 页）；厂商未公布时，由出口商自行分类或向 BIS 申请 CCATS。",
  meaning_of_code: "美国编码见 15 CFR Part 774 Supplement No. 1；中国编码见商务部两用物项出口管制清单。"
};

export async function resolveLookup(question) {
  const subject = lookupSubject(question);
  if (!subject) return null;

  const { found, searched } = subject.kind === "classification_of_part"
    ? await classificationOfPart(subject.parts)
    : await meaningOfCode(subject.codes);

  return {
    kind: subject.kind,
    asked: subject.kind === "classification_of_part" ? subject.parts : subject.codes,
    found,
    searched,
    elsewhere: ELSEWHERE[subject.kind]
  };
}

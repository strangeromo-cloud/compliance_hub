// Access layer for the synthetic internal master data and the verified
// manufacturer classification reference.
//
// Everything under data/seed is synthetic demo data. Anything returned from
// here carries dataClass so a caller can never present it as a real
// classification or a real company record.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchParty } from "./entity-matching.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEED_DIR = join(ROOT, "data", "seed");
const REFERENCE_DIR = join(ROOT, "data", "reference");

const cache = new Map();

async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = readFile(path, "utf8").then(JSON.parse).catch(() => null);
  cache.set(path, promise);
  return promise;
}

export async function loadSeed(name) {
  return loadJson(join(SEED_DIR, `${name}.json`));
}

export async function loadManufacturerClassification() {
  return loadJson(join(REFERENCE_DIR, "manufacturer-classification.json"));
}

export async function internalMasterSummary() {
  const [products, partners, vendors, transactions, boms] = await Promise.all([
    loadSeed("products"), loadSeed("business-partners"), loadSeed("vendors"), loadSeed("transactions"), loadSeed("bom")
  ]);
  if (!products) return { available: false, reason: "Internal master data has not been generated. Run: node scripts/generate-seed.mjs" };
  return {
    available: true,
    dataClass: "synthetic",
    disclaimer: products.disclaimer,
    counts: {
      products: products.recordCount,
      billsOfMaterials: boms?.recordCount || 0,
      businessPartners: partners?.recordCount || 0,
      vendors: vendors?.recordCount || 0,
      transactions: transactions?.recordCount || 0
    }
  };
}

export async function findProducts(query) {
  const products = await loadSeed("products");
  if (!products) return [];
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return [];
  return products.records.filter((product) =>
    product.partNumber.toLowerCase().includes(needle) || needle.includes(product.partNumber.toLowerCase())
  ).slice(0, 10);
}

export async function findBom(partNumber) {
  const boms = await loadSeed("bom");
  return boms?.records.find((bom) => bom.partNumber === partNumber) || null;
}

export async function findInternalParties(name, { limit = 5 } = {}) {
  const [partners, vendors] = await Promise.all([loadSeed("business-partners"), loadSeed("vendors")]);
  const records = [...(partners?.records || []), ...(vendors?.records || [])];
  if (!records.length) return [];
  const byName = new Map(records.map((record) => [record.legalName, record]));
  // The caller needs the internal party's own identity elements to re-screen it
  // against the designation, so they are carried alongside the match summary.
  return matchParty({ name }, records, { limit }).map((match) => {
    const record = byName.get(match.entityName) || {};
    return {
      ...match,
      dataClass: "synthetic",
      partyId: record.partyId || null,
      country: record.country || null,
      registrationNumber: record.registrationNumber || null,
      address: record.address || null,
      relationshipType: record.relationshipType || null,
      redFlags: record.redFlags || [],
      scenarioRef: record.scenarioRef || null
    };
  });
}

// Resolves the published manufacturer classification values that used to be
// pasted into the model prompt as a literal string.
export async function manufacturerFactsFor(question = "") {
  const reference = await loadManufacturerClassification();
  if (!reference) return [];
  const text = String(question).toLowerCase();
  return reference.records.filter((record) =>
    [record.model, ...(record.matchTerms || [])].some((term) => term && text.includes(String(term).toLowerCase()))
  );
}

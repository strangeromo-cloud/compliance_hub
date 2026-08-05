// Who owns whom, as the sanctions bodies themselves state it.
//
// The 50 Percent Rule turns on aggregate shareholding, and the ownership step
// could only ever say "here is a parent, now go and establish the percentages
// yourself". GLEIF gives a parent chain but no percentages — it publishes none —
// so the reader was left doing the work by hand every time.
//
// This does not solve that, and it is worth being exact about why. OFAC's own
// data carries 5,047 ownership edges and not one of them has a percentage:
// `owner`, `asset`, and a role reading "Owned or Controlled By". That is not a
// gap in the feed. It is the shape of the rule — a company owned 50% or more by
// designated parties is blocked *without being listed*, so no sanctions list will
// ever contain the case the rule exists for.
//
// What it does give is the graph. Where OFAC has stated that a designated party
// owns something, that statement is now available at screening time instead of
// being a search someone had to run. A hit here is a finding; the absence of one
// is not an absence of ownership, and the step says so.
//
// The `targets.simple.csv` the other OpenSanctions sources use has no
// relationships in it at all, which is why this reads the FollowTheMoney entity
// graph instead: one JSON object per line, entities and the edges between them in
// the same stream.
//
// Licence: CC-BY-NC 4.0, the same as every other OpenSanctions source here.

import { fetchPublicFile } from "./http.js";
import { OPENSANCTIONS_ATTRIBUTION, OPENSANCTIONS_LICENCE } from "./adapters-os.js";

const GRAPH = "https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.ftm.json";

const first = (value) => (Array.isArray(value) ? value[0] : value) || null;
const all = (value) => (Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []);

// The graph is one entity per line and the edges name their ends by id, so the
// file has to be read once to learn the names before an edge can be written out.
export function parseOwnershipGraph(text) {
  const parties = new Map();
  const edges = [];

  for (const line of text.split("\n")) {
    if (!line) continue;
    let entity;
    try { entity = JSON.parse(line); } catch { continue; }

    if (entity.schema === "Ownership") { edges.push(entity); continue; }
    // A Sanction attached to a party is what makes it designated, and that is the
    // difference between "a company owns another" and "a designated party owns
    // this company", which is the only version worth reporting.
    if (entity.schema === "Sanction") {
      for (const target of all(entity.properties?.entity)) {
        const party = parties.get(target) || {};
        parties.set(target, { ...party, designated: true });
      }
      continue;
    }
    const name = first(entity.properties?.name);
    if (!name) continue;
    const held = parties.get(entity.id) || {};
    parties.set(entity.id, {
      ...held,
      name,
      schema: entity.schema,
      aliases: all(entity.properties?.alias).slice(0, 6),
      country: first(entity.properties?.country),
      registrationNumber: first(entity.properties?.registrationNumber) || first(entity.properties?.taxNumber)
    });
  }

  const records = [];
  for (const edge of edges) {
    const ownerId = first(edge.properties?.owner);
    const assetId = first(edge.properties?.asset);
    const owner = parties.get(ownerId);
    const asset = parties.get(assetId);
    // An edge whose ends are not in this dataset says nothing that can be read.
    if (!owner?.name || !asset?.name) continue;
    records.push({
      sourceId: "ofac-ownership",
      recordId: edge.id,
      // The owned company is what a reader screens, so it is the record's name.
      entityName: asset.name,
      aliases: asset.aliases || [],
      country: asset.country || null,
      registrationNumber: asset.registrationNumber || null,
      ownerName: owner.name,
      ownerCountry: owner.country || null,
      // Whether each end is itself designated. The whole point of the 50 Percent
      // Rule is a company that is not listed, so this cannot be assumed.
      ownerDesignated: Boolean(owner.designated),
      assetDesignated: Boolean(asset.designated),
      role: first(edge.properties?.role) || "Owned or Controlled By",
      // Stated by OFAC without a share, which the reader has to know before
      // relying on it for a rule that is entirely about shares.
      percentage: first(edge.properties?.percentage) || null,
      summary: first(edge.properties?.summary) || null,
      sourceUrl: `https://www.opensanctions.org/entities/${assetId}/`,
      licence: OPENSANCTIONS_LICENCE,
      commercialUseBlocked: true,
      humanReviewRequired: true
    });
  }
  return records;
}

export async function syncOfacOwnership() {
  const file = await fetchPublicFile(GRAPH, { accept: "application/json", maxBytes: 90 * 1024 * 1024, attempts: 2 });
  const records = parseOwnershipGraph(file.bytes.toString("utf8"));
  if (!records.length) {
    throw new Error("The OFAC entity graph yielded no ownership edges; the dataset shape has changed.");
  }
  const withShare = records.filter((record) => record.percentage).length;
  return {
    extension: "json",
    file: { bytes: file.bytes, finalUrl: file.finalUrl, etag: file.etag },
    records,
    // Recorded in the scope rather than left for someone to discover: a source
    // that cannot answer the question it looks like it answers has to say so
    // where the coverage page will show it.
    syncScope: `ofac_sdn_ownership_graph+${records.length}_edges+${withShare}_with_percentage`,
    sourceUpdatedAt: null
  };
}

export const OWNERSHIP_ADAPTERS = {
  "ofac-ownership": { sync: syncOfacOwnership, mode: "versioned_snapshot", credential: null, licence: OPENSANCTIONS_LICENCE, attribution: OPENSANCTIONS_ATTRIBUTION }
};

// Generates the synthetic internal master data the Compliance Hub screens against.
//
// Everything this script writes is INVENTED. The classifications, part numbers,
// ownership percentages and addresses are illustrative demo fixtures, not
// authoritative compliance data, and must never be presented as a real
// classification for a real product or company.
//
// The generator is deterministic: the same seed always produces the same files,
// so a demo can be reproduced and a diff means a real change.
//
//   node scripts/generate-seed.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEED_DIR = join(ROOT, "data", "seed");

const DISCLAIMER = "SYNTHETIC DEMO DATA. Invented parts, companies, classifications and ownership. Not authoritative compliance data.";
const GENERATED_FOR = "compliance-hub-prototype iteration 1";

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260728);
const pick = (list) => list[Math.floor(random() * list.length)];
const pickMany = (list, count) => {
  const pool = [...list];
  const chosen = [];
  while (chosen.length < count && pool.length) chosen.push(...pool.splice(Math.floor(random() * pool.length), 1));
  return chosen;
};
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const pad = (value, width) => String(value).padStart(width, "0");

// ---------------------------------------------------------------------------
// Components and BOM
// ---------------------------------------------------------------------------

const COMPONENTS = [
  { componentId: "CMP-GPU-H100-SXM", name: "GPU module, 80GB HBM3, SXM form factor", origin: "US", eccnUs: "4A090.a", cnControlCode: null, category: "gpu", unitCost: 24000, controlled: true },
  { componentId: "CMP-GPU-H100-PCIE", name: "GPU module, 80GB HBM3, PCIe form factor", origin: "US", eccnUs: "4A090.a", cnControlCode: null, category: "gpu", unitCost: 21000, controlled: true },
  { componentId: "CMP-GPU-L40", name: "GPU module, 48GB, PCIe form factor", origin: "US", eccnUs: "3A090.b", cnControlCode: null, category: "gpu", unitCost: 7000, controlled: true },
  { componentId: "CMP-CPU-SVR-64C", name: "Server CPU, 64 core", origin: "US", eccnUs: "3A991.a.1", cnControlCode: null, category: "cpu", unitCost: 4200, controlled: false },
  { componentId: "CMP-CPU-CLI-16C", name: "Client CPU, 16 core", origin: "US", eccnUs: "EAR99", cnControlCode: null, category: "cpu", unitCost: 380, controlled: false },
  { componentId: "CMP-CRYPTO-TPM", name: "Discrete TPM security controller", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, category: "crypto", unitCost: 12, controlled: true },
  { componentId: "CMP-CRYPTO-NIC", name: "Network controller with hardware IPsec offload", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, category: "crypto", unitCost: 145, controlled: true },
  { componentId: "CMP-RF-GAAS", name: "Gallium arsenide RF front-end module", origin: "CN", eccnUs: "EAR99", cnControlCode: "3C004.a", category: "rf", unitCost: 68, controlled: true },
  { componentId: "CMP-RF-GAN", name: "Gallium nitride power amplifier", origin: "CN", eccnUs: "3A001.b.2", cnControlCode: "3C004.a", category: "rf", unitCost: 210, controlled: true },
  { componentId: "CMP-TUNGSTEN-CARBIDE", name: "Tungsten carbide thermal insert", origin: "CN", eccnUs: "EAR99", cnControlCode: "1C117.d", category: "material", unitCost: 34, controlled: true },
  { componentId: "CMP-SSD-NVME", name: "NVMe SSD, self-encrypting", origin: "KR", eccnUs: "5A992.c", cnControlCode: null, category: "storage", unitCost: 190, controlled: false },
  { componentId: "CMP-DRAM", name: "DDR5 memory module", origin: "KR", eccnUs: "EAR99", cnControlCode: null, category: "memory", unitCost: 95, controlled: false },
  { componentId: "CMP-PANEL", name: "LCD panel assembly", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "display", unitCost: 82, controlled: false },
  { componentId: "CMP-BATTERY", name: "Lithium-ion battery pack", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "power", unitCost: 41, controlled: false },
  { componentId: "CMP-CHASSIS", name: "Chassis and mechanical assembly", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "mechanical", unitCost: 55, controlled: false },
  { componentId: "CMP-PSU", name: "Redundant power supply unit", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "power", unitCost: 130, controlled: false },
  { componentId: "CMP-MB-SVR", name: "Server mainboard", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "board", unitCost: 640, controlled: false },
  { componentId: "CMP-MB-CLI", name: "Client mainboard", origin: "CN", eccnUs: "EAR99", cnControlCode: null, category: "board", unitCost: 145, controlled: false },
  { componentId: "CMP-FW-SECURE", name: "Secure firmware image with full-disk encryption", origin: "US", eccnUs: "5D002.c.1", cnControlCode: null, category: "software", unitCost: 0, controlled: true },
  { componentId: "CMP-VPN-STACK", name: "IPsec/TLS VPN software stack", origin: "US", eccnUs: "5D002.c.1", cnControlCode: null, category: "software", unitCost: 0, controlled: true }
];

const SUBASSEMBLIES = [
  { componentId: "SUB-GPU-BASEBOARD", name: "8-way GPU baseboard", origin: "US", eccnUs: "4A090.a", cnControlCode: null, category: "subassembly", controlled: true, children: ["CMP-GPU-H100-SXM", "CMP-MB-SVR", "CMP-PSU"] },
  { componentId: "SUB-SECURE-IO", name: "Secure I/O daughter card", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, category: "subassembly", controlled: true, children: ["CMP-CRYPTO-NIC", "CMP-CRYPTO-TPM"] },
  { componentId: "SUB-RF-MODULE", name: "Wireless RF module", origin: "CN", eccnUs: "3A001.b.2", cnControlCode: "3C004.a", category: "subassembly", controlled: true, children: ["CMP-RF-GAAS", "CMP-RF-GAN"] }
];

const PRODUCT_LINES = [
  { code: "TP", family: "ThinkBook-class notebook", category: "notebook", count: 120, mfgSites: ["CN-HEFEI", "MX-MONTERREY"], base: ["CMP-CPU-CLI-16C", "CMP-MB-CLI", "CMP-DRAM", "CMP-PANEL", "CMP-BATTERY", "CMP-CHASSIS"] },
  { code: "TS", family: "ThinkServer-class rack server", category: "server", count: 80, mfgSites: ["CN-HEFEI", "HU-ULLO", "US-RTP"], base: ["CMP-CPU-SVR-64C", "CMP-MB-SVR", "CMP-DRAM", "CMP-SSD-NVME", "CMP-PSU", "CMP-CHASSIS"] },
  { code: "AI", family: "AI training system", category: "ai_system", count: 30, mfgSites: ["CN-HEFEI", "US-RTP"], base: ["SUB-GPU-BASEBOARD", "CMP-CPU-SVR-64C", "CMP-DRAM", "CMP-SSD-NVME"] },
  { code: "NW", family: "Network and storage appliance", category: "network_storage", count: 50, mfgSites: ["CN-SHENZHEN", "MX-MONTERREY"], base: ["SUB-SECURE-IO", "CMP-MB-SVR", "CMP-SSD-NVME", "CMP-PSU"] },
  { code: "PT", family: "Service part / spare", category: "part", count: 20, mfgSites: ["CN-SHENZHEN"], base: ["CMP-CHASSIS"] }
];

const componentIndex = new Map([...COMPONENTS, ...SUBASSEMBLIES].map((component) => [component.componentId, component]));

function expandComponents(ids, seen = new Set()) {
  const flat = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const component = componentIndex.get(id);
    if (!component) continue;
    flat.push(component);
    if (component.children) flat.push(...expandComponents(component.children, seen));
  }
  return flat;
}

// A product's declared classification is derived from its bill of materials so
// the sweep has something real to disagree with when a scenario overrides it.
function deriveClassification(components) {
  const eccns = components.map((component) => component.eccnUs).filter(Boolean);
  const rank = (eccn) => (/^4A090/.test(eccn) ? 5 : /^3A090/.test(eccn) ? 4 : /^5A002/.test(eccn) ? 3 : /^3A001/.test(eccn) ? 2 : /^5A992|^5D002/.test(eccn) ? 1 : 0);
  const eccnUs = eccns.sort((a, b) => rank(b) - rank(a))[0] || "EAR99";
  const cnControlCode = components.map((component) => component.cnControlCode).filter(Boolean)[0] || null;
  return { eccnUs, cnControlCode };
}

// De minimis is measured on CONTROLLED U.S.-origin content, so EAR99 U.S. parts
// are excluded. Using total U.S. content instead would put almost every product
// over the threshold and make the flag meaningless.
function usContentPercent(components) {
  const total = components.reduce((sum, component) => sum + (component.unitCost || 0), 0);
  const controlledUs = components
    .filter((component) => component.origin === "US" && component.eccnUs && component.eccnUs !== "EAR99")
    .reduce((sum, component) => sum + (component.unitCost || 0), 0);
  return total ? Math.round((controlledUs / total) * 1000) / 10 : 0;
}

function buildProducts() {
  const products = [];
  const boms = [];
  for (const line of PRODUCT_LINES) {
    for (let index = 1; index <= line.count; index += 1) {
      const partNumber = `${line.code}-${pad(1000 + index, 4)}-${pad(between(10, 99), 2)}`;
      const extras = pickMany(
        line.category === "notebook" ? ["CMP-CRYPTO-TPM", "CMP-VPN-STACK", "SUB-RF-MODULE", "CMP-SSD-NVME"]
          : line.category === "server" ? ["CMP-CRYPTO-TPM", "CMP-FW-SECURE", "CMP-CRYPTO-NIC", "CMP-TUNGSTEN-CARBIDE"]
          : line.category === "ai_system" ? ["CMP-CRYPTO-NIC", "CMP-FW-SECURE"]
          : line.category === "network_storage" ? ["CMP-VPN-STACK", "CMP-FW-SECURE", "CMP-RF-GAN"]
          : ["CMP-TUNGSTEN-CARBIDE", "CMP-PSU"],
        between(0, 2)
      );
      const topLevel = [...line.base, ...extras];
      const flat = expandComponents(topLevel);
      const classification = deriveClassification(flat);
      const mfgSite = pick(line.mfgSites);
      products.push({
        partNumber,
        dataClass: "synthetic",
        description: `${line.family} configuration ${index}`,
        productLine: line.code,
        category: line.category,
        originCountry: mfgSite.slice(0, 2),
        manufacturingSite: mfgSite,
        eccnUs: classification.eccnUs,
        cnControlCode: classification.cnControlCode,
        htsCode: pick(["8471300000", "8471410000", "8471500090", "8517620090", "8473301100"]),
        encryption: flat.some((component) => component.category === "crypto" || /^5[AD]002/.test(component.eccnUs || ""))
          ? { present: true, type: pick(["AES-256 full disk", "IPsec/TLS offload", "TPM 2.0 key storage"]), encEligibilityAssessed: false }
          : { present: false, type: null, encEligibilityAssessed: false },
        usContentPercent: usContentPercent(flat),
        tppPerGpu: null,
        classificationSource: "internal_synthetic_derivation",
        classificationDate: "2026-06-30",
        classificationConfidence: "unverified_demo_value",
        bomId: `BOM-${partNumber}`
      });
      boms.push({
        bomId: `BOM-${partNumber}`,
        partNumber,
        dataClass: "synthetic",
        levels: topLevel.map((id) => {
          const component = componentIndex.get(id);
          return {
            level: 1,
            componentId: id,
            name: component.name,
            origin: component.origin,
            eccnUs: component.eccnUs,
            cnControlCode: component.cnControlCode,
            children: (component.children || []).map((childId) => {
              const child = componentIndex.get(childId);
              return { level: 2, componentId: childId, name: child.name, origin: child.origin, eccnUs: child.eccnUs, cnControlCode: child.cnControlCode };
            })
          };
        })
      });
    }
  }
  return { products, boms };
}

// ---------------------------------------------------------------------------
// Business partners and vendors
// ---------------------------------------------------------------------------

const BP_PREFIXES = ["Northwind", "Meridian", "Blue Harbour", "Cedar Point", "Kestrel", "Arcadia", "Silverline", "Ironbridge", "Vantage", "Fairmont", "Lakeside", "Redwood", "Sentinel", "Aurora", "Copperfield", "Highfield", "Westgate", "Orchard", "Pinnacle", "Clearwater"];
const BP_MIDDLES = ["Technology", "Digital", "Systems", "Computing", "Data", "Networks", "Electronics", "Industrial", "Trading", "Solutions"];
const BP_SUFFIXES = { US: "Inc.", CN: "Co., Ltd.", DE: "GmbH", SG: "Pte. Ltd.", MX: "S.A. de C.V.", IN: "Pvt. Ltd.", JP: "K.K.", NL: "B.V." };
const BP_COUNTRIES = ["US", "CN", "DE", "SG", "MX", "IN", "JP", "NL"];
const BP_CITIES = { US: "Austin, TX", CN: "深圳市", DE: "Stuttgart", SG: "Singapore", MX: "Monterrey", IN: "Bengaluru", JP: "Yokohama", NL: "Eindhoven" };

function registrationNumber(country, index) {
  if (country === "CN") return `91440300${pad(index, 6)}XKA`;
  if (country === "US") return `UEI-${pad(index, 6)}K7`;
  if (country === "DE") return `HRB ${pad(index, 6)}`;
  return `${country}-REG-${pad(index, 6)}`;
}

function buildPartners(kind, count, startIndex) {
  const partners = [];
  for (let index = 1; index <= count; index += 1) {
    const country = pick(BP_COUNTRIES);
    const legalName = `${pick(BP_PREFIXES)} ${pick(BP_MIDDLES)} ${BP_SUFFIXES[country]}`;
    const serial = startIndex + index;
    partners.push({
      partyId: `${kind === "vendor" ? "VND" : "BP"}-${pad(serial, 5)}`,
      dataClass: "synthetic",
      partyKind: kind,
      legalName,
      aliases: random() < 0.25 ? [legalName.replace(/ (Inc\.|Co\., Ltd\.|GmbH|Pte\. Ltd\.|S\.A\. de C\.V\.|Pvt\. Ltd\.|K\.K\.|B\.V\.)$/, "")] : [],
      country,
      address: `${between(1, 900)} ${pick(["Industrial Park", "Technology Road", "Commerce Avenue", "Export Zone"])}, ${BP_CITIES[country]}`,
      registrationNumber: registrationNumber(country, serial),
      lei: random() < 0.3 ? `5493${pad(between(0, 999999999999999), 15)}` : null,
      relationshipType: kind === "vendor"
        ? pick(["component_supplier", "odm", "logistics", "professional_services"])
        : pick(["direct_customer", "channel_partner", "distributor", "end_user"]),
      parents: [],
      onboardedOn: `202${between(3, 6)}-${pad(between(1, 12), 2)}-${pad(between(1, 28), 2)}`,
      lastScreenedOn: random() < 0.7 ? `2026-${pad(between(1, 7), 2)}-${pad(between(1, 28), 2)}` : null,
      redFlags: []
    });
  }
  return partners;
}

// ---------------------------------------------------------------------------
// Scenario fixtures — each maps to a case in TEST_SCENARIOS.md
// ---------------------------------------------------------------------------

function scenarioPartners() {
  return [
    {
      partyId: "BP-90001", dataClass: "synthetic", partyKind: "customer", scenarioRef: "T03",
      legalName: "Aveox Technologies (Shenzhen) Co., Ltd.",
      aliases: ["Aveox Shenzhen", "AVEOX TECH"],
      country: "CN", address: "88 Technology Road, 深圳市", registrationNumber: "91440300778812XKA", lei: null,
      relationshipType: "direct_customer", parents: [], onboardedOn: "2025-03-14", lastScreenedOn: "2026-05-02",
      // Deliberately near-matches a real designated name on a different continent
      // with a different registration number: the false-positive drill.
      redFlags: ["name_similar_to_designated_entity_different_country_and_registration"],
      screeningNote: "Expected outcome: potential match on name only; identity elements should clear it."
    },
    {
      partyId: "BP-90002", dataClass: "synthetic", partyKind: "customer", scenarioRef: "T03-positive",
      legalName: "Red Cat Holdings, Inc.",
      aliases: ["Red Cat"],
      country: "US", address: "2800 S West Temple St., South Salt Lake, UT, USA", registrationNumber: "UEI-778812K7", lei: null,
      relationshipType: "direct_customer", parents: [], onboardedOn: "2024-11-02", lastScreenedOn: "2026-01-10",
      redFlags: ["name_and_address_align_with_designated_entity"],
      screeningNote: "Expected outcome: strong match against an ingested official designation; must be escalated."
    },
    {
      partyId: "BP-90003", dataClass: "synthetic", partyKind: "customer", scenarioRef: "T02",
      legalName: "Meridian Data Systems Pte. Ltd.", aliases: [], country: "SG",
      address: "12 Export Zone, Singapore", registrationNumber: "SG-REG-441209", lei: "549300MERIDIAN00012",
      relationshipType: "direct_customer",
      parents: [
        { legalName: "Kestrel Holdings Ltd.", country: "RU", ownershipPercent: 30, sanctionsStatus: "listed_sdn_synthetic" },
        { legalName: "Ironbridge Capital LLC", country: "RU", ownershipPercent: 25, sanctionsStatus: "listed_sdn_synthetic" }
      ],
      onboardedOn: "2026-02-20", lastScreenedOn: null,
      redFlags: ["aggregate_indirect_ownership_55_percent_by_two_listed_parties"],
      screeningNote: "Expected outcome: OFAC 50 Percent Rule aggregation, not two separate sub-threshold holdings."
    },
    {
      partyId: "BP-90004", dataClass: "synthetic", partyKind: "channel_partner", scenarioRef: "X01",
      legalName: "Vantage Trading S.A. de C.V.", aliases: [], country: "MX",
      address: "410 Commerce Avenue, Monterrey", registrationNumber: "MX-REG-330187", lei: null,
      relationshipType: "distributor",
      parents: [{ legalName: "Clearwater Computing Co., Ltd.", country: "CN", ownershipPercent: 100, sanctionsStatus: "not_listed" }],
      onboardedOn: "2026-01-08", lastScreenedOn: null,
      redFlags: ["distributor_parent_in_destination_of_concern", "ultimate_consignee_undisclosed"],
      screeningNote: "Expected outcome: diversion risk on an AI system routed through a third country."
    },
    {
      partyId: "BP-90005", dataClass: "synthetic", partyKind: "consultant", scenarioRef: "D01",
      legalName: "Silverline Advisory Ltd.", aliases: [], country: "VG",
      address: "PO Box 3321, Road Town, Tortola, British Virgin Islands", registrationNumber: "VG-REG-880114", lei: null,
      relationshipType: "professional_services",
      parents: [], onboardedOn: "2026-06-18", lastScreenedOn: null,
      redFlags: ["success_fee_15_percent", "payment_to_offshore_account", "ubo_not_disclosed", "no_defined_deliverables"],
      screeningNote: "Expected outcome: business-rationale and fee-benchmark questions, not an automatic corruption finding."
    },
    {
      partyId: "BP-90006", dataClass: "synthetic", partyKind: "channel_partner", scenarioRef: "D02",
      legalName: "Orchard Networks Pte. Ltd.", aliases: [], country: "SG",
      address: "Level 12, 9 Commerce Avenue, Singapore", registrationNumber: "SG-REG-771044", lei: null,
      relationshipType: "distributor",
      parents: [], onboardedOn: "2026-05-30", lastScreenedOn: null,
      redFlags: ["shared_office_address", "no_employee_information", "ubo_disclosure_refused"],
      screeningNote: "Expected outcome: red flags requiring evidence, not a shell-company determination."
    },
    {
      partyId: "BP-90007", dataClass: "synthetic", partyKind: "consultant", scenarioRef: "D03",
      legalName: "Highfield Public Affairs Pvt. Ltd.", aliases: [], country: "IN",
      address: "220 Technology Road, Bengaluru", registrationNumber: "IN-REG-661209", lei: null,
      relationshipType: "professional_services",
      parents: [], onboardedOn: "2026-07-01", lastScreenedOn: null,
      redFlags: ["guarantees_government_tender_outcome", "payment_to_personal_account", "pep_relationship_declared"],
      screeningNote: "Expected outcome: PEP and anti-bribery review with performance evidence requirements."
    },
    {
      partyId: "BP-90008", dataClass: "synthetic", partyKind: "customer", scenarioRef: "X02",
      legalName: "Westgate Logistics Pte. Ltd.", aliases: ["Westgate Freight"], country: "SG",
      address: "5 Export Zone, Singapore", registrationNumber: "SG-REG-990233", lei: null,
      relationshipType: "end_user",
      parents: [], onboardedOn: "2026-07-12", lastScreenedOn: null,
      redFlags: ["reappeared_after_rejected_order", "consignee_changed_to_freight_forwarder", "payment_from_unrelated_third_party"],
      screeningNote: "Expected outcome: treat as one circumvention pattern, not as a fresh order."
    }
  ];
}

function scenarioVendors() {
  return [
    {
      partyId: "VND-90001", dataClass: "synthetic", partyKind: "vendor", scenarioRef: "X03",
      legalName: "Copperfield Industrial Co., Ltd.", aliases: [], country: "CN",
      address: "77 Industrial Park, 深圳市", registrationNumber: "91440300551277XKA", lei: null,
      relationshipType: "component_supplier",
      parents: [], onboardedOn: "2026-06-05", lastScreenedOn: null,
      suppliedComponents: ["CMP-CRYPTO-NIC", "CMP-RF-GAN"],
      paymentAccount: { accountName: "Copperfield Trading HK Ltd.", country: "HK", matchesContractingEntity: false },
      redFlags: ["payment_account_differs_from_contracting_entity", "supplies_us_origin_crypto_and_cn_dual_use_parts"],
      screeningNote: "Expected outcome: BOM classification, party screening and account-relationship checks together."
    }
  ];
}

function scenarioProducts() {
  return [
    {
      partNumber: "AI-8100-H1", dataClass: "synthetic", scenarioRef: "P01/X01",
      description: "AI training system, 8x SXM GPU baseboard", productLine: "AI", category: "ai_system",
      originCountry: "US", manufacturingSite: "US-RTP",
      eccnUs: "4A090.a", cnControlCode: null, htsCode: "8471500090",
      encryption: { present: true, type: "IPsec/TLS offload", encEligibilityAssessed: false },
      usContentPercent: 88.4, tppPerGpu: null,
      classificationSource: "internal_synthetic_derivation", classificationDate: "2026-06-30",
      classificationConfidence: "unverified_demo_value", bomId: "BOM-AI-8100-H1",
      redFlags: ["advanced_computing_item", "transit_through_third_country_requested"]
    },
    {
      partNumber: "NW-4400-VPN", dataClass: "synthetic", scenarioRef: "P02",
      description: "Network security appliance with IPsec VPN and AES-256", productLine: "NW", category: "network_storage",
      originCountry: "US", manufacturingSite: "US-RTP",
      eccnUs: "5A002.a.1", cnControlCode: null, htsCode: "8517620090",
      encryption: { present: true, type: "AES-256 full disk", encEligibilityAssessed: false },
      usContentPercent: 71.2, tppPerGpu: null,
      classificationSource: "internal_synthetic_derivation", classificationDate: "2026-06-30",
      classificationConfidence: "unverified_demo_value", bomId: "BOM-NW-4400-VPN",
      redFlags: ["encryption_classification_and_exception_eligibility_not_assessed"]
    },
    {
      partNumber: "PT-7700-GA", dataClass: "synthetic", scenarioRef: "P03",
      description: "Gallium-based RF power amplifier module, service spare", productLine: "PT", category: "part",
      originCountry: "CN", manufacturingSite: "CN-SHENZHEN",
      eccnUs: "3A001.b.2", cnControlCode: "3C004.a", htsCode: "8473301100",
      encryption: { present: false, type: null, encEligibilityAssessed: false },
      usContentPercent: 4.1, tppPerGpu: null,
      classificationSource: "internal_synthetic_derivation", classificationDate: "2026-06-30",
      classificationConfidence: "unverified_demo_value", bomId: "BOM-PT-7700-GA",
      redFlags: ["prc_dual_use_item_exported_from_china"]
    },
    {
      partNumber: "TS-6200-DM", dataClass: "synthetic", scenarioRef: "DM01",
      description: "Rack server manufactured in China with US-origin content", productLine: "TS", category: "server",
      originCountry: "CN", manufacturingSite: "CN-HEFEI",
      eccnUs: "5A002.a.1", cnControlCode: null, htsCode: "8471500090",
      encryption: { present: true, type: "TPM 2.0 key storage", encEligibilityAssessed: false },
      // The whole point of this fixture: US content sits above the 25% threshold
      // that commonly applies, so Part 734 has to be reached before Part 774.
      usContentPercent: 28.0, tppPerGpu: null,
      classificationSource: "internal_synthetic_derivation", classificationDate: "2026-06-30",
      classificationConfidence: "unverified_demo_value", bomId: "BOM-TS-6200-DM",
      redFlags: ["de_minimis_calculation_required", "foreign_direct_product_rule_screening_required"]
    }
  ];
}

function scenarioBoms() {
  return [
    { bomId: "BOM-AI-8100-H1", partNumber: "AI-8100-H1", dataClass: "synthetic", levels: [
      { level: 1, componentId: "SUB-GPU-BASEBOARD", name: "8-way GPU baseboard", origin: "US", eccnUs: "4A090.a", cnControlCode: null, children: [
        { level: 2, componentId: "CMP-GPU-H100-SXM", name: "GPU module, 80GB HBM3, SXM form factor", origin: "US", eccnUs: "4A090.a", cnControlCode: null },
        { level: 2, componentId: "CMP-MB-SVR", name: "Server mainboard", origin: "CN", eccnUs: "EAR99", cnControlCode: null },
        { level: 2, componentId: "CMP-PSU", name: "Redundant power supply unit", origin: "CN", eccnUs: "EAR99", cnControlCode: null }
      ] },
      { level: 1, componentId: "CMP-CRYPTO-NIC", name: "Network controller with hardware IPsec offload", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, children: [] }
    ] },
    { bomId: "BOM-NW-4400-VPN", partNumber: "NW-4400-VPN", dataClass: "synthetic", levels: [
      { level: 1, componentId: "SUB-SECURE-IO", name: "Secure I/O daughter card", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, children: [
        { level: 2, componentId: "CMP-CRYPTO-NIC", name: "Network controller with hardware IPsec offload", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null },
        { level: 2, componentId: "CMP-CRYPTO-TPM", name: "Discrete TPM security controller", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null }
      ] },
      { level: 1, componentId: "CMP-VPN-STACK", name: "IPsec/TLS VPN software stack", origin: "US", eccnUs: "5D002.c.1", cnControlCode: null, children: [] }
    ] },
    { bomId: "BOM-PT-7700-GA", partNumber: "PT-7700-GA", dataClass: "synthetic", levels: [
      { level: 1, componentId: "SUB-RF-MODULE", name: "Wireless RF module", origin: "CN", eccnUs: "3A001.b.2", cnControlCode: "3C004.a", children: [
        { level: 2, componentId: "CMP-RF-GAAS", name: "Gallium arsenide RF front-end module", origin: "CN", eccnUs: "EAR99", cnControlCode: "3C004.a" },
        { level: 2, componentId: "CMP-RF-GAN", name: "Gallium nitride power amplifier", origin: "CN", eccnUs: "3A001.b.2", cnControlCode: "3C004.a" }
      ] }
    ] },
    { bomId: "BOM-TS-6200-DM", partNumber: "TS-6200-DM", dataClass: "synthetic", levels: [
      { level: 1, componentId: "CMP-CRYPTO-TPM", name: "Discrete TPM security controller", origin: "US", eccnUs: "5A002.a.1", cnControlCode: null, children: [] },
      { level: 1, componentId: "CMP-CPU-SVR-64C", name: "Server CPU, 64 core", origin: "US", eccnUs: "3A991.a.1", cnControlCode: null, children: [] },
      { level: 1, componentId: "CMP-MB-SVR", name: "Server mainboard", origin: "CN", eccnUs: "EAR99", cnControlCode: null, children: [] },
      { level: 1, componentId: "CMP-TUNGSTEN-CARBIDE", name: "Tungsten carbide thermal insert", origin: "CN", eccnUs: "EAR99", cnControlCode: "1C117.d", children: [] }
    ] }
  ];
}

function scenarioTransactions() {
  return [
    {
      documentId: "SO-90001", dataClass: "synthetic", scenarioRef: "P01", documentType: "SO", createdAt: "2026-07-02",
      partNumbers: ["AI-8100-H1"], quantity: 4, valueUsd: 1_480_000,
      shipFrom: "US-RTP", transitCountries: ["CA"], shipTo: "MX",
      soldTo: "BP-90004", consignee: "BP-90004", endUser: null, endUse: null,
      payerParty: "BP-90004", payerCountry: "MX", incoterm: "DAP",
      redFlags: ["ultimate_end_user_not_stated", "transit_route_declared_late"]
    },
    {
      documentId: "SO-90002", dataClass: "synthetic", scenarioRef: "X01", documentType: "SO", createdAt: "2026-07-10",
      partNumbers: ["AI-8100-H1"], quantity: 8, valueUsd: 2_960_000,
      shipFrom: "US-RTP", transitCountries: ["MX"], shipTo: "CN",
      soldTo: "BP-90004", consignee: "BP-90004", endUser: "Clearwater Computing Co., Ltd.", endUse: "AI model training",
      payerParty: "BP-90004", payerCountry: "MX", incoterm: "DAP",
      redFlags: ["distributor_resells_to_destination_of_concern", "advanced_computing_item_to_country_group_d"]
    },
    {
      documentId: "SO-90003", dataClass: "synthetic", scenarioRef: "X02", documentType: "SO", createdAt: "2026-07-18",
      partNumbers: ["NW-4400-VPN"], quantity: 40, valueUsd: 310_000,
      shipFrom: "US-RTP", transitCountries: [], shipTo: "SG",
      soldTo: "BP-90008", consignee: "Westgate Freight (forwarder)", endUser: null, endUse: null,
      payerParty: "Northwind Trading Pte. Ltd.", payerCountry: "SG", incoterm: "FCA",
      previousDocumentId: "SO-88817", previousDocumentOutcome: "rejected_by_compliance",
      redFlags: ["order_resubmitted_after_rejection", "consignee_is_freight_forwarder", "third_party_payer"]
    },
    {
      documentId: "SO-90004", dataClass: "synthetic", scenarioRef: "P03", documentType: "SO", createdAt: "2026-06-28",
      partNumbers: ["PT-7700-GA"], quantity: 500, valueUsd: 128_000,
      shipFrom: "CN-SHENZHEN", transitCountries: [], shipTo: "DE",
      soldTo: "BP-00042", consignee: "BP-00042", endUser: "BP-00042", endUse: "telecom base station repair",
      payerParty: "BP-00042", payerCountry: "DE", incoterm: "FOB",
      redFlags: ["prc_dual_use_export_licence_check_required"]
    },
    {
      documentId: "SO-90005", dataClass: "synthetic", scenarioRef: "DM01", documentType: "SO", createdAt: "2026-07-05",
      partNumbers: ["TS-6200-DM"], quantity: 120, valueUsd: 1_020_000,
      shipFrom: "CN-HEFEI", transitCountries: [], shipTo: "IN",
      soldTo: "BP-00117", consignee: "BP-00117", endUser: "BP-00117", endUse: "enterprise data centre",
      payerParty: "BP-00117", payerCountry: "IN", incoterm: "CIF",
      redFlags: ["us_content_above_de_minimis_threshold_requires_ear_scope_analysis"]
    },
    {
      documentId: "PO-90006", dataClass: "synthetic", scenarioRef: "X03", documentType: "PO", createdAt: "2026-07-14",
      partNumbers: ["NW-4400-VPN"], quantity: 0, valueUsd: 640_000,
      shipFrom: "CN-SHENZHEN", transitCountries: [], shipTo: "CN-HEFEI",
      soldTo: null, consignee: "CN-HEFEI", endUser: null, endUse: "component supply",
      vendorId: "VND-90001", payerParty: "Copperfield Trading HK Ltd.", payerCountry: "HK", incoterm: "DDP",
      redFlags: ["payment_account_differs_from_contracting_entity", "supplier_bom_contains_controlled_parts"]
    },
    {
      documentId: "SO-90007", dataClass: "synthetic", scenarioRef: "T02", documentType: "SO", createdAt: "2026-07-20",
      partNumbers: ["TS-6200-DM"], quantity: 20, valueUsd: 170_000,
      shipFrom: "CN-HEFEI", transitCountries: [], shipTo: "SG",
      soldTo: "BP-90003", consignee: "BP-90003", endUser: "BP-90003", endUse: "hosting services",
      payerParty: "BP-90003", payerCountry: "SG", incoterm: "CIF",
      redFlags: ["counterparty_ownership_aggregation_pending"]
    },
    {
      documentId: "SO-90008", dataClass: "synthetic", scenarioRef: "T03", documentType: "SO", createdAt: "2026-07-22",
      partNumbers: ["TS-6200-DM"], quantity: 6, valueUsd: 51_000,
      shipFrom: "CN-HEFEI", transitCountries: [], shipTo: "CN",
      soldTo: "BP-90001", consignee: "BP-90001", endUser: "BP-90001", endUse: "internal IT",
      payerParty: "BP-90001", payerCountry: "CN", incoterm: "EXW",
      redFlags: ["counterparty_name_resembles_designated_entity"]
    }
  ];
}

function buildRoutineTransactions(products, partners, count) {
  const routes = [
    { shipFrom: "CN-HEFEI", shipTo: "DE", transit: [] },
    { shipFrom: "CN-HEFEI", shipTo: "JP", transit: [] },
    { shipFrom: "US-RTP", shipTo: "NL", transit: [] },
    { shipFrom: "MX-MONTERREY", shipTo: "US", transit: [] },
    { shipFrom: "CN-SHENZHEN", shipTo: "SG", transit: [] },
    { shipFrom: "HU-ULLO", shipTo: "IN", transit: [] }
  ];
  const buyers = partners.filter((partner) => partner.partyKind !== "vendor");
  return Array.from({ length: count }, (_, index) => {
    const route = pick(routes);
    const buyer = pick(buyers);
    const product = pick(products);
    return {
      documentId: `SO-${pad(80001 + index, 5)}`,
      dataClass: "synthetic",
      documentType: "SO",
      createdAt: `2026-0${between(4, 7)}-${pad(between(1, 28), 2)}`,
      partNumbers: [product.partNumber],
      quantity: between(1, 250),
      valueUsd: between(5_000, 900_000),
      shipFrom: route.shipFrom,
      transitCountries: route.transit,
      shipTo: route.shipTo,
      soldTo: buyer.partyId,
      consignee: buyer.partyId,
      endUser: buyer.partyId,
      endUse: pick(["enterprise IT refresh", "data centre expansion", "retail resale", "managed service delivery"]),
      payerParty: buyer.partyId,
      payerCountry: buyer.country,
      incoterm: pick(["DAP", "CIF", "FOB", "EXW", "FCA"]),
      redFlags: []
    };
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const { products, boms } = buildProducts();
  const allProducts = [...products, ...scenarioProducts()];
  const allBoms = [...boms, ...scenarioBoms()];

  const partners = [...buildPartners("customer", 192, 0), ...scenarioPartners()];
  const vendors = [...buildPartners("vendor", 49, 500), ...scenarioVendors()];
  const transactions = [...buildRoutineTransactions(allProducts, partners, 18), ...scenarioTransactions()];

  const envelope = (recordType, records) => ({
    dataClass: "synthetic",
    disclaimer: DISCLAIMER,
    generatedFor: GENERATED_FOR,
    generator: "scripts/generate-seed.mjs",
    seed: 20260728,
    recordType,
    recordCount: records.length,
    records
  });

  await mkdir(SEED_DIR, { recursive: true });
  const files = [
    ["products.json", envelope("product_master", allProducts)],
    ["bom.json", envelope("bill_of_materials", allBoms)],
    ["business-partners.json", envelope("business_partner_master", partners)],
    ["vendors.json", envelope("vendor_master", vendors)],
    ["transactions.json", envelope("transaction", transactions)]
  ];
  for (const [name, payload] of files) {
    await writeFile(join(SEED_DIR, name), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`${name.padEnd(24)} ${String(payload.recordCount).padStart(4)} records`);
  }
  console.log(`\nWritten to data/seed/. ${DISCLAIMER}`);
}

await main();

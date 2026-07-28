const checkedAt = "2026-07-28";

export const DATA_SOURCE_REGISTRY = [
  {
    sourceId: "trade-csl", sourceName: "U.S. Consolidated Screening List", module: "trade", country: "US", authority: "U.S. International Trade Administration",
    sourceType: "restricted_party_list", officialSource: true, accessMethod: "API + downloadable files", fileFormat: "JSON / CSV",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "query_context", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "As published", websiteUrl: "https://www.trade.gov/consolidated-screening-list", apiUrl: "https://developer.trade.gov/consolidated-screening-list.html",
    dataCaptured: ["authority", "title", "official URL", "live page excerpt", "retrieval time"], targetData: ["names", "aliases", "addresses", "source list", "restriction terms"],
    webSearchUse: "supplement_only", notes: "Use the API/download for screening. Web search can locate Federal Register context but must not decide a match."
  },
  {
    sourceId: "ofac-sls", sourceName: "OFAC Sanctions List Service", module: "trade", country: "US", authority: "U.S. Treasury OFAC",
    sourceType: "sanctions_list", officialSource: true, accessMethod: "Download service", fileFormat: "Advanced XML / XML / CSV",
    automationStatus: "download_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "As published + delta archives", websiteUrl: "https://ofac.treasury.gov/sanctions-list-service", downloadUrl: "https://ofac.treasury.gov/sanctions-list-service",
    dataCaptured: [], targetData: ["SDN", "Non-SDN", "aliases", "addresses", "programs", "IDs", "vessels", "aircraft"],
    webSearchUse: "not_for_screening", notes: "Structured files are suitable for automation. Ownership data is not sufficient for an automated 50 Percent Rule conclusion."
  },
  {
    sourceId: "un-consolidated", sourceName: "UN Security Council Consolidated List", module: "trade", country: "Global", authority: "United Nations Security Council",
    sourceType: "sanctions_list", officialSource: true, accessMethod: "Download", fileFormat: "XML / HTML / PDF",
    automationStatus: "download_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "On list change", websiteUrl: "https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list",
    dataCaptured: [], targetData: ["permanent reference number", "names", "original script", "aliases", "addresses", "listed date", "committee"],
    webSearchUse: "supplement_only", notes: "XML is the preferred ingestion format; committee pages provide the legal measure and narrative context."
  },
  {
    sourceId: "uk-sanctions", sourceName: "UK Sanctions List", module: "trade", country: "UK", authority: "UK Foreign, Commonwealth & Development Office",
    sourceType: "sanctions_list", officialSource: true, accessMethod: "Download", fileFormat: "CSV / XML / ODS / HTML / PDF / TXT",
    automationStatus: "download_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "On list change", websiteUrl: "https://www.gov.uk/government/publications/the-uk-sanctions-list", downloadUrl: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv",
    dataCaptured: [], targetData: ["designations", "aliases", "addresses", "regimes", "measures", "designation dates"],
    webSearchUse: "supplement_only", notes: "Since 28 January 2026 this is the sole current UK designation source; the former OFSI consolidated list is archival."
  },
  {
    sourceId: "sam-exclusions", sourceName: "SAM.gov Exclusions", module: "trade", country: "US", authority: "U.S. General Services Administration",
    sourceType: "procurement_exclusion", officialSource: true, accessMethod: "REST API + extract", fileFormat: "JSON / CSV",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 2, authenticationRequired: true, captchaPresent: false,
    updateFrequency: "API current data / extract schedule", websiteUrl: "https://sam.gov/content/exclusions", apiUrl: "https://api.sam.gov/entity-information/v4/exclusions",
    dataCaptured: [], targetData: ["exclusion name", "classification", "program", "agency", "address", "UEI", "active status"],
    webSearchUse: "not_for_screening", notes: "Requires a free SAM.gov API key; unaffiliated personal keys may be limited to 10 requests/day."
  },
  {
    sourceId: "bis-ear", sourceName: "Export Administration Regulations", module: "product", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "regulation", officialSource: true, accessMethod: "eCFR API + BIS HTML/PDF", fileFormat: "XML / HTML / PDF",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "query_context", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check + Federal Register events", websiteUrl: "https://www.bis.gov/regulations/ear", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: ["selected BIS guidance and part pages", "live excerpt", "retrieval time"], targetData: ["part", "section", "paragraph", "effective date", "amendment lineage", "historical version"],
    webSearchUse: "good_for_discovery", notes: "Web search is useful for finding the relevant rule; license logic must use versioned regulatory text and transaction date."
  },
  {
    sourceId: "bis-ear-734", sourceName: "EAR Part 734 — Scope, de minimis and Foreign Direct Product Rules", module: "product", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "regulation", officialSource: true, accessMethod: "eCFR API", fileFormat: "XML",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check", websiteUrl: "https://www.bis.gov/regulations/ear/734", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: [], targetData: ["subject to the EAR", "de minimis thresholds", "foreign direct product rules", "published information exclusions", "effective date"],
    webSearchUse: "good_for_discovery", notes: "Entry point for China-manufactured products carrying U.S.-origin content or built with U.S. technology. A de minimis or FDP conclusion requires the actual U.S.-content calculation, not the regulation text alone."
  },
  {
    sourceId: "bis-ear-740", sourceName: "EAR Part 740 — License Exceptions", module: "product", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "regulation", officialSource: true, accessMethod: "eCFR API", fileFormat: "XML",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check", websiteUrl: "https://www.bis.gov/regulations/ear/740", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: [], targetData: ["exception symbol", "eligibility conditions", "country scope", "restrictions", "reporting obligations", "effective date"],
    webSearchUse: "good_for_discovery", notes: "Without Part 740 the system can only say that a license is required; eligibility for ENC, LVS, TSR or GBS still needs transaction facts."
  },
  {
    sourceId: "bis-ear-744", sourceName: "EAR Part 744 and Entity List (Supplement No. 4)", module: "trade", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "regulation", officialSource: true, accessMethod: "eCFR API", fileFormat: "XML",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check", websiteUrl: "https://www.bis.gov/entity-list", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: [], targetData: ["end-user and end-use prohibitions", "Entity List entries", "license requirements", "license review policy", "footnote designations"],
    webSearchUse: "good_for_discovery", notes: "The consolidated screening list omits the Part 744 license policy and the footnotes that trigger the Entity List FDP rules; this source carries the regulatory text."
  },
  {
    sourceId: "china-licence-catalogue", sourceName: "Catalogue of Import and Export Licence Administration for Dual-Use Items and Technologies", module: "product", country: "CN", authority: "MOFCOM / General Administration of Customs",
    sourceType: "license_matrix", officialSource: true, accessMethod: "Official announcement API + attachments", fileFormat: "JSON / HTML / PDF",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Annual edition + adjustment notices", websiteUrl: "https://exportcontrol.mofcom.gov.cn/article/hgfw/lywxcx/gzqd/202601/1203.html",
    dataCaptured: [], targetData: ["annual edition", "HS code to licence mapping", "issuing authorities", "effective date", "superseded edition"],
    webSearchUse: "good_for_discovery", notes: "The announcement and its attachment reference are ingested. The HS-to-licence table itself lives in a PDF attachment and is stored as a snapshot only; it is not parsed into rows yet."
  },
  {
    sourceId: "bis-ccl", sourceName: "Commerce Control List (EAR Part 774)", module: "product", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "control_list", officialSource: true, accessMethod: "eCFR XML + BIS rendered text", fileFormat: "XML / HTML / PDF",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "query_context", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check", websiteUrl: "https://www.bis.gov/regulations/ear/774", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: ["classification guidance page", "generic source excerpt"], targetData: ["ECCN", "heading", "items controlled", "reasons for control", "license requirements", "exceptions", "technical notes"],
    webSearchUse: "good_for_discovery", notes: "ECCN parsing is buildable, but nested tables and amendments need parser tests and version tracking."
  },
  {
    sourceId: "bis-country-chart", sourceName: "Commerce Country Chart (EAR Part 738)", module: "product", country: "US", authority: "U.S. BIS / eCFR",
    sourceType: "license_matrix", officialSource: true, accessMethod: "eCFR XML/PDF parse", fileFormat: "XML / PDF / HTML table",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily check", websiteUrl: "https://www.bis.gov/regulations/ear/738", apiUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    dataCaptured: [], targetData: ["destination", "control reason columns", "effective date", "source version"],
    webSearchUse: "not_for_screening", notes: "The matrix can be parsed, but it is only one step in license analysis and cannot produce a final answer alone."
  },
  {
    sourceId: "nvidia-export", sourceName: "NVIDIA Export Regulation Compliance", module: "product", country: "Global", authority: "NVIDIA",
    sourceType: "manufacturer_classification", officialSource: true, accessMethod: "Public dynamic table", fileFormat: "JSON-backed HTML table",
    automationStatus: "scraping_available", feasibility: "can_build_now", currentCoverage: "verified_lookup", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Weekly snapshot + on-demand", websiteUrl: "https://www.nvidia.com/en-us/about-nvidia/company-policies/export-regulations/",
    dataCaptured: ["NVIDIA part number", "TPP per GPU", "ECCN", "HTS", "description", "H100 model-specific verification"], targetData: ["all manufacturer classification rows", "source snapshot", "change history"],
    webSearchUse: "good_for_discovery", notes: "Current prototype has verified H100 PCIe/NVL/SXM5 values; full durable snapshot ingestion is not yet implemented."
  },
  {
    sourceId: "amd-export", sourceName: "AMD Regulatory Trade Compliance", module: "product", country: "Global", authority: "AMD",
    sourceType: "manufacturer_classification", officialSource: true, accessMethod: "Official downloadable lists", fileFormat: "Product list / spreadsheet or document",
    automationStatus: "download_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Weekly check", websiteUrl: "https://www.amd.com/en/legal/compliance/trade-compliance.html",
    dataCaptured: [], targetData: ["HTS", "ECCN", "Ryzen APP", "EPYC APP", "product/part mapping"],
    webSearchUse: "good_for_discovery", notes: "Official lists are linked from one manufacturer page and are suitable for snapshot/version adapters."
  },
  {
    sourceId: "china-dual-use", sourceName: "PRC Dual-Use Export Control List and Control Notices", module: "product", country: "CN", authority: "MOFCOM / China Export Control Information",
    sourceType: "control_list", officialSource: true, accessMethod: "Official column API + announcement attachments", fileFormat: "JSON / HTML / PDF",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "query_context", priority: 1, authenticationRequired: false, captchaPresent: true,
    updateFrequency: "Daily announcement monitor + annual directory", websiteUrl: "https://exportcontrol.mofcom.gov.cn/",
    apiUrl: "https://exportcontrol.mofcom.gov.cn/edi_ecms_web_front/front/column/getColumnList",
    dataCaptured: ["dual-use regulation page", "generic source excerpt"], targetData: ["control code", "Chinese item name", "technical parameters", "notes", "exclusions", "effective date"],
    webSearchUse: "good_for_discovery", notes: "The site's own column API is used; the CAPTCHA-protected query UI is not automated. Notices are parsed for control codes, HS references, effective dates and suspend/repeal relationships. The unified list itself is a PDF attachment stored as a snapshot, not parsed into item rows."
  },
  {
    sourceId: "china-control-entities", sourceName: "PRC Export Control Control List / Watch List Notices", module: "trade", country: "CN", authority: "MOFCOM Bureau of Industry Security and Import and Export Control",
    sourceType: "restricted_party_notice", officialSource: true, accessMethod: "Official column API + server-rendered announcements", fileFormat: "JSON / HTML",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily", websiteUrl: "https://aqygzj.mofcom.gov.cn/flzc/gzjgfxwj/index.html",
    apiUrl: "https://aqygzj.mofcom.gov.cn/api-gateway/jpaas-publish-server/front/page/build/unit",
    dataCaptured: [], targetData: ["Chinese/English name", "announcement", "measures", "effective date", "add/adjust/remove relationship"],
    webSearchUse: "good_for_discovery", notes: "Designated entities are parsed out of the announcement body with their Chinese name, English name, address and postcode. Announcements are not one database: supersession and de-listing links still require human QA."
  },
  {
    sourceId: "china-unreliable-entity", sourceName: "PRC Unreliable Entity List", module: "trade", country: "CN", authority: "MOFCOM",
    sourceType: "restricted_party_notice", officialSource: true, accessMethod: "Official announcement monitor", fileFormat: "JSON / HTML",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 1, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily", websiteUrl: "https://aqygzj.mofcom.gov.cn/flzc/gzjgfxwj/index.html",
    apiUrl: "https://aqygzj.mofcom.gov.cn/api-gateway/jpaas-publish-server/front/page/build/unit",
    dataCaptured: [], targetData: ["entity", "measure type", "trade/investment/entry restrictions", "status", "effective date"],
    webSearchUse: "good_for_discovery", notes: "Monitors the same official announcement feed but keeps UEL designations separate from export-control control lists and countermeasure decisions. An empty window is recorded as an empty result, not as a failure."
  },
  {
    sourceId: "china-countermeasures", sourceName: "PRC Countermeasure and Sanctions Decisions", module: "trade", country: "CN", authority: "MOFA / MOFCOM and other authorities",
    sourceType: "legal_notice", officialSource: true, accessMethod: "Multi-site announcement monitor", fileFormat: "HTML / PDF",
    automationStatus: "scraping_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 2, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Daily", websiteUrl: "https://www.fmprc.gov.cn/",
    dataCaptured: [], targetData: ["issuing authority", "legal basis", "named party", "restriction scope", "applicable activity", "effective date"],
    webSearchUse: "good_for_discovery", notes: "Search is useful for discovery, but each decision must be stored under its actual authority and legal basis."
  },
  {
    sourceId: "sec-edgar", sourceName: "SEC EDGAR", module: "tpdd", country: "US", authority: "U.S. Securities and Exchange Commission",
    sourceType: "company_filing", officialSource: true, accessMethod: "REST API + bulk ZIP + filing archives", fileFormat: "JSON / HTML / XML / ZIP",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "query_context", priority: 2, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Real time; bulk nightly", websiteUrl: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", apiUrl: "https://data.sec.gov/submissions/",
    dataCaptured: ["one NVIDIA 10-K page as query context"], targetData: ["CIK", "filing history", "annual reports", "subsidiaries", "ownership filings", "risk disclosures"],
    webSearchUse: "good_for_discovery", notes: "No API key is required; automated access must use an identified user agent and observe SEC access policy."
  },
  {
    sourceId: "companies-house", sourceName: "UK Companies House", module: "tpdd", country: "UK", authority: "Companies House",
    sourceType: "company_registry", officialSource: true, accessMethod: "REST API", fileFormat: "JSON",
    automationStatus: "api_available", feasibility: "can_build_with_limitations", currentCoverage: "planned", priority: 2, authenticationRequired: true, captchaPresent: false,
    updateFrequency: "Live", websiteUrl: "https://developer.company-information.service.gov.uk/", apiUrl: "https://api.company-information.service.gov.uk/",
    dataCaptured: [], targetData: ["company status", "registered office", "officers", "PSC", "filings", "accounts", "charges", "insolvency"],
    webSearchUse: "supplement_only", notes: "Requires a free API key. Default rate limit is 600 requests per five minutes."
  },
  {
    sourceId: "gleif-lei", sourceName: "GLEIF LEI Data", module: "tpdd", country: "Global", authority: "Global Legal Entity Identifier Foundation",
    sourceType: "legal_entity_identifier", officialSource: true, accessMethod: "REST API + Golden Copy", fileFormat: "JSON:API / XML / CSV",
    automationStatus: "api_available", feasibility: "can_build_now", currentCoverage: "planned", priority: 2, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Golden Copy publishes multiple times daily", websiteUrl: "https://www.gleif.org/en/lei-data/gleif-api", apiUrl: "https://api.gleif.org/api/v1/lei-records",
    dataCaptured: [], targetData: ["LEI", "legal name", "addresses", "entity status", "direct parent", "ultimate parent"],
    webSearchUse: "supplement_only", notes: "Strong identifier and parent signal where LEI data exists; it is not a complete global ownership database."
  },
  {
    sourceId: "china-company-registry", sourceName: "国家企业信用信息公示系统", module: "tpdd", country: "CN", authority: "State Administration for Market Regulation",
    sourceType: "company_registry", officialSource: true, accessMethod: "Official query UI", fileFormat: "Interactive website",
    automationStatus: "manual_only", feasibility: "manual_only", currentCoverage: "manual", priority: 2, authenticationRequired: false, captchaPresent: true,
    updateFrequency: "Manual case check", websiteUrl: "https://www.gsxt.gov.cn/",
    dataCaptured: [], targetData: ["registration status", "USCC", "legal representative", "address", "business scope", "shareholders", "annual reports", "penalties"],
    webSearchUse: "not_for_screening", notes: "Do not bypass CAPTCHA or anti-bot controls. Keep an official-link workflow and manual evidence upload."
  },
  {
    sourceId: "credit-china", sourceName: "信用中国", module: "tpdd", country: "CN", authority: "National Development and Reform Commission",
    sourceType: "credit_and_penalty", officialSource: true, accessMethod: "Official query UI / published notices", fileFormat: "HTML / downloadable notices",
    automationStatus: "manual_only", feasibility: "manual_only", currentCoverage: "manual", priority: 2, authenticationRequired: false, captchaPresent: true,
    updateFrequency: "Manual case check + notice monitor", websiteUrl: "https://www.creditchina.gov.cn/",
    dataCaptured: [], targetData: ["credit record", "administrative penalties", "serious dishonesty", "source evidence"],
    webSearchUse: "good_for_discovery", notes: "Search can find public notices, but case-level official results should be captured manually unless a stable permitted interface is confirmed."
  },
  {
    sourceId: "china-enforcement", sourceName: "中国执行信息公开网", module: "tpdd", country: "CN", authority: "Supreme People's Court",
    sourceType: "court_enforcement", officialSource: true, accessMethod: "Official query UI", fileFormat: "Interactive website",
    automationStatus: "manual_only", feasibility: "manual_only", currentCoverage: "manual", priority: 2, authenticationRequired: false, captchaPresent: true,
    updateFrequency: "Manual case check", websiteUrl: "https://zxgk.court.gov.cn/",
    dataCaptured: [], targetData: ["enforcement cases", "dishonest judgment debtor records", "case number", "court"],
    webSearchUse: "not_for_screening", notes: "Manual-only unless an official stable interface and terms permit automation."
  },
  {
    sourceId: "doj-eccp", sourceName: "DOJ Evaluation of Corporate Compliance Programs", module: "tpdd", country: "US", authority: "U.S. Department of Justice",
    sourceType: "policy_guidance", officialSource: true, accessMethod: "Official document retrieval", fileFormat: "PDF / HTML",
    automationStatus: "scraping_available", feasibility: "can_build_now", currentCoverage: "query_context", priority: 3, authenticationRequired: false, captchaPresent: false,
    updateFrequency: "Monthly change check", websiteUrl: "https://www.justice.gov/criminal/criminal-fraud/page/file/937501",
    dataCaptured: ["source metadata", "live document/page retrieval", "retrieval time"], targetData: ["versioned guidance sections", "third-party diligence factors", "citation anchors"],
    webSearchUse: "good_for_discovery", notes: "Useful policy evidence for TPDD rules; not a company-level database."
  }
];

export function dataSourceCoverage() {
  const counts = DATA_SOURCE_REGISTRY.reduce((acc, source) => {
    acc.total += 1;
    acc[source.feasibility] = (acc[source.feasibility] || 0) + 1;
    acc[source.currentCoverage] = (acc[source.currentCoverage] || 0) + 1;
    return acc;
  }, { total: 0 });
  return {
    checkedAt,
    counts,
    importantDisclosure: "The data page now distinguishes implemented adapters from successful snapshots. A green sync state means a raw official-source snapshot and normalized record file were actually saved; it is not a legal clearance decision.",
    sources: DATA_SOURCE_REGISTRY
  };
}

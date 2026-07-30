export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

export function rowsToObjects(rows, headerIndex = 0) {
  const headers = rows[headerIndex] || [];
  return rows.slice(headerIndex + 1).filter((row) => row.some(Boolean)).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() || null]))
  );
}

export function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function xmlTag(xml, name) {
  const match = String(xml).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : null;
}

export function xmlTags(xml, name) {
  return [...String(xml).matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi"))].map((match) => match[1]);
}

// Like xmlTags but keeps the opening attributes, which is how an eCFR appendix
// identifies which supplement it is (N="Supplement No. 4 to Part 744").
export function xmlBlocks(xml, name) {
  return [...String(xml).matchAll(new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi"))]
    .map((match) => ({ attrs: match[1] || "", inner: match[2] }));
}

export function xmlAttr(attrs, name) {
  const match = String(attrs).match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1]) : null;
}

// Regulation XML carries §, em dashes and quotes as numeric entities. Leaving
// them encoded put literal "&#xA7;" in cited text, so every extraction decodes.
export function xmlText(fragment = "") {
  return decodeXml(String(fragment).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Table cells must keep their position, so an empty one has to be returned as an
// empty string rather than skipped. The self-closing form is matched as its own
// alternative and first: with `<TD[^>]*(?:/>|>…</TD>)` the greedy character class
// consumes the slash, the paired branch then matches the following `>` and the
// capture runs on to the NEXT cell's closing tag — silently merging two cells and
// shifting every column after it. In the Commerce Country Chart that shift moves
// an X into the wrong control reason, which changes the licence answer.
export function xmlCells(row, name = "TD") {
  const pattern = new RegExp(`<${name}\\b[^>]*\\/>|<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi");
  return [...String(row).matchAll(pattern)].map((match) => (match[1] === undefined ? "" : xmlText(match[1])));
}

export function joinName(...parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// Chinese official pages mix full-width spaces, non-breaking spaces and CRLF.
// Normalizing them once keeps the notice parsers readable.
export function normalizeChineseText(value = "") {
  return decodeXml(String(value))
    .replace(/[ 　 -​]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function stripHtml(html = "") {
  return normalizeChineseText(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\n{3,}/g, "\n\n");
}

export function htmlLinks(html = "", pattern) {
  return [...String(html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: decodeXml(match[1]), text: stripHtml(match[2]) }))
    .filter((link) => (pattern ? pattern.test(link.href) : true));
}

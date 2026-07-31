// Text extraction from PDFs, without a dependency.
//
// The Chinese control list and licence catalogues are published as PDF and
// nothing else. They carry a real text layer, so the text is there to be read —
// it just has to be decoded rather than parsed out of a page image.
//
// Only what these documents actually use is implemented: classic cross-reference
// tables (no object streams), FlateDecode, and Type0/CIDFontType2 fonts with
// Identity-H encoding. Identity-H means the bytes in a text-showing operator are
// two-byte glyph indices, not characters, so they mean nothing without the font's
// ToUnicode CMap — which is why a naive extractor returns mojibake from these
// files and why the CMap handling below is the substance of this module.
//
// A PDF whose shape falls outside that is not guessed at: extractPdfText throws,
// so an unreadable document is reported rather than silently yielding an empty
// list of controls.

import { inflateSync } from "node:zlib";

const LATIN = "latin1";

// Objects, as byte offsets into the raw file. Working in latin1 keeps byte
// positions and string indices aligned, which matters because stream lengths are
// counted in bytes.
function indexObjects(raw) {
  const text = raw.toString(LATIN);
  const objects = new Map();
  const pattern = /(\d+)\s+(\d+)\s+obj\b/g;
  let match;
  while ((match = pattern.exec(text))) {
    objects.set(Number(match[1]), { start: match.index + match[0].length, id: Number(match[1]) });
  }
  return { text, objects };
}

function objectBody(text, object) {
  const end = text.indexOf("endobj", object.start);
  return text.slice(object.start, end < 0 ? undefined : end);
}

// A stream's bytes, decompressed. /Length is often an indirect reference, so the
// end of data is found by searching for the keyword rather than trusting it.
function streamBytes(raw, text, object) {
  const body = objectBody(text, object);
  const at = body.indexOf("stream");
  if (at < 0) return null;
  const absolute = object.start + at + "stream".length;
  let from = absolute;
  if (text[from] === "\r") from += 1;
  if (text[from] === "\n") from += 1;
  const end = text.indexOf("endstream", from);
  if (end < 0) return null;
  const bytes = raw.subarray(from, end);
  if (!/\/Filter\s*\/FlateDecode/.test(body)) return bytes;
  try {
    return inflateSync(bytes);
  } catch {
    // Some producers leave a stray byte before the deflate header.
    try { return inflateSync(bytes.subarray(1)); } catch { return null; }
  }
}

// Two different readings of a hex string, and conflating them is the classic way
// to get nothing out of a PDF. In a text-showing operator the hex is BYTES, which
// Identity-H then pairs into two-byte glyph codes. In a ToUnicode map the hex is
// the UTF-16 code units the glyph stands for.
const hexToBytes = (hex) =>
  (String(hex).match(/.{2}/g) || []).map((pair) => String.fromCharCode(parseInt(pair, 16))).join("");

const hexToUnicode = (hex) =>
  (String(hex).match(/.{1,4}/g) || []).map((unit) => String.fromCharCode(parseInt(unit, 16))).join("");

// A ToUnicode CMap maps glyph codes to the characters they draw. Both forms the
// spec allows appear in these files.
function parseCMap(cmapText) {
  const map = new Map();
  for (const block of cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    for (const [, code, value] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(code, 16), hexToUnicode(value));
    }
  }
  for (const block of cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    // <lo> <hi> <start> — a run of consecutive codes.
    for (const [, lo, hi, start] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const first = parseInt(lo, 16);
      const last = parseInt(hi, 16);
      const base = parseInt(start, 16);
      for (let code = first; code <= last && code - first < 65536; code += 1) {
        map.set(code, String.fromCodePoint(base + (code - first)));
      }
    }
    // <lo> <hi> [<a> <b> …] — an explicit list.
    for (const [, lo, , list] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const first = parseInt(lo, 16);
      [...list.matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((entry, offset) => {
        map.set(first + offset, hexToUnicode(entry[1]));
      });
    }
  }
  return map;
}

// Font resource name (/F1) -> its ToUnicode map, for every font in the document.
// Page-level resource dictionaries are not resolved: these documents reuse one
// name per font throughout, and a wrong glyph would be visible immediately as
// mojibake rather than failing silently.
function fontMaps(raw, text, objects) {
  const maps = new Map();
  for (const object of objects.values()) {
    const body = objectBody(text, object);
    if (!/\/Type\s*\/Font/.test(body)) continue;
    const name = body.match(/\/BaseFont\s*\/([^\s/>\]]+)/)?.[1] || `obj${object.id}`;
    const toUnicode = body.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (toUnicode) {
      const target = objects.get(Number(toUnicode[1]));
      const bytes = target && streamBytes(raw, text, target);
      if (bytes) {
        maps.set(object.id, { name, map: parseCMap(bytes.toString(LATIN)) });
        continue;
      }
    }
    // A font with no ToUnicode is not necessarily undecodable. A simple font —
    // Type1 or TrueType with a single-byte encoding — uses the byte itself as
    // the character code, which is what AMD's classification PDF does and what
    // made this throw rather than read it. A composite font without a map is
    // genuinely undecodable and is left out.
    if (/\/Subtype\s*\/Type0/.test(body)) continue;
    maps.set(object.id, { name, map: null, simple: true });
  }
  return maps;
}

// Which font object each resource name refers to, per the document's resource
// dictionaries. One document-wide table is enough for these files.
function resourceNames(text, objects) {
  const names = new Map();
  for (const object of objects.values()) {
    const body = objectBody(text, object);
    const fontDict = body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fontDict) continue;
    for (const [, name, id] of fontDict[1].matchAll(/\/([^\s/]+)\s+(\d+)\s+\d+\s+R/g)) {
      names.set(name, Number(id));
    }
  }
  return names;
}

// WinAnsi differs from Latin-1 only over 0x80–0x9F, where it puts typographic
// punctuation. Without this a quotation mark or a dash comes out as a control
// character in the middle of a part description.
const WIN_ANSI_HIGH = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ",
  0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“",
  0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ"
};

function decodeShown(literal, font) {
  // A simple font's bytes are the character codes themselves.
  if (font && font.simple) {
    let out = "";
    for (let at = 0; at < literal.length; at += 1) {
      const code = literal.charCodeAt(at);
      out += code >= 0x80 && code <= 0x9f ? (WIN_ANSI_HIGH[code] ?? "") : String.fromCharCode(code);
    }
    return out;
  }
  let out = "";
  // Identity-H: two bytes per glyph.
  for (let at = 0; at + 1 < literal.length; at += 2) {
    const code = (literal.charCodeAt(at) << 8) | literal.charCodeAt(at + 1);
    out += font?.map?.get(code) ?? "";
  }
  return out;
}

// A literal string, with the escapes the format defines. Simple fonts are shown
// this way; only composite fonts are routinely written as hex.
function decodeLiteral(body) {
  let out = "";
  for (let at = 0; at < body.length; at += 1) {
    if (body[at] !== "\\") { out += body[at]; continue; }
    const next = body[at + 1];
    if (next === undefined) break;
    if (next >= "0" && next <= "7") {
      const octal = body.slice(at + 1, at + 4).match(/^[0-7]{1,3}/)[0];
      out += String.fromCharCode(parseInt(octal, 8));
      at += octal.length;
      continue;
    }
    const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    out += escapes[next] ?? next;
    at += 1;
  }
  return out;
}

function contentText(stream, maps, names) {
  const source = stream.toString(LATIN);
  let current = null;
  let out = "";
  // These documents place every glyph with its own positioning operator, so
  // treating each one as a line break returns the text one character per line.
  // A line break is a change in the vertical position, not the presence of a
  // move — so the Y coordinate is tracked and compared.
  let lastY = null;
  const num = "-?[\\d.]+";
  const pattern = new RegExp(
    `/([^\\s/]+)\\s+${num}\\s+Tf`                                   // font selection
    + `|<([0-9A-Fa-f\\s]*)>\\s*Tj`                                    // show a hex string
    + `|\\(((?:[^()\\\\]|\\\\[\\s\\S])*)\\)\\s*(?:Tj|')`   // show a literal string
    + `|\\[([\\s\\S]*?)\\]\\s*TJ`                               // show an array
    + `|(${num})\\s+(${num})\\s+(?:Td|TD)`                            // relative move
    + `|(?:${num}\\s+){4}(${num})\\s+(${num})\\s+Tm`                 // absolute text matrix
    + `|(T\\*|ET)`,                                                     // explicit line / end
    "g"
  );
  const breakAt = (y) => {
    if (lastY !== null && Math.abs(y - lastY) > 0.0001) out += "\n";
    lastY = y;
  };
  let match;
  while ((match = pattern.exec(source))) {
    // The whole font entry, not just its map: decoding depends on whether the
    // font is composite or simple, and a simple one has no map at all.
    if (match[1] !== undefined) { current = maps.get(names.get(match[1])) || null; continue; }
    if (match[2] !== undefined) { out += decodeShown(hexToBytes(match[2].replace(/\s+/g, "")), current); continue; }
    if (match[3] !== undefined) { out += decodeShown(decodeLiteral(match[3]), current); continue; }
    if (match[4] !== undefined) {
      for (const [, hex, literal] of match[4].matchAll(/<([0-9A-Fa-f\s]*)>|\(((?:[^()\\]|\\[\s\S])*)\)/g)) {
        if (hex !== undefined) out += decodeShown(hexToBytes(hex.replace(/\s+/g, "")), current);
        else if (literal !== undefined) out += decodeShown(decodeLiteral(literal), current);
      }
      continue;
    }
    // A relative move carries its own dy; only a non-zero one leaves the line.
    if (match[6] !== undefined) { if (Number(match[6]) !== 0) out += "\n"; continue; }
    if (match[8] !== undefined) { breakAt(Number(match[8])); continue; }
    out += "\n";
    lastY = null;
  }
  return out;
}

export function extractPdfText(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (raw.subarray(0, 5).toString(LATIN) !== "%PDF-") throw new Error("Not a PDF.");
  const { text, objects } = indexObjects(raw);
  if (!objects.size) throw new Error("PDF has no readable objects; it may use cross-reference streams.");

  const maps = fontMaps(raw, text, objects);
  if (!maps.size) throw new Error("PDF has no ToUnicode maps; its text cannot be decoded without the fonts.");
  const names = resourceNames(text, objects);

  const pages = [];
  for (const object of objects.values()) {
    const body = objectBody(text, object);
    // A content stream has no dictionary type of its own; it is identified by
    // being a stream that is not a font, image or metadata.
    if (!/\bstream\b/.test(body)) continue;
    if (/\/Type\s*\/(Font|XObject|Metadata|ObjStm)|\/Subtype\s*\/(Image|Type1C|CIDFontType0C|TrueType)/.test(body)) continue;
    const bytes = streamBytes(raw, text, object);
    if (!bytes) continue;
    const decoded = contentText(bytes, maps, names);
    if (decoded.trim()) pages.push(decoded);
  }

  const out = pages.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!out) throw new Error("PDF yielded no text; it is probably a scan.");
  return out;
}

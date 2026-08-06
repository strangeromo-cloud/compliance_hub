// Render a .mmd file to standalone SVG + PNG with headless Chrome.
//
// The hand-placed SVGs kept colliding because every box position was a number I
// chose. Mermaid runs dagre, so the layout is computed from the graph — the only
// thing left to get wrong is the graph itself.
//
// usage: node render-mermaid.mjs <in.mmd> <out-basename> [width]

import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [src, outBase, widthArg] = process.argv.slice(2);
if (!src || !outBase) throw new Error("usage: render-mermaid.mjs <in.mmd> <out-basename> [width]");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Fetched once and kept beside this script rather than committed: it is 3.5 MB
// of vendor bundle, and this whole directory is gitignored anyway. Doing it here
// is what makes the script work on a fresh checkout instead of failing with a
// missing file nobody knows where to get.
const BUNDLE = join(here, "mermaid.min.js");
if (!existsSync(BUNDLE)) {
  const url = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
  console.log(`fetching ${url}`);
  execFileSync("curl", ["-sSL", "--fail", "--max-time", "60", "-o", BUNDLE, url], { stdio: ["ignore", "ignore", "inherit"] });
}
const mermaid = readFileSync(BUNDLE, "utf8");
const graph = readFileSync(src, "utf8");
const width = Number(widthArg || 1400);

const FONT = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",-apple-system,"Segoe UI",sans-serif`;

const page = `<!doctype html><meta charset="utf-8">
<style>
  html,body { margin:0; padding:0; background:#fff; }
  #wrap { padding:24px; display:inline-block; background:#fff; }
  .mermaid { font-family:${FONT}; }
</style>
<div id="wrap"><pre class="mermaid">${graph.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre></div>
<script>${mermaid}</script>
<script>
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    fontFamily: ${JSON.stringify(FONT)},
    flowchart: { curve: "basis", nodeSpacing: 30, rankSpacing: 48, padding: 12, useMaxWidth: false, wrappingWidth: 640 },
    themeVariables: {
      fontSize: "14px",
      primaryColor: "#F1EFE8", primaryTextColor: "#2C2C2A", primaryBorderColor: "#5F5E5A",
      lineColor: "#888780", textColor: "#2C2C2A",
      clusterBkg: "#FFFFFF", clusterBorder: "#B9B6AC"
    }
  });
  mermaid.run({ querySelector: ".mermaid" }).then(() => { document.title = "ready"; });
</script>`;

const dir = mkdtempSync(join(tmpdir(), "mmd-"));
const html = join(dir, "page.html");
writeFileSync(html, page);

// Dump first, shoot second. Dagre decides how big the drawing is, so the window
// has to be sized from the result — a fixed window either crops a wide graph or
// pads a short one with a screenful of white.
//
// --virtual-time-budget is what lets mermaid's async render finish; without it
// Chrome captures the blank <pre> at load.
const dom = execFileSync(CHROME, [
  "--headless", "--disable-gpu", "--virtual-time-budget=15000",
  "--dump-dom", `file://${html}`
  // Mermaid inlines its whole stylesheet into the SVG, so the DOM dump runs to
  // megabytes and the 1 MB default silently becomes ENOBUFS.
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

const match = dom.match(/<svg[\s\S]*?<\/svg>/);
if (!match) throw new Error("mermaid produced no svg — check the graph source");
const svg = match[0];
writeFileSync(`${outBase}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`);

const drawn = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
const pad = 48;
const w = drawn ? Math.ceil(Number(drawn[1])) + pad : width;
const h = drawn ? Math.ceil(Number(drawn[2])) + pad : 2400;

execFileSync(CHROME, [
  "--headless", "--disable-gpu", "--hide-scrollbars",
  "--default-background-color=FFFFFFFF",
  "--force-device-scale-factor=2",
  "--virtual-time-budget=15000",
  `--window-size=${w},${h}`,
  `--screenshot=${outBase}.png`,
  `file://${html}`
], { stdio: ["ignore", "ignore", "pipe"] });

console.log(`wrote ${outBase}.png and ${outBase}.svg  (${w}x${h} css px)`);

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { assessScenario } from "./src/orchestrator.js";
import { classifyModelError, testModelConnection } from "./src/llm.js";
import { getDataSourceCoverage, queryDataSource, syncSource } from "./src/data-layer/service.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 4180);
const MAX_BODY_BYTES = 64 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body."), { status: 400 });
  }
}

function cleanConfig(input = {}) {
  const baseUrl = String(input.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
  const model = String(input.model || process.env.OPENAI_MODEL || "gpt-5.4-mini").trim();
  const apiKey = String(input.apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!/^https?:\/\//i.test(baseUrl)) throw Object.assign(new Error("Base URL must begin with http:// or https://"), { status: 400 });
  if (!model || model.length > 120) throw Object.assign(new Error("A valid model name is required."), { status: 400 });
  return { baseUrl, model, apiKey };
}

function cleanHistory(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-6).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").trim().slice(0, 2000)
  })).filter((item) => item.content);
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "compliance-hub", version: "0.1.0" });
    }

    if (request.method === "GET" && url.pathname === "/api/runtime-capabilities") {
      return sendJson(response, 200, {
        liveModelConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || null,
        demoMode: "grounded_rules",
        demoLimitation: "Grounded rules cover the built-in compliance domains; an LLM is required for open-ended synthesis."
      });
    }

    if (request.method === "GET" && url.pathname === "/api/data-sources") {
      return sendJson(response, 200, await getDataSourceCoverage());
    }

    if (request.method === "POST" && url.pathname === "/api/data-sources/sync") {
      const body = await readJson(request);
      const sourceId = String(body.sourceId || "").trim();
      if (!sourceId) throw Object.assign(new Error("sourceId is required."), { status: 400 });
      return sendJson(response, 200, { sourceId, sync: await syncSource(sourceId) });
    }

    if (request.method === "POST" && url.pathname === "/api/data-sources/query") {
      const body = await readJson(request);
      const sourceId = String(body.sourceId || "").trim();
      if (!sourceId) throw Object.assign(new Error("sourceId is required."), { status: 400 });
      return sendJson(response, 200, await queryDataSource(sourceId, body.query, body.limit));
    }

    if (request.method === "POST" && url.pathname === "/api/assess") {
      const body = await readJson(request);
      const question = String(body.question || "").trim();
      if (question.length < 5 || question.length > 5000) {
        throw Object.assign(new Error("Question must contain 5–5000 characters."), { status: 400 });
      }
      const config = cleanConfig(body.config);
      const mock = Boolean(body.mock);
      if (!mock && !config.apiKey) throw Object.assign(new Error("API key is required for live-model mode."), { status: 400 });
      const result = await assessScenario({ question, locale: body.locale === "en" ? "en" : "zh", config, mock, history: cleanHistory(body.history) });
      return sendJson(response, 200, result);
    }

    if (request.method === "POST" && url.pathname === "/api/test-connection") {
      const body = await readJson(request);
      const config = cleanConfig(body.config);
      if (!config.apiKey) throw Object.assign(new Error("API key is required."), { status: 400 });
      try {
        const ok = await testModelConnection(config);
        return sendJson(response, 200, { ok });
      } catch (error) {
        const diagnosis = error.modelError || classifyModelError(error);
        return sendJson(response, 502, { ok: false, ...diagnosis });
      }
    }

    if (request.method === "GET" || request.method === "HEAD") {
      if (await serveStatic(url.pathname, response)) return;
    }
    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const status = Number(error.status) || 500;
    const safeMessage = status >= 500 ? "The request could not be completed. Check the model configuration or public-source connectivity." : error.message;
    sendJson(response, status, { error: safeMessage });
  }
});

// Local runs stay bound to the loopback interface so a prototype that accepts an
// API key is not exposed on the network by accident. A hosted deployment must
// opt in explicitly by setting HOST=0.0.0.0.
const HOST = process.env.HOST || "127.0.0.1";

// A hosted container starts with an empty data/runtime, so the hub would have no
// list data until someone pressed sync. SYNC_ON_BOOT fills it in the background:
// the server still answers immediately, and a failed source stays failed without
// taking down the process.
async function syncOnBoot() {
  const requested = String(process.env.SYNC_ON_BOOT || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!requested.length) return;
  console.log(`Boot sync requested for: ${requested.join(", ")}`);
  for (const sourceId of requested) {
    try {
      const result = await syncSource(sourceId);
      console.log(`Boot sync ${sourceId}: ${result.status} (${result.recordCount ?? 0} records)`);
    } catch (error) {
      console.log(`Boot sync ${sourceId}: failed - ${String(error.message).slice(0, 160)}`);
    }
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Compliance Hub prototype: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
  syncOnBoot();
});

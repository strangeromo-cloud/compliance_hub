import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { assessScenario } from "./src/orchestrator.js";
import { classifyModelError, testModelConnection } from "./src/llm.js";
import { getDataSourceCoverage, queryDataSource, syncSource } from "./src/data-layer/service.js";
import { deleteThread, listThreads, readThread, saveCase } from "./src/case-store.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");

// A containerized app runs as PID 1. That is also why shutdown has to be
// handled explicitly further down, so the two checks share one definition.
const isManagedRuntime = process.pid === 1 || Boolean(process.env.ZEABUR_SERVICE_ID);

// Platforms normally inject PORT. When one does not, probing 4180 would fail
// because nothing conventional listens there, so a hosted run falls back to
// 8080 — the port a platform assumes when it has to guess.
const DEFAULT_PORT = isManagedRuntime ? 8080 : 4180;

// A malformed PORT must not take the process down. Number("") of a non-numeric
// value yields NaN, listen() throws ERR_SOCKET_BAD_PORT, and the container
// enters a crash loop whose only outward symptom is a 502 — which looks like a
// routing fault and is nothing of the kind. Warn loudly and keep serving.
function resolvePort(raw) {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const parsed = Number(String(raw).trim());
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < 65536) return parsed;
  console.error(`PORT is set to ${JSON.stringify(raw)}, which is not a valid port. Falling back to ${DEFAULT_PORT}. Fix or remove the PORT variable.`);
  return DEFAULT_PORT;
}

const PORT = resolvePort(process.env.PORT);
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

// Setting OPENAI_API_KEY server-side is a convenience that also makes the model
// budget reachable by anyone who finds the URL. ACCESS_PASSWORD gates the
// endpoints that cost money or egress; leaving it unset keeps the old open
// behaviour, which is fine for a laptop and not for a public deployment.
const ACCESS_PASSWORD = String(process.env.ACCESS_PASSWORD || "").trim();

function requireAccess(request) {
  if (!ACCESS_PASSWORD) return;
  const supplied = String(request.headers["x-access-password"] || "");
  if (supplied !== ACCESS_PASSWORD) {
    throw Object.assign(new Error("A valid access password is required."), { status: 401, code: "access_password_required" });
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
        accessPasswordRequired: Boolean(ACCESS_PASSWORD),
        model: process.env.OPENAI_MODEL || null,
        demoMode: "grounded_rules",
        demoLimitation: "Grounded rules cover the built-in compliance domains; an LLM is required for open-ended synthesis."
      });
    }

    if (request.method === "GET" && url.pathname === "/api/data-sources") {
      return sendJson(response, 200, await getDataSourceCoverage());
    }

    if (request.method === "POST" && url.pathname === "/api/data-sources/sync") {
      requireAccess(request);
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
      requireAccess(request);
      const body = await readJson(request);
      const question = String(body.question || "").trim();
      if (question.length < 5 || question.length > 5000) {
        throw Object.assign(new Error("Question must contain 5–5000 characters."), { status: 400 });
      }
      const config = cleanConfig(body.config);
      const mock = Boolean(body.mock);
      if (!mock && !config.apiKey) throw Object.assign(new Error("API key is required for live-model mode."), { status: 400 });
      const locale = body.locale === "en" ? "en" : "zh";
      const result = await assessScenario({ question, locale, config, mock, history: cleanHistory(body.history) });
      await saveCase(result, question, locale, body.threadId).catch(() => null);
      return sendJson(response, 200, result);
    }

    // Streams one JSON object per line as each stage lands. EventSource cannot
    // POST, so this is a chunked fetch body the client reads incrementally
    // rather than SSE. /api/assess keeps returning a single JSON document.
    if (request.method === "POST" && url.pathname === "/api/assess/stream") {
      requireAccess(request);
      const body = await readJson(request);
      const question = String(body.question || "").trim();
      if (question.length < 5 || question.length > 5000) {
        throw Object.assign(new Error("Question must contain 5–5000 characters."), { status: 400 });
      }
      const config = cleanConfig(body.config);
      const mock = Boolean(body.mock);
      if (!mock && !config.apiKey) throw Object.assign(new Error("API key is required for live-model mode."), { status: 400 });

      response.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        // Proxies that buffer would defeat the point of streaming.
        "X-Accel-Buffering": "no"
      });
      const send = (event) => { if (!response.writableEnded) response.write(`${JSON.stringify(event)}\n`); };
      try {
        const locale = body.locale === "en" ? "en" : "zh";
        const result = await assessScenario({ question, locale, config, mock, history: cleanHistory(body.history), onEvent: send });
        // Persist before announcing completion, but a storage failure must not
        // discard an answer the user is already looking at.
        await saveCase(result, question, locale, body.threadId).catch(() => null);
        send({ type: "done", result });
      } catch (error) {
        // The status line is already sent, so a failure has to arrive as an
        // event rather than as an HTTP error code.
        send({ type: "error", error: String(error.message || "Analysis failed.").slice(0, 300), code: error.modelError?.code || null });
      }
      return response.end();
    }

    if (request.method === "GET" && url.pathname === "/api/threads") {
      return sendJson(response, 200, { threads: await listThreads(url.searchParams.get("limit")) });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/threads/")) {
      const record = await readThread(decodeURIComponent(url.pathname.slice("/api/threads/".length)));
      if (!record) throw Object.assign(new Error("Thread not found."), { status: 404 });
      return sendJson(response, 200, record);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/threads/")) {
      requireAccess(request);
      await deleteThread(decodeURIComponent(url.pathname.slice("/api/threads/".length)));
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/api/test-connection") {
      requireAccess(request);
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
    sendJson(response, status, { error: safeMessage, ...(error.code ? { code: error.code } : {}) });
  }
});

// Local runs stay on the loopback interface so a prototype that accepts an API
// key is not put on the network by accident.
//
// A container must not pin 0.0.0.0: that binds IPv4 only, so a platform whose
// service network reaches the pod over IPv6 cannot connect and the proxy
// answers 502 while the process sits there apparently healthy. Passing no host
// lets Node bind :: dual-stack and accept both families, which is strictly more
// permissive. An explicit HOST still overrides.
const HOST = process.env.HOST || (isManagedRuntime ? undefined : "127.0.0.1");
const HOST_LABEL = HOST ?? ":: (dual-stack)";

let shuttingDown = false;

// "fetch failed" alone says nothing. The errno lives on cause, or on
// AggregateError.errors when a connection attempt fails outright.
function describeSyncError(error, depth = 0) {
  if (!error || depth > 3) return "";
  const parts = [error.code, error.syscall, error.address, error.message].filter(Boolean);
  const nested = error.cause ? [error.cause] : Array.isArray(error.errors) ? error.errors.slice(0, 1) : [];
  return [[...new Set(parts)].join(" "), ...nested.map((item) => describeSyncError(item, depth + 1))].filter(Boolean).join(" <- ");
}

// A hosted container starts with an empty data/runtime, so the hub would have no
// list data until someone pressed sync. SYNC_ON_BOOT fills it in the background:
// the server still answers immediately, and a failed source stays failed without
// taking down the process.
async function syncOnBoot() {
  const requested = String(process.env.SYNC_ON_BOOT || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!requested.length) return;
  console.log(`Boot sync requested for: ${requested.join(", ")}`);
  for (const sourceId of requested) {
    if (shuttingDown) return console.log("Boot sync abandoned: shutting down.");
    try {
      const result = await syncSource(sourceId);
      console.log(`Boot sync ${sourceId}: ${result.status} (${result.recordCount ?? 0} records)`);
    } catch (error) {
      console.log(`Boot sync ${sourceId}: failed - ${describeSyncError(error).slice(0, 220)}`);
    }
  }
}

// The kernel applies no default signal disposition to PID 1, so a container
// process without an explicit handler simply ignores SIGTERM and the platform
// hangs in "Stopping" until it gives up. Handling it is not optional here.
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  // A keep-alive socket or an in-flight source download must not be able to
  // hold the container open past the platform's stop window.
  setTimeout(() => {
    console.log("Forcing exit after the shutdown grace period.");
    process.exit(0);
  }, 5000).unref();
}

for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => shutdown(signal));

// Anything unexpected must reach the runtime log. A container that dies without
// printing why is the hardest possible thing to diagnose from a dashboard.
process.on("uncaughtException", (error) => console.error("Uncaught exception:", error));
process.on("unhandledRejection", (error) => console.error("Unhandled rejection:", error));

console.log(`Compliance Hub starting: pid=${process.pid} managedRuntime=${isManagedRuntime} host=${HOST_LABEL} port=${PORT} portFromEnv=${Boolean(process.env.PORT)} node=${process.version}`);

server.on("error", (error) => {
  console.error(`Server failed to bind ${HOST_LABEL}:${PORT} — ${error.code || ""} ${error.message}`);
  process.exit(1);
});

server.listen(...(HOST ? [PORT, HOST] : [PORT]), () => {
  const bound = server.address();
  console.log(`Compliance Hub listening on ${bound.address}:${bound.port} (family ${bound.family})`);
  // Deferred so the platform's first health check lands on an idle process
  // rather than competing with several source downloads.
  setTimeout(syncOnBoot, 3000).unref();
});

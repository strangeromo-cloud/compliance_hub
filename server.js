import { createServer } from "node:http";
import { cpus, totalmem } from "node:os";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { assessScenario } from "./src/orchestrator.js";
import { classifyModelError, testModelConnection } from "./src/llm.js";
import { getDataSourceCoverage, queryDataSource, syncSource } from "./src/data-layer/service.js";
import { deleteThread, evolutionSignals, listThreads, readThread, saveCase, storageDurability } from "./src/case-store.js";
import { DECLARABLE_FIELDS, describeProcedures } from "./src/analysis-path.js";
import { describeCapabilities } from "./src/agent-capabilities.js";
import { closeDb, DB_PATH, REQUIRED_NODE_MAJOR } from "./src/data-layer/db.js";
import { importLegacyStore } from "./src/data-layer/import-legacy.js";
import { readSnapshotMeta, readSyncStatus } from "./src/data-layer/storage.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");

// Checked before anything else, because the alternative is what a Node 20
// deployment actually produced: ERR_UNKNOWN_BUILTIN_MODULE from inside the
// module loader, a crash loop, and no statement anywhere of what was needed.
// The build is what has to be fixed, so the message says which build inputs
// declare the requirement.
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
if (NODE_MAJOR < REQUIRED_NODE_MAJOR) {
  console.error(`Compliance Hub needs Node ${REQUIRED_NODE_MAJOR} or newer for node:sqlite, but this is ${process.version}.`);
  console.error("The Dockerfile pins node:24-alpine, package.json sets engines.node, and zbpack.json points at the Dockerfile.");
  console.error("A build running an older Node has ignored all three — check the service's build settings rather than the code.");
  process.exit(1);
}

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

// Every review now spends the model, so every review needs a code. There used
// to be a rules mode that spent nothing and therefore stayed open; it is gone,
// because a system with no model reachable has to say so rather than answer from
// a template.
//
// With a server key and no ACCESS_PASSWORD there is no code that could be
// checked, so the correct answer is to refuse rather than to serve the budget
// openly — an operator who wants live answers sets the variable.
function requireModelAccess(request) {
  if (ACCESS_PASSWORD) return requireAccess(request);
  if (process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error("Live-model calls are disabled because ACCESS_PASSWORD is not set on the server."), { status: 503, code: "access_code_unset" });
  }
  // No server key: the caller supplied their own, so it is their budget to spend.
}

function cleanConfig(input = {}) {
  // When the key comes from the environment, so must the endpoint and the model.
  // Letting a caller supply baseUrl while the server supplies the key would mean
  // a browser could point the endpoint at any host and have the server send its
  // own OPENAI_API_KEY there in an Authorization header. Client configuration is
  // therefore ignored outright in that mode, not merged with it.
  if (process.env.OPENAI_API_KEY) {
    const baseUrl = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
    const model = String(process.env.OPENAI_MODEL || "gpt-5.4-mini").trim();
    if (!/^https?:\/\//i.test(baseUrl)) throw Object.assign(new Error("Server OPENAI_BASE_URL must begin with http:// or https://"), { status: 500 });
    return { baseUrl, model, apiKey: process.env.OPENAI_API_KEY.trim(), fromServer: true };
  }

  const baseUrl = String(input.baseUrl || "https://api.openai.com/v1").trim();
  const model = String(input.model || "gpt-5.4-mini").trim();
  const apiKey = String(input.apiKey || "").trim();
  if (!/^https?:\/\//i.test(baseUrl)) throw Object.assign(new Error("Base URL must begin with http:// or https://"), { status: 400 });
  if (!model || model.length > 120) throw Object.assign(new Error("A valid model name is required."), { status: 400 });
  return { baseUrl, model, apiKey, fromServer: false };
}

// Declarations come from a form, so they are bounded in count, key shape and
// length before anything reasons over them. The accepted fields are the ones the
// path can actually ask for — derived from the plans rather than restated here,
// because the restatement drifted and silently ate an answer.
const DECLARABLE = new Set(DECLARABLE_FIELDS);

function cleanDeclaredFacts(input) {
  if (!input || typeof input !== "object") return { facts: {}, ignored: [] };
  const facts = {};
  const ignored = [];
  for (const [field, value] of Object.entries(input).slice(0, 20)) {
    const text = String(value ?? "").trim().slice(0, 300);
    if (!text) continue;
    // Dropping an answer without saying so is what made a rejected field look
    // like a step that simply would not settle.
    if (!DECLARABLE.has(field)) { ignored.push(field); continue; }
    facts[field] = text;
  }
  if (ignored.length) console.warn(`Declared facts rejected (not asked for by any step): ${ignored.join(", ")}`);
  return { facts, ignored };
}

// Fields the user has said they cannot supply. Same allowlist as a declaration,
// because it names the same things — the difference is that this is a refusal,
// not an answer.
function cleanUnavailable(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((field) => String(field || "").trim()).filter((field) => DECLARABLE.has(field)))].slice(0, 20);
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
      // What this box actually is. Asked because "can this deployment host a
      // model" kept being answered by guessing at the plan tier, and a container
      // can report its own limits in one request. cgroup v2 is read directly
      // because os.totalmem() reports the host's memory, not the container's —
      // on a shared host those differ by two orders of magnitude.
      let containerMemoryMb = null;
      try {
        const limit = (await readFile("/sys/fs/cgroup/memory.max", "utf8")).trim();
        if (limit && limit !== "max") containerMemoryMb = Math.round(Number(limit) / 1048576);
      } catch { /* not a cgroup v2 container */ }
      return sendJson(response, 200, {
        ok: true, service: "compliance-hub", version: "0.1.0",
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        cpus: cpus().length,
        hostMemoryMb: Math.round(totalmem() / 1048576),
        containerMemoryMb,
        // No GPU runtime is reachable from a Node process without native
        // bindings, so this reports what can be said rather than guessing.
        gpu: "not detectable from this process"
      });
    }

    if (request.method === "GET" && url.pathname === "/api/runtime-capabilities") {
      const storage = await storageDurability();
      return sendJson(response, 200, {
        // History is written to disk, and on an unmounted container that disk
        // goes away with the container. The page says so rather than letting an
        // emptied list read as a bug.
        historyPersistent: storage.persistent,
        historyStorage: storage.reason,
        liveModelConfigured: Boolean(process.env.OPENAI_API_KEY),
        accessPasswordRequired: Boolean(ACCESS_PASSWORD),
        // A server key with no access code cannot be used: say so here so the
        // client can say the model is unavailable rather than failing on the
        // first question.
        liveModelBlocked: Boolean(process.env.OPENAI_API_KEY) && !ACCESS_PASSWORD,
        model: process.env.OPENAI_MODEL || null,
        demoMode: "grounded_rules",
        demoLimitation: "Grounded rules cover the built-in compliance domains; an LLM is required for open-ended synthesis."
      });
    }

    // The guide describes the review procedures from this rather than from a
    // transcription of them, so the page cannot document a sequence the system
    // has stopped executing.
    if (request.method === "GET" && url.pathname === "/api/procedures") {
      return sendJson(response, 200, describeProcedures());
    }

    // The catalogue of what one agent can ask another for. Read-only and carries
    // no case data — it is the list a published tool server or a skill manifest
    // would serve, and it exists here so a capability cannot be exposed without
    // the provision that makes its answer binding travelling with it.
    // How well the system is reading the questions it is given. Read-only
    // aggregates over case_signals — no case text beyond the questions asked, and
    // nothing that identifies a reader.
    if (request.method === "GET" && url.pathname === "/api/evolution") {
      const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 90));
      return sendJson(response, 200, evolutionSignals({ days }));
    }

    if (request.method === "GET" && url.pathname === "/api/capabilities") {
      return sendJson(response, 200, { capabilities: describeCapabilities(url.searchParams.get("locale") === "en" ? "en" : "zh") });
    }

    if (request.method === "GET" && url.pathname === "/api/data-sources") {
      return sendJson(response, 200, await getDataSourceCoverage());
    }

    if (request.method === "POST" && url.pathname === "/api/data-sources/sync") {
      requireAccess(request);
      const body = await readJson(request);
      const sourceId = String(body.sourceId || "").trim();
      if (!sourceId) throw Object.assign(new Error("sourceId is required."), { status: 400 });
      try {
        return sendJson(response, 200, { sourceId, sync: await syncSource(sourceId) });
      } catch (error) {
        // A sync failure is not an internal: it is a network or parse error
        // about a public source, and it is exactly what the operator has to see.
        // Without this the generic 5xx handler withheld it and the page showed
        // "check the model configuration or public-source connectivity" for an
        // ETIMEDOUT — advice instead of a cause, and unusable to anyone who
        // cannot read the container log.
        //
        // The recorded status already carries the sanitized message, with any
        // api_key redacted, so it is returned rather than rebuilt.
        const recorded = (await readSyncStatus())[sourceId] || null;
        return sendJson(response, error.status && error.status < 500 ? error.status : 502, {
          sourceId,
          error: recorded?.error || String(error.message || "Sync failed.").slice(0, 500),
          code: "source_sync_failed",
          sync: recorded
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/data-sources/query") {
      const body = await readJson(request);
      const sourceId = String(body.sourceId || "").trim();
      if (!sourceId) throw Object.assign(new Error("sourceId is required."), { status: 400 });
      return sendJson(response, 200, await queryDataSource(sourceId, body.query, body.limit, body.offset));
    }

    if (request.method === "POST" && url.pathname === "/api/assess") {
      const body = await readJson(request);
      const question = String(body.question || "").trim();
      if (question.length < 5 || question.length > 5000) {
        throw Object.assign(new Error("Question must contain 5–5000 characters."), { status: 400 });
      }
      requireModelAccess(request);
      const config = cleanConfig(body.config);
      if (!config.apiKey) throw Object.assign(new Error("A model must be configured: this system does not answer from templates when it cannot reach one."), { status: 400 });
      const locale = body.locale === "en" ? "en" : "zh";
      const declared = cleanDeclaredFacts(body.declaredFacts);
      const result = await assessScenario({ question, locale, config, gemId: body.gemId, declaredFacts: declared.facts, unavailableFacts: cleanUnavailable(body.unavailableFacts), history: cleanHistory(body.history) });
      await saveCase(result, question, locale, body.threadId).catch(noteSaveFailure);
      return sendJson(response, 200, { ...result, ignoredDeclaredFacts: declared.ignored });
    }

    // Streams one JSON object per line as each stage lands. EventSource cannot
    // POST, so this is a chunked fetch body the client reads incrementally
    // rather than SSE. /api/assess keeps returning a single JSON document.
    if (request.method === "POST" && url.pathname === "/api/assess/stream") {
      const body = await readJson(request);
      const question = String(body.question || "").trim();
      if (question.length < 5 || question.length > 5000) {
        throw Object.assign(new Error("Question must contain 5–5000 characters."), { status: 400 });
      }
      requireModelAccess(request);
      const config = cleanConfig(body.config);
      if (!config.apiKey) throw Object.assign(new Error("A model must be configured: this system does not answer from templates when it cannot reach one."), { status: 400 });

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
        const declared = cleanDeclaredFacts(body.declaredFacts);
        const result = await assessScenario({ question, locale, config, gemId: body.gemId, declaredFacts: declared.facts, unavailableFacts: cleanUnavailable(body.unavailableFacts), history: cleanHistory(body.history), onEvent: send });
        result.ignoredDeclaredFacts = declared.ignored;
        // Persist before announcing completion, but a storage failure must not
        // discard an answer the user is already looking at.
        await saveCase(result, question, locale, body.threadId).catch(noteSaveFailure);
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
      requireModelAccess(request, false);
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
    // Unexpected 5xx messages are withheld because they can carry internals, but
    // a deliberate refusal (503 with a code) is the message the caller needs.
    const safeMessage = status >= 500 && !error.code
      ? "The request could not be completed. Check the model configuration or public-source connectivity."
      : error.message;
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

// A case that cannot be stored must not take down an answer the user is already
// reading, but it must not disappear quietly either: an empty history with a
// clean log is indistinguishable from one that was never written to.
function noteSaveFailure(error) {
  console.log(`Case not stored: ${String(error?.message || error).slice(0, 200)}`);
  return null;
}

// A hosted container starts with an empty data/runtime, so the hub would have no
// list data until someone pressed sync. SYNC_ON_BOOT fills it in the background:
// the server still answers immediately, and a failed source stays failed without
// taking down the process.
// How old a stored snapshot may be before boot re-fetches it. Official lists
// move on the order of weeks, so a week is a compromise between re-downloading
// what has not changed and serving something that has. SYNC_MAX_AGE_HOURS=0
// forces every source through, which is what a manual sync already does.
const SYNC_MAX_AGE_MS = (() => {
  const raw = Number(process.env.SYNC_MAX_AGE_HOURS);
  return (Number.isFinite(raw) && raw >= 0 ? raw : 168) * 3_600_000;
})();

async function isStoredAndFresh(sourceId) {
  if (SYNC_MAX_AGE_MS === 0) return null;
  const meta = await readSnapshotMeta(sourceId).catch(() => null);
  if (!meta?.recordCount) return null;
  const age = Date.now() - Date.parse(meta.capturedAt);
  if (!Number.isFinite(age) || age > SYNC_MAX_AGE_MS) return null;
  return { ...meta, ageHours: Math.round(age / 3_600_000) };
}

async function syncOnBoot() {
  const requested = String(process.env.SYNC_ON_BOOT || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!requested.length) return;
  console.log(`Boot sync requested for: ${requested.join(", ")}`);
  for (const sourceId of requested) {
    if (shuttingDown) return console.log("Boot sync abandoned: shutting down.");
    // The whole point of storing snapshots: a restart on a mounted volume finds
    // its data already there and downloads nothing.
    const stored = await isStoredAndFresh(sourceId);
    if (stored) {
      console.log(`Boot sync ${sourceId}: skipped - stored ${stored.ageHours}h ago (${stored.recordCount} records)`);
      continue;
    }
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
  server.close(() => { closeDb(); process.exit(0); });
  server.closeIdleConnections?.();
  // A keep-alive socket or an in-flight source download must not be able to
  // hold the container open past the platform's stop window.
  setTimeout(() => {
    console.log("Forcing exit after the shutdown grace period.");
    closeDb();
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

// Everything durable is in one file now, so where that file is decides whether
// anything survives a redeploy. Saying it at boot means the log answers the
// question without anyone having to ask it.
async function openStore() {
  const moved = await importLegacyStore().catch((error) => {
    console.error("Legacy import failed; the database stays as it was:", error.message);
    return null;
  });
  if (moved) {
    console.log(`Imported the previous file store: ${moved.sources} sources, ${moved.records} records, ${moved.threads} threads, ${moved.turns} cases.`);
  }
  const durability = await storageDurability();
  console.log(`Store: ${DB_PATH} (${durability.reason}${durability.persistent === false ? " — CLEARED ON REDEPLOY, mount a volume at data/runtime" : ""})`);
}

server.listen(...(HOST ? [PORT, HOST] : [PORT]), async () => {
  const bound = server.address();
  console.log(`Compliance Hub listening on ${bound.address}:${bound.port} (family ${bound.family})`);
  await openStore();
  // Deferred so the platform's first health check lands on an idle process
  // rather than competing with several source downloads.
  setTimeout(syncOnBoot, 3000).unref();
});

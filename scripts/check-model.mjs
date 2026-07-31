// Does this provider actually work, before a deployment depends on it.
//
// The app speaks the OpenAI Chat Completions dialect and nothing more, so any
// compatible gateway can serve it — but "compatible" covers a wide range in
// practice. Providers differ on whether they honour response_format, whether
// stream: true returns an event stream or an ordinary body, and whether the
// model returns parseable JSON under a strict contract. llm.js already degrades
// around each of those; this reports which ones it had to.
//
//   OPENAI_API_KEY=... npm run check-model
//   OPENAI_API_KEY=... npm run check-model -- --base https://host/v1 --model name
//
// The key is read from the environment only. Passing a credential as an
// argument writes it into shell history and into the process list, where other
// users on the machine can read it.

import { callJsonModel, callJsonModelStream, classifyModelError } from "../src/llm.js";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const config = {
  baseUrl: flag("base", process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
  model: flag("model", process.env.OPENAI_MODEL || "gpt-5.4-mini"),
  apiKey: process.env.OPENAI_API_KEY || ""
};

if (!config.apiKey) {
  console.error("OPENAI_API_KEY is not set. Provide it in the environment:\n");
  console.error("  OPENAI_API_KEY=... npm run check-model -- --base <url> --model <name>\n");
  console.error("The key must be one issued by whatever host --base points at. A key for a");
  console.error("different provider sent to a gateway is a key disclosed to that gateway.");
  process.exit(2);
}

console.log(`Base URL : ${config.baseUrl}`);
console.log(`Model    : ${config.model}`);
console.log(`Key      : set (${config.apiKey.length} chars, not shown)\n`);

// The same contract the specialists work under: strict JSON, no prose.
const MESSAGES = [
  { role: "system", content: 'Reply with JSON only, no prose: {"ok":true,"echo":"<the word the user gives>"}' },
  { role: "user", content: "The word is: compliance" }
];

const describe = (error) => {
  const { code, providerStatus } = error.modelError || classifyModelError(error);
  return `${code}${providerStatus ? ` (HTTP ${providerStatus})` : ""} — ${String(error.message).slice(0, 160)}`;
};

let failures = 0;

// 1. One ordinary request. This is what /api/test-connection does, and what the
//    master agent's synthesis uses when streaming is unavailable.
process.stdout.write("Plain JSON call     ");
const started = Date.now();
try {
  const result = await callJsonModel(config, MESSAGES);
  const ms = Date.now() - started;
  console.log(`ok    ${ms} ms   returned ${JSON.stringify(result).slice(0, 60)}`);
  if (!result || typeof result !== "object") {
    console.log("  warning: the reply parsed but is not an object; the agents expect an object");
  }
} catch (error) {
  failures += 1;
  console.log(`FAILED\n  ${describe(error)}`);
  if (error.modelError?.code === "model_auth_error") {
    console.log("  The key was rejected by this host. It has to be a token this host issued.");
  }
  if (error.modelError?.code === "model_endpoint_or_name_not_found") {
    console.log("  Either the base URL is wrong or this host does not serve that model name.");
    console.log(`  The app requests ${config.baseUrl.replace(/\/+$/, "")}/chat/completions`);
  }
}

// 2. The streaming path, which is what every specialist run uses. A provider
//    that answers stream: true with an ordinary body is not broken — the app
//    reads it as a normal completion — but the run then arrives in one lump
//    instead of unfolding, which is worth knowing before a demo.
process.stdout.write("Streaming call      ");
let streamed = false;
let meta = null;
const startedStream = Date.now();
try {
  await callJsonModelStream(config, MESSAGES, (text) => { if (text) streamed = true; }, (info) => { meta = info; });
  const ms = Date.now() - startedStream;
  if (meta && meta.streaming === false) {
    console.log(`ok    ${ms} ms   NOT streamed (${meta.reason}) — answers arrive in one lump`);
  } else {
    console.log(`ok    ${ms} ms   streamed incrementally${streamed ? "" : " (no readable text in this reply, which is fine for a tiny schema)"}`);
  }
} catch (error) {
  failures += 1;
  console.log(`FAILED\n  ${describe(error)}`);
}

// 3. What llm.js had to give up to make the two above work. It remembers this
//    per model, so a provider that rejects a parameter costs one failed request
//    rather than one per call — but the operator should know it happened.
const { droppedFor } = await import("../src/llm.js");
const dropped = droppedFor?.(config) || [];
console.log(`\nParameters this provider rejected: ${dropped.length ? dropped.join(", ") : "none"}`);
if (dropped.includes("response_format")) {
  console.log("  Without response_format the model is asked for JSON in the prompt alone.");
  console.log("  llm.js recovers JSON from a fenced block or the first object, but a chatty");
  console.log("  model will fail more often. Prefer one that supports it.");
}

console.log(failures ? `\n${failures} of 2 calls failed — do not point a deployment at this yet.` : "\nBoth calls succeeded. This provider can serve the app.");
process.exit(failures ? 1 : 0);

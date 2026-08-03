#!/usr/bin/env node
// The hub's capabilities, served to anything that speaks MCP.
//
// This is the adapter the capability layer was built for. run() is pure over
// named arguments and argsFromRun() is the only piece that knows what an
// in-process run looks like, so serving the same capability from outside needs
// no second implementation: the tool call supplies the arguments directly and
// the answer comes back identical, provision and all.
//
// What a caller gets is deliberately not just prose. Every result carries the
// answer, the provision that makes it binding, the lane answerable for it, and
// the evidence it rests on — either the sources and records searched, or the
// plain statement that it rests on a user declaration and has not been verified.
// A consumer outside this process must be able to reach the underlying records
// without trusting the sentence, and must never be able to mistake a declaration
// for a finding.
//
// Deliberately not exposed: anything that runs a review, stores a case, or
// reaches the model. Those need a transaction, a reader and a human at the end
// of them. A capability answers one narrow question from data it is handed.
//
// JSON-RPC 2.0 over stdio, hand-rolled to keep the zero-dependency floor. Usage:
//   node mcp-server.js
// then speak MCP on stdin/stdout.

import { createInterface } from "node:readline";
import { CAPABILITIES, describeCapabilities, invokeCapability } from "./src/agent-capabilities.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER = { name: "compliance-hub", version: "0.1.0" };

const TYPES = { string: "string", number: "number", array: "array", boolean: "boolean" };

// A tool's schema is generated from the capability's declared inputs rather than
// written twice — a second copy would drift, which is the fault this whole layer
// was factored to avoid.
function toolsList(locale = "en") {
  return describeCapabilities(locale).map((capability) => ({
    name: capability.id.replace(".", "__"),
    description: `${capability.title} — ${capability.summary} Answered by the ${capability.providerName} lane under ${capability.cite}.`,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(capability.input.map((field) => [
        field.name,
        { type: TYPES[field.type] || "string", description: field.description }
      ])),
      required: capability.input.filter((field) => field.required).map((field) => field.name)
    }
  }));
}

const idFor = (toolName) => {
  const id = String(toolName).replace("__", ".");
  return CAPABILITIES[id] ? id : null;
};

function callTool(name, args, locale) {
  const id = idFor(name);
  if (!id) throw new Error(`No such capability: ${name}`);
  const result = invokeCapability(id, { caller: "mcp", args: args || {} });
  const sentence = locale === "zh" ? result.zh : result.en;
  return {
    // Prose for a reader, structure for a caller. Both say the same thing, and
    // the structure is what a downstream system should act on.
    content: [{ type: "text", text: `${sentence} (${result.cite})` }],
    structuredContent: {
      capability: id,
      provider: result.provider,
      answer: result.answer,
      statement: sentence,
      cite: result.cite,
      evidence: result.evidence || null,
      // Said in every payload rather than in documentation nobody reads: this
      // answers one question from the data supplied. It is not a review, and it
      // is not a decision to ship anything.
      disclaimer: "One narrow question answered from the data supplied. Not a compliance review and not an authorisation to transact."
    }
  };
}

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

function handle(request) {
  const { id, method, params = {} } = request;
  // A notification carries no id and takes no response, per JSON-RPC. Answering
  // one is a protocol error that some clients treat as a fatal handshake fault.
  const isNotification = id === undefined || id === null;

  try {
    if (method === "initialize") {
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER
      });
    }
    if (method === "notifications/initialized" || method === "notifications/cancelled") return;
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") return reply(id, { tools: toolsList(params.locale === "zh" ? "zh" : "en") });
    if (method === "tools/call") {
      return reply(id, callTool(params.name, params.arguments, params._meta?.locale === "zh" ? "zh" : "en"));
    }
    if (isNotification) return;
    return fail(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    if (isNotification) return;
    // A refused call is an answer too — a cycle, a missing required input or an
    // unknown capability are all conditions the caller has to be able to see,
    // not silent empties.
    return reply(id, {
      isError: true,
      content: [{ type: "text", text: String(error.message) }]
    });
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let request;
  try { request = JSON.parse(text); }
  catch { return fail(null, -32700, "Parse error"); }
  handle(request);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Drives the server the way a client would: JSON-RPC lines in, JSON-RPC lines
// out. Testing the module's functions would prove the functions work and say
// nothing about whether anything can actually talk to it.
function speak(messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../mcp-server.js", import.meta.url))]);
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", reject);
    child.on("close", () => {
      if (err.trim()) return reject(new Error(err));
      resolve(out.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)));
    });
    child.stdin.end(messages.map((message) => JSON.stringify(message)).join("\n") + "\n");
  });
}

test("the server completes a handshake and lists every capability as a tool", async () => {
  const { CAPABILITIES } = await import("../src/agent-capabilities.js");
  const replies = await speak([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    // A notification carries no id and must draw no response. Answering one is
    // a protocol error that some clients treat as a fatal handshake fault.
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
  ]);

  assert.equal(replies.length, 2, "the notification must not be answered");
  assert.equal(replies[0].result.serverInfo.name, "compliance-hub");
  assert.ok(replies[0].result.protocolVersion);

  const tools = replies[1].result.tools;
  assert.equal(tools.length, Object.keys(CAPABILITIES).length);
  for (const tool of tools) {
    assert.match(tool.name, /^(trade|product|tpdd)__/, "a tool name carries the lane answerable for it");
    // The provision travels with the tool, so a capability cannot be published
    // without the rule that makes its answer binding.
    const capability = CAPABILITIES[tool.name.replace("__", ".")];
    assert.ok(capability, `${tool.name} must map back to a capability`);
    assert.ok(tool.description.includes(capability.cite), `${tool.name} must publish its provision`);
    assert.equal(tool.inputSchema.type, "object");
    // The schema is generated from the declared inputs rather than written
    // twice — a second copy would drift.
    assert.deepEqual(
      Object.keys(tool.inputSchema.properties).sort(),
      capability.input.map((field) => field.name).sort()
    );
    assert.deepEqual(
      tool.inputSchema.required.sort(),
      capability.input.filter((field) => field.required).map((field) => field.name).sort()
    );
  }
});

test("a call answers with its provision, its evidence and what it is not", async () => {
  const [, hit, declared, refused, unknown] = await speak([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "trade__party_status",
      arguments: { matches: [{ entityName: "Designated Co", recordId: "r7" }], sourcesSearched: 9, sources: ["trade-csl"] } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "product__item_jurisdiction", arguments: { eccn: "4A090.a" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "trade__party_status", arguments: { matches: [] } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "trade__nothing", arguments: {} } }
  ]);

  const found = hit.result.structuredContent;
  assert.equal(found.answer, "potential_match");
  assert.equal(found.provider, "trade");
  assert.match(found.cite, /732\.3\(g\)/);
  // A consumer must be able to reach the records without trusting the sentence.
  assert.deepEqual(found.evidence.sources, ["trade-csl"]);
  assert.deepEqual(found.evidence.records, ["r7"]);
  assert.match(hit.result.content[0].text, /§ 732\.3\(g\)/, "the prose carries the provision too");
  // Said in every payload rather than in documentation nobody reads.
  assert.match(found.disclaimer, /Not a compliance review/);

  // A declaration must never be able to pass as a finding.
  assert.equal(declared.result.structuredContent.evidence.basis, "user_declaration");

  // A refused call is an answer: the caller has to see the condition, not a
  // silent empty.
  assert.equal(refused.result.isError, true);
  assert.match(refused.result.content[0].text, /requires input "sourcesSearched"/);
  assert.equal(unknown.result.isError, true);
  assert.match(unknown.result.content[0].text, /No such capability/);
});

test("the server exposes capabilities and nothing else", async () => {
  // Running a review, storing a case or reaching the model all need a
  // transaction, a reader and a human at the end of them. None is a tool.
  const [, listed] = await speak([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
  ]);
  const names = listed.result.tools.map((tool) => tool.name).join(" ");
  for (const forbidden of ["assess", "sync", "thread", "case", "model"]) {
    assert.doesNotMatch(names, new RegExp(forbidden, "i"), `${forbidden} must not be exposed as a tool`);
  }
});

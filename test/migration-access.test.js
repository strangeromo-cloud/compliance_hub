import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { migrationAccess } from "../src/migration-access.js";

test("migration gate blocks anonymous and malformed requests, permits valid credentials and rejects cross-origin writes", () => {
 process.env.MIGRATION_ACCESS_ENABLED = "1";
 process.env.MIGRATION_ACCESS_CREDENTIAL_SHA256 = createHash("sha256").update("review:test-only").digest("hex");
 const run = (headers = {}, method = "GET", path = "/") => {
  const response = { status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end() {} };
  const allowed = migrationAccess({ method, headers: { host: "example.test", ...headers } }, response, path);
  return {allowed, status:response.status};
 };
 assert.equal(run().status, 401);
 assert.equal(run({authorization:"Basic !!!"}).status, 401);
 const authorization = "Basic " + Buffer.from("review:test-only").toString("base64");
 assert.equal(run({authorization}).allowed, true);
 assert.equal(run({authorization, origin:"https://evil.test"}, "POST").status, 403);
 assert.equal(run({authorization, origin:"https://example.test"}, "POST").allowed, true);
 assert.equal(run({}, "GET", "/health").allowed, true);
 process.env.MIGRATION_ACCESS_CREDENTIAL_SHA256 = "broken";
 assert.equal(run({authorization}).status, 503);
 delete process.env.MIGRATION_ACCESS_ENABLED; delete process.env.MIGRATION_ACCESS_CREDENTIAL_SHA256;
});

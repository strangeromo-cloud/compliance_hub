import { createHash, timingSafeEqual } from "node:crypto";

// Fail closed when enabled; only a SHA-256 credential digest is stored remotely.
export function migrationAccess(request, response, pathname) {
  if (request.method === "GET" && pathname === "/health") return true;
  const expected = process.env.MIGRATION_ACCESS_CREDENTIAL_SHA256 || "";
  if (process.env.MIGRATION_ACCESS_ENABLED !== "1" && !expected) return true;
  response.setHeader("Cache-Control", "private, no-store");
  if (!/^[a-f0-9]{64}$/i.test(expected)) {
    response.writeHead(503); response.end("Access is not configured"); return false;
  }
  const match = request.headers.authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
  const decoded = match ? Buffer.from(match[1], "base64") : Buffer.alloc(0);
  const digest = createHash("sha256").update(decoded).digest();
  if (!decoded.includes(58) || !timingSafeEqual(digest, Buffer.from(expected, "hex"))) {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="Migration Review", charset="UTF-8"' });
    response.end("Authentication required"); return false;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.origin) {
    let safe = false;
    try { const origin = new URL(request.headers.origin); safe = ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.host; } catch {}
    if (!safe) { response.writeHead(403); response.end("Forbidden origin"); return false; }
  }
  return true;
}

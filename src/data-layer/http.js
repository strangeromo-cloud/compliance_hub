const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BYTES = 90 * 1024 * 1024;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// A rate limiter and a dead host are different failures. 429 says "come back
// later", and fetching seven eCFR parts back to back is enough to trip one, so it
// is retried — with the delay the server asked for — even when the caller wanted a
// single attempt. Everything else keeps the caller's attempt budget.
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 15_000;

export async function fetchPublicFile(url, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  let maxAttempts = Math.max(1, options.attempts || 2);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        body: options.body,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": process.env.COMPLIANCE_HUB_USER_AGENT || "ComplianceHubPrototype/0.1 (official-public-data adapter)",
          Accept: options.accept || "application/json,application/xml,text/xml,text/csv,text/html;q=0.9,*/*;q=0.5",
          ...options.headers
        }
      });
      if (!response.ok) {
        throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), {
          status: response.status,
          // Honour the server's own answer to "when?" rather than guessing.
          retryAfterMs: Math.min(MAX_RETRY_WAIT_MS, (Number(response.headers.get("retry-after")) || 0) * 1000)
        });
      }
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > maxBytes) throw new Error(`Source file exceeds ${maxBytes} bytes.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxBytes) throw new Error(`Source file exceeds ${maxBytes} bytes.`);
      return {
        bytes,
        contentType: response.headers.get("content-type") || "application/octet-stream",
        lastModified: response.headers.get("last-modified"),
        etag: response.headers.get("etag"),
        finalUrl: response.url || url
      };
    } catch (error) {
      lastError = error;
      if (error.status === 429 && maxAttempts < 3) maxAttempts = 3;
      const retryable = !error.status || RETRYABLE_STATUS.has(error.status);
      if (!retryable || attempt >= maxAttempts) break;
      // A transfer that dies mid-stream — read ETIMEDOUT rather than connect —
      // reached the host and then stalled. Retrying immediately hits the same
      // stalled path, so a caller that knows it is pulling something large can
      // ask for a longer wait between tries.
      const base = options.retryBaseMs || 350;
      await wait(error.retryAfterMs || (error.status === 429 ? 2000 * attempt : base * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError?.name === "AbortError") throw new Error(`Source request timed out after ${timeoutMs} ms.`);
  throw lastError;
}

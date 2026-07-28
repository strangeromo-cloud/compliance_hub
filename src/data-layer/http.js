const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BYTES = 90 * 1024 * 1024;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchPublicFile(url, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  const attempts = Math.max(1, options.attempts || 2);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
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
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
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
      if (attempt < attempts) await wait(350 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError?.name === "AbortError") throw new Error(`Source request timed out after ${timeoutMs} ms.`);
  throw lastError;
}

const MAX_SOURCE_CHARS = 7000;
const MAX_LIVE_SOURCES = 5;

function cleanHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url, timeoutMs = 12_000, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": process.env.COMPLIANCE_HUB_USER_AGENT || "ComplianceHubPrototype/0.1 (public-source research; local prototype)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"
        },
        redirect: "follow"
      });
      if (!response.ok && response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function retrievePublicSources(sources) {
  const liveSet = new Set(sources.slice(0, MAX_LIVE_SOURCES).map((source) => source.id));
  return Promise.all(
    sources.map(async (source) => {
      if (!liveSet.has(source.id)) {
        return { ...source, liveStatus: "not_fetched", excerpt: source.summary, retrievedAt: null };
      }
      try {
        const response = await fetchWithTimeout(source.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text") && !contentType.includes("html")) {
          return { ...source, liveStatus: "metadata_only", excerpt: source.summary, retrievedAt: new Date().toISOString() };
        }
        const text = cleanHtml(await response.text()).slice(0, MAX_SOURCE_CHARS);
        return {
          ...source,
          liveStatus: text.length > 200 ? "live" : "metadata_only",
          excerpt: text.length > 200 ? text : source.summary,
          retrievedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          ...source,
          liveStatus: "unavailable",
          excerpt: source.summary,
          retrievedAt: null,
          retrievalError: error.name === "AbortError" ? "timeout" : "unavailable"
        };
      }
    })
  );
}

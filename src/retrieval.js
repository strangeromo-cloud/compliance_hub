import { findArchivedDocument } from "./data-layer/service.js";
import { describeAge, readCachedPage, writeCachedPage } from "./data-layer/page-cache.js";

const MAX_SOURCE_CHARS = 7000;
const MAX_LIVE_SOURCES = 5;

// A whole request has to finish well inside a hosting platform's gateway
// timeout. An unreachable host fails by silence, not refusal, so without a
// shared deadline several of them serialize into a 502 and the user sees a
// parser error instead of an answer.
const RETRIEVAL_BUDGET_MS = 9000;
const PER_SOURCE_TIMEOUT_MS = 6000;

// How long a cited page stays good. Regulations, FAQs and agency guidance move
// on the order of months, so a daily read is ample; manufacturer classification
// tables and filings move less often still. A source can override this.
const DEFAULT_REFRESH_HOURS = 24;
const refreshMs = (source) => (source.refreshHours ?? DEFAULT_REFRESH_HOURS) * 3_600_000;

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

async function fetchWithTimeout(url, deadlineSignal, timeoutMs = PER_SOURCE_TIMEOUT_MS, attempts = 2, etag = null) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (deadlineSignal?.aborted) throw Object.assign(new Error("Retrieval budget exhausted."), { name: "AbortError" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onDeadline = () => controller.abort();
    deadlineSignal?.addEventListener("abort", onDeadline, { once: true });
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": process.env.COMPLIANCE_HUB_USER_AGENT || "ComplianceHubPrototype/0.1 (public-source research; local prototype)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          ...(etag ? { "If-None-Match": etag } : {})
        },
        redirect: "follow"
      });
      if (response.status !== 304 && !response.ok && response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      // Retrying a host that never answered just burns the budget twice.
      if (deadlineSignal?.aborted || error.name === "AbortError") break;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timeout);
      deadlineSignal?.removeEventListener("abort", onDeadline);
    }
  }
  throw lastError;
}

export async function retrievePublicSources(sources) {
  const liveSet = new Set(sources.slice(0, MAX_LIVE_SOURCES).map((source) => source.id));
  // One deadline for the batch, but only requests that actually go to the
  // network are exposed to it — a cache hit is never at risk from another
  // host's slowness.
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), RETRIEVAL_BUDGET_MS);

  try {
    return await Promise.all(sources.map(async (source) => {
      if (source.fetchPolicy === "citation_only") {
        return { ...source, liveStatus: "citation_only", excerpt: source.summary, retrievedAt: null };
      }

      const cached = await readCachedPage(source.url).catch(() => null);
      const fresh = cached && cached.ageMs < refreshMs(source);

      // Fresh cache short-circuits the network entirely. This is the whole
      // point: the common case costs nothing and cannot fail.
      if (fresh) {
        return {
          ...source,
          liveStatus: "cached",
          excerpt: cached.text.slice(0, MAX_SOURCE_CHARS),
          retrievedAt: cached.capturedAt,
          cacheAge: describeAge(cached.ageMs)
        };
      }

      if (!liveSet.has(source.id) && !cached) {
        return { ...source, liveStatus: "not_fetched", excerpt: source.summary, retrievedAt: null };
      }

      try {
        const response = await fetchWithTimeout(source.url, deadline.signal, PER_SOURCE_TIMEOUT_MS, 2, cached?.etag);
        // Unchanged since the cached copy: refresh its age, keep the text.
        if (response.status === 304 && cached) {
          await writeCachedPage(source.url, cached.text, cached.etag);
          return { ...source, liveStatus: "cached", excerpt: cached.text.slice(0, MAX_SOURCE_CHARS), retrievedAt: new Date().toISOString(), cacheAge: "0m" };
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text") && !contentType.includes("html")) {
          return { ...source, liveStatus: "metadata_only", excerpt: source.summary, retrievedAt: new Date().toISOString() };
        }
        const text = cleanHtml(await response.text()).slice(0, MAX_SOURCE_CHARS);
        if (text.length > 200) await writeCachedPage(source.url, text, response.headers.get("etag"));
        return {
          ...source,
          liveStatus: text.length > 200 ? "live" : "metadata_only",
          excerpt: text.length > 200 ? text : source.summary,
          retrievedAt: new Date().toISOString()
        };
      } catch (error) {
        const retrievalError = error.name === "AbortError" ? "timeout" : "unavailable";

        // A stale copy is far better than nothing, and saying it is stale is
        // honest. This is what stops a transient failure from erasing a source.
        if (cached) {
          return {
            ...source,
            liveStatus: "cached",
            excerpt: cached.text.slice(0, MAX_SOURCE_CHARS),
            retrievedAt: cached.capturedAt,
            cacheAge: describeAge(cached.ageMs),
            stale: true,
            retrievalError
          };
        }

        const archived = await findArchivedDocument(source.url).catch(() => null);
        if (archived) {
          return {
            ...source,
            liveStatus: "archived",
            excerpt: archived.text.slice(0, MAX_SOURCE_CHARS),
            retrievedAt: archived.capturedAt || null,
            archivedFrom: archived.provenance,
            noticeNumber: archived.noticeNumber,
            retrievalError
          };
        }

        return { ...source, liveStatus: "unavailable", excerpt: source.summary, retrievedAt: null, retrievalError };
      }
    }));
  } finally {
    clearTimeout(deadlineTimer);
  }
}

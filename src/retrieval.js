import { findArchivedDocument } from "./data-layer/service.js";

const MAX_SOURCE_CHARS = 7000;
const MAX_LIVE_SOURCES = 5;

// A whole request has to finish well inside a hosting platform's gateway
// timeout. An unreachable host fails by silence, not refusal, so without a
// shared deadline several of them serialize into a 502 and the user sees a
// parser error instead of an answer.
const RETRIEVAL_BUDGET_MS = 9000;
const PER_SOURCE_TIMEOUT_MS = 6000;

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

async function fetchWithTimeout(url, deadlineSignal, timeoutMs = PER_SOURCE_TIMEOUT_MS, attempts = 2) {
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
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"
        },
        redirect: "follow"
      });
      if (!response.ok && response.status >= 500) throw new Error(`HTTP ${response.status}`);
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
  // One deadline for the whole batch. Whatever has not answered by then is
  // reported as unavailable rather than allowed to run the request past the
  // gateway timeout — a missing excerpt is recoverable, a 502 is not.
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), RETRIEVAL_BUDGET_MS);
  try {
    return await Promise.all(
    sources.map(async (source) => {
      if (source.fetchPolicy === "citation_only") {
        // The publisher refuses automated access; citing it without fetching is
        // both accurate and the right thing to do.
        return { ...source, liveStatus: "citation_only", excerpt: source.summary, retrievedAt: null };
      }
      if (!liveSet.has(source.id)) {
        return { ...source, liveStatus: "not_fetched", excerpt: source.summary, retrievedAt: null };
      }
      try {
        const response = await fetchWithTimeout(source.url, deadline.signal);
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
        // The page could not be reached now, but it may already be in the
        // ingested corpus. Using that is better than an empty citation, and it
        // is reported as an archived copy rather than as a live retrieval.
        const archived = await findArchivedDocument(source.url).catch(() => null);
        if (archived) {
          return {
            ...source,
            liveStatus: "archived",
            excerpt: archived.text.slice(0, MAX_SOURCE_CHARS),
            retrievedAt: archived.capturedAt || null,
            archivedFrom: archived.provenance,
            noticeNumber: archived.noticeNumber,
            retrievalError: error.name === "AbortError" ? "timeout" : "unavailable"
          };
        }
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
  } finally {
    clearTimeout(deadlineTimer);
  }
}

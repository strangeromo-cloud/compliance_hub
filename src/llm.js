function normalizeBaseUrl(baseUrl) {
  return (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function classifyModelError(error) {
  const providerStatus = Number(error?.status) || null;
  if (error?.name === "AbortError") return { code: "model_timeout", providerStatus: null };
  if (providerStatus === 401) return { code: "model_auth_error", providerStatus };
  if (providerStatus === 403) return { code: "model_permission_error", providerStatus };
  if (providerStatus === 404) return { code: "model_endpoint_or_name_not_found", providerStatus };
  if (providerStatus === 429) return { code: "model_quota_or_rate_limit", providerStatus };
  if (providerStatus === 400 || providerStatus === 422) return { code: "model_invalid_request", providerStatus };
  if (providerStatus) return { code: "model_provider_error", providerStatus };
  if (/valid json|no message content|unexpected token|json/i.test(String(error?.message || ""))) {
    return { code: "model_invalid_response", providerStatus: null };
  }
  if (error instanceof TypeError || /fetch failed|network|enotfound|econnrefused|socket/i.test(String(error?.message || ""))) {
    return { code: "model_network_error", providerStatus: null };
  }
  return { code: "model_unknown_error", providerStatus: null };
}

// A reasoning model states its working before its answer. Hermes and the other
// open-weights models with a thinking mode wrap it in <think>…</think>, and that
// working is prose about the problem — which means it contains braces, because
// the problem is about JSON. Stripped before anything is parsed.
const REASONING_BLOCK = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>\s*/gi;

// The first complete JSON object in the text, found by balancing braces rather
// than by matching the first "{" to the last "}". The greedy version worked for
// as long as nothing else in the response had a brace in it; the moment a model
// explained itself first, it spliced the tail of the explanation onto the head of
// the answer and produced a parse error that read like the model had malfunctioned.
// Quotes and escapes are tracked because a brace inside a string is not a brace.
function firstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}" && (depth -= 1) === 0) return text.slice(start, index + 1);
  }
  return null;
}

function extractJson(text) {
  if (typeof text !== "string") return text;
  const cleaned = text.replace(REASONING_BLOCK, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const object = firstJsonObject(cleaned);
    if (object) return JSON.parse(object);
    throw new Error("The model did not return valid JSON.");
  }
}

// Newer models reject request parameters that older ones require: some accept
// only the default temperature, others do not implement response_format. Rather
// than pin the prototype to one provider's dialect, unsupported parameters are
// dropped one at a time and remembered per model, so the cost is one failed
// request per model rather than one per call.
const droppedParams = new Map();

// An AbortError otherwise surfaces as the raw "This operation was aborted",
// which tells the user nothing about what to do.
function classify(error) {
  if (error?.modelError) return error;
  error.modelError = classifyModelError(error);
  return error;
}

function modelKey(config) {
  return `${normalizeBaseUrl(config.baseUrl)}::${config.model}`;
}

// Only treat a 400 as a capability signal when the provider names the parameter
// it rejected. Anything else is a real error and must surface.
function unsupportedParam(error, alreadyDropped) {
  if (error?.status !== 400) return null;
  const detail = String(error.message || "");
  if (!alreadyDropped.has("temperature") && /temperature/i.test(detail)) return "temperature";
  if (!alreadyDropped.has("response_format") && /response_format|json_object/i.test(detail)) return "response_format";
  if (!alreadyDropped.has("stream") && /\bstream\b/i.test(detail)) return "stream";
  return null;
}

// Pulls the human-readable field values out of a partly-written JSON object, in
// the order they appear, tolerating a string that is still being typed. The
// agents are under a strict JSON contract, so the alternative to this would be
// showing the user raw braces and keys.
// Every human-readable field across both schemas: the specialists write
// summary/title/detail, the master agent writes headline/executiveSummary/
// nextStep. Omitting the second set left the synthesis with nothing to show.
const READABLE_FIELDS = /"(summary|title|detail|headline|executiveSummary|nextStep)"\s*:\s*"((?:[^"\\]|\\.)*)/g;

export function readableProjection(partial) {
  const pieces = [];
  for (const match of String(partial).matchAll(READABLE_FIELDS)) {
    const text = match[2].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (!text) continue;
    pieces.push(["title", "nextStep"].includes(match[1]) ? `\n· ${text}` : text);
  }
  return pieces.join(" ").replace(/\s+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}

async function requestCompletion(config, messages, dropped = new Set()) {
  const endpoint = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const body = { model: config.model, messages };
  // A low temperature is preferable for compliance output, but not at the cost
  // of the request failing outright.
  if (!dropped.has("temperature")) body.temperature = 0.1;
  if (!dropped.has("response_format")) body.response_format = { type: "json_object" };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Model API returned ${response.status}: ${detail.slice(0, 300)}`);
    error.status = response.status;
    error.modelError = classifyModelError(error);
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    const error = new Error("Model API returned a non-JSON response.", { cause });
    error.modelError = { code: "model_invalid_response", providerStatus: response.status };
    throw error;
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("Model API returned no Chat Completions message content.");
    error.modelError = { code: "model_invalid_response", providerStatus: response.status };
    throw error;
  }
  return extractJson(content);
}

// Streams the model response and reports the readable text as it materializes,
// so a thirty-second specialist run is visible while it happens rather than
// only when it finishes.
async function streamCompletion(config, messages, dropped, onText, onMeta) {
  const endpoint = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
  const controller = new AbortController();
  const IDLE_TIMEOUT_MS = 60_000;
  let idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  const keepAlive = () => { clearTimeout(idle); idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS); };
  const body = { model: config.model, messages, stream: true };
  if (!dropped.has("temperature")) body.temperature = 0.1;
  if (!dropped.has("response_format")) body.response_format = { type: "json_object" };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) { clearTimeout(idle); throw classify(error); }

  if (!response.ok || !response.body) {
    clearTimeout(idle);
    const detail = await response.text().catch(() => "");
    const error = new Error(`Model API returned ${response.status}: ${detail.slice(0, 300)}`);
    error.status = response.status;
    error.modelError = classifyModelError(error);
    throw error;
  }

  // Not every provider honours stream: true. One that answers with an ordinary
  // JSON body is not an error — read it as a normal completion and report the
  // text once, rather than failing on the missing event stream.
  if (!/text\/event-stream/i.test(response.headers.get("content-type") || "")) {
    clearTimeout(idle);
    // The provider accepted stream: true and answered with an ordinary body.
    // Remember it so later calls skip the attempt, and tell the caller, because
    // silently degrading looks identical to a broken feature.
    dropped.add("stream");
    droppedParams.set(modelKey(config), new Set(dropped));
    onMeta?.({ streaming: false, reason: "provider_returned_non_stream" });
    const payload = await response.json().catch(() => null);
    const whole = payload?.choices?.[0]?.message?.content;
    if (!whole) {
      const error = new Error("Model API returned no Chat Completions message content.");
      error.modelError = { code: "model_invalid_response", providerStatus: response.status };
      throw error;
    }
    const readable = readableProjection(whole);
    if (readable) onText(readable);
    return extractJson(whole);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let content = "";
  let reported = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      keepAlive();
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop();
      for (const line of lines) {
        const payload = line.trim();
        if (!payload.startsWith("data:")) continue;
        const data = payload.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }
        const delta = parsed.choices?.[0]?.delta?.content;
        if (!delta) continue;
        content += delta;
        // The full readable text is sent each time, not an increment. The
        // projection re-normalizes whitespace on every pass, so an earlier
        // prefix can legitimately change once a new field opens — diffing
        // against the last send would then fail the monotonicity check and
        // silence that agent for the rest of the run.
        const readable = readableProjection(content);
        if (readable && readable !== reported) {
          onText(readable);
          reported = readable;
        }
      }
    }
  } catch (error) { throw classify(error); } finally { clearTimeout(idle); }

  if (!content) {
    const error = new Error("Model API returned no streamed content.");
    error.modelError = { code: "model_invalid_response", providerStatus: response.status };
    throw error;
  }
  return extractJson(content);
}

// What had to be given up for this provider, for the preflight script to report.
// The app degrades silently by design — one failed request instead of one per
// call — but an operator choosing a provider should be able to see it.
export function droppedFor(config) {
  return [...(droppedParams.get(modelKey(config)) || [])];
}

export async function callJsonModelStream(config, messages, onText, onMeta) {
  const key = modelKey(config);
  const dropped = new Set(droppedParams.get(key) || []);
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    try {
      if (dropped.has("stream")) {
        onMeta?.({ streaming: false, reason: "provider_rejected_stream" });
        const result = await requestCompletion(config, messages, dropped);
        const readable = readableProjection(JSON.stringify(result));
        if (readable) onText(readable);
        return result;
      }
      return await streamCompletion(config, messages, dropped, onText, onMeta);
    } catch (error) {
      const param = unsupportedParam(error, dropped);
      if (!param) throw error;
      dropped.add(param);
      droppedParams.set(key, new Set(dropped));
    }
  }
  throw Object.assign(new Error("The model rejected every supported parameter combination."), { modelError: { code: "model_invalid_request", providerStatus: 400 } });
}

export async function callJsonModel(config, messages) {
  const key = modelKey(config);
  const dropped = new Set(droppedParams.get(key) || []);
  // At most one retry per droppable parameter, then the error is real.
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      return await requestCompletion(config, messages, dropped);
    } catch (error) {
      const param = unsupportedParam(error, dropped);
      if (!param) throw error;
      dropped.add(param);
      droppedParams.set(key, new Set(dropped));
    }
  }
  throw Object.assign(new Error("The model rejected every supported parameter combination."), { modelError: { code: "model_invalid_request", providerStatus: 400 } });
}

export async function testModelConnection(config) {
  const result = await callJsonModel(config, [
    { role: "system", content: "Return JSON only: {\"ok\":true}." },
    { role: "user", content: "Connection test." }
  ]);
  return Boolean(result?.ok);
}

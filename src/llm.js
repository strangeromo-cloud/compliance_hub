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

function extractJson(text) {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const object = text.match(/\{[\s\S]*\}/);
    if (object) return JSON.parse(object[0]);
    throw new Error("The model did not return valid JSON.");
  }
}

async function requestCompletion(config, messages, jsonMode = true) {
  const endpoint = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const body = {
    model: config.model,
    messages,
    temperature: 0.1
  };
  if (jsonMode) body.response_format = { type: "json_object" };

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

export async function callJsonModel(config, messages) {
  try {
    return await requestCompletion(config, messages, true);
  } catch (error) {
    const unsupportedJsonMode = error.status === 400 && /response_format|json/i.test(error.message);
    if (!unsupportedJsonMode) throw error;
    return requestCompletion(config, messages, false);
  }
}

export async function testModelConnection(config) {
  const result = await callJsonModel(config, [
    { role: "system", content: "Return JSON only: {\"ok\":true}." },
    { role: "user", content: "Connection test." }
  ]);
  return Boolean(result?.ok);
}

/*
 * ONLYOFFICE AI Agent — Custom Provider template (OpenAI-compatible)
 *
 * Use this file as a starting point for adding your own AI provider.
 * The plugin evaluates the file inside a sandbox where the following
 * symbols are already in scope (no `import` statements required):
 *
 *   AbstractBaseProvider — the base class to extend.
 *   ProviderErrors       — { invalidKey, emptyKey, invalidUrl, connectionFailed } factories.
 *   mapFetchError        — turns thrown fetch errors into the SDK error shape.
 *
 * The file MUST end with `return Provider;` so the plugin can pick up
 * your class. Inside the class:
 *
 *   - sendMessage(args)        — async generator, yields ThreadMessageLike snapshots.
 *   - sendMessageSync(args)    — non-streaming Promise<string>.
 *   - imageGeneration(args)    — optional, Promise<string> (URL or base64).
 *   - static getName()         — display name shown in the profile picker.
 *   - static getBaseUrl()      — default base URL used when the user creates a profile.
 *   - static checkProvider(creds)      — validate { baseUrl, apiKey }; return `true` or a ProviderErrors.* object.
 *   - static getProviderModels(creds)  — list available models.
 *
 * args shapes (see node_modules/@onlyoffice/ai-chat/dist/shared/*.d.ts):
 *
 *   SendMessageArgs     = { messages, model, systemPrompt, tools?, withReasoning?, signal? }
 *   SendMessageSyncArgs = { messages, model, systemPrompt, signal? }
 *   ImageGenerationArgs = { model, prompt, width?, height?, signal? }
 *
 * Capabilities bitmask (returned per Model in getProviderModels):
 *   1  = Chat
 *   2  = Image generation
 *   4  = Vision (image input)
 *   8  = Tools (function calling)
 *   16 = Embeddings
 *
 * Combine with `|` (e.g. `1 | 4 | 8` for chat + vision + tools).
 */

const PROVIDER_NAME = "My OpenAI";
const PROVIDER_BASE_URL = "https://api.openai.com/v1";

const CAP_CHAT = 1;
const CAP_VISION = 4;
const CAP_TOOLS = 8;

class Provider extends AbstractBaseProvider {
  // creds is { baseUrl, apiKey } — store for later, AbstractBaseProvider does this for us via this.creds.
  constructor(creds) {
    super(creds);
  }

  // ── streaming chat ──────────────────────────────────────────────────────
  async *sendMessage({ messages, model, systemPrompt, tools, signal }) {
    const body = {
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(toOpenAIMessage),
      ],
    };
    if (tools && tools.length) {
      body.tools = tools.map(toOpenAITool);
    }

    let res;
    try {
      res = await fetch(`${this.creds.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw mapFetchError(err, !!this.creds.apiKey);
    }
    if (!res.ok) {
      throw mapFetchError(
        new Error(await res.text().catch(() => res.statusText)),
        !!this.creds.apiKey
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const acc = {
      role: "assistant",
      content: [{ type: "text", text: "" }],
    };
    const toolCallsByIndex = new Map();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;

        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.content === "string" && delta.content.length) {
          acc.content[0].text += delta.content;
          yield cloneSnapshot(acc, toolCallsByIndex);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const slot = toolCallsByIndex.get(idx) ?? {
              id: "",
              name: "",
              args: "",
            };
            if (tc.id) slot.id = tc.id;
            if (tc.function?.name) slot.name += tc.function.name;
            if (tc.function?.arguments) slot.args += tc.function.arguments;
            toolCallsByIndex.set(idx, slot);
          }
          yield cloneSnapshot(acc, toolCallsByIndex);
        }
      }
    }

    yield {
      isEnd: true,
      responseMessage: cloneSnapshot(acc, toolCallsByIndex),
    };
  }

  // ── non-streaming sync ──────────────────────────────────────────────────
  async sendMessageSync({ messages, model, systemPrompt, signal }) {
    let res;
    try {
      res = await fetch(`${this.creds.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(toOpenAIMessage),
          ],
        }),
        signal,
      });
    } catch (err) {
      throw mapFetchError(err, !!this.creds.apiKey);
    }
    if (!res.ok) {
      throw mapFetchError(
        new Error(await res.text().catch(() => res.statusText)),
        !!this.creds.apiKey
      );
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  }

  // ── optional: image generation ──────────────────────────────────────────
  async imageGeneration({ model, prompt, width, height, signal }) {
    const size = width && height ? `${width}x${height}` : "1024x1024";
    let res;
    try {
      res = await fetch(`${this.creds.baseUrl}/images/generations`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal,
      });
    } catch (err) {
      throw mapFetchError(err, !!this.creds.apiKey);
    }
    if (!res.ok) {
      throw mapFetchError(
        new Error(await res.text().catch(() => res.statusText)),
        !!this.creds.apiKey
      );
    }
    const json = await res.json();
    const item = json.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return item?.url ?? "";
  }

  headers() {
    const h = { "Content-Type": "application/json" };
    if (this.creds.apiKey) h.Authorization = `Bearer ${this.creds.apiKey}`;
    return h;
  }

  // ── statics required by the SDK ─────────────────────────────────────────
  static getName() {
    return PROVIDER_NAME;
  }
  static getBaseUrl() {
    return PROVIDER_BASE_URL;
  }

  static async checkProvider({ baseUrl, apiKey }) {
    if (!baseUrl) return ProviderErrors.invalidUrl();
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (res.status === 401 || res.status === 403)
        return ProviderErrors.invalidKey();
      if (!res.ok) return ProviderErrors.connectionFailed();
      return true;
    } catch (err) {
      return mapFetchError(err, !!apiKey);
    }
  }

  static async getProviderModels({ baseUrl, apiKey }) {
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json) ? json : json.data ?? [];
    return list
      .filter((m) => typeof m?.id === "string")
      .map((m) => ({
        id: m.id,
        name: m.id,
        provider: PROVIDER_NAME,
        capabilities: capabilitiesFor(m.id),
      }));
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

// Convert a ThreadMessageLike from @assistant-ui to an OpenAI chat message.
// Vision: pass image attachments through as image_url parts.
function toOpenAIMessage(msg) {
  const role = msg.role === "assistant" ? "assistant" : "user";
  const content = [];
  let text = "";
  if (typeof msg.content === "string") {
    text = msg.content;
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        text += part.text;
      } else if (part?.type === "image" && (part.image || part.url)) {
        content.push({
          type: "image_url",
          image_url: { url: part.image || part.url },
        });
      }
    }
  }
  if (text) content.unshift({ type: "text", text });
  return {
    role,
    content: content.length === 1 && content[0].type === "text" ? text : content,
  };
}

// Convert an SDK TMCPItem tool descriptor to OpenAI tool schema.
function toOpenAITool(item) {
  return {
    type: "function",
    function: {
      name: item.name,
      description: item.description ?? "",
      parameters: item.inputSchema ?? { type: "object", properties: {} },
    },
  };
}

// Snapshot the current accumulated assistant message (text + tool_calls).
// The widget renders successive snapshots; we must clone so future mutations
// don't leak into past frames.
function cloneSnapshot(acc, toolCallsByIndex) {
  const content = acc.content.map((p) => ({ ...p }));
  if (toolCallsByIndex.size > 0) {
    const calls = [...toolCallsByIndex.values()].map((c) => ({
      id: c.id,
      name: c.name,
      args: c.args,
    }));
    content.push({ type: "tool-call", calls });
  }
  return { role: acc.role, content };
}

// Heuristic: assign capability bits based on the model id.
function capabilitiesFor(id) {
  const lower = id.toLowerCase();
  if (lower.includes("embedding")) return 16;
  if (lower.includes("dall-e") || lower.includes("image")) return 2;
  let caps = CAP_CHAT;
  if (lower.startsWith("gpt-4") || lower.includes("o1") || lower.includes("o3"))
    caps |= CAP_VISION | CAP_TOOLS;
  if (lower.startsWith("gpt-3.5")) caps |= CAP_TOOLS;
  return caps;
}

return Provider;

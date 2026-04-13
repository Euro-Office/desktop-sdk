# Provider Compatibility Analysis: ai-agent vs Legacy AI Plugin

> **Задача**: определить, что нужно изменить/добавить в `AbstractBaseProvider` (ai-agent), чтобы обеспечить совместимость с legacy-плагином (`onlyoffice.github.io/sdkjs-plugins/content/ai`).

---

## 1. Архитектурные различия

### Legacy Plugin (`AI.Provider`)
- **Язык**: ES6 class, no types, prototype-based
- **Парадигма**: Template Method — base class определяет контракт, engine.js оркестрирует через `AI.Request`
- **HTTP слой**: Ручной fetch + SSE parsing + proxy support — провайдер НЕ делает запросы, а только формирует headers/body/url
- **Streaming**: Ручной SSE-парсинг `data: {...}\n` через `FetchReader` + `getStreamedResult()`
- **Tools**: Провайдер просто добавляет tools в body (`addTools()`) и извлекает из response (`getToolCallsResult()`). Agent loop — в `register.js`
- **Scope**: Покрывает ВСЁ: chat, completions, images, vision, OCR, embeddings, audio, moderation, realtime

### ai-agent (`AbstractBaseProvider<TOOL, MESSAGE, CLIENT>`)
- **Язык**: TypeScript, generics, abstract classes
- **Парадигма**: Self-contained — провайдер сам делает запросы через SDK-клиент, сам стримит
- **HTTP слой**: SDK (Anthropic SDK, OpenAI SDK, etc.) — клиент внутри провайдера
- **Streaming**: `async *sendMessage()` — async generators, SDK стримы
- **Tools**: Провайдер конвертирует tools в свой формат (`setTools()`), стримит tool calls, возвращает результат через `sendMessageAfterToolCall()`
- **Scope**: Только chat + tools + reasoning. Нет images, vision, OCR, audio, embeddings

---

## 2. Сравнительная таблица методов

### 2.1 Методы, которые есть в Legacy, но ОТСУТСТВУЮТ в ai-agent

| Legacy метод | Назначение | Нужен ли |
|---|---|---|
| `getModels()` | Хардкодный список моделей (без API-запроса) | **Нет** — `getProviderModels()` покрывает |
| `correctModelInfo(model)` | Нормализация model.id/model.name из API | **Нет** — SDK нормализует |
| `checkExcludeModel(model)` | Фильтрация моделей из UI | **Нет** — фильтрация на стороне UI |
| `checkModelCapability(model)` | Bitmask capabilities (Chat, Image, Vision, Tools...) | **ДА** — нужен для editor integration |
| `getEndpointUrl(endpoint, model, options)` | Формирование URL для разных endpoint types | **ДА** — если нужны не-chat endpoints |
| `getRequestBodyOptions(body)` | Дополнительные параметры к body | **Нет** — SDK формирует body |
| `getRequestHeaderOptions()` | HTTP headers | **Нет** — SDK формирует headers |
| `isUseProxy()` | Нужен ли CORS proxy | **ДА** — для browser environment |
| `isOnlyDesktop()` | Только для Desktop Editor | **Возможно** — для фильтрации |
| `getChatCompletions(message, model)` | Формирование body для chat | **Нет** — SDK |
| `getCompletions(message, model)` | Формирование body для legacy completions | **Нет** — устаревший API |
| `getChatCompletionsResult(message, model, isTrim)` | Парсинг ответа chat | **Нет** — SDK парсит |
| `getImageSizesInput(model)` | Допустимые размеры входных изображений | **ДА** |
| `getImageSizesOutput(model)` | Допустимые размеры выходных изображений | **ДА** |
| `getImageGeneration(message, model)` | Body для генерации изображений | **ДА** |
| `getImageGenerationResult(message, model)` | Парсинг ответа image generation | **ДА** |
| `getImageVision(message, model)` | Body для vision (анализ изображений) | **ДА** |
| `getImageVisionResult(message, model)` | Парсинг ответа vision | **ДА** |
| `getImageOCR(message, model)` | Body для OCR | **ДА** |
| `getImageOCRResult(message, model)` | Парсинг ответа OCR | **ДА** |
| `isSupportTools(model, modelUI)` | Поддержка нативных tools | **Частично** — у нас tools всегда через SDK |
| `addTools(body, tools)` | Добавление tools в body | **Нет** — SDK |
| `getToolCallsResult(message)` | Извлечение tool calls из ответа | **Нет** — SDK парсит |
| `createInstance(name, url, key, addon)` | Factory-метод | **Нет** — registry |
| `createDuplicate(overrideUrl)` | Клонирование | **Нет** |
| `correctModelId(id)` | Удаление external prefix | **Нет** |
| `getSystemMessage(message, isRemove)` | Извлечение system message | **Нет** — управляется через `setSystemPrompt()` |

### 2.2 Методы ai-agent, которых НЕТ в Legacy

| ai-agent метод | Назначение | Аналог в Legacy |
|---|---|---|
| `setProvider(provider)` | Инициализация SDK-клиента | Constructor + `createInstance()` |
| `setPrevMessages(messages)` | Конвертация истории | Нет — history передается в каждом request |
| `setTools(tools)` | Конвертация tools в формат провайдера | `addTools()` — но на лету, не хранит |
| `sendMessage(...)` | Async generator streaming | `_chatRequest()` + `streamFunc` callback |
| `sendMessageAfterToolCall(...)` | Продолжение после tool call | Agent loop в `register.js` |
| `createChatName(message)` | Генерация названия чата | Нет |
| `getName()` | Display name провайдера | `this.name` |
| `getBaseUrl()` | Default base URL | `this.url` |
| `checkProvider(data)` | Валидация credentials | Нет (проверка через first request) |
| `stopMessage()` | Остановка стрима | `AgentState.isStopped` |

---

## 3. Что нужно добавить в AbstractBaseProvider

### 3.1 Capability System (КРИТИЧНО)

Legacy использует bitmask capabilities для определения, что модель умеет. Это КЛЮЧЕВОЙ механизм для editor integration — редактор смотрит на capabilities, чтобы понять, какие кнопки показывать (генерация изображений, OCR, translation и т.д.).

```typescript
// Новый enum — полная совместимость с legacy AI.CapabilitiesUI
export const CapabilitiesUI = {
  None:        0x00,
  Chat:        0x01,
  Image:       0x02,
  Embeddings:  0x04,
  Audio:       0x08,
  Moderations: 0x10,
  Realtime:    0x20,
  Code:        0x40,
  Vision:      0x80,
  Tools:       0x100,
  All:         0x1FF,
} as const;

type Capabilities = number; // bitmask from CapabilitiesUI

// Добавить в AbstractBaseProvider:
abstract getModelCapabilities(model: Model): Capabilities;
```

**Почему**: Без capabilities редактор не знает, что модель умеет. Нельзя назначить модель на Image Generation, если нет `CapabilitiesUI.Image` flag.

### 3.2 Image Operations (КРИТИЧНО для editor integration)

Legacy поддерживает 3 типа image-операций, которых нет в ai-agent:

```typescript
// Новые абстрактные методы:

// Генерация изображений по текстовому описанию
abstract imageGeneration?(message: {
  prompt: string;
  width?: number;
  height?: number;
  background?: string;
  quality?: string;
}): Promise<string>; // returns base64 image

// Vision — анализ изображения
abstract imageVision?(message: {
  image: string;  // base64 or URL
  prompt: string;
}): Promise<string>; // returns text description

// OCR — распознавание текста с изображения
abstract imageOCR?(message: {
  image: string;  // base64
}): Promise<string>; // returns recognized text

// Размеры изображений
getImageSizesInput?(model: Model): Array<{ w: number; h: number }>;
getImageSizesOutput?(model: Model): Array<{ w: number; h: number }>;
```

**Почему**: Кнопки "Сгенерировать изображение", "Распознать текст", "Описать картинку" в toolbar редактора вызывают именно эти методы через `AI.Request.imageGenerationRequest()` / `imageVisionRequest()` / `imageOCRRequest()`.

### 3.3 Action Types (ВАЖНО)

Legacy разделяет 7 типов действий, каждому из которых можно назначить свою модель:

```typescript
export type ActionType =
  | "Chat"
  | "Summarization"
  | "Translation"
  | "TextAnalyze"
  | "ImageGeneration"
  | "OCR"
  | "Vision";
```

В ai-agent это уже частично есть через Model Assignment (7 task-specific profiles). Нужно обеспечить, чтобы mapping между ними был корректным.

### 3.4 Proxy Support (ВАЖНО для web version)

Legacy имеет proxy-механизм для CORS:

```typescript
// Добавить в base:
isUseProxy(): boolean { return false; }

// Или общий механизм:
abstract getRequestConfig(): {
  useProxy: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
};
```

**Почему**: В web-версии ONLYOFFICE (не Desktop) запросы к API не могут идти напрямую из-за CORS. Legacy использует `https://plugins-services.onlyoffice.com/proxy` как прокси. ai-agent сейчас использует SDK с `dangerouslyAllowBrowser: true`, что работает только когда API разрешает CORS (а большинство НЕ разрешает в production).

### 3.5 Non-streaming Request Support (ВАЖНО)

Legacy поддерживает non-streaming запросы (для actions вроде summarization, translation, text analysis — когда не нужно стримить, а нужно получить полный ответ за раз):

```typescript
// Сейчас в ai-agent ТОЛЬКО streaming через async generators.
// Нужно добавить:
abstract sendMessageSync?(
  messages: ThreadMessageLike[]
): Promise<string>; // returns complete text response
```

**Почему**: Actions вроде summarization, translation, grammar check не нуждаются в streaming и работают через `chatRequest()` без `streamFunc`.

### 3.6 Token Budget Management (ЖЕЛАТЕЛЬНО)

Legacy управляет контекстным окном:

```typescript
// В legacy:
// - Читает model.options.max_input_tokens
// - Разбивает длинные сообщения на chunks с маркерами [START PART n/N]
// - Дефолт: 32k tokens

// Добавить в Model type:
export type Model = {
  id: string;
  name: string;
  provider: ProviderType;
  reasoning?: boolean;
  maxInputTokens?: number;  // NEW
  maxOutputTokens?: number; // NEW
  contextWindow?: number;   // NEW
};
```

**Почему**: Без token budgeting длинные документы просто обрезаются или вызывают ошибку API.

---

## 4. Adapter/Wrapper Architecture

Для совместимости нужен **адаптер**, который оборачивает наш `AbstractBaseProvider` в интерфейс, совместимый с `AI.Provider` legacy-плагина.

### 4.1 Направление адаптации

Есть два варианта:

#### Вариант A: Legacy → ai-agent (обертка legacy провайдера в наш интерфейс)
- **Когда**: Если legacy-плагин вызывает наш код
- **Нужна обертка**: `LegacyProviderAdapter extends AbstractBaseProvider`

#### Вариант B: ai-agent → Legacy (наш провайдер отвечает на legacy-запросы)
- **Когда**: Если редактор (editor) отправляет запросы через legacy event API (`ai_onCallTool`, `onChatMessage`, etc.)
- **Нужна обертка**: `EditorBridge` — слушает editor events, проксирует в наш provider

#### Вариант C: Полный bridge (РЕКОМЕНДУЕМЫЙ)
- `EditorBridge` на уровне event API
- Внутри использует наш provider system
- Экспортирует совместимый интерфейс для `AI.Request`-подобных вызовов

### 4.2 Предлагаемая структура адаптера

```
src/
├── bridge/
│   ├── editor-bridge.ts          # Main bridge: editor events ↔ our providers
│   ├── legacy-adapter.ts         # Wraps AbstractBaseProvider as AI.Provider
│   ├── capabilities.ts           # CapabilitiesUI enum + model capability detection
│   ├── request-adapter.ts        # AI.Request-compatible wrapper
│   ├── image-operations.ts       # Image generation/vision/OCR via our providers
│   ├── action-types.ts           # ActionType mapping
│   └── proxy.ts                  # Proxy support for web environment
```

### 4.3 LegacyAdapter — детальная схема

```typescript
/**
 * Адаптирует наш AbstractBaseProvider<TOOL, MESSAGE, CLIENT>
 * к интерфейсу, ожидаемому legacy AI.Request и editor integration.
 *
 * Legacy AI.Provider — это "пассивный" объект:
 *   - Он НЕ делает запросы сам
 *   - Он формирует headers, body, url
 *   - Запросы делает AI.Request через requestWrapper()
 *
 * Наш AbstractBaseProvider — "активный" объект:
 *   - Он сам делает запросы через SDK
 *   - Он сам стримит через async generators
 *   - Он сам парсит ответы
 *
 * Adapter должен:
 *   1. Принимать вызовы в legacy-формате
 *   2. Проксировать их в наш провайдер
 *   3. Возвращать результат в legacy-формате
 */
class LegacyAdapter {
  constructor(
    private provider: AbstractBaseProvider<any, any, any>,
    private providerConfig: TProvider
  ) {}

  // ====== IDENTITY ======
  
  get name(): string { return this.provider.getName(); }
  get url(): string { return this.provider.getBaseUrl(); }
  get key(): string { return this.providerConfig.key || ""; }
  get addon(): string { return ""; } // SDK не использует addon

  // ====== MODELS ======

  /**
   * Legacy вызывает: AI.getModels(provider) → requestWrapper(GET /models)
   * Adapter вызывает: this.provider.getProviderModels()
   * 
   * Разница: Legacy получает raw JSON, нормализует через correctModelInfo(),
   * фильтрует через checkExcludeModel(), назначает capabilities.
   * Наш provider уже возвращает нормализованный Model[].
   */
  async getModels(): Promise<LegacyModel[]> {
    const models = await this.provider.getProviderModels({
      url: this.url,
      apiKey: this.key,
    });
    return models.map(m => this.toLegacyModel(m));
  }

  private toLegacyModel(model: Model): LegacyModel {
    return {
      id: model.id,
      name: model.name || model.id,
      provider: this.name,
      endpoints: [EndpointTypes.Chat_Completions],
      options: {
        max_input_tokens: model.maxInputTokens || 32768,
      },
    };
  }

  // ====== CAPABILITIES ======

  /**
   * Legacy: provider.checkModelCapability(model) → bitmask
   * Нужно: определить capabilities по модели
   */
  checkModelCapability(model: LegacyModel): number {
    let caps = CapabilitiesUI.Chat;

    // Все SDK-провайдеры поддерживают tools
    caps |= CapabilitiesUI.Tools;

    // Vision — если модель поддерживает multimodal input
    if (this.isVisionModel(model.id)) {
      caps |= CapabilitiesUI.Vision;
    }

    // Image generation — только для определенных моделей
    if (this.isImageModel(model.id)) {
      caps |= CapabilitiesUI.Image;
    }

    return caps;
  }

  // ====== CHAT ======

  /**
   * Legacy flow:
   *   1. AI.Request._chatRequest() формирует objRequest
   *   2. Вызывает provider.getChatCompletions(message, model) → body
   *   3. Отправляет через requestWrapper/requestWrapperStream
   *   4. Парсит через provider.getChatCompletionsResult()
   *
   * Adapter flow:
   *   1. Принимает messages в legacy формате
   *   2. Конвертирует в ThreadMessageLike[]
   *   3. Вызывает this.provider.sendMessage()
   *   4. Собирает результат из async generator
   *   5. Возвращает в legacy формате { content: ["response text"] }
   */
  async chatRequest(
    messages: LegacyMessage[],
    streamFunc?: (text: string) => Promise<boolean>
  ): Promise<{ content: string[] }> {
    const threadMessages = this.convertMessages(messages);
    
    this.provider.setPrevMessages([]);
    const generator = this.provider.sendMessage(threadMessages);

    let fullText = "";
    for await (const chunk of generator) {
      if ("isEnd" in chunk) {
        // Final message
        fullText = this.extractText(chunk.responseMessage);
        break;
      }
      
      // Intermediate streaming chunk
      const chunkText = this.extractText(chunk);
      if (streamFunc) {
        const shouldStop = await streamFunc(chunkText);
        if (shouldStop) {
          this.provider.stopMessage();
          break;
        }
      }
      fullText = chunkText;
    }

    return { content: [fullText] };
  }

  /**
   * Legacy flow (agent):
   *   1. AI.Request._chatRequestAgent() → добавляет tools в body
   *   2. Стримит ответ, собирает tool_calls
   *   3. Возвращает { content, tool_calls, raw }
   *
   * Adapter flow:
   *   1. Конвертирует tools + messages
   *   2. Вызывает sendMessage()
   *   3. Детектирует tool calls в ответе
   *   4. Возвращает в legacy формате
   */
  async chatRequestAgent(
    messages: LegacyMessage[],
    tools: LegacyTool[],
    streamFunc?: (text: string) => Promise<boolean>
  ): Promise<{
    content: string;
    tool_calls: LegacyToolCall[] | null;
  }> {
    // Convert tools to our format
    const mcpTools: TMCPItem[] = tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
    }));
    this.provider.setTools(mcpTools);

    const threadMessages = this.convertMessages(messages);
    const generator = this.provider.sendMessage(threadMessages);

    let responseMessage: ThreadMessageLike | null = null;
    for await (const chunk of generator) {
      if ("isEnd" in chunk) {
        responseMessage = chunk.responseMessage;
        break;
      }
      // Stream text chunks if callback provided
      if (streamFunc) {
        const text = this.extractText(chunk);
        const shouldStop = await streamFunc(text);
        if (shouldStop) {
          this.provider.stopMessage();
          break;
        }
      }
    }

    if (!responseMessage) {
      return { content: "", tool_calls: null };
    }

    // Extract tool calls from response
    const toolCalls = this.extractToolCalls(responseMessage);
    const content = this.extractText(responseMessage);

    return {
      content,
      tool_calls: toolCalls,
    };
  }

  // ====== IMAGE OPERATIONS ======

  /**
   * Legacy: provider.getImageGeneration(message, model) → body
   * Adapter: Проксирует через chat с промптом, или через
   * специализированный SDK метод (DALL-E via OpenAI, etc.)
   */
  async imageGeneration(message: {
    prompt: string;
    width?: number;
    height?: number;
  }): Promise<string> {
    // Реализация зависит от провайдера.
    // OpenAI → client.images.generate()
    // Anthropic → нет нативного API, через chat с промптом
    // etc.
    throw new Error("Image generation not supported for this provider");
  }

  /**
   * Legacy: provider.getImageVision(message, model) → body
   * Adapter: Отправляет изображение как часть сообщения
   */
  async imageVision(message: {
    image: string;
    prompt: string;
  }): Promise<string> {
    const threadMessage: ThreadMessageLike = {
      role: "user",
      content: [
        { type: "text", text: message.prompt },
        { type: "image", image: message.image },
      ],
    };

    const generator = this.provider.sendMessage([threadMessage]);
    let result = "";
    for await (const chunk of generator) {
      if ("isEnd" in chunk) {
        result = this.extractText(chunk.responseMessage);
      }
    }
    return result;
  }

  /**
   * Legacy: provider.getImageOCR(message, model) → uses getImageVision with OCR prompt
   * Adapter: То же самое — vision с OCR-промптом
   */
  async imageOCR(message: { image: string }): Promise<string> {
    return this.imageVision({
      image: message.image,
      prompt: "Please perform OCR on this image. Extract all text exactly as it appears.",
    });
  }

  // ====== TOOL CALL CONTINUATION ======

  /**
   * Legacy flow:
   *   1. Agent loop получает tool_calls от модели
   *   2. Выполняет каждый tool call
   *   3. Добавляет tool result в messages как { role: "tool", tool_call_id, content }
   *   4. Отправляет новый request с обновленными messages
   *
   * Adapter flow:
   *   1. Принимает tool result
   *   2. Формирует ThreadMessageLike с tool-call result
   *   3. Вызывает sendMessageAfterToolCall()
   */
  async continueAfterToolCall(
    toolCallId: string,
    toolName: string,
    result: string,
    originalMessage: ThreadMessageLike,
    streamFunc?: (text: string) => Promise<boolean>
  ): Promise<{
    content: string;
    tool_calls: LegacyToolCall[] | null;
  }> {
    // Update original message with tool result
    const content = Array.isArray(originalMessage.content)
      ? originalMessage.content
      : [];
    
    // Find matching tool-call and set result
    for (const part of content) {
      if (
        typeof part === "object" &&
        "type" in part &&
        part.type === "tool-call" &&
        part.toolCallId === toolCallId
      ) {
        part.result = result;
      }
    }

    const generator = this.provider.sendMessageAfterToolCall(originalMessage);
    
    let responseMessage: ThreadMessageLike | null = null;
    for await (const chunk of generator) {
      if ("isEnd" in chunk) {
        responseMessage = chunk.responseMessage;
        break;
      }
      if (streamFunc) {
        const text = this.extractText(chunk);
        await streamFunc(text);
      }
    }

    if (!responseMessage) {
      return { content: "", tool_calls: null };
    }

    return {
      content: this.extractText(responseMessage),
      tool_calls: this.extractToolCalls(responseMessage),
    };
  }

  // ====== CONVERSION HELPERS ======

  /**
   * Legacy message format → ThreadMessageLike
   *
   * Legacy:
   *   { role: "user"|"assistant"|"system"|"developer"|"tool",
   *     content: string,
   *     tool_calls?: [...],
   *     tool_call_id?: string }
   *
   * ai-agent (ThreadMessageLike):
   *   { role: "user"|"assistant"|"system",
   *     content: string | ContentPart[] }
   */
  private convertMessages(messages: LegacyMessage[]): ThreadMessageLike[] {
    return messages
      .filter(m => m.role !== "developer") // developer role → system
      .map(m => {
        if (m.role === "tool") {
          // Tool results need to be attached to the previous assistant message
          // This is handled differently — skip here, handled in history
          return null;
        }

        const role = m.role === "developer" ? "system" : m.role;

        if (typeof m.content === "string") {
          return { role, content: m.content } as ThreadMessageLike;
        }

        // Array content (multimodal)
        const parts = m.content.map((c: any) => {
          if (c.type === "text") return { type: "text" as const, text: c.text };
          if (c.type === "image_url") return { type: "image" as const, image: c.image_url.url };
          return { type: "text" as const, text: JSON.stringify(c) };
        });

        return { role, content: parts } as ThreadMessageLike;
      })
      .filter(Boolean) as ThreadMessageLike[];
  }

  /**
   * ThreadMessageLike → текст
   */
  private extractText(message: ThreadMessageLike): string {
    if (typeof message.content === "string") return message.content;
    if (!Array.isArray(message.content)) return "";

    return message.content
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }

  /**
   * ThreadMessageLike → LegacyToolCall[]
   */
  private extractToolCalls(message: ThreadMessageLike): LegacyToolCall[] | null {
    if (!Array.isArray(message.content)) return null;

    const toolCalls = message.content
      .filter((p: any) => p.type === "tool-call")
      .map((p: any) => ({
        id: p.toolCallId,
        type: "function" as const,
        function: {
          name: p.toolName,
          arguments: typeof p.args === "string" ? p.args : JSON.stringify(p.args),
        },
      }));

    return toolCalls.length > 0 ? toolCalls : null;
  }
}
```

---

## 5. EditorBridge — интеграция с редактором

Legacy-плагин общается с редактором через event API. Нужен bridge, который слушает эти events и проксирует вызовы в наш provider system.

```typescript
/**
 * EditorBridge — мост между editor event API и нашей provider system.
 *
 * Слушает events от редактора:
 *   - onChatMessage → provider.sendMessage()
 *   - ai_onCallTool → provider tool execution
 *   - onContextMenuClick → action-specific requests
 *
 * Отправляет events в редактор:
 *   - onChatReply / onChatStreamEnd
 *   - onToolCallStart / onToolCallEnd
 */
class EditorBridge {
  private adapter: LegacyAdapter;
  private agentState: {
    maxIterations: number;  // Legacy: 10
    isStopped: boolean;
    tools: LegacyTool[];
  };

  constructor(provider: AbstractBaseProvider<any, any, any>) {
    this.adapter = new LegacyAdapter(provider, ...);
    this.agentState = { maxIterations: 10, isStopped: false, tools: [] };
  }

  /**
   * Agent loop — эквивалент register.js:183-364
   *
   * Отличие от legacy:
   *   Legacy: loop в register.js, вызывает chatRequestAgent() повторно
   *   Наш:   sendMessage() + sendMessageAfterToolCall() уже integrated
   *
   * Но для совместимости с EditorHelper (tools из редактора)
   * нужно воспроизвести loop:
   */
  async runAgentLoop(
    messages: LegacyMessage[],
    tools: LegacyTool[],
    streamFunc?: (text: string) => Promise<boolean>
  ): Promise<string> {
    let iteration = 0;
    let currentMessages = [...messages];

    while (iteration < this.agentState.maxIterations && !this.agentState.isStopped) {
      iteration++;

      const result = await this.adapter.chatRequestAgent(
        currentMessages, tools, streamFunc
      );

      if (!result.tool_calls || result.tool_calls.length === 0) {
        return result.content;
      }

      // Execute tool calls
      for (const toolCall of result.tool_calls) {
        // Emit event to editor
        this.emitEvent("onToolCallStart", { toolCall });

        // Execute via EditorHelper (legacy system)
        const toolResult = await this.executeToolCall(toolCall);

        this.emitEvent("onToolCallEnd", { toolCall, result: toolResult });

        // Add to message history (legacy format)
        currentMessages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: [toolCall],
        });
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
        });
      }
    }

    return "";
  }
}
```

---

## 6. Изменения в AbstractBaseProvider

### 6.1 Новые abstract методы

```typescript
export abstract class AbstractBaseProvider<TOOL, MESSAGE, CLIENT> {
  // ... existing methods ...

  // === NEW: Capability detection ===
  abstract getModelCapabilities(modelId: string): number; // CapabilitiesUI bitmask

  // === NEW: Image operations (optional — not all providers support) ===
  supportsImageGeneration(): boolean { return false; }
  supportsVision(): boolean { return false; }
  supportsOCR(): boolean { return false; }

  async imageGeneration?(message: ImageGenerationRequest): Promise<string>;
  async imageVision?(message: ImageVisionRequest): Promise<string>;
  async imageOCR?(message: ImageOCRRequest): Promise<string>;

  // === NEW: Non-streaming request ===
  async sendMessageSync?(messages: ThreadMessageLike[]): Promise<string>;

  // === NEW: Proxy configuration ===
  isUseProxy(): boolean { return false; }
  getProxyUrl(): string { return "https://plugins-services.onlyoffice.com/proxy"; }

  // === NEW: Desktop-only flag ===
  isOnlyDesktop(): boolean { return false; }
}
```

### 6.2 Новые типы

```typescript
// Image operation types
export type ImageGenerationRequest = {
  prompt: string;
  width?: number;
  height?: number;
  background?: string;
  quality?: string;
};

export type ImageVisionRequest = {
  image: string;  // base64 or URL
  prompt: string;
};

export type ImageOCRRequest = {
  image: string;  // base64
};

// Legacy compatibility types
export type LegacyMessage = {
  role: "user" | "assistant" | "system" | "developer" | "tool";
  content: string | any[];
  tool_calls?: LegacyToolCall[];
  tool_call_id?: string;
};

export type LegacyToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
};

export type LegacyTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
};

export type LegacyModel = {
  id: string;
  name: string;
  provider: string;
  endpoints: number[];
  options: { max_input_tokens?: number };
};
```

---

## 7. Критические расхождения, требующие внимания

### 7.1 Message Format

| Аспект | Legacy | ai-agent |
|--------|--------|----------|
| System message | В массиве messages как `{ role: "system" }` | Отдельно через `setSystemPrompt()` |
| Developer role | `{ role: "developer" }` — приоритетный system | Нет аналога |
| Tool results | `{ role: "tool", tool_call_id, content }` | Внутри `tool-call` part как `result` |
| Multimodal | `{ type: "image_url", image_url: { url } }` | `{ type: "image", image: "..." }` |
| Files | Нет нативной поддержки | `{ type: "file", data, mimeType }` |
| Reasoning | `<think>...</think>` tags в text | `{ type: "reasoning", text }` |

### 7.2 Streaming

| Аспект | Legacy | ai-agent |
|--------|--------|----------|
| Механизм | Callback `streamFunc(text) → bool` | Async generator `yield message` |
| Формат данных | Raw text chunks | Full ThreadMessageLike on each yield |
| Остановка | Return `true` from callback | `stopMessage()` sets flag |
| SSE parsing | Manual in `getStreamedResult()` | SDK handles internally |

### 7.3 Tool Calling

| Аспект | Legacy | ai-agent |
|--------|--------|----------|
| Tool format | OpenAI-compatible `{ type: "function", function: {...} }` | TMCPItem `{ name, description, inputSchema }` |
| Tool в request | `addTools(body, tools)` мутирует body | `setTools(tools)` — preconvert + store |
| Tool execution | External — `EditorHelper.names2funcs[name].call()` | External — MCP protocol |
| Agent loop | В `register.js`, max 10 iterations | В `useMessages` hook |
| Tool result | `{ role: "tool", tool_call_id, content }` message | `result` field on `tool-call` content part |
| Args format | Always string (JSON stringified) | Object (parsed) + argsText (string) |

### 7.4 HTTP Layer

| Аспект | Legacy | ai-agent |
|--------|--------|----------|
| Client | Raw fetch + manual headers/body | SDK clients (Anthropic, OpenAI, etc.) |
| Proxy | `buildProxyRequest()` + dedicated proxy server | `dangerouslyAllowBrowser: true` |
| Desktop fetch | `AscSimpleRequest` for local providers | Standard SDK fetch |
| External fetch | `fetchExternal()` via editor events | Not supported |
| Auth | Manual `Authorization: Bearer` header | SDK handles |

---

## 8. Разделение ответственности: Provider vs Adapter

Ключевой вопрос: что реализовать **внутри наших провайдеров** (расширение `AbstractBaseProvider`), а что вынести в **конвертор/adapter** между legacy editor и нашей системой.

### 8.1 Внутри наших провайдеров (расширение AbstractBaseProvider)

Фичи, которые имеют самостоятельную ценность для ai-agent, **независимо от legacy**:

| Фича | Зачем нам самим | Как реализовать |
|------|-----------------|-----------------|
| **Capabilities bitmask** | Фильтрация моделей по action type в Model Assignment. Сейчас 7 task profiles, но нет фильтрации "покажи только image-модели для ImageGeneration" | `getProviderModels()` возвращает `ModelWithCapabilities` с полем `capabilities: number` |
| **Image Generation** | Реальная фича — генерация изображений из плагина | Новый метод `imageGeneration(prompt): Promise<string>`. OpenAI → `client.images.generate()`, остальные → через chat с промптом |
| **Image Vision** | Уже частично есть (`{ type: "image" }` в content parts). Нужно убедиться что все провайдеры корректно конвертируют | Anthropic → `source.base64`, OpenAI → `image_url`. Проверить каждый провайдер |
| **OCR** | Это просто Vision с захардкоженным промптом | Отдельный метод не нужен — helper-функция поверх vision |
| **Token limits в Model** | Отображение в UI, будущий context management | Поля `maxInputTokens`, `maxOutputTokens` в типе `Model` |

### 8.2 Конвертор / Adapter (bridge legacy editor ↔ наша система)

Фичи, нужные **только для совместимости** с legacy event API редактора:

| Фича | Что конвертируем | Направление |
|------|-----------------|-------------|
| **Message format** | Legacy `{ role: "tool", tool_call_id }` ↔ наш `{ type: "tool-call", result }`. Legacy `{ role: "developer" }` → `setSystemPrompt()`. Legacy `{ type: "image_url", image_url: { url } }` → `{ type: "image", image }` | Двусторонний |
| **Streaming** | Legacy callback `streamFunc(text) → bool` ↔ наш `async generator yield ThreadMessageLike` | Adapter подписывается на generator, вызывает streamFunc с текстом |
| **Tool format** | Legacy `{ type: "function", function: { name, description, parameters } }` ↔ `TMCPItem { name, description, inputSchema }` | Тривиальный маппинг |
| **Agent loop** | Legacy цикл в `register.js` (max 10 итераций, `EditorHelper.names2funcs[name]()`) — нужно эмулировать для editor tools (DesktopEditorTool) | Adapter воспроизводит loop |
| **Event bridge** | Слушает `onChatMessage`, `onContextMenuClick`, `ai_onCallTool` от редактора → вызовы наших провайдеров → отправляет `onChatReply`, `onToolCallStart/End` обратно | Editor → Adapter → Provider → Adapter → Editor |
| **Proxy support** | `isUseProxy()` + `buildProxyRequest()` для web-версии где CORS блокирует. Наши SDK используют `dangerouslyAllowBrowser: true`, что не работает в web-production | Adapter оборачивает fetch в proxy |
| **Token chunking** | `[START PART n/N]` — legacy workaround для длинных документов (summarization). НЕ нужно в провайдере | Adapter режет текст перед вызовом провайдера |
| **Endpoints routing** | Legacy `getEndpointUrl()` → `/chat/completions` vs `/images/generations`. У нас SDK знает endpoints | Adapter маппит legacy endpoint type в вызов нужного метода провайдера |

### 8.3 Принцип разделения

```
┌─────────────────────────────────────────────────────┐
│                    EDITOR                            │
│  (events: onChatMessage, onContextMenuClick, etc.)   │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │     ADAPTER / BRIDGE       │  ← message format, streaming,
         │                            │    tool format, agent loop,
         │  - LegacyMessageConverter  │    event bridge, proxy,
         │  - StreamingAdapter        │    token chunking,
         │  - ToolFormatConverter     │    endpoint routing
         │  - AgentLoopRunner         │
         │  - EventBridge             │
         │  - ProxyWrapper            │
         └─────────────┬──────────────┘
                       │
         ┌─────────────▼──────────────┐
         │  AbstractBaseProvider       │  ← capabilities, image generation,
         │                            │    vision, token limits
         │  - sendMessage()           │
         │  - imageGeneration()       │
         │  - getModelCapabilities()  │
         │  - getProviderModels()     │
         └────────────────────────────┘
```

**Правило**: если фича полезна ai-agent без legacy editor — она в провайдере. Если нужна только для перевода из одного формата в другой — она в adapter.

---

## 9. План имплементации (приоритеты)

### Phase 1 — Provider Extensions (внутри провайдеров)
1. **CapabilitiesUI enum** + расширение `Model` type полем `capabilities`
2. **`getProviderModels()` возвращает capabilities** для каждого провайдера
3. **`imageGeneration()`** — OpenAI (DALL-E), Stability; остальные — fallback через chat
4. **Token limits** — `maxInputTokens` / `maxOutputTokens` в Model

### Phase 2 — Adapter Layer (bridge)
5. **LegacyMessageConverter** — Legacy messages ↔ ThreadMessageLike
6. **StreamingAdapter** — `streamFunc` callback ↔ async generator
7. **ToolFormatConverter** — Legacy tool format ↔ TMCPItem
8. **EventBridge** — `onChatMessage`, `onChatReply`, `onContextMenuClick`

### Phase 3 — Full Integration
9. **AgentLoopRunner** — эмуляция legacy agent loop для editor tools
10. **ProxyWrapper** — proxy support для web version
11. **Token chunking** — `[START PART n/N]` для длинных документов

---

## 10. Резюме

**Ключевая проблема**: Legacy-плагин — "пассивный" (формирует данные, но не делает запросы). ai-agent — "активный" (сам делает запросы через SDK). Это фундаментальное архитектурное различие.

**Решение**: Двухслойная архитектура:
- **Provider layer** — расширяем capabilities, image generation, token limits (ценность независимо от legacy)
- **Adapter layer** — конвертирует форматы, эмулирует legacy agent loop, проксирует events (ценность только для интеграции с editor)

**Минимально необходимые изменения в provider**:
1. `capabilities` field в Model — bitmask
2. `imageGeneration()` — optional method
3. `maxInputTokens` / `maxOutputTokens` в Model

**Adapter берёт на себя ВСЁ остальное** — message format, streaming, tools, events, proxy, chunking.

---

## 11. Legacy Global Namespace: `window.AI`

Весь старый плагин — один глобальный объект `window.AI` с ~40 свойствами/методами. Никаких модулей, никакого DI. Провайдеры загружаются через `eval()` JS-строк.

### 11.1 Константы и типы (`base.js`)

| Свойство | Тип | Назначение |
|----------|-----|------------|
| `AI.InputMaxTokens` | `{ "4k": 4096, ..., "256k": 262144, keys[], getFloor(value) }` | Лимиты токенов + хелпер для округления вниз |
| `AI.CapabilitiesUI` | `{ None: 0x00, Chat: 0x01, ..., Tools: 0x100, All: 0x1FF }` | Bitmask флаги capabilities |
| `AI.Endpoints` | `{ Types: { v1: { Models: 0x00, Chat_Completions: 0x01, ... } } }` | Enum endpoint types |
| `AI.UI.Model(name, id, provider, capabilities)` | Constructor | UI-представление модели |
| `AI.UI.Provider(name, key, url)` | Constructor | UI-представление провайдера |
| `AI.UI.Action(name, icon, model)` | Constructor | UI-представление action |
| `AI.Provider` | Class | Base class для всех провайдеров |
| `AI.externalModelPrefix` | `"[onlyoffice_external]"` | Префикс для external model ID |

### 11.2 Provider Registry (`base.js`)

| Свойство | Тип | Назначение |
|----------|-----|------------|
| `AI.InternalProviders` | `Provider[]` | Встроенные провайдеры (OpenAI, Anthropic, ...) — загружаются из `config.json` |
| `AI.InternalCustomProviders` | `Provider[]` | Кастомные провайдеры (добавленные через JS-код пользователем) |
| `AI.ExternalCustomProviders` | `Provider[]` | Внешние провайдеры (приходят из editor events `ai_onCustomProviders`) |
| `AI.InternalCustomProvidersSources` | `{ name: jsCode }` | Исходный JS-код кастомных провайдеров (для пересоздания) |
| `AI.providersWeights` | `{ name: number }` | Порядок сортировки провайдеров в UI |
| `AI.createProviderInstance(name, url, key, addon)` | Function | **Factory** — ищет провайдер по приоритету: External → Custom → Internal → fallback `new AI.Provider()` |
| `AI.isInternalProvider(name)` | Function | Проверка: встроенный ли провайдер |
| `AI.loadInternalProviders()` | async Function | Загрузка из `config.json` + `eval()` каждого `.js` файла из `providers/internal/` |
| `AI.loadCustomProviders()` | Function | Пересоздание кастомных провайдеров из сохранённых sources |
| `AI.addCustomProvider(jsCode, isRegister)` | Function | Добавление кастомного провайдера — `eval()` JS-строки, push в массив |
| `AI.addExternalProvider(jsCode, item)` | Function | Добавление внешнего — может быть `basedOn` internal (наследует его класс) |
| `AI.removeCustomProvider(name)` | Function | Удаление + откат к internal если был override |
| `AI.getCustomProviders()` | Function | Список имён кастомных + модифицированных (с суффиксом `*`) |

### 11.3 Storage & Environment (`storage.js`, `local_storage.js`)

| Свойство | Тип | Назначение |
|----------|-----|------------|
| `AI.Storage` | Object | CRUD для localStorage (load, save, getProvider, getModelById) |
| `AI.Providers` | `{ name: Provider }` | **Активные** провайдеры — dict загруженных + сконфигурированных экземпляров |
| `AI.Models` | `UI.Model[]` | Все доступные модели (с capabilities) |
| `AI.isLocalDesktop` | `boolean` | Запущен в Desktop Editor? (проверка `AscDesktopEditor` в user agent) |
| `AI.isLocalDesktopForNotStreamedRequests` | `boolean` | Desktop + version >= 8.2.0 (для `AscSimpleRequest`) |
| `AI.isLocalUrl(url)` | Function | Проверка localhost / 127.0.0.1 |
| `AI.getDesktopLocalVersion()` | Function | Парсинг версии из user agent string |
| `AI.loadResourceAsText(url)` | async Function | XHR-загрузка текстовых ресурсов (скрипты, JSON) |
| `AI.helperTranslations` | Object | Переводы для helper function descriptions |
| `AI.loadHelperTranslations()` | async Function | Загрузка переводов из `translations/` |
| `AI.serverSettings` | `null \| { proxy, actions, models }` | Серверные настройки (для web-версии, не Desktop) |
| `AI.DEFAULT_SERVER_SETTINGS` | `null \| Object` | Дефолтные серверные настройки |
| `AI.DEFAULT_DESKTOP_MODEL` | `null \| Model` | Модель по умолчанию для Desktop |
| `AI.onLoadInternalProviders()` | Function | Callback: вызывается после загрузки — создаёт дупликаты в `AI.Providers`, вызывает `Storage.load()` |
| `AI.serializeProviders()` | Function | Сериализация активных провайдеров для localStorage |

### 11.4 Engine (`engine.js`)

| Свойство | Тип | Назначение |
|----------|-----|------------|
| `AI.Request(model)` | Constructor | **Главный класс запросов** — lookup провайдера по model, chat/agent/image/vision/OCR requests |
| `AI.TmpProviderForModels` | `Provider \| null` | Временный провайдер во время загрузки моделей (для `correctModelInfo`, `checkExcludeModel`, `checkModelCapability`) |
| `AI.PROXY_URL` | `string` | `"https://plugins-services.onlyoffice.com/proxy"` |
| `AI._getHeaders(provider)` | Function | `provider.getRequestHeaderOptions()` с fallback |
| `AI._getModelsSync(provider)` | Function | `provider.getModels()` — хардкодные модели без API |
| `AI._extendBody(provider, body)` | Function | `provider.getRequestBodyOptions()` + proxy target injection |
| `AI._getEndpointUrl(provider, endpoint, model, options)` | Function | `url + addon + provider.getEndpointUrl()` — полный URL |
| `AI.getModels(provider)` | async Function | GET `/models` → `correctModelInfo` → `checkExcludeModel` → `checkModelCapability` → `UI.Model` |
| `AI.ImageEngine` | Object | Утилиты: `getNearestImage()`, `getBlob()`, `getBase64()`, `getBase64FromUrl()`, `getMimeTypeFromBase64()`, `getContentFromBase64()` |

### 11.5 Actions (`register.js`)

| Свойство | Тип | Назначение |
|----------|-----|------------|
| `AI.ActionType` | `{ Chat, Summarization, Translation, TextAnalyze, ImageGeneration, OCR, Vision }` | Enum 7 типов действий |
| `AI.Actions` | `{ [ActionType]: ActionUI }` | Конфиг каждого action: `{ name, icon, model, capabilities }` |
| `AI.ActionsGetKeys()` | Function | Упорядоченный массив ключей (порядок = порядок в UI) |
| `AI.ActionsGetSorted()` | Function | Actions с переводами и текущим состоянием для UI |
| `AI.ActionsSave()` | Function | Сохранение в localStorage (исключая external models) |
| `AI.ActionsLoad()` | Function | Загрузка из localStorage / `serverSettings.actions` |
| `AI.ActionsChange(id, model)` | Function | Смена модели для action + save + event в editor |

**Actions → Capabilities mapping:**

```javascript
AI.Actions["Chat"]            = { capabilities: CapabilitiesUI.Chat }    // 0x01
AI.Actions["Summarization"]   = { capabilities: CapabilitiesUI.Chat }    // 0x01
AI.Actions["Translation"]     = { capabilities: CapabilitiesUI.Chat }    // 0x01
AI.Actions["TextAnalyze"]     = { capabilities: CapabilitiesUI.Chat }    // 0x01
AI.Actions["ImageGeneration"] = { capabilities: CapabilitiesUI.Image }   // 0x02
AI.Actions["OCR"]             = { capabilities: CapabilitiesUI.Vision }  // 0x80
AI.Actions["Vision"]          = { capabilities: CapabilitiesUI.Vision }  // 0x80
```

Это определяет, какие модели будут доступны в settings dropdown для каждого action: `(action.capabilities & model.capabilities) !== 0`.

### 11.6 Иерархия провайдеров (3 уровня)

```
window.AI
├── InternalProviders[]          ← загружены из config.json через eval()
│   ├── OpenAI (singleton)
│   ├── Anthropic (singleton)
│   ├── Google Gemini (singleton)
│   └── ... (14 штук)
│
├── InternalCustomProviders[]    ← добавлены через addCustomProvider(jsCode)
│   └── любой Provider extends AI.Provider
│
├── ExternalCustomProviders[]    ← добавлены через addExternalProvider(jsCode, item)
│   └── может быть basedOn internal (наследует класс)
│
└── Providers{}                  ← АКТИВНЫЕ экземпляры (dict by name)
    ├── "OpenAI": Provider { name, url, key, addon, models[], modelsUI[] }
    ├── "Anthropic": Provider { ... }
    └── "MyCustom": Provider { ... }

Приоритет поиска в createProviderInstance():
  1. ExternalCustomProviders  (высший)
  2. InternalCustomProviders
  3. InternalProviders
  4. new AI.Provider()         (fallback — пустой base class)
```

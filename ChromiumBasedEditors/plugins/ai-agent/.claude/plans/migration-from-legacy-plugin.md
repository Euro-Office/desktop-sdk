# Migration from Legacy AI Plugin

> **Цель**: ai-agent должен полностью заменить legacy AI plugin (`onlyoffice.github.io/sdkjs-plugins/content/ai`), сохранив совместимость с editor integration API и покрыв все функции, которые предоставлял старый плагин.
>
> **Контекст**: Legacy плагин — это ES6 глобальный namespace `window.AI` с ручным fetch, SSE-парсингом, eval-загрузкой провайдеров. ai-agent — TypeScript, SDK-клиенты, async generators, Zustand stores. Архитектурно несовместимы, нужен adapter layer.
>
> **Справочные материалы**:
> - [legacy-ai-plugin-analysis.md](../.claude/legacy-ai-plugin-analysis.md) — обзор legacy плагина
> - [provider-compatibility-analysis.md](../.claude/provider-compatibility-analysis.md) — сравнение провайдеров, adapter architecture
> - [capabilities-deep-dive.md](../.claude/capabilities-deep-dive.md) — система capabilities

---

## План

### 1. Capabilities + Profiles + Model Assignment

**Проблема**: Сейчас в Model Assignment все профили показываются во всех 7 task-дропдаунах. Можно назначить текстовую модель (gpt-4o) на Image Generation, а image-модель (dall-e-3) на Chat. Нет фильтрации.

**Что нужно сделать:**

#### 1.1 Capabilities enum

Добавить `npm_lib/capabilities.ts`:

```typescript
export const CapabilitiesUI = {
  None:        0x00,
  Chat:        0x01,
  Image:       0x02,
  Embeddings:  0x04,
  Audio:       0x08,
  Vision:      0x80,
  Tools:       0x100,
} as const;

export type Capabilities = number;
```

Совместим с legacy `AI.CapabilitiesUI`. Не нужны Moderations, Realtime, Code — мы их не используем.

#### 1.2 Расширить тип Model

`npm_lib/types.ts` — добавить поле `capabilities`:

```typescript
export type Model = {
  id: string;
  name: string;
  provider: ProviderType;
  reasoning?: boolean;
  capabilities?: number;      // NEW: bitmask из CapabilitiesUI
  maxInputTokens?: number;    // NEW: опционально
};
```

#### 1.3 Расширить тип Profile

`npm_lib/types.ts` — добавить `capabilities` (берётся от модели при создании профиля):

```typescript
export type Profile = {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  key?: string;
  modelId: string;
  reasoning?: boolean;
  capabilities?: number;      // NEW: capabilities модели на момент создания профиля
};
```

#### 1.4 Провайдеры возвращают capabilities в getProviderModels()

Каждый провайдер при возврате моделей обогащает их capabilities. Ниже — точный код из legacy, который нужно портировать в наши провайдеры.

##### OpenAI — хардкод по model.id

```javascript
// legacy: scripts/engine/providers/internal/openai.js
checkExcludeModel(model) {
    if (-1 !== model.id.indexOf("babbage-002") ||
        -1 !== model.id.indexOf("davinci-002"))
        return true;
    return false;
}

checkModelCapability(model) {
    if (-1 !== model.id.indexOf("whisper-1"))
        return AI.CapabilitiesUI.Audio;

    if (-1 !== model.id.indexOf("tts-1"))
        return AI.CapabilitiesUI.Audio;

    if (-1 !== model.id.indexOf("embedding"))
        return AI.CapabilitiesUI.Embeddings;

    if (-1 !== model.id.indexOf("moderation"))
        return AI.CapabilitiesUI.Moderations;

    if (-1 !== model.id.indexOf("realtime"))
        return AI.CapabilitiesUI.Realtime;

    if ("dall-e-2" === model.id || "dall-e-3" === model.id || -1 != model.id.indexOf("-image-"))
        return AI.CapabilitiesUI.Image;

    if (-1 != model.id.indexOf("gpt-3.5-turbo-instruct"))
        return AI.CapabilitiesUI.Chat;   // 4k tokens, legacy Completions endpoint

    // gpt-4o, o1-*, gpt-4 → 128k tokens
    // gpt-3.5-turbo → 16k tokens
    // всё остальное → default
    return AI.CapabilitiesUI.Chat | AI.CapabilitiesUI.Vision;
}
```

##### Anthropic — хардкод по model.id

```javascript
// legacy: scripts/engine/providers/internal/anthropic.js
checkModelCapability(model) {
    if (0 == model.id.indexOf("claude-2"))           // 100k tokens
        return AI.CapabilitiesUI.Chat;

    if (0 == model.id.indexOf("claude-3-5-haiku"))   // 200k tokens
        return AI.CapabilitiesUI.Chat;

    // всё остальное (claude-3-*, claude-3.5-sonnet, claude-4-*) → 200k tokens
    return AI.CapabilitiesUI.Chat | AI.CapabilitiesUI.Vision;
}
```

##### Google Gemini — метаданные из API response

```javascript
// legacy: scripts/engine/providers/internal/google-gemini.js
checkExcludeModel(model) {
    if (model.id === "models/chat-bison-001" || model.id === "models/text-bison-001")
        return true;
    if (-1 !== model.id.indexOf("gemini-1.0"))
        return true;
    return false;
}

checkModelCapability(model) {
    if (model.inputTokenLimit)
        model.options.max_input_tokens = model.inputTokenLimit;

    // API возвращает supportedGenerationMethods[]
    if (Array.isArray(model.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes("generateContent"))
        return AI.CapabilitiesUI.Chat | AI.CapabilitiesUI.Vision | AI.CapabilitiesUI.Tools;

    if (Array.isArray(model.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes("embedContent"))
        return AI.CapabilitiesUI.Embeddings;

    return AI.CapabilitiesUI.All;
}
```

##### Mistral — хардкод по model.id + API metadata

```javascript
// legacy: scripts/engine/providers/internal/mistral.js
checkModelCapability(model) {
    if (-1 !== model.id.indexOf("mistral-embed"))       return AI.CapabilitiesUI.Embeddings;   // 8k
    if (-1 !== model.id.indexOf("mistral-moderation"))  return AI.CapabilitiesUI.Moderations;  // 8k
    if (-1 !== model.id.indexOf("pixtral"))             return AI.CapabilitiesUI.Image;        // 128k
    if (-1 !== model.id.indexOf("mistral-small"))       return AI.CapabilitiesUI.Chat;         // 32k
    if (-1 !== model.id.indexOf("mistral-medium"))      return AI.CapabilitiesUI.Chat;         // 32k
    if (-1 !== model.id.indexOf("codestral"))           return AI.CapabilitiesUI.Code | AI.CapabilitiesUI.Chat; // 256k

    // default: 128k
    let capUI = AI.CapabilitiesUI.Chat;
    if (model.capabilities && model.capabilities.vision)  // API возвращает capabilities.vision
        capUI = AI.CapabilitiesUI.Vision;
    return capUI;
}
```

##### Groq — API metadata (context_length) + хардкод

```javascript
// legacy: scripts/engine/providers/internal/groq.js
checkModelCapability(model) {
    if (model.context_length)
        model.options.max_input_tokens = AI.InputMaxTokens.getFloor(model.context_length);

    if (-1 !== model.id.toLowerCase().indexOf("vision"))
        return AI.CapabilitiesUI.Chat | AI.CapabilitiesUI.Vision;

    if (-1 !== model.id.toLowerCase().indexOf("whisper"))
        return AI.CapabilitiesUI.Audio;

    return AI.CapabilitiesUI.Chat;
}
```

##### Together.ai — API metadata (model.type)

```javascript
// legacy: scripts/engine/providers/internal/together.ai.js
checkModelCapability(model) {
    if (model.context_length)
        model.options.max_input_tokens = AI.InputMaxTokens.getFloor(model.context_length);

    if ("chat" === model.type) {
        let result = AI.CapabilitiesUI.Chat;
        if (-1 !== model.id.toLowerCase().indexOf("vision"))
            result |= AI.CapabilitiesUI.Vision;
        return result;
    }
    if ("image" === model.type)     return AI.CapabilitiesUI.Image;
    if ("moderation" === model.type) return AI.CapabilitiesUI.Moderations;
    if ("embedding" === model.type)  return AI.CapabilitiesUI.Embeddings;
    if ("code" === model.type)       return AI.CapabilitiesUI.Code | AI.CapabilitiesUI.Chat;
    if ("rerank" === model.type)     return AI.CapabilitiesUI.None;

    return AI.CapabilitiesUI.Chat;
}
```

##### OpenRouter — API metadata (model.architecture.modality)

```javascript
// legacy: scripts/engine/providers/internal/openrouter.js
checkModelCapability(model) {
    if (!model.architecture)
        return AI.CapabilitiesUI.Chat;

    // modality format: "text+image->text" or "text->text+image"
    const modality = model.architecture.modality || "";
    const modIn  = modality.split("->")[0].split("+");
    const modOut = modality.split("->")[1].split("+");
    const context_length = model.context_length || 0;

    model.options.max_input_tokens = context_length || AI.InputMaxTokens["128k"];

    let caps = 0;

    if (modIn.includes("embedding") || modOut.includes("embedding"))
        return AI.CapabilitiesUI.Embeddings;

    if (modOut.includes("text")) {
        if (modIn.includes("text") || modIn.includes("image") || modIn.includes("audio"))
            caps |= AI.CapabilitiesUI.Chat;
        if (modIn.includes("image"))
            caps |= AI.CapabilitiesUI.Vision;
        if (modIn.includes("audio"))
            caps |= AI.CapabilitiesUI.Audio;
    }
    if (modOut.includes("image")) {
        if (modIn.includes("image"))
            caps |= AI.CapabilitiesUI.Image;
    }

    return caps;
}
```

##### xAI — хардкод по model.id

```javascript
// legacy: scripts/engine/providers/internal/xAI.js
checkExcludeModel(model) {
    if (-1 !== model.id.indexOf("-beta")) return true;
    return false;
}

checkModelCapability(model) {
    if (-1 != model.id.indexOf("vision"))          // 32k tokens
        return AI.CapabilitiesUI.Chat | AI.CapabilitiesUI.Vision;
    if (-1 != model.id.indexOf("image"))
        return AI.CapabilitiesUI.Image;

    return AI.CapabilitiesUI.Chat;                  // 128k tokens
}
```

##### Stability AI — все модели = Image

```javascript
// legacy: scripts/engine/providers/internal/stabilityai.js
checkModelCapability(model) {
    return AI.CapabilitiesUI.Image;
}
```

##### Zhipu — хардкод по exact model.id

```javascript
// legacy: scripts/engine/providers/internal/zhipu.js
checkModelCapability(model) {
    if (model.id === "glm-4")      return AI.CapabilitiesUI.Chat;
    if (model.id === "cogview-3")  return AI.CapabilitiesUI.Image;
    return AI.CapabilitiesUI.All;
}
```

##### DeepSeek, Ollama, LM Studio, GPT4All — дефолт

```
// Не переопределяют checkModelCapability.
// Наследуют base: return AI.CapabilitiesUI.All
// Для нашей реализации: ставим Chat | Vision | Tools
```

#### 1.5 Model Assignment UI — фильтрация

`npm_lib/components/model-assignment/index.tsx`:

Сейчас `taskItems()` показывает **все** профили. Нужно фильтровать:

```typescript
// Маппинг task → required capability
const TASK_CAPABILITIES: Record<string, number> = {
  chat:            CapabilitiesUI.Chat,
  summarization:   CapabilitiesUI.Chat,
  translation:     CapabilitiesUI.Chat,
  textAnalysis:    CapabilitiesUI.Chat,
  imageGeneration: CapabilitiesUI.Image,
  ocr:             CapabilitiesUI.Vision,
  vision:          CapabilitiesUI.Vision,
};

// Фильтрация:
const taskItems = (setter, requiredCap) => [
  { text: t("DefaultModel"), id: "default", onClick: () => setter(null) },
  ...profiles
    .filter(p => !p.capabilities || (p.capabilities & requiredCap) !== 0)
    .map(p => ({ text: p.name, id: p.id, onClick: () => setter(p) })),
];
```

Если `capabilities` не заполнен (старые профили, миграция) — показываем без фильтрации (`!p.capabilities`).

**Затронутые файлы:**
- `npm_lib/types.ts` — Model, Profile
- `npm_lib/capabilities.ts` — NEW
- `npm_lib/providers/*/index.ts` — каждый провайдер: `getProviderModels()` возвращает capabilities
- `npm_lib/components/model-assignment/index.tsx` — фильтрация в UI
- `npm_lib/store/create-profiles-store.ts` — сохранение capabilities при создании профиля
- `npm_lib/services/profiles.ts` — передача capabilities в профиль

---

### 2. Использование assigned models для editor actions

**Проблема**: В Model Assignment можно назначить разные профили на Chat, Summarization, Translation и т.д. Но сейчас эти назначения **нигде не используются** кроме как в UI чата (`chatProfile` / `sessionChatProfile`). Когда редактор вызывает "Summarize selected text" — он должен использовать `summarizationProfile`, а не `defaultProfile`.

**Как это работает в legacy:**

```javascript
// register.js — каждая кнопка создаёт AI.Request с конкретным ActionType:
let requestEngine = AI.Request.create(AI.ActionType.Summarization);
// → ищет AI.Actions["Summarization"].model
// → создаёт AI.Request с этой моделью
// → отправляет chatRequest(prompt)

let requestEngine = AI.Request.create(AI.ActionType.Translation);
// → ищет AI.Actions["Translation"].model
// → другая модель, другой провайдер
```

**Что нужно сделать:**

#### 2.1 Синглтон-провайдер на каждый action type

**Суть проблемы**: Сейчас у нас **один глобальный провайдер-синглтон** (`provider-holder.ts`), который используется для чата. Когда пользователь нажимает "Summarize" в editor toolbar — нужно использовать не этот синглтон, а провайдер из `summarizationProfile`. Если пользователь назначил GPT-4o на Chat и Claude на Summarization — каждый action должен ходить в свою модель.

**Решение**: Расширяем паттерн с одним холдером до 7+1. Каждый action type получает свой `ProviderHolder` с собственным экземпляром провайдера. Реализация везде одинаковая — тот же `ProviderHolder`, тот же `AbstractBaseProvider`.

```
Сейчас:
  providerHolder (Chat) ← один на всё

После:
  actionHolders: Record<ActionType, ProviderHolder>
  ├── Chat            → holder → provider (Anthropic, claude-4)
  ├── Summarization   → holder → provider (OpenAI, gpt-4o)
  ├── Translation     → holder → provider (OpenAI, gpt-4o)   // может тот же профиль
  ├── TextAnalyze     → holder → provider (OpenAI, gpt-4o)
  ├── ImageGeneration → holder → provider (OpenAI, dall-e-3)
  ├── OCR             → holder → provider (Anthropic, claude-4)
  ├── Vision          → holder → provider (Anthropic, claude-4)
  └── Default         → holder → provider (fallback)
```

Создать `npm_lib/services/action-holders.ts`:

```typescript
// npm_lib/capabilities.ts (добавить к CapabilitiesUI)
export enum ActionType {
  Chat            = "Chat",
  Summarization   = "Summarization",
  Translation     = "Translation",
  TextAnalyze     = "TextAnalyze",
  ImageGeneration = "ImageGeneration",
  OCR             = "OCR",
  Vision          = "Vision",
}

// Маппинг: action type → поле в ProfilesStore
const ACTION_PROFILE_MAP: Record<ActionType, keyof ProfilesStoreState> = {
  [ActionType.Chat]:            "chatProfile",
  [ActionType.Summarization]:   "summarizationProfile",
  [ActionType.Translation]:     "translationProfile",
  [ActionType.TextAnalyze]:     "textAnalysisProfile",
  [ActionType.ImageGeneration]: "imageGenerationProfile",
  [ActionType.OCR]:             "ocrProfile",
  [ActionType.Vision]:          "visionProfile",
};

// Один holder на каждый action type — создаётся при старте, живёт всё время
const actionHolders = new Map<ActionType, ProviderHolder>();

function initActionHolders() {
  for (const actionType of Object.keys(ACTION_PROFILE_MAP)) {
    actionHolders.set(actionType, new ProviderHolder());
  }
}

// Получить провайдер для action type
function getActionProvider(actionType: ActionType): AbstractBaseProvider | null {
  return actionHolders.get(actionType)?.getProvider() ?? null;
}
```

#### 2.2 Конфигурация холдеров при смене профиля

Когда пользователь меняет назначение модели в Model Assignment (или при инициализации):

```typescript
// Вызывается из ProfilesStore при setChatProfile / setSummarizationProfile / etc.
function applyProfileToAction(actionType: ActionType, profile: Profile | null) {
  const holder = actionHolders.get(actionType);
  if (!holder) return;

  // Если профиля нет — fallback на defaultProfile
  const effective = profile ?? getProfilesStore().defaultProfile;
  if (!effective) return;

  // Конфигурируем синглтон этого action type
  holder.setProvider({
    type: effective.providerType,
    name: effective.name,
    baseUrl: effective.baseUrl,
    key: effective.key,
  });
  holder.setModelKey(effective.modelId);
}
```

Это **ровно то же**, что сейчас делает `applyCurrentChatProvider()` в `ProfilesService` — но для каждого action type.

#### 2.3 Как это используется

Когда editor вызывает action (через event bridge, пункт 6):

```typescript
// Пример: пользователь нажал "Summarize" в toolbar
async function handleSummarize(selectedText: string) {
  const provider = getActionProvider(ActionType.Summarization);
  if (!provider) {
    showError("Configure model for Summarization in Settings");
    return;
  }

  const prompt = `Summarize the following text:\n\n${selectedText}`;
  const result = await provider.sendMessageSync([{ role: "user", content: prompt }]);
  await Asc.Library.PasteText(result);
}

// Пример: пользователь нажал "Generate Image"
async function handleImageGeneration(description: string) {
  const provider = getActionProvider(ActionType.ImageGeneration);
  if (!provider?.imageGeneration) {
    showError("Configure image model in Settings");
    return;
  }

  const base64 = await provider.imageGeneration({ prompt: description });
  await Asc.Library.AddGeneratedImage(base64);
}
```

**Ключевое**:
- Провайдер создаётся **один раз** при назначении профиля, а не на каждый запрос
- Смена модели в Model Assignment → `applyProfileToAction()` переконфигурирует нужный холдер
- При вызове action → просто `getActionProvider(type)` и шлём запрос
- Если два action'а используют один профиль — это два разных инстанса провайдера (изоляция `prevMessages`, `systemPrompt`, `tools`)
- Реализация **одинаковая везде** — тот же `ProviderHolder`, тот же `AbstractBaseProvider`

#### 2.3 Fallback логика

```
1. taskProfile (e.g. summarizationProfile)   — если назначен
2. defaultProfile                             — если task profile не назначен
3. null → показать ошибку "Configure model for this action in Settings"
```

Совпадает с legacy: `AI.Request.create(action)` → `AI.Actions[action].model` → если пусто, открывает settings.

**Затронутые файлы:**
- `npm_lib/services/action-service.ts` — NEW: резолвинг профиля по action type
- `npm_lib/capabilities.ts` — ActionType enum (добавить если ещё не создан)
- Все места, где будут вызываться editor actions (пункт 6)

---

### 3. Недостающие методы провайдера

**Проблема**: Наш `AbstractBaseProvider` умеет только chat streaming + tool calling. Legacy `AI.Request` покрывает 6 типов запросов: chat, chatAgent, imageGeneration, imageVision, imageOCR и неявно non-streaming chat (когда `streamFunc` не передан). Для полной замены legacy плагина нужно закрыть все эти кейсы.

#### 3.1 Non-streaming chat (`sendMessageSync`)

**Legacy**: `chatRequest(content, block)` без третьего аргумента `streamFunc` — отправляет запрос, ждёт полный ответ, возвращает string. Используется для:
- Summarization (результат вставляется целиком)
- Translation (результат подставляется в документ)
- Text Analysis (paraphrase, tone change, keywords)
- Grammar/spelling check
- `createChatName` (генерация названия чата — у нас уже есть)

**У нас**: Только `sendMessage()` — async generator, всегда streaming. Чтобы получить полный ответ, нужно прокрутить генератор до конца. Это работает, но неудобно для простых one-shot запросов.

**Решение**: Добавить в `AbstractBaseProvider`:

```typescript
/**
 * Non-streaming chat request. Returns complete response text.
 * Default implementation: drains the sendMessage() generator.
 * Providers MAY override for a more efficient single-request call.
 */
async sendMessageSync(messages: ThreadMessageLike[]): Promise<string> {
  let result = "";
  for await (const chunk of this.sendMessage(messages)) {
    if ("isEnd" in chunk) {
      // Extract text from responseMessage
      const content = chunk.responseMessage.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .filter(p => p.type === "text")
          .map(p => p.text)
          .join("");
      }
    }
  }
  return result;
}
```

Дефолтная реализация в base class — прокручивает генератор. Провайдеры МОГУТ переопределить на прямой вызов SDK без streaming (эффективнее, меньше overhead).

#### 3.2 Image Generation (`imageGeneration`)

**Legacy**: `AI.Request.imageGenerationRequest(text)` → `provider.getImageGeneration({ prompt })` → fetch → `provider.getImageGenerationResult()` → base64 string.

**У нас**: Нет.

**Решение**: Добавить optional метод в base:

```typescript
/**
 * Generate image from text prompt. Returns base64 image string.
 * Only providers with Image capability implement this.
 */
async imageGeneration?(request: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<string>;
```

Реализации:
- **OpenAI**: `client.images.generate({ model: "dall-e-3", prompt, size })` → base64
- **Anthropic**: Нет нативного API. Через chat с промптом "generate SVG image" (как в legacy `getImageGenerationWithChat`)
- **Google GenAI**: Через `generateContent` с image output
- **Остальные**: Не реализуют (capability `Image` не выставлен → метод не вызывается)

#### 3.3 Image Vision (`imageVision`)

**Legacy**: `AI.Request.imageVisionRequest({ prompt, image })` → `provider.getImageVision()` → fetch → text response.

**У нас**: Частично есть — `sendMessage()` поддерживает `{ type: "image", image: base64 }` в content parts. Но нет выделенного метода для one-shot "опиши картинку".

**Решение**: Convenience-метод в base class (не abstract, т.к. реализуется через существующий `sendMessage`):

```typescript
/**
 * Analyze image with a text prompt. Returns text description.
 * Default: sends image as message content via sendMessageSync().
 */
async imageVision(request: {
  image: string;   // base64 or data URI
  prompt: string;
}): Promise<string> {
  const message: ThreadMessageLike = {
    role: "user",
    content: [
      { type: "text", text: request.prompt },
      { type: "image", image: request.image },
    ],
  };
  return this.sendMessageSync([message]);
}
```

Работает из коробки для всех провайдеров с Vision capability. Не нужно переопределять.

#### 3.4 Image OCR (`imageOCR`)

**Legacy**: `AI.Request.imageOCRRequest(image)` → `provider.getImageOCR({ image })` → по сути `getImageVision` с промптом OCR.

**У нас**: Нет.

**Решение**: Тривиальный хелпер поверх `imageVision`:

```typescript
/**
 * Extract text from image via OCR.
 * Default: calls imageVision with OCR prompt.
 */
async imageOCR(request: { image: string }): Promise<string> {
  return this.imageVision({
    image: request.image,
    prompt: "Extract all text from this image exactly as it appears. Preserve the original formatting, line breaks, and structure.",
  });
}
```

#### 3.5 Streaming support flag (`isSupportStreaming`)

**Legacy**: `provider.isSupportStreaming()` — проверяет, поддерживает ли провайдер streaming. GPT4All → false, все остальные → true.

**У нас**: Все провайдеры стримят через async generator. Но для adapter layer может понадобиться знать.

**Решение**: Простой метод в base:

```typescript
/** Whether this provider supports streaming. Default: true. */
isSupportStreaming(): boolean { return true; }
```

#### 3.6 Итоговые изменения в AbstractBaseProvider

```
AbstractBaseProvider<TOOL, MESSAGE, CLIENT>
│
│  EXISTING:
│  ├── sendMessage()              ← streaming chat + tools
│  ├── sendMessageAfterToolCall() ← tool call continuation
│  ├── createChatName()           ← chat title generation
│  ├── checkProvider()            ← credential validation
│  ├── getProviderModels()        ← model list
│  ├── stopMessage()              ← stream interruption
│  ├── set*(...)                  ← configuration setters
│
│  NEW (implemented in base, overridable):
│  ├── sendMessageSync()          ← non-streaming chat (drains generator)
│  ├── imageVision()              ← image analysis (via sendMessageSync)
│  ├── imageOCR()                 ← OCR (via imageVision + prompt)
│  ├── isSupportStreaming()       ← streaming flag (default true)
│
│  NEW (abstract/optional, provider-specific):
│  └── imageGeneration?()         ← image generation (OpenAI only)
```

**Что НЕ добавляем в провайдер** (это задача adapter layer):
- Token chunking (`[START PART n/N]`) — adapter режет перед отправкой
- Proxy support — adapter оборачивает fetch
- Translation post-processing (`getTranslateResult`) — это trim/cleanup текста, не задача провайдера
- Agent loop — уже есть в `useMessages`, для editor tools будет в adapter

**Затронутые файлы:**
- `npm_lib/providers/base.ts` — новые методы `sendMessageSync`, `imageVision`, `imageOCR`, `isSupportStreaming`
- `npm_lib/providers/openai/index.ts` — реализация `imageGeneration()` через `client.images.generate()`
- `npm_lib/providers/genai/index.ts` — возможно реализация `imageGeneration()` через Gemini image gen
- `npm_lib/types.ts` — типы для image requests (если не вынесены отдельно)

---

### 4. Token Budget и разбиение длинного текста

**Проблема**: Когда пользователь выделяет 50-страничный документ и жмёт "Summarize", текст может не влезть в контекстное окно модели. Legacy решает это через разбиение на chunks с маркерами `[START PART n/N]`.

**Как это работает в legacy** (`engine.js:553-601, 731-781`):

```
1. input_tokens = OpenAIEncode(content).length
2. Если input_tokens < max_input_tokens → отправляем как есть
3. Иначе:
   chunkLen = ((max_input_tokens - 500) / input_tokens) * content.length
   Режем content.substring(0, chunkLen), substring(chunkLen, chunkLen*2), ...
4. Каждый chunk оборачивается:
   "[START PART 1/3]\n...chunk...\n[END PART 1/3]\n
    Do not answer yet, just acknowledge..."
5. Отправляем последовательно, ответы промежуточных — игнорируем
6. Берём ответ только на последний chunk
```

**Где это нужно**: ТОЛЬКО для non-streaming actions из editor (summarization, translation, text analysis). НЕ для чата — в чате пользователь сам управляет длиной.

**Что нужно сделать:**

#### 4.1 Token estimator

Простой оценщик длины в токенах. Не нужен полный tiktoken — достаточно heuristic:

```typescript
// ~4 символа ≈ 1 токен для английского, ~2 символа для CJK
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
```

Или подключить легковесный `gpt-tokenizer` / `tiktoken-lite`.

#### 4.2 Text splitter

```typescript
function splitTextForModel(
  text: string,
  maxTokens: number,   // из Model.maxInputTokens или дефолт 32k
  overhead?: number     // дефолт 500 — резерв на system prompt + part headers
): string[] {
  const available = maxTokens - (overhead ?? 500);
  const tokens = estimateTokens(text);
  if (tokens <= available) return [text];

  const chunkCharLen = Math.floor((available / tokens) * text.length);
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkCharLen) {
    chunks.push(text.substring(i, i + chunkCharLen));
  }
  return chunks;
}
```

#### 4.3 Multi-part request runner

```typescript
async function sendMultiPartRequest(
  provider: AbstractBaseProvider,
  chunks: string[],
  taskPrompt: string     // e.g. "Summarize this text:"
): Promise<string> {
  if (chunks.length === 1) {
    return provider.sendMessageSync([{
      role: "user",
      content: taskPrompt + "\n\n" + chunks[0]
    }]);
  }

  // Multi-part: send chunks with acknowledgment headers
  for (let i = 0; i < chunks.length; i++) {
    const part = i + 1;
    const total = chunks.length;
    const isLast = part === total;

    let message = `[START PART ${part}/${total}]\n${chunks[i]}\n[END PART ${part}/${total}]`;
    if (!isLast) {
      message = `Do not answer yet. Just acknowledge "Part ${part}/${total} received".\n` + message;
    } else {
      message += `\nALL PARTS SENT. Now process: ${taskPrompt}`;
    }

    const result = await provider.sendMessageSync([{ role: "user", content: message }]);
    if (isLast) return result;
    // Промежуточные ответы — игнорируем
  }
  return "";
}
```

**Важно**: Это НЕ в провайдере. Это utility-функция, используемая в action service (пункт 2) и event bridge (пункт 6).

**Затронутые файлы:**
- `npm_lib/utils/token-estimator.ts` — NEW
- `npm_lib/utils/text-splitter.ts` — NEW
- `npm_lib/utils/multi-part-request.ts` — NEW

---

### 5. Adapter Layer: message/streaming/tool format conversion

**Проблема**: Legacy editor отправляет и ожидает данные в своём формате. Наши провайдеры работают с `ThreadMessageLike`. Нужен слой конвертации.

**Где подключается**: Adapter layer — это **НЕ прослойка между нашими внутренними компонентами**. Это прослойка **только на границе с editor event API**. Используется исключительно внутри `EditorBridge` (пункт 6).

```
┌─────────────────────────────────────────────────────────┐
│  ONLYOFFICE Editor (legacy event API)                   │
│  → events в legacy формате (LegacyMessage, tool_calls)  │
└────────────────────────┬────────────────────────────────┘
                         │
           ┌─────────────▼──────────────┐
           │  EditorBridge (пункт 6)    │
           │  использует adapter layer: │
           │  ├── message-converter     │  ← конвертация ТОЛЬКО тут
           │  ├── streaming-adapter     │
           │  └── tool-converter        │
           └─────────────┬──────────────┘
                         │ ThreadMessageLike (наш формат)
           ┌─────────────▼──────────────┐
           │  actionHolders (пункт 2)   │
           │  → провайдеры              │  ← всё в нашем формате
           │  → stores                  │
           │  → UI (чат)                │
           └────────────────────────────┘
```

- Внутри ai-agent (чат, stores, провайдеры) — всё работает в `ThreadMessageLike`. Никаких legacy форматов.
- Конвертация legacy ↔ ThreadMessageLike происходит **только на входе/выходе EditorBridge**.
- Если плагин работает standalone (без editor) — adapter layer **не загружается вообще**.

**Что нужно сделать:**

#### 5.1 Message Format Converter

```typescript
// Legacy → ThreadMessageLike
function legacyToThread(messages: LegacyMessage[]): ThreadMessageLike[];

// ThreadMessageLike → Legacy
function threadToLegacy(message: ThreadMessageLike): LegacyMessage;
```

##### Legacy → ThreadMessageLike (входящие от editor)

**Roles:**

| Legacy | ThreadMessageLike | Примечание |
|--------|-------------------|------------|
| `{ role: "user", content: "text" }` | `{ role: "user", content: "text" }` | Прямой маппинг |
| `{ role: "assistant", content: "text" }` | `{ role: "assistant", content: "text" }` | Прямой маппинг |
| `{ role: "system", content: "text" }` | `{ role: "system", content: "text" }` | Прямой маппинг |
| `{ role: "developer", content: "text" }` | Убираем из messages, передаём в `setSystemPrompt(text)` | developer = приоритетный system prompt |
| `{ role: "tool", tool_call_id: "id", content: "result" }` | Не конвертируется напрямую — result прикрепляется к предыдущему assistant message | См. ниже |

**Tool call + tool result — сложный кейс:**

Legacy хранит tool calls как пару отдельных messages:
```javascript
// Legacy format (два отдельных сообщения в массиве):
{ role: "assistant", content: "", tool_calls: [{ id: "call_1", function: { name: "getWeather", arguments: '{"city":"Moscow"}' } }] }
{ role: "tool", tool_call_id: "call_1", content: '{"temp": 15}' }
```

У нас tool call и result — это part'ы внутри ОДНОГО сообщения:
```typescript
// ThreadMessageLike (один assistant message):
{
  role: "assistant",
  content: [
    { type: "tool-call", toolCallId: "call_1", toolName: "getWeather",
      args: { city: "Moscow" }, argsText: '{"city":"Moscow"}',
      result: '{"temp": 15}' }    // ← result прямо тут
  ]
}
```

Конвертер должен: встретив `{ role: "tool", tool_call_id }`, найти предыдущий assistant message с matching tool_call и записать `content` в `result`.

**Content parts (multimodal):**

| Legacy content part | ThreadMessageLike part |
|---------------------|----------------------|
| `{ type: "text", text: "..." }` | `{ type: "text", text: "..." }` |
| `{ type: "image_url", image_url: { url: "data:..." } }` | `{ type: "image", image: "data:..." }` |
| String с `<think>...</think>` tags | Разбить на: `{ type: "reasoning", text: "..." }` + `{ type: "text", text: "..." }` |

##### ThreadMessageLike → Legacy (исходящие в editor)

**Roles:**

| ThreadMessageLike | Legacy | Примечание |
|-------------------|--------|------------|
| `{ role: "user", content: "text" }` | `{ role: "user", content: "text" }` | Прямой маппинг |
| `{ role: "assistant", content: "text" }` | `{ role: "assistant", content: "text" }` | Прямой маппинг |
| `{ role: "system", content: "text" }` | `{ role: "system", content: "text" }` | Прямой маппинг |

**Content parts:**

| ThreadMessageLike part | Legacy |
|----------------------|--------|
| `{ type: "text", text: "..." }` | `{ type: "text", text: "..." }` или просто string |
| `{ type: "image", image: "data:..." }` | `{ type: "image_url", image_url: { url: "data:..." } }` |
| `{ type: "reasoning", text: "..." }` | Оборачивается в `<think>text</think>` и вставляется в начало text content |
| `{ type: "file", data: "...", mimeType: "..." }` | Нет аналога в legacy — конвертируем в `{ type: "text", text: JSON.stringify({ file_data, mimeType }) }` |

**Tool calls:**

| ThreadMessageLike | Legacy |
|-------------------|--------|
| `{ type: "tool-call", toolCallId, toolName, args, result }` | Разбивается на ДВА message: `{ role: "assistant", tool_calls: [{ id, function: { name, arguments } }] }` + `{ role: "tool", tool_call_id, content: result }` |

##### Полный пример конвертации

```
Legacy messages (входящие):
  [0] { role: "system", content: "You are a helpful assistant" }
  [1] { role: "user", content: "What's the weather?" }
  [2] { role: "assistant", content: "", tool_calls: [{ id: "c1", function: { name: "getWeather", arguments: '{"city":"Moscow"}' } }] }
  [3] { role: "tool", tool_call_id: "c1", content: '{"temp":15}' }
  [4] { role: "assistant", content: "It's 15°C in Moscow" }

ThreadMessageLike (наш формат):
  [0] { role: "system", content: "You are a helpful assistant" }
  [1] { role: "user", content: "What's the weather?" }
  [2] { role: "assistant", content: [
         { type: "tool-call", toolCallId: "c1", toolName: "getWeather",
           args: { city: "Moscow" }, argsText: '{"city":"Moscow"}',
           result: '{"temp":15}' }
       ]}
  [3] { role: "assistant", content: "It's 15°C in Moscow" }
```

#### 5.2 Streaming Adapter

Legacy использует callback `streamFunc(text) → bool`. Наш — async generator.

```typescript
/**
 * Обёртка: подписывается на async generator, вызывает legacy callback.
 */
async function streamGeneratorToCallback(
  generator: AsyncGenerator<StreamResult>,
  streamFunc: (text: string) => Promise<boolean>
): Promise<ThreadMessageLike> { ... }

/**
 * Обратная обёртка: принимает callback-стиль, возвращает generator.
 * (Может понадобиться если внешний код хочет читать наш stream)
 */
```

#### 5.3 Tool Format Converter

```typescript
// Legacy → TMCPItem
function legacyToolToMCP(tool: LegacyTool): TMCPItem {
  return { name: tool.name, description: tool.description, inputSchema: tool.parameters };
}

// TMCPItem → Legacy
function mcpToolToLegacy(tool: TMCPItem): LegacyTool {
  return { name: tool.name, description: tool.description, parameters: tool.inputSchema };
}

// Legacy tool_calls → ThreadMessageLike content parts
function legacyToolCallsToParts(toolCalls: LegacyToolCall[]): ToolCallPart[];

// ThreadMessageLike tool-call parts → Legacy tool_calls
function partsToLegacyToolCalls(parts: ToolCallPart[]): LegacyToolCall[];
```

**Затронутые файлы:**
- `npm_lib/bridge/message-converter.ts` — NEW
- `npm_lib/bridge/streaming-adapter.ts` — NEW
- `npm_lib/bridge/tool-converter.ts` — NEW
- `npm_lib/bridge/types.ts` — NEW: LegacyMessage, LegacyToolCall, LegacyTool types

---

### 6. Editor Event Bridge

**Проблема**: Legacy плагин интегрируется с редактором через event API (`window.Asc.plugin.attachEvent`). Кнопки в toolbar и context menu отправляют events → плагин слушает → выполняет action → отправляет результат обратно в editor. ai-agent должен уметь делать то же самое.

**Какие editor actions нужно поддержать:**

| Action | Event trigger | Legacy flow | Наш flow |
|--------|--------------|-------------|----------|
| **Chat** | `onChatMessage` | `AI.Request.create(Chat).chatRequestAgent()` | `getActionProvider(ActionType.Chat)` → `provider.sendMessage()` |
| **Summarize** | `onContextMenuClick` | `AI.Request.create(Summarization).chatRequest(prompt)` | `getActionProvider(ActionType.Summarization)` → `provider.sendMessageSync(prompt)` |
| **Translate** | `onContextMenuClick` | `AI.Request.create(Translation).chatRequest(prompt)` | `getActionProvider(ActionType.Translation)` → `provider.sendMessageSync(prompt)` |
| **Rewrite/Longer/Shorter** | `onContextMenuClick` | `AI.Request.create(TextAnalyze).chatRequest(prompt)` | `getActionProvider(ActionType.TextAnalyze)` → `provider.sendMessageSync(prompt)` |
| **Explain/Keywords** | `onContextMenuClick` | `AI.Request.create(TextAnalyze).chatRequest(prompt)` | `getActionProvider(ActionType.TextAnalyze)` → `provider.sendMessageSync(prompt)` |
| **Fix & Spell** | `onContextMenuClick` | `AI.Request.create(TextAnalyze).chatRequest(prompt)` | `getActionProvider(ActionType.TextAnalyze)` → `provider.sendMessageSync(prompt)` |
| **Image Generation** | `onContextMenuClick` / `onToolbarMenuClick` | `AI.Request.create(ImageGeneration).imageGenerationRequest()` | `getActionProvider(ActionType.ImageGeneration)` → `provider.imageGeneration()` |
| **OCR** | `onContextMenuClick` | `AI.Request.create(OCR).imageOCRRequest()` | `getActionProvider(ActionType.OCR)` → `provider.imageOCR()` |
| **Vision** (Explain Image) | `onContextMenuClick` | `AI.Request.create(Vision).imageVisionRequest()` | `getActionProvider(ActionType.Vision)` → `provider.imageVision()` |
| **Grammar/Spelling check** | Toolbar | `AI.Request.create(TextAnalyze).chatRequest()` | `getActionProvider(ActionType.TextAnalyze)` → `provider.sendMessageSync()` |

**Что нужно сделать:**

#### 6.1 EditorBridge — как это работает

**Что такое EditorBridge**: Класс, который создаётся при инициализации плагина внутри ONLYOFFICE Editor. Он слушает events от редактора и выполняет AI-запросы через наши провайдеры.

**Жизненный цикл:**

```
1. Плагин загружается в ONLYOFFICE Editor
2. Проверяем: window.Asc?.plugin существует?
3. ДА → создаём EditorBridge
4. EditorBridge при создании:
   а) Подписывается на editor events (onContextMenuClick, onToolbarMenuClick, etc.)
   б) Регистрирует кнопки в context menu и toolbar
   в) Получает ссылку на actionHolders (пункт 2) — через них будет вызывать провайдеры
```

**Что происходит при нажатии кнопки (пример — Summarize):**

```
1. Пользователь выделяет текст, правый клик → "AI" → "Summarize"

2. Editor отправляет event onContextMenuClick с данными:
   { buttonId: "ai_summarize", ... }

3. EditorBridge.handleContextMenu() получает event:
   а) Определяет action type по buttonId → ActionType.Summarization
   б) Получает выделенный текст через Asc.Library.GetSelectedText()
   в) Берёт провайдер: getActionProvider(ActionType.Summarization)
   г) Если текст длинный — разбивает через text splitter (пункт 4)
   д) Формирует промпт: PROMPTS.summarize(selectedText)
   е) Отправляет: provider.sendMessageSync([{ role: "user", content: prompt }])
   ж) Вставляет результат: Asc.Library.PasteText(result)

4. Пользователь видит результат в документе
```

**Что происходит для Image Generation:**

```
1. Пользователь нажимает "Generate Image" в toolbar

2. EditorBridge.handleToolbar():
   а) action type → ActionType.ImageGeneration
   б) Получает описание из диалога / выделенного текста
   в) provider = getActionProvider(ActionType.ImageGeneration)
   г) base64 = await provider.imageGeneration({ prompt: description })
   д) Asc.Library.AddGeneratedImage(base64)
```

**Что происходит для Chat (через editor window):**

```
1. Пользователь открывает chat window из editor

2. EditorBridge слушает onChatMessage:
   а) Конвертирует legacy messages → ThreadMessageLike (adapter layer, пункт 5)
   б) provider = getActionProvider(ActionType.Chat)
   в) Стримит через provider.sendMessage()
   г) Streaming adapter конвертирует async generator → streamFunc callback
   д) Отправляет chunks обратно в chat window через editor events
```

**Регистрация кнопок:**

EditorBridge при инициализации регистрирует кнопки в editor UI — аналог `registerButtons()` из legacy `register.js`. Кнопки context menu (Summarize, Translate, Rewrite, etc.) и toolbar (Translation settings, Grammar check, Image generation).

#### 6.2 Полная таблица действий: что вызываем, куда вставляем

##### Context Menu — Text Analysis (word editor)

| Кнопка | ActionType | Получаем из editor | Промпт | Метод провайдера | Вставляем результат |
|--------|-----------|-------------------|--------|-----------------|-------------------|
| Summarization | `Summarization` | `GetSelectedText()` | `getSummarizationPrompt(text)` | `sendMessageSync()` | `InsertAsText("Summary:\n\n" + result)` |
| Rewrite differently | `TextAnalyze` | `GetSelectedText()` | `getTextRewritePrompt(text)` | `sendMessageSync()` | `PasteText(result)` — заменяет выделение |
| Make longer | `TextAnalyze` | `GetSelectedText()` | `getTextLongerPrompt(text)` | `sendMessageSync()` | `PasteText(result)` |
| Make shorter | `TextAnalyze` | `GetSelectedText()` | `getTextShorterPrompt(text)` | `sendMessageSync()` | `PasteText(result)` |
| Explain text in comment | `TextAnalyze` | `GetSelectedText()` или `GetCurrentWord()` | `getExplainPrompt(text)` | `sendMessageSync()` | `InsertAsComment(result)` |
| Explain text in hyperlink | `TextAnalyze` | `GetSelectedText()` | `getExplainAsLinkPrompt(text)` | `sendMessageSync()` | `InsertAsHyperlink(result)` |
| Fix spelling & grammar | `TextAnalyze` | `GetSelectedText()` | `getFixAndSpellPrompt(text)` | `sendMessageSync()` | `ReplaceTextSmart([result])` — только если текст изменился |
| Keywords | `TextAnalyze` | `GetSelectedText()` | `getTextKeywordsPrompt(text)` | `sendMessageSync()` | `InsertAsText(result)` |

**Пост-обработка**: Все TextAnalyze результаты проходят через `result.replace(/\n\n/g, '\n')`.

##### Context Menu — Translation (word, slide, cell)

| Кнопка | ActionType | Получаем | Промпт | Метод | Вставляем |
|--------|-----------|----------|--------|-------|----------|
| Translate to {lang} | `Translation` | `GetSelectedText()` | `getTranslatePrompt(text, lang)` | `sendMessageSync()` | `PasteText(result)` |

**Пост-обработка**: `getTranslateResult(result, originalText)` — trim кавычек, переносов строк.

**Языки**: English, French, German, Chinese, Japanese, Russian, Korean, Spanish, Italian.

##### Context Menu — Images (все editors)

| Кнопка | ActionType | Получаем | Промпт | Метод | Вставляем |
|--------|-----------|----------|--------|-------|----------|
| Text to Image | `ImageGeneration` | `GetSelectedText()` | — (текст = промпт) | `imageGeneration({ prompt })` | PDF: `AddGeneratedImage(base64)`, иначе: `AddOleObject(base64, description)` |
| OCR | `OCR` | `GetSelectedImage()` | OCR system prompt | `imageOCR({ image })` | `InsertAsMD(result, [latex, hr])` |
| Image to Text | `Vision` | `GetSelectedImage()` | `getImageDescription()` | `imageVision({ image, prompt })` | `InsertAsMD(result)` |

##### Toolbar (все editors)

| Кнопка | ActionType | Что делает |
|--------|-----------|-----------|
| Chatbot | `Chat` | Открывает chat window через `chatWindowShow()` |
| Settings | — | Открывает settings modal |
| Summarization | `Summarization` | Открывает summarization modal (выбор языка, типа, куда вставить) |
| Translation | `Translation` | Берёт язык из localStorage, `sendMessageSync()`, `PasteText()`. Split-кнопка с "Settings" → translation settings modal |
| Grammar & Spelling | `TextAnalyze` | `onCheckGrammarSpelling()` — проверка параграфов через SpellChecker/GrammarChecker |

##### Toolbar — Summarization Modal (отдельное окно)

Summarization через toolbar открывает модальное окно `summarization.html`, где пользователь выбирает:
- Язык результата
- Тип (brief, detailed, bullet points)
- Куда вставить: review, comment, replace, end

Результат вставляется в зависимости от выбора:

| Тип вставки | Word editor | Остальные editors |
|------------|-------------|-------------------|
| `review` | `InsertAsReview(result)` | `InsertAsComment(result)` |
| `comment` | `InsertAsComment(result)` | `InsertAsComment(result)` |
| `replace` | `PasteText(result)` | `PasteText(result)` |
| `end` | `InsertAsText(result)` | `InsertAsText(result)` |

##### Chat Window — Agent Loop

Chat обрабатывается отдельно от остальных actions:

```
1. Пользователь отправляет сообщение в chat window
2. Event onChatMessage → EditorBridge
3. provider = getActionProvider(ActionType.Chat)
4. Проверяем: provider.isSupportTools()?
5. ДА → добавляем tools из EditorHelper + tools system prompt
6. НЕТ → добавляем обычный system prompt

7. AGENT LOOP (max 10 итераций):
   а) provider.sendMessage(messages) → async generator
   б) Стримим chunks в chat window (onChatStreamStart → onChatStreamChunk)
   в) Получаем финальный ответ

   г) Есть tool_calls в ответе?
      → ДА:
        - Для каждого tool_call:
          - Отправляем onToolCallStart в chat window (показываем "вызов функции...")
          - Выполняем: EditorHelper.names2funcs[funcName](args)
          - Отправляем onToolCallEnd с результатом
          - Добавляем assistant message + tool result в messages
        - Продолжаем цикл (следующая итерация)

      → НЕТ:
        - Текстовый ответ → onChatStreamEnd
        - Выходим из цикла

8. Chat window показывает ответ пользователю
```

**Вставка из чата в документ** (onChatReplace):

| Тип | Метод |
|-----|-------|
| `review` | Word: `InsertAsReview()`, остальные: `InsertAsComment()` |
| `comment` | `InsertAsComment()` |
| `insert` | `InsertAsHTML()` |
| `replace` | `ReplaceTextSmart()` |

#### 6.3 Prompt templates

Legacy промпты определены в `scripts/engine/library.js:635-711` (`Asc.Prompts`). Ниже — полный текст каждого промпта, который нужно перенести.

##### `getFixAndSpellPrompt(content)`
```
I want you to act as an editor and proofreader. I will provide you with some text that needs to be checked for spelling and grammar errors. Your task is to carefully review the text and correct any mistakes, ensuring that the corrected text is free of errors and maintains the original meaning. Only return the corrected text. Here is the text that needs revision: "${content}"
```

##### `getSummarizationPrompt(content, language?)`
```
// Без языка:
Summarize the following text. . Return only the resulting text.Text: """
${content}
"""

// С языком:
Summarize the following text. and translate the result to ${language}. Return only the resulting translated text.Text: """
${content}
"""
```

##### `getTranslatePrompt(content, language)`
```
Translate the following text to ${language}. Return only the resulting text.Text: """
${content}
"""
```

##### `getExplainPrompt(content)`
```
Explain what the following text means. Return only the resulting text.Text: """
${content}
"""
```

##### `getTextLongerPrompt(content)`
```
Make the following text longer. Return only the resulting text.Text: """
${content}
"""
```

##### `getTextShorterPrompt(content)`
```
Make the following text simpler. Return only the resulting text.Text: """
${content}
"""
```

##### `getTextRewritePrompt(content)`
```
Rewrite the following text differently. Return only the resulting text.Text: """
${content}
"""
```

##### `getTextKeywordsPrompt(content)`
```
Get Key words from this text: "${content}"
```

##### `getExplainAsLinkPrompt(content)`
```
Give a link to the explanation of the following text. Return only the resulting link.Text: """
${content}
"""
```

##### `getImageDescription()` (Vision — описание изображения)
```
Describe in detail everything you see in this image. Mention the objects, their appearance, colors, arrangement, background, and any noticeable actions or interactions. Be as specific and accurate as possible. Avoid making assumptions about things that are not clearly visible.
```

##### `getImagePromptOCR()` (OCR — распознавание текста)
```
Extract all text from this image as accurately as possible. Preserve original reading order and formatting if possible. Recognize tables and images if possible. Do not add or remove any content. Output recognized objects in md format if possible. If not, return plain text.
```

#### 6.4 Editor API — методы получения данных и вставки результата

```typescript
// Получение данных из editor:
Asc.Library.GetSelectedText()      // Выделенный текст
Asc.Library.GetSelectedImage()     // Выделенное изображение (base64)
Asc.Library.GetCurrentWord()       // Слово под курсором (если нет выделения)
Asc.Library.GetEditorVersion()     // Версия editor (для conditional features)

// Вставка результата:
Asc.Library.PasteText(text)        // Заменяет выделение текстом
Asc.Library.InsertAsText(text)     // Вставляет текст в позицию курсора
Asc.Library.InsertAsComment(text)  // Вставляет как комментарий
Asc.Library.InsertAsReview(text)   // Вставляет как рецензию (track changes, word only)
Asc.Library.InsertAsHTML(html)     // Вставляет HTML
Asc.Library.InsertAsMD(md, plugins)// Вставляет Markdown (с поддержкой LaTeX, HR)
Asc.Library.InsertAsHyperlink(url) // Вставляет гиперссылку
Asc.Library.ReplaceTextSmart(arr)  // "Умная" замена текста
Asc.Library.AddGeneratedImage(b64) // Вставляет изображение (PDF)
Asc.Library.AddOleObject(b64, desc)// Вставляет OLE-объект (non-PDF)

// Управление блокировкой UI:
Asc.Editor.callMethod("StartAction", ["Block", "AI (model-name)"])
Asc.Editor.callMethod("EndAction", ["Block", "AI (model-name)"])
```

**Затронутые файлы:**
- `npm_lib/bridge/editor-bridge.ts` — NEW: main event bridge, registerEvents, handlers
- `npm_lib/bridge/prompts.ts` — NEW: prompt templates
- `npm_lib/bridge/editor-api.ts` — NEW: typed wrapper for Asc.Library / Asc.Editor methods

---

## Порядок реализации

План разбит на два отдельных документа:

### [migration-to-npm-lib.md](migration-to-npm-lib.md) — Phase 1: библиотека (npm_lib)

Можно делать сейчас, не зависит от editor integration.

| # | Пункт | Что делаем |
|---|-------|-----------|
| 1 | Capabilities + Profiles + Model Assignment | Enum, типы, фильтрация в getProviderModels() и model-assignment UI |
| 2 | Action Holders | Синглтон-провайдер на каждый ActionType, applyProfileToAction() |
| 3 | Недостающие методы провайдера | sendMessageSync, imageGeneration, imageVision, imageOCR |

### [migration-to-new-plugin.md](migration-to-new-plugin.md) — Phase 2: плагин (src/)

Требует доступа к editor API (`window.Asc.plugin`). Зависит от Phase 1.

| # | Пункт | Что делаем |
|---|-------|-----------|
| 4 | Token budget + text splitting | Token estimator, text splitter, multi-part request runner |
| 5 | Adapter layer | Message/streaming/tool format converters (только для EditorBridge) |
| 6 | Editor Event Bridge | Events, промпты, handlers, кнопки, вставка результата в документ |

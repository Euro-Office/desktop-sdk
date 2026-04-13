# Migration to npm_lib — расширение библиотеки

> **Цель**: Расширить npm_lib новыми возможностями (capabilities, action holders, недостающие методы провайдеров), чтобы библиотека предоставляла полный API для замены legacy AI plugin.
>
> **Принцип**: npm_lib — универсальная AI-библиотека. Не знает о редакторе, не импортирует ничего из `src/`. Можно подключить в любой проект.
>
> **Справочные материалы**:
> - [legacy-ai-plugin-analysis.md](../legacy-ai-plugin-analysis.md) — обзор legacy плагина
> - [provider-compatibility-analysis.md](../provider-compatibility-analysis.md) — сравнение провайдеров
> - [capabilities-deep-dive.md](../capabilities-deep-dive.md) — система capabilities
> - [migration-to-new-plugin.md](migration-to-new-plugin.md) — план для плагина (src/), который использует этот API

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

export enum ActionType {
  Chat            = "Chat",
  Summarization   = "Summarization",
  Translation     = "Translation",
  TextAnalyze     = "TextAnalyze",
  ImageGeneration = "ImageGeneration",
  OCR             = "OCR",
  Vision          = "Vision",
}
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

### 2. Action Holders — синглтон-провайдер на каждый action type

**Проблема**: В Model Assignment можно назначить разные профили на Chat, Summarization, Translation и т.д. Но сейчас эти назначения **нигде не используются** кроме как в UI чата (`chatProfile` / `sessionChatProfile`). Когда снаружи вызывают "Summarize" — нужно использовать `summarizationProfile`, а не `defaultProfile`.

**Как это работает в legacy:**

```javascript
// register.js — каждая кнопка создаёт AI.Request с конкретным ActionType:
let requestEngine = AI.Request.create(AI.ActionType.Summarization);
// → ищет AI.Actions["Summarization"].model
// → создаёт AI.Request с этой моделью
// → отправляет chatRequest(prompt)
```

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

#### 2.1 Синглтон-провайдер на каждый action type

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

#### 2.3 Fallback логика

```
1. taskProfile (e.g. summarizationProfile)   — если назначен
2. defaultProfile                             — если task profile не назначен
3. null → вызывающий код (плагин) решает что делать (показать ошибку, открыть settings)
```

**Затронутые файлы:**
- `npm_lib/services/action-holders.ts` — NEW
- `npm_lib/capabilities.ts` — ActionType enum
- `npm_lib/store/create-profiles-store.ts` — вызов `applyProfileToAction()` при смене профиля

---

### 3. Недостающие методы провайдера

**Проблема**: Наш `AbstractBaseProvider` умеет только chat streaming + tool calling. Для полной замены legacy плагина нужны ещё non-streaming chat, image generation, image vision и OCR.

#### 3.1 Non-streaming chat (`sendMessageSync`)

**Legacy**: `chatRequest(content, block)` без `streamFunc` — отправляет запрос, ждёт полный ответ, возвращает string. Используется для summarization, translation, text analysis, grammar check.

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

#### 3.2 Image Generation (`imageGeneration`)

**Legacy**: `imageGenerationRequest(text)` → base64 string.

**Решение**: Optional метод в base:

```typescript
async imageGeneration?(request: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<string>;
```

Реализации:
- **OpenAI**: `client.images.generate({ model: "dall-e-3", prompt, size })` → base64
- **Остальные**: Не реализуют (capability `Image` не выставлен → метод не вызывается)

#### 3.3 Image Vision (`imageVision`)

**Решение**: Convenience-метод в base class:

```typescript
async imageVision(request: {
  image: string;
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

#### 3.4 Image OCR (`imageOCR`)

**Решение**: Хелпер поверх `imageVision`:

```typescript
async imageOCR(request: { image: string }): Promise<string> {
  return this.imageVision({
    image: request.image,
    prompt: "Extract all text from this image exactly as it appears. Preserve the original formatting, line breaks, and structure.",
  });
}
```

#### 3.5 Streaming support flag (`isSupportStreaming`)

```typescript
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

**Затронутые файлы:**
- `npm_lib/providers/base.ts` — новые методы
- `npm_lib/providers/openai/index.ts` — реализация `imageGeneration()`
- `npm_lib/types.ts` — типы для image requests

---

## Что npm_lib экспортирует наружу (public API)

```typescript
// Action system
initActionHolders()
getActionProvider(actionType: ActionType): AbstractBaseProvider | null
applyProfileToAction(actionType: ActionType, profile: Profile | null): void

// Capabilities
CapabilitiesUI          // enum bitmask
ActionType              // enum

// Методы провайдера (существующие + новые)
provider.sendMessage()           // AsyncGenerator — streaming chat + tools
provider.sendMessageSync()       // Promise<string> — one-shot без стрима
provider.sendMessageAfterToolCall()
provider.imageGeneration()       // Promise<string> — base64 image
provider.imageVision()           // Promise<string> — image → text
provider.imageOCR()              // Promise<string> — image → text (OCR)
provider.createChatName()
provider.stopMessage()
provider.checkProvider()
provider.getProviderModels()     // с capabilities в каждой модели

// Всё остальное что уже экспортируется
registry, stores, types, components...
```

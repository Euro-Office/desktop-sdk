# checkModelCapability — Deep Dive

## Зачем это существует

`checkModelCapability(model)` решает одну задачу: **по model.id определить, ЧТО эта модель умеет**. Результат — bitmask, который потом используется по всему плагину для фильтрации и маршрутизации.

---

## Где определяется bitmask

**Файл**: `scripts/engine/providers/base.js:125-152`

```javascript
AI.CapabilitiesUI = {
  None:        0x00,   // 0b000000000
  Chat:        0x01,   // 0b000000001
  Image:       0x02,   // 0b000000010
  Embeddings:  0x04,   // 0b000000100
  Audio:       0x08,   // 0b000001000
  Moderations: 0x10,   // 0b000010000
  Realtime:    0x20,   // 0b000100000
  Code:        0x40,   // 0b001000000
  Vision:      0x80,   // 0b010000000
  Tools:       0x100,  // 0b100000000
};

// All = OR всех флагов = 0x1FF
let capabilitiesAll = 0;
for (let item in AI.CapabilitiesUI)
  capabilitiesAll |= AI.CapabilitiesUI[item];
AI.CapabilitiesUI.All = capabilitiesAll;
```

---

## Как вызывается

**Файл**: `scripts/engine/engine.js:391-400`

```javascript
// При загрузке моделей от провайдера:
model.endpoints = [];   // Пустой массив — checkModelCapability его заполнит
model.options = {};     // Пустой объект — checkModelCapability может записать max_input_tokens

if (provider.checkExcludeModel(model))
  continue;  // Пропускаем модель

let modelUI = new AI.UI.Model(
  model.name,
  model.id,
  provider.name,
  provider.checkModelCapability(model)  // ← ВОТ ЗДЕСЬ. Bitmask записывается в modelUI.capabilities
);

provider.models.push(model);      // model.endpoints и model.options уже модифицированы side-effectами
provider.modelsUI.push(modelUI);   // modelUI.capabilities = bitmask
```

`checkModelCapability` выполняет ДВЕ роли одновременно:
1. **Возвращает** bitmask capabilities
2. **Мутирует** `model.endpoints[]` и `model.options` как side-effect

---

## Где используется bitmask (consumers)

### 1. Фильтрация моделей в Settings UI

**Файл**: `scripts/settings.js:244-245`

```javascript
// Для каждого action (Chat, Summarization, Translation, ImageGeneration, etc.)
// показываем ТОЛЬКО модели, capabilities которых совпадают с требованиями action:
var options = aiModelsList.filter(function(model) {
  return (action.capabilities & model.capabilities) !== 0;
});
```

Это значит: если action = ImageGeneration (требует `CapabilitiesUI.Image`), то в дропдауне будут **только** модели с флагом `Image` (dall-e-2, dall-e-3, stability и т.д.).

### 2. Проверка поддержки tools (function calling)

**Файл**: `scripts/code.js:1302-1304`

```javascript
async function detectFunctionCallingSupport(model) {
  if ((model.capabilities & AI.CapabilitiesUI.Chat) === 0) return;   // не Chat → skip
  if ((model.capabilities & AI.CapabilitiesUI.Tools) !== 0) return;  // уже знаем что поддерживает → skip
  // ...пробуем отправить test request с tools, если работает → добавляем флаг Tools
}
```

### 3. Автоназначение модели на action

**Файл**: `scripts/code.js:1409-1413`

```javascript
// При добавлении новой модели — автоматически назначает её на action,
// если у action ещё нет модели и capabilities совпадают:
AI.ActionsGetSorted().forEach(function(action) {
  const hasModel = models.some(function(model) { return model.id == action.model });
  if (!hasModel && (action.capabilities & model.capabilities) !== 0) {
    AI.ActionsChange(action.id, model.id);
  }
});
```

### 4. Редактирование capabilities вручную

**Файл**: `scripts/aiModelEdit.js:505-508`

```javascript
// UI позволяет юзеру вручную переключать capabilities-чекбоксы:
for (const key in capabilitiesElements) {
  var itemProps = capabilitiesElements[key];
  itemProps.btn.setValue((capabilities & itemProps.capabilities) !== 0);
}
```

### 5. Проверка isSupportTools в provider

**Файл**: `scripts/engine/providers/provider.js:505-511`

```javascript
isSupportTools(model, modelUI) {
  if (modelUI && modelUI.capabilities !== undefined) {
    return (modelUI.capabilities & AI.CapabilitiesUI.Tools) !== 0;
  }
  return false;
}
```

---

## OpenAI: checkModelCapability

**Файл**: `scripts/engine/providers/internal/openai.js:48-115`

Работает как цепочка if-else. Первый match возвращает результат, остальные пропускаются.

```
model.id содержит → capabilities          | endpoints              | max_input_tokens
──────────────────────────────────────────────────────────────────────────────────────
"whisper-1"       → Audio                  | AudioTranscr, AudioTr  | —
"tts-1"           → Audio                  | AudioSpeech            | —
"babbage-002"     → Chat                   | Completions            | 16k
"davinci-002"     → Chat                   | Completions            | 16k
"embedding"       → Embeddings             | Embeddings             | —
"moderation"      → Moderations            | Moderations            | —
"realtime"        → Realtime               | Realtime               | —
"dall-e-2" (exact)→ Image                  | ImgGen, ImgEdit, ImgVar| —
"dall-e-3" (exact)→ Image                  | ImgGen                 | —
"-image-"         → Image                  | ImgGen                 | —
────────── дальше — все Chat-модели, различаются только token limits ──────────
starts "gpt-4o"   → Chat | Vision          | ChatCompletions        | 128k
starts "o1-"      → Chat | Vision          | ChatCompletions        | 128k
starts "gpt-4"    → Chat | Vision          | ChatCompletions        | 128k
"gpt-3.5-turbo-instruct" → Chat           | Completions            | 4k
starts "gpt-3.5-turbo"   → Chat | Vision  | ChatCompletions        | 16k
всё остальное     → Chat | Vision          | ChatCompletions        | (default)
```

**Ключевые наблюдения:**

1. **Vision даётся ВСЕМ chat-моделям** (gpt-4o, gpt-4, gpt-3.5-turbo, и catch-all). В legacy нет гранулярной проверки "поддерживает ли конкретно эта модель vision" — просто если Chat, то и Vision.

2. **Tools НЕ выставляется** в `checkModelCapability`. Tools определяется отдельно через `detectFunctionCallingSupport()` — пробный запрос с tools, если 200 → добавляем флаг.

3. **Image-модели полностью отделены от Chat**. DALL-E и модели с "-image-" получают ТОЛЬКО `Image`, без `Chat`. Это значит: image-модель нельзя использовать для чата.

4. **Endpoints — это side-effect**, не return value. `model.endpoints` массив заполняется как побочный эффект вызова.

---

## Anthropic: checkModelCapability

**Файл**: `scripts/engine/providers/internal/anthropic.js:41-59`

```
model.id начинается с → capabilities    | endpoints        | max_input_tokens
──────────────────────────────────────────────────────────────────────────────
"claude-2"            → Chat            | ChatCompletions  | 100k (custom 102400)
"claude-3-5-haiku"    → Chat            | ChatCompletions  | 200k
всё остальное         → Chat | Vision   | ChatCompletions  | 200k
```

**Ключевые наблюдения:**

1. **Значительно проще чем OpenAI** — всего 3 ветки. Anthropic не имеет image generation, embeddings, audio и т.д. через свой API.

2. **Claude-2 и Claude-3-5-Haiku — без Vision**. Только Chat. Это корректно: claude-2 не поддерживает изображения; claude-3.5-haiku не поддерживает vision в базовой версии.

3. **Все остальные Claude (3 Opus, 3.5 Sonnet, 3 Haiku через другие имена) — Chat + Vision**.

4. **Tools так же НЕ выставляется** в capabilities. Определяется отдельно.

5. **AI.InputMaxTokens["100k"] = 102400** — нестандартное значение. Для Claude-2 контекстное окно было 100k tokens.

---

## Что происходит с endpoints (side-effect)

`model.endpoints` — массив, в который `checkModelCapability` пушит endpoint types. Потом в `_chatRequest()` используется:

```javascript
// engine.js: выбор endpoint для запроса
let endpointType = AI.Endpoints.Types.v1.Chat_Completions;

// Если модель НЕ имеет Chat_Completions endpoint, но имеет Completions:
if (model.endpoints.indexOf(AI.Endpoints.Types.v1.Chat_Completions) === -1 &&
    model.endpoints.indexOf(AI.Endpoints.Types.v1.Completions) !== -1) {
  endpointType = AI.Endpoints.Types.v1.Completions;
  isUseCompletionsInsteadChat = true;
}
```

То есть endpoints определяют, какой HTTP endpoint использовать: `/chat/completions` vs `/completions` vs `/images/generations` и т.д.

---

## Что это значит для ai-agent

### Нужно ли воспроизводить всю эту систему?

**Нет, если** ai-agent остаётся самостоятельным плагином с собственным UI.

**Да, если** нужна интеграция с editor toolbar — потому что editor смотрит на capabilities чтобы:
- Показать/скрыть кнопки (Image Generation, OCR, Vision) в toolbar
- Отфильтровать модели в settings по action type
- Авто-назначить модели на actions

### Что конкретно можно упростить

1. **Endpoints НЕ нужны** — наш provider сам знает свой endpoint через SDK. Не нужен маршрутизатор `getEndpointUrl()`.

2. **max_input_tokens можно хранить в Model** — не нужен side-effect, просто поле в типе Model.

3. **Capabilities можно вычислять проще** — не нужна цепочка string matching. SDK-провайдеры знают свои capabilities напрямую.

4. **Tools capability можно определять статически** — все наши SDK-провайдеры поддерживают tools (кроме Ollama/LM Studio). Не нужен test request.

### Предлагаемый подход для ai-agent

```typescript
// src/lib/capabilities.ts

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
} as const;

export type Capabilities = number;

/**
 * Вместо per-model string matching, определяем capabilities на уровне провайдера
 * с optional per-model override.
 */
export type ModelWithCapabilities = Model & {
  capabilities: Capabilities;
  maxInputTokens?: number;
  maxOutputTokens?: number;
};
```

Каждый провайдер при возврате моделей из `getProviderModels()` может обогащать их capabilities:

```typescript
// В OpenAI provider:
async getProviderModels(data: TData): Promise<ModelWithCapabilities[]> {
  const models = await this.client.models.list();
  return models.data.map(m => ({
    id: m.id,
    name: m.id,
    provider: "openai",
    capabilities: this.detectCapabilities(m.id),
    maxInputTokens: this.detectMaxTokens(m.id),
  }));
}

private detectCapabilities(modelId: string): Capabilities {
  // Image models
  if (modelId.startsWith("dall-e") || modelId.includes("-image-"))
    return CapabilitiesUI.Image;
  
  // Audio models
  if (modelId.includes("whisper") || modelId.startsWith("tts-"))
    return CapabilitiesUI.Audio;
  
  // Embedding models
  if (modelId.includes("embedding"))
    return CapabilitiesUI.Embeddings;
  
  // Chat models — most support vision and tools
  return CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;
}
```

```typescript
// В Anthropic provider:
private detectCapabilities(modelId: string): Capabilities {
  let caps = CapabilitiesUI.Chat | CapabilitiesUI.Tools;
  
  // claude-2 и claude-3-5-haiku — без vision
  if (modelId.startsWith("claude-2") || modelId.startsWith("claude-3-5-haiku"))
    return caps;
  
  // Все остальные Claude — с vision
  return caps | CapabilitiesUI.Vision;
}
```

### Разница с legacy подходом

| Аспект | Legacy | Предлагаемый |
|--------|--------|-------------|
| Где определяется | Side-effect в `checkModelCapability()` | Return value в `getProviderModels()` |
| Мутации | Модифицирует `model.endpoints` и `model.options` | Чистая функция, возвращает новый объект |
| Endpoints | Определяет HTTP endpoint type | Не нужно — SDK знает endpoint |
| Token limits | Side-effect в `model.options.max_input_tokens` | Поле `maxInputTokens` в Model |
| Tools detection | Test request через `detectFunctionCallingSupport()` | Статический флаг на основе знаний о провайдере |
| Granularity | Per-model string matching | Per-provider defaults + per-model overrides |

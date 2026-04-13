# Migration to new plugin — editor integration (src/)

> **Цель**: Реализовать в `src/` интеграцию с ONLYOFFICE Editor, используя API из npm_lib. Плагин слушает editor events, вызывает провайдеры через `getActionProvider()`, и вставляет результаты в документ.
>
> **Принцип**: `src/` знает о редакторе (`window.Asc.plugin`, events, `Asc.Library`). Импортирует npm_lib и использует его public API. Вся AI-логика — в npm_lib, вся editor-логика — в src/.
>
> **Зависит от**: [migration-to-npm-lib.md](migration-to-npm-lib.md) — пункты 1-3 должны быть реализованы первыми
>
> **Справочные материалы**:
> - [legacy-ai-plugin-analysis.md](../legacy-ai-plugin-analysis.md) — обзор legacy плагина
> - [provider-compatibility-analysis.md](../provider-compatibility-analysis.md) — сравнение провайдеров
> - [capabilities-deep-dive.md](../capabilities-deep-dive.md) — система capabilities

---

## План

### 4. Token Budget + разбиение длинного текста

**Проблема**: Когда пользователь выделяет 50-страничный документ и жмёт "Summarize", текст может не влезть в контекстное окно модели. Legacy решает это через разбиение на chunks с маркерами `[START PART n/N]`.

**Где это нужно**: ТОЛЬКО для non-streaming actions из editor (summarization, translation, text analysis). НЕ для чата.

#### 4.1 Token estimator

```typescript
// src/utils/token-estimator.ts
// ~4 символа ≈ 1 токен для английского, ~2 символа для CJK
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
```

#### 4.2 Text splitter

```typescript
// src/utils/text-splitter.ts
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
// src/utils/multi-part-request.ts
async function sendMultiPartRequest(
  provider: AbstractBaseProvider,
  chunks: string[],
  taskPrompt: string
): Promise<string> {
  if (chunks.length === 1) {
    return provider.sendMessageSync([{
      role: "user",
      content: taskPrompt + "\n\n" + chunks[0]
    }]);
  }

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
  }
  return "";
}
```

**Затронутые файлы:**
- `src/utils/token-estimator.ts` — NEW
- `src/utils/text-splitter.ts` — NEW
- `src/utils/multi-part-request.ts` — NEW

---

### 5. Adapter Layer: message/streaming/tool format conversion

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
           │  actionHolders (npm_lib)    │
           │  → провайдеры              │  ← всё в нашем формате
           │  → stores                  │
           │  → UI (чат)                │
           └────────────────────────────┘
```

- Внутри ai-agent (чат, stores, провайдеры) — всё работает в `ThreadMessageLike`. Никаких legacy форматов.
- Конвертация legacy ↔ ThreadMessageLike происходит **только на входе/выходе EditorBridge**.
- Если плагин работает standalone (без editor) — adapter layer **не загружается вообще**.

#### 5.1 Message Format Converter

```typescript
// src/bridge/message-converter.ts

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
      result: '{"temp": 15}' }
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
// src/bridge/streaming-adapter.ts

/**
 * Обёртка: подписывается на async generator, вызывает legacy callback.
 */
async function streamGeneratorToCallback(
  generator: AsyncGenerator<StreamResult>,
  streamFunc: (text: string) => Promise<boolean>
): Promise<ThreadMessageLike> { ... }
```

#### 5.3 Tool Format Converter

```typescript
// src/bridge/tool-converter.ts

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
- `src/bridge/message-converter.ts` — NEW
- `src/bridge/streaming-adapter.ts` — NEW
- `src/bridge/tool-converter.ts` — NEW
- `src/bridge/types.ts` — NEW: LegacyMessage, LegacyToolCall, LegacyTool types

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
   в) Получает ссылку на actionHolders (npm_lib) — через них будет вызывать провайдеры
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
- `src/bridge/editor-bridge.ts` — NEW: main event bridge, registerEvents, handlers
- `src/bridge/prompts.ts` — NEW: prompt templates
- `src/bridge/editor-api.ts` — NEW: typed wrapper for Asc.Library / Asc.Editor methods
- `src/bridge/types.ts` — NEW: LegacyMessage, LegacyToolCall, LegacyTool types
- `src/bridge/message-converter.ts` — NEW
- `src/bridge/streaming-adapter.ts` — NEW
- `src/bridge/tool-converter.ts` — NEW
- `src/utils/token-estimator.ts` — NEW
- `src/utils/text-splitter.ts` — NEW
- `src/utils/multi-part-request.ts` — NEW

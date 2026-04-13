# ONLYOFFICE Legacy AI Plugin — Analysis

> **Source**: `onlyoffice.github.io/sdkjs-plugins/content/ai/`
> **Version**: 3.2.1 | **GUID**: `asc.{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}`
> **Min ONLYOFFICE**: 8.2.0 | **Editors**: Word, Cell, Slide, PDF

---

## HTML Pages

| File | Purpose |
|------|---------|
| `index.html` | Main (background) plugin entry — loads engine, providers, helpers |
| `chat.html` | Chatbot UI, message history, tool call display |
| `settings.html` | Model selection per action, capability filtering |
| `summarization.html` | Document summarization (length, language, insert method) |
| `helper.html` | Quick action input — ad-hoc AI commands |
| `hyperlink.html` | Fetch and display hyperlink content |
| `aiModelsList.html` | Browse/add/edit/delete configured models |
| `aiModelEdit.html` | Provider + model + credentials config |
| `customProviders.html` | Register external providers |
| `customAssistant.html` | Custom assistant creation (system prompt, name, type) |
| `annotationPopup.html` | Inline spelling/grammar suggestion popup |
| `translationsettings.html` | Source/target language, formality settings |

---

## Providers (14)

| Provider | Type | Tools | Stream |
|----------|------|-------|--------|
| OpenAI | Public | Yes | Yes |
| Anthropic | Public | Yes | Yes |
| Google Gemini | Public | Yes | Yes |
| Mistral | Public | Yes | Yes |
| Groq | Public | Yes | Yes |
| OpenRouter | Aggregator | Yes | Yes |
| Together.ai | Public | Yes | Yes |
| xAI (Grok) | Public | Yes | Yes |
| DeepSeek | Public | Yes | Yes |
| Zhipu | Chinese | Yes | Yes |
| Stability AI | Public (images) | No | Yes |
| Ollama | Local | No | Yes |
| LM Studio | Local | No | Yes |
| GPT4All | Local | No | No |

Все провайдеры наследуют `Provider(name, url, key, addon)` из `scripts/engine/providers/base.js`.

---

## Action Types

```
AI.ActionType = {
  Chat, Summarization, Translation, TextAnalyze,
  ImageGeneration, OCR, Vision
}
```

Каждый action имеет `name`, `icon`, `model`, `capabilities`. Сохраняются в localStorage (`onlyoffice_ai_actions_key`).

---

## Core Engine Methods

### `AI.Request` (`scripts/engine/engine.js`)

| Method | Description |
|--------|-------------|
| `Request.create(action, disableSettings)` | Создает request для конкретного action type |
| `chatRequest()` | Стандартный chat completion |
| `chatRequestAgent()` | Chat с поддержкой tool calling (agent loop) |
| `_chatRequest()` | Внутренняя реализация с token handling |
| `imageGenerationRequest()` | Генерация изображений |
| `imageVisionRequest()` | Анализ изображений (vision) |
| `imageOCRRequest()` | OCR — распознавание текста |
| `getTranslateResult()` | Перевод текста |
| `_wrapRequest()` | Обертка с error/block handling |
| `AI.getModels(provider)` | Получение списка моделей от провайдера |
| `Request.setErrorHandler(cb)` | Установка обработчика ошибок |

### `Asc.Editor` (`scripts/engine/library.js`)

| Method | Description |
|--------|-------------|
| `callMethod(name, args)` | Вызов метода редактора (StartAction, EndAction, etc.) |
| `callCommand(func)` | Выполнение macro-кода в редакторе |
| `pause(msec)` | Пауза выполнения |
| `getType()` | Тип редактора: word/cell/slide/pdf |

### `Asc.Library` — Document Operations

| Method | Description |
|--------|-------------|
| `GetSelectedText()` | Получить выделенный текст |
| `GetSelectedImage()` | Получить выделенное изображение |
| `InsertAsMD(markdown, plugins)` | Вставить как Markdown |
| `InsertAsComment(text)` | Вставить как комментарий |
| `InsertAsReview(text)` | Вставить как рецензию |
| `InsertAsHTML(html)` | Вставить как HTML |
| `InsertAsText(text)` | Вставить как plain text |
| `ReplaceTextSmart(texts)` | Умная замена текста |
| `InsertAsHyperlink(url)` | Вставить гиперссылку |
| `AddGeneratedImage(imageUrl)` | Вставить сгенерированное изображение |
| `AddOleObject(imageUrl, description)` | Вставить OLE-объект |
| `PasteText(text)` | Вставить текст |

### Storage (`scripts/engine/storage.js`)

| Method | Description |
|--------|-------------|
| `AI.isLocalDesktop` | Detect Desktop Editor |
| `AI.isLocalUrl(url)` | Check localhost/127.0.0.1 |
| `AI.getDesktopLocalVersion()` | Parse Desktop version |
| `AI.loadResourceAsText(url)` | Load resource via XHR |
| `AI.loadHelperTranslations()` | Load localized helper texts |

### Registration & UI (`scripts/engine/register.js`)

| Method | Description |
|--------|-------------|
| `registerButtons(window)` | Main plugin init — registers all buttons |
| `chatWindowShow(attachedText, isForceSend)` | Open chat window |
| `onCheckGrammarSpelling(isCurrentOnly)` | Grammar/spelling check |
| `onOpenSettingsModal()` | Open settings |

---

## External API (Plugin ↔ Editor Communication)

### Plugin Lifecycle

```js
window.Asc.plugin.init()           // Plugin initialization
window.Asc.plugin.onTranslate()    // Language change
window.Asc.plugin.onThemeChanged() // Theme change
```

### Window Management

```js
Asc.PluginWindow()                    // Create new plugin window
window.chatWindow.show(variation)     // Display window
window.chatWindow.activate()          // Bring to foreground
window.chatWindow.command(cmd, data)  // Send command to window
window.Asc.plugin.sendToPlugin()      // Send message to parent
```

### Events (входящие)

| Event | Description |
|-------|-------------|
| `onAIPluginSettings` | Запрос настроек |
| `onContextMenuShow` | Контекстное меню показано |
| `onContextMenuClick` | Клик по контекстному меню |
| `onToolbarMenuClick` | Клик по toolbar menu |
| `ai_onExternalFetch` | Fetch-запрос (для external calls) |
| `ai_onCustomProviders` | Загружены внешние провайдеры |
| `ai_onCustomInit` | Данные инициализации от редактора |
| `ai_onCallTool` | Tool вызван редактором |
| `ai_onCustomToolRegister` | Регистрация нового tool |
| `ai_onCustomToolUnregister` | Удаление tool |
| `onChatMessage` | Получено chat-сообщение |
| `onChatReplace` | Замена содержимого |
| `onDockedChanged` | Изменение docking окна |
| `onThemeChanged` | Изменение темы |
| `onWindowReady` | Окно инициализировано |

### Plugin Info

```js
window.Asc.plugin.info.editorType    // "word", "cell", "slide", "pdf"
window.Asc.plugin.info.editorSubType // "pdf" для PDF
window.Asc.plugin.info.lang          // Language code
window.Asc.plugin.info.jwt           // JWT token
window.Asc.plugin.tr(text)           // Translate string
```

---

## Tool System (Function Calling)

### Tool Definition

```js
RegisteredFunction({
  name: "functionName",
  description: "Human-readable description",
  parameters: {
    type: "object",
    properties: { /* JSON schema */ },
    required: ["param1"]
  },
  examples: [ /* usage examples */ ]
})
```

Определяются в `scripts/helpers/helperFuncs.js`. `EditorHelperImpl` предоставляет:
- `getTools()` — tools в JSON schema формате
- `getToolsSystemPrompt()` — system prompt с описанием инструментов
- `callFunc(functionCall)` — выполнение функции
- `names2funcs` — map имен к реализациям

### Agent Loop (max 10 итераций)

```
User message → AI.Request.chatRequestAgent()
  → Provider возвращает ответ с optional tool_calls
  → Если tool_calls:
      → Для каждого tool_call:
          → onToolCallStart event
          → EditorHelper.names2funcs[funcName].call(args)
          → onToolCallEnd event
          → Результат добавляется в messages как tool result
      → Цикл продолжается
  → Иначе: возврат ответа в чат
```

```js
AgentState = {
  MAX_LOOP_ITERATIONS: 10,
  isStopped: false,
  tools: null,
  systemToolsPrompt: "",
  toolsSystemPrompt: ""
}
```

### Available Tools by Editor Type

#### Word Editor
| Tool | Description |
|------|-------------|
| `addImage(description, width, height, style)` | Generate & insert image |
| `rewriteText(tone, style, language)` | Rewrite selected text |
| `addImageByDescription()` | AI image generation |
| `checkSpelling()` | Check spelling |
| `checkGrammar()` | Check grammar |
| `insertPage()` | Insert new page |
| `textStyle(style)` | Apply text style |
| `paragraphStyle(style)` | Apply paragraph style |
| `writeMacro(code)` | Execute macro |

#### Cell (Spreadsheet) Editor
| Tool | Description |
|------|-------------|
| `addChart(type, title, subtitle)` | Create chart |
| `addImage()` | Insert image |
| `readContext()` | Get range data |
| `getRangeData(range)` | Read cell values |
| `getCellDetails(cell)` | Get cell properties |
| `getSheetObjects()` | List sheet objects |
| `searchData(criteria)` | Search cells |
| `setSort(column, order)` | Sort data |
| `setMultiSort(columns)` | Multi-column sort |
| `setAutoFilter()` | Enable auto-filter |
| `addColorScale()` | Color scale formatting |
| `addDataBars()` | Data bars |
| `addIconSet()` | Icon set formatting |
| `addCellValueCondition()` | Conditional formatting |
| `addTop10Condition()` | Top/bottom 10 |
| `fillMissingData()` | Fill gaps |
| `fixFormula(formula)` | Correct formula |
| `explainFormula(formula)` | Explain formula |
| `insertPivotTable()` | Create pivot table |
| `writeMacro(code)` | Execute macro |

#### Slide (Presentation) Editor
| Tool | Description |
|------|-------------|
| `addNewSlide()` | Insert slide |
| `deleteSlide()` | Delete slide |
| `duplicateSlide()` | Copy slide |
| `changeSlideBackground(color, image)` | Modify background |
| `addShapeToSlide(type, text)` | Insert shape |
| `addTableToSlide(rows, cols)` | Insert table |
| `addChartToSlide(type)` | Insert chart |
| `addTextToPlaceholder(text)` | Fill placeholder |
| `addImageByDescription(description)` | Generate & add image |
| `generatePresentationWithTheme()` | Create full presentation |
| `writeMacro(code)` | Execute macro |

---

## Model Capabilities (bitmask)

```js
AI.CapabilitiesUI = {
  None:        0x00,
  Chat:        0x01,   // Text generation
  Image:       0x02,   // Image generation
  Embeddings:  0x04,   // Text embeddings
  Audio:       0x08,   // Speech/audio
  Moderations: 0x10,   // Content moderation
  Realtime:    0x20,   // Real-time streaming
  Code:        0x40,   // Code execution
  Vision:      0x80,   // Image analysis
  Tools:       0x100   // Function calling
}
```

---

## Endpoint Types

```js
AI.Endpoints.Types.v1 = {
  Models:                 0x00,
  Chat_Completions:       0x01,
  Completions:            0x02,
  Images_Generations:     0x03,
  Images_Edits:           0x04,
  Images_Variations:      0x05,
  Embeddings:             0x06,
  Audio_Transcriptions:   0x07,
  Audio_Translations:     0x08,
  Audio_Speech:           0x09,
  Moderations:            0x0A,
  Language:               0x0B,
  Code:                   0x0C,
  Realtime:               0x0D,
  OCR:                    0x0E
}
```

---

## Provider Base Class API

```js
Provider(name, url, key, addon)
  .getModels()                              // Get model list
  .correctModelInfo(model)                  // Normalize model info
  .checkExcludeModel(model)                 // Filter excluded models
  .checkModelCapability(model)              // Detect capabilities
  .getEndpointUrl(endpoint, model, options) // Build endpoint URL
  .getRequestHeaderOptions()               // Auth headers
  .getRequestBodyOptions(body)             // Provider-specific body
  .getChatCompletions(body, model)         // Format chat request
  .getCompletions(body, model)             // Format completions
  .getChatCompletionsResult(data, model, isComplete) // Parse response
  .isSupportTools(model, modelUI)          // Check tool support
  .isSupportStreaming()                    // Check streaming support
  .isUseProxy()                            // Determine proxy usage
```

---

## LocalStorage Keys

| Key | Description |
|-----|-------------|
| `onlyoffice_ai_actions_key` | Selected models per action |
| `onlyoffice_ai_models_key` | Available models |
| `onlyoffice_ai_providers_key` | Provider configurations |
| `onlyoffice_ai_chat_placement` | Chat window position |
| `onlyoffice_ai_custom_assistants` | Custom assistant definitions |
| `current-model` (Desktop) | Default model |
| `current-provider` (Desktop) | Default provider |

---

## Text Annotations

| Module | Description |
|--------|-------------|
| `TextAnnotator` | Base annotation manager (`annotate()`, `clearAnnotations()`) |
| `SpellChecker` | Spell check annotations |
| `GrammarChecker` | Grammar check annotations |
| `CustomAssistantManager` | Custom assistant annotations (`createAssistant()`, `onClick()`) |
| `AssistantHint` | Display hint with suggestion |
| `AssistantReplace` | Direct text replacement |
| `AssistantReplaceHint` | Show before replacing |

---

## Chat UI (`scripts/chat.js`)

| Component | Description |
|-----------|-------------|
| `messagesList._renderItemToList()` | Render single message |
| `messagesList._renderToolCall()` | Display function call execution |
| `messagesList._renderItem()` | Render text message |
| Voice input (`chatVoice.js`) | Speech recognition, TTS, punctuation commands |
| `MarkDownStreamer` (`generate.js`) | Streaming markdown → document with token prediction |

---

## Server Settings (optional)

```js
AI.serverSettings = {
  proxy: "...",     // Proxy endpoint
  actions: {...},   // Server-provided action configs
  models: [...]     // Server-provided models
}
```

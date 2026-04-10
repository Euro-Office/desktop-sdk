# План миграции бизнес-логики из src/ в npm_lib

## Контекст

В npm_lib уже вынесены: провайдеры (11), система тулов/серверов, абстракции storage и platform, типы, React-контексты и global holders. В src/ осталась бизнес-логика в Zustand-сторах, хуках и утилитах. Конкретные реализации (IndexedDB storage, ONLYOFFICE platform adapter) остаются в src/ — библиотека предоставляет только интерфейсы. Цель — сделать npm_lib самодостаточной библиотекой чата, которую можно подключить в любое приложение с минимальной обвязкой.

---

## Что выносим (по порядку)

### Фаза 0: Покрытие тестами перед рефакторингом

Сейчас в src/ **ноль unit-тестов**. Все 28 test-файлов находятся в npm_lib/. Перед переездом бизнес-логики нужно покрыть тестами всё, что будет затронуто — чтобы при рефакторинге ловить регрессии.

**Тестовая инфраструктура:** Vitest (уже настроен), тесты кладём рядом с кодом в `tests/` директории (как в npm_lib/).

#### 0.1 Утилиты (`src/lib/utils.ts`)

**Файл тестов:** `src/lib/tests/utils.test.ts`

Покрыть:
- `convertMessagesToMd()` — основной кандидат на перенос
  - user-сообщения оборачиваются в `## heading`
  - assistant-сообщения — plain text
  - массив content с text, tool-call (tool-call пропускается), string content
  - пустые сообщения, пустой массив
- `removeSpecialCharacter()` — удаляет `\/:*"<>|?`
- `getMessageTitleFromMd()` — первая строка без `## `, обрезка до 30 символов
- `sanitizeProviderName()` — делегирует в removeSpecialCharacter

#### 0.2 Zustand Stores

Сторы тестируются без React — создаём store, вызываем actions, проверяем state. Мокаем `getStorageInstance()`, `getProviderInstance()`, `getServersInstance()`, `getPlatformInstance()`, `localStorage`.

**a) `src/store/tests/useProfilesStore.test.ts`**

Покрыть:
- `init()` — загрузка профилей из storage, восстановление default/task-профилей из localStorage
- `addProfile()` — валидация дублей имён, проверка провайдера, сохранение в storage, auto-set default для первого
- `editProfile()` — валидация дублей, обновление каскадных task-профилей, синхронизация провайдера
- `deleteProfile()` — каскадная очистка task-профилей, переназначение default, обновление localStorage
- `getProfileById()`, `getProfileByName()` — поиск (case-insensitive)
- `setDefaultProfile()`, `setChatProfile()`, `setSessionChatProfile()` — установка + синхронизация провайдера через `applyCurrentChatProvider`
- `setSummarizationProfile()`, `setTranslationProfile()`, etc. — установка + localStorage persist
- `toggleExtendedThinking()` — toggle + localStorage persist
- `selectCurrentChatProfile()` — приоритет: session > chat > default
- Хелперы: `loadProfileById()`, `applyCurrentChatProvider()`

**b) `src/store/tests/useServersStore.test.ts`**

Покрыть:
- `initServers()` — парсинг конфига из localStorage, запуск серверов
- `getTools()` — построение списка тулов с фильтрацией disabled, лимитами MAX_TOOL_COUNT, prefixing `{type}_{name}`
  - Кейс с disabledTools в localStorage
  - Кейс без disabledTools (первый запуск)
  - Web search tools обрабатываются отдельно (отдельный лимит MAX_TOOL_COUNT_WITH_WEB_SEARCH)
  - Превышение лимита → автоматический disable
- `changeToolStatus()` — enable/disable тулов
  - Enable: проверка лимита, обновление disabledTools, persist в localStorage
  - Disable: добавление в disabledTools, фильтрация из tools, persist
  - Web search: включает/выключает все тулы группы разом
- `callTools()` — роутинг вызова: парсинг type из имени, проверка disabled, делегирование в Servers
- `checkAllowAlways()`, `setAllowAlways()` — делегирование в Servers
- `saveConfig()` — persist в localStorage + перезапуск серверов
- `getConfig()` — чтение из localStorage
- `deleteCustomServer()` — удаление + обновление конфига

**c) `src/store/tests/useThreadsStore.test.ts`**

Покрыть:
- `initThreads()` — загрузка из storage
- `insertThread()` — создание + добавление в state + persist
- `insertNewMessageToThread()` — обновление lastEditDate + profileId + persist
- `migrateThreadFromProviderModelToProfile()` — маппинг legacy provider/model → profileId
  - Точное совпадение (type + baseUrl + modelId + key)
  - Частичное совпадение (type + baseUrl + modelId)
  - Fallback на chatProfile → defaultProfile
  - Обновление в state + persist
- `onSwitchToNewThread()` — сброс sessionChatProfile, новый threadId
- `onSwitchToThread()` — переключение + миграция legacy + установка sessionChatProfile
- `onDownloadThread()` — загрузка messages из storage + конвертация в md + вызов platform.file.saveAsFile
- `onRenameThread()` — обновление title + persist
- `onDeleteThread()` — каскадное удаление messages + thread + переключение если текущий
- `onClearThreadHistory()` — удаление messages + очистка store если текущий тред

**d) `src/store/tests/useMessageStore.test.ts`**

Покрыть:
- `fetchPrevMessages()` — загрузка из storage + синхронизация с провайдером
- `addMessage()` — добавление, замена incomplete-сообщения
- `updateLastMessage()` — обновление последнего
- `stopMessage()` — сброс isStreamRunning + вызов provider.stopMessage()
- `clearMessages()` — очистка + сброс prevMessages в провайдере

**e) `src/store/tests/usePromptsStore.test.ts`**

Покрыть:
- `initPrompts()` — загрузка prompts + folders из storage
- `addPrompt()` — генерация id, name из первых 15 символов, timestamps, persist
- `editPrompt()` — частичное обновление (name, text, folderId), updatedAt bump
- `removePrompt()` — удаление из state + persist
- `addFolder()` — создание + persist + возврат id
- `renameFolder()` — обновление name + updatedAt
- `removeFolder()` — каскадное удаление folder + все промпты в нём

#### 0.3 Хук useMessages (`src/hooks/useMessages.ts`)

**Файл тестов:** `src/hooks/tests/useMessages.test.ts`

Это самый сложный для тестирования — React хук с async generators. Тестируем через `renderHook` из `@testing-library/react`.

Покрыть:
- `onNew()` — отправка нового сообщения
  - Создание userMessage с text content
  - Обработка файловых вложений (FileMessagePart)
  - Обработка image вложений (ImageMessagePart)
  - Создание нового треда с генерацией title
  - Обновление существующего треда
  - Вызов provider.sendMessage() + обработка стрима
- `handleStream()` — обработка потока ответов
  - Первое сообщение → addMessage + persist в storage
  - Последующие дельты → updateLastMessage + persist
  - Окончание стрима (`isEnd`) → сброс streaming flags
  - Incomplete status → addMessage + сброс
  - Tool call в ответе → вызов handleToolCall
  - Переключение треда во время стрима → прерывание
- `handleToolCall()` — обработка вызова инструмента
  - Auto-allow (checkAllowAlways) → вызов + продолжение стрима
  - Требуется approval → setManageToolData
  - Deny → "User deny tool call" result
- `approveToolCall()` — одобрение с опцией always-allow
- `denyToolCall()` — отказ

#### 0.4 Миграция (`src/lib/migrateProvidersToProfiles.ts`)

**Файл тестов:** `src/lib/tests/migrateProvidersToProfiles.test.ts`

Покрыть:
- Нет провайдеров в localStorage → ничего не делает, чистит stale keys
- Валидные провайдеры → создание профилей для каждой пары provider×model
- Установка default profile из текущего провайдера/модели
- Невалидные данные (corrupted JSON, missing fields) → graceful cleanup
- Неизвестный тип провайдера → пропуск
- Сортировка созданных профилей по имени

---

### Фаза 1: SettingsAdapter + базовые утилиты

#### 1.1 SettingsAdapter — абстракция над key-value хранилищем

**Что:** Новый адаптер для key-value настроек. localStorage — это деталь реализации конкретного чата (как IndexedDB для storage). Библиотека работает через абстракцию.

**Почему первым:** Все сервисные классы (фаза 2) зависят от settings для хранения конфигурации (выбранные профили, disabled tools, MCP конфиг, extended thinking). Без этой абстракции бизнес-логику не вынести.

**Новые файлы в npm_lib:**
- `npm_lib/settings/types.ts`:
```ts
export interface SettingsAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```
- `npm_lib/settings/context.tsx` — React-контекст + хук `useSettings()`
- `npm_lib/settings/settings-holder.ts` — глобальный holder для доступа из сервисов
- `npm_lib/settings/index.ts` — ре-экспорт

**Реализация в src/ (остаётся в src/):**
- `src/settings/localStorage.ts` — `LocalStorageSettings implements SettingsAdapter`

**Экспорт из npm_lib/index.ts:**
```ts
export type { SettingsAdapter } from "./settings/types";
export { SettingsProvider, useSettings } from "./settings/context";
export { getSettingsInstance, setSettingsInstance } from "./settings/settings-holder";
```

#### 1.2 Утилиты — только generic бизнес-логика сообщений

**Что:** Только утилиты, работающие с core-типами библиотеки (сообщения, строки).

**Перенести в `npm_lib/utils.ts`:**
- `convertMessagesToMd()` — конвертация сообщений в markdown (работает с `ThreadMessageLike` — core тип)
- `removeSpecialCharacter()` — санитизация строк (используется в ThreadsService для экспорта)
- `getMessageTitleFromMd()` — извлечение заголовка из markdown

**Что остаётся в src/lib/ (host-specific):**
- `cn()` — tailwind merge (UI)
- `isDesktopEditor()`, `isExternalProcessAvailable()` — проверка окружения
- `isDocument`, `isPresentation`, `isSpreadsheet`, `isPdf`, `isDjVu`, `isXps`, `isPdfForm`, `isVisio` — типы файлов ONLYOFFICE
- `sanitizeProviderName()` — используется только в UI компонентах
- `migrateProvidersToProfiles.ts` — работает напрямую с localStorage, host-specific миграция
- Все константы (`*_PROFILE_KEY`, `PROVIDERS_LOCAL_STORAGE_KEY`, etc.) — ключи localStorage, деталь реализации конкретного чата

---

### Фаза 2: Сервисные классы (бизнес-логика из сторов)

Ключевой этап. Извлекаем чистую бизнес-логику из Zustand-сторов в сервисные классы. Zustand-сторы в src/ становятся тонкими обёртками: хранят state и делегируют операции сервисам.

#### 2.1 ProfilesService (`npm_lib/services/profiles.ts`)

**Извлекается из:** `src/store/useProfilesStore.ts`

**Логика:**
- `loadProfileById(profiles, key)` — загрузка профиля по ключу из settings (ключи передаются снаружи)
- `applyCurrentChatProvider(session, chat, default)` — синхронизация провайдера
- `addProfile(data)` — валидация имени + проверка провайдера + сохранение в storage
- `editProfile(profile)` — валидация + обновление + каскадное обновление task-профилей
- `deleteProfile(id, taskKeys)` — удаление + каскадная очистка task-профилей + переназначение default
- `initProfiles(config: { defaultKey, taskKeys })` — загрузка из storage + восстановление task-назначений из settings
- `setTaskProfile(key, profile)` — установка task-профиля с сохранением в settings
- `selectCurrentChatProfile(session, chat, default)` — pure function

**Важно:** Сервис не знает конкретные ключи настроек (`"default-profile"`, `"chat-profile"`, etc.). Ключи передаются из src/ при инициализации — это деталь реализации конкретного чата.

**Зависимости:** `StorageAdapter`, `SettingsAdapter`, `Provider` (provider holder) — всё в npm_lib.

#### 2.2 ServersService (`npm_lib/services/servers.ts`)

**Извлекается из:** `src/store/useServersStore.ts`

**Логика:**
- `initServers(config: { serversKey, disabledToolsKey })` — загрузка MCP конфига из settings, запуск серверов
- `buildToolsList(allTools, disabledTools)` — фильтрация, лимиты, prefixing
- `changeToolStatus(type, name, enabled, currentTools, disabledTools)` — обновление статуса с учётом лимитов
- `saveConfig(config)` / `getConfig()` — persistence MCP конфига через settings
- `deleteCustomServer(name)` — удаление + обновление конфига
- `callTools(name, args, disabledTools)` — роутинг вызова через Servers

**Важно:** Ключи настроек (`"mcpServers"`, `"disabledTools"`) передаются при инициализации.

**Зависимости:** `Servers` (tools holder), `SettingsAdapter` — всё в npm_lib.

#### 2.3 ThreadsService (`npm_lib/services/threads.ts`)

**Извлекается из:** `src/store/useThreadsStore.ts`

**Логика:**
- `createThread(threadId, title, profileId)` — создание + сохранение в storage
- `touchThread(threadId, updates)` — обновление metadata
- `migrateThreadToProfile(thread, profiles, chatProfile, defaultProfile)` — миграция legacy thread
- `downloadThread(threadId, threads)` — получение сообщений + конвертация в md + вызов platform.file.saveAsFile
- `renameThread(id, title)` — переименование + persist
- `deleteThread(id)` — каскадное удаление messages + thread

**Зависимости:** `StorageAdapter`, `PlatformAdapter` (platform holder) — всё в npm_lib.

#### 2.4 PromptsService (`npm_lib/services/prompts.ts`)

**Извлекается из:** `src/store/usePromptsStore.ts`

**Логика:**
- `createPrompt(text, folderId)` — создание + persist
- `updatePrompt(id, updates)` — обновление + persist
- `deletePrompt(id)` — удаление + persist
- `createFolder(name)` / `renameFolder(id, name)` / `deleteFolder(id)` — CRUD папок с каскадным удалением

**Зависимости:** `StorageAdapter` — уже в npm_lib.

---

### Фаза 3: ChatEngine — оркестрация чата

**Извлекается из:** `src/hooks/useMessages.ts`

**Новый файл:** `npm_lib/services/chat-engine.ts`

Это самый сложный компонент — ядро чата. Сейчас в `useMessages` переплетены:
- Отправка сообщений (подготовка контента, вложения)
- Стриминг ответов (async generator processing)
- Обработка tool calls (approval workflow, auto-allow, deny)
- Создание тредов (генерация title через провайдер)
- Координация storage persistence

**Класс ChatEngine:**
```ts
class ChatEngine {
  constructor(deps: {
    provider: Provider;
    servers: Servers;
    storage: StorageAdapter;
    settings: SettingsAdapter;
  })

  // Основной flow отправки сообщения
  sendMessage(params: {
    text: string;
    threadId: string;
    files?: TAttachmentFile[];
    images?: TAttachmentImage[];
    existingMessages: ThreadMessageLike[];
    extendedThinking: boolean;
    profileId?: string;
  }): AsyncGenerator<ChatEvent>

  // Tool call handling
  approveToolCall(toolCallData: ToolCallData): AsyncGenerator<ChatEvent>
  denyToolCall(toolCallData: ToolCallData): AsyncGenerator<ChatEvent>

  // Stop streaming
  stop(): void
}
```

**Тип ChatEvent (union):**
- `{ type: "message-start", message, messageUID }` — начало ответа
- `{ type: "message-delta", message }` — обновление стрима
- `{ type: "message-end", message }` — конец стрима
- `{ type: "tool-call-pending", message, idx, messageUID }` — нужен approval
- `{ type: "thread-created", threadId, title, profileId }` — создан новый тред
- `{ type: "error", error }` — ошибка

**Преимущество:** React-хук `useMessages` станет тонкой обёрткой, которая подписывается на события ChatEngine и обновляет Zustand state. Вся логика стриминга и tool calls — в npm_lib.

---

### Фаза 4: Тонкие Zustand-обёртки в src/

После фаз 2-3 сторы в src/ сокращаются до минимума:

**useProfilesStore (было ~440 строк → ~80):**
```ts
// Хранит state, делегирует ProfilesService
const useProfilesStore = create((set, get) => ({
  profiles: [],
  defaultProfile: null,
  // ...state fields...
  init: async () => {
    const result = await profilesService.initProfiles();
    set(result);
  },
  addProfile: async (data) => {
    const result = await profilesService.addProfile(data);
    if (result.success) set(state => ({ profiles: [result.profile, ...state.profiles] }));
    return result;
  },
  // ...thin wrappers...
}));
```

Аналогично для остальных сторов. Zustand остаётся в src/ как React state management, а бизнес-логика — в npm_lib.

**Фаза 4 не является отдельным шагом** — рефакторинг каждого стора происходит в рамках фазы 2 при создании соответствующего сервиса. Выделена для наглядности конечного результата.

---

## Порядок и зависимости

```
Фаза 0: Тесты                         (делаем первой, покрываем всё что будем трогать)
  0.1 Утилиты                         (convertMessagesToMd, removeSpecialCharacter, etc.)
  0.2 Zustand stores                   (profiles, servers, threads, messages, prompts)
  0.3 useMessages hook                 (chat orchestration)
  0.4 migrateProvidersToProfiles       (data migration)
   ↓
Фаза 1: SettingsAdapter + утилиты     (нет зависимостей)
  1.1 SettingsAdapter                  (разблокирует сервисы)
  1.2 Утилиты                         (convertMessagesToMd, removeSpecialCharacter)
   ↓
Фаза 2: Сервисные классы              (зависит от 1)
  2.4 PromptsService                   (самый простой, начать с него)
  2.3 ThreadsService                   (зависит от utils)
  2.1 ProfilesService                  (зависит от SettingsAdapter)
  2.2 ServersService                   (зависит от SettingsAdapter)
   ↓
Фаза 3: ChatEngine                    (зависит от 2.1, 2.2, 2.3)
   ↓
Фаза 4: Рефакторинг сторов            (параллельно с фазами 2 и 3)
```

---

## Что НЕ выносим (остаётся в src/)

| Файл/модуль | Причина |
|---|---|
| `src/storage/indexeddb/` | Конкретная реализация StorageAdapter — host-specific |
| `src/settings/localStorage.ts` | Конкретная реализация SettingsAdapter — host-specific |
| `src/lib/constants.ts` | Ключи localStorage — деталь реализации конкретного чата |
| `src/lib/migrateProvidersToProfiles.ts` | Работает напрямую с localStorage, host-specific миграция |
| `isDocument`, `isPdf`, etc. | Типы файлов ONLYOFFICE — host-specific |
| `useAttachmentsStore` | Чистый UI state (лимит 5 файлов/картинок), нет бизнес-логики |
| `useRouter`, `useThemeStore` | Чисто UI state |
| `cn()`, `isDesktopEditor()` | UI/platform-специфичные утилиты |
| `src/platform/` (adapters) | Конкретные реализации PlatformAdapter — host-specific |
| `src/hooks/useServers.ts`, `useProfiles.ts`, `useThreads.ts` | Тонкие React-хуки инициализации, ~20 строк каждый |
| Компоненты, страницы, переводы, стили | UI-слой |

---

## Верификация

После каждой фазы:
1. `npm run check` — Biome lint/format
2. `npm run test` — Vitest unit tests
3. `npm run build` — TypeScript + Vite build
4. Ручная проверка: открыть плагин, создать профиль, отправить сообщение, проверить tool call, переключить тред, скачать тред
5. Для npm_lib: убедиться что все новые модули экспортированы из `npm_lib/index.ts` и покрыты тестами

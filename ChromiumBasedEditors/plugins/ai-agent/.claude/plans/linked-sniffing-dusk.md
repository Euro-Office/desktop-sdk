# Plan: npm_lib Review Fixes — Tests, Abstraction, Refactoring, Performance

## Context

После выноса UI-слоя в npm_lib проведено ревью библиотеки. Выявлены 4 категории проблем: отсутствие тестов (покрытие 14%), нарушение абстракции (прямой localStorage вместо адаптеров), дублирование кода и проблемы перформанса (eager-загрузка). План фиксит всё поэтапно — сначала тесты на существующий код, потом рефакторинг под защитой тестов.

---

## Phase 1: Тесты

Покрыть существующий код ДО рефакторинга, чтобы потом менять под защитой тестов.

### 1.1 Services (приоритет — вся бизнес-логика, 0% покрытия)
- `npm_lib/services/tests/chat-engine.test.ts` — sendMessage flow, tool-call-pending, approve/deny, stop
- `npm_lib/services/tests/profiles.test.ts` — init, addProfile, editProfile, deleteProfile, clearTaskProfileIfMatch, applyCurrentChatProvider
- `npm_lib/services/tests/threads.test.ts` — loadAll, createThread, migrateThreadToProfile, downloadThread, deleteThread
- `npm_lib/services/tests/servers.test.ts` — initServers, buildToolsList, changeToolStatus, callTools, checkAllowAlways
- `npm_lib/services/tests/prompts.test.ts` — loadAll, createPrompt, updatePrompt, deletePrompt, createFolder, deleteFolder

### 1.2 Hooks (0% покрытия)
- `npm_lib/hooks/tests/useMessages.test.ts` — processEvents flow, tool approval, onNew с attachments
- `npm_lib/hooks/tests/useDirection.test.ts` — RTL detection
- `npm_lib/hooks/tests/useDebouncedCallback.test.ts` — debounce + cancel

### 1.3 Lib (25% покрытия)
- `npm_lib/lib/tests/debounce.test.ts` — debounce, cancel
- `npm_lib/lib/tests/api-key-links.test.ts` — getApiKeyLink returns correct URLs
- `npm_lib/lib/tests/images.test.ts` — parseImageMeta, buildCollections, getImageSrc, getProviderImageSrc

### 1.4 i18n
- `npm_lib/tests/i18n.test.ts` — initAIChatI18n с дефолтами, с кастомной локалью, идемпотентность

---

## Phase 2: Абстракция — localStorage → SettingsAdapter

Убрать прямой `localStorage` в библиотеке. Всё должно идти через `getSettingsInstance()`.

### 2.1 tools/sources/WebSearch.ts
- Строки 18, 31: `localStorage.getItem/setItem(WEB_SEARCH_DATA)` → `getSettingsInstance().get/set()`
- Ключ `WEB_SEARCH_DATA` передавать через конструктор или использовать дефолт

### 2.2 tools/servers.ts
- Строки 21, 56: `localStorage.getItem/setItem(ALLOW_ALWAYS_TOOLS)` → `getSettingsInstance().get/set()`

### 2.3 providers/index.ts
- Строка 45: `localStorage.getItem(CURRENT_MODEL_KEY)` → `getSettingsInstance().get()`

### 2.4 Тесты
- Обновить существующие тесты WebSearch.test.ts, HostToolSource.test.ts если они мокают localStorage — перевести на mockSettings

---

## Phase 3: Убрать host-specific код из библиотеки

### 3.1 onlyoffice-proxy:// протокол
- `tools/sources/CustomServers.ts:368,458,549` и `WebSearch.ts:51,92`
- Добавить в `PlatformAdapter` опциональное поле `fetchProxy?: (url: string, init?: RequestInit) => Promise<Response>`
- В CustomServers/WebSearch: если `getPlatformInstance().fetchProxy` есть — использовать его, иначе стандартный `fetch`

### 3.2 isDesktopEditor / isExternalProcessAvailable
- `npm_lib/lib/utils.ts:44-50` — убрать из npm_lib, оставить только в src/lib/utils.ts
- Grep все использования в npm_lib/, заменить на проверки через PlatformAdapter
- `npm_lib/components/servers/ConfigDialog.tsx` использует `isExternalProcessAvailable()` — заменить на `getPlatformInstance().process?.isAvailable`

### 3.3 window.dispatchEvent → callback/EventEmitter
- Создать `npm_lib/events.ts` с простым EventEmitter (on/off/emit)
- Экспортировать singleton `chatEvents`
- Заменить `window.dispatchEvent(new CustomEvent("tools-changed"))` → `chatEvents.emit("tools-changed")`
- Заменить `window.addEventListener("tools-changed")` → `chatEvents.on("tools-changed")`
- Файлы: `CustomServers.ts`, `WebSearch.ts`, `useServers.ts`, `ComposerActionAttachments.tsx`, `ComposerActionServers.tsx`

### 3.4 Полностью удалить Wallet из библиотеки
Wallet — host-specific фича ONLYOFFICE, не место в npm_lib.

**Удалить файлы:**
- `npm_lib/pages/settings/sub-components/wallet/index.tsx` — компонент Wallet

**Очистить Settings:**
- `npm_lib/pages/settings/index.tsx` — удалить:
  - Импорт `Wallet` (строка 12)
  - Константу `showWallet` (строка 15)
  - Весь условный рендеринг по `showWallet` (строки 30-41, 42-43, 50-57, 60-67, 74-75, 79-80)
  - Состояние `selectedSection` — убрать wallet-ветку, оставить только "providers"
- Результат: Settings рендерит `<Models />` напрямую без radio-кнопок и wallet-секции

**Очистить FeatureFlags:**
- `npm_lib/config.ts` — удалить `showWallet` из `FeatureFlags` и `DEFAULT_FEATURE_FLAGS`

**Очистить локали (все JSON в npm_lib/locales/):**
- Удалить ключи: `ONLYOFFICEWallet`, `ONLYOFFICEWalletDescription`, `RegisterConnectWallet`
- В `SelectHowConnectDescription` убрать упоминание "Wallet" (переформулировать или удалить)

**Очистить src/:**
- `src/App.tsx` — убрать `features={{ showWallet: config.showWallet }}` из `<AIChatWidget>`
- `src/config.json` — убрать `showWallet`

### 3.5 Хардкод clientInfo в CustomServers
- `CustomServers.ts:361-364` — `{ name: "ai-agent", version: "1.0.0" }`
- Добавить в `CreateStoresConfig` или `AIChatWidgetProps` поле `clientInfo?: { name: string; version: string }`
- Прокинуть в ServersService → CustomServers

---

## Phase 4: Рефакторинг кода

### 4.1 create-stores.ts — разбить 854-строчную фабрику
- Вынести каждый стор в отдельную фабрику: `createProfilesStore(keys, service)`, `createThreadsStore(...)`, etc.
- В `createStores()` остаётся только композиция
- 7 task-profile сеттеров → цикл по TASK_FIELD_MAP
- `deleteProfile` — 7 вызовов `clearTaskProfileIfMatch` → цикл

### 4.2 useMessages.ts — убрать дублирование
- `processEvents` (52-113) и `processEvent` (115-145) — 6 одинаковых case
- Извлечь `handleEvent(event: ChatEvent)` — один обработчик
- `processEvents` вызывает `handleEvent` в цикле
- Удалить `convertMessage` (identity функция, строка 147-149) — передавать undefined в runtime

### 4.3 useMessages.ts — убрать дублирование ToolCallData
- `approveToolCall` и `denyToolCall` строят одинаковый `ToolCallData` объект
- Извлечь `extractToolData(): ToolCallData | null`

### 4.4 AIChatWidget.tsx — исправить useMemo
- Строка 61: `useMemo(() => initAIChatI18n(...))` — side-effect в useMemo. Заменить на вызов вне рендера или useEffect
- Строка 67: `new Provider()` в useMemo — ок функционально, но семантически лучше вынести

---

## Phase 5: Перформанс

### 5.1 Ленивая загрузка локалей
- `npm_lib/i18n.ts:3-23` — убрать статические импорты всех 21 JSON
- `initAIChatI18n({ locale })` загружает только запрошенную локаль + en (fallback)
- Использовать `i18next-resources-to-backend` или dynamic import: `const mod = await import(./locales/${locale}.json)`
- Экспортировать `bundledLocales` как lazy map

### 5.2 Ленивая загрузка картинок
- `npm_lib/lib/images.ts:44-91` — убрать `eager: true` с 5 глобов
- `import.meta.glob(pattern)` без eager возвращает `() => Promise<module>`
- `getImageSrc` становится async или использует кэш с preload

### 5.3 React.memo на чистых компонентах
- `components/icon/index.tsx` — обернуть в `memo()`
- `components/icon-button/index.tsx` — `memo()`
- `components/layout/sub-components/ChatListItem.tsx` — `memo()`
- `pages/chat/sub-components/AssistantMessage.tsx` — `memo()` для ThinkingMarkdownText
- `pages/chat/sub-components/UserMessage.tsx` — `memo()`

### 5.4 Zustand selectors вместо полной подписки
- `components/layout/sub-components/ChatList.tsx:8` — `useThreadsStore()` → `useThreadsStore(s => ({ threads: s.threads, threadId: s.threadId, ... }))`
- Аналогично во всех компонентах с `const { ... } = useXxxStore()`
- Паттерн: деструктуризация в useStores() + selector на конкретном сторе

### 5.5 useCallback на хэндлерах
- `ChatList.tsx:25` — `onChangeSearchValue` обернуть в `useCallback`
- `Icon.tsx:36` — `handleBeforeInjection` обернуть в `useCallback`

### 5.6 Lazy-загрузка страниц
- Settings, InitialSetup, EmptyScreen — `React.lazy()` в AIChatWidget.tsx
- Обернуть в `<Suspense fallback={<Loader />}>`

---

## Порядок выполнения

1. **Phase 1** (тесты) — покрываем существующий код до любых изменений
2. **Phase 2** (localStorage → SettingsAdapter) — фундамент портабельности
3. **Phase 3** (host-specific) — убираем привязку к ONLYOFFICE + wallet
4. **Phase 4** (рефакторинг) — чистим код под защитой тестов
5. **Phase 5** (перформанс) — оптимизируем в последнюю очередь

---

## Verification

```bash
npx tsc --noEmit              # 0 errors
npx biome check npm_lib/      # 0 errors
npx vitest run                # все тесты проходят, 0 regressions
npx vitest run --coverage     # coverage report
npm run dev                   # dev server работает, чат функционирует
```

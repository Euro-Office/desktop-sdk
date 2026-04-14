# npm_lib Code Review (Re-review)

> Повторное ревью после исправления 35 проблем из первоначального списка.
> ✅ = исправлено, ⚠️ = частично исправлено, ❌ = не исправлено

---

## Статус исправлений из первого ревью

| # | Проблема | Статус |
|---|----------|--------|
| 1 | Race condition `_pendingTitle` в ChatEngine | ✅ Теперь `_pendingTitlePromise` + `await` после стрима |
| 2 | Concurrent tool calls STDIO MCP (overwrite `onprocess`) | ✅ `_pendingRequests` Map с UUID |
| 3 | Race condition `fetchPrevMessages` при переключении тредов | ✅ Guard по `_currentThreadId` после await |
| 4 | Stale closures в `useMessages` | ✅ Рефы (`threadIdRef`, `extendedThinkingRef`, `handleEventRef`) |
| 5 | Operator precedence bug в servers.ts | ✅ Переписано на if-statements |
| 6 | Null dereference `disabledTools["web-search"]` | ✅ Optional chaining `?.length` |
| 7 | Unguarded `JSON.parse` (servers.ts, providers/index.ts, WebSearch.ts) | ✅ try/catch везде |
| 8 | `false as TErrorData` в profiles.ts | ✅ Корректная обработка трёх веток |
| 9 | `initCustomServer` бесконечный setInterval | ✅ maxRetries=30 + проверка stoppedCustomServers |
| 10 | `i18n.init()` не awaited | ✅ `await i18n.use(...).init(...)` |
| 11 | Race condition в `initAIChatI18n` | ✅ `initPromise` как mutex |
| 12 | Нет error handling на async init-путях | ✅ `.catch()` добавлен |
| 13 | Unbounded log accumulation в CustomServers | ✅ `_appendLog` с MAX_LOG_LINES=1000 |
| 14 | Side effects во время render в context providers | ⚠️ Намеренно оставлено с комментарием, идемпотентно |
| 15 | `useMemo` для side effect (Provider singleton) | ❌ Всё ещё `useMemo` с `setProviderInstance` |
| 16 | `startsWith` совпадение с неправильным тулом | ✅ Exact match |
| 17 | `JSON.stringify(error)` даёт `{}` | ✅ `e instanceof Error ? e.message : String(e)` |
| 18 | `mapFetchError` misleading fallback | ⚠️ Улучшен, но 500 ошибки всё ещё → "Invalid API key" |
| 19 | ManageToolDialog state desync | ✅ Раздельный `isManageToolOpen` + clear при закрытии |
| 20 | `getArgs` ломает аргументы с пробелами | ❌ Всё ещё `args.join(" ")` — ограничение platform API |
| 21 | Side effects внутри Zustand `set()` updater | ⚠️ Частично, `applyCurrentChatProvider` и `settings.set` остались в updater |
| 22 | `deleteFolder` orphaned prompts | ✅ Сброс `folderId` на null |
| 23 | `getServerType` includes → startsWith | ✅ |
| 24 | `onProcess` assumes id is string | ✅ `String(correctJson.id)` |
| 25 | Stale `values` в useModelForm handleChange | ✅ `valuesRef` pattern |
| 26 | `isFormValid` не учитывает errors | ✅ `Object.values(errors).every(v => !v)` |
| 27 | `setErrors({})` очищает все ошибки | ✅ Точечная очистка url/key |
| 28 | `isLoading` никогда не устанавливается | ✅ `setIsLoading(true)` в fetchModels |
| 29 | Fire-and-forget storage writes | ⚠️ Новые пути с await, но threads.ts createThread/touchThread/renameThread — нет |
| 30 | `allowAlways` parsing пустой строки | ✅ `.filter(Boolean)` |
| 31 | `setWebSearchData(null)` → пустая строка | ✅ `settings.remove()` |
| 32 | Inconsistent null/undefined в Storage API | ❌ `ProfilesStorage.getById` → undefined, остальные → null |
| 33 | `chatEvents` module-level singleton | ❌ Не исправлено |
| 35 | `fieldToErrorKey` пересоздаётся при рендере | ✅ Module-level constant |

---

## Новые проблемы

### High

#### N1. `restartStdioServer` crash если процесс не существует
**File:** `npm_lib/tools/sources/CustomServers.ts:337`
```ts
this.customServersProcesses[type].end(); // No null check
```
`deleteCustomServer` корректно проверяет `if (this.customServersProcesses[type])`, но `restartStdioServer` — нет. Crash при рестарте незапущенного сервера.

#### N2. `initedCustomServers` не сбрасывается при STDIO restart
**File:** `npm_lib/tools/sources/CustomServers.ts:336-358`
`restartStdioServer` не ставит `this.initedCustomServers[type] = false`. Сравни с `restartHttpServer` (строка 324) — там сброс есть. После рестарта `initCustomServer` видит `initedCustomServers[type] === true` и сразу запрашивает tools до того, как новый процесс инициализирован.

#### N3. Stale `manageToolData` closure в `approveToolCall`/`denyToolCall`
**File:** `npm_lib/hooks/useMessages.ts:153-177`
`extractToolData` замыкает `manageToolData` из render scope, но `approveToolCall`/`denyToolCall` обёрнуты в `useCallback` без `manageToolData` в deps. При вызове через кнопку `extractToolData()` читает устаревшие данные → может вернуть null → tool approval молча проваливается.
**Fix:** Добавить `manageToolData` в deps, или читать из store через `getState()`.

#### N4. Pending requests утекают при stop/delete сервера
**File:** `npm_lib/tools/sources/CustomServers.ts:361-387`
При `deleteCustomServer` / `restartStdioServer` записи в `_pendingRequests` для этого сервера не reject-ятся. Они зависают до 30с таймаута. Нужно reject-ить все pending по prefix `call-${type}-`.

#### N5. `msg.content[0]` без проверки длины массива
**Files:** `npm_lib/services/chat-engine.ts:84`, `npm_lib/hooks/useMessages.ts:191`
Если `msg.content` — пустой массив `[]`, доступ к `[0].type` → `TypeError`. Нужен guard `msg.content.length > 0`.

#### N6. `initAIChatI18n` не re-entrant для смены локали
**File:** `npm_lib/i18n.ts:54-59`
После первого вызова `initPromise` закеширован. Повторный вызов с другим `locale` молча вернёт старый promise — язык не сменится. `AIChatWidget` имеет `[locale, translations]` в deps useEffect, подразумевая поддержку смены, но она не работает.

### Medium

#### N7. Concurrent `processEvents` без координации
**File:** `npm_lib/hooks/useMessages.ts:104-151`
Нет мьютекса/guard-а. Если пользователь отправляет сообщение, а потом approve-ит tool call — два `processEvents` работают параллельно, interleaving `addMessage`/`updateLastMessage`. Может испортить массив сообщений.
**Fix:** `isProcessing` ref guard или очередь.

#### N8. `disabledTools[type]` может быть undefined при disable
**File:** `npm_lib/services/servers.ts:198`
```ts
const disabled = [...disabledTools[type], name];
```
Если `type` нет в `disabledTools` → spread от undefined → `TypeError`. Нужно `[...(disabledTools[type] ?? []), name]`.

#### N9. Enabling web-search не добавляет tools в массив
**File:** `npm_lib/services/servers.ts:165-181`
При включении web-search `newTools = currentState.tools` — без добавления web-search тулов. Они появятся только после следующего `buildToolsList()`. При отключении — корректно удаляются.

#### N10. `WebSearch.callTools` возвращает undefined для неизвестных тулов
**File:** `npm_lib/tools/sources/WebSearch.ts:142-150`
Если `name` не `"web_search"` и не `"web_crawling"` — implicit return undefined. Должен возвращать error string.

#### N11. `mapFetchError` всё ещё misleading для 500/429 ошибок
**File:** `npm_lib/providers/errors.ts:112-118`
При `hasApiKey === true` и статусе не 0/401/404, fallback → `invalidKey()`. Пользователь видит "Invalid API key" при server error.

#### N12. `getServerType` возвращает последнее совпадение, не самое длинное
**File:** `npm_lib/tools/sources/CustomServers.ts:202-212`
`forEach` не break-ается. Если серверы `"foo"` и `"foo_bar"`, и тул `"foo_bar_tool"` — оба матчат `startsWith`. Побеждает последний по порядку итерации (не самый длинный).
**Fix:** Искать самый длинный match.

#### N13. `insertThread` / `onRenameThread` — non-functional updater
**Files:** `npm_lib/store/create-threads-store.ts:49-57, 115-123`
`const { threads } = get()` → `set({ threads: [thread, ...threads] })`. При concurrent вызовах (например, быстрая отправка двух сообщений) второй вызов потеряет вставку первого. Использовать `set(state => ...)`.

#### N14. `storage.close()` без error handling
**File:** `npm_lib/storage/context.tsx:41`
`storage.close()` возвращает Promise, но reject не обрабатывается → unhandled rejection.

#### N15. StorageProvider / i18n — вечный blank screen при ошибке init
**Files:** `npm_lib/storage/context.tsx:33-38`, `npm_lib/AIChatWidget.tsx:62-68`
`storage.init()` при ошибке логирует, но `isReady` не ставится → виджет навсегда рендерит null. То же для i18n: `i18nReady` не ставится при reject.
**Fix:** Ставить `isReady(true)` даже при ошибке + показывать error boundary / fallback UI.

### Low

#### N16. `useMemo` для side effect (Provider)
**File:** `npm_lib/AIChatWidget.tsx:71-75`
React strict mode вызовет factory дважды → два Provider instance, второй перезатрёт первый в holder. Использовать `useRef` + lazy init.

#### N17. `updateLastMessage` на пустом массиве
**File:** `npm_lib/store/create-message-store.ts:55-58`
На пустом `messages` — `slice(0, -1)` → `[]`, message добавляется вместо замены. Семантически неверно, хоть и не crash.

#### N18. `onNew` использует render-scope `extendedThinking` и `messages`
**File:** `npm_lib/hooks/useMessages.ts:231-232`
`processEvents` использует refs, но `onNew` → `sendMessage(existingMessages: messages, extendedThinking)` берёт значения из render scope. Inconsistency: может отправить устаревший `messages` или `extendedThinking`.

#### N19. Double `getTools()` при mount
**File:** `npm_lib/hooks/useServers.ts:19-40`
Два `useEffect` оба вызывают `getTools()` при initial render. Два concurrent async вызова `buildToolsList()`.

#### N20. `createChatName` think-tag → пустая строка
**File:** `npm_lib/providers/index.ts:89-91`
`"thinking</think>".split("</think>")[1]` → `""`. Thread получит пустой title. Нужен fallback.

#### N21. `ProfilesStorage.getById` → undefined, остальные → null
**File:** `npm_lib/storage/types.ts:93`
Inconsistency в контракте.

#### N22. No error handling на init() в hooks
**Files:** `npm_lib/hooks/useProfiles.ts:15`, `npm_lib/hooks/useThreads.ts:17-18`, `npm_lib/hooks/useServers.ts:28-29`
Все `init()` без `.catch()` → unhandled rejection при сбое DB.

---

## Summary

| Severity | Count | Key areas |
|----------|-------|-----------|
| High | 6 | N1-N6: crash при restart, stale closure в tool approval, pending leak, content[0] access, i18n re-init |
| Medium | 9 | N7-N15: concurrent streams, spread undefined, web-search toggle, misleading errors, blank screen |
| Low | 7 | N16-N22: useMemo side effect, empty array edge case, stale values, double init |

Из 35 первоначальных проблем: **27 исправлены**, **4 частично**, **4 не исправлены** (архитектурные / design decisions).

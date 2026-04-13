# Future Features — не блокируют миграцию

Фичи из legacy плагина и недостающий функционал чата. Не критичны для миграции, можно реализовать позже.

---

### Voice Input

**Что было в legacy**: `chatVoice.js` — голосовой ввод через browser Speech Recognition API. Realtime транскрипция с промежуточными результатами. Обработка пунктуационных команд ("точка", "запятая", "новая строка") на 15+ языках (en, ru, es, fr, de, it, pt, pl, cs, uk, tr, nl, sv, da, no, fi, el, ja, zh, ko, ar, hi, he, vi).

**Где реализовать**: `npm_lib/` — универсальная фича, не зависит от editor.

---

### Custom Assistants

**Что было в legacy**: `customAssistant.js` — пользовательские "ассистенты" с кастомным system prompt. CRUD, localStorage persistence, кнопки в toolbar word editor. При клике — ассистент обрабатывает выделенный текст или весь документ, расставляет аннотации (SpellChecker-подобные подсказки).

**Где реализовать**: `src/` (плагин) — завязан на editor toolbar, paragraph API, аннотации. Не библиотечная фича.

---

### Multiple Response Variants (Branching)

**Что было в legacy**: На одно сообщение пользователя можно сгенерировать несколько вариантов ответа. Навигация "1/3", "2/3", "3/3" стрелками. `item.content` — массив вариантов, `activeContentIndex` — текущий.

**Где реализовать**: `npm_lib/` — потребует расширения message model (массив content variants вместо одного content). Затрагивает store, UI, persistence.

---

## Chat — недостающий функционал

### Message Editing

Нельзя отредактировать отправленное сообщение и переотправить. Пользователь должен иметь возможность кликнуть на своё сообщение → отредактировать текст → отправить заново → получить новый ответ (предыдущий ответ удаляется или заменяется).

**Где реализовать**: `npm_lib/` — store (edit + resend логика), UI (кнопка edit, inline editing).

---

### Message Regeneration

Нет кнопки "regenerate" — переотправить последнее сообщение пользователя и получить новый ответ от модели. В legacy была кнопка "Update" на assistant message. Связано с Multiple Response Variants — regeneration может добавлять новый вариант вместо замены.

**Где реализовать**: `npm_lib/` — store (resend last user message), UI (кнопка на assistant message).

---

### Single Message Deletion

В storage layer есть `delete(messageId)`, но метод не проброшен в message store и UI. Сейчас есть только "clear all" (очистка всего треда). Пользователь должен иметь возможность удалить конкретное сообщение (и все последующие, т.к. контекст ломается).

**Где реализовать**: `npm_lib/` — пробросить `delete` из storage в store, добавить UI кнопку.

---

### Max Iterations Limit (Tool Loop Safety)

Agent loop в `ChatEngine` не имеет safety limit. Legacy ограничивал 10 итерациями (`AgentState.MAX_LOOP_ITERATIONS = 10`). Без ограничения — потенциально бесконечный цикл tool calls, если модель зациклится.

**Где реализовать**: `npm_lib/services/chat-engine.ts` — добавить счётчик итераций и лимит.

---

### Full-Text Search по сообщениям

В storage layer есть `MessagesStorage.search()`, но метод не проброшен в UI. Поиск работает только по заголовкам тредов (в `ChatList`). Пользователь не может найти сообщение по содержимому.

**Где реализовать**: `npm_lib/` — пробросить search из storage через store, добавить UI для поиска по сообщениям.

---

### Token Counting / Context Estimation

Нет оценки размера контекста. Ни индикатора "сколько токенов использовано / сколько осталось", ни автоматического управления контекстным окном (обрезка старых сообщений при превышении лимита).

**Где реализовать**: `npm_lib/` — token estimator utility, индикатор в UI, опционально auto-truncation.

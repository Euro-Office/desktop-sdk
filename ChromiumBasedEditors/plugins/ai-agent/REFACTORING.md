# AI-Agent Refactoring Plan

> Branch: `refactoring/ai-agent`  
> Created: 2025-11-25

---

## Priority Legend

- **P0** - Critical (blocks other improvements)
- **P1** - High priority (significant impact)
- **P2** - Medium priority (code quality)
- **P3** - Low priority (nice to have)

---

## Phase 1: Tooling & Quick Fixes (Week 1)

### P0 - Migrate to Biome

- [ ] Install Biome: `npm install --save-dev --save-exact @biomejs/biome`
- [ ] Run `npx @biomejs/biome init`
- [ ] Configure `biome.json` with React rules
- [ ] Remove ESLint dependencies from `package.json`
- [ ] Delete `eslint.config.js`
- [ ] Update npm scripts:
  - [ ] Add `"lint": "biome lint ."`
  - [ ] Add `"format": "biome format --write ."`
  - [ ] Add `"check": "biome check --write ."`
  - [ ] Update `"build"` to include `biome check --error-on-warnings . && tsc --noEmit &&`
- [ ] Run `npm run format` to apply formatting
- [ ] Verify build passes with new checks

### P1 - Fix Memory Leak

- [ ] Fix `setInterval` in `src/hooks/useServers.ts` (add cleanup)

### P2 - Quick Fixes

- [ ] Fix typo: `setAddProvderVisible` → `setAddProviderVisible` in `src/pages/settings/sub-components/providers/index.tsx`
- [ ] Fix typo: `stopedCustomServers` → `stoppedCustomServers` in `src/servers/CustomServers.ts`
- [ ] Remove commented code in `src/hooks/useModels.ts` (lines 16-21)

---

## Phase 2: Provider Registry Pattern (Week 2)

### P0 - Replace Switch Statements with Registry

- [ ] Create `src/providers/registry.ts` with provider map
- [ ] Refactor `Provider.setCurrentProvider()` to use registry
- [ ] Refactor `Provider.getProviderInfo()` to use registry
- [ ] Refactor `Provider.checkNewProvider()` to use registry
- [ ] Refactor `Provider.getProvidersModels()` to use registry
- [ ] Remove redundant switch/if statements from `src/providers/index.ts`
- [ ] Add type-safe provider lookup

---

## Phase 3: Abstract Base Provider (Week 3)

### P0 - Reduce Provider Duplication

- [ ] Create `src/providers/AbstractBaseProvider.ts` class
- [ ] Move common methods to abstract class:
  - [ ] `setProvider()`
  - [ ] `setModelKey()`
  - [ ] `setSystemPrompt()`
  - [ ] `setApiKey()` / `setUrl()`
  - [ ] `setPrevMessages()`
  - [ ] `setTools()`
  - [ ] `stopMessage()`
- [ ] Create shared error response structure for `sendMessage()`
- [ ] Refactor `AnthropicProvider` to extend abstract class
- [ ] Refactor `OpenAIProvider` to extend abstract class
- [ ] Refactor `TogetherProvider` to extend abstract class
- [ ] Refactor `OllamaProvider` to extend abstract class
- [ ] Refactor `OpenRouterProvider` to extend abstract class

### P0 - Unified Error Handling

- [ ] Create `src/providers/errors.ts` with `ProviderError` class
- [ ] Implement error factory for consistent transformation
- [ ] Update all `checkProvider()` methods to use unified errors

---

## Phase 4: Store Refactoring (Week 4)

### P1 - Fix Store Initialization

- [ ] Refactor `useProviders.ts` - move IIFE initialization to `init()` action
- [ ] Refactor async validation out of synchronous initializer
- [ ] Add explicit `initProviders()` function
- [ ] Call initialization from `App.tsx` lifecycle

### P1 - Dependency Injection

- [ ] Create `ProviderContext` for provider instance
- [ ] Create `ServerContext` for server instance
- [ ] Remove direct imports of global singletons
- [ ] Update components to use context hooks

---

## Phase 5: Layout Refactoring (Week 5)

### P1 - Layout Architecture

- [ ] Extract theme logic from `Layout` into `src/hooks/useTheme.ts`
- [ ] Move `getSystemTheme()` to `src/lib/theme.ts`
- [ ] Replace inline `window.on_update_plugin_info` with event emitter pattern
- [ ] Create `src/components/layout/Layout.types.ts` for type definitions

### P1 - Layout CSS Improvements

- [ ] Extract header height to CSS variable `--header-height: 56px`
- [ ] Replace inline `style={{ height: calc(100vh - 56px) }}` with CSS class
- [ ] Create `src/styles/layout.css` for layout-specific styles
- [ ] Use CSS Grid instead of flexbox for main layout structure

### P2 - ChatList Component Cleanup

- [ ] Extract search logic into `useChatSearch` hook
- [ ] Remove duplicated "NoChatYet" rendering (lines 80-82 and 101-103)
- [ ] Extract `ChatListHeader` sub-component
- [ ] Extract `ChatListEmpty` sub-component

---

## Phase 6: Component Consolidation (Week 6)

### P1 - Create UI Primitives Folder

- [ ] Create `src/components/ui/` folder structure
- [ ] Move `button/`, `input/`, `checkbox/`, `loader/` to `ui/`
- [ ] Create barrel export `src/components/ui/index.ts`
- [ ] Update all import paths

### P1 - Icon Button Consolidation

- [ ] Merge `IconButton` and `TooltipIconButton` into single component
- [ ] Add optional `tooltip` prop to `IconButton`
- [ ] Extract `useSvgColorInjection` hook (repeated in IconButton, ComboBox)
- [ ] Remove `TooltipIconButton` folder

### P2 - Merge Dialog Components

- [ ] Create `src/pages/settings/sub-components/providers/ProviderFormDialog.tsx`
- [ ] Add `mode: 'add' | 'edit'` prop
- [ ] Extract shared form logic into `useProviderForm` hook
- [ ] Extract shared validation logic
- [ ] Extract shared keyboard handlers
- [ ] Remove `AddProviderDialog.tsx`
- [ ] Remove `EditProviderDialog.tsx`

### P2 - Settings Page Cleanup

- [ ] Extract wallet/providers section into `ConnectionSection` component
- [ ] Simplify nested ternaries with early returns
- [ ] Extract tab configuration to separate constant

### P2 - Extract Hardcoded Values

- [ ] Move model filters to `src/config/models.ts`
- [ ] Create configurable model whitelist
- [ ] Move magic numbers to constants file

---

## Phase 7: Quality & Documentation (Ongoing)

### P3 - Add Tests

- [ ] Set up testing framework (Vitest)
- [ ] Add tests for provider registry
- [ ] Add tests for abstract base provider
- [ ] Add tests for store actions
- [ ] Add tests for utility functions

### P3 - Documentation

- [ ] Add JSDoc to public APIs
- [ ] Document provider interface
- [ ] Document store architecture
- [ ] Create architecture diagram

---

## Progress Summary

| Phase     | Description             | Status         | Completed | Total  |
| --------- | ----------------------- | -------------- | --------- | ------ |
| Phase 1   | Tooling & Quick Fixes   | 🔴 Not Started | 0         | 14     |
| Phase 2   | Provider Registry       | 🔴 Not Started | 0         | 7      |
| Phase 3   | Abstract Base Provider  | 🔴 Not Started | 0         | 14     |
| Phase 4   | Store Refactoring       | 🔴 Not Started | 0         | 7      |
| Phase 5   | Layout Refactoring      | 🔴 Not Started | 0         | 12     |
| Phase 6   | Component Consolidation | 🔴 Not Started | 0         | 18     |
| Phase 7   | Quality & Documentation | 🔴 Not Started | 0         | 9      |
| **Total** |                         |                | **0**     | **81** |

---

## Notes

_Add notes, blockers, or decisions here as you progress._

- ***

## Changelog

| Date       | Phase   | Changes                                     |
| ---------- | ------- | ------------------------------------------- |
| 2025-11-25 | -       | Initial plan created                        |
| 2025-11-25 | 5, 6, 7 | Added Layout & Component refactoring phases |

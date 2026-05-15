import "../shared/index.css";
import {
  AIChatWidget,
  type AIChatWidgetRef,
  type AssistantAction,
  type ImageOverrides,
  type SystemPromptOverride,
} from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createLegacyToolsAdapter } from "@/legacy/legacyEditorToolsAdapter";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import {
  applyCustomProvidersDelta,
  bootstrapCustomProviders,
} from "./custom-providers/bootstrap";
import { install as installLibrary } from "./library/index";
import { OnlyOfficePlatform } from "./platform/index";

interface EditorHelperImplCtor {
  new (): {
    getToolsSystemPrompt(): string;
  };
}

interface LegacyAI {
  ready: Promise<void>;
  loadHelperTranslations(): Promise<void>;
}

function getLegacyAI(): LegacyAI | null {
  return (window as unknown as { AI?: LegacyAI }).AI ?? null;
}

function ensureEditorHelper(): { getToolsSystemPrompt(): string } | null {
  const w = window as unknown as {
    EditorHelper?: { getToolsSystemPrompt(): string };
    EditorHelperImpl?: EditorHelperImplCtor;
  };
  if (!w.EditorHelper && w.EditorHelperImpl) {
    w.EditorHelper = new w.EditorHelperImpl();
  }
  return w.EditorHelper ?? null;
}

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const sharedStorage = new IndexedDBStorage();

const SCALE_SUFFIX: Record<number, string> = {
  1: "",
  1.25: "@1.25x",
  1.5: "@1.5x",
  1.75: "@1.75x",
  2: "@2x",
};

const iconUrl =
  (baseName: string) =>
  (theme: "light" | "dark", scale: number): string => {
    const suffix = SCALE_SUFFIX[scale] ?? "";
    return `resources/icons/${theme}/${baseName}${suffix}.png`;
  };

const QUICK_ACTION_ICONS: ImageOverrides = {
  "qa-replace": iconUrl("btn-replace"),
  "qa-insert": iconUrl("btn-select-tool"),
  "qa-comment": iconUrl("btn-menu-comments"),
  "qa-review": iconUrl("btn-ic-review"),
};

type ChatReplaceType = "replace" | "insert" | "comment" | "review";

const sendChatReplace = (type: ChatReplaceType, markdown: string): void => {
  window.Asc.plugin.sendToPlugin("onChatReplace", {
    type,
    data: markdown ?? "",
  });
};

const assistantActions: AssistantAction[] = [
  {
    id: "qa-replace",
    tooltip: "Replace original text",
    icon: "qa-replace",
    onClick: ({ markdown }) => sendChatReplace("replace", markdown),
  },
  {
    id: "qa-insert",
    tooltip: "Insert result",
    icon: "qa-insert",
    onClick: ({ markdown }) => sendChatReplace("insert", markdown),
  },
  {
    id: "qa-comment",
    tooltip: "In comment",
    icon: "qa-comment",
    onClick: ({ markdown }) => sendChatReplace("comment", markdown),
  },
  {
    id: "qa-review",
    tooltip: "As review",
    icon: "qa-review",
    onClick: ({ markdown }) => sendChatReplace("review", markdown),
  },
];

const Chat = () => {
  const storage = useMemo(() => sharedStorage, []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const toolsAdapter = useMemo(() => createLegacyToolsAdapter(), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);
  const [systemPrompt, setSystemPrompt] = useState<
    SystemPromptOverride | undefined
  >(undefined);

  useEffect(() => {
    const ai = getLegacyAI();
    if (!ai) return;
    let cancelled = false;
    (async () => {
      await ai.ready;
      await ai.loadHelperTranslations();
      if (cancelled) return;
      const helper = ensureEditorHelper();
      if (!helper) return;
      const text = helper.getToolsSystemPrompt();
      if (text) setSystemPrompt({ mode: "append", text });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Poll until the predicate returns a value. The widget ref, current
    // profile, and post-setChatProfile re-render all settle asynchronously
    // after first open; sendMessage silently drops if currentProfile is
    // null, so we have to wait for real readiness, not just the ref.
    const waitFor = <T,>(
      predicate: () => T | null | undefined,
      maxAttempts = 100,
      intervalMs = 50
    ): Promise<T | null> =>
      new Promise((resolve) => {
        let attempts = 0;
        const tick = () => {
          const value = predicate();
          if (value) {
            resolve(value);
            return;
          }
          if (++attempts >= maxAttempts) {
            resolve(null);
            return;
          }
          setTimeout(tick, intervalMs);
        };
        tick();
      });

    window.Asc.plugin.attachEvent("sendToChat", async (raw) => {
      console.log("[Docs chat] ← sendToChat", raw);
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as { prompt: string; action: "send" | "attach" })
          : (raw as { prompt: string; action: "send" | "attach" });
      if (!payload?.prompt) return;

      const widget = await waitFor(() => widgetRef.current);
      if (!widget) {
        console.warn("[Docs chat] sendToChat: widget never became ready");
        return;
      }
      widget.openChat();

      // Wait until currentProfile is populated. Without this, sendMessage drops
      // the message because useMessages.onNew bails on `!currentProfile`.
      const ready = await waitFor(() => {
        const current = widget.getCurrentProfile?.();
        return current ?? null;
      });
      if (!ready) {
        console.warn("[Docs chat] sendToChat: profile never became ready");
        return;
      }

      if (payload.action === "send") {
        widget.sendMessage(payload.prompt);
      } else {
        // TODO: implement "attach" logic (just adding to input without sending)
      }
    });

    window.Asc.plugin.attachEvent("onAiStateChanged", (raw) => {
      const payload =
        typeof raw === "string"
          ? (JSON.parse(raw) as SyncPayload)
          : (raw as SyncPayload);

      const widget = widgetRef.current;
      if (!widget) return;

      console.log(`[Docs chat] ← ${payload.event}`, payload.data);

      switch (payload.event) {
        case "threadsUpdated":
          widget.updateThreads();
          return;
        case "modelAssignmentUpdated":
          widget.updateCurrentChat();
          widget.updateModelAssignment();
          return;
        case "profilesUpdated":
        case "currentChatProfileUpdated":
          widget.updateCurrentChat();
          return;
        case "extendedThinkingUpdated":
          widget.updateExtendedThinking();
          return;
        case "serversUpdated":
          widget.updateMCPServer();
          return;
        case "webSearchUpdated":
          widget.updateWebSearch();
          widget.updateMCPServer();
          return;
        case "customProvidersUpdated":
          applyCustomProvidersDelta(payload.data.providers);
          widget.updateCurrentChat();
          return;
      }
    });

    window.Asc.plugin.sendToPlugin("chat-ready", {});

    return () => {
      window.Asc.plugin.detachEvent("onAiStateChanged");
      window.Asc.plugin.detachEvent("sendToChat");
    };
  }, []);

  return (
    <AIChatWidget
      ref={widgetRef}
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={DEFAULT_STORE_KEYS}
      toolsAdapter={toolsAdapter}
      systemPrompt={systemPrompt}
      images={QUICK_ACTION_ICONS}
      assistantActions={assistantActions}
      onMigrate={() => migrateProvidersToProfiles(storage)}
      onSettingsClick={() => {
        window.Asc.plugin.sendToPlugin("ai-open-settings", {});
      }}
      callbacks={{
        onThreadsUpdated: (data) => {
          if (data.kind === "switched") return;
          console.log("[Docs chat] → threadsUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "threadsUpdated",
            data,
          });
        },
        onExtendedThinkingUpdated: (data) => {
          console.log("[Docs chat] → extendedThinkingUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "extendedThinkingUpdated",
            data,
          });
        },
        onServersUpdated: (data) => {
          console.log("[Docs chat] → serversUpdated", data);
          window.Asc.plugin.sendToPlugin("onAiStateChanged", {
            event: "serversUpdated",
            data,
          });
        },
      }}
    />
  );
};

window.Asc.plugin.init = async () => {
  await sharedStorage.init();
  installLibrary(sharedStorage);
  bootstrapCustomProviders();

  const container = document.getElementById("chat_panel");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Chat />
      </StrictMode>
    );
  }
};

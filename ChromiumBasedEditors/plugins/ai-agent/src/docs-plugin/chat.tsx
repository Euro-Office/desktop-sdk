import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import type { CrossPluginEvents } from "@/shared/sync/crossPluginBus";
import { editor } from "./library/editor";
import { install as installLibrary } from "./library/index";
import { OnlyOfficePlatform } from "./platform/index";
import { createToolsAdapter } from "./tools";

type SyncPayload = {
  [K in keyof CrossPluginEvents]: { event: K; data: CrossPluginEvents[K] };
}[keyof CrossPluginEvents];

const sharedStorage = new IndexedDBStorage();

const Chat = () => {
  const storage = useMemo(() => sharedStorage, []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const toolsAdapter = useMemo(() => createToolsAdapter(editor.getType()), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);

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

  const container = document.getElementById("chat_panel");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Chat />
      </StrictMode>
    );
  }
};

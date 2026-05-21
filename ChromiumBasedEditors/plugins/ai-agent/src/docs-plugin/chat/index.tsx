import "../../shared/index.css";
import {
  AIChatWidget,
  type AIChatWidgetRef,
  type SystemPromptOverride,
} from "@onlyoffice/ai-chat";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { bootstrapCustomProviders } from "@/shared/custom-providers/bootstrap";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import {
  createRpcToolsAdapter,
  fetchToolsSystemPrompt,
} from "../engine-adapter/rpc-tools-adapter";
import { OnlyOfficePlatform } from "../platform/index";

const sharedStorage = new IndexedDBStorage();

const Chat = () => {
  const storage = useMemo(() => sharedStorage, []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);
  const toolsAdapter = useMemo(() => createRpcToolsAdapter(), []);
  const widgetRef = useRef<AIChatWidgetRef>(null);
  const [systemPrompt, setSystemPrompt] = useState<
    SystemPromptOverride | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchToolsSystemPrompt().then((text) => {
      if (!cancelled && text) setSystemPrompt({ mode: "append", text });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
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

    const onAttachedText = async (raw: unknown) => {
      let parsed: unknown = raw;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }
      const forceSend =
        typeof parsed === "object" && parsed !== null && "forceSend" in parsed
          ? Boolean((parsed as { forceSend?: boolean }).forceSend)
          : false;
      const text =
        typeof parsed === "string"
          ? parsed
          : ((parsed as { text?: string } | null)?.text ?? "");
      if (!text || !text.trim()) return;

      const widget = widgetRef.current;
      if (!widget) return;
      const ready = await waitFor(() => widget.getCurrentProfile?.() ?? null);
      if (!ready) {
        console.warn("[Docs chat] onAttachedText: profile never became ready");
        return;
      }
      if (forceSend) {
        widget.sendMessage(text.trim());
      } else {
        widget.setComposerText(text);
      }
    };

    window.Asc.plugin.attachEvent("onAttachedText", onAttachedText);
    window.Asc.plugin.attachEvent("onAiSettingsChanged", (raw) => {
      console.log("[Docs chat] ← onAiSettingsChanged", raw);
      const widget = widgetRef.current;
      if (!widget) return;
      widget.updateProfiles();
      widget.updateCurrentChat();
      widget.updateModelAssignment();
      widget.updateMCPServer();
      widget.updateWebSearch();
      widget.updateExtendedThinking();
    });

    window.Asc.plugin.sendToPlugin("onWindowReady", {});

    return () => {
      window.Asc.plugin.detachEvent("onAttachedText");
      window.Asc.plugin.detachEvent("onAiSettingsChanged");
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
      onMigrate={() => migrateProvidersToProfiles(storage)}
      onSettingsClick={() => {
        window.Asc.plugin.sendToPlugin("ai-open-settings", {});
      }}
    />
  );
};

window.Asc.plugin.init = async () => {
  await sharedStorage.init();
  await bootstrapCustomProviders(sharedStorage);

  const container = document.getElementById("chat_panel");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <Chat />
      </StrictMode>
    );
  }
};

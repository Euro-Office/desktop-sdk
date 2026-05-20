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
import {
  createRpcToolsAdapter,
  fetchToolsSystemPrompt,
} from "@/legacy/rpcToolsAdapter";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { migrateProvidersToProfiles } from "@/shared/lib/migrateProvidersToProfiles";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { bootstrapCustomProviders } from "./custom-providers/bootstrap";
import { OnlyOfficePlatform } from "./platform/index";

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

    window.Asc.plugin.attachEvent("onAttachedText", async (raw) => {
      console.log("[Docs chat] ← onAttachedText", raw);
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

      const widget = await waitFor(() => widgetRef.current);
      if (!widget) {
        console.warn("[Docs chat] onAttachedText: widget never became ready");
        return;
      }

      const ready = await waitFor(() => {
        const current = widget.getCurrentProfile?.();
        return current ?? null;
      });
      if (!ready) {
        console.warn("[Docs chat] onAttachedText: profile never became ready");
        return;
      }

      if (forceSend) {
        widget.sendMessage(text.trim());
      } else {
        widget.setComposerText(text);
      }
    });

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

    window.Asc.plugin.sendToPlugin("chat-ready", {});

    return () => {
      window.Asc.plugin.detachEvent("onAiSettingsChanged");
      window.Asc.plugin.detachEvent("onAttachedText");
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
    />
  );
};

window.Asc.plugin.init = async () => {
  await sharedStorage.init();
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

import { isDesktopEditor } from "@/shared/lib/utils";
import {
  type CrossPluginEvents,
  crossPluginBus,
} from "@/shared/sync/crossPluginBus";

const AI_STATE_EVENT = "onAiStateChanged";

type SyncEventName = keyof CrossPluginEvents;

type SyncPayload = {
  [K in SyncEventName]: { event: K; data: CrossPluginEvents[K] };
}[SyncEventName];

const SYNC_EVENT_NAMES: readonly SyncEventName[] = [
  "modelAssignmentUpdated",
  "currentChatProfileUpdated",
  "profilesUpdated",
  "serversUpdated",
  "webSearchUpdated",
  "threadsUpdated",
  "extendedThinkingUpdated",
];

function parsePayload(raw: unknown): SyncPayload | null {
  const payload =
    typeof raw === "string"
      ? (JSON.parse(raw) as SyncPayload)
      : (raw as SyncPayload);

  if (!payload || typeof payload !== "object" || !("event" in payload)) {
    return null;
  }

  if (!SYNC_EVENT_NAMES.includes(payload.event)) {
    return null;
  }

  return payload;
}

function notifyDesktopPlugin(payload: SyncPayload): void {
  console.log(`[Docs bg] → bus: ${payload.event}`, payload.data);
  switch (payload.event) {
    case "modelAssignmentUpdated":
      crossPluginBus.publish("modelAssignmentUpdated", payload.data);
      return;
    case "currentChatProfileUpdated":
      crossPluginBus.publish("currentChatProfileUpdated", payload.data);
      return;
    case "profilesUpdated":
      crossPluginBus.publish("profilesUpdated", payload.data);
      return;
    case "serversUpdated":
      crossPluginBus.publish("serversUpdated", payload.data);
      return;
    case "webSearchUpdated":
      crossPluginBus.publish("webSearchUpdated", payload.data);
      return;
    case "threadsUpdated":
      crossPluginBus.publish("threadsUpdated", payload.data);
      return;
    case "extendedThinkingUpdated":
      crossPluginBus.publish("extendedThinkingUpdated", payload.data);
      return;
  }
}

type WindowId = "chat" | "settings";

const windows = new Map<WindowId, AscPluginWindow | null>([
  ["chat", null],
  ["settings", null],
]);

function notifyPluginWindows(serialized: string, except?: WindowId): void {
  for (const [id, win] of windows) {
    if (id !== except) win?.command(AI_STATE_EVENT, serialized);
  }
}

function listenForDesktopPluginUpdates(): void {
  for (const event of SYNC_EVENT_NAMES) {
    crossPluginBus.subscribe(event, (data) => {
      console.log(`[Docs bg] ← bus: ${event}`, data);
      notifyPluginWindows(JSON.stringify({ event, data }));
    });
  }
}

function registerWindow(id: WindowId, win: AscPluginWindow): void {
  windows.set(id, win);
  win.attachEvent(AI_STATE_EVENT, (raw) => {
    const payload = parsePayload(raw);
    if (!payload) return;
    console.log(`[Docs bg] ← from ${id}: ${payload.event}`, payload.data);
    if (isDesktopEditor()) notifyDesktopPlugin(payload);
    notifyPluginWindows(JSON.stringify(payload), id);
  });
}

function openSettings() {
  const existing = windows.get("settings");
  if (existing) {
    existing.activate();
    return;
  }

  const settingsWindow = new window.Asc.PluginWindow();
  registerWindow("settings", settingsWindow);
  settingsWindow.show({
    url: "settings.html",
    description: "AI Settings",
    type: "window",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    icons:
      "resources/%theme-type%(light|dark)/big/settings%scale%(default).png",
    size: [470, 600],
  });
}

function openChat() {
  const existing = windows.get("chat");
  if (existing) {
    existing.activate();
    return;
  }

  const chatWindow = new window.Asc.PluginWindow();
  chatWindow.attachEvent("ai-open-settings", openSettings);
  registerWindow("chat", chatWindow);
  chatWindow.show({
    url: "chat.html",
    description: "AI Chat",
    type: "panelRight",
    EditorsSupport: ["word", "slide", "cell", "pdf"],
    isVisual: true,
    icons: "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
  });
}

window.Asc.plugin.init = () => {
  if (isDesktopEditor()) listenForDesktopPluginUpdates();

  const editorType = window.Asc.plugin.info?.editorType;
  const isPdf = editorType === "pdf";

  const aiActionsItems: Array<Record<string, unknown>> = [
    {
      id: "ai-settings",
      type: "big-button",
      text: "AI Settings",
      icons:
        "resources/%theme-type%(light|dark)/big/settings%scale%(default).png",
    },
  ];

  if (!isPdf) {
    aiActionsItems.push({
      id: "ai-summarization",
      type: "big-button",
      text: "Summarization",
      icons:
        "resources/%theme-type%(light|dark)/big/summarization%scale%(default).png",
      separator: true,
    });
  }

  // Register AI Chat button in the Home tab and AI Actions tab buttons
  window.Asc.plugin.executeMethod("AddToolbarMenuItem", [
    {
      guid: "asc.{8D67F3C0-7654-4BBC-98A2-71342BD73A4E}",
      tabs: [
        {
          id: "home",
          items: [
            {
              id: "ai-open-chat",
              type: "big-button",
              text: "AI Chat",
              icons:
                "resources/%theme-type%(light|dark)/general-ai%scale%(default).png",
              separator: true,
            },
          ],
        },
        {
          id: "ai-actions",
          text: "AI Actions",
          items: aiActionsItems,
        },
      ],
    },
  ]);

  window.Asc.plugin.event_onToolbarMenuClick = (id) => {
    if (id === "ai-open-chat") {
      openChat();
    } else if (id === "ai-settings") {
      openSettings();
    } else if (id === "ai-summarization") {
      console.log("[Docs bg] Summarization button clicked");
    }
  };

  window.Asc.Buttons.registerToolbarMenu();

  window.Asc.plugin.button = (_buttonId, windowId) => {
    if (_buttonId === -1) {
      window.Asc.plugin.executeMethod("CloseWindow", [windowId]);

      for (const [id, win] of windows) {
        if (win && win.id === windowId) {
          windows.set(id, null);
          break;
        }
      }
    }
  };
};

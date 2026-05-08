import { isDesktopEditor } from "@/shared/lib/utils";
import {
  type CrossPluginEvents,
  crossPluginBus,
} from "@/shared/sync/crossPluginBus";

export type PluginWindowId =
  | "chat"
  | "settings"
  | "translation"
  | "summarization"
  | "custom-action"
  | "custom-action-delete"
  | "custom-assistant"
  | "custom-assistant-delete"
  | "custom-assistant-warning"
  | "custom-providers";

export const pluginWindows = new Map<PluginWindowId, AscPluginWindow | null>([
  ["chat", null],
  ["settings", null],
  ["translation", null],
  ["summarization", null],
  ["custom-action", null],
  ["custom-action-delete", null],
  ["custom-assistant", null],
  ["custom-assistant-delete", null],
  ["custom-assistant-warning", null],
  ["custom-providers", null],
]);

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
  "customProvidersUpdated",
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
    case "customProvidersUpdated":
      crossPluginBus.publish("customProvidersUpdated", payload.data);
      return;
  }
}

function notifyPluginWindows(
  serialized: string,
  except?: PluginWindowId
): void {
  for (const [id, win] of pluginWindows) {
    if (id !== except) win?.command(AI_STATE_EVENT, serialized);
  }
}

export function listenForDesktopPluginUpdates(): void {
  for (const event of SYNC_EVENT_NAMES) {
    crossPluginBus.subscribe(event, (data) => {
      console.log(`[Docs bg] ← bus: ${event}`, data);
      notifyPluginWindows(JSON.stringify({ event, data }));
    });
  }
}

export function registerWindow(id: PluginWindowId, win: AscPluginWindow): void {
  pluginWindows.set(id, win);
  win.attachEvent(AI_STATE_EVENT, (raw) => {
    const payload = parsePayload(raw);
    if (!payload) return;
    console.log(`[Docs bg] ← from ${id}: ${payload.event}`, payload.data);
    if (isDesktopEditor()) notifyDesktopPlugin(payload);
    notifyPluginWindows(JSON.stringify(payload), id);
  });
}

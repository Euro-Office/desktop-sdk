import type {
  CurrentChatProfileUpdatedEvent,
  ModelAssignmentUpdatedEvent,
  ProfilesUpdatedEvent,
  ServersUpdatedEvent,
  ThreadsUpdatedEvent,
  WebSearchUpdatedEvent,
} from "@onlyoffice/ai-chat";

export interface CrossPluginEvents {
  modelAssignmentUpdated: ModelAssignmentUpdatedEvent;
  currentChatProfileUpdated: CurrentChatProfileUpdatedEvent;
  profilesUpdated: ProfilesUpdatedEvent;
  serversUpdated: ServersUpdatedEvent;
  webSearchUpdated: WebSearchUpdatedEvent;
  threadsUpdated: ThreadsUpdatedEvent;
}

type EventName = keyof CrossPluginEvents;
type Handler<K extends EventName> = (data: CrossPluginEvents[K]) => void;

interface Envelope {
  event: EventName;
  data: CrossPluginEvents[EventName];
  senderId: string;
  ts: number;
}

const CHANNEL_NAME = "onlyoffice-ai-agent-bus";

const senderId = crypto.randomUUID();
const handlers = new Map<EventName, Set<Handler<EventName>>>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (channel) return channel;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e: MessageEvent<Envelope>) => {
    const msg = e.data;
    if (!msg || msg.senderId === senderId) return;

    const subscribers = handlers.get(msg.event);
    if (!subscribers) return;

    for (const handler of subscribers) {
      handler(msg.data);
    }
  };

  return channel;
}

export const crossPluginBus = {
  publish<K extends EventName>(event: K, data: CrossPluginEvents[K]): void {
    const envelope: Envelope = {
      event,
      data,
      senderId,
      ts: Date.now(),
    };
    getChannel().postMessage(envelope);
  },

  subscribe<K extends EventName>(event: K, handler: Handler<K>): () => void {
    getChannel();

    let subscribers = handlers.get(event);
    if (!subscribers) {
      subscribers = new Set();
      handlers.set(event, subscribers);
    }
    subscribers.add(handler as Handler<EventName>);

    return () => {
      subscribers?.delete(handler as Handler<EventName>);
    };
  },
};

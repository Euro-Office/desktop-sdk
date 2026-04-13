type EventHandler = () => void;

class ChatEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }
  }
}

export const chatEvents = new ChatEventBus();

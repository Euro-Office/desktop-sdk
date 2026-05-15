// Port of fetchExternal from <old>/scripts/engine/engine.js:33-127.
// Routes fetch through the editor via `ai_onExternalFetch` event — used so
// AI provider traffic can be tunneled through Desktop Editor's network
// (system proxy, CORS-free, corp firewall). Not wired into anything yet —
// kept here so the code is preserved when the old engine is removed.

type ExternalFetchEvent =
  | { id: number; type: "error"; error: string }
  | {
      id: number;
      type: "response";
      status: number;
      headers: Record<string, string>;
      body?: string;
    }
  | { id: number; type: "chunk"; chunk: string }
  | { id: number; type: "end" };

type PendingRequest = {
  id: number;
  streaming: boolean;
  resolve: (value: Response | Error) => void;
  reject: (reason: unknown) => void;
  controller: ReadableStreamDefaultController<Uint8Array> | null;
  aborted?: boolean;
};

type Records = {
  counter: number;
  requests: Record<number, PendingRequest>;
};

declare global {
  interface Window {
    externalFetchRecords?: Records;
  }
}

function ensureRecords(): Records {
  if (!window.externalFetchRecords) {
    const records: Records = { counter: 0, requests: {} };
    window.externalFetchRecords = records;

    const plugin = (window as unknown as { Asc: { plugin: unknown } }).Asc
      .plugin as {
      attachEditorEvent: (
        id: string,
        handler: (e: ExternalFetchEvent) => void
      ) => void;
    };

    plugin.attachEditorEvent("ai_onExternalFetch", (e) => {
      const request = records.requests[e.id];
      if (!request) return;

      if (e.type === "error") {
        if (request.controller) request.controller.close();
        request.resolve(new Error(e.error));
        delete records.requests[e.id];
        return;
      }

      if (e.type === "response") {
        if (request.streaming) {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              request.controller = controller;
            },
          });
          request.resolve(
            new Response(stream, { status: e.status, headers: e.headers })
          );
        } else {
          request.resolve(
            new Response(e.body, { status: e.status, headers: e.headers })
          );
          delete records.requests[e.id];
        }
        return;
      }

      if (e.type === "chunk" && request.streaming && request.controller) {
        request.controller.enqueue(new TextEncoder().encode(e.chunk));
      }

      if (e.type === "end" && request.streaming && request.controller) {
        request.controller.close();
        delete records.requests[e.id];
      }
    });
  }
  return window.externalFetchRecords;
}

export function fetchExternal(
  url: string,
  options?: RequestInit & { signal?: AbortSignal },
  isStreaming = false
): Promise<Response> {
  const records = ensureRecords();

  return new Promise((resolve, reject) => {
    const request: PendingRequest = {
      id: ++records.counter,
      streaming: isStreaming,
      resolve: resolve as PendingRequest["resolve"],
      reject,
      controller: null,
    };
    records.requests[request.id] = request;

    const plugin = (window as unknown as { Asc: { plugin: unknown } }).Asc
      .plugin as { sendEvent: (id: string, payload: unknown) => void };

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        if (!request.aborted) {
          request.aborted = true;
          plugin.sendEvent("ai_onExternalFetch", {
            id: request.id,
            type: "abort",
          });
          if (request.controller) request.controller.close();
          request.resolve(new Error("Request aborted"));
          delete records.requests[request.id];
        }
      });
    }

    plugin.sendEvent("ai_onExternalFetch", {
      id: request.id,
      url,
      options,
      streaming: isStreaming,
      type: "request",
    });
  });
}

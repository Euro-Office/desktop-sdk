// ToolsAdapter that knows nothing about the editor — only talks to
// index.html via plugin RPC (sendToPlugin / attachEvent).
//
// Bridge handlers live in <old>/scripts/register.js (inside chatWindowShow)
// and <old>/scripts/code.js (invalidate push on ai_onCustomToolRegister/
// Unregister). Mirrors the stable architecture where the old chat.html had
// no EditorHelper / AI.Request / library.js at all — chat was a dumb UI
// shell, all editor logic lived in index.html.

import type { TMCPItem, ToolsAdapter } from "@onlyoffice/ai-chat";

type RpcTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  humanName?: string;
};

type Registry = Record<string, TMCPItem[]>;

const pendingCalls = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

let registryCache: Registry | null = null;
let registryPending: Promise<Registry> | null = null;
let registryResolve: ((r: Registry) => void) | null = null;

let promptPending: Promise<string> | null = null;
let promptResolve: ((s: string) => void) | null = null;

let wired = false;

type PluginApi = {
  attachEvent(name: string, handler: (raw: unknown) => void): void;
  sendToPlugin(name: string, payload: unknown): void;
};

function plugin(): PluginApi | null {
  return (
    (window as unknown as { Asc?: { plugin?: PluginApi } }).Asc?.plugin ?? null
  );
}

function parse<T>(raw: unknown): T {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

function ensureWired(): void {
  if (wired) return;
  const p = plugin();
  if (!p?.attachEvent) return;
  wired = true;

  p.attachEvent("ai-tools-registry", (raw) => {
    const data = parse<{ editor: RpcTool[] }>(raw);
    const reg: Registry = {
      editor: (data.editor || []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
    registryCache = reg;
    registryResolve?.(reg);
    registryResolve = null;
    registryPending = null;
  });

  p.attachEvent("ai-tools-registry-invalidate", () => {
    registryCache = null;
  });

  p.attachEvent("ai-tool-result", (raw) => {
    const d = parse<{ callId: string; result?: unknown; error?: string }>(raw);
    const c = pendingCalls.get(d.callId);
    if (!c) return;
    pendingCalls.delete(d.callId);
    if (d.error) c.reject(new Error(d.error));
    else c.resolve(d.result);
  });

  p.attachEvent("ai-system-prompt", (raw) => {
    const d = parse<{ text: string }>(raw);
    promptResolve?.(d.text || "");
    promptResolve = null;
    promptPending = null;
  });
}

function newCallId(): string {
  const c = (
    globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  return c?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36)}`;
}

export function createRpcToolsAdapter(): ToolsAdapter {
  ensureWired();
  return {
    async getTools() {
      if (registryCache) return registryCache;
      if (registryPending) return registryPending;
      const p = plugin();
      if (!p) return {};
      registryPending = new Promise<Registry>((res) => {
        registryResolve = res;
      });
      p.sendToPlugin("ai-tools-fetch", {});
      return registryPending;
    },
    async callTool(name, args) {
      const p = plugin();
      if (!p) throw new Error("Plugin host not available");
      const callId = newCallId();
      return new Promise<unknown>((resolve, reject) => {
        pendingCalls.set(callId, { resolve, reject });
        p.sendToPlugin("ai-tool-call", { callId, name, args });
      });
    },
  };
}

export async function fetchToolsSystemPrompt(): Promise<string> {
  ensureWired();
  if (promptPending) return promptPending;
  const p = plugin();
  if (!p) return "";
  promptPending = new Promise<string>((res) => {
    promptResolve = res;
  });
  p.sendToPlugin("ai-system-prompt-fetch", {});
  return promptPending;
}

import type { CustomAssistant } from "./types";

const STORAGE_KEY = "onlyoffice_ai_saved_assistants";

export function loadAssistants(): CustomAssistant[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CustomAssistant[];
  } catch {
    return [];
  }
}

export function saveAssistants(list: CustomAssistant[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function findAssistant(id: string): CustomAssistant | undefined {
  return loadAssistants().find((a) => a.id === id);
}

export function upsertAssistant(assistant: CustomAssistant): void {
  const list = loadAssistants();
  const idx = list.findIndex((a) => a.id === assistant.id);
  if (idx === -1) list.push(assistant);
  else list[idx] = assistant;
  saveAssistants(list);
}

export function deleteAssistant(id: string): void {
  saveAssistants(loadAssistants().filter((a) => a.id !== id));
}

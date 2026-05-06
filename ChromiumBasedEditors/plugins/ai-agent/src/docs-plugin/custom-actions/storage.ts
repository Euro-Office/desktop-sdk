import type { CustomAiAction } from "./types";

const STORAGE_KEY = "onlyoffice_ai_saved_actions";

export function loadActions(): CustomAiAction[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CustomAiAction[];
  } catch {
    return [];
  }
}

export function saveActions(actions: CustomAiAction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

export function findAction(id: string): CustomAiAction | undefined {
  return loadActions().find((a) => a.id === id);
}

export function upsertAction(action: CustomAiAction): void {
  const list = loadActions();
  const idx = list.findIndex((a) => a.id === action.id);
  if (idx === -1) list.push(action);
  else list[idx] = action;
  saveActions(list);
}

export function deleteAction(id: string): void {
  saveActions(loadActions().filter((a) => a.id !== id));
}

import type { CustomProviderRecord } from "./types";

const STORAGE_KEY = "onlyoffice_ai_saved_providers";

export function loadProviders(): CustomProviderRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CustomProviderRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProviders(list: CustomProviderRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function findProvider(name: string): CustomProviderRecord | undefined {
  return loadProviders().find((p) => p.name === name);
}

export function upsertProvider(record: CustomProviderRecord): void {
  const list = loadProviders();
  const idx = list.findIndex((p) => p.name === record.name);
  if (idx === -1) list.push(record);
  else list[idx] = record;
  saveProviders(list);
}

export function deleteProvider(name: string): void {
  saveProviders(loadProviders().filter((p) => p.name !== name));
}

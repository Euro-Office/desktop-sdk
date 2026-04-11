import { create, type StoreApi, type UseBoundStore } from "zustand";

export type Page = "chat" | "settings" | "initial-setup" | "history";

export interface RouterStoreState {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  goToChat: () => void;
  goToSettings: () => void;
  goToInitialSetup: () => void;
}

export function createRouterStore(): UseBoundStore<StoreApi<RouterStoreState>> {
  return create<RouterStoreState>((set) => ({
    currentPage: "chat",
    setCurrentPage: (page) => set({ currentPage: page }),
    goToChat: () => set({ currentPage: "chat" }),
    goToSettings: () => set({ currentPage: "settings" }),
    goToInitialSetup: () => set({ currentPage: "initial-setup" }),
  }));
}

import { create } from "zustand";

export type Page = "chat" | "settings" | "initial-setup" | "history";

type RouterState = {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  goToChat: () => void;
  goToSettings: () => void;
  goToInitialSetup: () => void;
};

const useRouter = create<RouterState>((set) => ({
  currentPage: "chat",
  // currentPage: "initial-setup",
  setCurrentPage: (page: Page) => set({ currentPage: page }),
  goToChat: () => set({ currentPage: "chat" }),
  goToSettings: () => set({ currentPage: "settings" }),
  goToInitialSetup: () => set({ currentPage: "initial-setup" }),
}));

export default useRouter;

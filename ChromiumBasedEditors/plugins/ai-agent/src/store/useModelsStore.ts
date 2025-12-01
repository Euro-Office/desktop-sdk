import { create } from "zustand";
import { CURRENT_MODEL_KEY } from "@/lib/constants";
import type { Model } from "@/lib/types";
import { provider } from "@/providers";

type UseModelsStoreProps = {
  currentModel: Model | null;

  selectModel: (model: Model) => void;

  deleteSelectedModel: () => void;
};

const useModelsStore = create<UseModelsStoreProps>((set) => ({
  currentModel: (() => {
    const saved = localStorage.getItem(CURRENT_MODEL_KEY);

    if (!saved) return null;

    const parsed: Model = JSON.parse(saved);

    provider.setCurrentProviderModel(parsed.id);

    return parsed;
  })(),

  selectModel: (model) => {
    set({ currentModel: model });
    provider.setCurrentProviderModel(model.id);
    localStorage.setItem(CURRENT_MODEL_KEY, JSON.stringify(model));
  },

  deleteSelectedModel: () => {
    set({ currentModel: null });
    localStorage.removeItem(CURRENT_MODEL_KEY);
    provider.setCurrentProviderModel("");
  },
}));

export default useModelsStore;

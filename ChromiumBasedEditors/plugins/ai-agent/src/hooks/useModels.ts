import { useEffect } from "react";
import { provider } from "@/providers";
import useModelsStore from "@/store/useModelsStore";

const useModels = () => {
  const { initCurrentModel, currentModel } = useModelsStore();

  useEffect(() => {
    if (!currentModel) return;

    provider.setCurrentProviderModel(currentModel.id);
  }, [currentModel]);

  useEffect(() => {
    initCurrentModel();
  }, [initCurrentModel]);

  return {};
};

export default useModels;

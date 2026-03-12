import React from "react";
import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import type { TProvider } from "@/lib/types";
import { provider } from "@/providers";
import useMessageStore from "@/store/useMessageStore";
import useModelsStore from "@/store/useModelsStore";
import useProviders from "@/store/useProviders";
import useServersStore from "@/store/useServersStore";
import useWalletStore from "@/store/useWalletStore";

const SelectModel = () => {
  const { currentModel, selectModel } = useModelsStore();
  const { providers, providersModels, currentProvider, setCurrentProvider } =
    useProviders();
  const { tools } = useServersStore();
  const { messages } = useMessageStore();
  const { isWalletActive, walletModels, selectedCloud, fetchWalletModels } =
    useWalletStore();

  const { t } = useTranslation();

  const walletProvider: TProvider | null =
    isWalletActive && selectedCloud
      ? {
          type: "wallet",
          name: "Wallet",
          key: selectedCloud.data.apiKey,
          baseUrl: selectedCloud.url,
        }
      : null;

  React.useEffect(() => {
    if (isWalletActive && selectedCloud) {
      fetchWalletModels();
    }
  }, [isWalletActive, selectedCloud, fetchWalletModels]);

  const onSelectModel = React.useCallback(
    (providerInfo: TProvider, modelId: string) => {
      if (
        currentModel?.id === modelId &&
        provider.currentProviderInfo?.name === providerInfo.name
      )
        return;

      const models = isWalletActive
        ? walletModels
        : providersModels.get(providerInfo.name);

      const model = models?.find((model) => model.id === modelId);

      if (!model) return;

      if (provider.currentProviderInfo?.name !== providerInfo.name) {
        setCurrentProvider(providerInfo);

        provider.setCurrentProviderModel(modelId, model.reasoning);
        provider.setCurrentProviderTools(tools);
        provider.setCurrentProviderPrevMessages(messages);
      }

      selectModel(model);
    },
    [
      providersModels,
      walletModels,
      isWalletActive,
      messages,
      tools,
      currentModel,
      selectModel,
      setCurrentProvider,
    ]
  );

  const items = isWalletActive
    ? walletModels.map((model) => ({
        text: model.name,
        id: model.id,
        onClick: () =>
          walletProvider && onSelectModel(walletProvider, model.id),
        isActive: false,
        checked: model.id === currentModel?.id,
      }))
    : providers
        .map((p) => ({
          text: p.name,
          id: p.name,
          onClick: () => {
            // ignore
          },
          subMenu:
            providersModels.get(p.name)?.map((model) => ({
              text: model.name,
              id: model.id,
              onClick: () => onSelectModel(p, model.id),
              isActive: false,
              checked:
                model.id === currentModel?.id &&
                p.name === provider.currentProviderInfo?.name,
            })) || [],
        }))
        .filter((item) => item.subMenu.length > 0);

  const currentProviderExists = isWalletActive
    ? walletModels.length > 0
    : providers.some((p) => p.name === currentProvider?.name);

  React.useEffect(() => {
    if (isWalletActive) {
      if (
        (!currentModel || currentModel.provider !== "wallet") &&
        walletModels.length > 0 &&
        walletProvider
      ) {
        onSelectModel(walletProvider, walletModels[0].id);
      }
      return;
    }

    if ((!currentModel || !currentProvider) && providers.length > 0) {
      const providerInfo = providers[0];

      const model = providersModels.get(providerInfo.name)?.[0];

      if (!model) return;

      onSelectModel(providerInfo, model.id);
    }
  }, [
    currentModel,
    currentProvider,
    providers,
    providersModels,
    walletModels,
    walletProvider,
    isWalletActive,
    onSelectModel,
  ]);

  return (
    <ComboBox
      placeholder={t("SelectModel")}
      value={currentProviderExists ? currentModel?.name || "" : ""}
      items={items}
      withoutBg
      data-testid="model-selector"
    />
  );
};

export { SelectModel };

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { Link } from "@/components/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { Model, ProviderType } from "@/lib/types";
import { provider } from "@/providers";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

const INITIAL_VALUES: ModelFormValues = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  profileName: "",
};

export const AddModelCard = () => {
  const { t } = useTranslation();
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [values, setValues] = useState<ModelFormValues>(INITIAL_VALUES);
  const [models, setModels] = useState<Model[]>([]);

  const isAddDisabled =
    !values.provider || !values.baseUrl || !values.model || !values.profileName;

  const fetchModels = async (
    providerType: ProviderType,
    apiKey: string,
    baseUrl: string
  ) => {
    if (!baseUrl) return;
    const providerInfo = provider.getProviderInfo(providerType);
    const result = await provider.getProvidersModels([
      { type: providerType, name: providerInfo.name, key: apiKey, baseUrl },
    ]);
    const fetched = result.get(providerInfo.name) ?? [];
    setModels(fetched);
    setValues((prev) => ({ ...prev, model: fetched[0]?.id ?? "" }));
  };

  const debouncedFetchModels = useDebouncedCallback(fetchModels, 500);

  const handleChange = (field: keyof ModelFormValues, value: string) => {
    if (field === "provider") {
      const providerInfo = provider.getProviderInfo(value as ProviderType);
      const newBaseUrl = providerInfo.baseUrl ?? "";

      setValues((prev) => ({
        ...prev,
        provider: value,
        baseUrl: newBaseUrl,
        model: "",
      }));
      setModels([]);
      fetchModels(value as ProviderType, values.apiKey, newBaseUrl);
      return;
    }
    if (field === "apiKey") {
      setValues((prev) => ({ ...prev, apiKey: value }));
      debouncedFetchModels(
        values.provider as ProviderType,
        value,
        values.baseUrl
      );
      return;
    }
    if (field === "baseUrl") {
      setValues((prev) => ({ ...prev, baseUrl: value }));
      debouncedFetchModels(
        values.provider as ProviderType,
        values.apiKey,
        value
      );
      return;
    }
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ModelCardShell>
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-color)] mb-[32px]">
        {t("ConnectNewAIModel")}
      </h3>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
      />

      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center gap-[4px]">
          <Link href="#">{t("Import")}</Link>
          <Tooltip open={isTooltipOpen}>
            <TooltipTrigger asChild>
              <IconButton
                className="cursor-pointer"
                iconName="btn-menu-about"
                size={24}
                disableHover
                onClick={() => setIsTooltipOpen((val) => !val)}
              />
            </TooltipTrigger>
            <TooltipContent
              className="p-[12px]"
              side="bottom"
              isAbout
              align="start"
            >
              <div className="flex flex-col gap-[6px] max-w-[221px]">
                <p className="text-[12px] leading-[16px] select-none">
                  {t("EnterModelConfigTooltip")}
                </p>
                <Link
                  variant="primary"
                  href="#"
                  className="text-[12px] leading-[16px]"
                >
                  {t("DownloadTemplate")}
                </Link>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-row gap-[12px]">
          <Button variant="default">{t("Cancel")}</Button>
          <Button disabled={isAddDisabled} onClick={() => console.log(values)}>
            {t("AddModel")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

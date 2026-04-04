import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { Link } from "@/components/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import type { ProviderType } from "@/lib/types";
import useProfilesStore from "@/store/useProfilesStore";
import { useModelForm } from "../hooks/useModelForm";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

const INITIAL_VALUES: ModelFormValues = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  profileName: "",
};

interface AddModelCardProps {
  onClose?: () => void;
  isHorizontal?: boolean;
}

export const AddModelCard = ({ onClose, isHorizontal }: AddModelCardProps) => {
  const { t } = useTranslation();
  const { addProfile } = useProfilesStore();
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const {
    values,
    setValues,
    models,
    setModels,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    handleChange,
  } = useModelForm(INITIAL_VALUES);

  const handleAdd = async () => {
    setIsLoading(true);
    setErrors({});

    const result = await addProfile({
      name: values.profileName,
      providerType: values.provider as ProviderType,
      baseUrl: values.baseUrl,
      key: values.apiKey || undefined,
      modelId: values.model,
    });

    setIsLoading(false);

    if (result === true) {
      setValues(INITIAL_VALUES);
      setModels([]);
      onClose?.();
    } else if (result && typeof result === "object") {
      setErrors({ [result.field]: result.message });
    }
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
        errors={errors}
        isHorizontal={isHorizontal}
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
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={!isFormValid} onClick={handleAdd}>
            {t("AddModel")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

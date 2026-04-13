import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStores } from "../../../store/context";
import type { ProviderType } from "../../../types";
import { Button } from "../../button";
import { IconButton } from "../../icon-button";
import { Link } from "../../link";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../tooltip";
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
  variant?: "card" | "standalone";
  onClose?: () => void;
  onSuccess?: () => void;
  isHorizontal?: boolean;
}

export const AddModelCard = ({
  variant = "card",
  onClose,
  onSuccess,
  isHorizontal,
}: AddModelCardProps) => {
  const { t } = useTranslation();
  const { useProfilesStore } = useStores();
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

    const selectedModel = models.find((m) => m.id === values.model);

    const result = await addProfile({
      name: values.profileName,
      providerType: values.provider as ProviderType,
      baseUrl: values.baseUrl,
      key: values.apiKey || undefined,
      modelId: values.model,
      capabilities: selectedModel?.capabilities,
    });

    setIsLoading(false);

    if (result === true) {
      setValues(INITIAL_VALUES);
      setModels([]);
      onSuccess?.();
      onClose?.();
    } else if (result && typeof result === "object") {
      setErrors({ [result.field]: result.message });
    }
  };

  const footer = (
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
        {variant === "card" && (
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
        )}
        <Button disabled={!isFormValid} onClick={handleAdd}>
          {t("AddModel")}
        </Button>
      </div>
    </div>
  );

  if (variant === "standalone") {
    return (
      <div>
        <h3 className="select-none text-[20px] font-bold leading-[28px] text-[var(--text-normal)] text-center mb-[16px]">
          {t("ConnectAIModelToEnableChat")}
        </h3>

        <ModelConfigForm
          values={values}
          onChange={handleChange}
          models={models}
          errors={errors}
          isHorizontal={isHorizontal}
        />

        {footer}
      </div>
    );
  }

  return (
    <ModelCardShell>
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-normal)] mb-[32px]">
        {t("ConnectNewAIModel")}
      </h3>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
        errors={errors}
        isHorizontal={isHorizontal}
      />

      {footer}
    </ModelCardShell>
  );
};

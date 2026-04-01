import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { Link } from "@/components/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
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
  const isDisabled = true;
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [values, setValues] = useState<ModelFormValues>(INITIAL_VALUES);

  const handleChange = (field: keyof ModelFormValues, value: string) => {
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
        isDisabled={isDisabled}
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
          <Button disabled={isDisabled}>{t("AddModel")}</Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { provider } from "@/providers";

const providersInfo = provider.getProvidersInfo();

const InitialSetup = () => {
  const { t } = useTranslation();
  const isDisabled = true;
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <div className="flex items-center justify-center h-full w-full bg-[var(--layout-background-color)]">
      <div
        className={cn(
          "w-full max-w-[560px] p-[12px_16px] flex flex-col",
          "bg-[var(--model-config-card-background-color)]",
          "border-[length:var(--model-config-card-border-width)] border-[color:var(--model-config-card-border-color)]",
          "rounded-[var(--model-config-card-border-radius)]"
        )}
      >
        <h1 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-color)] mb-[32px]">
          {t("ConnectNewAIModel")}
        </h1>

        <div className="flex flex-col mb-[48px]">
          <FieldContainer
            className="mb-[10px]"
            header={t("Provider")}
            isHorizontal
          >
            <ComboBox
              className="w-full"
              placeholder={t("SelectProvider")}
              items={providersInfo.map((p) => ({
                text: p.name,
                id: p.name,
                onClick: () => console.log("Provider selected"),
              }))}
            />
          </FieldContainer>

          <FieldContainer
            className="mb-[32px]"
            header={t("APIKey")}
            isHorizontal
            action={<Link href="#">{t("GetAPIKey")}</Link>}
          >
            <Input
              name="key"
              placeholder={t("EnterKey")}
              className="w-full"
              type="password"
              disabled={isDisabled}
              onChange={() => console.log("Key changed")}
              value=""
            />
          </FieldContainer>

          <FieldContainer
            className="mb-[32px]"
            header={t("BaseURL")}
            isHorizontal
          >
            <Input
              name="url"
              placeholder={t("SelectModelFirst")}
              className="w-full"
              disabled={isDisabled}
              onChange={() => console.log("URL changed")}
              value=""
            />
          </FieldContainer>

          <FieldContainer
            className="mb-[32px]"
            header={t("Model")}
            isHorizontal
          >
            <ComboBox
              className="w-full"
              placeholder={t("SelectModel")}
              items={[]}
            />
          </FieldContainer>

          <FieldContainer header={t("ProfileName")} isHorizontal>
            <Input
              name="name"
              placeholder={t("EnterName")}
              className="w-full"
              disabled={isDisabled}
              onChange={() => console.log("Name changed")}
              value=""
            />
          </FieldContainer>
        </div>

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
      </div>
    </div>
  );
};

export default InitialSetup;

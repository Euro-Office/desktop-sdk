import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";
import { provider } from "@/providers";

const providersInfo = provider.getProvidersInfo();

const InitialSetup = () => {
  const { t } = useTranslation();
  const isDisabled = true;

  return (
    <div className="flex items-center justify-center h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[480px] flex flex-col">
        <h1 className="select-none text-center text-[20px] font-bold leading-[28px] text-[var(--text-color)] mb-[16px]">
          {t("ConnectAIProviderToEnableChat")}
        </h1>

        <div className="flex flex-col gap-[16px] mb-[32px]">
          <FieldContainer header={t("Provider")} isHorizontal>
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

          <FieldContainer header={t("APIKey")} isHorizontal>
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

          <FieldContainer header={t("BaseURL")} isHorizontal>
            <Input
              name="url"
              placeholder={t("SelectModelFirst")}
              className="w-full"
              disabled={isDisabled}
              onChange={() => console.log("URL changed")}
              value=""
            />
          </FieldContainer>

          <FieldContainer header={t("Model")} isHorizontal>
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
            <span className="text-[var(--text-color)] opacity-60 group-hover:opacity-100 transition-opacity underline decoration-dotted cursor-pointer">
              {t("Import")}
            </span>
            <IconButton
              className="cursor-pointer"
              iconName="btn-menu-about"
              size={24}
              disableHover
            />
          </div>
          <Button disabled={isDisabled}>{t("AddProvider")}</Button>
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;

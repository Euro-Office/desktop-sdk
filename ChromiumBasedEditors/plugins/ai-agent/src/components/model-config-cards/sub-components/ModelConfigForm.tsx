import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { getApiKeyLink } from "@/lib/apiKeyLinks";
import type { Model } from "@/lib/types";
import { getProviderInstance } from "../../../../npm_lib/providers/provider-holder";

const providersInfo = getProviderInstance().getProvidersInfo();

export interface ModelFormValues {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  profileName: string;
}

export type ModelFormErrors = Partial<Record<"key" | "url" | "name", string>>;

interface ModelConfigFormProps {
  values: ModelFormValues;
  onChange: (field: keyof ModelFormValues, value: string) => void;
  models: Model[];
  errors?: ModelFormErrors;
  isHorizontal?: boolean;
}

export const ModelConfigForm = ({
  values,
  onChange,
  models,
  errors,
  isHorizontal,
}: ModelConfigFormProps) => {
  const { t } = useTranslation();
  const isFieldsDisabled = !values.provider;

  const modelItems = models.map((m) => ({
    text: m.name,
    id: m.id,
    onClick: () => onChange("model", m.id),
  }));

  return (
    <div className="flex flex-col mb-[26px]">
      <FieldContainer
        header={t("Provider")}
        isHorizontal={isHorizontal}
        reserveErrorSpace={false}
        className={isHorizontal ? "mb-[10px]" : "mb-[16px]"}
      >
        <ComboBox
          className="w-full"
          placeholder={t("SelectProvider")}
          value={providersInfo.find((p) => p.type === values.provider)?.name}
          items={providersInfo.map((p) => ({
            text: p.name,
            id: p.type,
            onClick: () => onChange("provider", p.type),
          }))}
        />
      </FieldContainer>

      <FieldContainer
        className={isHorizontal ? "mb-[10px]" : "mb-[16px]"}
        header={t("APIKey")}
        isHorizontal={isHorizontal}
        reserveErrorSpace={isHorizontal}
        action={
          getApiKeyLink(values.provider) ? (
            <Link href={getApiKeyLink(values.provider)} target="_blank">
              {t("GetAPIKey")}
            </Link>
          ) : (
            <div className="h-[20px]" />
          )
        }
        error={errors?.key}
      >
        <Input
          name="key"
          placeholder={t("EnterKey")}
          className="w-full"
          type="password"
          disabled={isFieldsDisabled}
          onChange={(e) => onChange("apiKey", e.target.value)}
          value={values.apiKey}
        />
      </FieldContainer>

      <FieldContainer
        className={isHorizontal ? "mb-[10px]" : "mb-[16px]"}
        header={t("BaseURL")}
        isHorizontal={isHorizontal}
        reserveErrorSpace={isHorizontal}
        error={errors?.url}
      >
        <Input
          name="url"
          placeholder={t("SelectModelFirst")}
          className="w-full"
          disabled={isFieldsDisabled}
          onChange={(e) => onChange("baseUrl", e.target.value)}
          value={values.baseUrl}
        />
      </FieldContainer>

      <FieldContainer
        className={isHorizontal ? "mb-[10px]" : "mb-[16px]"}
        header={t("Model")}
        isHorizontal={isHorizontal}
        reserveErrorSpace={isHorizontal}
      >
        <ComboBox
          className="w-full"
          placeholder={t("SelectModel")}
          value={models.find((m) => m.id === values.model)?.name}
          disabled={!values.provider || models.length === 0}
          items={modelItems}
        />
      </FieldContainer>

      <FieldContainer
        className={isHorizontal ? undefined : "mb-[16px]"}
        header={t("ProfileName")}
        isHorizontal={isHorizontal}
        reserveErrorSpace={isHorizontal}
        error={errors?.name}
      >
        <Input
          name="name"
          placeholder={t("EnterName")}
          className="w-full"
          disabled={isFieldsDisabled}
          onChange={(e) => onChange("profileName", e.target.value)}
          value={values.profileName}
        />
      </FieldContainer>
    </div>
  );
};

import { useTranslation } from "react-i18next";
import { getApiKeyLink } from "../../../lib/api-key-links";
import { useStores } from "../../../store/context";
import type { Model, ProviderType } from "../../../types";
import { ComboBox } from "../../combo-box";
import { FieldContainer } from "../../field-container";
import { Input } from "../../input";
import { Link } from "../../link";

export interface ModelFormValues {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  profileName: string;
  isCloudProvider?: boolean;
}

export type ModelFormErrors = Partial<Record<"key" | "url" | "name", string>>;

export type ProviderSelection = {
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  isCloudProvider?: boolean;
};

interface ModelConfigFormProps {
  values: ModelFormValues;
  onChange: (
    field: keyof ModelFormValues,
    value: string | ProviderSelection
  ) => void;
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
  const { provider, useCloudsStore } = useStores();
  const { cloudProviders } = useCloudsStore();
  const providersInfo = provider.getProvidersInfo();
  const isFieldsDisabled = !values.provider;

  const providerItems = [
    ...cloudProviders.map((cp) => ({
      text: cp.label,
      id: cp.url,
      onClick: () =>
        onChange("provider", {
          type: "onlyoffice" as ProviderType,
          baseUrl: cp.url,
          apiKey: cp.apiKey,
          isCloudProvider: true,
        }),
    })),
    ...providersInfo.map((p) => ({
      text: p.name,
      id: p.type,
      onClick: () =>
        onChange("provider", {
          type: p.type as ProviderType,
          baseUrl: p.baseUrl,
        }),
    })),
  ];

  const selectedProviderText =
    (values.isCloudProvider && values.baseUrl
      ? new URL(values.baseUrl).hostname
      : undefined) ??
    providersInfo.find((p) => p.type === values.provider)?.name;

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
          value={selectedProviderText}
          items={providerItems}
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

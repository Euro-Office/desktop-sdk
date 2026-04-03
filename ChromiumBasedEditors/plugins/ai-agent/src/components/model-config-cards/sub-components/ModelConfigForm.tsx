import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import type { Model } from "@/lib/types";
import { provider } from "@/providers";

const providersInfo = provider.getProvidersInfo();

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
}

export const ModelConfigForm = ({
  values,
  onChange,
  models,
  errors,
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
        isHorizontal
        reserveErrorSpace={false}
        className="mb-[10px]"
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
        className="mb-[10px]"
        header={t("APIKey")}
        isHorizontal
        action={<Link href="#">{t("GetAPIKey")}</Link>}
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
        className="mb-[10px]"
        header={t("BaseURL")}
        isHorizontal
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

      <FieldContainer className="mb-[10px]" header={t("Model")} isHorizontal>
        <ComboBox
          className="w-full"
          placeholder={t("SelectModel")}
          value={models.find((m) => m.id === values.model)?.name}
          disabled={!values.provider || models.length === 0}
          items={modelItems}
        />
      </FieldContainer>

      <FieldContainer
        header={t("ProfileName")}
        isHorizontal
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

import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { provider } from "@/providers";

const providersInfo = provider.getProvidersInfo();

export interface ModelFormValues {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  profileName: string;
}

interface ModelConfigFormProps {
  values: ModelFormValues;
  onChange: (field: keyof ModelFormValues, value: string) => void;
  isDisabled?: boolean;
}

export const ModelConfigForm = ({
  values,
  onChange,
  isDisabled,
}: ModelConfigFormProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col mb-[48px]">
      <FieldContainer className="mb-[10px]" header={t("Provider")} isHorizontal>
        <ComboBox
          className="w-full"
          placeholder={t("SelectProvider")}
          items={providersInfo.map((p) => ({
            text: p.name,
            id: p.name,
            onClick: () => onChange("provider", p.name),
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
          onChange={(e) => onChange("apiKey", e.target.value)}
          value={values.apiKey}
        />
      </FieldContainer>

      <FieldContainer className="mb-[32px]" header={t("BaseURL")} isHorizontal>
        <Input
          name="url"
          placeholder={t("SelectModelFirst")}
          className="w-full"
          disabled={isDisabled}
          onChange={(e) => onChange("baseUrl", e.target.value)}
          value={values.baseUrl}
        />
      </FieldContainer>

      <FieldContainer className="mb-[32px]" header={t("Model")} isHorizontal>
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
          onChange={(e) => onChange("profileName", e.target.value)}
          value={values.profileName}
        />
      </FieldContainer>
    </div>
  );
};

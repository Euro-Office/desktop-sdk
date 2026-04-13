import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStores } from "../../../store/context";
import type { Profile, ProviderType } from "../../../types";
import { Button } from "../../button";
import { Icon } from "../../icon";
import { ProviderLogo } from "../../provider-logo";
import { useModelForm } from "../hooks/useModelForm";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

interface EditModelCardProps {
  profile: Profile;
  onClose: () => void;
  onDelete: () => void;
  isHorizontal?: boolean;
}

const profileToFormValues = (p: Profile): ModelFormValues => ({
  provider: p.providerType,
  apiKey: p.key ?? "",
  baseUrl: p.baseUrl,
  model: p.modelId,
  profileName: p.name,
});

export const EditModelCard = ({
  profile,
  onClose,
  onDelete,
  isHorizontal,
}: EditModelCardProps) => {
  const { t } = useTranslation();
  const { useProfilesStore } = useStores();
  const { editProfile } = useProfilesStore();
  const initialValues = profileToFormValues(profile);

  const {
    values,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    fetchModels,
    handleChange,
    models,
  } = useModelForm(initialValues);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch models once on mount using initial profile values
  useEffect(() => {
    fetchModels(profile.providerType, profile.key ?? "", profile.baseUrl, {
      keepModelIfExists: true,
    });
  }, []);

  const handleSave = async () => {
    const hasChanges = (
      Object.keys(initialValues) as (keyof ModelFormValues)[]
    ).some((key) => values[key] !== initialValues[key]);

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsLoading(true);
    setErrors({});

    const selectedModel = models.find((m) => m.id === values.model);

    const result = await editProfile({
      ...profile,
      name: values.profileName,
      providerType: values.provider as ProviderType,
      baseUrl: values.baseUrl,
      key: values.apiKey || undefined,
      modelId: values.model,
      capabilities: selectedModel?.capabilities ?? profile.capabilities,
    });

    setIsLoading(false);

    if (result === true) {
      onClose();
    } else if (result && typeof result === "object") {
      setErrors({ [result.field]: result.message });
    }
  };

  return (
    <ModelCardShell>
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-normal)] mb-[12px]">
        {t("EditAIModel")}
      </h3>

      <div className="flex flex-row items-center gap-[12px] mb-[16px]">
        <ProviderLogo providerType={values.provider as ProviderType} />
        <p className="text-[14px] leading-[20px] text-[var(--text-normal)] truncate">
          {values.profileName}
        </p>
      </div>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
        errors={errors}
        isHorizontal={isHorizontal}
      />

      <div className="flex flex-row justify-between items-center">
        <Button variant="default" onClick={onDelete}>
          <Icon name="btn-remove" size={24} />
          {t("Delete")}
        </Button>
        <div className="flex flex-row gap-[12px]">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={!isFormValid} onClick={handleSave}>
            {t("SaveChanges")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

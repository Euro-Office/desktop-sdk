import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { Model, Profile, ProviderType } from "@/lib/types";
import { provider } from "@/providers";
import useProfilesStore from "@/store/useProfilesStore";
import { ModelCardShell } from "./ModelCardShell";
import {
  ModelConfigForm,
  type ModelFormErrors,
  type ModelFormValues,
} from "./ModelConfigForm";

interface EditModelCardProps {
  profile: Profile;
  onClose: () => void;
  onDelete: () => void;
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
}: EditModelCardProps) => {
  const { t } = useTranslation();
  const { editProfile } = useProfilesStore();
  const initialValues = profileToFormValues(profile);
  const [values, setValues] = useState<ModelFormValues>(initialValues);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ModelFormErrors>({});
  const fetchModelsRequestIdRef = useRef(0);

  const isSaveDisabled =
    isLoading ||
    !values.provider ||
    !values.baseUrl ||
    !values.model ||
    !values.profileName;

  const fetchModels = async (
    providerType: ProviderType,
    apiKey: string,
    baseUrl: string
  ) => {
    if (!baseUrl) return;
    try {
      new URL(baseUrl);
    } catch {
      setErrors((prev) => ({ ...prev, url: t("InvalidUrl") }));
      setModels([]);
      return;
    }
    setErrors({});
    const requestId = ++fetchModelsRequestIdRef.current;
    const providerInfo = provider.getProviderInfo(providerType);
    const { models: result, errors: fetchErrors } =
      await provider.getProvidersModels([
        { type: providerType, name: providerInfo.name, key: apiKey, baseUrl },
      ]);
    if (requestId !== fetchModelsRequestIdRef.current) return;
    const fetchError = fetchErrors.get(providerInfo.name);
    if (fetchError) {
      setErrors((prev) => ({
        ...prev,
        [fetchError.field]: fetchError.message,
      }));
      setModels([]);
      return;
    }
    const fetched = result.get(providerInfo.name) ?? [];
    setModels(fetched);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch models once on mount using initial profile values
  useEffect(() => {
    const providerInfo = provider.getProviderInfo(profile.providerType);
    provider
      .getProvidersModels([
        {
          type: profile.providerType,
          name: providerInfo.name,
          key: profile.key,
          baseUrl: profile.baseUrl,
        },
      ])
      .then(({ models: result, errors: fetchErrors }) => {
        if (fetchModelsRequestIdRef.current > 0) return;
        const fetchError = fetchErrors.get(providerInfo.name);
        if (fetchError) {
          setErrors({ [fetchError.field]: fetchError.message });
          return;
        }
        setModels(result.get(providerInfo.name) ?? []);
      });
  }, []);

  const debouncedFetchModels = useDebouncedCallback(fetchModels, 500);

  const fieldToErrorKey: Partial<
    Record<keyof ModelFormValues, keyof ModelFormErrors>
  > = {
    apiKey: "key",
    baseUrl: "url",
    profileName: "name",
  };

  const handleChange = (field: keyof ModelFormValues, value: string) => {
    const errorKey = fieldToErrorKey[field];
    if (errorKey) setErrors((prev) => ({ ...prev, [errorKey]: undefined }));

    if (field === "provider") {
      const providerInfo = provider.getProviderInfo(value as ProviderType);
      const newBaseUrl = providerInfo.baseUrl ?? "";

      setValues((prev) => ({
        ...prev,
        provider: value,
        baseUrl: newBaseUrl,
        model: "",
      }));
      setModels([]);
      fetchModels(value as ProviderType, values.apiKey, newBaseUrl);
      return;
    }
    if (field === "apiKey") {
      setValues((prev) => ({ ...prev, apiKey: value }));
      debouncedFetchModels(
        values.provider as ProviderType,
        value,
        values.baseUrl
      );
      return;
    }
    if (field === "baseUrl") {
      setValues((prev) => ({ ...prev, baseUrl: value }));
      debouncedFetchModels(
        values.provider as ProviderType,
        values.apiKey,
        value
      );
      return;
    }
    if (field === "model") {
      const modelObj = models.find((m) => m.id === value);
      const providerInfo = provider.getProviderInfo(
        values.provider as ProviderType
      );
      setValues((prev) => ({
        ...prev,
        model: value,
        ...(modelObj && {
          profileName: `${providerInfo.name} - ${modelObj.name}`,
        }),
      }));
      return;
    }
    setValues((prev) => ({ ...prev, [field]: value }));
  };

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

    const result = await editProfile({
      ...profile,
      name: values.profileName,
      providerType: values.provider as ProviderType,
      baseUrl: values.baseUrl,
      key: values.apiKey || undefined,
      modelId: values.model,
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
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-color)] mb-[12px]">
        {t("EditAIModel")}
      </h3>

      <div className="flex flex-row items-center gap-[12px] mb-[16px]">
        <div className="w-[32px] h-[32px] shrink-0 rounded-[var(--model-card-logo-border-radius)] border border-[var(--model-card-logo-border-color)]" />
        <p className="text-[14px] leading-[20px] text-[var(--text-color)] truncate">
          {values.profileName}
        </p>
      </div>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
        errors={errors}
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
          <Button disabled={isSaveDisabled} onClick={handleSave}>
            {t("SaveChanges")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

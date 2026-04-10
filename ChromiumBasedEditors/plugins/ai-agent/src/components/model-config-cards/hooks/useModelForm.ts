import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ModelFormErrors,
  ModelFormValues,
} from "@/components/model-config-cards/sub-components/ModelConfigForm";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { Model, ProviderType } from "@/lib/types";
import { getProviderInstance } from "../../../../npm_lib/providers/provider-holder";

export const useModelForm = (initialValues: ModelFormValues) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<ModelFormValues>(initialValues);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ModelFormErrors>({});
  const fetchModelsRequestIdRef = useRef(0);

  const isFormValid =
    !isLoading &&
    !!values.provider &&
    !!values.baseUrl &&
    !!values.model &&
    !!values.profileName;

  const fetchModels = async (
    providerType: ProviderType,
    apiKey: string,
    baseUrl: string,
    options?: { keepModelIfExists?: boolean }
  ) => {
    if (!baseUrl) return;
    try {
      new URL(baseUrl);
    } catch {
      setErrors((prev) => ({ ...prev, url: t("InvalidUrl") }));
      setModels([]);
      setValues((prev) => ({ ...prev, model: "" }));
      return;
    }
    setErrors({});
    const requestId = ++fetchModelsRequestIdRef.current;
    const providerInfo = getProviderInstance().getProviderInfo(providerType);
    const { models: result, errors: fetchErrors } =
      await getProviderInstance().getProvidersModels([
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
      setValues((prev) => ({ ...prev, model: "" }));
      return;
    }
    const fetched = result.get(providerInfo.name) ?? [];
    setModels(fetched);

    setValues((prev) => {
      if (options?.keepModelIfExists) {
        const currentExists = fetched.some((m) => m.id === prev.model);
        if (currentExists) return prev;
      }
      const firstModel = fetched[0];
      return {
        ...prev,
        model: firstModel?.id ?? "",
        ...(firstModel && {
          profileName: `${providerInfo.name} - ${firstModel.name}`,
        }),
      };
    });
  };

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
      const providerInfo = getProviderInstance().getProviderInfo(
        value as ProviderType
      );
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
      const providerInfo = getProviderInstance().getProviderInfo(
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

  return {
    values,
    setValues,
    models,
    setModels,
    isLoading,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    fetchModels,
    handleChange,
  };
};

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStores } from "../../../store/context";
import { useDebouncedCallback } from "../../../hooks/useDebouncedCallback";
import type { Model, ProviderType } from "../../../types";
import type {
  ModelFormErrors,
  ModelFormValues,
} from "../../model-config-cards/sub-components/ModelConfigForm";

const fieldToErrorKey: Partial<
  Record<keyof ModelFormValues, keyof ModelFormErrors>
> = {
  apiKey: "key",
  baseUrl: "url",
  profileName: "name",
};

export const useModelForm = (initialValues: ModelFormValues) => {
  const { t } = useTranslation();
  const { provider } = useStores();
  const [values, setValues] = useState<ModelFormValues>(initialValues);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ModelFormErrors>({});
  const fetchModelsRequestIdRef = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const isFormValid =
    !isLoading &&
    !!values.provider &&
    !!values.baseUrl &&
    !!values.model &&
    !!values.profileName &&
    Object.values(errors).every((v) => !v);

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
    setErrors((prev) => {
      const { url: _url, key: _key, ...rest } = prev;
      return rest;
    });
    setIsLoading(true);
    const requestId = ++fetchModelsRequestIdRef.current;
    const providerInfo = provider.getProviderInfo(providerType);
    const { models: result, errors: fetchErrors } =
      await provider.getProvidersModels([
        { type: providerType, name: providerInfo.name, key: apiKey, baseUrl },
      ]);
    if (requestId !== fetchModelsRequestIdRef.current) return;
    setIsLoading(false);
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

  const handleChange = (field: keyof ModelFormValues, value: string) => {
    const errorKey = fieldToErrorKey[field];
    if (errorKey) setErrors((prev) => ({ ...prev, [errorKey]: undefined }));

    if (field === "provider") {
      const providerInfo = provider.getProviderInfo(
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
      fetchModels(value as ProviderType, valuesRef.current.apiKey, newBaseUrl);
      return;
    }
    if (field === "apiKey") {
      setValues((prev) => ({ ...prev, apiKey: value }));
      debouncedFetchModels(
        valuesRef.current.provider as ProviderType,
        value,
        valuesRef.current.baseUrl
      );
      return;
    }
    if (field === "baseUrl") {
      setValues((prev) => ({ ...prev, baseUrl: value }));
      debouncedFetchModels(
        valuesRef.current.provider as ProviderType,
        valuesRef.current.apiKey,
        value
      );
      return;
    }
    if (field === "model") {
      const modelObj = models.find((m) => m.id === value);
      const providerInfo = provider.getProviderInfo(
        valuesRef.current.provider as ProviderType
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

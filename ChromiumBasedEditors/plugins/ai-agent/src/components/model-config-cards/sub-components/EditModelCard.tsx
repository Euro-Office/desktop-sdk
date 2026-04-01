import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

interface EditModelCardProps {
  initialValues: ModelFormValues;
  onSave: (values: ModelFormValues) => void;
  onCancel: () => void;
}

export const EditModelCard = ({
  initialValues,
  onSave,
  onCancel,
}: EditModelCardProps) => {
  const { t } = useTranslation();
  const isDisabled = true;
  const [values, setValues] = useState<ModelFormValues>(initialValues);

  const handleChange = (field: keyof ModelFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ModelCardShell>
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-color)] mb-[32px]">
        {t("EditAIModel")}
      </h3>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        isDisabled={isDisabled}
      />

      <div className="flex flex-row justify-end gap-[12px]">
        <Button variant="default" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button disabled={isDisabled} onClick={() => onSave(values)}>
          {t("Save")}
        </Button>
      </div>
    </ModelCardShell>
  );
};

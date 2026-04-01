import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

interface EditModelCardProps {
  initialValues: ModelFormValues;
  onSave: (values: ModelFormValues) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const EditModelCard = ({
  initialValues,
  onSave,
  onCancel,
  onDelete,
}: EditModelCardProps) => {
  const { t } = useTranslation();
  const isDisabled = true;
  const [values, setValues] = useState<ModelFormValues>(initialValues);

  const handleChange = (field: keyof ModelFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
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
        isDisabled={isDisabled}
      />

      <div className="flex flex-row justify-between items-center">
        <Button variant="default" onClick={onDelete}>
          <Icon name="btn-remove" size={24} />
          {t("Delete")}
        </Button>
        <div className="flex flex-row gap-[12px]">
          <Button variant="default" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button disabled={isDisabled} onClick={() => onSave(values)}>
            {t("SaveChanges")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};

import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import { provider } from "@/providers";

const providersInfo = provider.getProvidersInfo();

const ModelAssignment = () => {
  const { t } = useTranslation();

  return (
    <div className="w-[full] max-w-[480px]">
      <p className="font-normal leading-[20px] text-[var(--settings-description-color)] mb-[32px]">
        {t("ModelAssignmentDescription")}
      </p>
      <div className="flex flex-col">
        <FieldContainer
          header={t("DefaultModel")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[40px]"
          headerClassName="font-bold"
        >
          <ComboBox
            className="w-full"
            placeholder={t("SelectProvider")}
            items={providersInfo.map((p) => ({
              text: p.name,
              id: p.type,
              onClick: () => undefined,
            }))}
          />
        </FieldContainer>

        <p className="select-none font-bold leading-[16px] text-[var(--settings-header-color)] mb-[12px]">
          {t("OverrideForTasks")}
        </p>

        <FieldContainer
          header={t("AIChat")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="ask-ai"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("Summarization")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="summarization"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("Translation")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="translation"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("TextAnalysis")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="text-analysis-ai"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("ImageGeneration")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="image-generation"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("OCR")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="ocr"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>

        <FieldContainer
          header={t("Vision")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="vision-ai"
        >
          <ComboBox className="w-full" value={t("DefaultModel")} items={[]} />
        </FieldContainer>
      </div>
    </div>
  );
};

export { ModelAssignment };

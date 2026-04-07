import { useTranslation } from "react-i18next";
import { ComboBox } from "@/components/combo-box";
import { FieldContainer } from "@/components/field-container";
import type { Profile } from "@/lib/types";
import useProfilesStore from "@/store/useProfilesStore";

const ModelAssignment = () => {
  const { t } = useTranslation();
  const {
    profiles,
    defaultProfile,
    chatProfile,
    summarizationProfile,
    translationProfile,
    textAnalysisProfile,
    imageGenerationProfile,
    ocrProfile,
    visionProfile,
    setDefaultProfile,
    setChatProfile,
    setSummarizationProfile,
    setTranslationProfile,
    setTextAnalysisProfile,
    setImageGenerationProfile,
    setOcrProfile,
    setVisionProfile,
  } = useProfilesStore();

  const defaultItems = profiles.map((p) => ({
    text: p.name,
    id: p.id,
    onClick: () => setDefaultProfile(p),
  }));

  const taskItems = (setter: (p: Profile | null) => void) => [
    {
      text: t("DefaultModel"),
      id: "default",
      onClick: () => setter(null),
    },
    ...profiles.map((p) => ({
      text: p.name,
      id: p.id,
      onClick: () => setter(p),
    })),
  ];

  return (
    <div className="w-full">
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
            value={defaultProfile?.name ?? ""}
            items={defaultItems}
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
          <ComboBox
            className="w-full"
            value={chatProfile?.name ?? t("DefaultModel")}
            items={taskItems(setChatProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Summarization")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="summarization"
        >
          <ComboBox
            className="w-full"
            value={summarizationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setSummarizationProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Translation")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="translation"
        >
          <ComboBox
            className="w-full"
            value={translationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setTranslationProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("TextAnalysis")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="text-analysis-ai"
        >
          <ComboBox
            className="w-full"
            value={textAnalysisProfile?.name ?? t("DefaultModel")}
            items={taskItems(setTextAnalysisProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("ImageGeneration")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="image-generation"
        >
          <ComboBox
            className="w-full"
            value={imageGenerationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setImageGenerationProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("OCR")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="ocr"
        >
          <ComboBox
            className="w-full"
            value={ocrProfile?.name ?? t("DefaultModel")}
            items={taskItems(setOcrProfile)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Vision")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[24px]"
          icon="vision-ai"
        >
          <ComboBox
            className="w-full"
            value={visionProfile?.name ?? t("DefaultModel")}
            items={taskItems(setVisionProfile)}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { ModelAssignment };

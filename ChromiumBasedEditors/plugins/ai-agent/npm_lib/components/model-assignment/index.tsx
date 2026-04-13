import { useTranslation } from "react-i18next";
import { CapabilitiesUI } from "../../capabilities";
import { useStores } from "../../store/context";
import type { Profile } from "../../types";
import { ComboBox } from "../combo-box";
import { FieldContainer } from "../field-container";

const ModelAssignment = () => {
  const { t } = useTranslation();
  const { useProfilesStore } = useStores();
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

  const filterByCapability = (requiredCap: number) =>
    profiles.filter(
      (p) => !p.capabilities || (p.capabilities & requiredCap) !== 0
    );

  const taskItems = (
    setter: (p: Profile | null) => void,
    requiredCap: number
  ) => [
    {
      text: t("DefaultModel"),
      id: "default",
      onClick: () => setter(null),
    },
    ...filterByCapability(requiredCap).map((p) => ({
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
            items={taskItems(setChatProfile, CapabilitiesUI.Chat)}
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
            items={taskItems(setSummarizationProfile, CapabilitiesUI.Chat)}
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
            items={taskItems(setTranslationProfile, CapabilitiesUI.Chat)}
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
            items={taskItems(setTextAnalysisProfile, CapabilitiesUI.Chat)}
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
            items={taskItems(setImageGenerationProfile, CapabilitiesUI.Image)}
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
            items={taskItems(setOcrProfile, CapabilitiesUI.Vision)}
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
            items={taskItems(setVisionProfile, CapabilitiesUI.Vision)}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { ModelAssignment };

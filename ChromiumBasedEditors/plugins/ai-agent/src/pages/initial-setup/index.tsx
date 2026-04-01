import { useTranslation } from "react-i18next";
import { ModelCard } from "@/components/model-card";
import { AddModelCard } from "@/components/model-config-cards";

const MOCK_MODELS = [
  { name: "ChatGPT", provider: "OpenAI" },
  { name: "Claude", provider: "Anthropic" },
  {
    name: "Long-long-long-long-long-lonlong-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long",
    provider: "Qwen",
  },
];

const InitialSetup = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center h-full w-full bg-[var(--layout-background-color)] py-[24px]">
      <div className="w-full max-w-[560px] flex flex-col">
        <h1 className="select-none text-[20px] font-bold leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("AIModels")}
        </h1>
        <p className="select-none leading-[20px] text-[var(--settings-description-color)] mb-[16px]">
          {t("AIModelsDescription")}
        </p>

        <AddModelCard />

        <div className="flex flex-col gap-[16px]">
          {MOCK_MODELS.map((model) => (
            <ModelCard key={model.name} model={model} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;

import { useTranslation } from "react-i18next";
import { ModelAssignment } from "./sub-components";

const ModelAssignmentPage = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center">
      <div className="w-[560px] p-[24px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("ModelAssignment")}
        </h1>
        <ModelAssignment />
      </div>
    </div>
  );
};

export default ModelAssignmentPage;

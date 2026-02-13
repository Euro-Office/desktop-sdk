import { useTranslation } from "react-i18next";

const RTL_LANGUAGES = ["ar-SA"];

export const useDirection = () => {
  const { i18n } = useTranslation();

  const isRTL = RTL_LANGUAGES.includes(i18n.language);
  const direction = isRTL ? "rtl" : "ltr";

  return { isRTL, direction };
};

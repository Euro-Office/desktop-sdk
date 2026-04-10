import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arSA from "./locales/ar-SA.json";
import bg from "./locales/bg.json";
import cs from "./locales/cs.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fi from "./locales/fi.json";
import fr from "./locales/fr.json";
import hu from "./locales/hu.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import pl from "./locales/pl.json";
import ptBr from "./locales/pt-BR.json";
import ru from "./locales/ru.json";
import sk from "./locales/sk.json";
import sl from "./locales/sl.json";
import srCyrl from "./locales/sr-Cyrl.json";
import srLatn from "./locales/sr-Latn.json";
import tr from "./locales/tr.json";
import vi from "./locales/vi.json";
import zhCN from "./locales/zh.json";

export const bundledLocales: Record<string, { translation: object }> = {
  "ar-SA": { translation: arSA },
  bg: { translation: bg },
  "cs-CZ": { translation: cs },
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  fi: { translation: fi },
  fr: { translation: fr },
  hu: { translation: hu },
  it: { translation: it },
  "ja-JP": { translation: ja },
  pl: { translation: pl },
  "pt-BR": { translation: ptBr },
  ru: { translation: ru },
  "sk-SK": { translation: sk },
  sl: { translation: sl },
  "sr-Cyrl-RS": { translation: srCyrl },
  "sr-Latn-RS": { translation: srLatn },
  tr: { translation: tr },
  vi: { translation: vi },
  "zh-CN": { translation: zhCN },
};

export interface InitAIChatI18nOptions {
  locale?: string;
  resources?: Record<string, { translation: object }>;
}

let initialized = false;

export const initAIChatI18n = (options?: InitAIChatI18nOptions) => {
  if (initialized) return i18n;

  const resources = {
    ...bundledLocales,
    ...options?.resources,
  };

  i18n.use(initReactI18next).init({
    resources,
    lng: options?.locale,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

  initialized = true;
  return i18n;
};

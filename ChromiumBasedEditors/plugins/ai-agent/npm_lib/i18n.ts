import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Lazy locale loader map — dynamic imports, not eager
const localeLoaders: Record<string, () => Promise<{ default: object }>> = {
  "ar-SA": () => import("./locales/ar-SA.json"),
  be: () => import("./locales/be.json"),
  bg: () => import("./locales/bg.json"),
  ca: () => import("./locales/ca.json"),
  "cs-CZ": () => import("./locales/cs.json"),
  da: () => import("./locales/da.json"),
  de: () => import("./locales/de.json"),
  el: () => import("./locales/el.json"),
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
  fi: () => import("./locales/fi.json"),
  fr: () => import("./locales/fr.json"),
  gl: () => import("./locales/gl.json"),
  he: () => import("./locales/he.json"),
  hr: () => import("./locales/hr.json"),
  hu: () => import("./locales/hu.json"),
  hy: () => import("./locales/hy.json"),
  id: () => import("./locales/id.json"),
  it: () => import("./locales/it.json"),
  "ja-JP": () => import("./locales/ja.json"),
  ko: () => import("./locales/ko.json"),
  lv: () => import("./locales/lv.json"),
  nl: () => import("./locales/nl.json"),
  no: () => import("./locales/no.json"),
  pl: () => import("./locales/pl.json"),
  "pt-BR": () => import("./locales/pt-BR.json"),
  "pt-PT": () => import("./locales/pt-PT.json"),
  ro: () => import("./locales/ro.json"),
  ru: () => import("./locales/ru.json"),
  "sk-SK": () => import("./locales/sk.json"),
  sl: () => import("./locales/sl.json"),
  "sq-AL": () => import("./locales/sq-AL.json"),
  "sr-Cyrl-RS": () => import("./locales/sr-Cyrl.json"),
  "sr-Latn-RS": () => import("./locales/sr-Latn.json"),
  sv: () => import("./locales/sv.json"),
  tr: () => import("./locales/tr.json"),
  uk: () => import("./locales/uk.json"),
  ur: () => import("./locales/ur.json"),
  vi: () => import("./locales/vi.json"),
  "zh-CN": () => import("./locales/zh.json"),
  "zh-TW": () => import("./locales/zh-TW.json"),
};

export interface InitAIChatI18nOptions {
  locale?: string;
  resources?: Record<string, { translation: object }>;
}

let initialized = false;

export const initAIChatI18n = async (options?: InitAIChatI18nOptions) => {
  if (initialized) return i18n;

  // Load only requested locale + English fallback
  const locale = options?.locale ?? "en";
  const resources: Record<string, { translation: object }> = {};

  // Always load English as fallback
  const enModule = await localeLoaders.en();
  resources.en = { translation: enModule.default };

  // Load requested locale if different from English
  if (locale !== "en" && localeLoaders[locale]) {
    const localeModule = await localeLoaders[locale]();
    resources[locale] = { translation: localeModule.default };
  }

  // Merge with custom resources
  if (options?.resources) {
    Object.assign(resources, options.resources);
  }

  i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

  initialized = true;
  return i18n;
};

// Export for hosts that want to preload all locales
export const bundledLocaleKeys = Object.keys(localeLoaders);

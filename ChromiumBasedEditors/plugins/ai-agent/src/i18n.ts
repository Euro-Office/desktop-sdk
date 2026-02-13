import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arSA from "./translations/ar-SA.json";
import cs from "./translations/cs.json";
import de from "./translations/de.json";
import en from "./translations/en.json";
import es from "./translations/es.json";
import fr from "./translations/fr.json";
import it from "./translations/it.json";
import ja from "./translations/ja.json";
import pl from "./translations/pl.json";
import ptBr from "./translations/pt-BR.json";
import ru from "./translations/ru.json";
import sk from "./translations/sk.json";
import srCyrl from "./translations/sr-Cyrl.json";
import srLatn from "./translations/sr-Latn.json";
import zhCN from "./translations/zh.json";

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      "ar-SA": {
        translation: arSA,
      },
      "cs-CZ": {
        translation: cs,
      },
      de: {
        translation: de,
      },
      en: {
        translation: en,
      },
      es: {
        translation: es,
      },
      fr: {
        translation: fr,
      },
      it: {
        translation: it,
      },
      "ja-JP": {
        translation: ja,
      },
      pl: {
        translation: pl,
      },
      "pt-BR": {
        translation: ptBr,
      },
      ru: {
        translation: ru,
      },
      "sk-SK": {
        translation: sk,
      },
      "sr-Cyrl-RS": {
        translation: srCyrl,
      },
      "sr-Latn-RS": {
        translation: srLatn,
      },
      "zh-CN": {
        translation: zhCN,
      },
    },
    fallbackLng: "en",

    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arSA from "./translations/ar-SA.json";
import bg from "./translations/bg.json";
import cs from "./translations/cs.json";
import de from "./translations/de.json";
import en from "./translations/en.json";
import es from "./translations/es.json";
import fi from "./translations/fi.json";
import fr from "./translations/fr.json";
import hu from "./translations/hu.json";
import it from "./translations/it.json";
import ja from "./translations/ja.json";
import pl from "./translations/pl.json";
import ptBr from "./translations/pt-BR.json";
import ru from "./translations/ru.json";
import sk from "./translations/sk.json";
import sl from "./translations/sl.json";
import srCyrl from "./translations/sr-Cyrl.json";
import srLatn from "./translations/sr-Latn.json";
import tr from "./translations/tr.json";
import vi from "./translations/vi.json";
import zhCN from "./translations/zh.json";

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      "ar-SA": {
        translation: arSA,
      },
      bg: {
        translation: bg,
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
      fi: {
        translation: fi,
      },
      fr: {
        translation: fr,
      },
      hu: {
        translation: hu,
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
      sl: {
        translation: sl,
      },
      "sr-Cyrl-RS": {
        translation: srCyrl,
      },
      "sr-Latn-RS": {
        translation: srLatn,
      },
      tr: {
        translation: tr,
      },
      vi: {
        translation: vi,
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

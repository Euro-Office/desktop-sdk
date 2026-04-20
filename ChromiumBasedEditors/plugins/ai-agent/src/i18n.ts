import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arSA from "./translations/ar-SA.json";
import be from "./translations/be.json";
import bg from "./translations/bg.json";
import ca from "./translations/ca.json";
import cs from "./translations/cs.json";
import da from "./translations/da.json";
import de from "./translations/de.json";
import el from "./translations/el.json";
import en from "./translations/en.json";
import es from "./translations/es.json";
import fi from "./translations/fi.json";
import fr from "./translations/fr.json";
import gl from "./translations/gl.json";
import he from "./translations/he.json";
import hr from "./translations/hr.json";
import hu from "./translations/hu.json";
import hy from "./translations/hy.json";
import id from "./translations/id.json";
import it from "./translations/it.json";
import ja from "./translations/ja.json";
import ko from "./translations/ko.json";
import lv from "./translations/lv.json";
import nl from "./translations/nl.json";
import no from "./translations/no.json";
import pl from "./translations/pl.json";
import ptBr from "./translations/pt-BR.json";
import ptPt from "./translations/pt-PT.json";
import ro from "./translations/ro.json";
import ru from "./translations/ru.json";
import sk from "./translations/sk.json";
import sl from "./translations/sl.json";
import sqAl from "./translations/sq-AL.json";
import srCyrl from "./translations/sr-Cyrl.json";
import srLatn from "./translations/sr-Latn.json";
import sv from "./translations/sv.json";
import tr from "./translations/tr.json";
import uk from "./translations/uk.json";
import ur from "./translations/ur.json";
import vi from "./translations/vi.json";
import zhCN from "./translations/zh.json";
import zhTW from "./translations/zh-TW.json";

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      "ar-SA": {
        translation: arSA,
      },
      be: {
        translation: be,
      },
      bg: {
        translation: bg,
      },
      ca: {
        translation: ca,
      },
      "cs-CZ": {
        translation: cs,
      },
      da: {
        translation: da,
      },
      de: {
        translation: de,
      },
      el: {
        translation: el,
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
      gl: {
        translation: gl,
      },
      he: {
        translation: he,
      },
      hr: {
        translation: hr,
      },
      hu: {
        translation: hu,
      },
      hy: {
        translation: hy,
      },
      id: {
        translation: id,
      },
      it: {
        translation: it,
      },
      "ja-JP": {
        translation: ja,
      },
      ko: {
        translation: ko,
      },
      lv: {
        translation: lv,
      },
      nl: {
        translation: nl,
      },
      no: {
        translation: no,
      },
      pl: {
        translation: pl,
      },
      "pt-BR": {
        translation: ptBr,
      },
      "pt-PT": {
        translation: ptPt,
      },
      ro: {
        translation: ro,
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
      "sq-AL": {
        translation: sqAl,
      },
      "sr-Cyrl-RS": {
        translation: srCyrl,
      },
      "sr-Latn-RS": {
        translation: srLatn,
      },
      sv: {
        translation: sv,
      },
      tr: {
        translation: tr,
      },
      uk: {
        translation: uk,
      },
      ur: {
        translation: ur,
      },
      vi: {
        translation: vi,
      },
      "zh-CN": {
        translation: zhCN,
      },
      "zh-TW": {
        translation: zhTW,
      },
    },
    fallbackLng: "en",

    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });

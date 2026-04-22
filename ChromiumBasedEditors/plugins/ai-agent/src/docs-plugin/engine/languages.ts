export interface TranslationLanguage {
  label: string;
  value: string;
  rightLabel: string;
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { label: "English", value: "English", rightLabel: "" },
  { label: "Русский", value: "Russian", rightLabel: "Russian" },
  { label: "Deutsch", value: "German", rightLabel: "German" },
  { label: "Français", value: "French", rightLabel: "French" },
  { label: "Español", value: "Spanish", rightLabel: "Spanish" },
  { label: "Slovenčina", value: "Slovak", rightLabel: "Slovak" },
  { label: "Čeština", value: "Czech", rightLabel: "Czech" },
  { label: "Italiano", value: "Italian", rightLabel: "Italian" },
  { label: "Português", value: "Portuguese", rightLabel: "Portuguese" },
  { label: "Polski", value: "Polish", rightLabel: "Polish" },
  { label: "繁體中文", value: "Chinese", rightLabel: "Chinese" },
  { label: "Catalan", value: "Catalan", rightLabel: "Catalan" },
  { label: "Dansk", value: "Danish", rightLabel: "Danish" },
  { label: "Ελληνικά", value: "Greek", rightLabel: "Greek" },
  { label: "Eesti", value: "Estonian", rightLabel: "Estonian" },
  { label: "Suomi", value: "Finnish", rightLabel: "Finnish" },
  { label: "Gaeilge", value: "Galego", rightLabel: "Galego" },
  { label: "עברית", value: "Hebrew", rightLabel: "Hebrew" },
  { label: "हिन्दी", value: "Hindi", rightLabel: "Hindi" },
  { label: "Hrvatska", value: "Croatian", rightLabel: "Croatian" },
  { label: "Magyar", value: "Hungarian", rightLabel: "Hungarian" },
  { label: "Հայերեն", value: "Armenian", rightLabel: "Armenian" },
  { label: "Indonesian", value: "Indonesian", rightLabel: "Indonesian" },
  { label: "Norsk", value: "Norwegian", rightLabel: "Norwegian" },
  { label: "Romanian", value: "Romanian", rightLabel: "Romanian" },
  { label: "Slovene", value: "Slovenian", rightLabel: "Slovenian" },
  { label: "Shqip", value: "Albanian", rightLabel: "Albanian" },
  { label: "Svenska", value: "Swedish", rightLabel: "Swedish" },
  { label: "Türkçe", value: "Turkish", rightLabel: "Turkish" },
  { label: "日本語", value: "Japanese", rightLabel: "Japanese" },
  { label: "한국어", value: "Korean", rightLabel: "Korean" },
  { label: "Български", value: "Bulgarian", rightLabel: "Bulgarian" },
  { label: "Nederlands", value: "Dutch", rightLabel: "Dutch" },
  { label: "Tiếng Việt", value: "Vietnamese", rightLabel: "Vietnamese" },
  { label: "Latviešu valoda", value: "Latvian", rightLabel: "Latvian" },
  { label: "Lietuvių kalba", value: "Lithuanian", rightLabel: "Lithuanian" },
  { label: "Беларуская мова", value: "Belarusian", rightLabel: "Belarusian" },
  { label: "Украї́нська мо́ва", value: "Ukrainian", rightLabel: "Ukrainian" },
  { label: "ພາສາລາວ", value: "Lao", rightLabel: "Lao" },
  { label: "Galego", value: "Galego", rightLabel: "Galego" },
  { label: "සිංහල", value: "Sinhala", rightLabel: "Sinhala" },
  { label: "اَلْعَرَبِيَّة", value: "Arabic", rightLabel: "Arabic" },
  { label: "Srpski (Latin)", value: "Serbian", rightLabel: "Serbian" },
];

export const DEFAULT_TRANSLATION_LANG = "English";
export const TRANSLATION_LANG_KEY = "onlyoffice_ai_plugin_translate_lang";

export interface SummarizationLanguage {
  nameEn: string;
  nameLocale: string;
  value: string;
}

export const SUMMARIZATION_LANGUAGES: SummarizationLanguage[] = [
  { nameEn: "English", nameLocale: "English", value: "en-US" },
  { nameEn: "French", nameLocale: "Français", value: "fr-FR" },
  { nameEn: "German", nameLocale: "Deutsch", value: "de-DE" },
  { nameEn: "Chinese", nameLocale: "中文", value: "zh-CN" },
  { nameEn: "Japanese", nameLocale: "日本語", value: "ja-JP" },
  { nameEn: "Russian", nameLocale: "Русский", value: "ru-RU" },
  { nameEn: "Korean", nameLocale: "한국어", value: "ko-KR" },
  { nameEn: "Spanish", nameLocale: "Español", value: "es-ES" },
  { nameEn: "Italian", nameLocale: "Italiano", value: "it-IT" },
];

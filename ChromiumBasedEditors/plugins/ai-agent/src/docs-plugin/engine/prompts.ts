export function getSummarizationPrompt(lang?: string): string {
  const translateClause = lang ? ` and translate the result to ${lang}` : "";
  return `Summarize the following text${translateClause}. Return only the resulting ${
    lang ? "translated " : ""
  }text.`;
}

export function getTranslationPrompt(lang: string): string {
  return `Translate the following text to ${lang}. Return only the resulting text.`;
}

export function getSummarizationPrompt(
  lang: string | undefined,
  text: string
): string {
  let prompt = "Summarize the following text. ";
  if (lang) {
    prompt += `and translate the result to ${lang}`;
    prompt += ". Return only the resulting translated text.";
  } else {
    prompt += ". Return only the resulting text.";
  }
  prompt += 'Text: """\n';
  prompt += text;
  prompt += '\n"""';
  return prompt;
}

export function getTranslationPrompt(lang: string, text: string): string {
  return `Translate the following text to ${lang}. Return only the resulting text.Text: """\n${text}\n"""`;
}

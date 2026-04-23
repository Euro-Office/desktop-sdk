export const prompts = {
  getFixAndSpellPrompt(content: string): string {
    return `I want you to act as an editor and proofreader. I will provide you with some text that needs to be checked for spelling and grammar errors. Your task is to carefully review the text and correct any mistakes, ensuring that the corrected text is free of errors and maintains the original meaning. Only return the corrected text. Here is the text that needs revision: "${content}"`;
  },

  getSummarizationPrompt(content: string, language?: string): string {
    let prompt = "Summarize the following text. ";
    if (language) {
      prompt += `and translate the result to ${language}`;
      prompt += ". Return only the resulting translated text.";
    } else {
      prompt += ". Return only the resulting text.";
    }
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getTranslatePrompt(content: string, language: string): string {
    let prompt = `Translate the following text to ${language}`;
    prompt += ". Return only the resulting text.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getExplainPrompt(content: string): string {
    let prompt =
      "Explain what the following text means. Return only the resulting text.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getTextLongerPrompt(content: string): string {
    let prompt =
      "Make the following text longer. Return only the resulting text.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getTextShorterPrompt(content: string): string {
    let prompt =
      "Make the following text simpler. Return only the resulting text.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getTextRewritePrompt(content: string): string {
    let prompt =
      "Rewrite the following text differently. Return only the resulting text.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getTextKeywordsPrompt(content: string): string {
    return `Get Key words from this text: "${content}"`;
  },

  getExplainAsLinkPrompt(content: string): string {
    let prompt =
      "Give a link to the explanation of the following text. Return only the resulting link.";
    prompt += 'Text: """\n';
    prompt += content;
    prompt += '\n"""';
    return prompt;
  },

  getImageDescription(): string {
    return "Describe in detail everything you see in this image. Mention the objects, their appearance, colors, arrangement, background, and any noticeable actions or interactions. Be as specific and accurate as possible. Avoid making assumptions about things that are not clearly visible.";
  },

  getImagePromptOCR(): string {
    return "Extract all text from this image as accurately as possible. Preserve original reading order and formatting if possible. Recognize tables and images if possible. Do not add or remove any content. Output recognized objects in md format if possible. If not, return plain text.";
  },
};

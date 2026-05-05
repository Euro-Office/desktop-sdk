function withAdditional(prompt: string, additional?: string): string {
  const trimmed = additional?.trim();
  if (!trimmed) return prompt;
  return `${prompt}\n\nAdditional instruction:\n\`\`\`\n${trimmed}\n\`\`\`\n`;
}

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

  getActionHintPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt = `You are a multi-disciplinary text analysis assistant.
		Your task is to find text fragments that match the user's criteria.

		MANDATORY RULES:
			1. Analyze ONLY the provided text.
			2. Find words, phrases, or sentences that match the user's criteria.
			3. For EACH match you find:
			- Provide the exact quote.
			- Explain WHY it matches the criteria.
			- Provide position information (paragraph number).
			4. If no matches are found, return an empty array: [].
			5. Format your response STRICTLY in JSON format.
			6. Support multiple languages (English, Russian, etc.)

		Response format - return ONLY this JSON array with no additional text:
			[
			{
				"origin": "exact text fragment that matches the query",
				"reason": "detailed explanation why it matches the criteria",
				"paragraph": paragraph_number,
				"occurrence": 1,
				"confidence": 0.95
			}
			]

		Guidelines for each field:
			- "origin": EXACT UNCHANGED original text fragment. Do not fix anything in this field.
			- "reason": Clear explanation of why this fragment matches the criteria; IF the user's request contains words like "source", "reference", "link", "cite", "website", "URL", "Wikipedia", "proof", "evidence", "verify" - then you MUST include actual working links in your explanations in html format.
			- "paragraph": Paragraph number where the fragment is found (0-based index)
			- "occurrence": Which occurrence of this sentence if it appears multiple times (1 for first, 2 for second, etc.)
			- "confidence": Value between 0 and 1 indicating certainty (1.0 = completely certain, 0.5 = uncertain)

		CRITICAL
			- Output should be in the exact this format
			- No any comments are allowed

		CRITICAL - Output Format:
			- Return ONLY the raw JSON array, nothing else
			- DO NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
			- DO NOT include any explanatory text before or after the JSON
			- DO NOT use escaped newlines (\\n) - return the JSON on a single line if possible
			- The response should start with [ and end with ]
		`;
    prompt += `\n\nUSER REQUEST:\n\`\`\`${query}\n\`\`\`\n\n`;
    prompt += `TEXT TO ANALYZE:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt +=
      "Please analyze this text and find all fragments that match the user's request. Be thorough but precise.";
    return withAdditional(prompt, additional);
  },

  getActionReplacePrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt =
      "You are a text-transformation assistant. Apply the user's instruction to the text below and return ONLY the rewritten text.\n\n";
    prompt += "MANDATORY RULES:\n";
    prompt +=
      "- Output ONLY the rewritten text. No commentary, no preamble, no explanation.\n";
    prompt += "- Do NOT wrap the output in markdown code fences or quotes.\n";
    prompt +=
      "- Preserve the original language of the text unless the instruction explicitly asks to translate.\n";
    prompt +=
      "- Keep the meaning intact unless the instruction explicitly asks otherwise.\n";
    prompt +=
      "- Preserve paragraph breaks; do not collapse multi-paragraph input into a single paragraph.\n\n";
    prompt += `USER INSTRUCTION:\n\`\`\`\n${query}\n\`\`\`\n\n`;
    prompt += `TEXT TO REWRITE:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt += "Return the rewritten text now:";
    return withAdditional(prompt, additional);
  },

  getActionInChatPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    const parts: string[] = [query];
    if (text) parts.push(`"${text}"`);
    return withAdditional(parts.join("\n\n"), additional);
  },

  getActionReplaceInChatReplacementPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt =
      "You are a text-transformation assistant. Apply the user's instruction to the text below and return ONLY the rewritten text.\n\n";
    prompt += "MANDATORY RULES:\n";
    prompt +=
      "- Output ONLY the rewritten text. No commentary, no preamble, no explanation.\n";
    prompt += "- Do NOT wrap the output in markdown code fences or quotes.\n";
    prompt +=
      "- Preserve the original language of the text unless the instruction explicitly asks to translate.\n";
    prompt +=
      "- Keep the meaning intact unless the instruction explicitly asks otherwise.\n";
    prompt +=
      "- Preserve paragraph breaks; do not collapse multi-paragraph input into a single paragraph.\n\n";
    prompt += `USER INSTRUCTION:\n\`\`\`\n${query}\n\`\`\`\n\n`;
    prompt += `TEXT TO REWRITE:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt += "Return the rewritten text now:";
    return withAdditional(prompt, additional);
  },

  getActionReplaceInChatExplanationPrompt(
    original: string,
    replacement: string,
    query: string,
    additional?: string
  ): string {
    const trimmedAdditional = additional?.trim();
    const additionalLine = trimmedAdditional
      ? `\n_Additional instruction:_ ${trimmedAdditional}\n`
      : "";
    const q = query?.trim();
    const intro = q
      ? `Explain the changes — what was modified and why — given the instruction **"${q}"**. Be concise.`
      : "Explain the changes — what was modified and why. Be concise.";
    return `${intro}
${additionalLine}
**Original:**

> ${original.replace(/\n/g, "\n> ")}

**Replacement:**

> ${replacement.replace(/\n/g, "\n> ")}`;
  },

  getActionAsReviewPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt =
      "You are a text-transformation assistant. Apply the user's instruction to the text below and return ONLY the rewritten text.\n\n";
    prompt += "MANDATORY RULES:\n";
    prompt +=
      "- Output ONLY the rewritten text. No commentary, no preamble, no explanation.\n";
    prompt += "- Do NOT wrap the output in markdown code fences or quotes.\n";
    prompt +=
      "- Preserve the original language of the text unless the instruction explicitly asks to translate.\n";
    prompt +=
      "- Keep the meaning intact unless the instruction explicitly asks otherwise.\n";
    prompt +=
      "- Preserve paragraph breaks; do not collapse multi-paragraph input into a single paragraph.\n\n";
    prompt += `USER INSTRUCTION:\n\`\`\`\n${query}\n\`\`\`\n\n`;
    prompt += `TEXT TO REWRITE:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt += "Return the rewritten text now:";
    return withAdditional(prompt, additional);
  },

  getActionInCommentPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt =
      "You are an assistant that writes a single document comment in response to the user's instruction about the text below.\n\n";
    prompt += "MANDATORY RULES:\n";
    prompt +=
      "- Output ONLY the comment text. No preamble, no framing, no explanation about what you are doing.\n";
    prompt +=
      "- Do NOT wrap the output in markdown code fences, quotes, or headings.\n";
    prompt += "- Keep it concise — this is a document comment, not an essay.\n";
    prompt +=
      "- Preserve the language of the source text unless the instruction explicitly asks otherwise.\n\n";
    prompt += `USER INSTRUCTION:\n\`\`\`\n${query}\n\`\`\`\n\n`;
    prompt += `SOURCE TEXT:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt += "Return the comment text now:";
    return withAdditional(prompt, additional);
  },

  getActionToEndPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt =
      "You are an assistant that produces standalone content to be appended at the end of a document, in response to the user's instruction about the source text below.\n\n";
    prompt += "MANDATORY RULES:\n";
    prompt +=
      "- Output ONLY the new content. No preamble, no framing, no explanation about what you are doing.\n";
    prompt +=
      "- Do NOT wrap the output in markdown code fences, quotes, or headings.\n";
    prompt += "- Do NOT repeat the source text verbatim.\n";
    prompt +=
      "- Preserve paragraph breaks; separate paragraphs with a blank line so they render as distinct paragraphs.\n";
    prompt +=
      "- Preserve the language of the source text unless the instruction explicitly asks otherwise.\n\n";
    prompt += `USER INSTRUCTION:\n\`\`\`\n${query}\n\`\`\`\n\n`;
    prompt += `SOURCE TEXT:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt += "Return the content to append now:";
    return withAdditional(prompt, additional);
  },

  getActionReplaceHintPrompt(
    text: string,
    query: string,
    additional?: string
  ): string {
    let prompt = `You are a multi-disciplinary text analysis and transformation assistant.
	  Your task is to analyze text based on user's specific criteria and provide intelligent corrections.

	  MANDATORY RULES:
		1. UNDERSTAND the user's intent from their criteria.
		2. Find words, phrases, or sentences that match the user's criteria.
		3. For EACH match you find:
		  - Provide the exact quote.
		  - SUGGEST appropriate replacements.
		  - Explain WHY it matches the criteria.
		  - Provide position information (paragraph number).
		4. If no matches are found, return an empty array: [].
		5. Format your response STRICTLY in JSON format.
		6. Support multiple languages (English, Russian, etc.)

	  Response format - return ONLY this JSON array with no additional text:
		[
		  {
			"origin": "exact text fragment that matches the query",
      		"suggestion": "suggested replacement (plain text)",
			"reason": "detailed explanation why it matches the criteria",
   			"difference":"visual representation showing exact changes between origin and suggestion"
			"paragraph": paragraph_number,
			"occurrence": 1,
			"confidence": 0.95
		  }
		]

	  Guidelines for each field:
		- "origin": EXACT UNCHANGED original text fragment. Do not fix anything in this field.
		- "suggestion": Your suggested replacement for the fragment.
			* Ensure it aligns with the user's criteria.
			* Maintain coherence with surrounding text.
		- "reason": Clear explanation of why this fragment matches the criteria; IF the user's request contains words like "source", "reference", "link", "cite", "website", "URL", "Wikipedia", "proof", "evidence", "verify" - then you MUST include actual working links in your explanations in html format.
		- "difference":  The difference between origin and suggestion in html format.
		- "paragraph": Paragraph number where the fragment is found (0-based index)
		- "occurrence": Which occurrence of this sentence if it appears multiple times (1 for first, 2 for second, etc.)
		- "confidence": Value between 0 and 1 indicating certainty (1.0 = completely certain, 0.5 = uncertain)

      CRITICAL: Rules for the "difference" field:
        - Format: "original → corrected", you need to leave only "corrected", never show the "original"
        - "<strong>" for added characters - use for the corrected version
        - Show exact character-level changes

	  CRITICAL:
		- Output should be in the exact this format
		- No any comments are allowed

	  CRITICAL - Output Format:
		- Return ONLY the raw JSON array, nothing else
		- DO NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
		- DO NOT include any explanatory text before or after the JSON
		- DO NOT use escaped newlines (\\n) - return the JSON on a single line if possible
		- The response should start with [ and end with ]
	  `;
    prompt += `\n\nUSER REQUEST:\n\`\`\`${query}\n\`\`\`\n\n`;
    prompt += `TEXT TO ANALYZE:\n\`\`\`\n${text}\n\`\`\`\n\n`;
    prompt +=
      "Please analyze this text and find all fragments that match the user's request. Be thorough but precise.";
    return withAdditional(prompt, additional);
  },
};

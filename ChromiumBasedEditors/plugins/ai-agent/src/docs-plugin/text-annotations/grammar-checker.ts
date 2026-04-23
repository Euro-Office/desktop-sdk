import { editor } from "../library/editor";
import type { PopupInfo, TextAnnotationPopup } from "./annotation-popup";
import { TextAnnotator } from "./text-annotator";

interface GrammarCorrection {
  origin: string;
  suggestion: string;
  difference: string;
  description: string;
  occurrence: number;
  confidence: number;
}

interface GrammarAnnotation {
  original: string;
  suggestion: string;
  difference: string;
  description: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export class GrammarChecker extends TextAnnotator {
  constructor(annotatorPopup: TextAnnotationPopup) {
    super(annotatorPopup);
    this.type = 1;
  }

  protected async annotateParagraph(
    paraId: string,
    recalcId: string,
    text: string
  ): Promise<boolean | null> {
    this.paragraphs[paraId] = {};
    if (text.length === 0) return false;

    let langName = "English";
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
      const isoCode = window.Asc.plugin.info.lang
        .split(/[-_]/)[0]
        .toLowerCase();
      langName = displayNames.of(isoCode) ?? "English";
    } catch (_e) {
      langName = "English";
    }

    const argPrompt = `You are a grammar correction tool that analyzes text for punctuation and style issues only. You will receive text to analyze and must respond with corrections in a specific JSON format.

CRITICAL REQUIREMENT - READ CAREFULLY:
The "sentence" field in your JSON response MUST contain the EXACT text from the original input with NO changes whatsoever - not even fixing capitalization, punctuation, or anything else. Copy it character-by-character exactly as it appears in the original. Only the "suggestion" field should contain corrections.

Your task is to:
- Check ONLY for punctuation errors (commas, periods, semicolons, colons, apostrophes, quotation marks, etc.) and style issues (sentence structure, word order, grammar, capitalization)
- Completely ignore spelling errors and typos. Do not mention them, do not flag them, do not include sentences just because they contain spelling errors. Pretend all words are spelled correctly.
- Return corrections in JSON format only

What counts as an error:
- Missing or incorrect punctuation (periods, commas, semicolons, etc.)
- Run-on sentences needing punctuation
- Incorrect sentence structure or word order
- Grammar issues (subject-verb agreement, tense consistency, etc.)
- Capitalization errors

What does NOT count as an error:
- Misspelled words or typos
- Missing letters in words
- Wrong letters in words

Response format - return ONLY this JSON array with no additional text:
[
  {
    "origin": "relevant snippet of text around the error",
    "suggestion": "the corrected version of that snippet",
    "description": "brief explanation of the punctuation or style issue",
    "difference":"difference between origin and suggestion"
    "occurrence": 1,
    "confidence": 0.95
  }
]

Guidelines for each field:
- "origin": VERY SHORT SNIPPET (3-8 words) of EXACT UNCHANGED original text around the error. Do not fix anything in this field.
- "suggestion": The corrected version of that same snippet
- "difference":  The difference between origin and suggestion in html format: the differences wrapped with <strong> tag
- "description": Brief explanation of the punctuation or style issue
- "occurrence": Which occurrence of this sentence if it appears multiple times (1 for first, 2 for second, etc.)
- "confidence": Value between 0 and 1 indicating certainty (1.0 = completely certain, 0.5 = uncertain)

Only include sentences that have punctuation or style errors - skip sentences with no errors.

If no errors are found in the entire text, return an empty array: []

IMPORTANT LANGUAGE RULE FOR "description" FIELD:
- The text inside "description" MUST be strictly in the ${langName} language. Output in any other language is invalid.
- Never add translations
- Never switch language
- If you are unsure, still respond in the ${langName} language.

Examples:

Input: "She dont like apples Me and him goes to school however they enjoy learning. Its a beautiful day"
Output:
[
  {
    "origin": "apples Me and him",
    "suggestion": "apples. Me and him",
    "difference": "apples<strong>.</strong> Me and him"
    "description": "Missing period between sentences",
    "occurrence": 1,
    "confidence": 1.0
  },
  {
    "origin": "school however they",
    "suggestion": "school; however, they",
    "difference": "school<strong>;</strong> however<strong>,</strong> they"
    "description": "Incorrect punctuation with 'however' - should use semicolon before and comma after",
    "occurrence": 1,
    "confidence": 0.95
  },
  {
    "origin": "beautiful day",
    "suggestion": "beautiful day.",
    "difference": "beautiful day<strong>.</strong>",
    "description": "Missing period at end of sentence",
    "occurrence": 1,
    "confidence": 1.0
  }
]

Input: "The sun is shining. however, it might rain later."
Output:
[
  {
    "origin": "shining. however, it",
    "suggestion": "shining. However, it",
    "difference": "shining. <strong>H</strong>owever, it",
    "description": "Sentence should start with a capital letter",
    "occurrence": 1,
    "confidence": 1.0
  }
]

CRITICAL - Output Format:
- Return ONLY the raw JSON array, nothing else
- DO NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
- DO NOT include any explanatory text before or after the JSON
- DO NOT use escaped newlines (\\n) - return the JSON on a single line if possible
- The response should start with [ and end with ]

Text to check:${text}`;

    const response = await this.chatRequest(argPrompt);
    if (!response) return false;

    let rangeId = 1;
    const ranges: AnnotationRange[] = [];

    const convertToRanges = (
      t: string,
      corrections: GrammarCorrection[]
    ): void => {
      for (const {
        origin,
        suggestion,
        difference,
        description,
        occurrence,
        confidence,
      } of corrections) {
        if (origin === suggestion || confidence <= 0.7) continue;

        let count = 0;
        let searchStart = 0;

        while (searchStart < t.length) {
          const index = this.simpleGraphemeIndexOf(t, origin, searchStart);
          if (index === -1) break;

          count++;
          if (count === occurrence) {
            ranges.push({
              start: index,
              length: [...origin].length,
              id: rangeId,
            });
            this.paragraphs[paraId][rangeId] = {
              original: origin,
              suggestion,
              difference,
              description,
            } satisfies GrammarAnnotation;
            rangeId++;
            break;
          }
          searchStart = index + 1;
        }
      }
    };

    try {
      convertToRanges(text, JSON.parse(response) as GrammarCorrection[]);
      await editor.callMethod("AnnotateParagraph", [
        {
          type: "highlightText",
          paragraphId: paraId,
          name: "grammar",
          recalcId,
          ranges,
        },
      ]);
    } catch (_e) {
      return false;
    }

    return true;
  }

  protected getInfoForPopup(paraId: string, rangeId: number): PopupInfo {
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as GrammarAnnotation;
    return {
      suggested: annotation.difference ?? "",
      original: annotation.original ?? "",
      explanation: annotation.description,
    };
  }

  getAnnotationRangeObj(
    paraId: string,
    rangeId?: number
  ): Record<string, unknown> {
    return {
      paragraphId: paraId,
      rangeId,
      name: "grammar",
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as GrammarAnnotation;
    const text = annotation.suggestion;
    if (!text) return;

    await editor.callMethod("StartAction", ["GroupActions"]);

    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("SelectAnnotationRange", [range]);

    Asc.scope.text = text;
    await editor.callCommand(() => {
      Api.ReplaceTextSmart([Asc.scope.text]);
      Api.GetDocument().RemoveSelection();
    });

    await editor.callMethod("RemoveAnnotationRange", [range]);
    await editor.callMethod("EndAction", ["GroupActions"]);
    await editor.callMethod("FocusEditor");
  }

  protected async _handleNewRangePositions(
    range: unknown,
    paraId: string,
    text: string
  ): Promise<void> {
    const r = range as Record<string, unknown> | null;
    if (!r || r.name !== "grammar" || !this.paragraphs[paraId]) return;

    const rangeId = r.id as number;
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as GrammarAnnotation;
    if (!annotation?.original) return;

    const start = r.start as number;
    const len = r.length as number;

    if (annotation.original !== text.substring(start, start + len)) {
      await editor.callMethod("RemoveAnnotationRange", [
        this.getAnnotationRangeObj(paraId, rangeId),
      ]);
    }
  }
}

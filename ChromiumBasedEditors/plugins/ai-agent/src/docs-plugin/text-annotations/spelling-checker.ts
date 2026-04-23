import { editor } from "../library/editor";
import type { PopupInfo, TextAnnotationPopup } from "./annotation-popup";
import { TextAnnotator } from "./text-annotator";

interface SpellingCorrection {
  wrong: string;
  correct: string;
  occurrence: number;
}

interface SpellingAnnotation {
  original: string;
  suggested: string;
}

interface AnnotationRange {
  start: number;
  length: number;
  id: number;
}

export class SpellChecker extends TextAnnotator {
  constructor(annotatorPopup: TextAnnotationPopup) {
    super(annotatorPopup);
    this.type = 0;
  }

  protected async annotateParagraph(
    paraId: string,
    recalcId: string,
    text: string
  ): Promise<boolean | null> {
    this.paragraphs[paraId] = {};
    if (text.length === 0) return false;

    const argPrompt = `You are a spellcheck corrector. I will provide text that may contain spelling errors in any language. Your task is to identify ALL spelling mistakes and return ONLY the corrections in the following JSON format:

[
  {"wrong": "misspelledWord", "correct": "correctWord", "occurrence": 1, "confidence": "high"},
  ...
]

Rules:
- "wrong": the exact misspelled word as it appears in the text
- "correct": the correctly spelled replacement
- "occurrence": which occurrence of this word if it appears multiple times (1 for first, 2 for second, etc.)
- "confidence": how certain you are this is a misspelling
  * "high" - definitely misspelled, no valid alternative meaning
  * "medium" - likely misspelled in this context, but could be valid elsewhere
  * "low" - uncertain, highly context-dependent
- Return an empty array [] if there are no errors
- Return an empty array [] if the text is completely unintelligible or a complete mess
- Support multiple languages (English, Russian, etc.)

CRITICAL
- Ouput should be in the exact this format
- No any comments are allowed

CRITICAL - Word Boundaries (MOST IMPORTANT):
- ONLY match complete, standalone words separated by spaces, punctuation, or at the start/end of text
- DO NOT match letters or substrings that are PART of other words
- A word is bounded by: spaces, punctuation (.,!?;:), quotes, or start/end of text
- Examples of what NOT to match:
  * "r" in "letter" - NO! "r" is part of the word "letter"
  * "r" in "great" - NO! "r" is part of the word "great"
  * "te" in "letter" - NO! "te" is part of the word "letter"
- Examples of what TO match:
  * "r" in "r u sure" - YES! "r" is a standalone word
  * "te" in "What te problem" - YES! "te" is a standalone word

CRITICAL - Handling same word with different meanings:
If the same word appears multiple times but only some occurrences are misspelled:
- ONLY include the misspelled occurrences
- Use the "occurrence" number to specify which instance

Example showing word boundaries:
Input: "The letter r. r u sure about it?"
Explanation:
- "letter" - correct word, don't touch it
- "r." - this is the standalone letter r
- "r u" - this "r" is a standalone word (misspelled, should be "are")
Output: [
  {"wrong": "r", "correct": "are", "occurrence": 2, "confidence": "medium"},
  {"wrong": "u", "correct": "you", "occurrence": 1, "confidence": "medium"}
]
Note: The first standalone "r" (after "letter") is correct. The second standalone "r" (in "r u") is misspelled.

Example with substring trap:
Input: "Great! r u coming?"
Output: [
  {"wrong": "r", "correct": "are", "occurrence": 1, "confidence": "medium"},
  {"wrong": "u", "correct": "you", "occurrence": 1, "confidence": "medium"}
]
Note: The "r" in "Great" is NOT matched because it's part of the word "Great", not a standalone word.

CRITICAL - Completeness:
- Find and include EVERY misspelled standalone word in the text
- If the same misspelled word appears multiple times, create separate entries
- Single-letter standalone words can be misspellings (e.g., standalone "r" → "are", standalone "u" → "you")

CRITICAL - What NOT to include:
- DO NOT include letters or substrings within other words
- DO NOT include entries where "wrong" and "correct" are identical
- ONLY include actual spelling mistakes that are standalone words

CRITICAL - Output Format:
- Return ONLY the raw JSON array, nothing else
- DO NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
- DO NOT include any explanatory text before or after the JSON
- DO NOT use escaped newlines (\\n) - return the JSON on a single line if possible
- The response should start with [ and end with ]

Correct output format:
[{"wrong": "Hlo", "correct": "Hello", "occurrence": 1, "confidence": "high"}]

Incorrect output formats (DO NOT USE):
\`\`\`json
[{"wrong": "Hlo", "correct": "Hello"}]
\`\`\`

Example (no errors):
Input: "The quick brown fox jumps over the lazy dog."
Output: []
Text to check:${text}`;

    const response = await this.chatRequest(argPrompt);
    if (!response) return false;

    let rangeId = 1;
    const ranges: AnnotationRange[] = [];

    const convertToRanges = (
      t: string,
      corrections: SpellingCorrection[]
    ): void => {
      for (const { wrong, correct, occurrence } of corrections) {
        if (wrong === correct) continue;

        let count = 0;
        let searchStart = 0;

        while (searchStart < t.length) {
          const index = this.simpleGraphemeIndexOf(t, wrong, searchStart);
          if (index === -1) break;

          const isStartBoundary =
            index === 0 || this._isWordBoundary(t[index - 1]);
          const isEndBoundary =
            index + wrong.length === t.length ||
            this._isWordBoundary(t[index + wrong.length]);

          if (isStartBoundary && isEndBoundary) {
            count++;
            if (count === occurrence) {
              ranges.push({
                start: index,
                length: [...wrong].length,
                id: rangeId,
              });
              this.paragraphs[paraId][rangeId] = {
                suggested: correct,
                original: wrong,
              } satisfies SpellingAnnotation;
              rangeId++;
              break;
            }
          }
          searchStart = index + 1;
        }
      }
    };

    try {
      convertToRanges(text, JSON.parse(response) as SpellingCorrection[]);
      await editor.callMethod("AnnotateParagraph", [
        {
          type: "highlightText",
          paragraphId: paraId,
          name: "spelling",
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
    ) as unknown as SpellingAnnotation;
    return {
      suggested: annotation.suggested ?? "",
      original: annotation.original ?? "",
    };
  }

  getAnnotationRangeObj(
    paraId: string,
    rangeId?: number
  ): Record<string, unknown> {
    return {
      paragraphId: paraId,
      rangeId,
      name: "spelling",
    };
  }

  override async onAccept(paraId: string, rangeId: number): Promise<void> {
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as SpellingAnnotation;
    if (!annotation?.suggested) return;

    const range = this.getAnnotationRangeObj(paraId, rangeId);
    await editor.callMethod("StartAction", ["GroupActions"]);
    await editor.callMethod("SelectAnnotationRange", [range]);

    Asc.scope.text = annotation.suggested;
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
    if (!r || r.name !== "spelling" || !this.paragraphs[paraId]) return;

    const rangeId = r.id as number;
    const annotation = this.getAnnotation(
      paraId,
      rangeId
    ) as unknown as SpellingAnnotation;
    if (!annotation?.original) return;

    const start = r.start as number;
    const len = r.length as number;

    const isStartBoundary =
      start === 0 || this._isWordBoundary(text[start - 1]);
    const isEndBoundary =
      start + len === text.length || this._isWordBoundary(text[start + len]);

    if (
      !isStartBoundary ||
      !isEndBoundary ||
      annotation.original !== text.substring(start, start + len)
    ) {
      await editor.callMethod("RemoveAnnotationRange", [
        this.getAnnotationRangeObj(paraId, rangeId),
      ]);
    }
  }

  private _isWordBoundary(char: string): boolean {
    return /[\s.,!?;:'"()[\]{}\-–—/\\]/.test(char);
  }
}

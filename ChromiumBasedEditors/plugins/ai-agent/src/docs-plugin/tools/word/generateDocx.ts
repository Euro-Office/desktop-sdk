import { defineTool } from "../lib/defineTool";
import { MarkDownStreamer } from "../lib/MarkDownStreamer";
import { requireString } from "../lib/validation";

const INSTRUCTIONS = `Generate the document **preferably** in Markdown (.md) format.
Output only the final result — no introductions, explanations, or phrases like "Here's the text" or "The result is".
The document MUST be written in pure Markdown.
Absolutely forbidden:
- HTML tags (e.g., <p>, <div>, <span>, <h1>, <img>, <br>)
- HTML attributes (e.g., align="center", style="...")
- Embedded CSS
- Raw HTML blocks of any kind
Emoji MUST NOT be wrapped in HTML containers.
If you cannot decorate or center text without HTML, do NOT decorate or center it at all.
If possible, provide the output in valid Markdown (.md) format, but do not wrap it in \`\`\`markdown\`\`\` or any other code block.
`;

export const generateDocx = defineTool({
  name: "generateDocx",
  description:
    "Use this function if you are asked to generate a textual document (report, article, letter, etc.) based on a description. Input: Short description of what needs to be generated.",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Short description of the document to generate.",
      },
    },
    required: ["description"],
  },
  handler: async (params) => {
    const description = requireString(params, "description");
    const fullPrompt = `${INSTRUCTIONS}\nDescription:\n\n${description}`;

    if (!window.AI) return { isApply: false, reason: "AI not available" };
    const requestEngine = window.AI.Request.create(window.AI.ActionType.Chat);

    const streamer = new MarkDownStreamer(true);

    const result = await requestEngine.chatRequest(
      fullPrompt,
      false,
      async (delta, isFinal) => {
        await streamer.onStreamChunk(delta, isFinal);
      }
    );
    if (!result) return { isApply: false, reason: "Empty AI response" };

    return { isApply: true };
  },
});

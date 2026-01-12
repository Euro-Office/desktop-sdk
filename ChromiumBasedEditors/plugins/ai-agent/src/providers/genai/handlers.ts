import type {
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { GenerateContentResponse } from "@google/genai";

/**
 * Handles incoming text content from a GenAI response.
 */
export const handleThoughtContent = (
  responseMessage: ThreadMessageLike,
  text: string
): ThreadMessageLike => {
  if (!text) return responseMessage;

  const content = responseMessage.content;
  if (typeof content === "string") return responseMessage;

  const newContent = [...content];
  const lastPart = newContent[newContent.length - 1];

  // Last part is text - append to it
  if (lastPart?.type === "reasoning") {
    newContent[newContent.length - 1] = {
      ...lastPart,
      text: lastPart.text + text,
    };
  }
  // No content yet or last part is tool-call - add new text part
  else {
    newContent.push({ type: "reasoning", text });
  }

  return { ...responseMessage, content: newContent };
};

/**
 * Handles incoming text content from a GenAI response.
 */
export const handleTextContent = (
  responseMessage: ThreadMessageLike,
  text: string
): ThreadMessageLike => {
  if (!text) return responseMessage;

  const content = responseMessage.content;
  if (typeof content === "string") return responseMessage;

  const newContent = [...content];
  const lastPart = newContent[newContent.length - 1];

  // Last part is text - append to it
  if (lastPart?.type === "text") {
    newContent[newContent.length - 1] = {
      ...lastPart,
      text: lastPart.text + text,
    };
  }
  // No content yet or last part is tool-call - add new text part
  else {
    newContent.push({ type: "text", text });
  }

  return { ...responseMessage, content: newContent };
};

/**
 * Handles incoming function call from a GenAI response.
 */
export const handleFunctionCall = (
  responseMessage: ThreadMessageLike,
  functionCall: {
    name: string;
    args: Record<string, unknown>;
    thoughtSignature?: string;
  }
): ThreadMessageLike => {
  const content = responseMessage.content;
  if (typeof content === "string") return responseMessage;

  const newContent = [...content];

  const toolCallPart = {
    type: "tool-call",
    toolCallId: `${functionCall.name}_${Date.now()}`,
    toolName: functionCall.name,
    args: functionCall.args,
    argsText: JSON.stringify(functionCall.args),
    // Store thought_signature for Gemini 3 models
    ...(functionCall.thoughtSignature && {
      metadata: { thoughtSignature: functionCall.thoughtSignature },
    }),
  } as ToolCallMessagePart;

  newContent.push(toolCallPart);

  return { ...responseMessage, content: newContent };
};

/**
 * Processes a GenAI response chunk and updates the response message.
 */
export const processGenAIResponse = (
  responseMessage: ThreadMessageLike,
  response: GenerateContentResponse
): ThreadMessageLike => {
  let result = responseMessage;

  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return result;

  for (const part of candidate.content.parts) {
    if (part.thought) {
      result = handleThoughtContent(result, part.text ?? "");
    }
    if (part.text) {
      result = handleTextContent(result, part.text);
    }

    if (part.functionCall) {
      result = handleFunctionCall(result, {
        name: part.functionCall.name ?? "",
        args: (part.functionCall.args as Record<string, unknown>) ?? {},
        thoughtSignature: (part as unknown as { thoughtSignature?: string })
          .thoughtSignature,
      });
    }
  }

  return result;
};

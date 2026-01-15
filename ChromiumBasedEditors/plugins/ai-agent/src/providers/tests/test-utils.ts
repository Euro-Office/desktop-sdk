/**
 * Shared test utilities for provider tests.
 * Reduces duplication across provider test files.
 */
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { vi } from "vitest";

// ============================================================================
// Stream Mock Utilities
// ============================================================================

/**
 * Creates a mock async generator from an array of items.
 */
export async function* createAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/**
 * Creates a mock stream controller with abort function.
 */
export const createMockController = () => ({
  abort: vi.fn(),
});

/**
 * Creates a mock stream for OpenAI-compatible providers.
 * Works with openai, lm-studio, ollama, together, deepseek, xai, openrouter.
 */
export const createMockStream = <T>(events: T[]) => {
  const controller = createMockController();

  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }

  return Object.assign(generator(), { controller });
};

/**
 * Creates a mock stream using Symbol.asyncIterator pattern.
 * Used by some providers like lm-studio.
 */
export const createMockStreamWithIterator = <T>(events: T[]) => {
  const controller = createMockController();

  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
    controller,
  };
};

// ============================================================================
// OpenAI Chunk Factories
// ============================================================================

/**
 * Creates a base ChatCompletionChunk with default values.
 */
export const createBaseChunk = (
  overrides?: Partial<ChatCompletionChunk>
): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [],
    ...overrides,
  }) as ChatCompletionChunk;

/**
 * Creates a text delta chunk for streaming.
 */
export const createTextDeltaChunk = (
  content: string,
  finishReason: string | null = null
): ChatCompletionChunk =>
  createBaseChunk({
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  } as Partial<ChatCompletionChunk>);

/**
 * Creates a tool call chunk for streaming.
 */
export const createToolCallChunk = (
  toolCallId: string,
  toolName: string,
  args: string
): ChatCompletionChunk =>
  createBaseChunk({
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: toolCallId,
              type: "function",
              function: { name: toolName, arguments: args },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  } as Partial<ChatCompletionChunk>);

/**
 * Creates a finish chunk to end the stream.
 */
export const createFinishChunk = (): ChatCompletionChunk =>
  createBaseChunk({
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  } as Partial<ChatCompletionChunk>);

/**
 * Creates a simple text chunk (shorthand for providers).
 */
export const createTextChunk = (content: string, finished = false) => ({
  choices: [
    {
      delta: { content },
      finish_reason: finished ? "stop" : null,
    },
  ],
});

/**
 * Creates a reasoning content chunk (for DeepSeek-style providers).
 */
export const createReasoningChunk = (
  reasoningContent: string
): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        delta: { reasoning_content: reasoningContent },
        finish_reason: null,
      },
    ],
  }) as unknown as ChatCompletionChunk;

// ============================================================================
// Message Factories
// ============================================================================

/**
 * Creates an empty assistant message.
 */
export const createEmptyMessage = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/**
 * Creates a ThreadMessageLike with specified role and content.
 */
export const createMessage = (
  role: "user" | "assistant" | "system",
  content: ThreadMessageLike["content"]
): ThreadMessageLike => ({
  role,
  content,
});

/**
 * Creates a tool call content part.
 */
export const createToolCallPart = (overrides?: {
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  argsText?: string;
  result?: unknown;
}) => ({
  type: "tool-call" as const,
  toolCallId: overrides?.toolCallId ?? "call_123",
  toolName: overrides?.toolName ?? "test_tool",
  args: overrides?.args ?? {},
  argsText: overrides?.argsText ?? "{}",
  ...(overrides?.result !== undefined && { result: overrides.result }),
});

/**
 * Creates a text content part.
 */
export const createTextPart = (text: string) => ({
  type: "text" as const,
  text,
});

/**
 * Creates a reasoning content part.
 */
export const createReasoningPart = (text: string, parentId?: string) => ({
  type: "reasoning" as const,
  text,
  ...(parentId && { parentId }),
});

// ============================================================================
// Provider Test Data Factories
// ============================================================================

/**
 * Creates a test provider configuration.
 */
export const createTestProvider = (
  type: string,
  overrides?: {
    name?: string;
    key?: string;
    baseUrl?: string;
  }
) => ({
  type: type as "openai" | "anthropic" | "genai",
  name: overrides?.name ?? type,
  key: overrides?.key ?? "test-key",
  baseUrl: overrides?.baseUrl ?? `https://api.${type}.com/v1`,
});

// ============================================================================
// Mock Reset Utilities
// ============================================================================

/**
 * Creates a function to reset multiple mocks at once.
 */
export const createMockResetFn = (
  ...mocks: ReturnType<typeof vi.fn>[]
): (() => void) => {
  return () => {
    vi.clearAllMocks();
    mocks.forEach((mock) => {
      mock.mockReset();
    });
  };
};

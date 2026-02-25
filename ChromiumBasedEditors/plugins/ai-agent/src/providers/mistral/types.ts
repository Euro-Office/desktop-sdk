import type { ThreadMessageLike } from "@assistant-ui/react";

export type StreamResult =
  | ThreadMessageLike
  | { isEnd: true; responseMessage: ThreadMessageLike };

export type MessageArray = Exclude<ThreadMessageLike["content"], string>;
export type ToolCallElement = MessageArray extends ReadonlyArray<infer T>
  ? T
  : never;
export type ToolCallPart = Extract<ToolCallElement, { type: "tool-call" }>;

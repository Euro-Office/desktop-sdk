import type { ThreadMessageLike } from "@assistant-ui/react";

export type StreamResult =
  | ThreadMessageLike
  | { isEnd: true; responseMessage: ThreadMessageLike };

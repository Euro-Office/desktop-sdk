import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "../types";
import { AbstractBaseProvider, type TData, type TErrorData } from "./base";

/**
 * No-op provider used as default when no real provider is configured.
 * Eliminates null checks throughout the Provider facade class.
 */
export class NullProvider extends AbstractBaseProvider<unknown, unknown, unknown> {
  // Override inherited setters to prevent mutation of shared instance
  override setModelKey(_modelKey: string): void {}
  override setSystemPrompt(_systemPrompt: string): void {}
  override setApiKey(_apiKey: string): void {}
  override setUrl(_url: string): void {}
  override stopMessage(): void {}
  setProvider(_provider: TProvider): void {}

  setPrevMessages(_prevMessages: ThreadMessageLike[]): void {}

  setTools(_tools: TMCPItem[]): void {}

  async createChatName(_message: string): Promise<string> {
    return "";
  }

  async *sendMessage(
    _messages: ThreadMessageLike[]
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // No-op: yields nothing
  }

  async *sendMessageAfterToolCall(
    _message: ThreadMessageLike
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // No-op: yields nothing
  }

  getName(): string {
    return "";
  }

  getBaseUrl(): string {
    return "";
  }

  async checkProvider(_data: TData): Promise<boolean | TErrorData> {
    return false;
  }

  async getProviderModels(_data: TData): Promise<Model[]> {
    return [];
  }

  isSupportStreaming(): boolean {
    return false;
  }
}

export const nullProvider = new NullProvider();

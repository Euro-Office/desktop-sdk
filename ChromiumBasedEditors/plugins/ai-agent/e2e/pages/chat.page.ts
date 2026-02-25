import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Chat Page Object - interactions on the chat page
 */
export class ChatPage extends BasePage {
  readonly composerInput: Locator;
  readonly sendButton: Locator;
  readonly userMessages: Locator;
  readonly assistantMessages: Locator;
  readonly emptyScreen: Locator;

  constructor(page: Page) {
    super(page);
    this.composerInput = page.getByTestId('composer-input');
    this.sendButton = page.getByTestId('send-button');
    this.userMessages = page.locator('[data-role="user"], [data-message-role="user"]');
    this.assistantMessages = page.locator('[data-role="assistant"], [data-message-role="assistant"]');
    this.emptyScreen = page.getByRole('heading', { name: /connect.*model.*get started/i });
  }

  async sendMessage(message: string) {
    await this.composerInput.fill(message);
    await this.sendButton.click();
  }

  async typeMessage(message: string) {
    await this.composerInput.fill(message);
  }

  async getMessageCount(): Promise<number> {
    const userCount = await this.userMessages.count();
    const assistantCount = await this.assistantMessages.count();
    return userCount + assistantCount;
  }
}

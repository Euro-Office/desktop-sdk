import { Page, Locator } from '@playwright/test';

/**
 * Base Page Object - common elements shared across all pages
 */
export class BasePage {
  readonly page: Page;
  readonly newChatButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newChatButton = page.getByTestId('new-chat-button');
    this.settingsButton = page.getByTestId('settings-button');
  }

  async goToSettings() {
    await this.settingsButton.click();
  }

  async goToChat() {
    await this.settingsButton.click();
  }

  async createNewChat() {
    await this.newChatButton.click();
  }
}

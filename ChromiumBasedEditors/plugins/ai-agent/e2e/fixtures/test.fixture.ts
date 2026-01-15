import { test as base, Page } from '@playwright/test';
import { ChatPage } from '../pages/chat.page';
import { SettingsPage } from '../pages/settings.page';
import { clearAllStorage, setProviders, setCurrentModel } from '../utils/storage';
import { mockDesktopEditor } from '../utils/helpers';
import { testProviders, testModels, defaultTestProvider, testProvider } from './test-data';
import { mockModelsResponse } from './mock-responses';

/**
 * Extended test fixture with common setup
 */
export const test = base.extend<{
  chatPage: ChatPage;
  settingsPage: SettingsPage;
}>({
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

/**
 * Mock models API endpoints
 */
export async function mockModelsAPI(page: Page) {
  await page.route('**/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockModelsResponse }),
    });
  });

  await page.route('**/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockModelsResponse }),
    });
  });
}

/**
 * Setup page with provider and model configured
 */
export async function setupWithProvider(page: Page) {
  await mockModelsAPI(page);
  await setProviders(page, [testProviders.openai]);
  await setCurrentModel(page, testModels.openai[0]);
  await mockDesktopEditor(page);
  await page.reload();
}

// Re-export test data for convenience
export { defaultTestProvider, testProvider };

/**
 * Open settings dialog
 */
export async function openSettings(page: Page) {
  await page.getByRole('button', { name: /settings/i }).first().click();
}

/**
 * Mock models API and open settings dialog
 */
export async function openSettingsWithMock(page: Page) {
  await mockModelsAPI(page);
  await openSettings(page);
}

/**
 * Setup settings page with a provider added via UI
 * Use this when tests need to interact with settings after adding a provider
 */
export async function setupSettingsWithProvider(page: Page, settingsPage: SettingsPage) {
  await openSettingsWithMock(page);
  await settingsPage.addProvider(defaultTestProvider);
}

/**
 * Setup settings with provider and navigate to MCP Servers tab
 */
export async function setupMCPServersTab(page: Page, settingsPage: SettingsPage) {
  await setupSettingsWithProvider(page, settingsPage);
  await settingsPage.goToMCPServersTab();
}

/**
 * Setup settings with provider and navigate to Web Search tab
 */
export async function setupWebSearchTab(page: Page, settingsPage: SettingsPage) {
  await setupSettingsWithProvider(page, settingsPage);
  await settingsPage.goToWebSearchTab();
}

/**
 * Open settings and open the Add Provider dialog
 */
export async function openAddProviderDialog(page: Page, settingsPage: SettingsPage) {
  await openSettings(page);
  await settingsPage.providers.addButton.click();
  await settingsPage.dialog.waitFor({ state: 'visible' });
}

/**
 * Open settings with mock and open the Add Provider dialog
 */
export async function openAddProviderDialogWithMock(page: Page, settingsPage: SettingsPage) {
  await openSettingsWithMock(page);
  await settingsPage.providers.addButton.click();
  await settingsPage.dialog.waitFor({ state: 'visible' });
}

/**
 * Common beforeEach setup
 */
export async function commonSetup(page: Page) {
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR:', msg.text());
    }
  });

  await mockDesktopEditor(page);
  await page.goto('/');
  await clearAllStorage(page);
}

export { expect } from '@playwright/test';

import { test, expect, commonSetup, setupWithProvider, mockModelsAPI } from '../fixtures/test.fixture';
import { mockValidationSuccess } from '../fixtures/mock-responses';

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test('should load the application', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Agent|ONLYOFFICE/i);
  });

  test('should show empty screen when no providers configured', async ({ chatPage, page }) => {
    await expect(chatPage.emptyScreen).toBeVisible();
    await expect(page.getByRole('button', { name: /connect.*model/i })).toBeVisible();
    await expect(page.getByText(/no ai model is connected yet/i)).toBeVisible();
  });

  test('should navigate to settings from empty screen', async ({ page, settingsPage }) => {
    await page.getByRole('button', { name: /connect.*model|settings/i }).first().click();
    await expect(settingsPage.addProviderButton).toBeVisible();
  });

  test('should show chat interface with configured provider', async ({ page, chatPage }) => {
    await setupWithProvider(page);

    await expect(chatPage.composerInput).toBeVisible();
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.composerInput).toBeEnabled();
  });

  test('should have working navigation', async ({ page, chatPage, settingsPage }) => {
    await setupWithProvider(page);

    await expect(chatPage.composerInput).toBeVisible();
    await chatPage.goToSettings();
    await expect(settingsPage.addProviderButton).toBeVisible();
    await settingsPage.goToChat();
    await expect(chatPage.composerInput).toBeVisible();
  });

  test('should persist provider configuration', async ({ page, settingsPage }) => {
    await mockModelsAPI(page);

    await page.getByRole('button', { name: /settings/i }).first().click();

    await settingsPage.addProvider({
      name: 'Smoke Test Provider',
      type: 'openai',
      apiKey: 'sk-test-12345',
      baseUrl: 'https://api.openai.com/v1',
    });

    await expect(page.getByText('Smoke Test Provider')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByText('Smoke Test Provider')).toBeVisible();
  });

  test('should create new chat', async ({ page, chatPage }) => {
    await setupWithProvider(page);

    await chatPage.createNewChat();
    const messageCount = await chatPage.getMessageCount();
    expect(messageCount).toBe(0);
  });

  test('should have functional composer', async ({ page, chatPage }) => {
    await setupWithProvider(page);

    await chatPage.typeMessage('Test message');
    await expect(chatPage.composerInput).toHaveValue('Test message');

    await chatPage.composerInput.clear();
    await expect(chatPage.composerInput).toHaveValue('');
  });
});

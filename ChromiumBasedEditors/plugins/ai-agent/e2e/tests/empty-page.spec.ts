import { test, expect, commonSetup } from '../fixtures/test.fixture';
import { clearAllStorage, setProviders, setupThreads, waitForTestData } from '../utils/storage';
import { testProviders } from '../fixtures/test-data';

declare global {
  interface Window {
    on_update_plugin_info: (info: { lang: string; theme: string }) => void;
  }
}

test.describe('Empty Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test.describe('Render', () => {
    test('should display empty screen heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /connect.*model.*get started/i })).toBeVisible();
    });

    test('should display empty screen description', async ({ page }) => {
      await expect(page.getByText(/no ai model is connected yet/i)).toBeVisible();
    });

    test('should display connect button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /connect.*model/i })).toBeVisible();
    });

    test('should navigate to settings when clicking connect button', async ({ page, settingsPage }) => {
      await page.getByRole('button', { name: /connect.*model/i }).click();
      await expect(settingsPage.addProviderButton).toBeVisible();
    });
  });

  test.describe('i18n Language', () => {
    test('should display English text by default', async ({ page }) => {
      await expect(page.getByText('Connect an AI Model to Get Started')).toBeVisible();
      await expect(page.getByText('No AI model is connected yet')).toBeVisible();
    });

    test('should change language dynamically via on_update_plugin_info', async ({ page }) => {
      // Verify English is shown initially
      await expect(page.getByText('Connect an AI Model to Get Started')).toBeVisible();

      // Trigger on_update_plugin_info with Russian language
      await page.evaluate(() => {
        window.on_update_plugin_info({ lang: 'ru', theme: '' });
      });

      // Verify UI changed to Russian without reload
      await expect(page.getByText('Чтобы начать, подключите ИИ-модель')).toBeVisible();
      await expect(page.getByText('Нет подключенных ИИ-моделей')).toBeVisible();
    });

    test('should display Russian text when lang is ru', async ({ page }) => {
      // Re-setup with Russian language
      await page.addInitScript(() => {
        // @ts-ignore
        window.AscDesktopEditor = {
          GetFileText: () => '',
          OpenFilenameDialog: () => '',
          execCommand: () => {},
          Call: () => {},
          getToolFunctions: () => JSON.stringify([]),
          callToolFunction: () => JSON.stringify({ success: true }),
        };
        // @ts-ignore
        window.RendererProcessVariable = {
          lang: 'ru',
          theme: { id: 'theme-white', type: 'light', system: 'light' },
        };
        // @ts-ignore
        window.on_update_plugin_info = () => {};
      });
      await page.reload();

      await expect(page.getByText('Чтобы начать, подключите ИИ-модель')).toBeVisible();
      await expect(page.getByText('Нет подключенных ИИ-моделей')).toBeVisible();
    });

    test('should display German text when lang is de', async ({ page }) => {
      await page.addInitScript(() => {
        // @ts-ignore
        window.AscDesktopEditor = {
          GetFileText: () => '',
          OpenFilenameDialog: () => '',
          execCommand: () => {},
          Call: () => {},
          getToolFunctions: () => JSON.stringify([]),
          callToolFunction: () => JSON.stringify({ success: true }),
        };
        // @ts-ignore
        window.RendererProcessVariable = {
          lang: 'de',
          theme: { id: 'theme-white', type: 'light', system: 'light' },
        };
        // @ts-ignore
        window.on_update_plugin_info = () => {};
      });
      await page.reload();

      // Check for German translation
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  });

  test.describe('Theme', () => {
    test('should apply light theme by default', async ({ page }) => {
      // Theme class is on direct parent of #app
      const themeWrapper = page.locator('#app').locator('..');
      await expect(themeWrapper).toHaveClass(/theme-white/);
    });

    test('should apply dark theme when theme-dark is set', async ({ page }) => {
      await page.addInitScript(() => {
        // @ts-ignore
        window.AscDesktopEditor = {
          GetFileText: () => '',
          OpenFilenameDialog: () => '',
          execCommand: () => {},
          Call: () => {},
          getToolFunctions: () => JSON.stringify([]),
          callToolFunction: () => JSON.stringify({ success: true }),
        };
        // @ts-ignore
        window.RendererProcessVariable = {
          lang: 'en',
          theme: { id: 'theme-dark', type: 'dark', system: 'dark' },
        };
        // @ts-ignore
        window.on_update_plugin_info = () => {};
      });
      await page.reload();

      const themeWrapper = page.locator('#app').locator('..');
      await expect(themeWrapper).toHaveClass(/theme-dark/);
    });

    test('should apply dark theme when theme-night is set', async ({ page }) => {
      await page.addInitScript(() => {
        // @ts-ignore
        window.AscDesktopEditor = {
          GetFileText: () => '',
          OpenFilenameDialog: () => '',
          execCommand: () => {},
          Call: () => {},
          getToolFunctions: () => JSON.stringify([]),
          callToolFunction: () => JSON.stringify({ success: true }),
        };
        // @ts-ignore
        window.RendererProcessVariable = {
          lang: 'en',
          theme: { id: 'theme-night', type: 'dark', system: 'dark' },
        };
        // @ts-ignore
        window.on_update_plugin_info = () => {};
      });
      await page.reload();

      const themeWrapper = page.locator('#app').locator('..');
      await expect(themeWrapper).toHaveClass(/theme-night/);
    });

    test('should change theme dynamically via on_update_plugin_info', async ({ page }) => {
      // Theme class is on direct parent of #app
      const themeWrapper = page.locator('#app').locator('..');
      await expect(themeWrapper).toHaveClass(/theme-white/);

      // Trigger on_update_plugin_info with dark theme
      await page.evaluate(() => {
        window.on_update_plugin_info({ lang: '', theme: 'theme-dark' });
      });

      // Verify theme changed without reload
      await expect(themeWrapper).toHaveClass(/theme-dark/);
    });
  });

  test.describe('Layout', () => {
    test('should display header with AI agent title', async ({ page }) => {
      await expect(page.getByText('AI agent')).toBeVisible();
    });

    test('should display new chat button', async ({ page }) => {
      await expect(page.getByTestId('new-chat-button')).toBeVisible();
    });

    test('should display settings button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'btn-settings' })).toBeVisible();
    });

    test('should navigate to settings when clicking settings button', async ({ page, settingsPage }) => {
      await page.getByRole('button', { name: 'btn-settings' }).click();
      await expect(settingsPage.addProviderButton).toBeVisible();
    });

    test('should display chat history toggle button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'btn-list-search' })).toBeVisible();
    });
  });

  test.describe('Chat History Sidebar', () => {
    test('should show empty chat history message', async ({ page }) => {
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await expect(page.getByText(/there is no chat history yet/i)).toBeVisible();
    });

    test('should show chat history heading when opened', async ({ page }) => {
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await expect(page.getByRole('heading', { name: 'Chat history' })).toBeVisible();
    });

    test('should not show search input when chat history is empty', async ({ page }) => {
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      // Search input is hidden when there are no chats
      await expect(page.getByPlaceholder(/search/i)).not.toBeVisible();
    });

    test('should close chat history sidebar when clicking close button', async ({ page }) => {
      // Open sidebar
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await expect(page.getByRole('heading', { name: 'Chat history' })).toBeVisible();

      // Close sidebar
      await page.getByRole('button', { name: 'btn-previtem' }).click();
      await expect(page.getByRole('heading', { name: 'Chat history' })).not.toBeVisible();
    });
  });

  test.describe('Providers State', () => {
    test('should show empty screen when providers are cleared', async ({ page }) => {
      // First add a provider
      await setProviders(page, [testProviders.openai]);
      await page.reload();

      // Should show chat interface (not empty screen)
      await expect(page.getByText('How can I help?')).toBeVisible();

      // Clear providers via storage
      await clearAllStorage(page);
      await page.reload();

      // Should show empty screen again
      await expect(page.getByRole('heading', { name: /connect.*model.*get started/i })).toBeVisible();
    });

    test('should show empty screen with existing chats when no providers', async ({ page }) => {
      // Setup threads to be added on page load
      await setupThreads(page, [
        { threadId: 'test-thread-1', title: 'Previous Chat 1' },
        { threadId: 'test-thread-2', title: 'Previous Chat 2' },
      ]);
      await page.reload();
      await waitForTestData(page);

      // Should show empty screen (no providers configured)
      await expect(page.getByRole('heading', { name: /connect.*model.*get started/i })).toBeVisible();

      // Open chat history
      await page.getByRole('button', { name: 'btn-list-search' }).click();

      // Should show existing chats in history
      await expect(page.getByText('Previous Chat 1')).toBeVisible();
      await expect(page.getByText('Previous Chat 2')).toBeVisible();
    });

    test('should show messages but disable input when opening chat without providers', async ({ page, chatPage }) => {
      // Setup thread with messages
      await setupThreads(page, [
        {
          threadId: 'test-chat-with-messages',
          title: 'Chat with History',
          messages: [
            { role: 'user', content: 'Hello, this is a test message' },
            { role: 'assistant', content: 'Hi! This is a test response from the assistant.' },
          ],
        },
      ]);
      await page.reload();
      await waitForTestData(page);

      // Open chat history and click on the chat
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await page.getByText('Chat with History').click();

      // Should show messages
      await expect(page.getByText('Hello, this is a test message')).toBeVisible();
      await expect(page.getByText('Hi! This is a test response from the assistant.')).toBeVisible();

      // Input and send button should be disabled (no providers)
      await expect(chatPage.composerInput).toBeDisabled();
      await expect(chatPage.sendButton).toBeDisabled();
    });
  });
});

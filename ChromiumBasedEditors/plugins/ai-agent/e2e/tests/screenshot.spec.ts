import { test, expect, commonSetup, openSettings, openSettingsWithMock, setupSettingsWithProvider, setupMCPServersTab, setupWebSearchTab } from '../fixtures/test.fixture';
import { setupThreads, waitForTestData } from '../utils/storage';
import { testProvider } from '../fixtures/test-data';

test.describe('Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test.describe('Start Page', () => {
    test('empty state - no providers', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /connect.*model.*get started/i })).toBeVisible();
      await expect(page).toHaveScreenshot('start-page-empty.png', { fullPage: true });
    });

    test('with empty chat list sidebar', async ({ page }) => {
      // Open chat history sidebar
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await expect(page.getByText(/no chat history/i)).toBeVisible();
      await expect(page).toHaveScreenshot('start-page-empty-chat-list.png', { fullPage: true });
    });

    test('with chat list', async ({ page }) => {
      // Setup threads
      await setupThreads(page, [
        { threadId: 'thread-1', title: 'First Conversation' },
        { threadId: 'thread-2', title: 'Second Conversation' },
        { threadId: 'thread-3', title: 'Third Conversation' },
      ]);
      await page.reload();
      await waitForTestData(page);

      // Open chat history sidebar
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await expect(page.getByText('First Conversation')).toBeVisible();
      await expect(page).toHaveScreenshot('start-page-with-chat-list.png', { fullPage: true });
    });

    test('with chat messages', async ({ page }) => {
      // Setup thread with messages
      await setupThreads(page, [
        {
          threadId: 'chat-with-messages',
          title: 'Chat with History',
          messages: [
            { role: 'user', content: 'Hello, can you help me with a task?' },
            { role: 'assistant', content: 'Of course! I\'d be happy to help. What do you need assistance with?' },
          ],
        },
      ]);
      await page.reload();
      await waitForTestData(page);

      // Open chat and view messages
      await page.getByRole('button', { name: 'btn-list-search' }).click();
      await page.getByText('Chat with History').click();
      await expect(page.getByText('Hello, can you help me with a task?')).toBeVisible();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('start-page-with-messages.png', { fullPage: true });
    });
  });

  test.describe('Providers Page', () => {
    test('empty state', async ({ page }) => {
      await openSettings(page);
      await expect(page.getByText(/no providers configured|add.*provider/i)).toBeVisible();
      await expect(page).toHaveScreenshot('providers-empty.png', { fullPage: true });
    });

    test('with one provider', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);
      await expect(page.getByText('Test Provider')).toBeVisible();
      await expect(page).toHaveScreenshot('providers-with-one.png', { fullPage: true });
    });

    test('with multiple providers', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);
      await settingsPage.addProvider(testProvider('OpenAI Provider'));
      await settingsPage.addProvider(testProvider('Anthropic Provider'));
      await settingsPage.addProvider(testProvider('Local Provider'));
      await expect(page.getByText('OpenAI Provider')).toBeVisible();
      await expect(page).toHaveScreenshot('providers-with-multiple.png', { fullPage: true });
    });

    test('with error provider', async ({ page, settingsPage }) => {
      // Mock API to return empty models (causes error state)
      await page.route('**/models', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });
      await page.route('**/v1/models', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });

      await openSettings(page);
      await settingsPage.addProvider(testProvider('Error Provider'));
      await expect(settingsPage.providers.errorIcon).toBeVisible();
      await expect(page).toHaveScreenshot('providers-with-error.png', { fullPage: true });
    });

    test('with dropdown menu open', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);
      await settingsPage.providers.moreButton.click();
      await expect(settingsPage.providers.editMenuItem).toBeVisible();
      await expect(page).toHaveScreenshot('providers-dropdown-menu.png', { fullPage: true });
    });

    test('add provider dialog', async ({ page, settingsPage }) => {
      await openSettings(page);
      await settingsPage.providers.addButton.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });
      await expect(page).toHaveScreenshot('providers-add-dialog.png', { fullPage: true });
    });

    test('edit provider dialog', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);
      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });
      await expect(page).toHaveScreenshot('providers-edit-dialog.png', { fullPage: true });
    });

    test('delete provider dialog', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);
      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.deleteMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });
      await expect(page).toHaveScreenshot('providers-delete-dialog.png', { fullPage: true });
    });
  });

  test.describe('MCP Servers Page', () => {
    test('default state with desktop-editor', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await expect(page.getByText('desktop-editor')).toBeVisible();
      await expect(page).toHaveScreenshot('mcp-servers-default.png', { fullPage: true });
    });

    test('edit configuration dialog', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();
      await page.waitForTimeout(2000);
      await expect(page).toHaveScreenshot('mcp-servers-config-dialog.png', { fullPage: true });
    });

    test('with custom server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"custom-server":{"command":"test"}}}');
      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });
      await expect(page.getByText('custom-server')).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('mcp-servers-with-custom.png', { fullPage: true });
    });

    test('custom server initializing', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"custom-server":{"command":"test"}}}');
      await settingsPage.mcpConfigDialog.saveButton.click();
      // Screenshot after short delay to capture initializing state
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('mcp-servers-initializing.png', { fullPage: true });
    });

    test('custom server dropdown menu', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"custom-server":{"command":"test"}}}');
      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });
      await expect(page.getByText('custom-server')).toBeVisible();
      // Open dropdown menu for custom server
      await page.locator('div').filter({ hasText: /^custom-server/ }).getByRole('button', { name: 'more' }).click();
      await expect(settingsPage.mcpServerActions.logs).toBeVisible();
      await expect(page).toHaveScreenshot('mcp-servers-custom-dropdown.png', { fullPage: true });
    });

    test('expanded server with tools', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      // Click to expand desktop-editor server
      await page.getByText('desktop-editor').click();
      // Wait for tools to be visible
      await expect(page.getByText('file_content_reader')).toBeVisible();
      await expect(page).toHaveScreenshot('mcp-servers-expanded.png', { fullPage: true });
    });

    test('server menu open', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      // Open server menu
      await page.locator('div').filter({ hasText: /^desktop-editor/ }).getByRole('button', { name: 'more' }).click();
      await expect(settingsPage.mcpServerActions.enableAllTools).toBeVisible();
      await expect(page).toHaveScreenshot('mcp-servers-menu.png', { fullPage: true });
    });
  });

  test.describe('Web Search Page', () => {
    test('default state', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);
      await expect(page.getByText(/connect a web search engine/i)).toBeVisible();
      await expect(page).toHaveScreenshot('web-search-default.png', { fullPage: true });
    });

    test('with engine selected', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await expect(page.getByText(/exa/i)).toBeVisible();
      await expect(page).toHaveScreenshot('web-search-engine-selected.png', { fullPage: true });
    });

    test('with engine and api key filled', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key-123');
      // Save button should be enabled but not clicked yet
      await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();
      await expect(page).toHaveScreenshot('web-search-ready-to-save.png', { fullPage: true });
    });

    test('with configured engine', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);
      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key-123');
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
      await expect(page).toHaveScreenshot('web-search-configured.png', { fullPage: true });
    });

    test('dropdown open', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);
      await page.getByText(/select engine/i).click();
      await expect(page.getByRole('menuitem', { name: /exa/i })).toBeVisible();
      await expect(page).toHaveScreenshot('web-search-dropdown.png', { fullPage: true });
    });
  });
});

import { test, expect, commonSetup, openSettings, openSettingsWithMock, openAddProviderDialog, openAddProviderDialogWithMock, testProvider } from '../fixtures/test.fixture';

test.describe('Providers', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test.describe('Render', () => {
    test('should render empty providers state', async ({ page, settingsPage }) => {
      await openSettings(page);

      await expect(settingsPage.providers.addButton).toBeVisible();
      await expect(page.getByText(/no providers configured|add.*provider/i)).toBeVisible();
    });
  });

  test.describe('CRUD Operations', () => {
    test('should add a new provider', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Test Provider'));

      await expect(page.getByText('Test Provider')).toBeVisible();
    });

    test('should edit an existing provider', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider To Edit'));

      await expect(page.getByText('Provider To Edit')).toBeVisible();

      await settingsPage.editProvider({ name: 'Edited Provider' });

      await expect(page.getByText('Edited Provider')).toBeVisible();
      await expect(page.getByText('Provider To Edit')).not.toBeVisible();
    });

    test('should delete a provider', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider To Delete'));

      await expect(page.getByText('Provider To Delete')).toBeVisible();

      await settingsPage.deleteProvider();

      await expect(page.getByText('Provider To Delete')).not.toBeVisible();
    });
  });

  test.describe('Validation', () => {
    test('should show error for duplicate provider name', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Duplicate Name'));

      await expect(page.getByText('Duplicate Name')).toBeVisible();

      // Try to add second provider with same name
      await settingsPage.providers.addButton.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await settingsPage.form.nameInput.fill('Duplicate Name');
      await settingsPage.form.apiKeyInput.fill('sk-another-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Duplicate name')).toBeVisible();
    });

    test('should strip special characters from provider name', async ({ page, settingsPage }) => {
      // Special characters that should be removed: \ / : * " < > | ?
      await openAddProviderDialog(page, settingsPage);

      // Type name with special characters
      await settingsPage.form.nameInput.fill('Test\\Provider/Name:With*Special"Chars<>|?');

      // Input should have special characters stripped
      await expect(settingsPage.form.nameInput).toHaveValue('TestProviderNameWithSpecialChars');
    });

    test('should allow provider name with normal special characters', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      // These characters should be allowed: - _ . @ # $ % & ( ) + =
      await settingsPage.addProvider(testProvider('Test-Provider_Name.With@Normal#Chars'));

      await expect(page.getByText('Test-Provider_Name.With@Normal#Chars')).toBeVisible();
    });

    test('should handle provider name with only special characters', async ({ page, settingsPage }) => {
      await openAddProviderDialog(page, settingsPage);

      // Type only forbidden special characters
      await settingsPage.form.nameInput.fill('\\/:*"<>|?');

      // Input should be empty after stripping
      await expect(settingsPage.form.nameInput).toHaveValue('');

      // Submit button should be disabled (empty name)
      await expect(settingsPage.form.submitButton).toBeDisabled();
    });

    test('should preserve spaces in provider name', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('My Custom Provider Name'));

      await expect(page.getByText('My Custom Provider Name')).toBeVisible();
    });
  });

  test.describe('Anthropic Error Handling', () => {
    test('should show error for empty API key', async ({ page, settingsPage }) => {
      await page.route('**/v1/models*', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { error: { message: 'API key required' } } }),
        });
      });

      await openAddProviderDialog(page, settingsPage);

      // Anthropic is default, just fill name (leave key empty)
      await settingsPage.form.nameInput.fill('Empty Key Anthropic');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Empty key')).toBeVisible();
    });

    test('should show error for invalid API key', async ({ page, settingsPage }) => {
      await page.route('**/v1/models*', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { error: { message: 'Invalid API key provided' } } }),
        });
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.form.nameInput.fill('Invalid Key Anthropic');
      await settingsPage.form.apiKeyInput.fill('invalid-anthropic-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Invalid API key provided')).toBeVisible();
    });

    test('should show error for invalid URL', async ({ page, settingsPage }) => {
      await page.route('**/v1/models*', async (route) => {
        await route.abort('connectionfailed');
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.form.nameInput.fill('Wrong URL Anthropic');
      await settingsPage.form.urlInput.clear();
      await settingsPage.form.urlInput.fill('https://invalid-anthropic-url.example.com');
      await settingsPage.form.apiKeyInput.fill('sk-ant-test-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Invalid URL')).toBeVisible();
    });
  });

  test.describe('OpenAI Error Handling', () => {
    test('should show error for empty API key', async ({ page, settingsPage }) => {
      await page.route('**/models', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'API key required', code: 'missing_api_key' } }),
        });
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Empty Key Provider');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Empty key')).toBeVisible();
    });

    test('should show error for invalid API key', async ({ page, settingsPage }) => {
      await page.route('**/models', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid API key', code: 'invalid_api_key' } }),
        });
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Invalid Key Provider');
      await settingsPage.form.apiKeyInput.fill('invalid-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Invalid API key')).toBeVisible();
    });

    test('should show error for invalid URL', async ({ page, settingsPage }) => {
      await page.route('**/models', async (route) => {
        await route.abort('connectionfailed');
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Wrong URL Provider');
      await settingsPage.form.urlInput.clear();
      await settingsPage.form.urlInput.fill('https://invalid-url.example.com/v1');
      await settingsPage.form.apiKeyInput.fill('sk-test-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog.getByText('Invalid URL')).toBeVisible();
    });
  });

  test.describe('Display', () => {
    test('should truncate long provider name', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      const longName = 'A'.repeat(128);

      await settingsPage.addProvider(testProvider(longName));

      const providerItem = page.locator('[class*="truncate"]', { hasText: longName.substring(0, 50) });
      await expect(providerItem).toBeVisible();

      await providerItem.hover();
      await expect(page.getByRole('tooltip', { name: longName })).toBeVisible();
    });

    test('should show error icon when provider returns empty model list', async ({ page, settingsPage }) => {
      await page.route('**/models', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Empty Models Provider');
      await settingsPage.form.apiKeyInput.fill('sk-test-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog).not.toBeVisible();
      await expect(settingsPage.providers.errorIcon).toBeVisible();

      await settingsPage.providers.errorIcon.hover();
      await expect(page.getByRole('tooltip', { name: /provider not available/i })).toBeVisible();
    });

    test('should show error icon when provider fails to return models', async ({ page, settingsPage }) => {
      let callCount = 0;
      await page.route('**/models', async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [{ id: 'gpt-4', object: 'model' }] }),
          });
        } else {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Internal server error' } }),
          });
        }
      });

      await openAddProviderDialog(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Failed Models Provider');
      await settingsPage.form.apiKeyInput.fill('sk-test-key');
      await settingsPage.form.submitButton.click();

      await expect(settingsPage.dialog).not.toBeVisible();
      await expect(settingsPage.providers.errorIcon).toBeVisible();
    });
  });

  test.describe('Keyboard Interactions', () => {
    test('should close Add Provider dialog on Escape', async ({ page, settingsPage }) => {
      await openAddProviderDialog(page, settingsPage);

      await page.keyboard.press('Escape');

      await expect(settingsPage.dialog).not.toBeVisible();
    });

    test('should submit Add Provider dialog on Enter', async ({ page, settingsPage }) => {
      await openAddProviderDialogWithMock(page, settingsPage);

      await settingsPage.selectProviderType('OpenAI');
      await settingsPage.form.nameInput.fill('Enter Submit Provider');
      await settingsPage.form.apiKeyInput.fill('sk-test-key');

      await page.keyboard.press('Enter');

      await expect(settingsPage.dialog).not.toBeVisible();
      await expect(page.getByText('Enter Submit Provider')).toBeVisible();
    });

    test('should close Edit Provider dialog on Escape', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider For Escape Test'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await settingsPage.form.nameInput.clear();
      await settingsPage.form.nameInput.fill('Changed Name');

      await page.keyboard.press('Escape');

      await expect(settingsPage.dialog).not.toBeVisible();
      // Name should NOT have changed (dialog was cancelled)
      await expect(page.getByText('Provider For Escape Test')).toBeVisible();
      await expect(page.getByText('Changed Name')).not.toBeVisible();
    });

    test('should submit Edit Provider dialog on Enter', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider For Enter Test'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await settingsPage.form.nameInput.clear();
      await settingsPage.form.nameInput.fill('Renamed Via Enter');

      await page.keyboard.press('Enter');

      await expect(settingsPage.dialog).not.toBeVisible();
      await expect(page.getByText('Renamed Via Enter')).toBeVisible();
    });

    test('should close Delete Provider dialog on Escape without deleting', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider Not To Delete'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.deleteMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await page.keyboard.press('Escape');

      await expect(settingsPage.dialog).not.toBeVisible();
      // Provider should still exist
      await expect(page.getByText('Provider Not To Delete')).toBeVisible();
    });

    test('should confirm Delete Provider dialog on Enter', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider To Delete Via Enter'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.deleteMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await page.keyboard.press('Enter');

      await expect(settingsPage.dialog).not.toBeVisible();
      await expect(page.getByText('Provider To Delete Via Enter')).not.toBeVisible();
    });
  });

  test.describe('Dialog Behavior', () => {
    test('should close dialog when clicking Cancel button', async ({ page, settingsPage }) => {
      await openAddProviderDialog(page, settingsPage);

      await settingsPage.form.nameInput.fill('Some Provider');

      await settingsPage.form.cancelButton.click();

      await expect(settingsPage.dialog).not.toBeVisible();
    });

    test('should have submit button disabled when name is empty', async ({ page, settingsPage }) => {
      await openAddProviderDialog(page, settingsPage);

      // Only fill API key, leave name empty
      await settingsPage.form.apiKeyInput.fill('sk-test-key');

      await expect(settingsPage.form.submitButton).toBeDisabled();
    });

    test('should update URL when switching provider type', async ({ page, settingsPage }) => {
      await openAddProviderDialog(page, settingsPage);

      // Default is Anthropic
      await expect(settingsPage.form.urlInput).toHaveValue('https://api.anthropic.com');

      // Switch to OpenAI
      await settingsPage.selectProviderType('OpenAI');
      await expect(settingsPage.form.urlInput).toHaveValue('https://api.openai.com/v1');

      // Switch to Ollama
      await settingsPage.selectProviderType('Ollama');
      await expect(settingsPage.form.urlInput).toHaveValue('http://localhost:11434/v1');
    });
  });

  test.describe('Multiple Providers', () => {
    test('should add multiple providers', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider One'));

      await settingsPage.addProvider(testProvider('Provider Two'));

      await expect(page.getByText('Provider One')).toBeVisible();
      await expect(page.getByText('Provider Two')).toBeVisible();
    });

    test('should delete correct provider when multiple exist', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Keep This Provider'));

      await settingsPage.addProvider(testProvider('Delete This Provider'));

      // Click more button on second provider
      await page.getByRole('button', { name: 'more' }).last().click();
      await settingsPage.providers.deleteMenuItem.click();
      await settingsPage.deleteDialog.yesButton.click();

      await expect(page.getByText('Keep This Provider')).toBeVisible();
      await expect(page.getByText('Delete This Provider')).not.toBeVisible();
    });
  });

  test.describe('Persistence', () => {
    test('should persist provider after page reload', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Persistent Provider'));

      await expect(page.getByText('Persistent Provider')).toBeVisible();

      // Reload page
      await page.reload();
      await openSettings(page);

      // Provider should still exist
      await expect(page.getByText('Persistent Provider')).toBeVisible();
    });

    test('should persist edited provider name after reload', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Original Name'));

      await settingsPage.editProvider({ name: 'Updated Name' });

      await page.reload();
      await openSettings(page);

      await expect(page.getByText('Updated Name')).toBeVisible();
      await expect(page.getByText('Original Name')).not.toBeVisible();
    });

    test('should persist deletion after reload', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider To Remove'));

      await settingsPage.deleteProvider();

      await page.reload();
      await openSettings(page);

      await expect(page.getByText('Provider To Remove')).not.toBeVisible();
    });
  });

  test.describe('Edit Dialog', () => {
    test('should have provider type dropdown disabled in edit mode', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider For Edit Check'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      // Provider type should be displayed
      await expect(settingsPage.dialog.getByText('openai')).toBeVisible();

      await expect(page.getByRole('menu')).not.toBeVisible();
    });

    test('should pre-fill form with existing provider data', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider({
        name: 'Prefilled Provider',
        type: 'openai',
        apiKey: 'sk-prefilled-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      await expect(settingsPage.form.nameInput).toHaveValue('Prefilled Provider');
      await expect(settingsPage.form.urlInput).toHaveValue('https://api.openai.com/v1');
      await expect(settingsPage.form.apiKeyInput).toHaveValue('sk-prefilled-key');
    });

    test('should disable save button when no changes made', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Unchanged Provider'));

      await settingsPage.providers.moreButton.click();
      await settingsPage.providers.editMenuItem.click();
      await settingsPage.dialog.waitFor({ state: 'visible' });

      // Save button should be disabled when no changes made
      await expect(settingsPage.form.saveButton).toBeDisabled();
    });
  });

  test.describe('Edge Cases', () => {
    test('should trim whitespace from provider name', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('  Trimmed Provider  '));

      // Name should be trimmed (leading/trailing spaces removed)
      await expect(page.getByText('Trimmed Provider')).toBeVisible();
    });

    test('should handle unicode characters in provider name', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider 日本語 Émoji 🤖'));

      await expect(page.getByText('Provider 日本語 Émoji 🤖')).toBeVisible();
    });

    test('should handle provider name with numbers', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Provider123 V2.0'));

      await expect(page.getByText('Provider123 V2.0')).toBeVisible();
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should switch to MCP Servers tab', async ({ page }) => {
      await openSettingsWithMock(page);

      // MCP tab should be disabled when no providers
      const mcpTab = page.getByRole('tab', { name: /mcp servers/i });
      await expect(mcpTab).toBeDisabled();
    });

    test('should switch to Web Search tab', async ({ page }) => {
      await openSettingsWithMock(page);

      // Web Search tab should be disabled when no providers
      const webSearchTab = page.getByRole('tab', { name: /web search/i });
      await expect(webSearchTab).toBeDisabled();
    });

    test('should enable other tabs when provider is added', async ({ page, settingsPage }) => {
      await openSettingsWithMock(page);

      await settingsPage.addProvider(testProvider('Enable Tabs Provider'));

      // Tabs should be enabled after provider added
      const mcpTab = page.getByRole('tab', { name: /mcp servers/i });
      const webSearchTab = page.getByRole('tab', { name: /web search/i });

      await expect(mcpTab).toBeEnabled();
      await expect(webSearchTab).toBeEnabled();
    });
  });
});

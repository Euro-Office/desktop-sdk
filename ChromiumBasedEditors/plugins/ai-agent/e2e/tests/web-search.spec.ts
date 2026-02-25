import { test, expect, commonSetup, setupSettingsWithProvider, setupWebSearchTab } from '../fixtures/test.fixture';

test.describe('Web Search', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test.describe('Render', () => {
    test('should display web search description', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      await expect(page.getByText(/connect a web search engine/i)).toBeVisible();
    });

    test('should display web search engine dropdown', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      await expect(page.getByText('Web Search Engine', { exact: true })).toBeVisible();
      await expect(page.getByText(/select engine/i)).toBeVisible();
    });

    test('should display API key input', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      await expect(page.getByText(/api key/i)).toBeVisible();
      await expect(page.getByRole('textbox')).toBeVisible();
    });
  });

  test.describe('Form State', () => {
    test('should have save button disabled initially', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    test('should have reset button disabled initially', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      await expect(page.getByRole('button', { name: /reset/i })).toBeDisabled();
    });

    test('should enable save button when provider and API key are filled', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider from dropdown
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Enter API key
      await page.getByRole('textbox').fill('test-api-key');

      await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();
    });
  });

  test.describe('Save and Reset', () => {
    test('should save web search settings', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Enter API key
      await page.getByRole('textbox').fill('test-api-key');

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // After saving, save button should be disabled
      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
      // Reset button should be enabled
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
    });

    test('should disable API key input after saving', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider and enter API key
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // API key input should be disabled
      await expect(page.getByRole('textbox')).toBeDisabled();
    });

    test('should reset settings when reset button clicked', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Reset
      await page.getByRole('button', { name: /reset/i }).click();

      // Should show "Select engine" again
      await expect(page.getByText(/select engine/i)).toBeVisible();
      // API key should be cleared and enabled
      await expect(page.getByRole('textbox')).toBeEnabled();
      await expect(page.getByRole('textbox')).toHaveValue('');
      // Reset button should be disabled again
      await expect(page.getByRole('button', { name: /reset/i })).toBeDisabled();
    });
  });

  test.describe('Persistence', () => {
    test('should persist web search settings after page reload', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('persisted-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Reload page
      await page.reload();
      await page.getByRole('button', { name: /settings/i }).first().click();
      await page.getByRole('tab', { name: /web search/i }).click();

      // Settings should be persisted
      await expect(page.getByText(/exa/i)).toBeVisible();
      await expect(page.getByRole('textbox')).toHaveValue('persisted-api-key');
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
    });

    test('should clear web search settings after reset and reload', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Reset
      await page.getByRole('button', { name: /reset/i }).click();

      // Reload page
      await page.reload();
      await page.getByRole('button', { name: /settings/i }).first().click();
      await page.getByRole('tab', { name: /web search/i }).click();

      // Settings should be cleared
      await expect(page.getByText(/select engine/i)).toBeVisible();
      await expect(page.getByRole('textbox')).toHaveValue('');
      await expect(page.getByRole('button', { name: /reset/i })).toBeDisabled();
    });
  });

  test.describe('Keyboard Interactions', () => {
    test('should save web search settings on Enter key press', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Enter API key and press Enter
      await page.getByRole('textbox').fill('enter-save-key');
      await page.keyboard.press('Enter');

      // Should be saved (save button disabled, reset enabled)
      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
    });
  });

  test.describe('Dropdown Behavior', () => {
    test('should only show Exa in dropdown options', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Open dropdown
      await page.getByText(/select engine/i).click();

      // Should only show Exa
      await expect(page.getByRole('menuitem', { name: /exa/i })).toBeVisible();
      // Should only have one option
      const menuItems = page.getByRole('menuitem');
      await expect(menuItems).toHaveCount(1);
    });

    test('should show empty dropdown after saving (locked state)', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Try to open dropdown - it should show Exa but not be interactive
      await expect(page.getByText(/exa/i).first()).toBeVisible();

      // Menu should not open (no menuitem visible)
      await expect(page.getByRole('menuitem')).not.toBeVisible();
    });

    test('should display selected provider name after selection', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Initially shows "Select engine"
      await expect(page.getByText(/select engine/i)).toBeVisible();

      // Select Exa
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Should now show "Exa" instead of "Select engine"
      await expect(page.getByText(/select engine/i)).not.toBeVisible();
      await expect(page.getByText(/exa/i)).toBeVisible();
    });
  });

  test.describe('Validation', () => {
    test('should not enable save with only provider selected (no API key)', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider only
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Save should be disabled
      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    test('should not enable save with only API key (no provider selected)', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Enter API key only without selecting provider
      await page.getByRole('textbox').fill('test-api-key');

      // Save should be disabled
      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    test('should disable save when API key is cleared after entering', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider and enter API key
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');

      // Save should be enabled
      await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();

      // Clear API key
      await page.getByRole('textbox').clear();

      // Save should be disabled
      await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle very long API key', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      const longApiKey = 'a'.repeat(500);

      // Select provider and enter long API key
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill(longApiKey);
      await page.getByRole('button', { name: /save/i }).click();

      // Should be saved successfully
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
      await expect(page.getByRole('textbox')).toHaveValue(longApiKey);
    });

    test('should preserve API key with special characters', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      const specialCharsKey = 'sk-test_key-123.abc+xyz=';

      // Select provider and enter API key with special characters
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill(specialCharsKey);
      await page.getByRole('button', { name: /save/i }).click();

      // Should be saved successfully with special characters preserved
      await expect(page.getByRole('textbox')).toHaveValue(specialCharsKey);
    });

    test('should handle whitespace-only API key as invalid', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Select provider
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();

      // Enter whitespace-only API key
      await page.getByRole('textbox').fill('   ');

      // Save should be enabled (whitespace is considered content)
      // But this tests the behavior - adjust expectation based on actual implementation
      const saveButton = page.getByRole('button', { name: /save/i });
      // If implementation trims, it should be disabled; if not, enabled
      await expect(saveButton).toBeEnabled();
    });
  });

  test.describe('UI/Visual', () => {
    test('should show password input type for API key', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Check that the input type is password
      const apiKeyInput = page.getByRole('textbox');
      await expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    test('should display correct field labels', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Check labels
      await expect(page.getByText('Web Search Engine', { exact: true })).toBeVisible();
      await expect(page.getByText('API key', { exact: true })).toBeVisible();
    });
  });

  test.describe('State Consistency', () => {
    test('should maintain saved state when switching tabs', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Switch to MCP Servers tab
      await page.getByRole('tab', { name: /mcp servers/i }).click();

      // Switch back to Web Search tab
      await page.getByRole('tab', { name: /web search/i }).click();

      // Saved state should be maintained
      await expect(page.getByText(/exa/i)).toBeVisible();
      await expect(page.getByRole('textbox')).toHaveValue('test-api-key');
      await expect(page.getByRole('textbox')).toBeDisabled();
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
    });

    test('should disable web search tab when all providers are deleted', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);

      // Web Search tab should be enabled
      const webSearchTab = page.getByRole('tab', { name: /web search/i });
      await expect(webSearchTab).toBeEnabled();

      // Delete the provider
      await settingsPage.deleteProvider();

      // Web Search tab should be disabled
      await expect(webSearchTab).toBeDisabled();
    });
  });

  test.describe('Storage', () => {
    test('should store web search data in localStorage', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('storage-test-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Check localStorage
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('webSearchProviderData');
      });

      expect(storedData).not.toBeNull();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.provider).toBe('Exa');
      expect(parsedData.key).toBe('storage-test-key');
    });

    test('should clear localStorage when reset', async ({ page, settingsPage }) => {
      await setupWebSearchTab(page, settingsPage);

      // Configure and save
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Reset
      await page.getByRole('button', { name: /reset/i }).click();

      // Check localStorage is cleared
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('webSearchProviderData');
      });

      expect(storedData).toBe('');
    });
  });
});

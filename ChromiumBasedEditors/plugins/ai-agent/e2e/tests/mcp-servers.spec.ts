import { test, expect, commonSetup, setupSettingsWithProvider, setupMCPServersTab } from '../fixtures/test.fixture';

test.describe('MCP Servers', () => {
  test.beforeEach(async ({ page }) => {
    await commonSetup(page);
  });

  test.describe('Tab Access', () => {
    test('should have MCP Servers tab disabled when no providers configured', async ({ page }) => {
      await page.getByRole('button', { name: /settings/i }).first().click();

      const mcpTab = page.getByRole('tab', { name: /mcp servers/i });
      await expect(mcpTab).toBeDisabled();
    });

    test('should enable MCP Servers tab when provider is added', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);

      const mcpTab = page.getByRole('tab', { name: /mcp servers/i });
      await expect(mcpTab).toBeEnabled();
    });

    test('should disable MCP Servers tab when all providers are deleted', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);

      const mcpTab = page.getByRole('tab', { name: /mcp servers/i });
      await expect(mcpTab).toBeEnabled();

      await settingsPage.deleteProvider();

      await expect(mcpTab).toBeDisabled();
    });
  });

  test.describe('Render', () => {
    test('should display MCP servers description', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(page.getByText(/This section allows you to configure MCP servers for use within the AI agent. You can edit the configuration to add new MCP servers and enable tools as needed./i)).toBeVisible();
    });

    test('should display Edit Configuration button', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(settingsPage.mcpServers.editConfigButton).toBeVisible();
    });

    test('should display Available Tools section', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(page.getByText('Available Tools')).toBeVisible();
    });

    test('should display tool count', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(page.getByText(/\/100 tools/)).toBeVisible();
    });

    test('should display desktop-editor server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(page.getByText('desktop-editor')).toBeVisible();
    });
  });

  test.describe('Config Dialog', () => {
    test('should open config dialog when Edit Configuration is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await expect(settingsPage.dialog).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Edit configuration' })).toBeVisible();
    });

    test('should display JSON editor in config dialog', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await expect(settingsPage.mcpConfigDialog.jsonEditor).toBeVisible();
    });

    test('should display JSON label', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await expect(page.getByText('json', { exact: true })).toBeVisible();
    });

    test('should display Save and Cancel buttons', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeVisible();
      await expect(settingsPage.mcpConfigDialog.cancelButton).toBeVisible();
    });

    test('should close dialog when Cancel is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.mcpConfigDialog.cancelButton.click();

      await expect(settingsPage.dialog).not.toBeVisible();
    });

    test('should close dialog on Escape key', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await page.keyboard.press('Escape');

      await expect(settingsPage.dialog).not.toBeVisible();
    });

    test('should have default empty mcpServers config', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Editor should contain mcpServers property
      await expect(settingsPage.mcpConfigDialog.jsonEditor).toContainText('mcpServers');
    });
  });

  test.describe('Config Validation', () => {
    test('should show error for invalid JSON', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type invalid JSON
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ invalid json }');

      await expect(page.getByText(/invalid json format/i)).toBeVisible();
    });

    test('should show error when mcpServers property is missing', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type valid JSON without mcpServers
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ "servers": {} }');

      await expect(page.getByText("Configuration must be placed inside 'mcpServers' property")).toBeVisible();
    });

    test('should disable Save button for invalid JSON', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type invalid JSON
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ invalid }');

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();
    });

    test('should disable Save button when mcpServers is missing', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type valid JSON without mcpServers
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ "other": {} }');

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();
    });

    test('should enable Save button for valid config', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type valid config
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ "mcpServers": {} }');

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });
  });

  test.describe('Desktop Editor Server', () => {
    test('should always show desktop-editor server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await expect(page.getByText('desktop-editor')).toBeVisible();
    });

    test('should show tool count for desktop-editor', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Should show "X/Y Tools enabled" format
      await expect(page.getByText(/Tools enabled/i).first()).toBeVisible();
    });

    test('should have more button for desktop-editor', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await expect(desktopEditorRow.getByRole('button', { name: 'more' })).toBeVisible();
    });

    test('should show Enable All Tools and Disable All Tools options for desktop-editor', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await settingsPage.openServerMenu('desktop-editor');

      await expect(settingsPage.mcpServerActions.enableAllTools).toBeVisible();
      await expect(settingsPage.mcpServerActions.disableAllTools).toBeVisible();
    });

    test('should NOT show Restart, Logs, Delete options for desktop-editor (system server)', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await settingsPage.openServerMenu('desktop-editor');

      // System servers should not have these options
      await expect(settingsPage.mcpServerActions.restart).not.toBeVisible();
      await expect(settingsPage.mcpServerActions.logs).not.toBeVisible();
      await expect(settingsPage.mcpServerActions.delete).not.toBeVisible();
    });
  });

  test.describe('Keyboard Interactions', () => {
    test('should close config dialog on Escape', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await page.keyboard.press('Escape');

      await expect(settingsPage.dialog).not.toBeVisible();
    });
  });

  test.describe('State Consistency', () => {
    test('should maintain MCP tab state when switching tabs', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Verify we're on MCP tab
      await expect(page.getByText('desktop-editor')).toBeVisible();

      // Switch to Web Search tab
      await page.getByRole('tab', { name: /web search/i }).click();

      // Switch back to MCP Servers tab
      await settingsPage.goToMCPServersTab();

      // Should still show desktop-editor
      await expect(page.getByText('desktop-editor')).toBeVisible();
    });

    test('should maintain MCP tab state when switching to Connection tab and back', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Verify we're on MCP tab
      await expect(page.getByText('desktop-editor')).toBeVisible();

      // Switch to Connection tab
      await page.getByRole('tab', { name: /connection/i }).click();

      // Switch back to MCP Servers tab
      await settingsPage.goToMCPServersTab();

      // Should still show desktop-editor
      await expect(page.getByText('desktop-editor')).toBeVisible();
    });
  });

  test.describe('Persistence', () => {
    test('should persist MCP config after page reload', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set a config with a custom server
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"test-server":{"command":"echo","args":["hello"]}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Reload page
      await page.reload();
      await page.getByRole('button', { name: /settings/i }).first().click();
      await settingsPage.goToMCPServersTab();

      // Open config dialog and verify config is persisted
      await settingsPage.openMCPConfigDialog();
      await expect(settingsPage.mcpConfigDialog.jsonEditor).toContainText('test-server');
    });

    test('should store MCP config in localStorage', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set config
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"storage-test":{"command":"test"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();

      // Check localStorage
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('mcpServers');
      });

      expect(storedData).not.toBeNull();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.mcpServers['storage-test']).toBeDefined();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle empty mcpServers object', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set empty mcpServers
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{}}');

      // Save should be enabled
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });
    });

    test('should handle config with multiple servers', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set config with multiple servers
      const config = {
        mcpServers: {
          'server-one': { command: 'echo', args: ['one'] },
          'server-two': { command: 'echo', args: ['two'] },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should handle config with environment variables', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set config with env vars
      const config = {
        mcpServers: {
          'env-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              API_KEY: 'test-key',
              DEBUG: 'true',
            },
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should handle whitespace in JSON', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Set config with extra whitespace (spaces around colons and values)
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{  "mcpServers" :  {  "test" :  {  "command" :  "echo"  }  }  }');

      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });
  });

  test.describe('UI/Visual', () => {
    test('should display instruction text in config dialog', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await expect(page.getByText(/enter your json configuration/i)).toBeVisible();
    });

    test('should display arrow icon on server row', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Arrow icon should be visible on desktop-editor row
      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await expect(desktopEditorRow.getByRole('button', { name: 'arrow.right' })).toBeVisible();
    });
  });

  test.describe('Tool Expansion', () => {
    test('should expand server to show individual tools when clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Click on desktop-editor row to expand
      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      // Should show individual tools
      await expect(page.getByText('file_content_reader')).toBeVisible();
    });

    test('should collapse server when clicked again', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).first();

      // Expand
      await desktopEditorRow.click();
      await expect(page.getByText('file_content_reader')).toBeVisible();

      // Collapse
      await desktopEditorRow.click();
      await expect(page.getByText('file_content_reader')).not.toBeVisible();
    });

    test('should show all desktop-editor tools when expanded', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      // Verify all 9 tools are visible
      await expect(page.getByText('file_content_reader')).toBeVisible();
      await expect(page.getByText('file_opener')).toBeVisible();
      await expect(page.getByText('folder_content_reader')).toBeVisible();
      await expect(page.getByText('form_field_analyser')).toBeVisible();
      await expect(page.getByText('form_field_filler')).toBeVisible();
      await expect(page.getByText('generate_docx')).toBeVisible();
      await expect(page.getByText('generate_form')).toBeVisible();
      await expect(page.getByText('generate_pptx')).toBeVisible();
      await expect(page.getByText('recent_files_reader')).toBeVisible();
    });

    test('should show tool descriptions when expanded', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      // Verify tool descriptions are shown
      await expect(page.getByText('Read file content')).toBeVisible();
      await expect(page.getByText('Open a file')).toBeVisible();
    });

    test('should show toggle switch for each tool', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      // Should have toggle switches (checkboxes) for tools
      const toggles = page.locator('[role="switch"]');
      await expect(toggles.first()).toBeVisible();
    });
  });

  test.describe('Tool Toggle', () => {
    test('should disable individual tool when toggle is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      // Find and click the first tool toggle to disable it
      const firstToolToggle = page.locator('[role="switch"]').first();
      await firstToolToggle.click();

      // Tool count should decrease
      await expect(page.getByText(/8\/9 tools enabled/i)).toBeVisible();
    });

    test('should enable tool when toggle is clicked again', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      const firstToolToggle = page.locator('[role="switch"]').first();

      // Disable
      await firstToolToggle.click();
      await expect(page.getByText(/8\/9 tools enabled/i)).toBeVisible();

      // Enable
      await firstToolToggle.click();
      await expect(page.getByText(/9\/9 tools enabled/i)).toBeVisible();
    });

    test('should persist tool disabled state after collapse/expand', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).first();
      await desktopEditorRow.click();

      // Disable first tool
      const firstToolToggle = page.locator('[role="switch"]').first();
      await firstToolToggle.click();

      // Collapse
      await desktopEditorRow.click();

      // Should still show 8/9
      await expect(page.getByText(/8\/9 tools enabled/i)).toBeVisible();

      // Expand again
      const updatedRow = page.locator('div').filter({ hasText: /^desktop-editor8\/9 tools enabled$/ }).nth(2);
      await updatedRow.click();

      // First toggle should be off
      const toggleAfter = page.locator('[role="switch"]').first();
      await expect(toggleAfter).toHaveAttribute('data-state', 'unchecked');
    });
  });

  test.describe('Enable/Disable All Tools', () => {
    test('should disable all tools when Disable All Tools is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      await settingsPage.openServerMenu('desktop-editor');
      await settingsPage.mcpServerActions.disableAllTools.click();

      // Should show 0/9 tools enabled
      await expect(page.getByText(/0\/9 tools enabled/i)).toBeVisible();
    });

    test('should enable all tools when Enable All Tools is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // First disable all
      await settingsPage.openServerMenu('desktop-editor');
      await settingsPage.mcpServerActions.disableAllTools.click();
      await expect(page.getByText(/0\/9 tools enabled/i)).toBeVisible();

      // Then enable all
      await settingsPage.openServerMenu('desktop-editor');
      await settingsPage.mcpServerActions.enableAllTools.click();

      // Should show 9/9 tools enabled
      await expect(page.getByText(/9\/9 tools enabled/i)).toBeVisible();
    });

    test('should update total tool count when disabling all tools', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Check initial total tool count (9/100)
      await expect(page.getByText('9/100 tools')).toBeVisible();

      // Disable all tools
      await settingsPage.openServerMenu('desktop-editor');
      await settingsPage.mcpServerActions.disableAllTools.click();

      // Total should now be 0/100
      await expect(page.getByText('0/100 tools')).toBeVisible();
    });
  });

  test.describe('Custom Server Management', () => {
    test('should add custom server via config', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Add custom server config
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"my-custom-server":{"command":"node","args":["server.js"]}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Custom server should appear in list
      await expect(page.getByText('my-custom-server')).toBeVisible();
    });

    test('should show additional menu options for custom server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"test-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize (show tool count)
      await expect(page.getByText(/test-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open menu for custom server - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^test-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();

      // Should show Restart, Logs, Delete options
      await expect(settingsPage.mcpServerActions.restart).toBeVisible();
      await expect(settingsPage.mcpServerActions.logs).toBeVisible();
      await expect(settingsPage.mcpServerActions.delete).toBeVisible();
    });

    test('should open logs dialog for custom server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"log-test-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/log-test-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open logs - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^log-test-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.logs.click();

      // Logs dialog should open
      await expect(settingsPage.dialog).toBeVisible();
      await expect(page.getByText(/log-test-server.*logs/i)).toBeVisible();
    });

    test('should show delete confirmation dialog', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"delete-test-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/delete-test-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open delete dialog - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^delete-test-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.delete.click();

      // Delete confirmation dialog should appear
      await expect(settingsPage.dialog).toBeVisible();
      await expect(settingsPage.deleteDialog.yesButton).toBeVisible();
      await expect(settingsPage.deleteDialog.noButton).toBeVisible();
    });

    test('should delete custom server when confirmed', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"to-delete-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/to-delete-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Delete server - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^to-delete-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.delete.click();
      await settingsPage.deleteDialog.yesButton.click();

      // Server should be removed
      await expect(page.getByText('to-delete-server')).not.toBeVisible();
    });

    test('should cancel delete when No is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"keep-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/keep-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open delete dialog and cancel - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^keep-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.delete.click();
      await settingsPage.deleteDialog.noButton.click();

      // Server should still exist
      await expect(page.getByText('keep-server')).toBeVisible();
    });
  });

  test.describe('Config Error Recovery', () => {
    test('should recover Save button when fixing invalid JSON', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type invalid JSON
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{ invalid }');

      // Save should be disabled
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();
      await expect(page.getByText(/invalid json format/i)).toBeVisible();

      // Fix the JSON
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{}}');

      // Save should be enabled again
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
      await expect(page.getByText(/invalid json format/i)).not.toBeVisible();
    });

    test('should recover when adding mcpServers property', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type JSON without mcpServers
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"servers":{}}');

      // Save should be disabled
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();

      // Fix by adding mcpServers
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{}}');

      // Save should be enabled
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should show error for trailing comma in JSON', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type JSON with trailing comma
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"test":{"command":"echo"},}}');

      // Should show error
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();
    });

    test('should show error for single quotes instead of double quotes', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Type JSON with single quotes
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type("{'mcpServers':{}}");

      // Should show error
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeDisabled();
      await expect(page.getByText(/invalid json format/i)).toBeVisible();
    });
  });

  test.describe('Web Search Integration', () => {
    test('should maintain 100/100 tool count when enabling web search', async ({ page, settingsPage }) => {
      await setupSettingsWithProvider(page, settingsPage);
      await settingsPage.goToMCPServersTab();

      // Add server with 150 tools to reach max capacity (9 from desktop-editor + 91 = 100)
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"web-search-test-server":{"command":"150-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize and reach max capacity
      await expect(page.getByText(/web-search-test-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('100/100 tools')).toBeVisible();

      // Go to Web Search tab and enable web search
      await page.getByRole('tab', { name: /web search/i }).click();
      await page.getByText(/select engine/i).click();
      await page.getByRole('menuitem', { name: /exa/i }).click();
      await page.getByRole('textbox').fill('test-api-key');
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for save to complete
      await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();

      // Go back to MCP Servers tab
      await settingsPage.goToMCPServersTab();

      // Tool count should still be 100/100, NOT 98/100
      await expect(page.getByText('100/100 tools')).toBeVisible();
    });
  });

  test.describe('Tool Count Accuracy', () => {
    test('should show correct total tool count in header', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Should show 9/100 tools (9 desktop-editor tools)
      await expect(page.getByText('9/100 tools')).toBeVisible();
    });

    test('should update total when individual tool is toggled', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Expand and disable one tool
      const desktopEditorRow = page.locator('div').filter({ hasText: /^desktop-editor\d+\/\d+ tools enabled$/ }).nth(2);
      await desktopEditorRow.click();

      const firstToggle = page.locator('[role="switch"]').first();
      await firstToggle.click();

      // Total should be 8/100
      await expect(page.getByText('8/100 tools')).toBeVisible();
    });

    test('should maintain consistency between server count and total count', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Disable all tools for desktop-editor
      await settingsPage.openServerMenu('desktop-editor');
      await settingsPage.mcpServerActions.disableAllTools.click();

      // Server should show 0/9
      await expect(page.getByText(/0\/9 tools enabled/i)).toBeVisible();

      // Total should show 0/100
      await expect(page.getByText('0/100 tools')).toBeVisible();
    });
  });

  test.describe('Logs Dialog', () => {
    test('should have copy to clipboard button', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"logs-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/logs-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open logs - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^logs-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.logs.click();

      // Copy button should be visible
      await expect(settingsPage.mcpLogsDialog.copyToClipboard).toBeVisible();
    });

    test('should close logs dialog when close button is clicked', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"close-logs-server":{"command":"echo"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/close-logs-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/1\/1 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Open logs - use exact text match to find the specific row
      const customServerRow = page.locator('div').filter({ hasText: /^close-logs-server1\/1 tools enabled$/ }).nth(1);
      await customServerRow.getByRole('button', { name: 'more' }).click();
      await settingsPage.mcpServerActions.logs.click();

      await expect(settingsPage.dialog).toBeVisible();

      // Close dialog
      await settingsPage.mcpLogsDialog.closeButton.click();

      await expect(settingsPage.dialog).not.toBeVisible();
    });
  });

  test.describe('HTTP MCP Servers', () => {
    // Note: In e2e tests, the onlyoffice-proxy:// scheme is not supported,
    // so HTTP MCP servers won't actually connect. These tests verify config
    // validation and persistence only (not server interactions).

    test('should accept HTTP MCP server config with url property', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Add HTTP MCP server config
      const config = {
        mcpServers: {
          'http-server': {
            url: 'https://api.example.com/mcp',
            headers: {
              Authorization: 'Bearer test-token',
            },
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      // Save button should be enabled for valid HTTP config
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should validate HTTP server config with headers', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      // Test complex HTTP config with multiple headers
      const config = {
        mcpServers: {
          'github-copilot': {
            url: 'https://api.github.com/copilot/mcp',
            headers: {
              Authorization: 'Bearer ghp_xxxxx',
              'X-GitHub-Api-Version': '2022-11-28',
              Accept: 'application/json',
            },
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      // Should be valid
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should accept mixed HTTP and stdio servers in config', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      const config = {
        mcpServers: {
          'stdio-server': {
            command: 'echo',
            args: ['hello'],
          },
          'http-server': {
            url: 'https://api.example.com/mcp',
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      // Should be valid - both stdio and HTTP configs are accepted
      await expect(settingsPage.mcpConfigDialog.saveButton).toBeEnabled();
    });

    test('should persist HTTP server config in localStorage', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      const config = {
        mcpServers: {
          'persist-http-server': {
            url: 'https://persist.example.com/mcp',
            headers: { 'X-Custom': 'header-value' },
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Check localStorage directly
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('mcpServers');
      });

      expect(storedData).not.toBeNull();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.mcpServers['persist-http-server']).toBeDefined();
      expect(parsedData.mcpServers['persist-http-server'].url).toBe('https://persist.example.com/mcp');
      expect(parsedData.mcpServers['persist-http-server'].headers['X-Custom']).toBe('header-value');
    });

    test('should persist HTTP server config after page reload', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      const config = {
        mcpServers: {
          'reload-http-server': {
            url: 'https://reload.example.com/mcp',
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Reload page
      await page.reload();
      await page.getByRole('button', { name: /settings/i }).first().click();
      await settingsPage.goToMCPServersTab();

      // Open config dialog and verify HTTP config is persisted
      await settingsPage.openMCPConfigDialog();
      await expect(settingsPage.mcpConfigDialog.jsonEditor).toContainText('reload-http-server');
      await expect(settingsPage.mcpConfigDialog.jsonEditor).toContainText('https://reload.example.com/mcp');
    });

    test('should store mixed servers config correctly', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);
      await settingsPage.openMCPConfigDialog();

      const config = {
        mcpServers: {
          'my-stdio': {
            command: 'node',
            args: ['server.js'],
            env: { DEBUG: 'true' },
          },
          'my-http': {
            url: 'https://api.example.com/mcp',
            headers: { Authorization: 'Bearer token' },
          },
        },
      };
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type(JSON.stringify(config));

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Check localStorage contains both
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('mcpServers');
      });

      const parsedData = JSON.parse(storedData!);

      // Verify stdio server
      expect(parsedData.mcpServers['my-stdio'].command).toBe('node');
      expect(parsedData.mcpServers['my-stdio'].args).toEqual(['server.js']);

      // Verify HTTP server
      expect(parsedData.mcpServers['my-http'].url).toBe('https://api.example.com/mcp');
      expect(parsedData.mcpServers['my-http'].headers.Authorization).toBe('Bearer token');
    });
  });

  test.describe('Tool Capacity Management', () => {
    test('should auto-disable excess tools when server has more than available capacity', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Desktop-editor has 9 tools, so only 91 more can be enabled (100 total limit)
      // Add server with 150 tools - only 91 should be enabled
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"large-server":{"command":"150-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/large-server/)).toBeVisible({ timeout: 3000 });

      // Should show 91/150 tools enabled (9 from desktop-editor + 91 = 100 total)
      await expect(page.getByText(/91\/150 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Total should be at max capacity: 100/100
      await expect(page.getByText('100/100 tools')).toBeVisible();
    });

    test('should show correct total tool count with multiple servers', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Initial: 9 tools from desktop-editor
      await expect(page.getByText('9/100 tools')).toBeVisible();

      // Add server with 50 tools
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"medium-server":{"command":"50-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/medium-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/50\/50 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Total should be 9 + 50 = 59
      await expect(page.getByText('59/100 tools')).toBeVisible();
    });

    test('should not allow enabling tools when at max capacity', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Add server with 150 tools to reach max capacity
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"capacity-server":{"command":"150-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize - should show 91/150 (100 total reached)
      await expect(page.getByText(/capacity-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/91\/150 tools enabled/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('100/100 tools')).toBeVisible();

      // Expand server to see individual tools
      const serverRow = page.locator('div').filter({ hasText: /^capacity-server91\/150 tools enabled$/ }).nth(1);
      await serverRow.click();

      // Find a disabled tool toggle (should be unchecked)
      const disabledToggle = page.locator('[role="switch"][data-state="unchecked"]').first();
      await expect(disabledToggle).toBeVisible();

      // The toggle should be disabled (can't enable when at capacity)
      await expect(disabledToggle).toBeDisabled();
    });

    test('should allow enabling tools after disabling some', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Add server with 150 tools to reach max capacity
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"enable-test-server":{"command":"150-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/enable-test-server/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('100/100 tools')).toBeVisible();

      // Disable all desktop-editor tools to free up capacity
      await settingsPage.openServerMenu('desktop-editor', 1);
      await settingsPage.mcpServerActions.disableAllTools.click();

      // Now total should be 91/100 (only capacity-server tools)
      await expect(page.getByText('91/100 tools')).toBeVisible();

      // Expand enable-test-server to find disabled tools
      const serverRow = page.locator('div').filter({ hasText: /^enable-test-server91\/150 tools enabled$/ }).nth(2);
      await serverRow.click();

      // Find a disabled tool toggle - it should now be enabled (clickable)
      const disabledToggle = page.locator('[role="switch"][data-state="unchecked"]').first();
      await expect(disabledToggle).toBeVisible();
      await expect(disabledToggle).toBeEnabled();

      // Click to enable the tool
      await disabledToggle.click();

      // Tool count should increase
      await expect(page.getByText('92/100 tools')).toBeVisible();
    });

    test('should correctly count enabled vs total tools per server', async ({ page, settingsPage }) => {
      await setupMCPServersTab(page, settingsPage);

      // Add server with exactly 100 tools (more than remaining capacity of 91)
      await settingsPage.openMCPConfigDialog();
      await settingsPage.clearMCPConfigEditor();
      await page.keyboard.type('{"mcpServers":{"count-server":{"command":"100-tools"}}}');

      await settingsPage.mcpConfigDialog.saveButton.click();
      await settingsPage.dialog.waitFor({ state: 'hidden', timeout: 10000 });

      // Wait for server to initialize
      await expect(page.getByText(/count-server/)).toBeVisible({ timeout: 3000 });

      // Server should show 91/100 (only 91 can be enabled due to desktop-editor's 9)
      await expect(page.getByText(/91\/100 tools enabled/i)).toBeVisible({ timeout: 3000 });

      // Desktop-editor should still show 9/9
      await expect(page.getByText(/9\/9 tools enabled/i)).toBeVisible();

      // Total should be 100/100
      await expect(page.getByText('100/100 tools')).toBeVisible();
    });
  });
});

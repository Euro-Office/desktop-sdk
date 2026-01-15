import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export type ProviderConfig = {
  name: string;
  type: string;
  apiKey: string;
  baseUrl?: string;
};

export type MCPServerConfig = {
  [serverName: string]: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
};

/**
 * Settings Page Object - interactions on the settings page
 */
export class SettingsPage extends BasePage {
  // Dialog
  readonly dialog: Locator;

  // Providers section
  readonly providers: {
    readonly addButton: Locator;
    readonly list: Locator;
    readonly moreButton: Locator;
    readonly editMenuItem: Locator;
    readonly deleteMenuItem: Locator;
    readonly errorIcon: Locator;
  };

  // Dialog form fields
  readonly form: {
    readonly typeDropdown: Locator;
    readonly nameInput: Locator;
    readonly urlInput: Locator;
    readonly apiKeyInput: Locator;
    readonly submitButton: Locator;
    readonly cancelButton: Locator;
    readonly saveButton: Locator;
  };

  // Delete confirmation dialog
  readonly deleteDialog: {
    readonly yesButton: Locator;
    readonly noButton: Locator;
  };

  // MCP Servers section
  readonly mcpServers: {
    readonly editConfigButton: Locator;
    readonly availableToolsHeader: Locator;
    readonly toolCountDisplay: Locator;
    readonly desktopEditorServer: Locator;
  };

  // MCP Config Dialog
  readonly mcpConfigDialog: {
    readonly jsonEditor: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;
    readonly errorMessage: Locator;
  };

  // MCP Server Actions
  readonly mcpServerActions: {
    readonly enableAllTools: Locator;
    readonly disableAllTools: Locator;
    readonly restart: Locator;
    readonly logs: Locator;
    readonly delete: Locator;
  };

  // MCP Logs Dialog
  readonly mcpLogsDialog: {
    readonly copyToClipboard: Locator;
    readonly closeButton: Locator;
  };

  constructor(page: Page) {
    super(page);

    this.dialog = page.getByRole('dialog');

    this.providers = {
      addButton: page.getByRole('button', { name: /add provider/i }),
      list: page.locator('[class*="provider"]'),
      moreButton: page.getByRole('button', { name: 'more' }),
      editMenuItem: page.getByRole('menuitem', { name: /edit/i }),
      deleteMenuItem: page.getByRole('menuitem', { name: /delete/i }),
      errorIcon: page.getByRole('button', { name: 'status.error' }),
    };

    this.form = {
      typeDropdown: this.dialog.locator('[class*="cursor-pointer"]').filter({ has: page.getByRole('img', { name: 'arrow.bottom' }) }),
      nameInput: page.getByPlaceholder(/enter name/i),
      urlInput: page.getByPlaceholder(/enter url/i),
      apiKeyInput: page.getByPlaceholder(/enter.*key/i),
      submitButton: this.dialog.getByRole('button', { name: /add provider/i }).last(),
      cancelButton: this.dialog.getByRole('button', { name: /cancel/i }),
      saveButton: this.dialog.getByRole('button', { name: /save/i }),
    };

    this.deleteDialog = {
      yesButton: page.getByRole('button', { name: /yes/i }),
      noButton: page.getByRole('button', { name: /no/i }),
    };

    // MCP Servers section
    this.mcpServers = {
      editConfigButton: page.getByRole('button', { name: /edit configuration/i }),
      availableToolsHeader: page.getByText('Available Tools'),
      toolCountDisplay: page.getByText(/\/100 Tools/),
      desktopEditorServer: page.getByText('desktop-editor'),
    };

    // MCP Config Dialog
    this.mcpConfigDialog = {
      jsonEditor: this.dialog.locator('.cm-editor'),
      saveButton: this.dialog.getByRole('button', { name: /save/i }),
      cancelButton: this.dialog.getByRole('button', { name: /cancel/i }),
      errorMessage: this.dialog.locator('.text-\\[var\\(--text-negative\\)\\]'),
    };

    // MCP Server Actions
    this.mcpServerActions = {
      enableAllTools: page.getByRole('menuitem', { name: /enable all tools/i }),
      disableAllTools: page.getByRole('menuitem', { name: /disable all tools/i }),
      restart: page.getByRole('menuitem', { name: /restart/i }),
      logs: page.getByRole('menuitem', { name: /logs/i }),
      delete: page.getByRole('menuitem', { name: /delete/i }),
    };

    // MCP Logs Dialog
    this.mcpLogsDialog = {
      copyToClipboard: page.getByRole('button', { name: /copy to clipboard/i }),
      closeButton: this.dialog.getByRole('button', { name: 'Close', exact: true }),
    };
  }

  // Keep for backward compatibility
  get addProviderButton(): Locator {
    return this.providers.addButton;
  }

  get addProviderDialog(): Locator {
    return this.dialog;
  }

  /**
   * Select provider type from dropdown
   */
  async selectProviderType(type: string): Promise<void> {
    if (type.toLowerCase() === 'anthropic') return;

    await this.form.typeDropdown.click();
    await this.page.getByRole('menuitem', { name: new RegExp(`^${type}$`, 'i') }).click();
  }

  /**
   * Add a new provider
   */
  async addProvider(config: ProviderConfig): Promise<void> {
    await this.providers.addButton.click();
    await this.dialog.waitFor({ state: 'visible' });

    await this.selectProviderType(config.type);
    await this.form.nameInput.fill(config.name);
    await this.form.apiKeyInput.fill(config.apiKey);

    if (config.baseUrl) {
      await this.form.urlInput.clear();
      await this.form.urlInput.fill(config.baseUrl);
    }

    await this.form.submitButton.click();
    await this.dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Edit an existing provider
   */
  async editProvider(newConfig: Partial<ProviderConfig>): Promise<void> {
    await this.providers.moreButton.click();
    await this.providers.editMenuItem.click();
    await this.dialog.waitFor({ state: 'visible' });

    if (newConfig.name) {
      await this.form.nameInput.clear();
      await this.form.nameInput.fill(newConfig.name);
    }

    if (newConfig.baseUrl) {
      await this.form.urlInput.clear();
      await this.form.urlInput.fill(newConfig.baseUrl);
    }

    if (newConfig.apiKey) {
      await this.form.apiKeyInput.clear();
      await this.form.apiKeyInput.fill(newConfig.apiKey);
    }

    await this.form.saveButton.click();
    await this.dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Delete a provider (confirms deletion)
   */
  async deleteProvider(): Promise<void> {
    await this.providers.moreButton.click();
    await this.providers.deleteMenuItem.click();
    await this.dialog.waitFor({ state: 'visible' });
    await this.deleteDialog.yesButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Get provider item by name
   */
  getProviderByName(name: string): Locator {
    return this.page.locator('[class*="provider"]').filter({ hasText: name });
  }

  /**
   * Check if provider has error icon (no models available)
   */
  async hasProviderError(): Promise<boolean> {
    return this.providers.errorIcon.isVisible();
  }

  /**
   * Navigate to MCP Servers tab
   */
  async goToMCPServersTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /mcp servers/i }).click();
  }

  /**
   * Navigate to Web Search tab
   */
  async goToWebSearchTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /web search/i }).click();
  }

  /**
   * Open MCP config dialog
   */
  async openMCPConfigDialog(): Promise<void> {
    await this.mcpServers.editConfigButton.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Set MCP config JSON in the editor
   */
  async setMCPConfig(config: { mcpServers: MCPServerConfig }): Promise<void> {
    const jsonString = JSON.stringify(config, null, 2);
    await this.clearMCPConfigEditor();
    await this.page.keyboard.type(jsonString);
  }

  /**
   * Clear MCP config editor content
   */
  async clearMCPConfigEditor(): Promise<void> {
    await this.mcpConfigDialog.jsonEditor.click();
    // Use triple-click to select all content in the editor line, then select all lines
    await this.page.evaluate(() => {
      const editor = document.querySelector('.cm-editor') as HTMLElement;
      if (editor) {
        const cmContent = editor.querySelector('.cm-content') as HTMLElement;
        if (cmContent) {
          // Select all text using the selection API
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(cmContent);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    });
    await this.page.keyboard.press('Backspace');
  }

  /**
   * Save MCP config
   */
  async saveMCPConfig(): Promise<void> {
    await this.mcpConfigDialog.saveButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Get MCP server item by name
   */
  getMCPServerByName(name: string): Locator {
    return this.page.locator('div').filter({ hasText: new RegExp(`^${name}`) }).first();
  }

  /**
   * Open server dropdown menu
   */
  async openServerMenu(serverName: string, nth: number = 2): Promise<void> {
    const serverRow = this.page.locator('div').filter({ hasText: new RegExp(`^${serverName}\\d+\\/\\d+ tools enabled$`) }).nth(nth);
    await serverRow.getByRole('button', { name: 'more' }).click();
  }

  /**
   * Expand server to show tools
   */
  async expandServer(serverName: string): Promise<void> {
    const serverRow = this.page.locator('div').filter({ hasText: new RegExp(`${serverName}.*Tools enabled`) }).first();
    await serverRow.click();
  }

  /**
   * Delete a custom MCP server
   */
  async deleteMCPServer(serverName: string): Promise<void> {
    await this.openServerMenu(serverName);
    await this.mcpServerActions.delete.click();
    await this.dialog.waitFor({ state: 'visible' });
    await this.deleteDialog.yesButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Open logs dialog for a server
   */
  async openServerLogs(serverName: string): Promise<void> {
    await this.openServerMenu(serverName);
    await this.mcpServerActions.logs.click();
    await this.dialog.waitFor({ state: 'visible' });
  }
}

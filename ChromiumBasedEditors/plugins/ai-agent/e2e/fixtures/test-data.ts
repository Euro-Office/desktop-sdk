/**
 * Test Data Fixtures
 */

export const testProviders = {
  openai: {
    type: 'openai',
    name: 'Test OpenAI',
    key: 'sk-test-key-12345',
    baseUrl: 'https://api.openai.com/v1',
  },
};

export const testModels = {
  openai: [
    { id: 'gpt-5.2-2025-12-11-thinking', name: 'GPT-5.2', provider: 'openai' },
  ],
};

export const testMessages = {
  simple: 'Hello, how are you?',
  codeRequest: 'Write a function to sort an array in JavaScript',
};

/**
 * Default test provider config for UI-based provider setup
 */
export const defaultTestProvider = {
  name: 'Test Provider',
  type: 'openai',
  apiKey: 'sk-test-key',
  baseUrl: 'https://api.openai.com/v1',
};

/**
 * Create a test provider config with custom name
 */
export function testProvider(name: string) {
  return {
    name,
    type: 'openai',
    apiKey: 'sk-test-key',
    baseUrl: 'https://api.openai.com/v1',
  };
}

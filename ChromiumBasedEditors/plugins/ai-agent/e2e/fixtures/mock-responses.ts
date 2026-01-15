/**
 * Mock API Responses for Testing
 */

export const mockModelsResponse = [
  { id: 'gpt-5.2-2025-12-11', object: 'model', created: Date.now(), owned_by: 'openai' },
];

export const mockValidationSuccess = {
  status: 200,
  body: JSON.stringify({ data: mockModelsResponse }),
};

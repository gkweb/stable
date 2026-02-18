export class LLMError extends Error {
  readonly code = 'LLM_ERROR';
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

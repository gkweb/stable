export class StableError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = 'StableError';
  }
}

export class BrowserError extends StableError {
  constructor(message: string) {
    super(message, 'BROWSER_ERROR');
    this.name = 'BrowserError';
  }
}

export class LLMError extends StableError {
  constructor(message: string) {
    super(message, 'LLM_ERROR');
    this.name = 'LLMError';
  }
}

export class AgentError extends StableError {
  constructor(message: string) {
    super(message, 'AGENT_ERROR');
    this.name = 'AgentError';
  }
}

export class NotFoundError extends StableError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

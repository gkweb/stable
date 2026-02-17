export interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  supportsToolUse(): boolean;
  readonly name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  toolCallId?: string;
}

export type ContentPart = TextPart | ImagePart | ToolUsePart | ToolResultPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  data: string; // base64
  mediaType: string;
}

export interface ToolUsePart {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool_result';
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: 'end' | 'tool_use' | 'max_tokens';
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

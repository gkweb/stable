import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolCall,
  ContentPart,
} from '../types.js';
import { LLMError } from '../../shared/errors.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Anthropic({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }

  supportsToolUse(): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages = request.messages.map((m) => this.convertMessage(m));

      const response = await this.client.messages.create({
        model: request.tools?.length
          ? request.tools.length > 0
            ? 'claude-sonnet-4-5-20250929'
            : 'claude-sonnet-4-5-20250929'
          : 'claude-sonnet-4-5-20250929',
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages,
        ...(request.tools?.length
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters as Anthropic.Tool['input_schema'],
              })),
            }
          : {}),
      });

      const toolCalls: ToolCall[] = [];
      let textContent = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content: textContent || null,
        toolCalls,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason:
          response.stop_reason === 'tool_use'
            ? 'tool_use'
            : response.stop_reason === 'max_tokens'
              ? 'max_tokens'
              : 'end',
      };
    } catch (err) {
      throw new LLMError(
        `Anthropic API error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private convertMessage(msg: ChatMessage): Anthropic.MessageParam {
    if (typeof msg.content === 'string') {
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId ?? '',
              content: msg.content,
            },
          ],
        };
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content };
    }

    const parts: Anthropic.ContentBlockParam[] = [];
    for (const part of msg.content as ContentPart[]) {
      if (part.type === 'text') {
        parts.push({ type: 'text', text: part.text });
      } else if (part.type === 'image') {
        parts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: part.data,
          },
        });
      } else if (part.type === 'tool_use') {
        parts.push({
          type: 'tool_use',
          id: part.id,
          name: part.name,
          input: part.input,
        });
      } else if (part.type === 'tool_result') {
        parts.push({
          type: 'tool_result',
          tool_use_id: part.toolCallId,
          content: part.content,
          is_error: part.isError,
        });
      }
    }

    return {
      role: msg.role === 'tool' ? 'user' : (msg.role as 'user' | 'assistant'),
      content: parts,
    };
  }
}

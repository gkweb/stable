import OpenAI from 'openai';
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolCall,
  ContentPart,
} from '@stable/core';
import { LLMError } from '@stable/core';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }

  supportsToolUse(): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: request.systemPrompt },
        ...request.messages.map((m) => this.convertMessage(m)),
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        ...(request.tools?.length
          ? {
              tools: request.tools.map((t) => ({
                type: 'function' as const,
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
            }
          : {}),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMError('No response from OpenAI');
      }

      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      return {
        content: choice.message.content,
        toolCalls,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        stopReason:
          choice.finish_reason === 'tool_calls'
            ? 'tool_use'
            : choice.finish_reason === 'length'
              ? 'max_tokens'
              : 'end',
      };
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(`OpenAI API error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private convertMessage(msg: ChatMessage): OpenAI.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId ?? '',
          content: msg.content,
        };
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content };
    }

    // Multi-part content
    if (msg.role === 'assistant') {
      const parts = msg.content as ContentPart[];
      const textParts = parts.filter((p) => p.type === 'text');
      const toolParts = parts.filter((p) => p.type === 'tool_use');

      return {
        role: 'assistant',
        content: textParts.map((p) => (p.type === 'text' ? p.text : '')).join(''),
        ...(toolParts.length
          ? {
              tool_calls: toolParts
                .filter((p) => p.type === 'tool_use')
                .map((p) => {
                  if (p.type !== 'tool_use') throw new Error('unreachable');
                  return {
                    id: p.id,
                    type: 'function' as const,
                    function: { name: p.name, arguments: JSON.stringify(p.input) },
                  };
                }),
            }
          : {}),
      };
    }

    // User messages with mixed content
    const openaiParts: OpenAI.ChatCompletionContentPart[] = [];
    for (const part of msg.content as ContentPart[]) {
      if (part.type === 'text') {
        openaiParts.push({ type: 'text', text: part.text });
      } else if (part.type === 'image') {
        openaiParts.push({
          type: 'image_url',
          image_url: { url: `data:${part.mediaType};base64,${part.data}` },
        });
      }
    }

    return { role: 'user', content: openaiParts };
  }
}

import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  FunctionCallingMode,
  type GenerateContentResult,
  FinishReason,
} from '@google/generative-ai';
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolCall,
  ContentPart,
} from '../types.js';
import { LLMError } from '../../shared/errors.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;
  private model: string;
  private callCounter = 0;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new GoogleGenerativeAI(apiKey);
  }

  supportsToolUse(): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const tools = request.tools?.length
        ? [
            {
              functionDeclarations: request.tools.map(
                (t) =>
                  ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters as unknown as FunctionDeclarationSchema,
                  }) satisfies FunctionDeclaration,
              ),
            },
          ]
        : undefined;

      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: request.systemPrompt,
        tools,
        ...(tools
          ? {
              toolConfig: {
                functionCallingConfig: { mode: FunctionCallingMode.AUTO },
              },
            }
          : {}),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
          temperature: request.temperature,
        },
      });

      const contents = this.buildContents(request.messages);

      const result: GenerateContentResult = await model.generateContent({ contents });
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        throw new LLMError('No response candidate from Gemini');
      }

      // Extract text and function calls
      let textContent = '';
      const toolCalls: ToolCall[] = [];

      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          textContent += part.text;
        }
        if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `gemini-tc-${++this.callCounter}`,
            name: part.functionCall.name,
            input: (part.functionCall.args ?? {}) as Record<string, unknown>,
          });
        }
      }

      const usage = response.usageMetadata;

      return {
        content: textContent || null,
        toolCalls,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
        stopReason: this.mapFinishReason(candidate.finishReason, toolCalls.length > 0),
      };
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(`Gemini API error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private buildContents(messages: ChatMessage[]): Content[] {
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Tool results go as function responses under "user" role
        const toolContent = typeof msg.content === 'string' ? msg.content : '';
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: this.findToolName(messages, msg.toolCallId),
                response: { result: toolContent },
              },
            },
          ],
        });
        continue;
      }

      if (typeof msg.content === 'string') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
        continue;
      }

      // Multi-part content
      const parts: Part[] = [];
      for (const part of msg.content as ContentPart[]) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: part.mediaType,
              data: part.data,
            },
          });
        } else if (part.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: part.name,
              args: part.input,
            },
          });
        } else if (part.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: this.findToolName(messages, part.toolCallId),
              response: { result: part.content },
            },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    return contents;
  }

  /**
   * Look up which tool name corresponds to a given tool call ID by searching
   * previous assistant messages for matching tool_use parts.
   */
  private findToolName(messages: ChatMessage[], toolCallId?: string): string {
    if (!toolCallId) return 'unknown';
    for (const m of messages) {
      if (m.role !== 'assistant' || typeof m.content === 'string') continue;
      for (const part of m.content as ContentPart[]) {
        if (part.type === 'tool_use' && part.id === toolCallId) {
          return part.name;
        }
      }
    }
    return 'unknown';
  }

  private mapFinishReason(
    reason: FinishReason | undefined,
    hasToolCalls: boolean,
  ): 'end' | 'tool_use' | 'max_tokens' {
    if (hasToolCalls) return 'tool_use';
    if (reason === FinishReason.MAX_TOKENS) return 'max_tokens';
    return 'end';
  }
}

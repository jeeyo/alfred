import OpenAI from 'openai';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  text: string;
  tool_calls?: ToolCall[];
  raw?: Record<string, unknown>;
}

export interface CompletionOptions {
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  structured_output?: boolean; // Explicitly control JSON mode
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export abstract class LLMClient {
  model?: string;
  constructor(model?: string) {
    this.model = model;
  }
  abstract complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
}

export class DummyLLMClient extends LLMClient {
  private queueItems: string[] = [];
  constructor() {
    super('dummy');
  }
  queue(text: string): void {
    this.queueItems.push(text);
  }
  async complete(_prompt: string): Promise<LLMResponse> {
    if (this.queueItems.length === 0) {
      throw new Error('DummyLLMClient ran out of queued responses.');
    }
    const text = this.queueItems.shift() as string;
    return { text };
  }
}

export interface TransformersInitOptions {
  systemPrompt?: string;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
}

export class OpenAILLMClient extends LLMClient {
  private _llm: OpenAI;
  private _systemPrompt: string;
  private _defaultStructuredOutput: boolean;

  constructor(
    model: string,
    opts: {
      instructions?: string;
      structured_output?: boolean;
    } = {}
  ) {
    super(model);

    this._systemPrompt =
      opts.instructions ??
      'You are a JSON-only assistant that MUST reply with a single valid JSON object without extra text.\nReasoning: low\nDo not expose analysis or chain-of-thought. Respond using the final JSON only.';

    this._defaultStructuredOutput = opts.structured_output ?? true;
    this._llm = new OpenAI();
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<LLMResponse> {
    const hasTools = options.tools && options.tools.length > 0;

    // Determine if we should use structured output (JSON mode)
    // Default to true unless tools are provided or explicitly disabled
    const useStructuredOutput =
      options.structured_output ??
      (hasTools ? false : this._defaultStructuredOutput);

    // Build the request parameters
    const requestParams: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model: this.model,
      instructions: this._systemPrompt,
      input: prompt,
    };

    // Add structured output if enabled and no tools
    if (useStructuredOutput && !hasTools) {
      requestParams.text = {
        format: {
          type: 'json_object',
        },
      };
    }

    // Add tools if provided
    if (hasTools) {
      requestParams.tools = options.tools!.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters as Record<string, unknown>,
        },
      }));

      if (options.tool_choice) {
        if (typeof options.tool_choice === 'string') {
          requestParams.tool_choice = options.tool_choice;
        } else {
          requestParams.tool_choice = {
            type: 'function',
            function: { name: options.tool_choice.function.name },
          };
        }
      }
    }

    // Add optional parameters
    if (options.temperature !== undefined) {
      requestParams.temperature = options.temperature;
    }
    if (options.max_tokens !== undefined) {
      requestParams.max_output_tokens = options.max_tokens;
    }

    const response = await this._llm.responses.create(requestParams);

    console.log('response', response.output_text);

    // Extract tool calls if present
    const toolCalls: ToolCall[] | undefined = response.tool_calls
      ? response.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }))
      : undefined;

    return {
      text: response.output_text,
      tool_calls: toolCalls,
      raw: response as unknown as Record<string, unknown>,
    };
  }
}

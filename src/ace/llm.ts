import OpenAI from 'openai';

export interface LLMResponse {
  text: string;
  raw?: Record<string, unknown>;
}

export abstract class LLMClient {
  model?: string;
  constructor(model?: string) {
    this.model = model;
  }
  abstract complete(prompt: string, kwargs?: Record<string, unknown>): Promise<LLMResponse>;
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

  constructor(model: string, opts: OpenAI.Responses.ResponseCreateParamsNonStreaming = {}) {
    super(model);

    this._systemPrompt =
      opts.instructions ??
      'You are a JSON-only assistant that MUST reply with a single valid JSON object without extra text.\nReasoning: low\nDo not expose analysis or chain-of-thought. Respond using the final JSON only.';

    this._llm = new OpenAI();
  }

  async complete(prompt: string, kwargs: Record<string, unknown> = {}): Promise<LLMResponse> {
    const response = await this._llm.responses.create({
      model: this.model,
      instructions: this._systemPrompt,
      input: prompt,
      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    console.log('response', response.output_text);
    return { text: response.output_text };
  }
}

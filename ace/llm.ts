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

export class TransformersLLMClient extends LLMClient {
  private systemPrompt: string;
  private defaults: Record<string, unknown>;

  constructor(modelPath: string, opts: TransformersInitOptions = {}) {
    super(modelPath);
    this.systemPrompt =
      opts.systemPrompt ??
      'You are a JSON-only assistant that MUST reply with a single valid JSON object without extra text.\nReasoning: low\nDo not expose analysis or chain-of-thought. Respond using the final JSON only.';
    this.defaults = {
      max_new_tokens: opts.maxNewTokens ?? 512,
      temperature: opts.temperature ?? 0.0,
      top_p: opts.topP ?? 0.9,
      return_full_text: false,
    };
  }

  // Placeholder: In Node.js environment, hook up to an LLM provider if needed.
  async complete(prompt: string, kwargs: Record<string, unknown> = {}): Promise<LLMResponse> {
    const _call = { ...this.defaults, ...kwargs };
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt },
    ];
    // This client is a stub; it echoes back prompt content wrapped as JSON when possible.
    const text = JSON.stringify({ messagesLength: messages.length, note: 'Transformers client stub in TS.' });
    return { text, raw: { messages } };
  }
}

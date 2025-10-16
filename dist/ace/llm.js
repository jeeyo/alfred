export class LLMClient {
    model;
    constructor(model) {
        this.model = model;
    }
}
export class DummyLLMClient extends LLMClient {
    queueItems = [];
    constructor() {
        super('dummy');
    }
    queue(text) {
        this.queueItems.push(text);
    }
    async complete(_prompt) {
        if (this.queueItems.length === 0) {
            throw new Error('DummyLLMClient ran out of queued responses.');
        }
        const text = this.queueItems.shift();
        return { text };
    }
}
export class TransformersLLMClient extends LLMClient {
    systemPrompt;
    defaults;
    constructor(modelPath, opts = {}) {
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
    async complete(prompt, kwargs = {}) {
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

export interface LLMResponse {
    text: string;
    raw?: Record<string, unknown>;
}
export declare abstract class LLMClient {
    model?: string;
    constructor(model?: string);
    abstract complete(prompt: string, kwargs?: Record<string, unknown>): Promise<LLMResponse>;
}
export declare class DummyLLMClient extends LLMClient {
    private queueItems;
    constructor();
    queue(text: string): void;
    complete(_prompt: string): Promise<LLMResponse>;
}
export interface TransformersInitOptions {
    systemPrompt?: string;
    maxNewTokens?: number;
    temperature?: number;
    topP?: number;
}
export declare class TransformersLLMClient extends LLMClient {
    private systemPrompt;
    private defaults;
    constructor(modelPath: string, opts?: TransformersInitOptions);
    complete(prompt: string, kwargs?: Record<string, unknown>): Promise<LLMResponse>;
}

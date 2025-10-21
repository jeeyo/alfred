import { describe, it, expect } from 'vitest';
import { DummyLLMClient } from '../src/ace/llm';

describe('LLM clients', () => {
  it('DummyLLMClient throws when queue is empty', async () => {
    const client = new DummyLLMClient();
    await expect(client.complete('prompt')).rejects.toThrow(/ran out of queued responses/i);
  });

  it('DummyLLMClient returns queued responses', async () => {
    const client = new DummyLLMClient();
    client.queue('{"test": "response"}');
    const res = await client.complete('hello');
    expect(res.text).toBe('{"test": "response"}');
    expect(() => JSON.parse(res.text)).not.toThrow();
  });
});

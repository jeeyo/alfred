import { describe, it, expect } from 'vitest';
import { DummyLLMClient, TransformersLLMClient } from '../ace/llm';

describe('LLM clients', () => {
  it('DummyLLMClient throws when queue is empty', async () => {
    const client = new DummyLLMClient();
    await expect(client.complete('prompt')).rejects.toThrow(/ran out of queued responses/i);
  });

  it('TransformersLLMClient stub returns JSON text', async () => {
    const client = new TransformersLLMClient('dummy-model');
    const res = await client.complete('hello');
    expect(() => JSON.parse(res.text)).not.toThrow();
  });
});

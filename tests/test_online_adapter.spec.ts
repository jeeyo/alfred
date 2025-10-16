import { describe, it, expect } from 'vitest';
import { DummyLLMClient } from '../ace/llm';
import { Generator, Reflector, Curator } from '../ace/roles';
import { Playbook } from '../ace/playbook';
import { OnlineAdapter, Sample } from '../ace/adaptation';

class SimpleEnv {
  evaluate(sample: Sample, genOut: { final_answer: string }) {
    const gt = sample.ground_truth ?? '';
    const pred = genOut.final_answer ?? '';
    const correct = pred.trim().toLowerCase() === gt.trim().toLowerCase();
    return { feedback: correct ? 'ok' : 'diff', ground_truth: gt, metrics: { accuracy: correct ? 1 : 0 } };
  }
}

describe('OnlineAdapter', () => {
  it('processes a stream of samples', async () => {
    const client = new DummyLLMClient();

    // For two samples, we need 3 queued responses per sample: gen, refl, cur
    // Sample 1
    client.queue(JSON.stringify({ reasoning: 'r1', bullet_ids: [], final_answer: '42' }));
    client.queue(JSON.stringify({ reasoning: 'rr1', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k1', bullet_tags: [] }));
    client.queue(JSON.stringify({ reasoning: 'c1', operations: [] }));

    // Sample 2
    client.queue(JSON.stringify({ reasoning: 'r2', bullet_ids: [], final_answer: 'ok' }));
    client.queue(JSON.stringify({ reasoning: 'rr2', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k2', bullet_tags: [] }));
    client.queue(JSON.stringify({ reasoning: 'c2', operations: [] }));

    const adapter = new OnlineAdapter({
      playbook: new Playbook(),
      generator: new Generator(client),
      reflector: new Reflector(client),
      curator: new Curator(client),
      max_refinement_rounds: 1,
    });

    const samples: Sample[] = [
      { question: 'return 42', ground_truth: '42' },
      { question: 'say ok', ground_truth: 'ok' },
    ];

    const results = await adapter.run(samples, new SimpleEnv() as any);
    expect(results.length).toBe(2);
    expect(results[0].environment_result.metrics.accuracy).toBe(1);
    expect(results[1].environment_result.metrics.accuracy).toBe(1);
  });
});

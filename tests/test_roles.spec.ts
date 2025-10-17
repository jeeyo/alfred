import { describe, it, expect } from 'vitest';
import { DummyLLMClient } from '../src/ace/llm';
import { Generator, Reflector, Curator } from '../src/ace/roles';
import { Playbook } from '../src/ace/playbook';

function queueJson(client: DummyLLMClient, obj: unknown) {
  client.queue(JSON.stringify(obj));
}

describe('Roles', () => {
  it('Generator retries on invalid JSON then succeeds', async () => {
    const client = new DummyLLMClient();
    const gen = new Generator(client);
    const pb = new Playbook();

    client.queue('not json');
    queueJson(client, { reasoning: 'ok', bullet_ids: [1, 'b-2'], final_answer: '42' });

    const out = await gen.generate({ question: 'q', context: '', playbook: pb, reflection: '' });
    expect(out.final_answer).toBe('42');
    expect(out.bullet_ids).toEqual(['1', 'b-2']);
  });

  it('Reflector extracts bullet tags and normalizes tag case', async () => {
    const client = new DummyLLMClient();
    const refl = new Reflector(client);
    const gen = new Generator(client);
    const pb = new Playbook();

    // generator output
    queueJson(client, { reasoning: 'r', bullet_ids: [], final_answer: 'A' });

    // reflector output (mixed case tag)
    queueJson(client, { reasoning: 'x', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k', bullet_tags: [{ id: 's-1', tag: 'Helpful' }] });

    const g = await gen.generate({ question: 'q', context: '', playbook: pb, reflection: '' });
    const r = await refl.reflect({ question: 'q', generator_output: g, playbook: pb, ground_truth: null, feedback: 'f', max_refinement_rounds: 1 });
    expect(r.bullet_tags.length).toBe(1);
    expect(r.bullet_tags[0].tag).toBe('helpful');
  });

  it('Curator returns DeltaBatch from JSON', async () => {
    const client = new DummyLLMClient();
    const cur = new Curator(client);
    const pb = new Playbook();

    queueJson(client, { reasoning: 'merge', operations: [ { type: 'ADD', section: 'learned', content: 'new tip', metadata: { helpful: 1 } } ] });

    const out = await cur.curate({ reflection: { reasoning: '', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: '', bullet_tags: [], raw: {} }, playbook: pb, question_context: 'ctx', progress: 'p' });
    expect(out.delta.operations.length).toBe(1);
    expect(out.delta.operations[0].type).toBe('ADD');
  });
});

import { describe, it, expect } from 'vitest';
import { DummyLLMClient } from '../ace/llm';
import { Generator, Reflector, Curator } from '../ace/roles';
import { OfflineAdapter } from '../ace/adaptation';
import { Playbook } from '../ace/playbook';
class SimpleQAEnvironment {
    evaluate(sample, generator_output) {
        const ground = sample.ground_truth ?? '';
        const pred = generator_output.final_answer ?? '';
        const correct = pred.trim().toLowerCase() === ground.trim().toLowerCase();
        return {
            feedback: correct ? 'correct' : `expected ${ground} but got ${pred}`,
            ground_truth: ground,
            metrics: { accuracy: correct ? 1 : 0 },
        };
    }
}
describe('OfflineAdapter', () => {
    it('single step updates playbook', async () => {
        const client = new DummyLLMClient();
        client.queue(JSON.stringify({ reasoning: 'The answer is given in the playbook.', bullet_ids: [], final_answer: '42' }));
        client.queue(JSON.stringify({ reasoning: 'Prediction matches ground truth.', error_identification: '', root_cause_analysis: '', correct_approach: 'Keep leveraging the playbook.', key_insight: 'Store that 42 is the default answer.', bullet_tags: [] }));
        client.queue(JSON.stringify({ reasoning: 'Adding a reminder for future tasks.', operations: [{ type: 'ADD', section: 'default_answers', content: 'If the question mentions life, universe, and everything, answer 42.', metadata: { helpful: 1 } }] }));
        const playbook = new Playbook();
        const generator = new Generator(client);
        const reflector = new Reflector(client);
        const curator = new Curator(client);
        const adapter = new OfflineAdapter({ playbook, generator, reflector, curator, max_refinement_rounds: 1 });
        const sample = { question: 'What is the answer to life, the universe, and everything?', ground_truth: '42' };
        const environment = new SimpleQAEnvironment();
        const results = await adapter.run([sample], environment, 1);
        expect(results.length).toBe(1);
        expect(results[0].generator_output.final_answer).toBe('42');
        const stats = playbook.stats();
        expect(stats.sections).toBeGreaterThanOrEqual(1);
    });
});

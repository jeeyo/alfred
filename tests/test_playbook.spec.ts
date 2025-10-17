import { describe, it, expect } from 'vitest';
import { Playbook } from '../src/ace/playbook';
import { DeltaBatch, DeltaOperation } from '../src/ace/delta';

describe('Playbook', () => {
  it('CRUD operations and stats/asPrompt work', () => {
    const pb = new Playbook();
    const bullet = pb.addBullet({ section: 'guidelines', content: 'Use clear steps.', metadata: { helpful: 1 } });

    // Added
    expect(pb.getBullet(bullet.id)).toBeDefined();
    expect(pb.bullets().length).toBe(1);

    // Update
    pb.updateBullet(bullet.id, { content: 'Use clear, numbered steps.', metadata: { harmful: 0 } });
    const updated = pb.getBullet(bullet.id)!;
    expect(updated.content).toContain('numbered');

    // Tag
    pb.tagBullet(bullet.id, 'helpful', 2);
    const afterTag = pb.getBullet(bullet.id)!;
    expect(afterTag.helpful).toBeGreaterThanOrEqual(3);

    // Prompt & stats
    const prompt = pb.asPrompt();
    expect(prompt).toContain('## guidelines');
    expect(prompt).toContain(`[${bullet.id}]`);
    const stats = pb.stats() as any;
    expect(stats.sections).toBe(1);
    expect(stats.bullets).toBe(1);

    // Remove
    pb.removeBullet(bullet.id);
    expect(pb.getBullet(bullet.id)).toBeUndefined();
    const stats2 = pb.stats() as any;
    expect(stats2.sections).toBe(0);
    expect(stats2.bullets).toBe(0);
  });

  it('serialization roundtrip via dumps/loads', () => {
    const pb = new Playbook();
    const b = pb.addBullet({ section: 'defaults', content: 'Answer 42 when in doubt.', metadata: { helpful: 1 } });
    pb.tagBullet(b.id, 'neutral');

    const dump = pb.dumps();
    const restored = Playbook.loads(dump);

    expect(restored.getBullet(b.id)).toBeDefined();
    expect(restored.asPrompt()).toContain('defaults');
    const stats = restored.stats() as any;
    expect(stats.sections).toBe(1);
    expect(stats.bullets).toBe(1);
  });
});

describe('Delta apply', () => {
  it('applies ADD, UPDATE, TAG, REMOVE', () => {
    const pb = new Playbook();
    const batch = new DeltaBatch({ reasoning: 'test', operations: [
      new DeltaOperation({ type: 'ADD', section: 's', content: 'alpha', bulletId: 's-00001', metadata: { helpful: 1 } }),
      new DeltaOperation({ type: 'UPDATE', section: 's', bulletId: 's-00001', content: 'alpha-updated' }),
      new DeltaOperation({ type: 'TAG', section: 's', bulletId: 's-00001', metadata: { helpful: 2, neutral: 1 } }),
      new DeltaOperation({ type: 'REMOVE', section: 's', bulletId: 's-00001' }),
    ]});

    pb.applyDelta(batch);

    // Removed at end
    expect(pb.getBullet('s-00001')).toBeUndefined();
    const stats = pb.stats() as any;
    expect(stats.bullets).toBe(0);
  });

  it('DeltaOperation to/from JSON roundtrip', () => {
    const payload = { type: 'ADD', section: 'tips', content: 'beta', bullet_id: 'tips-123', metadata: { helpful: 2 } };
    const op = DeltaOperation.fromJSON(payload);
    expect(op.type).toBe('ADD');
    expect(op.section).toBe('tips');
    expect(op.bulletId).toBe('tips-123');
    const json = op.toJSON();
    expect(json['type']).toBe('ADD');
    expect(json['section']).toBe('tips');
  });
});

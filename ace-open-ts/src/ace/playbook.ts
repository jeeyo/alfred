import { DeltaBatch, DeltaOperation } from './delta';

export class Bullet {
  id: string;
  section: string;
  content: string;
  helpful: number;
  harmful: number;
  neutral: number;
  createdAt: string;
  updatedAt: string;

  constructor(params: {
    id: string;
    section: string;
    content: string;
    helpful?: number;
    harmful?: number;
    neutral?: number;
    createdAt?: string;
    updatedAt?: string;
  }) {
    this.id = params.id;
    this.section = params.section;
    this.content = params.content;
    this.helpful = params.helpful ?? 0;
    this.harmful = params.harmful ?? 0;
    this.neutral = params.neutral ?? 0;
    const nowIso = new Date().toISOString();
    this.createdAt = params.createdAt ?? nowIso;
    this.updatedAt = params.updatedAt ?? nowIso;
  }

  applyMetadata(metadata: Record<string, number>): void {
    for (const [key, value] of Object.entries(metadata)) {
      if ((this as any)[key] != null) {
        (this as any)[key] = Number(value);
      }
    }
  }

  tag(tag: string, increment: number = 1): void {
    if (!['helpful', 'harmful', 'neutral'].includes(tag)) {
      throw new Error(`Unsupported tag: ${tag}`);
    }
    const current = (this as any)[tag] as number;
    (this as any)[tag] = current + increment;
    this.updatedAt = new Date().toISOString();
  }
}

export class Playbook {
  private bulletsById: Record<string, Bullet> = {};
  private sections: Record<string, string[]> = {};
  private nextId: number = 0;

  addBullet(params: {
    section: string;
    content: string;
    bulletId?: string;
    metadata?: Record<string, number>;
  }): Bullet {
    const bulletId = params.bulletId ?? this.generateId(params.section);
    const metadata = params.metadata ?? {};
    const bullet = new Bullet({ id: bulletId, section: params.section, content: params.content });
    bullet.applyMetadata(metadata);
    this.bulletsById[bulletId] = bullet;
    if (!this.sections[params.section]) this.sections[params.section] = [];
    this.sections[params.section].push(bulletId);
    return bullet;
  }

  updateBullet(bulletId: string, params: { content?: string; metadata?: Record<string, number> }): Bullet | null {
    const bullet = this.bulletsById[bulletId];
    if (!bullet) return null;
    if (params.content != null) bullet.content = params.content;
    if (params.metadata && Object.keys(params.metadata).length > 0) bullet.applyMetadata(params.metadata);
    bullet.updatedAt = new Date().toISOString();
    return bullet;
  }

  tagBullet(bulletId: string, tag: string, increment: number = 1): Bullet | null {
    const bullet = this.bulletsById[bulletId];
    if (!bullet) return null;
    bullet.tag(tag, increment);
    return bullet;
  }

  removeBullet(bulletId: string): void {
    const bullet = this.bulletsById[bulletId];
    if (!bullet) return;
    delete this.bulletsById[bulletId];
    const list = this.sections[bullet.section];
    if (Array.isArray(list)) {
      this.sections[bullet.section] = list.filter((id) => id !== bulletId);
      if (this.sections[bullet.section].length === 0) {
        delete this.sections[bullet.section];
      }
    }
  }

  getBullet(bulletId: string): Bullet | undefined {
    return this.bulletsById[bulletId];
  }

  bullets(): Bullet[] {
    return Object.values(this.bulletsById);
  }

  toDict(): Record<string, unknown> {
    return {
      bullets: Object.fromEntries(
        Object.entries(this.bulletsById).map(([id, b]) => [id, { ...b }])
      ),
      sections: this.sections,
      next_id: this.nextId,
    };
  }

  static fromDict(payload: Record<string, unknown>): Playbook {
    const instance = new Playbook();
    const bulletsPayload = (payload['bullets'] ?? {}) as Record<string, any>;
    for (const [bulletId, bulletValue] of Object.entries(bulletsPayload)) {
      if (bulletValue && typeof bulletValue === 'object') {
        const b = bulletValue as Record<string, any>;
        instance.bulletsById[bulletId] = new Bullet({
          id: String(b['id'] ?? bulletId),
          section: String(b['section'] ?? ''),
          content: String(b['content'] ?? ''),
          helpful: Number(b['helpful'] ?? 0),
          harmful: Number(b['harmful'] ?? 0),
          neutral: Number(b['neutral'] ?? 0),
          createdAt: String(b['created_at'] ?? b['createdAt'] ?? new Date().toISOString()),
          updatedAt: String(b['updated_at'] ?? b['updatedAt'] ?? new Date().toISOString()),
        });
      }
    }
    const sectionsPayload = (payload['sections'] ?? {}) as Record<string, unknown>;
    for (const [section, ids] of Object.entries(sectionsPayload)) {
      if (Array.isArray(ids)) instance.sections[section] = ids.map((x) => String(x));
    }
    instance.nextId = Number((payload as any)['next_id'] ?? 0);
    return instance;
  }

  dumps(): string {
    return JSON.stringify(this.toDict(), null, 2);
  }

  static loads(data: string): Playbook {
    const payload = JSON.parse(data);
    if (!payload || typeof payload !== 'object') {
      throw new Error('Playbook serialization must be a JSON object.');
    }
    return Playbook.fromDict(payload as Record<string, unknown>);
  }

  applyDelta(delta: DeltaBatch): void {
    for (const operation of delta.operations) {
      this.applyOperation(operation);
    }
  }

  private applyOperation(operation: DeltaOperation): void {
    const opType = operation.type.toUpperCase();
    if (opType === 'ADD') {
      this.addBullet({
        section: operation.section,
        content: operation.content ?? '',
        bulletId: operation.bulletId,
        metadata: operation.metadata,
      });
    } else if (opType === 'UPDATE') {
      if (!operation.bulletId) return;
      this.updateBullet(operation.bulletId, {
        content: operation.content,
        metadata: operation.metadata,
      });
    } else if (opType === 'TAG') {
      if (!operation.bulletId) return;
      for (const [tag, inc] of Object.entries(operation.metadata)) {
        this.tagBullet(operation.bulletId, tag, inc);
      }
    } else if (opType === 'REMOVE') {
      if (!operation.bulletId) return;
      this.removeBullet(operation.bulletId);
    }
  }

  asPrompt(): string {
    const parts: string[] = [];
    for (const section of Object.keys(this.sections).sort()) {
      parts.push(`## ${section}`);
      const bulletIds = this.sections[section];
      for (const bulletId of bulletIds) {
        const bullet = this.bulletsById[bulletId];
        if (!bullet) continue;
        const counters = `(helpful=${bullet.helpful}, harmful=${bullet.harmful}, neutral=${bullet.neutral})`;
        parts.push(`- [${bullet.id}] ${bullet.content} ${counters}`);
      }
    }
    return parts.join('\n');
  }

  stats(): Record<string, unknown> {
    const tags = { helpful: 0, harmful: 0, neutral: 0 };
    for (const b of Object.values(this.bulletsById)) {
      tags.helpful += b.helpful;
      tags.harmful += b.harmful;
      tags.neutral += b.neutral;
    }
    return {
      sections: Object.keys(this.sections).length,
      bullets: Object.keys(this.bulletsById).length,
      tags,
    };
  }

  private generateId(section: string): string {
    this.nextId += 1;
    const prefix = section.split(' ')[0]?.toLowerCase() || 'sec';
    return `${prefix}-${String(this.nextId).padStart(5, '0')}`;
  }
}

export type OperationType = 'ADD' | 'UPDATE' | 'TAG' | 'REMOVE';

export class DeltaOperation {
  readonly type: OperationType;
  readonly section: string;
  readonly content?: string;
  readonly bulletId?: string;
  readonly metadata: Record<string, number>;

  constructor(params: {
    type: OperationType;
    section: string;
    content?: string;
    bulletId?: string;
    metadata?: Record<string, number>;
  }) {
    this.type = params.type;
    this.section = params.section;
    this.content = params.content;
    this.bulletId = params.bulletId;
    this.metadata = { ...(params.metadata || {}) };
  }

  static fromJSON(payload: Record<string, unknown>): DeltaOperation {
    const metadata: Record<string, number> = {};
    const md = (payload['metadata'] ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(md)) {
      const parsed = Number(v);
      if (!Number.isNaN(parsed)) metadata[String(k)] = parsed;
    }
    return new DeltaOperation({
      type: String(payload['type']).toUpperCase() as OperationType,
      section: String(payload['section'] ?? ''),
      content: (payload['content'] != null ? String(payload['content']) : undefined),
      bulletId: (payload['bullet_id'] != null ? String(payload['bullet_id']) : undefined),
      metadata,
    });
  }

  toJSON(): Record<string, unknown> {
    const data: Record<string, unknown> = {
      type: this.type,
      section: this.section,
    };
    if (this.content != null) data['content'] = this.content;
    if (this.bulletId != null) data['bullet_id'] = this.bulletId;
    if (Object.keys(this.metadata).length > 0) data['metadata'] = this.metadata;
    return data;
  }
}

export class DeltaBatch {
  reasoning: string;
  operations: DeltaOperation[];

  constructor(params: { reasoning: string; operations?: DeltaOperation[] }) {
    this.reasoning = params.reasoning;
    this.operations = params.operations ?? [];
  }

  static fromJSON(payload: Record<string, unknown>): DeltaBatch {
    const operations: DeltaOperation[] = [];
    const ops = payload['operations'];
    if (Array.isArray(ops)) {
      for (const item of ops) {
        if (item && typeof item === 'object') {
          operations.push(DeltaOperation.fromJSON(item as Record<string, unknown>));
        }
      }
    }
    return new DeltaBatch({ reasoning: String(payload['reasoning'] ?? ''), operations });
  }

  toJSON(): Record<string, unknown> {
    return {
      reasoning: this.reasoning,
      operations: this.operations.map((op) => op.toJSON()),
    };
  }
}

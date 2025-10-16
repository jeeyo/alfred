export class DeltaOperation {
    type;
    section;
    content;
    bulletId;
    metadata;
    constructor(params) {
        this.type = params.type;
        this.section = params.section;
        this.content = params.content;
        this.bulletId = params.bulletId;
        this.metadata = { ...(params.metadata || {}) };
    }
    static fromJSON(payload) {
        const metadata = {};
        const md = (payload['metadata'] ?? {});
        for (const [k, v] of Object.entries(md)) {
            const parsed = Number(v);
            if (!Number.isNaN(parsed))
                metadata[String(k)] = parsed;
        }
        return new DeltaOperation({
            type: String(payload['type']).toUpperCase(),
            section: String(payload['section'] ?? ''),
            content: (payload['content'] != null ? String(payload['content']) : undefined),
            bulletId: (payload['bullet_id'] != null ? String(payload['bullet_id']) : undefined),
            metadata,
        });
    }
    toJSON() {
        const data = {
            type: this.type,
            section: this.section,
        };
        if (this.content != null)
            data['content'] = this.content;
        if (this.bulletId != null)
            data['bullet_id'] = this.bulletId;
        if (Object.keys(this.metadata).length > 0)
            data['metadata'] = this.metadata;
        return data;
    }
}
export class DeltaBatch {
    reasoning;
    operations;
    constructor(params) {
        this.reasoning = params.reasoning;
        this.operations = params.operations ?? [];
    }
    static fromJSON(payload) {
        const operations = [];
        const ops = payload['operations'];
        if (Array.isArray(ops)) {
            for (const item of ops) {
                if (item && typeof item === 'object') {
                    operations.push(DeltaOperation.fromJSON(item));
                }
            }
        }
        return new DeltaBatch({ reasoning: String(payload['reasoning'] ?? ''), operations });
    }
    toJSON() {
        return {
            reasoning: this.reasoning,
            operations: this.operations.map((op) => op.toJSON()),
        };
    }
}

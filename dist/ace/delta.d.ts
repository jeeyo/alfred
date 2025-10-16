export type OperationType = 'ADD' | 'UPDATE' | 'TAG' | 'REMOVE';
export declare class DeltaOperation {
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
    });
    static fromJSON(payload: Record<string, unknown>): DeltaOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DeltaBatch {
    reasoning: string;
    operations: DeltaOperation[];
    constructor(params: {
        reasoning: string;
        operations?: DeltaOperation[];
    });
    static fromJSON(payload: Record<string, unknown>): DeltaBatch;
    toJSON(): Record<string, unknown>;
}

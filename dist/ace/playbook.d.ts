import { DeltaBatch } from './delta';
export declare class Bullet {
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
    });
    applyMetadata(metadata: Record<string, number>): void;
    tag(tag: string, increment?: number): void;
}
export declare class Playbook {
    private bulletsById;
    private sections;
    private nextId;
    addBullet(params: {
        section: string;
        content: string;
        bulletId?: string;
        metadata?: Record<string, number>;
    }): Bullet;
    updateBullet(bulletId: string, params: {
        content?: string;
        metadata?: Record<string, number>;
    }): Bullet | null;
    tagBullet(bulletId: string, tag: string, increment?: number): Bullet | null;
    removeBullet(bulletId: string): void;
    getBullet(bulletId: string): Bullet | undefined;
    bullets(): Bullet[];
    toDict(): Record<string, unknown>;
    static fromDict(payload: Record<string, unknown>): Playbook;
    dumps(): string;
    static loads(data: string): Playbook;
    applyDelta(delta: DeltaBatch): void;
    private applyOperation;
    asPrompt(): string;
    stats(): Record<string, unknown>;
    private generateId;
}

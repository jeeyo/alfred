import { DeltaBatch } from './delta';
import { LLMClient } from './llm';
import { Playbook } from './playbook';
export interface GeneratorOutput {
    reasoning: string;
    final_answer: string;
    bullet_ids: string[];
    raw: Record<string, unknown>;
}
export declare class Generator {
    private llm;
    private promptTemplate;
    private maxRetries;
    constructor(llm: LLMClient, promptTemplate?: string, maxRetries?: number);
    generate(params: {
        question: string;
        context?: string | null;
        playbook: Playbook;
        reflection?: string | null;
        kwargs?: Record<string, unknown>;
    }): Promise<GeneratorOutput>;
}
export interface BulletTag {
    id: string;
    tag: string;
}
export interface ReflectorOutput {
    reasoning: string;
    error_identification: string;
    root_cause_analysis: string;
    correct_approach: string;
    key_insight: string;
    bullet_tags: BulletTag[];
    raw: Record<string, unknown>;
}
export declare class Reflector {
    private llm;
    private promptTemplate;
    private maxRetries;
    constructor(llm: LLMClient, promptTemplate?: string, maxRetries?: number);
    private makePlaybookExcerpt;
    reflect(params: {
        question: string;
        generator_output: GeneratorOutput;
        playbook: Playbook;
        ground_truth?: string | null;
        feedback?: string | null;
        max_refinement_rounds?: number;
        kwargs?: Record<string, unknown>;
    }): Promise<ReflectorOutput>;
}
export interface CuratorOutput {
    delta: DeltaBatch;
    raw: Record<string, unknown>;
}
export declare class Curator {
    private llm;
    private promptTemplate;
    private maxRetries;
    constructor(llm: LLMClient, promptTemplate?: string, maxRetries?: number);
    curate(params: {
        reflection: ReflectorOutput;
        playbook: Playbook;
        question_context: string;
        progress: string;
        kwargs?: Record<string, unknown>;
    }): Promise<CuratorOutput>;
}

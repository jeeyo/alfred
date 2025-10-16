import { Curator, Generator, Reflector, ReflectorOutput, GeneratorOutput, CuratorOutput } from './roles';
import { Playbook } from './playbook';
export interface Sample {
    question: string;
    context?: string;
    ground_truth?: string | null;
    metadata?: Record<string, unknown>;
}
export interface EnvironmentResult {
    feedback: string;
    ground_truth?: string | null;
    metrics: Record<string, number>;
}
export interface TaskEnvironment {
    evaluate(sample: Sample, generator_output: GeneratorOutput): EnvironmentResult;
}
export interface AdapterStepResult {
    sample: Sample;
    generator_output: GeneratorOutput;
    environment_result: EnvironmentResult;
    reflection: ReflectorOutput;
    curator_output: CuratorOutput;
    playbook_snapshot: string;
}
export declare class AdapterBase {
    protected playbook: Playbook;
    protected generator: Generator;
    protected reflector: Reflector;
    protected curator: Curator;
    protected max_refinement_rounds: number;
    protected reflection_window: number;
    private recentReflections;
    constructor(params: {
        playbook?: Playbook;
        generator: Generator;
        reflector: Reflector;
        curator: Curator;
        max_refinement_rounds?: number;
        reflection_window?: number;
    });
    private reflectionContext;
    private updateRecentReflections;
    private applyBulletTags;
    private questionContext;
    private progressString;
    protected processSample(params: {
        sample: Sample;
        environment: TaskEnvironment;
        epoch: number;
        totalEpochs: number;
        stepIndex: number;
        totalSteps: number;
    }): Promise<AdapterStepResult>;
}
export declare class OfflineAdapter extends AdapterBase {
    run(samples: Sample[], environment: TaskEnvironment, epochs?: number): Promise<AdapterStepResult[]>;
}
export declare class OnlineAdapter extends AdapterBase {
    run(samples: Iterable<Sample>, environment: TaskEnvironment): Promise<AdapterStepResult[]>;
}

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

export class AdapterBase {
  protected playbook: Playbook;
  protected generator: Generator;
  protected reflector: Reflector;
  protected curator: Curator;
  protected max_refinement_rounds: number;
  protected reflection_window: number;
  private recentReflections: string[] = [];

  constructor(params: {
    playbook?: Playbook;
    generator: Generator;
    reflector: Reflector;
    curator: Curator;
    max_refinement_rounds?: number;
    reflection_window?: number;
  }) {
    this.playbook = params.playbook ?? new Playbook();
    this.generator = params.generator;
    this.reflector = params.reflector;
    this.curator = params.curator;
    this.max_refinement_rounds = params.max_refinement_rounds ?? 1;
    this.reflection_window = params.reflection_window ?? 3;
  }

  private reflectionContext(): string {
    return this.recentReflections.join('\n---\n');
  }

  private updateRecentReflections(reflection: ReflectorOutput): void {
    this.recentReflections.push(JSON.stringify(reflection.raw));
    if (this.recentReflections.length > this.reflection_window) {
      this.recentReflections = this.recentReflections.slice(-this.reflection_window);
    }
  }

  private applyBulletTags(reflection: ReflectorOutput): void {
    for (const tag of reflection.bullet_tags) {
      try {
        this.playbook.tagBullet(tag.id, tag.tag, 1);
      } catch {
        // ignore missing bullets
      }
    }
  }

  private questionContext(sample: Sample, env: EnvironmentResult): string {
    const parts = [
      `question: ${sample.question}`,
      `context: ${sample.context ?? ''}`,
      `metadata: ${JSON.stringify(sample.metadata ?? {})}`,
      `feedback: ${env.feedback}`,
      `ground_truth: ${env.ground_truth ?? ''}`,
    ];
    return parts.join('\n');
  }

  private progressString(epoch: number, totalEpochs: number, step: number, totalSteps: number): string {
    return `epoch ${epoch}/${totalEpochs} · sample ${step}/${totalSteps}`;
  }

  protected async processSample(params: {
    sample: Sample;
    environment: TaskEnvironment;
    epoch: number;
    totalEpochs: number;
    stepIndex: number;
    totalSteps: number;
  }): Promise<AdapterStepResult> {
    const generator_output = await this.generator.generate({
      question: params.sample.question,
      context: params.sample.context,
      playbook: this.playbook,
      reflection: this.reflectionContext(),
    });

    const env_result = params.environment.evaluate(params.sample, generator_output);

    const reflection = await this.reflector.reflect({
      question: params.sample.question,
      generator_output,
      playbook: this.playbook,
      ground_truth: params.sample.ground_truth ?? null,
      feedback: env_result.feedback,
      max_refinement_rounds: this.max_refinement_rounds,
    });
    this.applyBulletTags(reflection);
    this.updateRecentReflections(reflection);

    const curator_output = await this.curator.curate({
      reflection,
      playbook: this.playbook,
      question_context: this.questionContext(params.sample, env_result),
      progress: this.progressString(params.epoch, params.totalEpochs, params.stepIndex, params.totalSteps),
    });
    this.playbook.applyDelta(curator_output.delta);

    return {
      sample: params.sample,
      generator_output,
      environment_result: env_result,
      reflection,
      curator_output,
      playbook_snapshot: this.playbook.asPrompt(),
    };
  }
}

export class OfflineAdapter extends AdapterBase {
  async run(samples: Sample[], environment: TaskEnvironment, epochs = 1): Promise<AdapterStepResult[]> {
    const results: AdapterStepResult[] = [];
    const totalSteps = samples.length;
    for (let epoch = 1; epoch <= epochs; epoch++) {
      for (let idx = 0; idx < samples.length; idx++) {
        const sample = samples[idx];
        const stepIndex = idx + 1;
        const result = await this.processSample({
          sample,
          environment,
          epoch,
          totalEpochs: epochs,
          stepIndex,
          totalSteps,
        });
        results.push(result);
      }
    }
    return results;
  }
}

export class OnlineAdapter extends AdapterBase {
  async run(samples: Iterable<Sample>, environment: TaskEnvironment): Promise<AdapterStepResult[]> {
    const results: AdapterStepResult[] = [];
    let stepIndex = 0;
    for (const sample of samples) {
      stepIndex += 1;
      const result = await this.processSample({
        sample,
        environment,
        epoch: 1,
        totalEpochs: 1,
        stepIndex,
        totalSteps: stepIndex,
      });
      results.push(result);
    }
    return results;
  }
}

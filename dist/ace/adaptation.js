import { Playbook } from './playbook';
export class AdapterBase {
    playbook;
    generator;
    reflector;
    curator;
    max_refinement_rounds;
    reflection_window;
    recentReflections = [];
    constructor(params) {
        this.playbook = params.playbook ?? new Playbook();
        this.generator = params.generator;
        this.reflector = params.reflector;
        this.curator = params.curator;
        this.max_refinement_rounds = params.max_refinement_rounds ?? 1;
        this.reflection_window = params.reflection_window ?? 3;
    }
    reflectionContext() {
        return this.recentReflections.join('\n---\n');
    }
    updateRecentReflections(reflection) {
        this.recentReflections.push(JSON.stringify(reflection.raw));
        if (this.recentReflections.length > this.reflection_window) {
            this.recentReflections = this.recentReflections.slice(-this.reflection_window);
        }
    }
    applyBulletTags(reflection) {
        for (const tag of reflection.bullet_tags) {
            try {
                this.playbook.tagBullet(tag.id, tag.tag, 1);
            }
            catch {
                // ignore missing bullets
            }
        }
    }
    questionContext(sample, env) {
        const parts = [
            `question: ${sample.question}`,
            `context: ${sample.context ?? ''}`,
            `metadata: ${JSON.stringify(sample.metadata ?? {})}`,
            `feedback: ${env.feedback}`,
            `ground_truth: ${env.ground_truth ?? ''}`,
        ];
        return parts.join('\n');
    }
    progressString(epoch, totalEpochs, step, totalSteps) {
        return `epoch ${epoch}/${totalEpochs} · sample ${step}/${totalSteps}`;
    }
    async processSample(params) {
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
    async run(samples, environment, epochs = 1) {
        const results = [];
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
    async run(samples, environment) {
        const results = [];
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

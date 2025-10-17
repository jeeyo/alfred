import { OpenAILLMClient } from './ace/llm';
import { Generator, Reflector, Curator } from './ace/roles';
import { Playbook } from './ace/playbook';

export interface AceInitResult {
  results: {
    question: string;
    final_answer: string;
    accuracy: number;
  }[];
  playbook: string;
}

export async function runAceDemo(): Promise<AceInitResult> {
  const llm = new OpenAILLMClient('gpt-5-nano');

  const playbook = new Playbook();
  const generator = new Generator(llm);
  const reflector = new Reflector(llm);
  const curator = new Curator(llm);

  const samples = [
    { question: 'return 42', ground_truth: '42' },
    { question: 'say ok', ground_truth: 'ok' },
  ];

  const simpleEnv = {
    evaluate(sample: { ground_truth?: string | null }, genOut: { final_answer: string }) {
      const gt = sample.ground_truth ?? '';
      const pred = genOut.final_answer ?? '';
      const correct = pred.trim().toLowerCase() === gt.trim().toLowerCase();
      return { feedback: correct ? 'ok' : 'diff', ground_truth: gt, metrics: { accuracy: correct ? 1 : 0 } };
    },
  };

  const results = [] as AceInitResult['results'];

  // Inline minimal processing loop (single epoch)
  for (const sample of samples) {
    const genOut = await generator.generate({
      question: sample.question,
      context: '',
      playbook,
      reflection: '',
    });

    const envRes = simpleEnv.evaluate(sample, genOut);

    const reflOut = await reflector.reflect({
      question: sample.question,
      generator_output: genOut,
      playbook,
      ground_truth: sample.ground_truth ?? null,
      feedback: envRes.feedback,
      max_refinement_rounds: 1,
    });

    const curOut = await curator.curate({
      reflection: reflOut,
      playbook,
      question_context: `question: ${sample.question}`,
      progress: 'demo',
    });

    playbook.applyDelta(curOut.delta);

    results.push({ question: sample.question, final_answer: genOut.final_answer, accuracy: envRes.metrics.accuracy });
  }

  return { results, playbook: playbook.asPrompt() };
}

runAceDemo().then((out) => {
  console.log(JSON.stringify(out, null, 2));
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

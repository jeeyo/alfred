import { DummyLLMClient } from './llm';
import { Generator, Reflector, Curator } from './roles';
import { Playbook } from './playbook';

export interface AceInitResult {
  results: {
    question: string;
    final_answer: string;
    accuracy: number;
  }[];
  playbook: string;
}

// A minimal ACE flow using the DummyLLMClient and a trivial environment.
export async function runAceDemo(): Promise<AceInitResult> {
  const llm = new DummyLLMClient();

  // Queue three responses per sample: generator, reflector, curator
  llm.queue(JSON.stringify({ reasoning: 'r1', bullet_ids: [], final_answer: '42' }));
  llm.queue(JSON.stringify({ reasoning: 'rr1', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k1', bullet_tags: [] }));
  llm.queue(JSON.stringify({ reasoning: 'c1', operations: [] }));

  llm.queue(JSON.stringify({ reasoning: 'r2', bullet_ids: [], final_answer: 'ok' }));
  llm.queue(JSON.stringify({ reasoning: 'rr2', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k2', bullet_tags: [] }));
  llm.queue(JSON.stringify({ reasoning: 'c2', operations: [] }));

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
    const genOut = await generator.generate({ question: sample.question, context: '', playbook, reflection: '' });
    const envRes = simpleEnv.evaluate(sample, genOut);
    const reflOut = await reflector.reflect({ question: sample.question, generator_output: genOut, playbook, ground_truth: sample.ground_truth ?? null, feedback: envRes.feedback, max_refinement_rounds: 1 });
    const curOut = await curator.curate({ reflection: reflOut, playbook, question_context: `question: ${sample.question}`, progress: 'demo' });
    playbook.applyDelta(curOut.delta);

    results.push({ question: sample.question, final_answer: genOut.final_answer, accuracy: envRes.metrics.accuracy });
  }

  return { results, playbook: playbook.asPrompt() };
}

// If run directly with ts-node or node (after build), execute the demo
if (import.meta.url === (typeof document === 'undefined' ? `file://${process.argv[1]}` : '')) {
  runAceDemo().then((out) => {
    console.log(JSON.stringify(out, null, 2));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

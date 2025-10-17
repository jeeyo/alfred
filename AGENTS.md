# ACE Module Overview

This repository contains a lightweight TypeScript implementation of the ACE loop:
- Generator: produces an answer and references relevant playbook bullets
- Reflector: critiques the generator result and emits bullet tags and insights
- Curator: merges the reflection into the evolving playbook via a delta

## Directory Structure

- `src/ace/`
  - `delta.ts`: DeltaOperation and DeltaBatch—structured edits to the playbook
  - `playbook.ts`: Playbook and Bullet—storage, tagging, serialization, prompt view
  - `llm.ts`: LLM client interfaces and a `DummyLLMClient` test stub
  - `prompts.ts`: Prompt templates for generator, reflector, curator
  - `roles.ts`: `Generator`, `Reflector`, `Curator` implementations of the ACE roles
  - `adaptation.ts`: `OfflineAdapter` and `OnlineAdapter`—wrappers that run ACE across samples
  - `index.ts`: Barrel exports for the ACE module
  - `init.ts`: Minimal demo entry point to initiate an ACE flow

- `tests/`
  - Unit tests covering playbook, LLM clients, roles, and adapters

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Run tests:

```bash
npm test
```

3) Run the minimal ACE demo:

```bash
npm run build
node dist/src/ace/init.js
```

The demo uses `DummyLLMClient` with queued JSON responses to simulate a generator/reflector/curator cycle over two samples, updates the in-memory playbook, and prints a compact summary.

## Usage in Code

You can import and compose the roles directly:

```ts
import { DummyLLMClient } from './src/ace/llm';
import { Generator, Reflector, Curator } from './src/ace/roles';
import { Playbook } from './src/ace/playbook';

const llm = new DummyLLMClient();
llm.queue(JSON.stringify({ reasoning: 'r', bullet_ids: [], final_answer: '42' }));
llm.queue(JSON.stringify({ reasoning: 'rr', error_identification: '', root_cause_analysis: '', correct_approach: '', key_insight: 'k', bullet_tags: [] }));
llm.queue(JSON.stringify({ reasoning: 'c', operations: [] }));

const generator = new Generator(llm);
const reflector = new Reflector(llm);
const curator = new Curator(llm);
const playbook = new Playbook();

(async () => {
  const g = await generator.generate({ question: 'return 42', context: '', playbook, reflection: '' });
  const r = await reflector.reflect({ question: 'return 42', generator_output: g, playbook, ground_truth: '42', feedback: 'ok', max_refinement_rounds: 1 });
  const c = await curator.curate({ reflection: r, playbook, question_context: 'ctx', progress: 'p' });
  playbook.applyDelta(c.delta);
})();
```

## Notes

- All LLM role outputs are required to be valid JSON. The clients retry with stricter instructions when JSON parsing fails.
- `DummyLLMClient` is intended strictly for tests and demos; replace it with a real client in production.
- `Adapters` provide ergonomic loops for batch or streaming scenarios.

import { DeltaBatch } from './delta';
import { LLMClient } from './llm';
import { Playbook } from './playbook';
import { CURATOR_PROMPT, GENERATOR_PROMPT, REFLECTOR_PROMPT } from './prompts';

function safeJsonParse(text: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`LLM response is not valid JSON: ${(err as Error).message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected a JSON object from LLM.');
  }
  return data as Record<string, unknown>;
}

function formatOptional(value?: string | null): string {
  return value ?? '(none)';
}

export interface GeneratorOutput {
  reasoning: string;
  final_answer: string;
  bullet_ids: string[];
  raw: Record<string, unknown>;
}

export class Generator {
  private llm: LLMClient;
  private promptTemplate: string;
  private maxRetries: number;

  constructor(llm: LLMClient, promptTemplate: string = GENERATOR_PROMPT, maxRetries = 3) {
    this.llm = llm;
    this.promptTemplate = promptTemplate;
    this.maxRetries = maxRetries;
  }

  async generate(params: {
    question: string;
    context?: string | null;
    playbook: Playbook;
    reflection?: string | null;
    kwargs?: Record<string, unknown>;
  }): Promise<GeneratorOutput> {
    const basePrompt = this.promptTemplate
      .replace('{playbook}', params.playbook.asPrompt() || '(empty playbook)')
      .replace('{reflection}', formatOptional(params.reflection))
      .replace('{question}', params.question)
      .replace('{context}', formatOptional(params.context ?? undefined));

    let prompt = basePrompt;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const response = await this.llm.complete(prompt, params.kwargs);
      try {
        const data = safeJsonParse(response.text);
        const reasoning = String(data['reasoning'] ?? '');
        const finalAnswer = String(data['final_answer'] ?? '');
        const bulletIdsRaw = (data['bullet_ids'] ?? []) as unknown[];
        const bulletIds: string[] = [];
        for (const item of bulletIdsRaw) if (typeof item === 'string' || typeof item === 'number') bulletIds.push(String(item));
        return { reasoning, final_answer: finalAnswer, bullet_ids: bulletIds, raw: data };
      } catch (err) {
        lastError = err as Error;
        if (attempt + 1 >= this.maxRetries) break;
        prompt = basePrompt + '\n\nYou MUST respond with a single valid JSON object without extra text.';
      }
    }
    throw new Error('Generator failed to produce valid JSON.' + (lastError ? ` ${lastError.message}` : ''));
  }
}

export interface BulletTag { id: string; tag: string }

export interface ReflectorOutput {
  reasoning: string;
  error_identification: string;
  root_cause_analysis: string;
  correct_approach: string;
  key_insight: string;
  bullet_tags: BulletTag[];
  raw: Record<string, unknown>;
}

export class Reflector {
  private llm: LLMClient;
  private promptTemplate: string;
  private maxRetries: number;

  constructor(llm: LLMClient, promptTemplate: string = REFLECTOR_PROMPT, maxRetries = 3) {
    this.llm = llm;
    this.promptTemplate = promptTemplate;
    this.maxRetries = maxRetries;
  }

  private makePlaybookExcerpt(playbook: Playbook, bulletIds: string[]): string {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const id of bulletIds) {
      if (seen.has(id)) continue;
      const bullet = playbook.getBullet(id);
      if (bullet) {
        seen.add(id);
        lines.push(`[${bullet.id}] ${bullet.content}`);
      }
    }
    return lines.join('\n');
  }

  async reflect(params: {
    question: string;
    generator_output: GeneratorOutput;
    playbook: Playbook;
    ground_truth?: string | null;
    feedback?: string | null;
    max_refinement_rounds?: number;
    kwargs?: Record<string, unknown>;
  }): Promise<ReflectorOutput> {
    const excerpt = this.makePlaybookExcerpt(params.playbook, params.generator_output.bullet_ids);
    const basePrompt = this.promptTemplate
      .replace('{question}', params.question)
      .replace('{reasoning}', params.generator_output.reasoning)
      .replace('{prediction}', params.generator_output.final_answer)
      .replace('{ground_truth}', formatOptional(params.ground_truth ?? undefined))
      .replace('{feedback}', formatOptional(params.feedback ?? undefined))
      .replace('{playbook_excerpt}', excerpt || '(no bullets referenced)');

    const rounds = params.max_refinement_rounds ?? 1;
    let result: ReflectorOutput | undefined;
    let prompt = basePrompt;
    let lastError: Error | undefined;

    for (let round = 0; round < rounds; round++) {
      prompt = basePrompt;
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        const response = await this.llm.complete(prompt, { ...(params.kwargs || {}), refinement_round: round });
        try {
          const data = safeJsonParse(response.text);
          const tagsPayload = data['bullet_tags'];
          const tags: BulletTag[] = [];
          if (Array.isArray(tagsPayload)) {
            for (const item of tagsPayload) {
              if (item && typeof item === 'object' && 'id' in item && 'tag' in item) {
                tags.push({ id: String((item as any).id), tag: String((item as any).tag).toLowerCase() });
              }
            }
          }
          const candidate: ReflectorOutput = {
            reasoning: String(data['reasoning'] ?? ''),
            error_identification: String(data['error_identification'] ?? ''),
            root_cause_analysis: String(data['root_cause_analysis'] ?? ''),
            correct_approach: String(data['correct_approach'] ?? ''),
            key_insight: String(data['key_insight'] ?? ''),
            bullet_tags: tags,
            raw: data,
          };
          result = candidate;
          if (tags.length > 0 || candidate.key_insight) return candidate;
          break;
        } catch (err) {
          lastError = err as Error;
          if (attempt + 1 >= this.maxRetries) break;
          prompt = basePrompt + '\n\nYou MUST respond with a single valid JSON object without extra text.';
        }
      }
    }
    if (!result) throw new Error('Reflector failed to produce a result.' + (lastError ? ` ${lastError.message}` : ''));
    return result;
  }
}

export interface CuratorOutput { delta: DeltaBatch; raw: Record<string, unknown> }

export class Curator {
  private llm: LLMClient;
  private promptTemplate: string;
  private maxRetries: number;

  constructor(llm: LLMClient, promptTemplate: string = CURATOR_PROMPT, maxRetries = 3) {
    this.llm = llm;
    this.promptTemplate = promptTemplate;
    this.maxRetries = maxRetries;
  }

  async curate(params: {
    reflection: ReflectorOutput;
    playbook: Playbook;
    question_context: string;
    progress: string;
    kwargs?: Record<string, unknown>;
  }): Promise<CuratorOutput> {
    const basePrompt = this.promptTemplate
      .replace('{progress}', params.progress)
      .replace('{stats}', JSON.stringify(params.playbook.stats()))
      .replace('{reflection}', JSON.stringify(params.reflection.raw, null, 2))
      .replace('{playbook}', params.playbook.asPrompt() || '(empty playbook)')
      .replace('{question_context}', params.question_context);

    let prompt = basePrompt;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const response = await this.llm.complete(prompt, params.kwargs);
      try {
        const data = safeJsonParse(response.text);
        const delta = DeltaBatch.fromJSON(data);
        return { delta, raw: data };
      } catch (err) {
        lastError = err as Error;
        if (attempt + 1 >= this.maxRetries) break;
        prompt = basePrompt + '\n\nYou MUST respond with a single valid JSON object without extra text.';
      }
    }
    throw new Error('Curator failed to produce valid JSON.' + (lastError ? ` ${lastError.message}` : ''));
  }
}

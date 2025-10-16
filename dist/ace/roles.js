import { DeltaBatch } from './delta';
import { CURATOR_PROMPT, GENERATOR_PROMPT, REFLECTOR_PROMPT } from './prompts';
function safeJsonParse(text) {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (err) {
        throw new Error(`LLM response is not valid JSON: ${err.message}`);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Expected a JSON object from LLM.');
    }
    return data;
}
function formatOptional(value) {
    return value ?? '(none)';
}
export class Generator {
    llm;
    promptTemplate;
    maxRetries;
    constructor(llm, promptTemplate = GENERATOR_PROMPT, maxRetries = 3) {
        this.llm = llm;
        this.promptTemplate = promptTemplate;
        this.maxRetries = maxRetries;
    }
    async generate(params) {
        const basePrompt = this.promptTemplate
            .replace('{playbook}', params.playbook.asPrompt() || '(empty playbook)')
            .replace('{reflection}', formatOptional(params.reflection))
            .replace('{question}', params.question)
            .replace('{context}', formatOptional(params.context ?? undefined));
        let prompt = basePrompt;
        let lastError;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const response = await this.llm.complete(prompt, params.kwargs);
            try {
                const data = safeJsonParse(response.text);
                const reasoning = String(data['reasoning'] ?? '');
                const finalAnswer = String(data['final_answer'] ?? '');
                const bulletIdsRaw = (data['bullet_ids'] ?? []);
                const bulletIds = [];
                for (const item of bulletIdsRaw)
                    if (typeof item === 'string' || typeof item === 'number')
                        bulletIds.push(String(item));
                return { reasoning, final_answer: finalAnswer, bullet_ids: bulletIds, raw: data };
            }
            catch (err) {
                lastError = err;
                if (attempt + 1 >= this.maxRetries)
                    break;
                prompt = basePrompt + '\n\n务必仅输出单个有效 JSON 对象，请转义所有引号或改用单引号，避免输出额外文本。';
            }
        }
        throw new Error('Generator failed to produce valid JSON.' + (lastError ? ` ${lastError.message}` : ''));
    }
}
export class Reflector {
    llm;
    promptTemplate;
    maxRetries;
    constructor(llm, promptTemplate = REFLECTOR_PROMPT, maxRetries = 3) {
        this.llm = llm;
        this.promptTemplate = promptTemplate;
        this.maxRetries = maxRetries;
    }
    makePlaybookExcerpt(playbook, bulletIds) {
        const seen = new Set();
        const lines = [];
        for (const id of bulletIds) {
            if (seen.has(id))
                continue;
            const bullet = playbook.getBullet(id);
            if (bullet) {
                seen.add(id);
                lines.push(`[${bullet.id}] ${bullet.content}`);
            }
        }
        return lines.join('\n');
    }
    async reflect(params) {
        const excerpt = this.makePlaybookExcerpt(params.playbook, params.generator_output.bullet_ids);
        const basePrompt = this.promptTemplate
            .replace('{question}', params.question)
            .replace('{reasoning}', params.generator_output.reasoning)
            .replace('{prediction}', params.generator_output.final_answer)
            .replace('{ground_truth}', formatOptional(params.ground_truth ?? undefined))
            .replace('{feedback}', formatOptional(params.feedback ?? undefined))
            .replace('{playbook_excerpt}', excerpt || '(no bullets referenced)');
        const rounds = params.max_refinement_rounds ?? 1;
        let result;
        let prompt = basePrompt;
        let lastError;
        for (let round = 0; round < rounds; round++) {
            prompt = basePrompt;
            for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                const response = await this.llm.complete(prompt, { ...(params.kwargs || {}), refinement_round: round });
                try {
                    const data = safeJsonParse(response.text);
                    const tagsPayload = data['bullet_tags'];
                    const tags = [];
                    if (Array.isArray(tagsPayload)) {
                        for (const item of tagsPayload) {
                            if (item && typeof item === 'object' && 'id' in item && 'tag' in item) {
                                tags.push({ id: String(item.id), tag: String(item.tag).toLowerCase() });
                            }
                        }
                    }
                    const candidate = {
                        reasoning: String(data['reasoning'] ?? ''),
                        error_identification: String(data['error_identification'] ?? ''),
                        root_cause_analysis: String(data['root_cause_analysis'] ?? ''),
                        correct_approach: String(data['correct_approach'] ?? ''),
                        key_insight: String(data['key_insight'] ?? ''),
                        bullet_tags: tags,
                        raw: data,
                    };
                    result = candidate;
                    if (tags.length > 0 || candidate.key_insight)
                        return candidate;
                    break;
                }
                catch (err) {
                    lastError = err;
                    if (attempt + 1 >= this.maxRetries)
                        break;
                    prompt = basePrompt + '\n\n请严格输出有效 JSON，对双引号进行转义，不要输出额外解释性文本。';
                }
            }
        }
        if (!result)
            throw new Error('Reflector failed to produce a result.' + (lastError ? ` ${lastError.message}` : ''));
        return result;
    }
}
export class Curator {
    llm;
    promptTemplate;
    maxRetries;
    constructor(llm, promptTemplate = CURATOR_PROMPT, maxRetries = 3) {
        this.llm = llm;
        this.promptTemplate = promptTemplate;
        this.maxRetries = maxRetries;
    }
    async curate(params) {
        const basePrompt = this.promptTemplate
            .replace('{progress}', params.progress)
            .replace('{stats}', JSON.stringify(params.playbook.stats()))
            .replace('{reflection}', JSON.stringify(params.reflection.raw, null, 2))
            .replace('{playbook}', params.playbook.asPrompt() || '(empty playbook)')
            .replace('{question_context}', params.question_context);
        let prompt = basePrompt;
        let lastError;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const response = await this.llm.complete(prompt, params.kwargs);
            try {
                const data = safeJsonParse(response.text);
                const delta = DeltaBatch.fromJSON(data);
                return { delta, raw: data };
            }
            catch (err) {
                lastError = err;
                if (attempt + 1 >= this.maxRetries)
                    break;
                prompt = basePrompt + '\n\n提醒：仅输出有效 JSON，所有字符串请转义双引号或改用单引号，不要添加额外文本。';
            }
        }
        throw new Error('Curator failed to produce valid JSON.' + (lastError ? ` ${lastError.message}` : ''));
    }
}

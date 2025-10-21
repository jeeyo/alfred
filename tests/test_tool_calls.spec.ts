import { describe, it, expect } from 'vitest';
import { DummyLLMClient, type ToolDefinition, type CompletionOptions } from '../src/ace/llm';
import { Generator } from '../src/ace/roles';
import { Playbook } from '../src/ace/playbook';

describe('Tool call functionality', () => {
  it('LLMClient accepts tools in CompletionOptions', async () => {
    const client = new DummyLLMClient();
    client.queue('{"test": "response"}');

    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }
      }
    ];

    const options: CompletionOptions = {
      tools,
      tool_choice: 'auto',
      structured_output: false
    };

    const res = await client.complete('What is the weather?', options);
    expect(res.text).toBe('{"test": "response"}');
  });

  it('Generator passes options through to LLM client', async () => {
    const client = new DummyLLMClient();
    client.queue('{"reasoning": "test", "bullet_ids": [], "final_answer": "42"}');

    const generator = new Generator(client);
    const playbook = new Playbook();

    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Perform a calculation'
        }
      }
    ];

    const result = await generator.generate({
      question: 'What is 6 * 7?',
      context: '',
      playbook,
      reflection: '',
      options: {
        tools,
        temperature: 0.5
      }
    });

    expect(result.final_answer).toBe('42');
    expect(result.reasoning).toBe('test');
  });

  it('CompletionOptions supports various parameter types', () => {
    const options: CompletionOptions = {
      tools: [{
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object' }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'test_tool' } },
      structured_output: false,
      temperature: 0.7,
      max_tokens: 1000,
      custom_param: 'custom_value'
    };

    expect(options.tools).toHaveLength(1);
    expect(options.tool_choice).toEqual({ type: 'function', function: { name: 'test_tool' } });
    expect(options.structured_output).toBe(false);
    expect(options.temperature).toBe(0.7);
    expect(options.max_tokens).toBe(1000);
    expect(options.custom_param).toBe('custom_value');
  });
});

# Tool Calls Usage Guide

This document explains how to use function calling (tool calls) with the ACE framework's LLM interface.

## Overview

The LLM interface now supports OpenAI's function calling feature through the `CompletionOptions` interface. This allows the model to invoke predefined tools/functions during generation.

**Important**: OpenAI's API does not support both `tools` and structured JSON output (`response_format: json_object`) in the same request. The `OpenAILLMClient` automatically handles this limitation by disabling structured output when tools are provided.

## Basic Usage

### 1. Define Your Tools

```typescript
import { ToolDefinition } from './src/ace/llm';

const tools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get the current weather in a given location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit']
          }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform a mathematical calculation',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate'
          }
        },
        required: ['expression']
      }
    }
  }
];
```

### 2. Use with Generator

```typescript
import { OpenAILLMClient } from './src/ace/llm';
import { Generator } from './src/ace/roles';
import { Playbook } from './src/ace/playbook';

const llm = new OpenAILLMClient('gpt-4');
const generator = new Generator(llm);
const playbook = new Playbook();

const result = await generator.generate({
  question: 'What is the weather like in Boston?',
  context: '',
  playbook,
  reflection: '',
  options: {
    tools,
    tool_choice: 'auto', // Let the model decide when to use tools
    temperature: 0.7
  }
});

// Access tool calls from the raw response
console.log(result.raw);
```

### 3. Tool Choice Options

Control how the model selects tools:

```typescript
// Let the model decide (default)
options: {
  tools,
  tool_choice: 'auto'
}

// Force the model to use a tool
options: {
  tools,
  tool_choice: 'required'
}

// Force a specific function
options: {
  tools,
  tool_choice: {
    type: 'function',
    function: { name: 'get_current_weather' }
  }
}

// Don't use tools (omit tool_choice or don't provide tools)
options: {
  temperature: 0.5
}
```

### 4. Processing Tool Calls

```typescript
const response = await llm.complete(prompt, { tools });

if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    console.log(`Tool: ${toolCall.function.name}`);
    console.log(`Arguments: ${toolCall.function.arguments}`);

    // Parse arguments and execute the function
    const args = JSON.parse(toolCall.function.arguments);

    // Execute your tool logic here
    const result = await executeFunction(toolCall.function.name, args);

    // Continue the conversation with tool results...
  }
}
```

## CompletionOptions Reference

```typescript
interface CompletionOptions {
  // Tool calling
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };

  // Output formatting
  structured_output?: boolean; // Explicitly control JSON mode (default: true when no tools)

  // Generation parameters
  temperature?: number;
  max_tokens?: number;

  // Custom parameters (extensible)
  [key: string]: unknown;
}
```

## Important Considerations

1. **Automatic JSON Mode Handling**: When `tools` are provided, `structured_output` is automatically set to `false` regardless of the default setting. This is required by OpenAI's API.

2. **Roles Support**: All three ACE roles (Generator, Reflector, Curator) accept the `options` parameter:
   ```typescript
   generator.generate({ ..., options: { tools, temperature: 0.5 } })
   reflector.reflect({ ..., options: { tools } })
   curator.curate({ ..., options: { max_tokens: 2000 } })
   ```

3. **Backward Compatibility**: The `options` parameter is optional. Existing code without it will continue to work with default JSON mode enabled.

4. **Testing**: Use `DummyLLMClient` for testing tool call scenarios by queuing appropriate JSON responses:
   ```typescript
   const dummy = new DummyLLMClient();
   dummy.queue('{"reasoning": "...", "bullet_ids": [], "final_answer": "..."}');

   const result = await generator.generate({
     question: 'test',
     playbook,
     options: { tools }
   });
   ```

## Example: Weather Agent

Here's a complete example of a generator that uses weather tools:

```typescript
import { OpenAILLMClient, ToolDefinition } from './src/ace/llm';
import { Generator } from './src/ace/roles';
import { Playbook } from './src/ace/playbook';

const weatherTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }
];

async function runWeatherAgent() {
  const llm = new OpenAILLMClient('gpt-4');
  const generator = new Generator(llm);
  const playbook = new Playbook();

  // Add some weather-related bullets to the playbook
  playbook.addBullet({
    section: 'Weather',
    content: 'Always get current weather data before making recommendations'
  });

  const result = await generator.generate({
    question: 'Should I bring an umbrella in Seattle today?',
    context: '',
    playbook,
    reflection: '',
    options: {
      tools: weatherTools,
      tool_choice: 'auto',
      temperature: 0.3
    }
  });

  console.log('Answer:', result.final_answer);
  console.log('Referenced bullets:', result.bullet_ids);
}

runWeatherAgent().catch(console.error);
```

## Troubleshooting

**Q: I'm getting errors about JSON parsing when using tools.**
A: Make sure you're not explicitly setting `structured_output: true` when providing tools. The system should automatically disable it.

**Q: My tools aren't being called.**
A: Check that your tool definitions are properly formatted and that you're using `tool_choice: 'auto'` or `'required'`. Also verify that your prompt actually needs the tools.

**Q: Can I use tools with DummyLLMClient for testing?**
A: Yes! Just queue the expected JSON responses. DummyLLMClient ignores the options but your code will work the same way.

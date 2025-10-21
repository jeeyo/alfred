# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alfred is a TypeScript implementation of the **Agentic Context Engineering (ACE)** framework, a self-improving language model system based on the paper *Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models* (arXiv:2510.04618).

ACE maintains a structured "playbook" of reusable knowledge bullets that evolves through a three-agent loop:
- **Generator**: Produces answers and references relevant playbook bullets
- **Reflector**: Critiques generator output and identifies which bullets were helpful/harmful
- **Curator**: Merges reflection insights into the playbook via structured delta operations

## Essential Commands

### Development
```bash
# Run the main demo (requires .env with OpenAI credentials)
npm start

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Environment Setup
The project requires a `.env` file with OpenAI API credentials:
```
OPENAI_API_KEY=your_key_here
```

The main entry point uses `node --env-file=.env --import=tsx` to load environment variables and execute TypeScript directly.

## Architecture

### Core ACE Loop (src/ace/)

**Playbook System** (`playbook.ts`):
- `Playbook`: Central knowledge store organized by sections containing `Bullet` objects
- `Bullet`: Individual knowledge units with metadata counters (helpful/harmful/neutral)
- Bullets have unique IDs (e.g., `strategy-00001`) generated from section names
- `asPrompt()`: Renders playbook as markdown for LLM consumption
- `applyDelta()`: Merges curator operations into the playbook

**Delta Operations** (`delta.ts`):
- Structured edit operations: `ADD`, `UPDATE`, `TAG`, `REMOVE`
- `DeltaBatch`: Collection of operations produced by curator
- All metadata adjustments flow through delta operations for auditability

**Agentic Roles** (`roles.ts`):
- `Generator`: Takes playbook + question → produces answer + referenced bullet IDs
- `Reflector`: Analyzes generator output → emits error diagnostics and bullet tags
  - Supports up to 5 refinement rounds (configurable)
  - Tags bullets as helpful/harmful/neutral based on contribution
- `Curator`: Consumes reflection → emits delta operations to update playbook
- All roles retry up to 3 times on JSON parsing failures with stricter instructions

**LLM Interface** (`llm.ts`):
- `LLMClient`: Abstract base class for pluggable LLM backends
  - `complete(prompt, options?)`: Main method accepting `CompletionOptions`
- `CompletionOptions`: Flexible interface for controlling LLM behavior
  - `tools`: Array of tool definitions for function calling
  - `tool_choice`: Control tool selection ('auto', 'required', or specific function)
  - `structured_output`: Explicitly enable/disable JSON mode (default: true when no tools)
  - `temperature`, `max_tokens`: Standard generation parameters
  - Extensible with custom parameters via index signature
- `OpenAILLMClient`: Production client using OpenAI Responses API
  - Automatically disables structured output when tools are provided (OpenAI API limitation)
  - Returns `LLMResponse` with optional `tool_calls` array
  - Constructor accepts `structured_output` option to set default behavior
- `DummyLLMClient`: Test stub that returns pre-queued responses (never use in production)

**Adaptation Loops** (`adaptation.ts`):
- `OfflineAdapter`: Batch processing over training samples with configurable epochs
- `OnlineAdapter`: Sequential processing for test streams (one sample at a time)
- Both maintain a sliding window of recent reflections for context
- `processSample()`: Orchestrates full generator → reflector → curator → delta application cycle

### Main Entry Point

**src/alfred.ts**:
- `runAceDemo()`: Demonstrates single-question ACE flow with OpenAI model
- Uses `gpt-5-nano` model (configurable in code)
- Returns results and final playbook state as JSON

### Prompts

**src/ace/prompts.ts**: Contains prompt templates for generator/reflector/curator roles with placeholder variables like `{playbook}`, `{question}`, `{reflection}`.

## Key Implementation Details

### JSON-Only LLM Outputs
All three roles require valid JSON responses. The system enforces this through:
- OpenAI's `json_object` format constraint (automatically disabled when tools are used)
- Automatic retry logic with stricter instructions on parse failures
- `safeJsonParse()` helper for consistent error handling

### Tool Calls Support
The LLM interface supports OpenAI function calling:
- Pass `tools` array in `CompletionOptions` to enable function calling
- Use `tool_choice` to control tool selection behavior
- When tools are provided, structured output (JSON mode) is automatically disabled per OpenAI API requirements
- Tool calls are returned in `LLMResponse.tool_calls` array
- All roles (Generator, Reflector, Curator) accept `options?: CompletionOptions` parameter

### Playbook ID Generation
Bullet IDs are auto-generated using pattern: `{section_prefix}-{padded_number}`
- Example: section "Strategy" → `strategy-00001`, `strategy-00002`, etc.
- IDs can also be explicitly provided in delta operations

### Reflection Context Window
Adapters maintain the last N reflections (default 3) to provide continuity across samples, preventing the generator from repeating mistakes.

### Metadata Counters
Bullets accumulate signals via `helpful`/`harmful`/`neutral` counters:
- Updated through `TAG` operations or direct `tagBullet()` calls
- Rendered in playbook prompts: `[bullet-id] content (helpful=2, harmful=0, neutral=1)`
- Used by curator to decide pruning/refinement strategies

## Testing Strategy

Tests are located in `tests/` using Vitest:
- `test_playbook.spec.ts`: Bullet CRUD, serialization, delta application
- `test_llm.spec.ts`: DummyLLMClient queue mechanics
- `test_roles.spec.ts`: Generator/Reflector/Curator with mocked LLM responses
- `test_adaptation.spec.ts`: OfflineAdapter loop behavior
- `test_online_adapter.spec.ts`: OnlineAdapter streaming behavior
- `test_tool_calls.spec.ts`: Tool call functionality and CompletionOptions

Use `DummyLLMClient` for deterministic test scenarios by pre-queuing JSON responses.

## TypeScript Configuration

- Uses modern ESNext with `"type": "module"` in package.json
- Direct .ts execution via `tsx` (no build step for development)
- `rewriteRelativeImportExtensions: true` requires `.js` extensions in imports even for .ts files
- `noEmit: true` because tsx handles execution directly

## Methodological Notes (from paper)

- Base model: DeepSeek-V3.1 in paper; this repo uses OpenAI models
- Batch size: 1 delta per sample (paper setting)
- Offline epochs: up to 5 (configurable)
- Reflector refinement rounds: up to 5 (configurable, default 1)
- Grow-and-refine: Periodic deduplication and pruning (not yet implemented in this codebase)
- Feedback signals: Paper uses execution traces, unit tests, ground-truth labels; this demo uses simpler evaluation

## Important Conventions

- All ACE module exports are re-exported through `src/ace/index.ts` as a barrel
- LLM system prompt enforces JSON-only output with no chain-of-thought exposure
- Reflector must produce structured fields: `error_identification`, `root_cause_analysis`, `correct_approach`, `key_insight`
- Curator reasoning should explain why operations were chosen based on playbook stats and reflection insights

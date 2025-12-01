# Jobby — Minimal OpenAI agent micro-framework

TypeScript micro-framework for building agentic workflows that orchestrate OpenAI models and tools across multi-step tasks.

### Quick start

1. Install and build

```bash
npm install
npm run build
```

2. Set your OpenAI key

```bash
export OPENAI_API_KEY=your_api_key_here
```

Quick run (no build required)

```bash
node --import=tsx examples/simple-agent.ts
```

Minimal example agent

```ts
import { Agent, Tool } from './src/index'
import z from 'zod'

const generateRandomNumber = new Tool(
  'generateRandomNumber',
  'Generates a random number between min and max',
  z.object({ min: z.number().int(), max: z.number().int() }),
  async ({ min, max }) => `Generated random number: ${Math.floor(Math.random() * (max - min + 1)) + min}`
)

const agent = new Agent('You are a helpful assistant.', 'gpt-4o-mini', [generateRandomNumber])
await agent.run('Generate a random number between 1 and 100.')
```

Files to inspect

- `examples/simple-agent.ts` — runnable example
- `src/agent.ts`, `src/tool.ts`, `src/index.ts`

License: MIT

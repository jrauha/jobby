# Jobby — Lightweight OpenAI agent framework

[![CI](https://github.com/jrauha/jobby/actions/workflows/test.yml/badge.svg)](https://github.com/jrauha/jobby/actions/workflows/test.yml)

A lightweight TypeScript framework for creating agentic workflows powered by OpenAI models.

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
import { Agent, AgentRunner, Tool } from './src/index'
import z from 'zod'

const generateRandomNumberTool = new Tool({
  name: "generateRandomNumber",
  description: "Generates a random number between min and max.",
  input: z.object({
    min: z.number().int(),
    max: z.number().int(),
  }),
  func: ({ min, max }) => {
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    return `Generated random number: ${randomNum}`;
  },
});

const agent = new Agent({
  name: "Number assistant",
  instructions: "You are a helpful assistant.",
  model: "gpt-4o-mini",
  tools: [generateRandomNumberTool],
});

await AgentRunner.run('Generate a random number between 1 and 100.')
```

Files to inspect

- `examples/simple-agent.ts` — runnable example
- `src/agent.ts`, `src/tool.ts`, `src/index.ts`

License: MIT

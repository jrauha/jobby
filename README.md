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

await AgentRunner.run(agent, 'Generate a random number between 1 and 100.')
```

## Workflows

Jobby supports building multi-step workflows with conditional branching. Workflows are ideal for orchestrating complex sequences of operations.

### Basic Workflow Example

```ts
import { Workflow, WorkflowRunner } from './src/index'

type WorkflowState = {
  a: number;
  b: number;
  sum?: number;
  sqrt?: number;
};

const workflow = new Workflow<WorkflowState>()
  .addNode("sum_step", async (state) => {
    return {
      ...state,
      sum: state.a + state.b,
    };
  })
  .addNode("sqrt_step", async (state) => {
    return {
      ...state,
      sqrt: Math.sqrt(state.sum ?? 0),
    };
  })
  .addEdge("__START__", "sum_step")
  .addConditionalEdge("sum_step", ["sqrt_step"], ({ sum = 0 }) => {
    return sum >= 0 ? "sqrt_step" : "__END__";
  });

const result = await WorkflowRunner.run(workflow, { a: 3, b: 4 });
// result: { a: 3, b: 4, sum: 7, sqrt: 2.6457... }
```

### Workflow Features

- **Node Functions**: Each node receives the current state and returns partial state updates
- **Edges**: Connect nodes in sequence with `.addEdge(from, to)`
- **Conditional Edges**: Branch based on state with `.addConditionalEdge(from, to, conditionFn)`
- **Special Nodes**: `__START__` (entry point) and `__END__` (exit point)

Files to inspect

- `examples/simple-agent.ts` — runnable agent example
- `examples/simple-workflow.ts` — runnable workflow example
- `src/agent.ts`, `src/tool.ts`, `src/workflow.ts`, `src/index.ts`

License: MIT

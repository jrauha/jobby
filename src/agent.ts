import { OpenAIModel } from "./model";
import { Tool, ToolArgsParseError } from "./tools";
import ToolRegistry from "./toolRegistry";
import { State, Message, AIModel, Context, Store } from "./types";
import MemoryStore, { initialState } from "./store";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "./utils";

const DEFAULT_MAX_ITERATIONS = 10;

export type AgentOptions = {
  name: string;
  instructions: string;
  model: string | AIModel;
  tools?: Tool[];
  maxIterations?: number;
};

export class Agent {
  public readonly name;
  private model: AIModel;
  private toolRegistry: ToolRegistry;
  private maxIterations: number;
  private instructions: string;

  constructor({
    name,
    instructions,
    model,
    tools,
    maxIterations,
  }: AgentOptions) {
    this.name = name;
    this.model = typeof model === "string" ? new OpenAIModel(model) : model;
    this.toolRegistry = new ToolRegistry(tools);
    this.maxIterations = maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.instructions = instructions;
  }

  private async step(store: Store): Promise<void> {
    const response = await this.model.invoke(
      store.getState().messages,
      this.toolRegistry.toDefinitions()
    );

    const output: Message[] = response.output ?? [];

    store.dispatch({ type: "MODEL_OUTPUT", output });

    for (const item of output) {
      if (isFunctionCallMessage(item)) {
        const fc = item;
        try {
          const toolResponse = await this.toolRegistry.invoke(
            fc.name,
            item.arguments
          );
          store.dispatch({
            type: "FUNCTION_CALL_OUTPUT",
            call_id: fc.call_id,
            output: toolResponse,
          });
        } catch (e) {
          if (e instanceof ToolArgsParseError) {
            store.dispatch({
              type: "FUNCTION_CALL_OUTPUT",
              call_id: fc.call_id,
              output: `Error parsing arguments for tool ${fc.name}: ${e.message}`,
            });
          } else {
            throw e;
          }
        }
      }
    }
  }

  getInstructions(): string {
    return this.instructions;
  }

  async run(ctx: Context): Promise<Context> {
    for (let i = 0; i < this.maxIterations; i++) {
      await this.step(ctx.store);
      const lm = getLastMessage(ctx.store.getState());
      if (lm && isAssistantMessage(lm)) {
        break;
      }
    }
    return ctx;
  }
}

export class AgentRunner {
  static async run(agent: Agent, input: string): Promise<State> {
    const store = new MemoryStore(initialState(agent.getInstructions(), input));
    const ctx: Context = { store };
    const finalCtx = await agent.run(ctx);
    return finalCtx.store.getState();
  }
}

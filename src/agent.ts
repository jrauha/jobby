import { OpenAIModel } from "./model";
import { Tool, ToolArgsParseError } from "./tools";
import ToolRegistry from "./toolRegistry";
import {
  State,
  Message,
  AIModel,
  Context,
  FunctionCallOutputMessage,
} from "./types";
import { InMemoryStore } from "./store";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "./utils";

const DEFAULT_MAX_ITERATIONS = 10;

export type AgentState = State<{ messages: Message[] }>;
export type AgentContext = Context<AgentState, AgentAction>;

export type AgentAction =
  | { type: "MODEL_OUTPUT"; output: Message[] }
  | { type: "FUNCTION_CALL_OUTPUT"; call_id: string; output: string };

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

  private async step(store: AgentContext["store"]): Promise<void> {
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

  async run(ctx: AgentContext): Promise<AgentContext> {
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

export function initialState(instructions: string, input: string): AgentState {
  return {
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  };
}

export function agentReducer(
  state: AgentState,
  action: AgentAction
): AgentState {
  switch (action.type) {
    case "MODEL_OUTPUT":
      return { ...state, messages: [...state.messages, ...action.output] };
    case "FUNCTION_CALL_OUTPUT": {
      const fc: FunctionCallOutputMessage = {
        type: "function_call_output",
        call_id: action.call_id,
        output: action.output,
      };
      return {
        ...state,
        messages: [...state.messages, fc],
      };
    }
    default:
      return state;
  }
}

export class AgentRunner {
  static async run(agent: Agent, input: string): Promise<AgentState> {
    const store = new InMemoryStore(
      agentReducer,
      initialState(agent.getInstructions(), input)
    );
    const ctx = { store };
    const finalCtx = await agent.run(ctx);
    return finalCtx.store.getState();
  }
}

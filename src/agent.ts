import { OpenAIModel } from "./model";
import { Tool, ToolArgsParseError } from "./tools";
import ToolRegistry from "./toolRegistry";
import { State, Message, AIModel } from "./types";
import Store, { initialState } from "./store";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "./utils";

const DEFAULT_MAX_ITERATIONS = 10;

export class Agent {
  private model: AIModel | OpenAIModel;
  private toolRegistry: ToolRegistry;
  private maxIterations: number;
  private instructions: string;

  constructor(
    instructions: string,
    model: AIModel | OpenAIModel | string,
    tools: Tool[] = [],
    maxIterations: number = DEFAULT_MAX_ITERATIONS
  ) {
    this.model = typeof model === "string" ? new OpenAIModel(model) : model;
    this.toolRegistry = new ToolRegistry(tools);
    this.maxIterations = maxIterations;
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

  async run(input: string): Promise<State> {
    const store = new Store(initialState(this.instructions, input));
    for (let i = 0; i < this.maxIterations; i++) {
      await this.step(store);
      const lm = getLastMessage(store.getState());
      if (lm && isAssistantMessage(lm)) {
        break;
      }
    }
    return store.getState();
  }
}

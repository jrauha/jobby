import { OpenAIModel } from "./model";
import ToolRegistry from "./toolRegistry";
import { Tool, ToolArgsParseError } from "./tools";
import {
  AIModel,
  Context,
  FunctionCallOutputMessage,
  Message,
  Runnable,
  State,
} from "./types";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "./utils";
import {
  END,
  START,
  Workflow,
  WorkflowAction,
  WorkflowRunner,
} from "./workflow";

const DEFAULT_MAX_ITERATIONS = 10;

const MODEL_STEP = "model_step";
const FUNCTION_STEP = "function_step";

export type AgentState = State<{ iteration: number; messages: Message[] }>;

export type AgentOptions = {
  name: string;
  instructions: string;
  model: string | AIModel;
  tools?: Tool[];
  maxIterations?: number;
};

export class Agent implements Runnable<AgentState> {
  public readonly name;
  private model: AIModel;
  private toolRegistry: ToolRegistry;
  private maxIterations: number;
  private instructions: string;
  private workflow: Workflow<AgentState>;

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
    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow(): Workflow<AgentState> {
    const workflow = new Workflow<AgentState>();

    // Model step: call the AI model
    workflow.addNode(MODEL_STEP, async (state: AgentState) => {
      const response = await this.model.invoke(
        state.messages,
        this.toolRegistry.toDefinitions()
      );

      const output: Message[] = response.output ?? [];

      return {
        messages: [...state.messages, ...output],
        iteration: state.iteration + 1,
      };
    });

    // Function step: execute function calls
    workflow.addNode(FUNCTION_STEP, async (state: AgentState) => {
      const functionCallOutputs: FunctionCallOutputMessage[] = [];

      // Find all function call messages since the last function step
      const idx =
        state.messages.findLastIndex((m) => !isFunctionCallMessage(m)) + 1;

      for (let i = idx; i < state.messages.length; i++) {
        const lm = state.messages[i];
        if (lm && isFunctionCallMessage(lm)) {
          if (isFunctionCallMessage(lm)) {
            const fc = lm;
            try {
              const toolResponse = await this.toolRegistry.invoke(
                fc.name,
                lm.arguments
              );
              functionCallOutputs.push({
                type: "function_call_output",
                call_id: fc.call_id,
                output: toolResponse,
              });
            } catch (e) {
              if (e instanceof ToolArgsParseError) {
                functionCallOutputs.push({
                  type: "function_call_output",
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

      return {
        messages: [...state.messages, ...functionCallOutputs],
      };
    });

    workflow.addEdge(START, MODEL_STEP);

    workflow.addConditionalEdge(MODEL_STEP, [FUNCTION_STEP], (state) => {
      const lm = getLastMessage(state);
      const iteration = state.iteration;

      if ((lm && isAssistantMessage(lm)) || iteration >= this.maxIterations) {
        return END;
      }
      return FUNCTION_STEP;
    });

    workflow.addEdge(FUNCTION_STEP, MODEL_STEP);
    return workflow;
  }

  getInstructions(): string {
    return this.instructions;
  }

  async run(ctx: Context<AgentState, WorkflowAction>): Promise<AgentState> {
    return this.workflow.run(ctx);
  }
}

export function initialState(instructions: string, input: string): AgentState {
  return {
    iteration: 0,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  };
}

export class AgentRunner {
  static async run(agent: Agent, input: string): Promise<AgentState> {
    const initial = initialState(agent.getInstructions(), input);
    const final = await WorkflowRunner.run(agent, initial);
    return final;
  }
}

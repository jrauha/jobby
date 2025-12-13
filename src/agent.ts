import { OpenAIModel } from "./model";
import ToolRegistry from "./toolRegistry";
import { Tool, ToolArgsParseError } from "./tools";
import {
  Agent,
  AIModel,
  FunctionCallOutputMessage,
  OpenAIMessage,
  WorkflowGraph,
  WorkflowState,
} from "./types";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "./utils";
import { END, START, Workflow, WorkflowRunner } from "./workflow";

const DEFAULT_MAX_ITERATIONS = 10;

const MODEL_STEP = "model_step";
const FUNCTION_STEP = "function_step";

export type OpenAIAgenState = {
  iteration: number;
  messages: OpenAIMessage[];
};

export type OpenAIAgentOptions = {
  name: string;
  instructions: string;
  model: string | AIModel<OpenAIMessage>;
  tools?: Tool[];
  maxIterations?: number;
};

export class OpenAIAgent implements Agent<OpenAIAgenState> {
  public readonly name;
  private model: AIModel<OpenAIMessage>;
  private toolRegistry: ToolRegistry;
  private maxIterations: number;
  private instructions: string;
  private workflow: WorkflowGraph<OpenAIAgenState>;

  constructor({
    name,
    instructions,
    model,
    tools,
    maxIterations,
  }: OpenAIAgentOptions) {
    this.name = name;
    this.model = typeof model === "string" ? new OpenAIModel(model) : model;
    this.toolRegistry = new ToolRegistry(tools);
    this.maxIterations = maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.instructions = instructions;
    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow(): WorkflowGraph<OpenAIAgenState> {
    const workflow = new Workflow<OpenAIAgenState>();

    // Model step: call the AI model
    workflow.addNode(MODEL_STEP, async (state: OpenAIAgenState) => {
      const response = await this.model.invoke(
        state.messages,
        this.toolRegistry.toDefinitions()
      );

      const output: OpenAIMessage[] = response.output ?? [];

      return {
        messages: [...state.messages, ...output],
        iteration: state.iteration + 1,
      };
    });

    // Function step: execute function calls
    workflow.addNode(FUNCTION_STEP, async (state: OpenAIAgenState) => {
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
        ...state,
        messages: [...state.messages, ...functionCallOutputs],
      };
    });

    workflow.addEdge(START, MODEL_STEP);

    workflow.addConditionalEdge(MODEL_STEP, [FUNCTION_STEP, END], (state) => {
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

  initialState(input: string): OpenAIAgenState {
    return {
      iteration: 0,
      messages: [
        { role: "system", content: this.instructions },
        { role: "user", content: input },
      ],
    };
  }

  toWorkflow(): WorkflowGraph<OpenAIAgenState> {
    return this.workflow;
  }
}

export class AgentRunner {
  static async run<S extends WorkflowState>(
    agent: Agent<S>,
    input: string
  ): Promise<S> {
    const initial = agent.initialState(input);
    const final = await WorkflowRunner.run(agent.toWorkflow(), initial);
    const endState = final.nodes[END];
    if (!endState) {
      throw new Error("Workflow did not reach END node");
    }
    return endState;
  }
}

import { OpenAIModel } from "./model";
import ToolRegistry from "./toolRegistry";
import { Tool, ToolArgsParseError } from "./tools";
import {
  Agent,
  AIModel,
  CompiledWorkflow,
  FunctionCallOutputMessage,
  OpenAIMessage,
  WorkflowState,
} from "./types";
import {
  getLastNonFunctionCallMessageIndex,
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
  private workflow: CompiledWorkflow<OpenAIAgenState>;

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

  private buildWorkflow(): CompiledWorkflow<OpenAIAgenState> {
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
      const idx = getLastNonFunctionCallMessageIndex(state);

      if (idx === null) {
        throw new Error("No function call message found for function step.");
      }

      for (let i = idx + 1; i < state.messages.length; i++) {
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
    return workflow.compile();
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

  toWorkflow(): CompiledWorkflow<OpenAIAgenState> {
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
    return final;
  }
}

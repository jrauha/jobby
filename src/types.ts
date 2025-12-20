import {
  Tool as OpenAIToolDef,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

/* Store types */

export type State<T = object> = T & Record<string, unknown>;

export type StoreEvent = object & { type: string };

export type StoreReducer<S, A extends StoreEvent> = (state: S, action: A) => S;

export type Store<S, A extends StoreEvent> = {
  getState(): S;
  getEvents(): A[];
  dispatch(event: A): void;
};

/* Workflow types */

export type WorkflowState = State<Record<string, unknown>>;

export type WorkflowNodeFn<S extends WorkflowState = WorkflowState> = (
  state: S
) => Promise<S> | S;

export type WorkflowConditionFn<S extends WorkflowState = WorkflowState> = {
  (state: S): NodeId | Promise<NodeId>;
};

export type NodeId = string;

export type Edge = {
  to: NodeId;
};

export type EdgeWithCondition<S extends WorkflowState = WorkflowState> = {
  to: NodeId[];
  condition: WorkflowConditionFn<S>;
};

export type WorkflowGraph<S extends WorkflowState = WorkflowState> = {
  getEdges(): Map<NodeId, (Edge | EdgeWithCondition<S>)[]>;
  getNodes(): NodeId[];
  getNode(id: NodeId): WorkflowNodeFn<S> | undefined;
  compile(): CompiledWorkflow<S>;
};

export const COMPILED_BRAND = Symbol("CompiledWorkflow");

export type CompiledWorkflow<S extends WorkflowState = WorkflowState> = {
  getEdges(): Map<NodeId, (Edge | EdgeWithCondition<S>)[]>;
  getNodes(): NodeId[];
  getNode(id: NodeId): WorkflowNodeFn<S> | undefined;
  readonly __compiled: typeof COMPILED_BRAND;
};

/* Agent types */

export type AIModel<Message> = {
  invoke(
    messages: Message[],
    tools?: OpenAIToolDef[]
  ): Promise<{ output: Message[] }>;
};

export type Agent<S extends WorkflowState = WorkflowState> = {
  name: string;
  initialState(input: string): S;
  toWorkflow(): CompiledWorkflow<S>;
};

/* OpenAI Message types */

export type FunctionCallMessage = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

export type FunctionCallOutputMessage = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export type {
  ResponseInputItem,
  ResponseOutputItem,
  Tool as OpenAIToolDef,
} from "openai/resources/responses/responses.js";

export type OpenAIMessage =
  | ResponseInputItem
  | ResponseOutputItem
  | FunctionCallMessage
  | FunctionCallOutputMessage;

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

export type Context<S extends State, E extends StoreEvent> = {
  store: Store<S, E>;
};

export type Runnable<S extends State = State> = {
  run(ctx: Context<S, StoreEvent>): Promise<S>;
};

/* Agent types */

export type AIModel<Message> = {
  invoke(
    messages: Message[],
    tools?: OpenAIToolDef[]
  ): Promise<{ output: Message[] }>;
};

export type AgentState<Message> = State<{
  messages: Message[];
}>;

export type Agent<Message> = Runnable<AgentState<Message>> & {
  name: string;
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

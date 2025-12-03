import {
  Tool as OpenAIToolDef,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";
export type {
  ResponseInputItem,
  ResponseOutputItem,
  Tool as OpenAIToolDef,
} from "openai/resources/responses/responses.js";

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

export type Message =
  | ResponseInputItem
  | ResponseOutputItem
  | FunctionCallMessage
  | FunctionCallOutputMessage;

export type AIModel = {
  invoke(
    messages: Message[],
    tools?: OpenAIToolDef[]
  ): Promise<{ output: Message[] }>;
};

/* Store types */

export type State<T> = T & Record<string, unknown>;

export type StoreEvent = object & { type: string };

export type StoreReducer<S, A extends StoreEvent> = (state: S, action: A) => S;

export type Store<S, A extends StoreEvent> = {
  getState(): S;
  getEvents(): A[];
  dispatch(event: A): void;
};

export type Context<S> = {
  store: S;
};

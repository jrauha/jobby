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

export type State = {
  messages: Message[];
} & Record<string, unknown>;

export type Store = {
  getState(): State;
  dispatch(action: unknown): void;
};

export type Context = {
  store: Store;
};

export type AIModel = {
  invoke(
    messages: Message[],
    tools?: OpenAIToolDef[]
  ): Promise<{ output: Message[] }>;
};

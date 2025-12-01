import { State, Message, FunctionCallOutputMessage } from "./types";

export type Action =
  | { type: "MODEL_OUTPUT"; output: Message[] }
  | { type: "FUNCTION_CALL_OUTPUT"; call_id: string; output: string };

export function reducer(state: State, action: Action): State {
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

export function initialState(instructions: string, input: string): State {
  return {
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  };
}

export default class Store {
  private state: State;
  private events: Action[] = [];
  private subs: Array<(s: State) => void> = [];

  constructor(initial: State) {
    this.state = initial;
  }

  dispatch(action: Action) {
    this.events.push(action);
    this.state = reducer(this.state, action);
    for (const s of this.subs) s(this.state);
  }

  getState(): State {
    return this.state;
  }

  getEvents(): Action[] {
    return [...this.events];
  }

  subscribe(cb: (s: State) => void): () => void {
    this.subs.push(cb);
    return () => {
      this.subs = this.subs.filter((c) => c !== cb);
    };
  }

  static replay(initial: State, events: Action[]): State {
    return events.reduce(reducer, initial);
  }
}

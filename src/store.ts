import { Store, StoreEvent, StoreReducer } from "./types";

export class InMemoryStore<State, Action extends StoreEvent> implements Store<
  State,
  Action
> {
  private state: State;
  private events: Action[] = [];
  private subs: Array<(s: State, a: Action) => void> = [];
  private reducer: StoreReducer<State, Action>;

  constructor(reducer: StoreReducer<State, Action>, initial: State) {
    this.state = initial;
    this.reducer = reducer;
  }

  dispatch(action: Action) {
    this.events.push(action);
    this.state = this.reducer(this.state, action);
    for (const s of this.subs) s(this.state, action);
  }

  getState(): State {
    return this.state;
  }

  getEvents(): Action[] {
    return [...this.events];
  }

  subscribe(cb: (s: State, a: Action) => void): () => void {
    this.subs.push(cb);
    return () => {
      this.subs = this.subs.filter((c) => c !== cb);
    };
  }
}

import { describe, expect, it } from "vitest";
import { InMemoryStore } from "../src/store";

type TestState = {
  count: number;
  messages: Array<{ role: string; content: string }>;
};

type TestEvent =
  | { type: "INCREMENT" }
  | { type: "ADD_MESSAGE"; role: string; content: string };

const reducer = (state: TestState, event: TestEvent): TestState => {
  switch (event.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: event.role, content: event.content },
        ],
      };
    default:
      return state;
  }
};

describe("InMemoryStore", () => {
  it("initial state is set and retrievable", () => {
    const initial: TestState = {
      count: 0,
      messages: [
        { role: "system", content: "instr" },
        { role: "user", content: "hello" },
      ],
    };
    const store = new InMemoryStore<TestState, TestEvent>(reducer, initial);
    const s = store.getState();
    expect(s.count).toBe(0);
    expect(s.messages.length).toBe(2);
    expect(s.messages[0]).toMatchObject({ role: "system", content: "instr" });
    expect(s.messages[1]).toMatchObject({ role: "user", content: "hello" });
  });

  it("dispatch updates state and records events", () => {
    const store = new InMemoryStore<TestState, TestEvent>(reducer, {
      count: 0,
      messages: [],
    });
    store.dispatch({ type: "INCREMENT" });
    store.dispatch({ type: "ADD_MESSAGE", role: "assistant", content: "ok" });
    const st = store.getState();
    expect(st.count).toBe(1);
    expect(st.messages[0]).toMatchObject({ role: "assistant", content: "ok" });
    const events = store.getEvents();
    expect(events.length).toBe(2);
    // ensure events are a copy, not the internal array
    events.push({ type: "INCREMENT" });
    expect(store.getEvents().length).toBe(2);
  });

  it("subscribe notifies on state changes and can unsubscribe", () => {
    const store = new InMemoryStore<TestState, TestEvent>(reducer, {
      count: 0,
      messages: [],
    });
    let notifiedCount = 0;
    const unsubscribe = store.subscribe(() => {
      notifiedCount += 1;
    });
    store.dispatch({ type: "INCREMENT" });
    store.dispatch({ type: "ADD_MESSAGE", role: "user", content: "hi" });
    expect(notifiedCount).toBe(2);
    unsubscribe();
    store.dispatch({ type: "INCREMENT" });
    expect(notifiedCount).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import Store, { initialState, type Action } from "../src/store";

describe("Store and reducer", () => {
  it("initialState sets system and user messages", () => {
    const s = initialState("instr", "hello");
    expect(s.messages.length).toBe(2);
    expect(s.messages[0]).toMatchObject({ role: "system", content: "instr" });
    expect(s.messages[1]).toMatchObject({ role: "user", content: "hello" });
  });

  it("dispatch MODEL_OUTPUT appends messages and records events", () => {
    const store = new Store(initialState("i", "u"));
    store.dispatch({
      type: "MODEL_OUTPUT",
      output: [{ role: "assistant", type: "message", content: "ok" }],
    });
    const st = store.getState();
    expect(st.messages[st.messages.length - 1]).toMatchObject({
      role: "assistant",
      content: "ok",
    });
    const events = store.getEvents();
    expect(events.length).toBe(1);
  });

  it("replay reproduces state from events", () => {
    const init = initialState("i", "u");
    const events: Action[] = [
      {
        type: "MODEL_OUTPUT",
        output: [{ role: "assistant", type: "message", content: "ok" }],
      },
      { type: "FUNCTION_CALL_OUTPUT", call_id: "1", output: "res" },
    ];
    const final = Store.replay(init, events);
    expect(final.messages.length).toBe(init.messages.length + 2);
  });
});

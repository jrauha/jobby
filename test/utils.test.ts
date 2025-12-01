import { describe, it, expect } from "vitest";
import {
  getLastMessage,
  isAssistantMessage,
  isFunctionCallMessage,
} from "../src/utils";

import { initialState } from "../src/store";
import { Message } from "../src";

describe("utils", () => {
  it("getLastMessage returns last or null", () => {
    const s = initialState("i", "u");
    expect(getLastMessage(s)).toBeTruthy();
    expect(getLastMessage({ messages: [] })).toBeNull();
  });

  it("isAssistantMessage detects assistant output items", () => {
    const m: Message = { type: "message", role: "assistant", content: "x" };
    expect(isAssistantMessage(m)).toBe(true);
  });

  it("isFunctionCallMessage detects function_call", () => {
    const m: Message = {
      type: "function_call",
      name: "t",
      arguments: "{}",
      call_id: "1",
    };
    expect(isFunctionCallMessage(m)).toBe(true);
  });
});

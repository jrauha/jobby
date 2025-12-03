import { describe, it, expect } from "vitest";
import { Agent, AgentRunner, AgentState, initialState } from "../src/agent";
import * as z from "zod";
import { Tool } from "../src/tools";
import { AIModel, Message } from "../src";

// Mock model that returns a function_call then an assistant message
class MockModel implements AIModel {
  private calls = 0;
  async invoke(): Promise<{ output: Message[] }> {
    this.calls++;
    if (this.calls === 1) {
      return {
        output: [
          {
            id: "fc_1",
            type: "function_call",
            status: "completed",
            arguments: '{"text":"Hello, World!"}',
            call_id: "call_1",
            name: "echo",
          },
        ],
      };
    }
    return {
      output: [
        {
          id: "msg_1",
          role: "assistant",
          type: "message",
          status: "completed",
          content: [
            {
              type: "output_text",
              annotations: [],
              logprobs: [],
              text: "E:Hello, World!",
            },
          ],
        },
      ],
    };
  }
}

describe("Agent", () => {
  it("runs tool call and stops on assistant message", async () => {
    const model = new MockModel();
    const tool = new Tool({
      name: "echo",
      description: "e",
      input: z.object({ text: z.string() }),
      func: async (a) => `E:${a.text}`,
    });
    const agent = new Agent({
      name: "name",
      instructions: "inst",
      model,
      tools: [tool],
      maxIterations: 5,
    });
    const state = await AgentRunner.run(agent, "Please echo a message.");
    const last = state.messages[state.messages.length - 1];
    expect(last).toMatchObject({
      type: "message",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "E:Hello, World!",
        },
      ],
    });
    // Ensure function_call_output was added
    expect(
      state.messages.some((m: Message) => m.type === "function_call_output")
    ).toBe(true);
  });
});

describe("initialState", () => {
  it("creates initial state with system and user messages", () => {
    const state = initialState("You are an agent.", "Hello!");
    expect(state.messages.length).toBe(2);
    expect(state.messages[0]).toMatchObject({
      role: "system",
      content: "You are an agent.",
    });
    expect(state.messages[1]).toMatchObject({
      role: "user",
      content: "Hello!",
    });
  });
});

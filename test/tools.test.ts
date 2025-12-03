import { describe, it, expect } from "vitest";
import * as z from "zod";
import { Tool, ToolArgsParseError } from "../src/tools";

describe("Tool", () => {
  it("validates and invokes with object args", async () => {
    const schema = z.object({ x: z.number() });
    const tool = new Tool({
      name: "add",
      description: "adds",
      input: schema,
      func: async (args) => `got ${args.x}`,
    });
    const res = await tool.invoke({ x: 5 });
    expect(res).toBe("got 5");
  });

  it("parses JSON string args", async () => {
    const schema = z.object({ x: z.number() });
    const tool = new Tool({
      name: "add",
      description: "adds",
      input: schema,
      func: async (args) => `got ${args.x}`,
    });
    const res = await tool.invoke(JSON.stringify({ x: 7 }));
    expect(res).toBe("got 7");
  });

  it("throws ToolArgsParseError for invalid JSON", async () => {
    const schema = z.object({ x: z.number() });
    const tool = new Tool({
      name: "t",
      description: "d",
      input: schema,
      func: () => "x",
    });
    await expect(tool.invoke("notjson")).rejects.toBeInstanceOf(
      ToolArgsParseError
    );
  });

  it("throws on schema validation failure", async () => {
    const schema = z.object({ x: z.number() });
    const tool = new Tool({
      name: "t",
      description: "d",
      input: schema,
      func: () => "x",
    });
    await expect(tool.invoke({ x: "no" })).rejects.toThrow();
  });
});

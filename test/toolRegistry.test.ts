import { describe, it, expect } from "vitest";
import ToolRegistry, { ToolNotFoundError } from "../src/toolRegistry";
import { Tool } from "../src/tools";
import * as z from "zod";

describe("ToolRegistry", () => {
  it("registers and invokes tools", async () => {
    const tool = new Tool(
      "t1",
      "d",
      z.object({ a: z.string() }),
      async (args) => `ok ${args.a}`
    );
    const reg = new ToolRegistry([tool]);
    const res = await reg.invoke("t1", JSON.stringify({ a: "x" }));
    expect(res).toBe("ok x");
  });

  it("throws ToolNotFoundError for unknown tool", async () => {
    const reg = new ToolRegistry([]);
    await expect(reg.invoke("nope", {})).rejects.toBeInstanceOf(
      ToolNotFoundError
    );
  });

  it("toDefinitions returns array", () => {
    const tool = new Tool(
      "t1",
      "d",
      z.object({ a: z.string() }),
      async () => "x"
    );
    const reg = new ToolRegistry([tool]);
    const defs = reg.toDefinitions();
    expect(Array.isArray(defs)).toBe(true);
  });
});

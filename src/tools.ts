import * as z from "zod";
import { OpenAIToolDef } from "./types";

export class ToolArgsParseError extends Error {}

export type ToolFunc<T> = (args: T) => Promise<string> | string;

export type ToolOptions<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  input: T;
  func: ToolFunc<z.infer<T>>;
};

export class Tool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  input: T;
  func: ToolFunc<z.infer<T>>;

  constructor({ name, description, input, func }: ToolOptions<T>) {
    this.name = name;
    this.description = description;
    this.input = input;
    this.func = func;
  }

  validate(raw: unknown): z.infer<T> {
    return this.input.parse(raw);
  }

  async invoke(raw: unknown | string): Promise<string> {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new ToolArgsParseError(
          `Failed to parse JSON arguments for tool ${this.name}: ${e}`
        );
      }
    }

    const validated = this.validate(parsed);
    return await this.func(validated as z.infer<T>);
  }

  toDefinition(): OpenAIToolDef {
    return {
      type: "function",
      name: this.name,
      description: this.description,
      parameters: z.toJSONSchema ? z.toJSONSchema(this.input) : null,
      strict: true,
    };
  }
}

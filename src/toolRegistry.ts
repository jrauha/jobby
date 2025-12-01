import { Tool } from "./tools";

export class ToolNotFoundError extends Error {}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(tools: Tool[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async invoke(name: string, rawArgs: unknown | string): Promise<string> {
    const tool = this.get(name);
    if (!tool) {
      throw new ToolNotFoundError(`Tool with name ${name} not found.`);
    }
    return await tool.invoke(rawArgs);
  }

  // Export a list suitable for passing to OpenAI client
  toDefinitions() {
    return Array.from(this.tools.values()).map((t) => t.toDefinition());
  }
}

export default ToolRegistry;

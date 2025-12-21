import OpenAI, { ClientOptions } from "openai";
import { AIModel, OpenAIMessage, OpenAIToolDef } from "./types";

export class OpenAIModel implements AIModel<OpenAIMessage> {
  private client: OpenAI;
  public readonly model: string;

  constructor(model: string, options?: ClientOptions) {
    this.model = model;
    this.client = new OpenAI({
      ...options,
    });
  }

  async invoke(input: OpenAIMessage[], tools?: OpenAIToolDef[]) {
    return await this.client.responses.create({
      model: this.model,
      tools: tools ?? [],
      input,
    });
  }
}

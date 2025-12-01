import OpenAI from "openai";
import { AIModel, Message, OpenAIToolDef } from "./types";

export class OpenAIModel implements AIModel {
  private client: OpenAI;
  public readonly model: string;

  constructor(model: string) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: process.env["OPENAI_API_KEY"],
    });
  }

  async invoke(input: Message[], tools?: OpenAIToolDef[]) {
    return await this.client.responses.create({
      model: this.model,
      tools: tools ?? [],
      input,
    });
  }
}

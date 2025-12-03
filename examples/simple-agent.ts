import { Agent, AgentRunner, Tool } from "../src/index.ts";
import z from "zod";

async function main() {
  const generateRandomNumberTool = new Tool(
    "generateRandomNumber",
    "Generates a random number between min and max (inclusive). Expects arguments: { min: number, max: number }",
    z.object({
      min: z.number().int(),
      max: z.number().int(),
    }),
    async ({ min, max }: { min: number; max: number }) => {
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      return `Generated random number: ${randomNum}`;
    }
  );

  const agent = new Agent({
    name: "Number assistant",
    instructions: "You are a helpful assistant.",
    model: "gpt-4o-mini",
    tools: [generateRandomNumberTool],
  });

  const finalState = await AgentRunner.run(
    agent,
    "Generate a random number between 1 and 100."
  );
  console.log("Final state:", finalState);
  console.log("Final assistant message:", JSON.stringify(finalState, null, 2));
}

main().catch((e) => console.error(e));

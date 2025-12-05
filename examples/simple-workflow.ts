import { Workflow, WorkflowRunner } from "../src";

type WorkflowState = {
  a: number;
  b: number;
  sum?: number;
  sqrt?: number;
};

async function main() {
  // Define a simple workflow:
  // 1. Sum two numbers (a + b)
  // 2. If sum >= 0, compute square root of sum
  // 3. Else, end workflow
  const simpleWorkflow = new Workflow<WorkflowState>()
    .addNode("sum_step", async (state) => {
      return {
        sum: state.a + state.b,
      };
    })
    .addNode("sqrt_step", async (state) => {
      return {
        sqrt: Math.sqrt(state.sum ?? 0),
      };
    })
    .addEdge("__START__", "sum_step")
    // Conditional edge based on sum value
    // If sum >= 0, go to sqrt_step, else end workflow
    .addConditionalEdge("sum_step", ["sqrt_step"], ({ sum = 0 }) => {
      return sum >= 0 ? "sqrt_step" : "__END__";
    });

  // Run with positive numbers
  const resultPos = await WorkflowRunner.run(simpleWorkflow, { a: 3, b: 4 });
  console.log("Result with positive sum:", resultPos);

  // Run with negative numbers
  const resultNeg = await WorkflowRunner.run(simpleWorkflow, { a: -5, b: 2 });
  console.log("Result with negative sum:", resultNeg); // Should not compute sqrt
}

main().catch((e) => console.error(e));

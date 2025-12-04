import { Workflow, WorkflowRunner } from "../src";

type WorkflowState = {
  a: number;
  b: number;
  sum?: number;
};

async function main() {
  const workflow = new Workflow<WorkflowState>()
    .addNode("sum_step", async (state) => {
      return {
        sum: state.a + state.b,
      };
    })
    .addEdge("__START__", "sum_step");

  const { sum } = await WorkflowRunner.run(workflow, { a: 5, b: 10 });
  console.log("Sum result:", sum); // Should output: Sum result: 15
}

main().catch((e) => console.error(e));

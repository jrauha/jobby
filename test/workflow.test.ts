import { describe, it, expect } from "vitest";
import {
  Workflow,
  WorkflowRunner,
  workflowReducer,
  WorkflowState,
  WorkflowAction,
  START,
} from "../src/workflow";

describe("Workflow", () => {
  describe("addNode", () => {
    it("should add a node to the workflow", () => {
      const workflow = new Workflow();
      const nodeFn = async () => ({ result: 42 });

      workflow.addNode("test_node", nodeFn);

      // Workflow should not throw when running with this node
      expect(workflow).toBeDefined();
    });

    it("should return workflow for chaining", () => {
      const workflow = new Workflow();
      const nodeFn = async () => ({ result: 42 });

      const result = workflow.addNode("test_node", nodeFn);

      expect(result).toBe(workflow);
    });

    it("should add multiple nodes", () => {
      const workflow = new Workflow();
      const node1 = async () => ({ a: 1 });
      const node2 = async () => ({ b: 2 });

      workflow.addNode("node1", node1).addNode("node2", node2);

      expect(workflow).toBeDefined();
    });

    it("should throw error when adding a node with duplicate id", () => {
      const workflow = new Workflow();
      const nodeFn = async () => ({});

      workflow.addNode("duplicate_node", nodeFn);

      expect(() => {
        workflow.addNode("duplicate_node", nodeFn);
      }).toThrowError("Workflow node already exists: duplicate_node");
    });
  });

  describe("addEdge", () => {
    it("should add an edge between two nodes", () => {
      const workflow = new Workflow();
      const node1 = async () => ({});
      const node2 = async () => ({});

      workflow.addNode("node1", node1).addNode("node2", node2);
      workflow.addEdge("node1", "node2");

      expect(workflow).toBeDefined();
    });

    it("should throw error if nodes do not exist", () => {
      const workflow = new Workflow();

      expect(() => {
        workflow.addEdge("nonexistent_from", "nonexistent_to");
      }).toThrowError(
        "Cannot add edge from nonexistent_from to nonexistent_to: node not found"
      );
    });

    it("should return workflow for chaining", () => {
      const workflow = new Workflow().addNode("first_node", async () => ({}));

      const result = workflow.addEdge(START, "first_node");

      expect(result).toBe(workflow);
    });

    it("should add multiple edges from same node", () => {
      const workflow = new Workflow()
        .addNode("node1", async () => ({}))
        .addNode("node2", async () => ({}));

      workflow.addEdge("__START__", "node1").addEdge("__START__", "node2");

      expect(workflow).toBeDefined();
    });
  });

  describe("addConditionalEdge", () => {
    it("should add a conditional edge between two nodes", () => {
      const workflow = new Workflow();
      const node1 = async () => ({});
      const node2 = async () => ({});
      const condition = () => "node2";

      workflow.addNode("node1", node1).addNode("node2", node2);
      workflow.addConditionalEdge("node1", "node2", condition);

      expect(workflow).toBeDefined();
    });

    it("should throw error if nodes do not exist", () => {
      const workflow = new Workflow();
      const condition = () => "nonexistent_to";

      expect(() => {
        workflow.addConditionalEdge(
          "nonexistent_from",
          ["nonexistent_to"],
          condition
        );
      }).toThrowError(
        "Cannot add edge from nonexistent_from to nonexistent_to: node not found"
      );
    });

    it("should return workflow for chaining", () => {
      const workflow = new Workflow()
        .addNode("first_node", async () => ({}))
        .addNode("second_node", async () => ({}));

      const condition = () => "second_node";

      const result = workflow.addConditionalEdge(
        "first_node",
        ["second_node"],
        condition
      );

      expect(result).toBe(workflow);
    });
  });
});

describe("WorkflowRunner", () => {
  describe("run", () => {
    it("should execute a simple linear workflow", async () => {
      const workflow = new Workflow();
      const node1 = async () => ({
        step1: "completed",
      });
      const node2 = async () => ({
        step2: "completed",
      });

      workflow
        .addNode("node1", node1)
        .addNode("node2", node2)
        .addEdge("__START__", "node1")
        .addEdge("node1", "node2");

      const result = await WorkflowRunner.run(workflow, {
        initial: "data",
      });

      expect(result.step1).toBe("completed");
      expect(result.step2).toBe("completed");
      expect(result.initial).toBe("data");
    });

    it("should execute nodes in correct order", async () => {
      const workflow = new Workflow();
      const executionOrder: string[] = [];

      const node1 = async () => {
        executionOrder.push("node1");
        return { node1Done: true };
      };
      const node2 = async () => {
        executionOrder.push("node2");
        return { node2Done: true };
      };
      const node3 = async () => {
        executionOrder.push("node3");
        return { node3Done: true };
      };

      workflow
        .addNode("node1", node1)
        .addNode("node2", node2)
        .addNode("node3", node3)
        .addEdge("__START__", "node1")
        .addEdge("node1", "node2")
        .addEdge("node2", "node3");

      await WorkflowRunner.run(workflow);

      expect(executionOrder).toEqual(["node1", "node2", "node3"]);
    });

    it("should handle synchronous node functions", async () => {
      const workflow = new Workflow();
      const syncNode = (state: Record<string, unknown>) => ({
        ...state,
        syncResult: "success",
      });

      workflow.addNode("sync_node", syncNode).addEdge("__START__", "sync_node");

      const result = await WorkflowRunner.run(workflow);

      expect(result.syncResult).toBe("success");
    });

    it("should pass state between nodes", async () => {
      const workflow = new Workflow();
      const node1 = async (state: Record<string, unknown>) => ({
        ...state,
        counter: 1,
      });
      const node2 = async (state: Record<string, unknown>) => ({
        ...state,
        counter: (state.counter as number) + 1,
      });
      const node3 = async (state: Record<string, unknown>) => ({
        ...state,
        counter: (state.counter as number) * 2,
      });

      workflow
        .addNode("node1", node1)
        .addNode("node2", node2)
        .addNode("node3", node3)
        .addEdge("__START__", "node1")
        .addEdge("node1", "node2")
        .addEdge("node2", "node3");

      const result = await WorkflowRunner.run(workflow);

      expect(result.counter).toBe(4); // (1 + 1) * 2
    });

    it("should handle workflow with no nodes", async () => {
      const workflow = new Workflow();

      const result = await WorkflowRunner.run(workflow, {
        initial: "value",
      });

      expect(result.initial).toBe("value");
    });

    it("should handle multiple children from one node", async () => {
      const workflow = new Workflow();
      const executionOrder: string[] = [];

      const node1 = async (state: Record<string, unknown>) => {
        executionOrder.push("node1");
        return { ...state };
      };
      const node2 = async (state: Record<string, unknown>) => {
        executionOrder.push("node2");
        return { ...state };
      };
      const node3 = async (state: Record<string, unknown>) => {
        executionOrder.push("node3");
        return { ...state };
      };

      workflow
        .addNode("node1", node1)
        .addNode("node2", node2)
        .addNode("node3", node3)
        .addEdge("__START__", "node1")
        .addEdge("node1", "node2")
        .addEdge("node1", "node3");

      await WorkflowRunner.run(workflow);

      // node1 should execute first, then node2 and node3 in insertion order
      expect(executionOrder[0]).toBe("node1");
      expect(executionOrder).toContain("node2");
      expect(executionOrder).toContain("node3");
      expect(executionOrder.length).toBe(3);
    });

    it("should handle async conditions", async () => {
      const workflow = new Workflow();
      const executionOrder: string[] = [];

      const node1 = async () => {
        executionOrder.push("node1");
        return { value: 10 };
      };

      const node2 = async () => {
        executionOrder.push("node2");
        return {};
      };

      workflow
        .addNode("node1", node1)
        .addNode("node2", node2)
        .addEdge("__START__", "node1")
        .addConditionalEdge("node1", "node2", async (state) => {
          // Simulate async condition evaluation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return (state.value as number) > 5 ? "node2" : "node2";
        });

      await WorkflowRunner.run(workflow);

      expect(executionOrder).toEqual(["node1", "node2"]);
    });

    it("should execute branching workflow based on conditions", async () => {
      const workflow = new Workflow();

      const checkValue = async () => {
        return { value: 7 };
      };

      const handleLow = async () => {
        return { result: "low" };
      };

      const handleHigh = async () => {
        return { result: "high" };
      };

      workflow
        .addNode("check", checkValue)
        .addNode("low", handleLow)
        .addNode("high", handleHigh)
        .addEdge("__START__", "check")
        .addConditionalEdge("check", ["low", "high"], (state) =>
          (state.value as number) < 5 ? "low" : "high"
        );

      const result = await WorkflowRunner.run(workflow);

      expect(result.value).toBe(7);
      expect(result.result).toBe("high");
    });
  });
});

it("should run a workflow with initial state", async () => {
  const workflow = new Workflow();
  const node1 = async () => ({
    processed: true,
  });

  workflow.addNode("node1", node1).addEdge("__START__", "node1");

  const result = await WorkflowRunner.run(workflow, { input: "test" });

  expect(result.input).toBe("test");
  expect(result.processed).toBe(true);
});

it("should run a workflow without initial state", async () => {
  const workflow = new Workflow();
  const node1 = async () => ({
    output: "generated",
  });

  workflow.addNode("node1", node1).addEdge("__START__", "node1");

  const result = await WorkflowRunner.run(workflow);

  expect(result.output).toBe("generated");
});

it("should handle complex workflow execution", async () => {
  const workflow = new Workflow();

  const fetchData = async () => ({
    data: "raw_data",
  });

  const processData = async (state: Record<string, unknown>) => ({
    data: `processed_${state.data}`,
  });

  const saveData = async () => ({
    saved: true,
  });

  workflow
    .addNode("fetch", fetchData)
    .addNode("process", processData)
    .addNode("save", saveData)
    .addEdge("__START__", "fetch")
    .addEdge("fetch", "process")
    .addEdge("process", "save");

  const result = await WorkflowRunner.run(workflow);

  expect(result.data).toBe("processed_raw_data");
  expect(result.saved).toBe(true);
});

describe("workflowReducer", () => {
  it("should handle WORKFLOW_NODE_OUTPUT action", () => {
    const action: WorkflowAction = {
      type: "WORKFLOW_NODE_OUTPUT",
      nodeId: "node1",
      output: { result: 42, status: "complete" },
    };

    const newState = workflowReducer({}, action);

    expect(newState.result).toBe(42);
    expect(newState.status).toBe("complete");
  });

  it("should merge output with existing state", () => {
    const initialState: WorkflowState = {
      existing: "value",
    };

    const action: WorkflowAction = {
      type: "WORKFLOW_NODE_OUTPUT",
      nodeId: "node1",
      output: { newKey: "newValue" },
    };

    const newState = workflowReducer(initialState, action);

    expect(newState.existing).toBe("value");
    expect(newState.newKey).toBe("newValue");
  });

  it("should return state unchanged for unknown action", () => {
    const initialState: WorkflowState = {
      value: 123,
    };

    const action = {
      type: "UNKNOWN_ACTION",
    } as unknown as WorkflowAction;

    const newState = workflowReducer(initialState, action);

    expect(newState).toEqual(initialState);
  });
});

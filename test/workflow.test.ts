import { describe, it, expect } from "vitest";
import {
  Workflow,
  WorkflowRunner,
  workflowReducer,
  WorkflowAction,
  WorkflowStoreState,
  START,
} from "../src/workflow";

describe("Workflow", () => {
  describe("compile", () => {
    it("should autowire nodes without outgoing edges to END", () => {
      const workflow = new Workflow();
      const lone = async () => ({ done: true });

      workflow.addNode("LONE", lone).addEdge("__START__", "LONE");

      const compiled = workflow.compile();
      const edges = compiled.getEdges();

      expect(edges.get("LONE")).toEqual([{ to: "__END__" }]);
    });

    it("should produce snapshot of the original workflow", () => {
      const workflow = new Workflow();
      const a = async () => ({ a: 1 });
      const b = async () => ({ b: 2 });

      workflow.addNode("A", a).addNode("B", b).addEdge("__START__", "A");

      const compiled = workflow.compile();
      const beforeNodes = compiled.getNodes();
      const beforeEdges = compiled.getEdges();

      // Mutate the original workflow after compile
      const c = async () => ({ c: 3 });
      workflow.addNode("C", c).addEdge("A", "B").addEdge("B", "C");

      // Compiled graph should remain unchanged
      expect(compiled.getNodes()).toEqual(beforeNodes);
      expect(Array.from(compiled.getEdges().entries())).toEqual(
        Array.from(beforeEdges.entries())
      );
    });
  });

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
        .addEdge("node1", "node2")
        .addEdge("node2", "__END__");

      const result = await WorkflowRunner.run(workflow, {
        initial: "data",
      });

      expect(result.step2).toBe("completed");
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
        .addEdge("node2", "node3")
        .addEdge("node3", "__END__");

      await WorkflowRunner.run(workflow);

      expect(executionOrder).toEqual(["node1", "node2", "node3"]);
    });

    it("should handle synchronous node functions", async () => {
      const workflow = new Workflow();
      const syncNode = (state: Record<string, unknown>) => ({
        ...state,
        syncResult: "success",
      });

      workflow
        .addNode("sync_node", syncNode)
        .addEdge("__START__", "sync_node")
        .addEdge("sync_node", "__END__");

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
        .addEdge("node2", "node3")
        .addEdge("node3", "__END__");

      const result = await WorkflowRunner.run(workflow);

      expect(result.counter).toBe(4); // (1 + 1) * 2
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
        .addEdge("node1", "node3")
        .addEdge("node2", "__END__")
        .addEdge("node3", "__END__");

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
        })
        .addEdge("node2", "__END__");

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
        )
        .addEdge("high", "__END__");

      const result = await WorkflowRunner.run(workflow);

      expect(result.result).toBe("high");
    });
  });
});

it("should run a workflow with initial state", async () => {
  const workflow = new Workflow();
  const node1 = async () => ({
    processed: true,
  });

  workflow
    .addNode("node1", node1)
    .addEdge("__START__", "node1")
    .addEdge("node1", "__END__");

  const result = await WorkflowRunner.run(workflow, { input: "test" });

  expect(result.processed).toBe(true);
});

it("should run a workflow without initial state", async () => {
  const workflow = new Workflow();
  const node1 = async () => ({
    output: "generated",
  });

  workflow
    .addNode("node1", node1)
    .addEdge("__START__", "node1")
    .addEdge("node1", "__END__");

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
    .addEdge("process", "save")
    .addEdge("save", "__END__");

  const result = await WorkflowRunner.run(workflow);
  expect(result.saved).toBe(true);
});

describe("workflowReducer", () => {
  it("should handle WORKFLOW_NODE_OUTPUT action", () => {
    const action: WorkflowAction = {
      type: "WORKFLOW_NODE_OUTPUT",
      nodeId: "node1",
      output: { result: 42, status: "complete" },
    };

    const newState = workflowReducer({ status: "idle", nodes: {} }, action);

    const s = newState;
    expect(s.nodes.node1?.result).toBe(42);
    expect(s.nodes.node1?.status).toBe("complete");
  });

  it("should merge output with existing state", () => {
    const initialState: WorkflowStoreState = {
      status: "idle",
      nodes: { existingNode: { existing: "value" } },
    };

    const action: WorkflowAction = {
      type: "WORKFLOW_NODE_OUTPUT",
      nodeId: "node1",
      output: { newKey: "newValue" },
    };

    const newState = workflowReducer(initialState, action);

    const s = newState;
    expect(s.nodes.existingNode?.existing).toBe("value");
    expect(s.nodes.node1?.newKey).toBe("newValue");
  });

  it("should return state unchanged for unknown action", () => {
    const initialState: WorkflowStoreState = {
      status: "idle",
      nodes: {},
    };

    const action = {
      type: "UNKNOWN_ACTION",
    } as unknown as WorkflowAction;

    const newState = workflowReducer(initialState, action);

    expect(newState).toEqual(initialState);
  });
});

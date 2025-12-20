import { InMemoryStore } from "./store";
import * as z from "zod";
import type {
  CompiledWorkflow,
  Edge,
  EdgeWithCondition,
  NodeId,
  WorkflowConditionFn,
  WorkflowGraph,
  WorkflowNodeFn,
  WorkflowState,
} from "./types";
import { COMPILED_BRAND } from "./types";

export const START = "__START__";
export const END = "__END__";

type WorkflowStatus = "idle" | "running" | "completed" | "error";

export type WorkflowAction<S extends WorkflowState = WorkflowState> =
  | {
      type: "WORKFLOW_NODE_INPUT";
      nodeId: string;
      input: S;
    }
  | {
      type: "WORKFLOW_NODE_OUTPUT";
      nodeId: string;
      output: S;
    }
  | {
      type: "WORKFLOW_START";
    }
  | {
      type: "WORKFLOW_END";
    }
  | {
      type: "WORKFLOW_ERROR";
      error: string;
    };

export type WorkflowStoreState<S extends WorkflowState = WorkflowState> = {
  activeNodes?: string[];
  status: WorkflowStatus;
  error?: string;
  nodes: Record<string, S>;
};

export function workflowReducer<S extends WorkflowState>(
  state: WorkflowStoreState<S>,
  action: WorkflowAction<S>
): WorkflowStoreState<S> {
  switch (action.type) {
    case "WORKFLOW_NODE_INPUT":
      return {
        ...state,
        activeNodes: [...(state.activeNodes || []), action.nodeId],
      };
    case "WORKFLOW_NODE_OUTPUT":
      return {
        ...state,
        activeNodes: (state.activeNodes || []).filter(
          (id) => id !== action.nodeId
        ),
        nodes: {
          ...(state.nodes || {}),
          [action.nodeId]: action.output,
        },
      };
    case "WORKFLOW_START":
      return {
        ...state,
        status: "running",
      };
    case "WORKFLOW_END":
      return {
        ...state,
        status: "completed",
      };
    case "WORKFLOW_ERROR":
      return {
        ...state,
        status: "error",
        error: action.error,
      };
    default:
      return state;
  }
}

function isEdgeWithCondition<S extends WorkflowState = WorkflowState>(
  edge: Edge | EdgeWithCondition<S>
): edge is EdgeWithCondition<S> {
  return (edge as EdgeWithCondition<S>).condition !== undefined;
}

function isWorkflowCompiled<S extends WorkflowState = WorkflowState>(
  workflow: CompiledWorkflow<S> | Workflow<S>
): workflow is CompiledWorkflow<S> {
  return (workflow as CompiledWorkflow<S>).__compiled === COMPILED_BRAND;
}

export class Workflow<
  S extends WorkflowState = WorkflowState,
> implements WorkflowGraph<S> {
  private nodes: Map<NodeId, WorkflowNodeFn<S>> = new Map();
  private edges: Map<NodeId, (Edge | EdgeWithCondition<S>)[]> = new Map();
  public readonly schema: z.ZodType<S>;

  constructor(options: { schema: z.ZodType<S> }) {
    this.addNode(START, async (s) => s);
    this.addNode(END, async (s) => s);
    this.schema = options.schema;
  }

  addNode(id: NodeId, fn: WorkflowNodeFn<S>): this {
    if (this.nodes.has(id)) {
      throw new Error(`Workflow node already exists: ${id}`);
    }
    this.nodes.set(id, fn);
    return this;
  }

  addEdge(from: NodeId, to: NodeId): this {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Cannot add edge from ${from} to ${to}: node not found`);
    }
    const list = this.edges.get(from) ?? [];
    list.push({ to });
    this.edges.set(from, list);
    return this;
  }

  addConditionalEdge(
    from: NodeId,
    to: NodeId | NodeId[],
    condition: WorkflowConditionFn<S>
  ): this {
    const toArray = Array.isArray(to) ? to : [to];
    if (!this.nodes.has(from)) {
      throw new Error(
        `Cannot add edge from ${from} to ${toArray.join(", ")}: node not found`
      );
    }
    for (const targetNode of toArray) {
      if (!this.nodes.has(targetNode)) {
        throw new Error(
          `Cannot add edge from ${from} to ${toArray.join(", ")}: node not found`
        );
      }
    }
    const list = this.edges.get(from) ?? [];
    list.push({ to: toArray, condition });
    this.edges.set(from, list);
    return this;
  }

  getNodes(): NodeId[] {
    return Array.from(this.nodes.keys());
  }

  getEdges(): Map<NodeId, (Edge | EdgeWithCondition<S>)[]> {
    return new Map(this.edges);
  }

  getNode(id: NodeId): WorkflowNodeFn<S> | undefined {
    return this.nodes.get(id);
  }

  getInputSchema(): z.ZodType<S> {
    return this.schema;
  }

  compile(): CompiledWorkflow<S> {
    if (!this.nodes.has(START)) {
      throw new Error("Workflow is missing START node");
    }
    if (!this.nodes.has(END)) {
      throw new Error("Workflow is missing END node");
    }

    const nodesSnapshot = Array.from(this.nodes.keys());
    const nodesMapSnapshot = new Map(this.nodes);
    const edgesSnapshot = new Map<NodeId, (Edge | EdgeWithCondition<S>)[]>();
    for (const [k, v] of this.edges.entries()) {
      edgesSnapshot.set(
        k,
        v.map((e) => ({ ...e }))
      );
    }

    // Autowire edges for nodes without outgoing edges to END
    for (const nodeId of nodesSnapshot) {
      if (!edgesSnapshot.has(nodeId)) {
        if (nodeId !== END) {
          edgesSnapshot.set(nodeId, [{ to: END }]);
        }
      }
    }

    const graph: CompiledWorkflow<S> = {
      getNodes: () => nodesSnapshot.slice(),
      getEdges: () => new Map(edgesSnapshot),
      getNode: (id: NodeId) => nodesMapSnapshot.get(id),
      schema: this.schema,
      __compiled: COMPILED_BRAND,
    };

    return graph;
  }
}

export class WorkflowRunner {
  static async run<S extends WorkflowState = WorkflowState>(
    workflow: CompiledWorkflow<S> | Workflow<S>,
    initial: unknown,
    options: {
      onWorkflowEvent?: (
        state: WorkflowStoreState<S>,
        action: WorkflowAction<S>
      ) => void;
    } = {}
  ): Promise<S> {
    const compiledWorkflow = isWorkflowCompiled<S>(workflow)
      ? workflow
      : workflow.compile();

    const schema = compiledWorkflow.schema;
    let parsedInitial: S;
    try {
      parsedInitial = schema.parse(initial);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Workflow initial input does not match input schema: ${message}`
      );
    }

    const store = new InMemoryStore<WorkflowStoreState<S>, WorkflowAction<S>>(
      workflowReducer<S>,
      {
        status: "idle",
        nodes: { [START]: parsedInitial },
      }
    );

    if (options.onWorkflowEvent) {
      store.subscribe(options.onWorkflowEvent);
    }

    store.dispatch({ type: "WORKFLOW_START" });

    const queue: Array<[NodeId, S]> = [[START, parsedInitial]];
    const edges = compiledWorkflow.getEdges();

    while (queue.length) {
      const [id, input] = queue.shift()!;

      const fn = compiledWorkflow.getNode(id);
      if (!fn) {
        throw new Error(`Workflow node not found: ${id}`);
      }

      store.dispatch({ type: "WORKFLOW_NODE_INPUT", nodeId: id, input });

      const output = await Promise.resolve(fn(input));

      store.dispatch({ type: "WORKFLOW_NODE_OUTPUT", nodeId: id, output });

      const neighbors = edges.get(id) ?? [];

      for (const edge of neighbors) {
        if (isEdgeWithCondition<S>(edge)) {
          const targetId = await Promise.resolve(edge.condition(output));
          if (!edge.to.includes(targetId)) {
            throw new Error(
              `Workflow edge condition returned invalid target: ${targetId}`
            );
          }
          queue.push([targetId, output]);
        } else {
          queue.push([edge.to, output]);
        }
      }
    }

    store.dispatch({ type: "WORKFLOW_END" });

    const finalState = store.getState().nodes[END];
    if (!finalState) {
      throw new Error("Workflow did not reach END node");
    }
    return finalState;
  }
}

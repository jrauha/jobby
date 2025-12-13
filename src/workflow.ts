import { InMemoryStore } from "./store";
import type {
  Edge,
  EdgeWithCondition,
  NodeId,
  WorkflowConditionFn,
  WorkflowGraph,
  WorkflowNodeFn,
  WorkflowState,
} from "./types";

export const START = "__START__";
export const END = "__END__";

export type WorkflowAction<S extends WorkflowState = WorkflowState> = {
  type: "WORKFLOW_NODE_OUTPUT";
  nodeId: string;
  output: Partial<S>;
};

export function workflowReducer<S extends WorkflowState = WorkflowState>(
  state: S,
  action: WorkflowAction<S>
): S {
  switch (action.type) {
    case "WORKFLOW_NODE_OUTPUT":
      return {
        ...state,
        ...action.output,
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

export class Workflow<S extends WorkflowState = WorkflowState> {
  private nodes: Map<NodeId, WorkflowNodeFn<S>> = new Map();
  private edges: Map<NodeId, (Edge | EdgeWithCondition<S>)[]> = new Map();

  constructor() {
    this.addNode(START, async (s) => s);
    this.addNode(END, async (s) => s);
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
}

export class WorkflowRunner {
  static async run<S extends WorkflowState = WorkflowState>(
    workflow: WorkflowGraph<S>,
    initial: S = {} as S
  ): Promise<S> {
    const store = new InMemoryStore<S, WorkflowAction<S>>(
      workflowReducer<S>,
      initial
    );
    const queue: Array<NodeId> = [START];

    while (queue.length) {
      const id = queue.shift()!;

      const fn = workflow.getNode(id);
      if (!fn) {
        throw new Error(`Workflow node not found: ${id}`);
      }

      const output = await Promise.resolve(fn(store.getState()));

      store.dispatch({ type: "WORKFLOW_NODE_OUTPUT", nodeId: id, output });

      const edges = workflow.getEdges().get(id) ?? [];
      const currentState = store.getState();

      for (const edge of edges) {
        if (edge.to === END) {
          continue;
        }
        if (isEdgeWithCondition<S>(edge)) {
          const targetId = await Promise.resolve(edge.condition(currentState));
          if (targetId === END) {
            continue;
          }
          if (!edge.to.includes(targetId)) {
            throw new Error(
              `Workflow edge condition returned invalid target: ${targetId}`
            );
          }
          queue.push(targetId);
        } else {
          queue.push(edge.to);
        }
      }
    }

    return store.getState();
  }
}

import { InMemoryStore } from "./store";
import type { Context, Runnable, State as StoreState } from "./types";

export const START = "__START__";
export const END = "__END__";

export type WorkflowState = StoreState<Record<string, unknown>>;

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

export type WorkflowNodeFn<S extends WorkflowState = WorkflowState> = (
  state: S
) => Promise<Partial<S>> | Partial<S>;

export interface WorkflowConditionFn<S extends WorkflowState = WorkflowState> {
  (state: S): NodeId | Promise<NodeId>;
}

type NodeId = string;

type Edge = {
  to: NodeId;
};

type EdgeWithCondition<S extends WorkflowState = WorkflowState> = {
  to: NodeId[];
  condition: WorkflowConditionFn<S>;
};

function isEdgeWithCondition<S extends WorkflowState = WorkflowState>(
  edge: Edge | EdgeWithCondition<S>
): edge is EdgeWithCondition<S> {
  return (edge as EdgeWithCondition<S>).condition !== undefined;
}

export class Workflow<
  S extends WorkflowState = WorkflowState,
> implements Runnable<S> {
  private nodes: Map<NodeId, WorkflowNodeFn<S>> = new Map();
  private edges: Map<NodeId, (Edge | EdgeWithCondition<S>)[]> = new Map();

  constructor() {
    this.addNode(START, async (s) => s);
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

  getNodes(): Map<NodeId, WorkflowNodeFn<S>> {
    return new Map(this.nodes);
  }

  getEdges(): Map<NodeId, (Edge | EdgeWithCondition<S>)[]> {
    return new Map(this.edges);
  }

  async run(ctx: Context<S, WorkflowAction<S>>): Promise<S> {
    const queue: Array<NodeId> = [START];

    while (queue.length) {
      const id = queue.shift()!;

      const fn = this.nodes.get(id);
      if (!fn) {
        throw new Error(`Workflow node not found: ${id}`);
      }

      const output = await Promise.resolve(fn(ctx.store.getState()));

      ctx.store.dispatch({ type: "WORKFLOW_NODE_OUTPUT", nodeId: id, output });

      const edges = this.edges.get(id) ?? [];
      const currentState = ctx.store.getState();

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

    return ctx.store.getState();
  }
}

export class WorkflowRunner {
  static async run<S extends WorkflowState = WorkflowState>(
    workflow: Runnable<S>,
    initial: S = {} as S
  ): Promise<S> {
    const store = new InMemoryStore<S, WorkflowAction<S>>(
      workflowReducer<S>,
      initial
    );
    const ctx = {
      store,
    };
    const final = await workflow.run(ctx);
    return final;
  }
}

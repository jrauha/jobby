import { InMemoryStore } from "./store";
import type { Context, State as StoreState } from "./types";

export const START = "__START__";

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

type NodeId = string;

export class Workflow<S extends WorkflowState = WorkflowState> {
  private nodes: Map<NodeId, WorkflowNodeFn<S>> = new Map();
  private edges: Map<NodeId, NodeId[]> = new Map();

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
    list.push(to);
    this.edges.set(from, list);
    return this;
  }

  getNodes(): Map<NodeId, WorkflowNodeFn<S>> {
    return new Map(this.nodes);
  }

  getEdges(): Map<NodeId, NodeId[]> {
    return new Map(this.edges);
  }

  async run(ctx: Context<S, WorkflowAction<S>>): Promise<S> {
    const startChildren = this.edges.get(START) ?? [];
    const queue: Array<NodeId> = startChildren;

    while (queue.length) {
      const id = queue.shift()!;

      const fn = this.nodes.get(id);
      if (!fn) {
        throw new Error(`Workflow node not found: ${id}`);
      }

      const output = await Promise.resolve(fn(ctx.store.getState()));

      ctx.store.dispatch({ type: "WORKFLOW_NODE_OUTPUT", nodeId: id, output });

      const children = this.edges.get(id) ?? [];
      for (const c of children) {
        queue.push(c);
      }
    }

    return ctx.store.getState();
  }
}

export class WorkflowRunner {
  static async run<S extends WorkflowState = WorkflowState>(
    workflow: Workflow<S>,
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

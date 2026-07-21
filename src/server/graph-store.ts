import type {
  EdgeType,
  GraphDataset,
  GraphEdge,
  GraphNode,
  NodeType
} from "../shared/graph.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export class GraphStore {
  readonly dataset: GraphDataset;
  private readonly nodesById = new Map<string, GraphNode>();
  private readonly edgesById = new Map<string, GraphEdge>();
  private readonly outgoing = new Map<string, GraphEdge[]>();
  private readonly incoming = new Map<string, GraphEdge[]>();

  constructor(dataset: GraphDataset) {
    this.dataset = dataset;

    for (const node of dataset.nodes) {
      if (this.nodesById.has(node.id)) {
        throw new Error(`Duplicate node id: ${node.id}`);
      }
      this.nodesById.set(node.id, node);
    }

    for (const edge of dataset.edges) {
      if (this.edgesById.has(edge.id)) {
        throw new Error(`Duplicate edge id: ${edge.id}`);
      }
      if (!this.nodesById.has(edge.from) || !this.nodesById.has(edge.to)) {
        throw new Error(`Dangling edge ${edge.id}: ${edge.from} -> ${edge.to}`);
      }
      this.edgesById.set(edge.id, edge);
      this.outgoing.set(edge.from, [...(this.outgoing.get(edge.from) ?? []), edge]);
      this.incoming.set(edge.to, [...(this.incoming.get(edge.to) ?? []), edge]);
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edgesById.get(id);
  }

  nodes(types?: NodeType[]): GraphNode[] {
    if (!types?.length) return [...this.nodesById.values()];
    const allowed = new Set(types);
    return [...this.nodesById.values()].filter((node) => allowed.has(node.type));
  }

  edgesFrom(id: string, type?: EdgeType): GraphEdge[] {
    const edges = this.outgoing.get(id) ?? [];
    return type ? edges.filter((edge) => edge.type === type) : edges;
  }

  edgesTo(id: string, type?: EdgeType): GraphEdge[] {
    const edges = this.incoming.get(id) ?? [];
    return type ? edges.filter((edge) => edge.type === type) : edges;
  }

  findBestMention(text: string, types?: NodeType[]): GraphNode | undefined {
    const haystack = ` ${normalize(text)} `;
    const candidates = this.nodes(types)
      .flatMap((node) =>
        [node.label, ...node.aliases].map((alias) => ({
          node,
          alias: normalize(alias)
        }))
      )
      .filter(({ alias }) => alias.length > 1 && haystack.includes(` ${alias} `))
      .sort((a, b) => b.alias.length - a.alias.length);
    return candidates[0]?.node;
  }

  /**
   * Token-based fuzzy lookup for plain-text mentions like "orbit cdk".
   * A candidate scores by the fraction of query tokens found as substrings
   * of its normalized label or aliases (spaces removed, so "orbit cdk"
   * matches "OrbitGndsysCDK").
   */
  fuzzyFindMentions(
    topic: string,
    types?: NodeType[],
    limit = 4
  ): Array<{ node: GraphNode; score: number }> {
    const tokens = normalize(topic)
      .split(" ")
      .filter((token) => token.length > 1);
    if (!tokens.length) return [];

    return this.nodes(types)
      .map((node) => {
        const values = [node.label, ...node.aliases].map((value) =>
          normalize(value).replace(/ /g, "")
        );
        const matched = tokens.filter((token) =>
          values.some((value) => value.includes(token))
        );
        return { node, score: matched.length / tokens.length };
      })
      .filter(({ score }) => score >= 0.5)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.node.label.length - b.node.label.length ||
          a.node.label.localeCompare(b.node.label)
      )
      .slice(0, limit);
  }

  search(query: string, limit = 8): GraphNode[] {
    const needle = normalize(query);
    if (!needle) return [];

    return this.nodes()
      .map((node) => {
        const values = [node.label, ...node.aliases].map(normalize);
        const exact = values.some((value) => value === needle);
        const starts = values.some((value) => value.startsWith(needle));
        const includes = values.some((value) => value.includes(needle));
        return { node, score: exact ? 3 : starts ? 2 : includes ? 1 : 0 };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label))
      .slice(0, limit)
      .map(({ node }) => node);
  }

  currentActor(): GraphNode | undefined {
    return this.nodes(["person"]).find(
      (node) => node.attributes.currentActor === true
    );
  }
}

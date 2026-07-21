import type { GraphNode, GraphPath, PathEdge } from "../shared/graph.js";

export interface GraphNode3D extends GraphNode {
  fx: number;
  fy: number;
  fz: number;
  status: "verified" | "missing";
}

export interface GraphLink3D {
  id: string;
  source: string;
  target: string;
  label: string;
  status: PathEdge["status"];
}

export interface GraphData3D {
  nodes: GraphNode3D[];
  links: GraphLink3D[];
}

function nodeDepths(path: GraphPath): Map<string, number> {
  const ids = new Set(path.nodes.map((node) => node.id));
  const incoming = new Map(path.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(path.nodes.map((node) => [node.id, [] as string[]]));
  const connected = new Set<string>();

  for (const edge of path.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    connected.add(edge.from);
    connected.add(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const roots = path.nodes
    .filter(
      (node) =>
        incoming.get(node.id) === 0 &&
        (connected.size === 0 || connected.has(node.id))
    )
    .map((node) => node.id);
  const queue = roots.length ? roots : path.nodes.slice(0, 1).map((node) => node.id);
  const depths = new Map(queue.map((id) => [id, 0]));

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const depth = depths.get(id) ?? 0;
    for (const target of outgoing.get(id) ?? []) {
      const nextDepth = depth + 1;
      if ((depths.get(target) ?? Number.POSITIVE_INFINITY) <= nextDepth) continue;
      depths.set(target, nextDepth);
      queue.push(target);
    }
  }

  let fallbackDepth = Math.max(0, ...depths.values()) + 1;
  for (const node of path.nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, fallbackDepth);
      fallbackDepth += 1;
    }
  }
  return depths;
}

export function buildGraph3DData(path: GraphPath): GraphData3D {
  const depths = nodeDepths(path);
  const levels = new Map<number, GraphNode[]>();
  const missingTargets = new Set(
    path.edges
      .filter((edge) => edge.status === "missing")
      .map((edge) => edge.to)
  );

  for (const node of path.nodes) {
    const depth = depths.get(node.id) ?? 0;
    levels.set(depth, [...(levels.get(depth) ?? []), node]);
  }

  const maxDepth = Math.max(0, ...depths.values());
  const nodes = path.nodes.map<GraphNode3D>((node) => {
    const depth = depths.get(node.id) ?? 0;
    const peers = levels.get(depth) ?? [node];
    const peerIndex = peers.findIndex((peer) => peer.id === node.id);
    const count = peers.length;
    // Distribute peers around a ring in the y/z plane so the layout is
    // volumetric rather than flat; ring phase shifts per depth so
    // neighboring levels interleave when the camera orbits.
    const angle = (peerIndex / count) * Math.PI * 2 + depth * 0.9 + 0.35;
    const radius = count > 1 ? 62 + count * 20 : 0;
    const depthWave = Math.sin(depth * 1.15) * 58;

    return {
      ...node,
      fx: (depth - maxDepth / 2) * 138,
      fy: radius * Math.cos(angle),
      fz: depthWave + radius * Math.sin(angle) * 0.85,
      status: missingTargets.has(node.id) ? "missing" : "verified"
    };
  });

  return {
    nodes,
    links: path.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      status: edge.status
    }))
  };
}

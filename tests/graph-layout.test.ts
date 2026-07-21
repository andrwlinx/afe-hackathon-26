import { describe, expect, it } from "vitest";
import { buildGraph3DData } from "../src/client/graph-layout.js";
import type { GraphNode, GraphPath, PathEdge } from "../src/shared/graph.js";

function node(id: string): GraphNode {
  return {
    id,
    type: "resource",
    label: id.toUpperCase(),
    aliases: [],
    attributes: {}
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  status: PathEdge["status"] = "verified"
): PathEdge {
  return {
    id,
    type: "DEPENDS_ON",
    from,
    to,
    label: "depends on",
    attributes: {},
    status
  };
}

describe("buildGraph3DData", () => {
  it("creates stable depth coordinates for a directed path", () => {
    const path: GraphPath = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("ab", "a", "b"), edge("bc", "b", "c")]
    };

    const first = buildGraph3DData(path);
    const second = buildGraph3DData(path);

    expect(second).toEqual(first);
    expect(first.nodes.map((item) => item.fx)).toEqual([-175, 0, 175]);
    expect(first.nodes.every((item) => Number.isFinite(item.fz))).toBe(true);
  });

  it("spreads branches and marks the target of a missing edge", () => {
    const path: GraphPath = {
      nodes: [node("root"), node("left"), node("right")],
      edges: [
        edge("root-left", "root", "left"),
        edge("root-right", "root", "right", "missing")
      ]
    };

    const data = buildGraph3DData(path);
    const left = data.nodes.find((item) => item.id === "left");
    const right = data.nodes.find((item) => item.id === "right");

    expect(left?.fy).not.toBe(right?.fy);
    expect(left?.status).toBe("verified");
    expect(right?.status).toBe("missing");
  });

  it("places disconnected nodes at deterministic fallback depths", () => {
    const path: GraphPath = {
      nodes: [node("root"), node("connected"), node("orphan")],
      edges: [edge("connected", "root", "connected")]
    };

    const data = buildGraph3DData(path);
    const connected = data.nodes.find((item) => item.id === "connected");
    const orphan = data.nodes.find((item) => item.id === "orphan");

    expect(orphan!.fx).toBeGreaterThan(connected!.fx);
  });
});

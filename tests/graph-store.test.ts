import { describe, expect, it } from "vitest";
import type { GraphDataset } from "../src/shared/graph.js";
import { GraphStore } from "../src/server/graph-store.js";

const evidence = {
  source: "manual" as const,
  observedAt: "2026-07-20T20:00:00.000Z",
  mode: "snapshot" as const,
  confidence: "manual" as const
};

describe("GraphStore integrity", () => {
  it("rejects duplicate nodes", () => {
    const dataset: GraphDataset = {
      version: 1,
      generatedAt: "2026-07-20T20:00:00.000Z",
      nodes: [
        { id: "team:a", type: "team", label: "A", aliases: [], attributes: {} },
        { id: "team:a", type: "team", label: "B", aliases: [], attributes: {} }
      ],
      edges: []
    };

    expect(() => new GraphStore(dataset)).toThrow("Duplicate node id");
  });

  it("rejects dangling edges", () => {
    const dataset: GraphDataset = {
      version: 1,
      generatedAt: "2026-07-20T20:00:00.000Z",
      nodes: [
        { id: "team:a", type: "team", label: "A", aliases: [], attributes: {} }
      ],
      edges: [
        {
          id: "edge:bad",
          type: "OWNS",
          from: "team:a",
          to: "package:missing",
          label: "owns",
          attributes: {},
          evidence
        }
      ]
    };

    expect(() => new GraphStore(dataset)).toThrow("Dangling edge");
  });
});

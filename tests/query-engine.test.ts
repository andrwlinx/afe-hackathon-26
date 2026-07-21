import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GraphDatasetSchema, type GraphDataset } from "../src/shared/graph.js";
import { GraphStore } from "../src/server/graph-store.js";
import { QueryEngine } from "../src/server/query-engine.js";

let dataset: GraphDataset;
let engine: QueryEngine;

beforeAll(async () => {
  const raw = await readFile(
    path.resolve(process.cwd(), "data/public/graph.json"),
    "utf8"
  );
  dataset = GraphDatasetSchema.parse(JSON.parse(raw));
  engine = new QueryEngine(new GraphStore(dataset));
});

describe("RampPath query engine", () => {
  it("ranks people connected to a matching resource", () => {
    const result = engine.query("Who knows about AtlasRegionContext?");

    expect(result.intent).toBe("find-experts");
    expect(result.status).toBe("confirmed");
    expect(result.experts?.map((expert) => expert.person.label)).toEqual([
      "Jordan Rivera",
      "Priya Shah"
    ]);
    expect(result.experts?.map((expert) => expert.score)).toEqual([100, 70]);
  });

  it("resolves an owner and primary contact", () => {
    const result = engine.query("Who owns AtlasRegionContext?");

    expect(result.status).toBe("confirmed");
    expect(result.headline).toContain("Atlas Experience");
    expect(result.summary).toContain("Jordan Rivera");
    expect(result.path.edges.every((edge) => edge.status === "verified")).toBe(
      true
    );
  });

  it("reports missing production access without claiming a denial", () => {
    const result = engine.query("Can I edit supported locations in prod?");

    expect(result.status).toBe("action-needed");
    expect(result.headline).toContain("AtlasProdOperator");
    expect(result.summary).toContain("not an authorization denial");
    expect(result.path.edges.some((edge) => edge.status === "missing")).toBe(true);
    expect(result.nextAction).toContain("Priya Shah");
  });

  it("confirms an existing alpha read path", () => {
    const result = engine.query("Can I read supported locations in alpha?");

    expect(result.status).toBe("confirmed");
    expect(result.headline).toContain("confirmed read access");
    expect(result.path.edges.every((edge) => edge.status === "verified")).toBe(
      true
    );
  });

  it("drafts a request to the verified approver", () => {
    const result = engine.query(
      "What access should I request to edit supported locations in prod?"
    );

    expect(result.intent).toBe("plan-access");
    expect(result.draftRequest).toContain("Priya Shah");
    expect(result.draftRequest).toContain("AtlasProdOperator");
  });

  it("traces a package through both deployment stages", () => {
    const result = engine.query("Where does AtlasRegionContext deploy?");

    expect(result.status).toBe("confirmed");
    expect(result.summary).toContain("Alpha");
    expect(result.summary).toContain("Prod");
    expect(result.path.nodes.some((node) => node.type === "pipeline")).toBe(true);
  });

  it("returns unknown instead of inventing unsupported ownership", () => {
    const result = engine.query("Who owns ImaginaryCheckout?");

    expect(result.status).toBe("unknown");
    expect(result.evidence).toEqual([]);
  });
});

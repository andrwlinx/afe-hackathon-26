import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ExpertiseConnector,
  loadConfiguredGraph
} from "../src/server/connectors.js";
import { ExpertiseSearch } from "../src/server/expertise-search.js";
import { GraphStore } from "../src/server/graph-store.js";

const fixtureDirectory = path.resolve(
  process.cwd(),
  "tests/fixtures/expertise"
);

describe("synthetic expertise ingestion and ranking", () => {
  it("normalizes the three JSON files into graph records", async () => {
    const dataset = await new ExpertiseConnector(fixtureDirectory).load();

    expect(dataset.nodes.some((node) => node.id === "person:morgan-lee")).toBe(
      true
    );
    expect(
      dataset.nodes.some((node) => node.id === "team:payments-platform")
    ).toBe(true);
    expect(
      dataset.edges.some((edge) => edge.type === "CONTRIBUTES_TO")
    ).toBe(true);
  });

  it("ranks ownership, maintenance, and contribution with explainable scores", async () => {
    const dataset = await new ExpertiseConnector(fixtureDirectory).load();
    const search = new ExpertiseSearch(
      new GraphStore(dataset),
      () => new Date("2026-07-21T00:00:00.000Z")
    );

    const experts = search.search(
      "Who knows about payment stream processing?"
    );

    expect(experts.map((expert) => expert.person.label)).toEqual([
      "Morgan Lee",
      "Sam Rivera",
      "Taylor Kim"
    ]);
    expect(experts.map((expert) => expert.score)).toEqual([100, 70, 20]);
    expect(experts[0].reasons[0]).toMatchObject({
      relation: "owns",
      relationshipWeight: 1,
      recencyFactor: 1
    });
  });

  it("automatically loads a complete configured expertise directory", async () => {
    const previous = process.env.EXPERTISE_DATA_DIR;
    process.env.EXPERTISE_DATA_DIR = fixtureDirectory;
    try {
      const loaded = await loadConfiguredGraph();
      expect(loaded.expertiseLoaded).toBe(true);
      expect(
        loaded.dataset.nodes.some((node) => node.id === "person:morgan-lee")
      ).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.EXPERTISE_DATA_DIR;
      else process.env.EXPERTISE_DATA_DIR = previous;
    }
  });
});

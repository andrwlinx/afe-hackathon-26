import { readFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { GraphDatasetSchema } from "../src/shared/graph.js";

let app: ReturnType<typeof createApp>["app"];

beforeAll(async () => {
  const raw = await readFile(
    path.resolve(process.cwd(), "data/public/graph.json"),
    "utf8"
  );
  app = createApp({
    dataset: GraphDatasetSchema.parse(JSON.parse(raw)),
    dataMode: "public"
  }).app;
});

describe("HTTP API", () => {
  it("reports graph health without exposing a file path", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.nodes).toBeGreaterThan(10);
    expect(response.body.filePath).toBeUndefined();
  });

  it("answers a supported query", async () => {
    const response = await request(app)
      .post("/api/query")
      .send({ question: "Where does AtlasRegionContext deploy?" })
      .expect(200);

    expect(response.body.result.status).toBe("confirmed");
  });

  it("rejects malformed questions", async () => {
    await request(app).post("/api/query").send({ question: "x" }).expect(400);
  });
});

import express from "express";
import path from "node:path";
import { z } from "zod";
import type { GraphDataset } from "../shared/graph.js";
import { GraphStore } from "./graph-store.js";
import { QueryEngine } from "./query-engine.js";

const QueryBodySchema = z.object({
  question: z.string().trim().min(3).max(500)
});

export interface AppOptions {
  dataset: GraphDataset;
  dataMode: "public" | "private";
}

export function createApp({ dataset, dataMode }: AppOptions) {
  const app = express();
  const graph = new GraphStore(dataset);
  const engine = new QueryEngine(graph);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      nodes: dataset.nodes.length,
      edges: dataset.edges.length,
      generatedAt: dataset.generatedAt,
      dataMode
    });
  });

  app.get("/api/entities/search", (request, response) => {
    const query = typeof request.query.q === "string" ? request.query.q : "";
    response.json({ entities: graph.search(query) });
  });

  app.get("/api/graph", (_request, response) => {
    response.json(dataset);
  });

  app.post("/api/query", (request, response) => {
    const parsed = QueryBodySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "Question must be between 3 and 500 characters."
      });
      return;
    }

    response.json({
      question: parsed.data.question,
      result: engine.query(parsed.data.question)
    });
  });

  const webRoot = path.resolve(process.cwd(), "dist");
  app.use(express.static(webRoot));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(webRoot, "index.html"));
  });

  return { app, graph, engine };
}

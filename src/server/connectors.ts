import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  GraphDatasetSchema,
  type GraphDataset
} from "../shared/graph.js";

export interface GraphConnector {
  readonly source: string;
  load(): Promise<GraphDataset>;
}

export class SnapshotConnector implements GraphConnector {
  readonly source = "snapshot";

  constructor(private readonly filePath: string) {}

  async load(): Promise<GraphDataset> {
    const raw = await readFile(this.filePath, "utf8");
    return GraphDatasetSchema.parse(JSON.parse(raw));
  }
}

export interface LoadedGraph {
  dataset: GraphDataset;
  filePath: string;
  isPrivate: boolean;
}

export async function loadConfiguredGraph(): Promise<LoadedGraph> {
  const configuredPath = process.env.GRAPH_DATA_FILE;
  const filePath = path.resolve(
    configuredPath ?? path.join(process.cwd(), "data/public/graph.json")
  );
  const connector = new SnapshotConnector(filePath);
  const dataset = await connector.load();

  return {
    dataset,
    filePath,
    isPrivate: filePath.includes(`${path.sep}data${path.sep}private${path.sep}`)
  };
}

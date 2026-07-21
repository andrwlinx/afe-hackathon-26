import { z } from "zod";

export const nodeTypes = [
  "person",
  "team",
  "package",
  "pipeline",
  "stage",
  "account",
  "bindle",
  "role",
  "resource"
] as const;

export const edgeTypes = [
  "OWNS",
  "MEMBER_OF",
  "CONTAINS",
  "DEPLOYS_TO",
  "GOVERNS",
  "REQUIRES_ROLE",
  "CAN_ASSUME",
  "GRANTS",
  "APPROVES",
  "DEPENDS_ON"
] as const;

export const NodeTypeSchema = z.enum(nodeTypes);
export const EdgeTypeSchema = z.enum(edgeTypes);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const EvidenceSchema = z.object({
  source: z.enum(["bindle", "pipelines", "package-metadata", "manual"]),
  sourceRecordId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  observedAt: z.string().datetime(),
  mode: z.enum(["live", "snapshot"]),
  confidence: z.enum(["authoritative", "derived", "manual"])
});

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: NodeTypeSchema,
  label: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().optional(),
  attributes: z.record(z.unknown()).default({})
});

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  type: EdgeTypeSchema,
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1),
  attributes: z.record(z.unknown()).default({}),
  evidence: EvidenceSchema
});

export const GraphDatasetSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema)
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphDataset = z.infer<typeof GraphDatasetSchema>;

export interface PathEdge extends Omit<GraphEdge, "evidence"> {
  status: "verified" | "missing";
  evidence?: Evidence;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: PathEdge[];
}

export interface QueryResult {
  intent: "resolve-owner" | "check-access" | "plan-access" | "trace-deployment";
  status: "confirmed" | "action-needed" | "unknown";
  headline: string;
  summary: string;
  path: GraphPath;
  evidence: Evidence[];
  nextAction?: string;
  draftRequest?: string;
  alternatives?: string[];
}

export interface QueryResponse {
  question: string;
  result: QueryResult;
}

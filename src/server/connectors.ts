import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  GraphDatasetSchema,
  type GraphEdge,
  type GraphDataset
} from "../shared/graph.js";
import {
  ExpertisePeopleFileSchema,
  ExpertiseRelationshipsFileSchema,
  ExpertiseResourcesFileSchema,
  type ExpertiseDataset
} from "../shared/expertise.js";

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

function teamId(label: string): string {
  return `team:${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function latestObservedAt(dataset: ExpertiseDataset): string {
  return dataset.relationships
    .map((relationship) => relationship.observedAt)
    .sort()
    .at(-1)!;
}

export class ExpertiseConnector implements GraphConnector {
  readonly source = "expertise-json";

  constructor(private readonly directory: string) {}

  async loadExpertise(): Promise<ExpertiseDataset> {
    const [peopleRaw, resourcesRaw, relationshipsRaw] = await Promise.all([
      readFile(path.join(this.directory, "people.json"), "utf8"),
      readFile(path.join(this.directory, "resources.json"), "utf8"),
      readFile(path.join(this.directory, "relationships.json"), "utf8")
    ]);

    const dataset = {
      people: ExpertisePeopleFileSchema.parse(JSON.parse(peopleRaw)),
      resources: ExpertiseResourcesFileSchema.parse(JSON.parse(resourcesRaw)),
      relationships: ExpertiseRelationshipsFileSchema.parse(
        JSON.parse(relationshipsRaw)
      )
    };
    const people = new Set(dataset.people.map((person) => person.id));
    const resources = new Set(
      dataset.resources.map((resource) => resource.id)
    );

    for (const relationship of dataset.relationships) {
      if (!people.has(relationship.personId)) {
        throw new Error(
          `${relationship.id} references missing person ${relationship.personId}`
        );
      }
      if (!resources.has(relationship.resourceId)) {
        throw new Error(
          `${relationship.id} references missing resource ${relationship.resourceId}`
        );
      }
    }

    return dataset;
  }

  async load(): Promise<GraphDataset> {
    const dataset = await this.loadExpertise();
    const observedAt = latestObservedAt(dataset);
    const teams = new Map(
      dataset.people.map((person) => [
        teamId(person.team),
        {
          id: teamId(person.team),
          type: "team" as const,
          label: person.team,
          aliases: [],
          description: `Team for synthetic expertise records`,
          attributes: {}
        }
      ])
    );
    const membershipEdges: GraphEdge[] = dataset.people.map((person) => ({
      id: `expertise-member:${person.id.slice("person:".length)}`,
      type: "MEMBER_OF",
      from: person.id,
      to: teamId(person.team),
      label: "member of",
      attributes: { role: person.role },
      evidence: {
        source: "manual",
        sourceRecordId: person.id,
        observedAt,
        mode: "snapshot",
        confidence: "manual"
      }
    }));
    const relationshipType = {
      owns: "OWNS",
      maintains: "MAINTAINS",
      "contributes-to": "CONTRIBUTES_TO"
    } as const;

    return GraphDatasetSchema.parse({
      version: 1,
      generatedAt: observedAt,
      nodes: [
        ...dataset.people.map((person) => ({
          id: person.id,
          type: "person" as const,
          label: person.name,
          aliases: [person.alias, ...person.aliases],
          description: `${person.role} on ${person.team}`,
          attributes: {
            alias: person.alias,
            team: person.team,
            role: person.role,
            ...(person.profileUrl ? { profileUrl: person.profileUrl } : {})
          }
        })),
        ...teams.values(),
        ...dataset.resources.map((resource) => ({
          id: resource.id,
          type: resource.type === "service" ? ("resource" as const) : resource.type,
          label: resource.name,
          aliases: resource.aliases,
          description: resource.description,
          attributes: {
            expertiseType: resource.type,
            tags: resource.tags
          }
        }))
      ],
      edges: [
        ...membershipEdges,
        ...dataset.relationships.map((relationship) => ({
          id: relationship.id,
          type: relationshipType[relationship.relation],
          from: relationship.personId,
          to: relationship.resourceId,
          label: relationship.relation.replace("-", " "),
          attributes: {
            relationship: relationship.relation,
            lastActive: relationship.lastActive
          },
          evidence: {
            source: "manual" as const,
            sourceRecordId: relationship.id,
            observedAt: relationship.observedAt,
            mode: "snapshot" as const,
            confidence: "manual" as const
          }
        }))
      ]
    });
  }
}

export function mergeGraphDatasets(
  base: GraphDataset,
  extension: GraphDataset
): GraphDataset {
  const nodes = new Map(base.nodes.map((node) => [node.id, node]));
  for (const node of extension.nodes) {
    const existing = nodes.get(node.id);
    if (existing && (existing.type !== node.type || existing.label !== node.label)) {
      throw new Error(
        `Expertise node ${node.id} conflicts with existing ${existing.type} ${existing.label}`
      );
    }
    nodes.set(
      node.id,
      existing
        ? {
            ...existing,
            aliases: [...new Set([...existing.aliases, ...node.aliases])],
            description: node.description ?? existing.description,
            attributes: { ...existing.attributes, ...node.attributes }
          }
        : node
    );
  }

  const edges = new Map(base.edges.map((edge) => [edge.id, edge]));
  for (const edge of extension.edges) {
    if (edges.has(edge.id)) {
      throw new Error(`Duplicate expertise edge id: ${edge.id}`);
    }
    edges.set(edge.id, edge);
  }

  return GraphDatasetSchema.parse({
    version: 1,
    generatedAt:
      base.generatedAt > extension.generatedAt
        ? base.generatedAt
        : extension.generatedAt,
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  });
}

async function expertiseFilesState(directory: string): Promise<boolean[]> {
  return Promise.all(
    ["people.json", "resources.json", "relationships.json"].map(async (file) => {
      try {
        await access(path.join(directory, file));
        return true;
      } catch {
        return false;
      }
    })
  );
}

export interface LoadedGraph {
  dataset: GraphDataset;
  filePath: string;
  isPrivate: boolean;
  expertiseLoaded: boolean;
}

export async function loadConfiguredGraph(): Promise<LoadedGraph> {
  const configuredPath = process.env.GRAPH_DATA_FILE;
  const filePath = path.resolve(
    configuredPath ?? path.join(process.cwd(), "data/public/graph.json")
  );
  const connector = new SnapshotConnector(filePath);
  let dataset = await connector.load();
  const expertiseDirectory = path.resolve(
    process.env.EXPERTISE_DATA_DIR ??
      path.join(process.cwd(), "data/public/expertise")
  );
  const expertiseState = await expertiseFilesState(expertiseDirectory);
  const expertiseLoaded = expertiseState.every(Boolean);

  if (expertiseState.some(Boolean) && !expertiseLoaded) {
    throw new Error(
      `Expertise data is incomplete in ${expertiseDirectory}; people.json, resources.json, and relationships.json are all required`
    );
  }
  if (expertiseLoaded) {
    dataset = mergeGraphDatasets(
      dataset,
      await new ExpertiseConnector(expertiseDirectory).load()
    );
  }

  return {
    dataset,
    filePath,
    isPrivate:
      filePath.includes(`${path.sep}data${path.sep}private${path.sep}`) ||
      expertiseDirectory.includes(
        `${path.sep}data${path.sep}private${path.sep}`
      ),
    expertiseLoaded
  };
}

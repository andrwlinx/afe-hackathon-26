import Fuse from "fuse.js";
import type {
  ExpertMatch,
  ExpertReason,
  GraphEdge,
  GraphNode
} from "../shared/graph.js";
import { GraphStore } from "./graph-store.js";

interface ResourceDocument {
  node: GraphNode;
  name: string;
  description: string;
  tags: string[];
}

interface CandidateReason extends ExpertReason {
  rawContribution: number;
}

const directRelations = {
  OWNS: { relation: "owns", weight: 1 },
  MAINTAINS: { relation: "maintains", weight: 0.7 },
  CONTRIBUTES_TO: { relation: "contributes-to", weight: 0.4 }
} as const;

function numericRound(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function extractExpertTopic(question: string): string {
  return question
    .toLowerCase()
    .replace(
      /\b(who|should|i|ask|knows?|about|can|help|me|with|is|an|expert|experts|on|the)\b/g,
      " "
    )
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relationshipWeightForTeamMember(edge: GraphEdge): number {
  const role =
    typeof edge.attributes.role === "string"
      ? edge.attributes.role.toLowerCase()
      : "";
  if (role.includes("owner")) return 1;
  if (role.includes("maintain") || role.includes("approver")) return 0.7;
  return 0.4;
}

function lastActive(edge: GraphEdge): string {
  return typeof edge.attributes.lastActive === "string"
    ? edge.attributes.lastActive
    : edge.evidence.observedAt.slice(0, 10);
}

function recencyFactor(value: string, now: Date): number {
  const ageMs = Math.max(0, now.getTime() - new Date(`${value}T00:00:00Z`).getTime());
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.8;
  return 0.5;
}

export class ExpertiseSearch {
  private readonly fuse: Fuse<ResourceDocument>;

  constructor(
    private readonly graph: GraphStore,
    private readonly now: () => Date = () => new Date()
  ) {
    const documents = graph
      .nodes(["package", "pipeline", "bindle", "resource"])
      .map((node) => ({
        node,
        name: node.label,
        description: node.description ?? "",
        tags: Array.isArray(node.attributes.tags)
          ? node.attributes.tags.filter(
              (tag): tag is string => typeof tag === "string"
            )
          : []
      }));

    this.fuse = new Fuse(documents, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.55,
      minMatchCharLength: 2,
      keys: [
        { name: "name", weight: 0.5 },
        { name: "description", weight: 0.3 },
        { name: "tags", weight: 0.2 }
      ]
    });
  }

  search(question: string, limit = 5): ExpertMatch[] {
    const topic = extractExpertTopic(question);
    if (!topic) return [];

    const candidates = new Map<
      string,
      { person: GraphNode; reasons: Map<string, CandidateReason> }
    >();

    for (const result of this.fuse.search(topic, { limit: 10 })) {
      const resource = result.item.node;
      const matchStrength = Math.max(0.15, 1 - (result.score ?? 1));

      for (const edge of this.graph.edgesTo(resource.id)) {
        const direct = directRelations[
          edge.type as keyof typeof directRelations
        ];
        const from = this.graph.getNode(edge.from);

        if (direct && from?.type === "person") {
          this.addReason(candidates, from, resource, {
            relation: direct.relation,
            relationshipWeight: direct.weight,
            matchStrength,
            edgeIds: [edge.id],
            activityEdge: edge
          });
          continue;
        }

        if (edge.type === "OWNS" && from?.type === "team") {
          for (const memberEdge of this.graph.edgesTo(from.id, "MEMBER_OF")) {
            const person = this.graph.getNode(memberEdge.from);
            if (person?.type !== "person") continue;
            this.addReason(candidates, person, resource, {
              relation: "team-owner",
              relationshipWeight: relationshipWeightForTeamMember(memberEdge),
              matchStrength,
              edgeIds: [memberEdge.id, edge.id],
              activityEdge: edge
            });
          }
        }
      }
    }

    const ranked = [...candidates.values()]
      .map(({ person, reasons }) => ({
        person,
        reasons: [...reasons.values()].sort(
          (a, b) => b.rawContribution - a.rawContribution
        ),
        rawScore: [...reasons.values()].reduce(
          (sum, reason) => sum + reason.rawContribution,
          0
        )
      }))
      .sort(
        (a, b) =>
          b.rawScore - a.rawScore ||
          a.person.label.localeCompare(b.person.label)
      )
      .slice(0, limit);
    const topScore = ranked[0]?.rawScore ?? 0;

    return ranked.map(({ person, reasons, rawScore }) => ({
      person,
      score: topScore ? Math.round((rawScore / topScore) * 100) : 0,
      reasons: reasons.map(({ rawContribution: _raw, ...reason }) => reason)
    }));
  }

  private addReason(
    candidates: Map<
      string,
      { person: GraphNode; reasons: Map<string, CandidateReason> }
    >,
    person: GraphNode,
    resource: GraphNode,
    input: {
      relation: ExpertReason["relation"];
      relationshipWeight: number;
      matchStrength: number;
      edgeIds: string[];
      activityEdge: GraphEdge;
    }
  ): void {
    const activity = lastActive(input.activityEdge);
    const recency = recencyFactor(activity, this.now());
    const rawContribution =
      input.matchStrength * input.relationshipWeight * recency;
    const candidate = candidates.get(person.id) ?? {
      person,
      reasons: new Map<string, CandidateReason>()
    };
    const reason: CandidateReason = {
      resource,
      relation: input.relation,
      relationshipWeight: input.relationshipWeight,
      matchStrength: numericRound(input.matchStrength),
      recencyFactor: recency,
      contribution: numericRound(rawContribution),
      rawContribution,
      lastActive: activity,
      edgeIds: input.edgeIds
    };
    const existing = candidate.reasons.get(resource.id);
    if (!existing || existing.rawContribution < rawContribution) {
      candidate.reasons.set(resource.id, reason);
    }
    candidates.set(person.id, candidate);
  }
}

import type {
  Evidence,
  GraphEdge,
  GraphNode,
  PathEdge,
  QueryResult
} from "../shared/graph.js";
import {
  ExpertiseSearch,
  extractExpertTopic
} from "./expertise-search.js";
import { GraphStore } from "./graph-store.js";

const entityTypes = [
  "package",
  "resource",
  "pipeline",
  "bindle",
  "account",
  "team"
] as const;

function uniqueNodes(nodes: Array<GraphNode | undefined>): GraphNode[] {
  return [
    ...new Map(
      nodes.filter((node): node is GraphNode => Boolean(node)).map((node) => [node.id, node])
    ).values()
  ];
}

function verified(edge: GraphEdge): PathEdge {
  return { ...edge, status: "verified" };
}

function missingEdge(
  from: string,
  to: string,
  type: PathEdge["type"],
  label: string
): PathEdge {
  return {
    id: `missing:${from}:${type}:${to}`,
    from,
    to,
    type,
    label,
    attributes: {},
    status: "missing"
  };
}

function uniqueEvidence(edges: PathEdge[]): Evidence[] {
  return [
    ...new Map(
      edges
        .filter((edge) => edge.evidence)
        .map((edge) => [
          `${edge.evidence!.source}:${edge.evidence!.sourceRecordId ?? edge.id}`,
          edge.evidence!
        ])
    ).values()
  ];
}

function actions(edge: GraphEdge): string[] {
  return Array.isArray(edge.attributes.actions)
    ? edge.attributes.actions.filter((value): value is string => typeof value === "string")
    : [];
}

function isExpired(edge: GraphEdge): boolean {
  const value = edge.attributes.expiresAt;
  return typeof value === "string" && new Date(value).getTime() <= Date.now();
}

export class QueryEngine {
  private readonly expertise: ExpertiseSearch;

  constructor(private readonly graph: GraphStore) {
    this.expertise = new ExpertiseSearch(graph);
  }

  query(question: string): QueryResult {
    const normalized = question.toLowerCase();

    if (
      /\bwho (knows|should i ask|can help)\b|\bexperts?\b/.test(normalized)
    ) {
      return this.findExperts(question);
    }
    if (/\b(where|what)\b.*\bdeploy|\bdeploy(ed|s|ment)?\b/.test(normalized)) {
      return this.traceDeployment(question);
    }
    if (/\bwho\b.*\bown|\bowner(ship)?\b|\bresponsible\b/.test(normalized)) {
      return this.resolveOwner(question);
    }
    if (
      /\brequest\b|\bfastest path\b|\bwhat (access|permission|role)\b|\bneed (access|permission)\b/.test(
        normalized
      )
    ) {
      return this.planAccess(question);
    }
    if (/\bcan i\b|\bdo i have\b|\baccess\b|\bedit\b|\bread\b|\bview\b/.test(normalized)) {
      return this.checkAccess(question);
    }

    return {
      intent: "resolve-owner",
      status: "unknown",
      headline: "I could not map that question to a supported path",
      summary:
        "Try asking about ownership, access, the access request path, or a package's deployment destinations.",
      path: { nodes: [], edges: [] },
      evidence: [],
      alternatives: [
        "Who knows about AtlasRegionContext?",
        "Who owns AtlasRegionContext?",
        "Can I edit supported locations in prod?",
        "What access should I request for supported locations?",
        "Where does AtlasRegionContext deploy?"
      ]
    };
  }

  findExperts(question: string): QueryResult {
    const experts = this.expertise.search(question);
    const topic = extractExpertTopic(question);
    if (!experts.length) {
      return this.notFound(
        "find-experts",
        "No expertise paths matched that topic"
      );
    }

    const pathEdgeIds = new Set(
      experts.flatMap((expert) =>
        expert.reasons.flatMap((reason) => reason.edgeIds)
      )
    );
    const pathEdges = [...pathEdgeIds]
      .map((id) => this.graph.getEdge(id))
      .filter((edge): edge is GraphEdge => Boolean(edge))
      .map(verified);
    const pathNodes = uniqueNodes([
      ...experts.map((expert) => expert.person),
      ...experts.flatMap((expert) =>
        expert.reasons.map((reason) => reason.resource)
      ),
      ...pathEdges.flatMap((edge) => [
        this.graph.getNode(edge.from),
        this.graph.getNode(edge.to)
      ])
    ]);
    const resourceCount = new Set(
      experts.flatMap((expert) =>
        expert.reasons.map((reason) => reason.resource.id)
      )
    ).size;
    const top = experts[0];

    return {
      intent: "find-experts",
      status: "confirmed",
      headline: `${top.person.label} is the strongest match`,
      summary: `${experts.length} people matched through ${resourceCount} connected resource${resourceCount === 1 ? "" : "s"}. Scores combine keyword relevance, relationship strength, and recent activity.`,
      path: {
        nodes: pathNodes,
        edges: pathEdges
      },
      evidence: uniqueEvidence(pathEdges),
      experts,
      nextAction: `Start with ${top.person.label}; review the score breakdown before reaching out.`
    };
  }

  resolveOwner(question: string): QueryResult {
    const target = this.graph.findBestMention(question, [...entityTypes]);
    if (!target) {
      return this.notFound(
        "resolve-owner",
        "I could not identify the package, service, or resource"
      );
    }

    const ownership = this.graph.edgesTo(target.id, "OWNS")[0];
    const owner = ownership ? this.graph.getNode(ownership.from) : undefined;
    if (!ownership || !owner) {
      return this.notFound(
        "resolve-owner",
        `Ownership is not confirmed for ${target.label}`,
        target
      );
    }

    const members =
      owner.type === "team"
        ? this.graph
            .edgesTo(owner.id, "MEMBER_OF")
            .map((edge) => ({ edge, person: this.graph.getNode(edge.from) }))
            .filter(({ person }) => person?.type === "person")
        : [];
    const contact = members.find(
      ({ edge }) => edge.attributes.role === "service owner"
    ) ?? members[0];
    const pathEdges = [
      ...(contact ? [verified(contact.edge)] : []),
      verified(ownership)
    ];

    return {
      intent: "resolve-owner",
      status: "confirmed",
      headline: `${target.label} is owned by ${owner.label}`,
      summary: contact?.person
        ? `${contact.person.label} is the primary service contact. The ownership record was observed through ${ownership.evidence.source}.`
        : `The ownership record was observed through ${ownership.evidence.source}.`,
      path: {
        nodes: uniqueNodes([contact?.person, owner, target]),
        edges: pathEdges
      },
      evidence: uniqueEvidence(pathEdges),
      nextAction: contact?.person
        ? `Contact ${contact.person.label} with the package name and the task you are trying to complete.`
        : `Contact ${owner.label}.`
    };
  }

  checkAccess(question: string): QueryResult {
    return this.accessResult(question, false);
  }

  planAccess(question: string): QueryResult {
    return this.accessResult(question, true);
  }

  traceDeployment(question: string): QueryResult {
    const target = this.graph.findBestMention(question, ["package", "pipeline"]);
    if (!target) {
      return this.notFound(
        "trace-deployment",
        "I could not identify the package or pipeline"
      );
    }

    const pipeline =
      target.type === "pipeline"
        ? target
        : this.graph
            .edgesTo(target.id, "CONTAINS")
            .map((edge) => this.graph.getNode(edge.from))
            .find((node) => node?.type === "pipeline");
    if (!pipeline) {
      return this.notFound(
        "trace-deployment",
        `No pipeline is connected to ${target.label}`,
        target
      );
    }

    const packageEdge =
      target.type === "package"
        ? this.graph
            .edgesFrom(pipeline.id, "CONTAINS")
            .find((edge) => edge.to === target.id)
        : undefined;
    const stageEdges = this.graph.edgesFrom(pipeline.id, "DEPLOYS_TO");
    const stageTargets = stageEdges.flatMap((stageEdge) => {
      const stage = this.graph.getNode(stageEdge.to);
      const accountEdges = stage
        ? this.graph.edgesFrom(stage.id, "DEPLOYS_TO")
        : [];
      return accountEdges.map((accountEdge) => ({
        stage,
        stageEdge,
        accountEdge,
        account: this.graph.getNode(accountEdge.to)
      }));
    });

    if (!stageTargets.length) {
      return this.notFound(
        "trace-deployment",
        `No deployment targets are confirmed for ${pipeline.label}`,
        pipeline
      );
    }

    const pathEdges = [
      ...(packageEdge ? [verified(packageEdge)] : []),
      ...stageTargets.flatMap(({ stageEdge, accountEdge }) => [
        verified(stageEdge),
        verified(accountEdge)
      ])
    ];
    const destinations = stageTargets
      .map(({ stage, account }) => `${stage?.label ?? "Unknown stage"} → ${account?.label ?? "Unknown account"}`)
      .join("; ");

    return {
      intent: "trace-deployment",
      status: "confirmed",
      headline: `${pipeline.label} has ${stageTargets.length} confirmed deployment targets`,
      summary: destinations,
      path: {
        nodes: uniqueNodes([
          target,
          pipeline,
          ...stageTargets.flatMap(({ stage, account }) => [stage, account])
        ]),
        edges: pathEdges
      },
      evidence: uniqueEvidence(pathEdges),
      nextAction: "Select a stage in the path to identify its target account."
    };
  }

  private accessResult(question: string, includeDraft: boolean): QueryResult {
    const actor =
      this.graph.findBestMention(question, ["person"]) ?? this.graph.currentActor();
    const environment = /\b(alpha|beta|gamma|prod|production)\b/i.exec(question)?.[1]
      .toLowerCase()
      .replace("production", "prod");
    const mentioned = this.graph.findBestMention(question, ["resource"]);
    const resource =
      (mentioned &&
      (!environment || mentioned.attributes.environment === environment)
        ? mentioned
        : this.graph
            .nodes(["resource"])
            .find(
              (node) =>
                (!environment || node.attributes.environment === environment) &&
                question.toLowerCase().includes("supported")
            )) ?? mentioned;
    const action = /\b(edit|update|write|modify)\b/i.test(question)
      ? "write"
      : "read";

    if (!actor || !resource) {
      return this.notFound(
        includeDraft ? "plan-access" : "check-access",
        "I could not identify both the person and resource"
      );
    }

    const requirement = this.graph
      .edgesFrom(resource.id, "REQUIRES_ROLE")
      .find((edge) => actions(edge).includes(action));
    const role = requirement ? this.graph.getNode(requirement.to) : undefined;
    const grant =
      role &&
      this.graph
        .edgesFrom(role.id, "GRANTS")
        .find((edge) => edge.to === resource.id && actions(edge).includes(action));

    if (!requirement || !role || !grant) {
      return this.notFound(
        includeDraft ? "plan-access" : "check-access",
        `The graph does not contain a verified ${action} policy for ${resource.label}`,
        resource
      );
    }

    const assume = this.graph
      .edgesFrom(actor.id, "CAN_ASSUME")
      .find((edge) => edge.to === role.id && !isExpired(edge));
    const accountRelation = this.graph.edgesTo(resource.id, "CONTAINS")[0];
    const account = accountRelation
      ? this.graph.getNode(accountRelation.from)
      : undefined;
    const governance =
      account &&
      this.graph
        .edgesTo(account.id, "GOVERNS")
        .find((edge) => this.graph.getNode(edge.from)?.type === "bindle");
    const bindle = governance ? this.graph.getNode(governance.from) : undefined;
    const approval =
      bindle && this.graph.edgesTo(bindle.id, "APPROVES")[0];
    const approver = approval ? this.graph.getNode(approval.from) : undefined;

    const pathEdges: PathEdge[] = [
      assume
        ? verified(assume)
        : missingEdge(actor.id, role.id, "CAN_ASSUME", "missing role access"),
      verified(grant),
      ...(accountRelation ? [verified(accountRelation)] : []),
      ...(governance ? [verified(governance)] : []),
      ...(approval ? [verified(approval)] : [])
    ];
    const hasAccess = Boolean(assume);
    const status = hasAccess ? "confirmed" : "action-needed";
    const approverName = approver?.label ?? bindle?.label ?? "the resource owner";
    const draft = hasAccess
      ? undefined
      : `Hi ${approverName}, I am working on ${resource.label} and need ${action} access. Could you grant me access to ${role.label}? The graph shows that this role grants the required permission.`;

    return {
      intent: includeDraft ? "plan-access" : "check-access",
      status,
      headline: hasAccess
        ? `${actor.label} has confirmed ${action} access`
        : `${actor.label} is missing ${role.label}`,
      summary: hasAccess
        ? `${actor.label} can assume ${role.label}, which grants ${action} access to ${resource.label}.`
        : `${role.label} grants the required ${action} permission, but no current role-assumption edge was found. This is an unconfirmed path, not an authorization denial.`,
      path: {
        nodes: uniqueNodes([actor, role, resource, account, bindle, approver]),
        edges: pathEdges
      },
      evidence: uniqueEvidence(pathEdges),
      nextAction: hasAccess
        ? `Assume ${role.label} before working with ${resource.label}.`
        : `Ask ${approverName} for ${role.label}.`,
      draftRequest: includeDraft || !hasAccess ? draft : undefined
    };
  }

  private notFound(
    intent: QueryResult["intent"],
    headline: string,
    node?: GraphNode
  ): QueryResult {
    return {
      intent,
      status: "unknown",
      headline,
      summary:
        "RampPath only makes claims backed by loaded graph records. Try a more specific entity name or inspect the available examples.",
      path: { nodes: node ? [node] : [], edges: [] },
      evidence: [],
      alternatives: [
        "Who knows about AtlasRegionContext?",
        "Who owns AtlasRegionContext?",
        "Can I edit supported locations in prod?",
        "What access should I request for supported locations?",
        "Where does AtlasRegionContext deploy?"
      ]
    };
  }
}

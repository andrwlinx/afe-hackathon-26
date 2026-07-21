#!/usr/bin/env node
/**
 * Deterministic synthetic expertise data generator for Path.
 *
 * Models a single fictional org — "Atlas" (fictional AWS-style region services org) —
 * with ~13 teams of 7-8 people each (~100 people total). Teams own a varied
 * mix of resources (services, models, Lambdas, CLIs, pipelines, bindles,
 * AWS accounts, at most one CDK package per team), and org-wide platform
 * packages are maintained across team boundaries so the graph is
 * genuinely intertwined.
 *
 * Produces the three-file contract described in data/public/expertise/README.md:
 *   people.json, resources.json, relationships.json
 *
 * All names, aliases, teams, and URLs are fictional. Regenerate with:
 *   node scripts/generate-expertise.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// --- Deterministic PRNG (mulberry32) so output is stable across runs ---
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260721);
const pick = (list) => list[Math.floor(random() * list.length)];
const pickN = (list, n) => {
  const copy = [...list];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
};

const FIRST_NAMES = [
  "Maya", "Liam", "Sofia", "Noah", "Ana", "Ethan", "Zara", "Lucas", "Nina",
  "Omar", "Ivy", "Kai", "Lena", "Marco", "Tara", "Dev", "Rosa", "Felix",
  "Ayo", "Mei", "Jonas", "Leila", "Owen", "Sana", "Hugo", "Aisha", "Cole",
  "Dina", "Ravi", "Elsa", "Theo", "Yuki", "Nadia", "Sam", "Chloe", "Diego",
  "Fatima", "Ben", "Amara", "Niko", "Wren", "Aldo", "Petra", "Idris", "Vera",
  "Cato", "Suki", "Bruno", "Alma", "Ezra"
];
const LAST_NAMES = [
  "Okafor", "Lindqvist", "Marino", "Takeda", "Alvarez", "Novak", "Osei",
  "Fontaine", "Iyer", "Kowalski", "Mbeki", "Sorensen", "Delgado", "Haddad",
  "Petrov", "Nakamura", "Oduya", "Silva", "Brandt", "Castillo", "Egede",
  "Varga", "Moreau", "Tanaka", "Abara", "Holm", "Reyes", "Duval", "Kimura",
  "Sokolov", "Mensah", "Larsen", "Vidal", "Rahim", "Steiner", "Camara",
  "Bishop", "Antar", "Vance", "Kerr"
];

/**
 * Atlas org teams (fictional AWS-style region services org — the same org
 * that owns AtlasRegionContext in the base demo graph). Each team lists the
 * components it builds; the generator turns components into a varied mix of
 * resource types. Component words deliberately avoid "region"/"context" so
 * the scripted AtlasRegionContext demo queries stay unambiguous.
 */
const TEAMS = [
  {
    name: "Atlas Compute",
    slug: "compute",
    prefix: "AtlasCompute",
    tags: ["compute", "ec2", "instances"],
    components: ["instance-scaler", "placement-engine", "host-manager"]
  },
  {
    name: "Atlas Identity",
    slug: "identity",
    prefix: "AtlasIdentity",
    tags: ["identity", "iam", "auth"],
    components: ["policy-evaluator", "credential-vendor", "signin-gateway"]
  },
  {
    name: "Atlas Networking",
    slug: "networking",
    prefix: "AtlasNetwork",
    tags: ["networking", "vpc", "routing"],
    components: ["vpc-builder", "subnet-manager", "peering-broker"]
  },
  {
    name: "Atlas Storage",
    slug: "storage",
    prefix: "AtlasStorage",
    tags: ["storage", "s3", "objects"],
    components: ["bucket-index", "replication-engine", "lifecycle-manager"]
  },
  {
    name: "Atlas Observability",
    slug: "observability",
    prefix: "AtlasWatch",
    tags: ["observability", "metrics", "alarms"],
    components: ["metrics-ingest", "alarm-engine", "trace-collector"]
  },
  {
    name: "Atlas Deployment",
    slug: "deployment",
    prefix: "AtlasDeploy",
    tags: ["deployment", "pipelines", "release"],
    components: ["orchestrator", "rollback-engine", "canary-runner"]
  },
  {
    name: "Atlas Billing",
    slug: "billing",
    prefix: "AtlasBilling",
    tags: ["billing", "usage", "cost"],
    components: ["usage-metering", "invoice-builder", "cost-analyzer"]
  },
  {
    name: "Atlas Console",
    slug: "console",
    prefix: "AtlasConsole",
    tags: ["console", "frontend", "ui"],
    components: ["dashboard", "resource-browser", "signin-ui"]
  },
  {
    name: "Atlas Data Services",
    slug: "data",
    prefix: "AtlasData",
    tags: ["data", "query", "streams"],
    components: ["query-engine", "table-catalog", "stream-processor"]
  },
  {
    name: "Atlas Edge",
    slug: "edge",
    prefix: "AtlasEdge",
    tags: ["edge", "cdn", "dns"],
    components: ["cache-fleet", "dns-resolver", "cert-manager"]
  },
  {
    name: "Atlas Capacity",
    slug: "capacity",
    prefix: "AtlasCapacity",
    tags: ["capacity", "quotas", "forecasting"],
    components: ["demand-forecaster", "quota-service", "fleet-planner"]
  },
  {
    name: "Atlas DevEx & Onboarding",
    slug: "devex",
    prefix: "AtlasDevEx",
    tags: ["devtools", "onboarding", "build"],
    components: ["build-tools", "ramp-tracker", "wiki-sync"]
  }
];

/** Org-wide platform packages, maintained across team boundaries. */
const PLATFORM_RESOURCES = [
  { name: "AtlasCommonAuth", ownerSlug: "identity", tags: ["auth", "platform", "shared"], description: "Shared authentication and Midway integration library used by every Atlas service." },
  { name: "AtlasMetricsSDK", ownerSlug: "observability", tags: ["metrics", "sdk", "shared"], description: "Standard metrics emission library for Atlas services." },
  { name: "AtlasBuildCLI", ownerSlug: "devex", tags: ["build", "cli", "devtools"], description: "Command line tooling that wraps Brazil workflows for Atlas packages." },
  { name: "AtlasDataLakeClient", ownerSlug: "data", tags: ["data", "client", "shared"], description: "Access layer for the Atlas data lake with schema validation." },
  { name: "AtlasOnCallDashboard", ownerSlug: "deployment", tags: ["oncall", "dashboard", "operations"], description: "Org-wide on-call and deployment health dashboard." },
  { name: "AtlasCostExplorerSDK", ownerSlug: "billing", tags: ["cost", "sdk", "shared"], description: "Client library for querying usage and cost data across Atlas accounts." }
];

const ROLE_POOL = [
  { role: "SDE I", weight: 3 },
  { role: "SDE II", weight: 4 },
  { role: "SDE III", weight: 2 },
  { role: "Senior SDE", weight: 1.5 },
  { role: "TPM", weight: 0.8 },
  { role: "SDE Intern", weight: 1.2 }
];
function weightedRole() {
  const total = ROLE_POOL.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of ROLE_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry.role;
  }
  return "SDE II";
}

// --- People ---
const usedAliases = new Set(["avery", "jordan", "priya"]);
const usedNames = new Set();
let nameCursor = 0;
const namePairs = [];
for (const first of FIRST_NAMES) {
  for (const last of LAST_NAMES) {
    namePairs.push([first, last]);
  }
}
for (let i = namePairs.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [namePairs[i], namePairs[j]] = [namePairs[j], namePairs[i]];
}

function nextPerson(team, role) {
  while (nameCursor < namePairs.length) {
    const [first, last] = namePairs[nameCursor++];
    const name = `${first} ${last}`;
    const alias = `${first[0]}${last}`.toLowerCase().replace(/[^a-z]/g, "");
    if (usedNames.has(name) || usedAliases.has(alias)) continue;
    usedNames.add(name);
    usedAliases.add(alias);
    return {
      id: `person:${first.toLowerCase()}-${last.toLowerCase()}`.replace(
        /[^a-z0-9:-]/g,
        ""
      ),
      name,
      alias,
      team: team.name,
      role,
      aliases: [`${first.toLowerCase()}.${last.toLowerCase()}`],
      profileUrl: `https://phonetool.example.com/users/${alias}`
    };
  }
  throw new Error("Ran out of unique names");
}

const people = [];
const teamRosters = new Map();
for (const team of TEAMS) {
  const size = 7 + Math.floor(random() * 2); // 7-8 people per team
  const roster = [];
  roster.push(nextPerson(team, "SDM"));
  roster.push(nextPerson(team, "Senior SDE"));
  for (let index = 2; index < size; index += 1) {
    roster.push(nextPerson(team, weightedRole()));
  }
  teamRosters.set(team.slug, roster);
  people.push(...roster);
}

// --- Resources ---
function titleCase(slugText) {
  return slugText
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

const resources = [];
const teamResources = new Map();
// Package name suffix variety; one CDK max per team, and only for some teams.
const PACKAGE_SUFFIXES = ["Service", "Model", "Lambda", "CLI", "Daemon"];

for (const [teamIndex, team] of TEAMS.entries()) {
  const list = [];
  const shortTags = team.tags;

  for (const [componentIndex, component] of team.components.entries()) {
    const componentName = titleCase(component);
    const suffix = PACKAGE_SUFFIXES[(teamIndex + componentIndex) % PACKAGE_SUFFIXES.length];
    // Main package for the component
    list.push({
      id: `package:${team.slug}-${component}`,
      type: "package",
      name: `${team.prefix}${componentName}${suffix === "Service" ? "" : suffix}`,
      description: `${component.replace(/-/g, " ")} ${suffix.toLowerCase() === "service" ? "service" : suffix} for ${team.name} (Atlas org).`,
      tags: [...shortTags, component.replace(/-/g, " ")],
      aliases: [`${team.slug}-${component}`]
    });
    // Every component ships through a pipeline for the first two components
    if (componentIndex < 2) {
      list.push({
        id: `pipeline:${team.slug}-${component}`,
        type: "pipeline",
        name: `${team.prefix}${componentName}Pipeline`,
        description: `Deployment pipeline for ${team.prefix}${componentName} (${team.name}).`,
        tags: [...shortTags, component.replace(/-/g, " "), "pipeline"],
        aliases: [`${team.slug}-${component}-pipeline`]
      });
    }
  }

  // One internal service endpoint
  list.push({
    id: `service:${team.slug}-gateway`,
    type: "service",
    name: `${team.prefix}Gateway`,
    description: `Internal API gateway operated by ${team.name}.`,
    tags: [...shortTags, "gateway", "api"],
    aliases: [`${team.slug}-gateway`]
  });

  // Team bindle
  list.push({
    id: `bindle:${team.slug}`,
    type: "bindle",
    name: `${team.prefix}Bindle`,
    description: `Ownership bindle for ${team.name} packages, pipelines, and accounts.`,
    tags: [...shortTags, "bindle", "ownership"],
    aliases: [`${team.slug}-bindle`]
  });

  // AWS accounts (prod + beta)
  for (const stage of ["prod", "beta"]) {
    list.push({
      id: `account:${team.slug}-${stage}`,
      type: "account",
      name: `atlas-${team.slug}-${stage}`,
      description: `${stage === "prod" ? "Production" : "Beta"} AWS account for ${team.name}.`,
      tags: [...shortTags, "aws account", stage],
      aliases: [`${team.slug} ${stage} account`]
    });
  }

  // Roughly every other team maintains a CDK infrastructure package (max one)
  if (teamIndex % 2 === 0) {
    list.push({
      id: `package:${team.slug}-cdk`,
      type: "package",
      name: `${team.prefix}CDK`,
      description: `CDK infrastructure definitions for ${team.name} deployments.`,
      tags: [...shortTags, "cdk", "infrastructure"],
      aliases: [`${team.slug}-cdk`]
    });
  }

  teamResources.set(team.slug, list);
  resources.push(...list);
}

// Org-wide platform packages
for (const platform of PLATFORM_RESOURCES) {
  resources.push({
    id: `package:${platform.name.toLowerCase()}`,
    type: "package",
    name: platform.name,
    description: platform.description,
    tags: platform.tags,
    aliases: [platform.name.toLowerCase()]
  });
}

// --- Relationships ---
const relationships = [];
let relationshipCounter = 0;
const relatedPeople = new Set();
function isoDateDaysAgo(days) {
  const date = new Date(Date.UTC(2026, 6, 21) - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}
function addRelationship(person, resource, relation, maxAgeDays) {
  const activeDays = Math.floor(random() * maxAgeDays);
  relationshipCounter += 1;
  relatedPeople.add(person.id);
  relationships.push({
    id: `relationship:r${String(relationshipCounter).padStart(4, "0")}`,
    personId: person.id,
    resourceId: resource.id,
    relation,
    lastActive: isoDateDaysAgo(activeDays),
    observedAt: `${isoDateDaysAgo(Math.min(activeDays, 3))}T12:00:00Z`
  });
}

const allPeople = people;
for (const team of TEAMS) {
  const roster = teamRosters.get(team.slug);
  for (const resource of teamResources.get(team.slug)) {
    const [owner, ...rest] = pickN(roster, 3 + Math.floor(random() * 3)); // owner + 2-4 teammates
    addRelationship(owner, resource, "owns", 45);
    const maintainerCount = Math.min(rest.length, 1 + Math.floor(random() * 2));
    rest.slice(0, maintainerCount).forEach((person) => {
      addRelationship(person, resource, "maintains", 120);
    });
    rest.slice(maintainerCount).forEach((person) => {
      addRelationship(person, resource, "contributes-to", 180);
    });
    // ~35% of resources get a cross-team contributor so the org intertwines
    if (random() < 0.35) {
      const outsider = pick(allPeople.filter((p) => p.team !== team.name));
      addRelationship(outsider, resource, "contributes-to", 180);
    }
  }
}

// Platform packages: owner from owning team, maintainers/contributors from
// several other teams — the strongest cross-team connections in the graph.
for (const platform of PLATFORM_RESOURCES) {
  const resource = resources.find(
    (item) => item.id === `package:${platform.name.toLowerCase()}`
  );
  const ownerRoster = teamRosters.get(platform.ownerSlug);
  const [owner, coMaintainer] = pickN(ownerRoster, 2);
  addRelationship(owner, resource, "owns", 30);
  addRelationship(coMaintainer, resource, "maintains", 60);
  const otherTeams = pickN(
    TEAMS.filter((team) => team.slug !== platform.ownerSlug),
    3 + Math.floor(random() * 2)
  );
  for (const otherTeam of otherTeams) {
    const person = pick(teamRosters.get(otherTeam.slug));
    addRelationship(
      person,
      resource,
      random() < 0.35 ? "maintains" : "contributes-to",
      150
    );
  }
}

// Everyone participates: sweep up anyone without a relationship as a
// contributor to one of their own team's resources.
for (const team of TEAMS) {
  for (const person of teamRosters.get(team.slug)) {
    if (!relatedPeople.has(person.id)) {
      addRelationship(person, pick(teamResources.get(team.slug)), "contributes-to", 180);
    }
  }
}

// --- Write files ---
const outDir = path.resolve(process.cwd(), "data/public/expertise");
mkdirSync(outDir, { recursive: true });
const writeJson = (file, value) =>
  writeFileSync(path.join(outDir, file), `${JSON.stringify(value, null, 2)}\n`);

writeJson("people.json", people);
writeJson("resources.json", resources);
writeJson("relationships.json", relationships);

const typeCounts = resources.reduce((counts, resource) => {
  counts[resource.type] = (counts[resource.type] ?? 0) + 1;
  return counts;
}, {});
console.log(
  `Atlas org: ${people.length} people in ${TEAMS.length} teams, ` +
    `${resources.length} resources (${JSON.stringify(typeCounts)}), ` +
    `${relationships.length} relationships -> ${outDir}`
);

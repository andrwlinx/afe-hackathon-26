#!/usr/bin/env node
/**
 * Deterministic synthetic expertise data generator for RampPath.
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

const ROLE_POOL = [
  { role: "SDE I", weight: 3 },
  { role: "SDE II", weight: 4 },
  { role: "SDE III", weight: 2 },
  { role: "Senior SDE", weight: 2 },
  { role: "Principal Engineer", weight: 0.5 },
  { role: "SDM", weight: 1 },
  { role: "TPM", weight: 1 },
  { role: "SDE Intern", weight: 1.5 }
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

// Team domains drive resource names and tags so search feels realistic.
const TEAMS = [
  {
    name: "Payments Platform",
    slug: "payments",
    noun: "Payment",
    tags: ["payments", "transactions", "billing"],
    concepts: ["ledger", "refund", "invoice", "settlement", "checkout", "chargeback"]
  },
  {
    name: "Search Experience",
    slug: "search",
    noun: "Search",
    tags: ["search", "ranking", "relevance"],
    concepts: ["indexer", "query-parser", "ranker", "autocomplete", "spellcheck", "synonyms"]
  },
  {
    name: "Catalog Services",
    slug: "catalog",
    noun: "Catalog",
    tags: ["catalog", "listings", "products"],
    concepts: ["item-master", "taxonomy", "attributes", "images", "variations", "dedupe"]
  },
  {
    name: "Fulfillment Tech",
    slug: "fulfillment",
    noun: "Fulfillment",
    tags: ["fulfillment", "warehouse", "logistics"],
    concepts: ["pick-route", "inventory", "slotting", "wave-planner", "packing", "manifest"]
  },
  {
    name: "Identity & Access",
    slug: "identity",
    noun: "Identity",
    tags: ["identity", "auth", "security"],
    concepts: ["signin", "tokens", "sessions", "mfa", "permissions", "audit-log"]
  },
  {
    name: "Notifications Hub",
    slug: "notifications",
    noun: "Notification",
    tags: ["notifications", "messaging", "email"],
    concepts: ["dispatcher", "templates", "preferences", "digest", "push-relay", "bounce-handler"]
  },
  {
    name: "Analytics Insights",
    slug: "analytics",
    noun: "Analytics",
    tags: ["analytics", "metrics", "reporting"],
    concepts: ["event-stream", "aggregator", "dashboards", "funnels", "cohorts", "exports"]
  },
  {
    name: "Delivery Estimates",
    slug: "delivery",
    noun: "Delivery",
    tags: ["delivery", "promise", "shipping"],
    concepts: ["promise-engine", "carrier-feed", "zones", "cutoffs", "tracking", "eta-model"]
  },
  {
    name: "Ads Measurement",
    slug: "ads",
    noun: "Ads",
    tags: ["ads", "attribution", "campaigns"],
    concepts: ["click-tracker", "attribution", "budget-pacer", "auctions", "reporting-api", "fraud-filter"]
  },
  {
    name: "Onboarding Tools",
    slug: "onboarding",
    noun: "Onboarding",
    tags: ["onboarding", "interns", "devtools"],
    concepts: ["ramp-tracker", "mentor-match", "starter-tasks", "wiki-sync", "checklists", "badges"]
  }
];

const RESOURCE_KINDS = ["package", "package", "package", "pipeline", "bindle", "service"];

// --- People ---
const people = [];
const usedAliases = new Set(["avery", "jordan", "priya"]);
const usedNames = new Set();
let nameCursor = 0;
const namePairs = [];
for (const first of FIRST_NAMES) {
  for (const last of LAST_NAMES) {
    namePairs.push([first, last]);
  }
}
// Shuffle deterministically
for (let i = namePairs.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [namePairs[i], namePairs[j]] = [namePairs[j], namePairs[i]];
}

function nextPerson(team) {
  while (nameCursor < namePairs.length) {
    const [first, last] = namePairs[nameCursor++];
    const name = `${first} ${last}`;
    const alias = `${first[0]}${last}`.toLowerCase().replace(/[^a-z]/g, "");
    if (usedNames.has(name) || usedAliases.has(alias)) continue;
    usedNames.add(name);
    usedAliases.add(alias);
    const id = `person:${first.toLowerCase()}-${last.toLowerCase()}`.replace(
      /[^a-z0-9:-]/g,
      ""
    );
    return {
      id,
      name,
      alias,
      team: team.name,
      role: weightedRole(),
      aliases: [`${first.toLowerCase()}.${last.toLowerCase()}`],
      profileUrl: `https://phonetool.example.com/users/${alias}`
    };
  }
  throw new Error("Ran out of unique names");
}

const teamRosters = new Map();
for (const team of TEAMS) {
  const size = 9 + Math.floor(random() * 3); // 9-11 people per team
  const roster = Array.from({ length: size }, () => nextPerson(team));
  teamRosters.set(team.slug, roster);
  people.push(...roster);
}

// --- Resources ---
const resources = [];
const kindPrefix = {
  package: "package",
  pipeline: "pipeline",
  bindle: "bindle",
  service: "service"
};
function titleCase(slugText) {
  return slugText
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}
const teamResources = new Map();
for (const team of TEAMS) {
  const list = [];
  for (const concept of team.concepts) {
    const kind = pick(RESOURCE_KINDS);
    const slug = `${team.slug}-${concept}`;
    const name =
      kind === "pipeline"
        ? `${titleCase(slug)}Pipeline`
        : kind === "bindle"
          ? `${titleCase(slug)}Bindle`
          : `${team.noun}${titleCase(concept)}`;
    list.push({
      id: `${kindPrefix[kind]}:${slug}`,
      type: kind,
      name,
      description: `${team.noun} ${concept.replace(/-/g, " ")} ${
        kind === "pipeline"
          ? "deployment pipeline"
          : kind === "bindle"
            ? "ownership bindle"
            : kind === "service"
              ? "service"
              : "package"
      } owned by ${team.name}.`,
      tags: [...team.tags, concept.replace(/-/g, " ")],
      aliases: [slug]
    });
  }
  teamResources.set(team.slug, list);
  resources.push(...list);
}

// --- Relationships ---
const relationships = [];
let relationshipCounter = 0;
function daysAgo(maxDays) {
  return Math.floor(random() * maxDays);
}
function isoDateDaysAgo(days) {
  const date = new Date(Date.UTC(2026, 6, 21) - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}
function addRelationship(person, resource, relation, maxAgeDays) {
  const activeDays = daysAgo(maxAgeDays);
  relationshipCounter += 1;
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
    const [owner, ...rest] = pickN(roster, 2 + Math.floor(random() * 3)); // owner + 1-3 others
    addRelationship(owner, resource, "owns", 60);
    const maintainerCount = Math.min(rest.length, 1 + Math.floor(random() * 2));
    rest.slice(0, maintainerCount).forEach((person) => {
      addRelationship(person, resource, "maintains", 120);
    });
    rest.slice(maintainerCount).forEach((person) => {
      addRelationship(person, resource, "contributes-to", 180);
    });
    // ~25% of resources get one cross-team contributor for realistic overlap
    if (random() < 0.25) {
      const outsider = pick(allPeople.filter((p) => p.team !== team.name));
      addRelationship(outsider, resource, "contributes-to", 180);
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

console.log(
  `Generated ${people.length} people, ${resources.length} resources, ${relationships.length} relationships across ${TEAMS.length} teams -> ${outDir}`
);

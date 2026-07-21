# Path

**The shortest path from "I'm blocked" to "I know exactly who to ask."**

It is day three of an internship. You need to change a production setting, but
the package name does not match the owning team, the account is governed by a
Bindle you have never seen, and the role you need is documented somewhere you
cannot find.

The answer exists. It is just spread across people, packages, pipelines,
permissions, accounts, and stale pages.

Every engineering organization is a graph that new builders cannot see.
**Path makes that graph queryable.**

![Path showing an evidence-backed path and ranked contacts](docs/path-demo.png)

## The pitch

Path is an evidence-backed navigation layer for engineering organizations.
An intern asks a normal question and gets three things:

1. **The answer** - who owns it, where it deploys, or whether access is
   confirmed.
2. **The path** - the people, teams, resources, roles, and accounts that support
   that answer.
3. **The next action** - who to contact, what role to request, and a draft they
   can send.

Search can find documents *about* a system. Path answers questions whose
answers only emerge after joining relationships:

```text
person -> team -> package
person -> role -> account -> resource
package -> pipeline -> stage -> account
approver -> bindle -> account
```

That makes Path useful on an intern's first week and valuable anywhere
ownership, access, and operational knowledge are fragmented.

## From question to action

Ask:

> Can I edit supported locations in prod?

Path does not stop at "no." It shows that the required role grants access,
marks the missing role-assumption edge, identifies the approver, and prepares
the request.

Ask:

> Who knows about AtlasRegionContext?

Path ranks people by connected resources, relationship strength, and recent
activity. Every score expands into a plain-language "Why this person"
breakdown, so an intern can choose a contact with confidence.

## Features

### Ask in plain language

The query layer recognizes five high-value onboarding intents:

- Find the people who know a system
- Resolve an owner
- Check an access path
- Plan an access request
- Trace a deployment

Natural language selects a supported traversal; it does not invent graph facts.

### See the path in 3D

The interactive Three.js graph gives every answer a visible structure:

- Stable, deterministic node positions
- Directed verified and missing connections
- Orbit, zoom, reset, and node inspection
- Readable labels at desktop and mobile sizes
- Keyboard path navigation and a no-WebGL fallback

### Find the right human, not just an owner field

Expert search combines:

```text
keyword relevance
x relationship weight
x recency
```

Owners, maintainers, and contributors receive different weights. The top raw
score is normalized to 100, while role, team, matched resources, and scoring
evidence remain visible.

### Turn missing access into a next step

Path distinguishes **missing evidence** from an authorization denial. When
it cannot confirm a path, it shows the exact missing edge, likely approver, and
request text instead of making an unsupported security claim.

### Keep every answer traceable

Evidence includes source, confidence, mode, and observation time. Verified
connections remain visually distinct from missing ones, and stale or absent
data stays explicit.

### Meet builders where they work

The same deterministic query engine powers:

- The React web application
- A read-only HTTP API
- Five MCP tools for coding agents and assistants

## Why it is different

| Existing approach | What the intern still has to do | Path |
| --- | --- | --- |
| Enterprise search | Read several pages and reconcile them | Joins relationships into one path |
| Service catalog | Trust a manually maintained owner field | Shows ownership with source evidence |
| Access portal | Know the right account, role, and resource first | Finds the missing role and approver |
| Ask in chat | Guess the right room or person | Ranks contacts and explains why |

Path does not grant permissions or replace source systems. It makes their
relationships understandable enough for a new builder to take the next correct
action.

## How it works

```text
Validated JSON snapshots
          |
          v
Typed nodes + evidence-backed edges
          |
          v
In-memory graph indexes
          |
          +--> deterministic ownership/access/deployment traversals
          |
          +--> explainable expertise ranking
                         |
                         +--> Express API
                         +--> MCP tools
                         `--> React + Three.js interface
```

The current prototype uses validated snapshots and synthetic public data.
Connector-based synchronization with live source systems is the next step, not
a claim made by this demo.

## Try the demo

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The API runs at
<http://127.0.0.1:3001>.

Start with:

1. `Who knows about AtlasRegionContext?`
2. `Who owns AtlasRegionContext?`
3. `Can I edit supported locations in prod?`
4. `What access should I request to edit supported locations in prod?`
5. `Where does AtlasRegionContext deploy?`

## Data and safety

The committed graph is fictional and safe for a public repository. Do not
commit internal entities, account IDs, URLs, aliases, or relationships.

Use a private graph snapshot without exposing it to source control:

```bash
GRAPH_DATA_FILE=data/private/graph.json npm run dev
```

Optional expertise data uses three files:

- `data/public/expertise/people.json`
- `data/public/expertise/resources.json`
- `data/public/expertise/relationships.json`

Start from the adjacent `*.example.json` files. The full schema and privacy
rules live in
[`data/public/expertise/README.md`](data/public/expertise/README.md).

For private expertise snapshots:

```bash
EXPERTISE_DATA_DIR=data/private/expertise npm run dev
```

The server rejects partial datasets, missing references, duplicate
relationships, and incompatible IDs. `data/private/` is gitignored, and
credentials remain server-side.

## MCP

Start the stdio server:

```bash
npm run mcp
```

It exposes five read-only tools:

- `find_experts`
- `resolve_owner`
- `check_access`
- `plan_access_request`
- `trace_deployment`

## Verify

```bash
npm test
npm run build
npm run test:e2e
```

The suite covers graph integrity, public-data safety, deterministic queries,
expert ranking, APIs, responsive workflows, and nonblank WebGL rendering at
1440px and 390px.

## Project map

- `src/shared` - graph contracts and query response types
- `src/server` - connectors, indexes, ranking, traversal, HTTP, and MCP
- `src/client` - query workflow, 3D graph, evidence, and ranked contacts
- `data/public` - sanitized demonstration data
- `tests` and `e2e` - behavior, safety, and responsive browser coverage

## Team

- Ava Martoma
- Daniel Lee
- Jacob Ryabinky
- Andrew Lin

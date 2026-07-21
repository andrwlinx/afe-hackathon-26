# RampPath

RampPath is an evidence-backed engineering knowledge graph for new interns. It
connects ownership, permissions, packages, pipelines, deployment accounts, and
approvers so an intern can answer:

- Who owns this?
- Can I access this?
- Which role should I request, and from whom?
- Where does this package deploy?

The natural-language layer only selects a supported graph traversal. Every
claim comes from a displayed path with source, confidence, and observation
time. Missing data is reported as **not confirmed**, never as an authorization
denial.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The API runs at
<http://127.0.0.1:3001>.

```bash
npm test
npm run build
```

## Demo questions

1. `Who owns AtlasRegionContext?`
2. `Can I edit supported locations in prod?`
3. `What access should I request to edit supported locations in prod?`
4. `Where does AtlasRegionContext deploy?`

The committed graph is synthetic and safe for the public repository.

## Private snapshots

Do not commit internal entities, account IDs, URLs, aliases, or relationships.
Place an equivalent validated graph file under `data/private/`, then start the
server with its path:

```bash
GRAPH_DATA_FILE=data/private/graph.json npm run dev
```

`data/private/` is gitignored. Credentials and Midway cookies stay server-side;
the browser only receives the graph selected for the running demo.

## MCP

Start the stdio server:

```bash
npm run mcp
```

It exposes four read-only tools:

- `resolve_owner`
- `check_access`
- `plan_access_request`
- `trace_deployment`

The MCP and HTTP interfaces use the same deterministic `QueryEngine`.

## Architecture

```text
JSON snapshot -> Zod validation -> in-memory graph -> deterministic queries
                                             |-> Express API -> React/Cytoscape
                                             `-> MCP stdio tools
```

- `src/shared`: graph contracts and query response types
- `src/server`: loader, indexes, traversal engine, API, and MCP server
- `src/client`: intern-focused query and evidence interface
- `data/public`: sanitized demonstration graph
- `tests`: graph integrity, disclosure safety, query behavior, and API coverage

## Team

- Ava Martoma
- Daniel Lee
- Jacob Ryabinky
- Andrew Lin

Submission deadline: July 21, 2026 at 12:00 PM Pacific.

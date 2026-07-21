# RampPath

RampPath is an evidence-backed engineering knowledge graph for new interns. It
connects ownership, permissions, packages, pipelines, deployment accounts, and
approvers so an intern can answer:

- Who should I ask about this system?
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

1. `Who knows about AtlasRegionContext?`
2. `Who owns AtlasRegionContext?`
3. `Can I edit supported locations in prod?`
4. `What access should I request to edit supported locations in prod?`
5. `Where does AtlasRegionContext deploy?`

The committed graph is synthetic and safe for the public repository.

## Synthetic expertise data

Ranked people search reads three optional files:

- `data/public/expertise/people.json`
- `data/public/expertise/resources.json`
- `data/public/expertise/relationships.json`

Copy the adjacent `*.example.json` files to start. The complete contract and
privacy rules are in
[`data/public/expertise/README.md`](data/public/expertise/README.md).
When all three files are present, the server validates and merges them
automatically. It fails loudly on partial files, missing references, duplicate
edges, or incompatible entity IDs.

For private data, keep the files outside the public directory:

```bash
EXPERTISE_DATA_DIR=data/private/expertise npm run dev
```

Expert scores combine fuzzy resource relevance, relationship weight
(`owns=1.0`, `maintains=0.7`, `contributes-to=0.4`), and recency. The highest
raw score is normalized to 100, and every component is displayed in the UI.

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

It exposes five read-only tools:

- `find_experts`
- `resolve_owner`
- `check_access`
- `plan_access_request`
- `trace_deployment`

The MCP and HTTP interfaces use the same deterministic `QueryEngine`.

## Architecture

```text
JSON snapshots -> Zod validation -> in-memory graph -> deterministic queries
                                        |-> explainable expertise ranking
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

# Synthetic Expertise Data Contract

Add these three active files to this directory:

- `people.json`
- `resources.json`
- `relationships.json`

The server detects them only when all three exist. Start from the
`*.example.json` files in this directory.

## Rules

- IDs are lowercase and namespaced, such as `person:morgan-lee`.
- Every `personId` and `resourceId` must exist in the corresponding file.
- `lastActive` uses `YYYY-MM-DD`.
- `observedAt` uses an ISO timestamp.
- Use only fictional names, aliases, URLs, and systems in this public folder.
- Put real snapshots under `data/private/` and set `EXPERTISE_DATA_DIR`.
- Public profile URLs are optional. Do not commit internal profile links.

The ranking engine combines keyword match strength, relationship weight, and
recency. Relationship weights are owner `1.0`, maintainer `0.7`, and
contributor `0.4`.

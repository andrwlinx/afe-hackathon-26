# Handover Log — AFE Hackathon 2026

This document tracks all work done on the project. **Update it every time you push** so the team always knows what changed and where. This is our primary tool for avoiding merge conflicts.

> **How to use this file**
> 1. Before you start working, read the latest entries below.
> 2. When you push, add a new row to the **Change Log** describing what you touched (files/areas), which branch, and the date.
> 3. If you're editing a file someone else is actively working on, coordinate with them first (check the "Currently Working On" table).

---

## Team & Branches

| Person          | Branch    | Currently Working On                 |
|-----------------|-----------|--------------------------------------|
| Ava Martoma     | `ava`     | UI lead + slide deck                 |
| Daniel Lee      | `daniel`  | JSON data + backend, UI help         |
| Jacob Ryabinky  | `jacob`   | Demo video (script, record, edit)    |
| Andrew Lin      | `andrew`  | Core dev (graph + search), UI help   |

---

## Change Log

Add newest entries at the top.

| Date (PST) | Person | Branch | Files / Area Changed | Summary |
|------------|--------|--------|----------------------|---------|
| 2026-07-21 | Andrew Lin | `andrew` | handover.md | Merged the latest `main`, preserving the Compass project spec and RampPath implementation notes. |
| 2026-07-20 | Andrew Lin | `andrew` | Full application | Added RampPath graph contracts, deterministic query engine, HTTP/MCP interfaces, React/Cytoscape UI, synthetic fixtures, tests, and demo documentation. |
| 2026-07-20 | Ava Martoma | `main` | handover.md | Added full project spec for Compass (ownership knowledge graph + people search with relevancy scores, Phone Tool integration) and team work split. |
| 2026-07-20 | Ava Martoma | `main` | README.md, handover.md, .gitignore | Initial repo setup — added README, handover log, and gitignore. Created per-person branches. |

---

## Hackathon Submission Checklist

Submissions close **July 21st at 12:00 PM PST**. Fill this in before then.

### Required
- [x] **Project name:** RampPath
- [x] **Short description (2–3 sentences — what is it and who is it for):** RampPath is an evidence-backed engineering knowledge graph for new interns. It turns ownership, access, and deployment questions into verified paths, identifies the exact missing role or approver, and drafts the next request without inventing facts.
- [ ] **Demo video (3–5 min max — the main thing judges evaluate):** _link TBD_
- [ ] **Link to code/artifact (GitHub / code.amazon.com / Quip / deployed URL):** https://github.com/avamartoma/afe-hackathon-26

### Optional / Nice-to-have
- [ ] **Slide deck (2–3 slides max):** _link TBD_
- [x] **How it fits "Pay it Forward" (one sentence — who benefits after the hackathon ends):** Each intern's solved onboarding blocker becomes a reusable, source-linked path for the next intern instead of disappearing into chat history.

---

## Notes / Decisions

Use this section to record any team decisions, blockers, or things future contributors should know.

- 2026-07-21: Project idea selected and scoped — see spec below.
- The public repository contains synthetic graph data only. Real internal snapshots must remain under the gitignored `data/private/` directory.
- The MVP supports four deterministic intents; arbitrary LLM-generated graph queries and continuous synchronization are future work.

---

# Project Spec: Compass (working name)

*Alternative names: WhoKnows, OwnerGraph, Pathfinder — team to decide.*

## Pitch (use for the submission's short description)

Compass is an interactive knowledge graph that maps who owns what — packages, bindles, pipelines, and services — across a team or org. New interns can explore the ownership tree visually, or ask a question ("who knows about the payments Lambda?") and get back a ranked list of people with relevancy scores. Built for new AFE interns and any engineer joining an unfamiliar team.

## Problem

New interns don't know who owns anything or who to ask. Ownership info is scattered across Bindles, Pipelines, wikis, and tribal knowledge. Asking the wrong person wastes everyone's time — and interns are often too intimidated to ask at all.

## Core Features (MVP)

1. **Interactive ownership graph** — Nodes: people, teams, resources (packages / bindles / pipelines / services). Edges: `owns`, `maintains`, `contributes-to`, `member-of`. Click a node to expand its neighborhood; click a person to see everything they own.
2. **Question search with relevancy scores** — Free-text question → matches resource names/descriptions/tags → returns *people* ranked by relevancy score.
3. **Person cards with Phone Tool integration** — Name, alias, team, what they own, why they matched, and a direct link to their Phone Tool profile (`phonetool.amazon.com/users/<alias>`) so you can immediately see their photo, manager chain, and contact info.

## Relevancy Scoring (simple + explainable)

```
score(person, query) =
  Σ over matched resources:
    keywordMatchStrength(query, resource)   # fuzzy match on name/description/tags
    × relationshipWeight                    # owner: 1.0, maintainer: 0.7, contributor: 0.4
    × recencyFactor                         # active ≤30d: 1.0, ≤90d: 0.8, older: 0.5
→ normalize top score to 100
```

Show the score breakdown in the UI — "why this person" is the wow moment of the demo.

## Data Model (fake JSON — no backend)

```json
// people.json
{ "id": "p1", "name": "Jane Doe", "alias": "jdoe", "team": "Payments", "role": "SDE II" }

// resources.json
{ "id": "r1", "type": "package", "name": "PaymentsLambda",
  "description": "Processes payment events from DDB stream",
  "tags": ["payments", "lambda", "dynamodb"] }

// edges.json
{ "from": "p1", "to": "r1", "relation": "owns", "lastActive": "2026-06-30" }
```

Target: ~30 people, ~60 resources, ~120 edges via a small generator script, with 2-3 realistic team clusters (e.g., Payments, Onboarding Tools).

## Tech Stack

- **Frontend-only static site** (no backend/auth) — deploy on GitHub Pages
- **Graph:** Cytoscape.js or vis-network (click-to-expand out of the box)
- **Search:** Fuse.js fuzzy matching + custom scoring layer
- **Framework:** React (Vite) or vanilla JS — whichever the team is fastest in

## Work Split

| Branch   | Person          | Workstream |
|----------|-----------------|------------|
| `andrew` | Andrew Lin      | Core dev — graph visualization, search + relevancy scoring engine; helps with UI |
| `daniel` | Daniel Lee      | JSON data model + fake-data generation, backend/data layer (**schema first — unblocks everyone**); helps with UI |
| `ava`    | Ava Martoma     | UI lead (shell, styling, person cards) + slide deck (2-3 slides) |
| `jacob`  | Jacob Ryabinky  | Demo — script, recording, and editing the 3-5 min video |

**Critical path:** agree on the JSON schema in the first 30 minutes, commit it to `main`, then work in parallel against it.

## Demo Script (3–5 min video)

1. (30s) The problem: "It's day 3 of your internship. Something in the payments pipeline broke. Who do you ask?"
2. (60s) Explore the graph — zoom into a team, click a person, see their ownership.
3. (90s) The money shot: type "who knows about payment stream processing?" → ranked people with scores → click top result → show the *why* breakdown.
4. (30s) Pay it Forward: fake data today, but the schema maps 1:1 to real Bindles/Pipelines/Brazil data — future cohorts plug in real sources.

## Pay it Forward (one sentence for submission)

After the hackathon, any future intern or engineer joining an unfamiliar org can use Compass to instantly see who owns what and who to ask — and the data schema is designed to plug into real internal ownership sources so future cohorts can extend it.

## Stretch Goals (mention in demo, don't build)

- Ingest real Bindles/Pipelines APIs instead of fake JSON
- LLM-powered natural-language answers on top of search
- Org-chart overlay / "path to the right person"

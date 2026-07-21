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
| Ava Martoma     | `ava`     | _initial project setup_              |
| Daniel Lee      | `daniel`  | _TBD_                                |
| Jacob Ryabinky  | `jacob`   | _TBD_                                |
| Andrew Lin      | `andrew`  | RampPath end-to-end MVP              |

---

## Change Log

Add newest entries at the top.

| Date (PST) | Person | Branch | Files / Area Changed | Summary |
|------------|--------|--------|----------------------|---------|
| 2026-07-20 | Andrew Lin | `andrew` | Full application | Added RampPath graph contracts, deterministic query engine, HTTP/MCP interfaces, React/Cytoscape UI, synthetic fixtures, tests, and demo documentation. |
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

- The public repository contains synthetic graph data only. Real internal snapshots must remain under the gitignored `data/private/` directory.
- The MVP supports four deterministic intents; arbitrary LLM-generated graph queries and continuous synchronization are future work.

# RampPath Demo Script

Target length: 3-4 minutes. Record at http://127.0.0.1:5173/ (start on the
Phone Tool page, 1440px window, hard-refresh first).

## 0:00 - The blocker

Start on the **Phone Tool page** (Jane Doe's profile).

"You're Jane — three days into your internship on Atlas Experience. Something
in the pipeline broke. Phone Tool tells you who people ARE, but not who owns
what. A simple access question can span package ownership, a pipeline, an AWS
account, a Bindle, and an approver — five systems you've never heard of."

## 0:20 - RampPath lives inside Phone Tool

Point out that RampPath is a **native A-to-Z tab** — same header, same design
language. Click **Find a resource** on the RampPath card (or the RampPath tab).

"So we built RampPath where interns already are: one click from your Phone
Tool profile."

## 0:35 - Find the right person

Run `Who knows about AtlasRegionContext?`

Show the ranked people with normalized scores. Expand **"Why this person"**
on Jordan Rivera: keyword relevance x relationship strength x recency, with
the math visible.

"No hallucination — every score is explainable."

## 1:05 - The knowledge web + contact them

In the 3D graph, click a person node (e.g. Sofia Iyer). The inspector shows
her **alias and an "Open in Phone Tool" link** — straight back to the
directory to actually contact her. Zoom/orbit briefly; note people, packages,
pipelines, and the owning team in one connected web.

## 1:30 - Plain-English ownership (fuzzy + options)

Run `Who owns metrics?`

RampPath doesn't guess: it offers **clickable options** (AtlasMetricsSDK,
the ingest pipeline...). Click `Who owns AtlasMetricsSDK?` — owner, their
team, and everyone who maintains or contributes to it, as a web.

"You don't need to know the exact package name. Ask like a human."

## 2:00 - Access gap, without inventing a denial

Run `Can I edit supported locations in prod?`

Point out that RampPath does not claim a denial. It proves the resource
requires `AtlasProdOperator`, shows the missing role edge (red dashed line in
the graph), and identifies the verified approver: Priya Shah.

## 2:25 - Next action

Run `What access should I request to edit supported locations in prod?`

Copy the drafted request with the copy button. "The role and the recipient
came from graph records, not generated prose."

## 2:45 - Deployment context (optional if tight on time)

Run `Where does AtlasRegionContext deploy?`

Show the package-to-pipeline-to-stage-to-account paths for Alpha and Prod.

## 3:00 - Pay it forward

End on the path view with the source-records evidence panel open.

"Today this runs on synthetic data — 237 entities across a fictional AWS org.
The schema maps one-to-one to real sources: Bindles, Pipelines, Brazil, Phone
Tool. Every solved blocker becomes a reusable, source-linked path. The next
intern starts from an answer and an action — not six disconnected systems."

---

### Recording checklist

- [ ] Dev server running (`npm run dev`), hard-refresh both pages first
- [ ] Window at ~1440px wide; hide bookmarks bar
- [ ] Pre-run every query once so responses are instant on camera
- [ ] Keep it under 5:00 (requirement); 3:30 is the sweet spot

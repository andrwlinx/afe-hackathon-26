import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clipboard,
  Database,
  ExternalLink,
  Search
} from "lucide-react";
import {
  FormEvent,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState
} from "react";
import { AtoZHeader } from "./AtoZHeader.js";
import type { QueryResponse } from "../shared/graph.js";

const GraphView = lazy(() =>
  import("./GraphView.js").then((module) => ({ default: module.GraphView }))
);

const examples = [
  {
    label: "Find the right person",
    question: "Who knows about AtlasRegionContext?"
  },
  {
    label: "Find an owner",
    question: "Who owns AtlasRegionContext?"
  },
  {
    label: "Check my access",
    question: "Can I edit supported locations in prod?"
  },
  {
    label: "Plan an access request",
    question: "What access should I request to edit supported locations in prod?"
  },
  {
    label: "Trace a deployment",
    question: "Where does AtlasRegionContext deploy?"
  }
];

interface Health {
  ok: boolean;
  nodes: number;
  edges: number;
  generatedAt: string;
  dataMode: "public" | "private";
  expertiseLoaded: boolean;
}

function statusIcon(status: QueryResponse["result"]["status"]) {
  if (status === "confirmed") return CheckCircle2;
  if (status === "action-needed") return CircleAlert;
  return CircleHelp;
}

function stringAttribute(
  attributes: Record<string, unknown>,
  key: string
): string | undefined {
  return typeof attributes[key] === "string" ? attributes[key] : undefined;
}

export function App() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((result) => {
        if (!result.ok) throw new Error("API unavailable");
        return result.json();
      })
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function submit(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (cleanQuestion.length < 3) return;

    setQuestion(cleanQuestion);
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const result = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion })
      });
      if (!result.ok) throw new Error("Query failed");
      setResponse(await result.json());
    } catch {
      setError("Path could not reach the graph service.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  async function copyDraft() {
    const draft = response?.result.draftRequest;
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const StatusIcon = response ? statusIcon(response.result.status) : CircleHelp;
  const sourceName = health?.expertiseLoaded
    ? "Expertise JSON"
    : health?.dataMode === "private"
      ? "Private snapshot"
      : "Demo dataset";

  return (
    <div className="app-shell">
      <AtoZHeader
        active="path"
        status={
          <div className="system-status" title="Loaded graph status">
            <span className={health?.ok ? "status-dot online" : "status-dot"} />
            {health
              ? `${health.nodes} entities · ${health.edges} connections`
              : "Connecting"}
          </div>
        }
      />

      <main className="workspace">
        <section className="query-band" aria-label="Ask Path">
          <form onSubmit={handleSubmit} className="query-form">
            <label className="sr-only" htmlFor="question">
              What do you need to unblock?
            </label>
            <div className="query-input">
              <Search size={18} aria-hidden="true" />
              <input
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                placeholder='Ask me a question, i.e. "Who knows about AtlasRegionContext?"'
              />
            </div>
            <select
              aria-label="Example questions"
              value={
                examples.some((example) => example.question === question)
                  ? question
                  : ""
              }
              onChange={(event) => {
                const nextQuestion = event.currentTarget.value;
                if (nextQuestion) void submit(nextQuestion);
              }}
            >
              {examples.some((example) => example.question === question) ? null : (
                <option value="" disabled>
                  Examples
                </option>
              )}
              {examples.map((example) => (
                <option key={example.label} value={example.question}>
                  {example.label}
                </option>
              ))}
            </select>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Tracing..." : "Trace answer"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="source-meta">
            <Database size={14} />
            <span>{sourceName}</span>
            {health ? (
              <time dateTime={health.generatedAt}>
                {new Date(health.generatedAt).toLocaleDateString()}
              </time>
            ) : null}
          </div>
        </section>

        <section
          className="answer-workspace"
          aria-live="polite"
          aria-busy={loading}
        >
          {!response && !error ? (
            <div className="empty-state">
              <span className="section-label">Start with one question</span>
              <h1>Find the shortest path to the right answer.</h1>
              <p>
                Trace ownership, access, approvers, and deployments through
                evidence-backed connections.
              </p>
              <button
                type="button"
                onClick={() => void submit(examples[0].question)}
              >
                Run an example
                <ArrowRight size={16} />
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="error-state">
              <CircleAlert size={22} />
              <span>{error}</span>
            </div>
          ) : null}

          {response ? (
            <div className="result-layout">
              <section
                className={`answer-summary status-${response.result.status}`}
              >
                <div className="answer-copy">
                  <div className="answer-status">
                    <StatusIcon size={18} />
                    <span>{response.result.status.replace("-", " ")}</span>
                  </div>
                  <h1>{response.result.headline}</h1>
                  <p>{response.result.summary}</p>
                  {response.result.alternatives?.length ? (
                    <div className="alternative-chips">
                      {response.result.alternatives.map((alternative) => (
                        <button
                          key={alternative}
                          type="button"
                          onClick={() => void submit(alternative)}
                        >
                          {alternative}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {response.result.nextAction ? (
                  <div className="next-action">
                    <ArrowRight size={17} />
                    <div>
                      <span>Next action</span>
                      <strong>{response.result.nextAction}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="answer-confidence">
                    <CheckCircle2 size={18} />
                    <span>
                      {response.result.evidence.length} source record
                      {response.result.evidence.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </section>

              <section className="path-section">
                <div className="content-heading">
                  <div>
                    <span className="section-label">Verified path</span>
                    <h2>
                      {response.result.intent === "find-experts"
                        ? "People connected to matching resources"
                        : "How Path reached this answer"}
                    </h2>
                  </div>
                  <span className="view-label">3D view</span>
                </div>
                <Suspense
                  fallback={<div className="graph-loading">Loading 3D view</div>}
                >
                  <GraphView path={response.result.path} />
                </Suspense>
              </section>

              {response.result.experts?.length ? (
                <section className="expert-results">
                  <div className="content-heading">
                    <div>
                      <span className="section-label">Ranked contacts</span>
                      <h2>Who to ask first</h2>
                    </div>
                    <span className="score-key">Top score normalized to 100</span>
                  </div>
                  <div className="expert-list">
                    {response.result.experts.map((expert, index) => {
                      const alias = stringAttribute(
                        expert.person.attributes,
                        "alias"
                      );
                      const team = stringAttribute(
                        expert.person.attributes,
                        "team"
                      );
                      const role = stringAttribute(
                        expert.person.attributes,
                        "role"
                      );
                      const profileUrl = stringAttribute(
                        expert.person.attributes,
                        "profileUrl"
                      );
                      const matchedResources = expert.reasons
                        .map((reason) => reason.resource.label)
                        .filter((value, reasonIndex, values) =>
                          values.indexOf(value) === reasonIndex
                        );
                      const initials = expert.person.label
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return (
                        <article className="expert-row" key={expert.person.id}>
                          <div className="expert-summary">
                            <span className="expert-rank">#{index + 1}</span>
                            <div className="expert-badge" aria-hidden="true">
                              {initials}
                            </div>
                            <div className="expert-identity">
                              <strong>
                                {expert.person.label}
                                {alias ? (
                                  <span className="expert-alias">
                                    {" "}
                                    {alias}@
                                  </span>
                                ) : null}
                              </strong>
                              <span>
                                {[role ?? expert.person.description, team]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </div>
                            <div className="matched-resources">
                              <span>Matched resources</span>
                              <strong>{matchedResources.join(", ")}</strong>
                            </div>
                            <div
                              className="expert-score"
                              aria-label={`${expert.score} percent relevance`}
                            >
                              <strong>{expert.score}</strong>
                              <span>match</span>
                            </div>
                          </div>
                          <details className="reason-disclosure">
                            <summary>
                              Why this person
                              <ChevronDown size={15} />
                            </summary>
                            <div className="reason-list">
                              {expert.reasons.slice(0, 3).map((reason) => (
                                <div
                                  className="reason-row"
                                  key={`${expert.person.id}-${reason.resource.id}`}
                                >
                                  <div>
                                    <strong>{reason.resource.label}</strong>
                                    <span>
                                      {reason.relation === "team-owner"
                                        ? "owning team"
                                        : reason.relation.replace("-", " ")}
                                    </span>
                                  </div>
                                  <span className="reason-math">
                                    {Math.round(reason.matchStrength * 100)}%
                                    relevance ·{" "}
                                    {Math.round(
                                      reason.relationshipWeight * 100
                                    )}
                                    % relationship ·{" "}
                                    {Math.round(reason.recencyFactor * 100)}%
                                    recency
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                          {profileUrl ? (
                            <a
                              className="profile-link"
                              href={profileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open in Phone Tool
                              <ExternalLink size={14} />
                            </a>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {response.result.draftRequest ? (
                <div className="support-grid">
                  <section className="draft-panel">
                    <div>
                      <span className="section-label">AI suggested response</span>
                      <h2>Ready to send</h2>
                      <p>{response.result.draftRequest}</p>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => void copyDraft()}
                      title="Copy suggested response"
                      aria-label="Copy suggested response"
                    >
                      {copied ? <Check size={17} /> : <Clipboard size={17} />}
                    </button>
                  </section>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

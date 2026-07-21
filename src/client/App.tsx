import {
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Clipboard,
  Database,
  ExternalLink,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { QueryResponse } from "../shared/graph.js";
import { GraphView } from "./GraphView.js";

const examples = [
  {
    label: "Find the right person",
    question: "Who knows about AtlasRegionContext?",
    icon: UsersRound
  },
  {
    label: "Find an owner",
    question: "Who owns AtlasRegionContext?",
    icon: UserRoundCheck
  },
  {
    label: "Check my access",
    question: "Can I edit supported locations in prod?",
    icon: ShieldCheck
  },
  {
    label: "Plan an access request",
    question: "What access should I request to edit supported locations in prod?",
    icon: Clipboard
  },
  {
    label: "Trace a deployment",
    question: "Where does AtlasRegionContext deploy?",
    icon: Network
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
  return typeof attributes[key] === "string"
    ? attributes[key]
    : undefined;
}

export function App() {
  const [question, setQuestion] = useState(examples[0].question);
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

  const freshness = useMemo(() => {
    const values = response?.result.evidence.map((item) =>
      new Date(item.observedAt).getTime()
    );
    if (!values?.length) return null;
    return new Date(Math.max(...values));
  }, [response]);

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
      setError("RampPath could not reach the graph service.");
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

  const StatusIcon = response ? statusIcon(response.result.status) : Sparkles;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Network size={19} strokeWidth={2.3} />
          </div>
          <div>
            <strong>RampPath</strong>
            <span>Engineering knowledge graph</span>
          </div>
        </div>
        <div className="system-status" title="Loaded graph status">
          <span className={health?.ok ? "status-dot online" : "status-dot"} />
          {health
            ? `${health.nodes} entities · ${health.edges} connections`
            : "Connecting"}
        </div>
      </header>

      <main className="workspace">
        <aside className="query-sidebar">
          <div className="sidebar-heading">
            <span>New question</span>
            <Search size={16} />
          </div>
          <form onSubmit={handleSubmit} className="query-form">
            <label htmlFor="question">What do you need to unblock?</label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              maxLength={500}
            />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Tracing…" : "Trace answer"}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="example-group">
            <span className="section-label">Common paths</span>
            {examples.map((example) => {
              const Icon = example.icon;
              return (
                <button
                  className="example-button"
                  key={example.label}
                  type="button"
                  onClick={() => void submit(example.question)}
                >
                  <Icon size={17} />
                  <span>
                    <strong>{example.label}</strong>
                    <small>{example.question}</small>
                  </span>
                  <ArrowRight className="example-arrow" size={15} />
                </button>
              );
            })}
          </div>

          <div className="source-summary">
            <Database size={16} />
            <div>
              <strong>
                {health?.expertiseLoaded
                  ? "Expertise JSON loaded"
                  : health?.dataMode === "private"
                    ? "Private snapshot"
                    : "Demo dataset"}
              </strong>
              <span>
                {health
                  ? `Observed ${new Date(health.generatedAt).toLocaleDateString()}`
                  : "Waiting for source metadata"}
              </span>
            </div>
          </div>
        </aside>

        <section className="answer-workspace" aria-live="polite">
          {!response && !error ? (
            <div className="empty-state">
              <div className="empty-graphic" aria-hidden="true">
                <div className="empty-node node-one">
                  <UserRoundCheck size={20} />
                </div>
                <div className="empty-line line-one" />
                <div className="empty-node node-two">
                  <Box size={20} />
                </div>
                <div className="empty-line line-two" />
                <div className="empty-node node-three">
                  <ShieldCheck size={20} />
                </div>
              </div>
              <h1>Follow the path to an answer</h1>
              <p>Ownership, access, approvers, and deployment context in one trace.</p>
              <button type="button" onClick={() => void submit(examples[0].question)}>
                Run the first query
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
              <section className={`answer-summary status-${response.result.status}`}>
                <div className="answer-status">
                  <StatusIcon size={19} />
                  <span>{response.result.status.replace("-", " ")}</span>
                </div>
                <h1>{response.result.headline}</h1>
                <p>{response.result.summary}</p>
                {response.result.nextAction ? (
                  <div className="next-action">
                    <ArrowRight size={17} />
                    <div>
                      <span>Next action</span>
                      <strong>{response.result.nextAction}</strong>
                    </div>
                  </div>
                ) : null}
              </section>

              {response.result.experts?.length ? (
                <section className="expert-results">
                  <div className="expert-results-heading">
                    <div>
                      <span className="section-label">Ranked contacts</span>
                      <h2>Who to ask first</h2>
                    </div>
                    <span className="score-key">Top score normalized to 100</span>
                  </div>
                  <div className="expert-grid">
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

                      return (
                        <article className="expert-card" key={expert.person.id}>
                          <div className="expert-card-top">
                            <span className="expert-rank">#{index + 1}</span>
                            <div className="expert-identity">
                              <strong>{expert.person.label}</strong>
                              <span>
                                {[
                                  alias ? `@${alias}` : null,
                                  role ?? expert.person.description,
                                  team
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </div>
                            <div
                              className="expert-score"
                              aria-label={`${expert.score} percent relevance`}
                            >
                              <strong>{expert.score}</strong>
                              <span>match</span>
                            </div>
                          </div>
                          <div className="score-track" aria-hidden="true">
                            <i style={{ width: `${expert.score}%` }} />
                          </div>
                          <div className="reason-heading">Why this person</div>
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
                                  {Math.round(reason.matchStrength * 100)}% relevance
                                  {" · "}
                                  {Math.round(reason.relationshipWeight * 100)}% relationship
                                  {" · "}
                                  {Math.round(reason.recencyFactor * 100)}% recency
                                </span>
                              </div>
                            ))}
                          </div>
                          {profileUrl ? (
                            <a
                              className="profile-link"
                              href={profileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open profile
                              <ExternalLink size={14} />
                            </a>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="path-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-label">Verified path</span>
                    <h2>
                      {response.result.intent === "find-experts"
                        ? "People connected to matching resources"
                        : "How RampPath reached this answer"}
                    </h2>
                  </div>
                  <div className="legend">
                    <span><i className="verified-line" /> Verified</span>
                    <span><i className="missing-line" /> Missing</span>
                  </div>
                </div>
                <GraphView path={response.result.path} />
              </section>

              <div className="lower-grid">
                <section className="evidence-panel">
                  <div className="panel-heading compact">
                    <div>
                      <span className="section-label">Evidence</span>
                      <h2>Source records</h2>
                    </div>
                    {freshness ? (
                      <span className="freshness">
                        <Check size={13} />
                        {freshness.toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  {response.result.evidence.length ? (
                    <div className="evidence-list">
                      {response.result.evidence.map((item, index) => (
                        <div className="evidence-row" key={`${item.source}-${index}`}>
                          <div className={`source-icon source-${item.source}`}>
                            <Database size={14} />
                          </div>
                          <div>
                            <strong>{item.source.replace("-", " ")}</strong>
                            <span>
                              {item.confidence} · {item.mode}
                            </span>
                          </div>
                          <time>{new Date(item.observedAt).toLocaleDateString()}</time>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-evidence">No supporting records loaded.</div>
                  )}
                </section>

                {response.result.draftRequest ? (
                  <section className="draft-panel">
                    <div className="panel-heading compact">
                      <div>
                        <span className="section-label">Ready to send</span>
                        <h2>Access request</h2>
                      </div>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => void copyDraft()}
                        title="Copy access request"
                        aria-label="Copy access request"
                      >
                        {copied ? <Check size={17} /> : <Clipboard size={17} />}
                      </button>
                    </div>
                    <p>{response.result.draftRequest}</p>
                  </section>
                ) : (
                  <section className="confidence-panel">
                    <CheckCircle2 size={20} />
                    <div>
                      <span>Evidence-backed answer</span>
                      <strong>
                        {response.result.evidence.length} source record
                        {response.result.evidence.length === 1 ? "" : "s"} in this path
                      </strong>
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

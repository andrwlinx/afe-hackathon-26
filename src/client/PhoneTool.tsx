import {
  ArrowRight,
  Network,
  Pencil,
  User,
  Volume2
} from "lucide-react";
import { AtoZHeader, AzBanner } from "./AtoZHeader.js";

/**
 * Mock recreation of the A-to-Z Phone Tool profile page, used as the demo
 * entry point: the RampPath card below shows how RampPath would surface as
 * an embedded Phone Tool integration. All data on this page is static.
 */

const orgChart = [
  { initials: "CR", name: "Casey Reed", alias: "caseyr", title: "Senior Manager, Software Development, L7", meta: "Direct reports: 24", level: 0 },
  { initials: "ML", name: "Morgan Lee", alias: "morganl", title: "Software Development Manager, L6", meta: "Direct reports: 6", level: 1 },
  { initials: "AK", name: "Alex Kim", alias: "alexkim", title: "Senior SDE, L6", meta: "6 years at Amazon", level: 2 },
  { initials: "SP", name: "Sam Patel", alias: "spatel", title: "SDE II, L5", meta: "3 years at Amazon", level: 2 },
  { initials: "DW", name: "Dana Wolfe", alias: "dwolfe", title: "SDE II, L5", meta: "2 years at Amazon", level: 2 },
  { initials: "TB", name: "Taylor Brooks", alias: "tbrooks", title: "SDE I, L4", meta: "1 year at Amazon", level: 2 },
  { initials: "JD", name: "Jane Doe", alias: "jdoe", title: "AFE SDE Intern, L4", meta: "2 months at Amazon", level: 2, self: true }
];

export function PhoneToolPage() {
  return (
    <div className="pt-page">
      <AtoZHeader active="phonetool" />

      <AzBanner cta={{ label: "Ask RampPath", href: "/ramppath" }}>
        Need answers to ownership queries? Ask RampPath &ldquo;Who owns
        AtlasRegionContext?&rdquo; or &ldquo;Who owns metrics?&rdquo;
      </AzBanner>

      <main className="pt-content">
        <section className="pt-hero">
          <div className="pt-badge" aria-hidden="true">
            <span className="pt-badge-top">Jane</span>
            <span className="pt-badge-photo">
              <img src="/profile-jane.jpeg" alt="" />
            </span>
            <span className="pt-badge-alias">jdoe@</span>
          </div>
          <div className="pt-hero-info">
            <h2>Jane Doe</h2>
            <p className="pt-title-line">AFE SDE Intern, L4</p>
            <p className="pt-title-line">Atlas Experience (7421)</p>
            <dl>
              <div>
                <dt>Message:</dt>
                <dd>
                  Not added <Pencil size={13} />
                </dd>
              </div>
              <div>
                <dt>Pronunciation:</dt>
                <dd>
                  <Volume2 size={14} />
                </dd>
              </div>
              <div>
                <dt>Total tenure:</dt>
                <dd>2 months, 3 days</dd>
              </div>
            </dl>
            <div className="pt-hero-actions">
              <button type="button" className="pt-button-primary">
                <Pencil size={14} />
                Edit my information
              </button>
              <button type="button" className="pt-button-secondary">
                <User size={14} />
                My profile
              </button>
            </div>
          </div>
          <aside className="pt-contact-card">
            <p>
              <strong>@</strong> jdoe
            </p>
            <p>
              <strong>✉</strong> jdoe@example.com
            </p>
            <p>
              <strong>⌖</strong> SEA000 (Seattle, WA, US)
            </p>
            <p>
              <strong>⏱</strong> 8:37 AM (PDT)
            </p>
          </aside>
        </section>

        <div className="pt-grid">
          <section className="pt-card">
            <h3>Org chart</h3>
            <ul className="pt-org-list">
              {orgChart.map((person) => (
                <li
                  key={person.alias}
                  className={person.self ? "pt-org-self" : ""}
                  style={{ marginLeft: person.level * 22 }}
                >
                  <span
                    className="pt-org-expand"
                    aria-hidden="true"
                    style={
                      person.meta.startsWith("Direct reports")
                        ? undefined
                        : { visibility: "hidden" }
                    }
                  >
                    −
                  </span>
                  <span className="pt-org-avatar" aria-hidden="true">
                    {person.self ? (
                      <img src="/profile-jane.jpeg" alt="" />
                    ) : (
                      person.initials
                    )}
                  </span>
                  <span>
                    <a href="/">{person.name}</a>{" "}
                    <span className="pt-org-alias">{person.alias}@</span>
                    <small>{person.title}</small>
                    <small className="pt-org-meta">{person.meta}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <a className="pt-card pt-ramppath-card" href="/ramppath">
            <div className="pt-ramppath-head">
              <span className="pt-ramppath-mark">
                <Network size={20} />
              </span>
              <h3>RampPath</h3>
            </div>
            <p>
              Who owns what? Ask in plain English — "who owns
              AtlasRegionContext?" — and trace verified ownership, access,
              and deployment paths across packages, pipelines, bindles, and
              AWS accounts.
            </p>
            <span className="pt-ramppath-cta">
              Open RampPath
              <ArrowRight size={15} />
            </span>
          </a>

          <section className="pt-card">
            <h3>Work bio</h3>
            <p className="pt-muted">
              Add your work bio to share more about what you do.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

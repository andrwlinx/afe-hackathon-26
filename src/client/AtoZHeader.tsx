import {
  Bell,
  ChevronDown,
  CircleHelp,
  Menu,
  Network,
  Phone,
  Search,
  Sparkles
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared "amazon a to z" chrome: top bar with logo, search, help/alerts,
 * profile, and the Phone Tool subnav. Used by both the mock Phone Tool
 * page (/) and Path (/path) so Path reads as a native
 * A-to-Z tool.
 */
export function AtoZHeader({
  active,
  status
}: {
  active: "phonetool" | "path";
  status?: ReactNode;
}) {
  return (
    <>
      <header className="az-topbar">
        <div className="az-topbar-side">
          <button type="button" className="pt-icon-button" aria-label="Menu">
            <Menu size={20} />
          </button>
          <span className="az-logo">
            amazon <em>a to z</em>
          </span>
        </div>
        <div className="az-search" role="search">
          <span className="az-search-topic">
            <Search size={15} />
            Topic: People
            <ChevronDown size={13} />
          </span>
          <input placeholder="Enter a name, alias, title, country, etc." />
        </div>
        <div className="az-topbar-side az-topbar-right">
          <span className="az-help">
            <CircleHelp size={18} />
            Help
            <ChevronDown size={13} />
          </span>
          <button
            type="button"
            className="pt-icon-button"
            aria-label="Notifications"
          >
            <Bell size={19} />
          </button>
          <span className="pt-avatar" aria-label="Your profile">
            <img src="/profile-jane.jpeg" alt="Jane Doe" />
          </span>
          <ChevronDown size={14} className="az-avatar-chevron" />
        </div>
      </header>

      <nav className="az-subnav" aria-label="Phone Tool sections">
        <div className="az-subnav-left">
          <a
            className={`az-tool-title ${active === "phonetool" ? "active" : ""}`}
            href="/"
          >
            <Phone size={15} />
            The <span>Phone Tool</span>
          </a>
          <a
            className={`az-tab brand ${active === "path" ? "active" : ""}`}
            href="/path"
          >
            <span className="brand-mark">
              <Network size={14} strokeWidth={2.3} />
            </span>
            <strong>Path</strong>
          </a>
          <a className="az-tab az-tab-extra" href="/">
            My Bookmarks
          </a>
          <a className="az-tab az-tab-extra" href="/">
            Awards
          </a>
          <a className="az-tab az-tab-extra" href="/">
            Communities
          </a>
        </div>
        <div className="az-subnav-right">
          {status ?? (
            <>
              <a href="/">Get Phone Tool Mobile for iOS/Android</a>
              <a className="az-resolve" href="/">
                Resolve an issue
              </a>
            </>
          )}
        </div>
      </nav>
    </>
  );
}

/** Light blue assistant hint strip with the purple ask button. */
export function AzBanner({
  children,
  cta
}: {
  children: ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="pt-banner az-banner">
      <span className="az-banner-copy">{children}</span>
      {cta ? (
        <a className="az-aza-button" href={cta.href}>
          <Sparkles size={14} />
          {cta.label}
        </a>
      ) : null}
    </div>
  );
}

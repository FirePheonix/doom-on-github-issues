import { useEffect, useMemo, useState } from "react";

const weeks = [
  {
    id: "index",
    label: "Index",
    title: "Doom on GitHub Issues - Weekly Documentation Index",
    date: "Updated: 18 Jul 2026",
    summary:
      "This docs set follows the NUMFocus-style weekly structure. Each week tracks one release phase from V1 to V4.",
    body: [
      {
        heading: "Project",
        paragraphs: [
          "One GitHub issue is one Doom session. Comments are parsed as command batches. The issue body is continuously patched to show the latest frame.",
          "The docs are grouped as weekly updates so the evolution of architecture and runtime is easy to follow from first release to current low-latency design.",
        ],
      },
      {
        heading: "Weekly Index",
        list: [
          "Week 1: V1 foundation, server and rendering basics.",
          "Week 2: V2 runtime and webhook flow hardening.",
          "Week 3: V2.5 session manager migration.",
          "Week 4: V3 persistence and operational split.",
          "Week 5: V3.5 startup-latency fast path.",
          "Week 6: V4 persistent DoomGeneric and caching path.",
        ],
      },
    ],
  },
  {
    id: "week-1",
    label: "Week 1",
    title: "Week 1 - V1 Foundation, Server Flow, and First Runtime Contracts",
    date: "V1 Release Track",
    summary:
      "Initial documentation pass for server, webhook, rendering, deployment, and storage contracts.",
    body: [
      {
        heading: "What landed",
        list: [
          "Webhook handling and issue update loop were documented as the core control path.",
          "Rendering pipeline boundaries were defined for request handling versus frame production.",
          "Initial deployment and environment variable expectations were made explicit.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [{ label: "V1 release notes", href: "./v1-release-notes/README.md" }],
      },
    ],
  },
  {
    id: "week-2",
    label: "Week 2",
    title: "Week 2 - V2 Runtime Refinement and Webhook Pipeline Cleanup",
    date: "V2 Release Track",
    summary:
      "Shifted toward cleaner continuous runtime behavior and clearer webhook-to-render sequencing.",
    body: [
      {
        heading: "Changes",
        list: [
          "Runtime responsibilities were separated more clearly from request ingestion.",
          "Webhook flow documentation was tightened around enqueue-and-return behavior.",
          "Migration notes captured how to move from V1 assumptions to V2 behavior.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [{ label: "V2 release notes", href: "./v2-release-notes/README.md" }],
      },
    ],
  },
  {
    id: "week-3",
    label: "Week 3",
    title: "Week 3 - V2.5 Session Manager Introduction",
    date: "V2.5 Release Track",
    summary:
      "Introduced session-manager centric lifecycle handling to reduce ad hoc session orchestration.",
    body: [
      {
        heading: "Changes",
        list: [
          "Session manager layer became the canonical place for lifecycle transitions.",
          "Migration guidance focused on moving existing flow into manager-based orchestration.",
          "System docs were updated to reflect the new control boundaries.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [{ label: "V2.5 release notes", href: "./v2.5-release-notes/README.md" }],
      },
    ],
  },
  {
    id: "week-4",
    label: "Week 4",
    title: "Week 4 - V3 Persistence Hardening and Recovery Direction",
    date: "V3 Release Track",
    summary:
      "Operational state moved to stronger persistence contracts, with recovery paths documented for realism.",
    body: [
      {
        heading: "Changes",
        list: [
          "Session snapshot and event persistence strategy was clarified.",
          "Operational concerns were split across explicit persistence surfaces.",
          "Recovery and deployment notes aligned with production-like runtime conditions.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [{ label: "V3 release notes", href: "./v3-release-notes/README.md" }],
      },
    ],
  },
  {
    id: "week-5",
    label: "Week 5",
    title: "Week 5 - V3.5 Startup-Latency Fast Path",
    date: "V3.5 Release Track",
    summary:
      "Boot-frame caching was added so issue-open experience becomes immediate while live runtime warms up.",
    body: [
      {
        heading: "Changes",
        list: [
          "First visible frame now has a cache-first fast path.",
          "Startup behavior was split between user-visible and background warmup work.",
          "System documentation focused on latency expectations and fallback behavior.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [{ label: "V3.5 release notes", href: "./v3.5-release-notes/README.md" }],
      },
    ],
  },
  {
    id: "week-6",
    label: "Week 6",
    title: "Week 6 - V4 Persistent DoomGeneric, Caching, and Low-Latency Path",
    date: "V4 Release Track (Current)",
    summary:
      "Current release path prioritizes persistent engine state, deterministic caching, and one-comment/one-frame responsiveness.",
    body: [
      {
        heading: "Changes",
        list: [
          "Persistent DoomGeneric worker keeps state in memory for suffix-only updates.",
          "Menu and startup cache paths resolve known states without replaying full history.",
          "Background sync now coalesces toward latest target instead of draining stale work.",
          "Hot path stabilized around parse, render/cache-hit, publish, and issue patch.",
        ],
      },
      {
        heading: "Read the source notes",
        links: [
          { label: "V4 release notes", href: "./v4-release-notes/README.md" },
          { label: "V4 architecture", href: "./v4-release-notes/architecture.md" },
          { label: "V4 operations", href: "./v4-release-notes/operations.md" },
        ],
      },
    ],
  },
];

const weekMap = new Map(weeks.map((week) => [week.id, week]));

function getInitialWeekId() {
  const hash = window.location.hash.replace(/^#/, "");
  if (weekMap.has(hash)) {
    return hash;
  }
  return "index";
}

export default function App() {
  const [activeWeekId, setActiveWeekId] = useState(getInitialWeekId);
  const activeWeek = useMemo(
    () => weekMap.get(activeWeekId) ?? weekMap.get("index"),
    [activeWeekId],
  );

  useEffect(() => {
    const onHashChange = () => {
      const nextId = getInitialWeekId();
      setActiveWeekId(nextId);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const onSelectWeek = (id) => {
    setActiveWeekId(id);
    window.location.hash = id;
  };

  return (
    <div className="docs-root">
      <div className="guide-line guide-line--left" aria-hidden="true" />
      <div className="guide-line guide-line--right" aria-hidden="true" />

      <main className="page">
        <section className="banner" aria-hidden="true">
          <div className="banner__mesh" />
        </section>

        <header className="profile">
          <div className="profile__avatar">DO</div>
          <div className="profile__content">
            <p className="eyebrow">Doom on GitHub Issues</p>
            <h1>NUMFocus-style weekly docs with portfolio blueprint design.</h1>
            <p className="lede">
              React 19 documentation shell with week-based navigation and release evolution tracking.
            </p>
          </div>
        </header>

        <div className="shell">
          <aside className="sidebar" aria-label="Weekly index">
            <div className="sidebar__inner">
              <p className="sidebar__label">Index</p>
              <h2>Weekly Log</h2>
              <nav className="sidebar__nav">
                {weeks.map((week) => (
                  <button
                    key={week.id}
                    type="button"
                    className={`week-link${activeWeekId === week.id ? " is-active" : ""}`}
                    onClick={() => onSelectWeek(week.id)}
                  >
                    <span className="week-link__label">{week.label}</span>
                    <span className="week-link__title">{week.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <section className="article">
            <article className="article__card">
              <p className="article__date">{activeWeek.date}</p>
              <h2 className="article__title">{activeWeek.title}</h2>
              <p className="article__summary">{activeWeek.summary}</p>

              <div className="article__body">
                {activeWeek.body.map((section) => (
                  <section key={section.heading} className="entry">
                    <h3>{section.heading}</h3>

                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}

                    {section.list ? (
                      <ul>
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}

                    {section.links ? (
                      <div className="entry__links">
                        {section.links.map((link) => (
                          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                            {link.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

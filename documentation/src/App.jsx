import React, { useMemo, useState } from "react";

const versions = [
  {
    id: "v4",
    label: "V4",
    title: "V4 - Persistent Runtime and Low Latency",
    subtitle: "Current release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: [
          "V4 focuses on making the comment-to-frame loop fast and stable under continuous usage.",
          "The runtime keeps state warm, applies only the newest command suffix, and updates the issue body with deterministic frame publishing.",
        ],
      },
      changes: {
        title: "Changes",
        list: [
          "Persistent DoomGeneric worker path for stateful in-memory progression.",
          "Menu/startup cache path for instant known states.",
          "Background sync coalescing to latest target instead of stale queue drain.",
          "Clear hot path: parse -> render/cache-hit -> publish -> patch issue body.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Lower median response for incremental command comments.",
          "Less replay dependency when persistent worker is healthy.",
          "More predictable artifact publishing behavior.",
        ],
      },
      architecture: {
        title: "Architecture",
        list: [
          "GitHub webhook receives issue/comment events and returns fast after enqueue.",
          "Per-issue queue lock ensures command application is serialized for one session.",
          "Lifecycle layer parses comment commands and computes target state.",
          "Artifact layer selects cache-hit, persistent-step render, or replay fallback path.",
          "Issue body patch updates latest frame URL after publish completes.",
        ],
      },
      operations: {
        title: "Operations",
        list: [
          "Run with `DOOM_ENGINE=doomgeneric` for persistent worker behavior.",
          "Keep frame store on S3 for shared deterministic cache artifacts.",
          "Track render, publish, patch, and total job time metrics for bottleneck analysis.",
          "Use warmup/background sync to keep live state near newest visible history.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V4 shifted the project from replay-heavy behavior to a persistent, cache-assisted runtime where repeated interaction remains responsive as issue history grows.",
        ],
        list: [
          "Faster steady-state comments.",
          "Cleaner separation between fast path and fallback path.",
          "Operational model aligned for continuous usage.",
        ],
      },
    },
  },
  {
    id: "v35",
    label: "V3.5",
    title: "V3.5 - Startup Fast Path",
    subtitle: "Latency-focused release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: [
          "V3.5 introduced fast startup behavior so issue-open displays become immediate.",
        ],
      },
      changes: {
        title: "Changes",
        list: [
          "Cached boot/menu frame handling.",
          "Faster first visible frame while runtime warms in background.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Improved initial responsiveness for new sessions.",
          "Clear fallback boundary when warm worker path is unavailable.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V3.5 was a focused latency release that improved first-frame experience without changing the broader session model.",
        ],
      },
    },
  },
  {
    id: "v3",
    label: "V3",
    title: "V3 - Persistence and Recovery Direction",
    subtitle: "State model release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: ["V3 centered on stronger persistence boundaries and recoverable session behavior."],
      },
      changes: {
        title: "Changes",
        list: [
          "Session snapshot and operational data split by concern.",
          "Recovery workflows documented for real-world operation.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Better data durability model.",
          "Clearer separation between runtime state and operations state.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V3 established durable session state design so later runtime features could evolve without losing recoverability.",
        ],
      },
    },
  },
  {
    id: "v25",
    label: "V2.5",
    title: "V2.5 - Session Manager Migration",
    subtitle: "Lifecycle release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: ["V2.5 introduced session-manager-based orchestration for lifecycle transitions."],
      },
      changes: {
        title: "Changes",
        list: [
          "Manager-centric session lifecycle flow.",
          "Migration docs for previous runtime behavior.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Reduced ad hoc session handling paths.",
          "Cleaner operational model for session state updates.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V2.5 reduced lifecycle complexity by consolidating behavior in a dedicated session manager layer.",
        ],
      },
    },
  },
  {
    id: "v2",
    label: "V2",
    title: "V2 - Runtime Flow Cleanup",
    subtitle: "Pipeline release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: ["V2 clarified the webhook enqueue path and runtime responsibilities."],
      },
      changes: {
        title: "Changes",
        list: [
          "Cleaner webhook-to-render sequencing.",
          "Runtime behavior documented with stronger boundaries.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Improved maintainability of request ingestion pipeline.",
          "Reduced synchronous coupling in webhook handler path.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V2 cleaned up pipeline boundaries so rendering work no longer looked like synchronous webhook processing.",
        ],
      },
    },
  },
  {
    id: "v1",
    label: "V1",
    title: "V1 - Foundation",
    subtitle: "Initial release",
    sections: {
      overview: {
        title: "Overview",
        paragraphs: ["V1 established the initial server, webhook, rendering, and deployment contracts."],
      },
      changes: {
        title: "Changes",
        list: [
          "Base issue-driven gameplay loop.",
          "Initial docs for system components and deployment.",
        ],
      },
      notes: {
        title: "Release Note Points",
        list: [
          "Bootstrapped architecture and first operational model.",
          "Created baseline for subsequent runtime and latency improvements.",
        ],
      },
      release: {
        title: "Release Summary",
        paragraphs: [
          "V1 defined the baseline behavior and interfaces that all subsequent releases optimized.",
        ],
      },
    },
  },
];

const sectionOrder = ["overview", "changes", "notes", "architecture", "operations", "release"];

export default function App() {
  const [versionId, setVersionId] = useState("v4");
  const [sectionId, setSectionId] = useState("overview");

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === versionId) ?? versions[0],
    [versionId],
  );
  const activeSectionOrder = sectionOrder.filter((id) => activeVersion.sections[id]);
  const activeSection = activeVersion.sections[sectionId] ?? activeVersion.sections.overview;

  const onVersionChange = (event) => {
    setVersionId(event.target.value);
    setSectionId("overview");
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
            <h1>Documentation</h1>
            <p className="lede">Release notes, architecture decisions, and runtime changes.</p>
          </div>
        </header>

        <div className="shell">
          <aside className="sidebar" aria-label="Release index">
            <div className="sidebar__inner">
              <p className="sidebar__label">Version</p>
              <select className="version-select" value={versionId} onChange={onVersionChange}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>

              <p className="sidebar__label sidebar__label--section">Sections</p>
              <nav className="sidebar__nav">
                {activeSectionOrder.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`week-link${sectionId === id ? " is-active" : ""}`}
                    onClick={() => setSectionId(id)}
                  >
                    <span className="week-link__title">{activeVersion.sections[id].title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <section className="article">
            <article className="article__card">
              <p className="article__date">{activeVersion.subtitle}</p>
              <h2 className="article__title">{activeVersion.title}</h2>

              <div className="article__body">
                <section className="entry">
                  <h3>{activeSection.title}</h3>

                  {activeSection.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}

                  {activeSection.list ? (
                    <ul>
                      {activeSection.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

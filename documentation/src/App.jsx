import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import v1Readme from "../v1-release-notes/README.md?raw";
import v1Blog from "../v1-release-notes/blog.md?raw";
import v1Components from "../v1-release-notes/components.md?raw";
import v1Deployment from "../v1-release-notes/deployment.md?raw";
import v1Rendering from "../v1-release-notes/rendering.md?raw";
import v1Server from "../v1-release-notes/server.md?raw";
import v1Sessions from "../v1-release-notes/sessions.md?raw";
import v1Storage from "../v1-release-notes/storage.md?raw";
import v1System from "../v1-release-notes/system.md?raw";
import v1Webhook from "../v1-release-notes/webhook.md?raw";

import v2Readme from "../v2-release-notes/README.md?raw";
import v2Migration from "../v2-release-notes/migration.md?raw";
import v2Runtime from "../v2-release-notes/runtime.md?raw";
import v2System from "../v2-release-notes/system.md?raw";
import v2WebhookFlow from "../v2-release-notes/webhook-flow.md?raw";

import v25Readme from "../v2.5-release-notes/README.md?raw";
import v25Migration from "../v2.5-release-notes/migration.md?raw";
import v25SessionManager from "../v2.5-release-notes/session-manager.md?raw";
import v25System from "../v2.5-release-notes/system.md?raw";

import v3Readme from "../v3-release-notes/README.md?raw";
import v3Deployment from "../v3-release-notes/deployment.md?raw";
import v3Operations from "../v3-release-notes/operations.md?raw";
import v3Persistence from "../v3-release-notes/persistence.md?raw";
import v3Recovery from "../v3-release-notes/recovery.md?raw";
import v3Sequences from "../v3-release-notes/sequences.md?raw";
import v3System from "../v3-release-notes/system.md?raw";

import v35Readme from "../v3.5-release-notes/README.md?raw";
import v35StartupLatency from "../v3.5-release-notes/startup-latency.md?raw";
import v35System from "../v3.5-release-notes/system.md?raw";

import v4Readme from "../v4-release-notes/README.md?raw";
import v4Architecture from "../v4-release-notes/architecture.md?raw";
import v4Latency from "../v4-release-notes/latency-and-caching.md?raw";
import v4Operations from "../v4-release-notes/operations.md?raw";
import v4Persistent from "../v4-release-notes/persistent-doomgeneric.md?raw";
import v4Release from "../v4-release-notes/release.md?raw";
import v4Sequences from "../v4-release-notes/sequences.md?raw";

const releases = [
  {
    id: "v4",
    label: "V4",
    title: "V4 - Persistent Runtime and Low Latency",
    subtitle: "Current release",
    docs: [
      { id: "readme", label: "Overview", content: v4Readme },
      { id: "release", label: "Release", content: v4Release },
      { id: "architecture", label: "Architecture", content: v4Architecture },
      { id: "sequences", label: "Sequences", content: v4Sequences },
      { id: "persistent", label: "Persistent DoomGeneric", content: v4Persistent },
      { id: "latency", label: "Latency and Caching", content: v4Latency },
      { id: "operations", label: "Operations", content: v4Operations },
    ],
  },
  {
    id: "v35",
    label: "V3.5",
    title: "V3.5 - Startup Fast Path",
    subtitle: "Latency-focused release",
    docs: [
      { id: "readme", label: "Overview", content: v35Readme },
      { id: "system", label: "System", content: v35System },
      { id: "startup-latency", label: "Startup Latency", content: v35StartupLatency },
    ],
  },
  {
    id: "v3",
    label: "V3",
    title: "V3 - Persistence and Recovery Direction",
    subtitle: "State model release",
    docs: [
      { id: "readme", label: "Overview", content: v3Readme },
      { id: "system", label: "System", content: v3System },
      { id: "sequences", label: "Sequences", content: v3Sequences },
      { id: "persistence", label: "Persistence", content: v3Persistence },
      { id: "recovery", label: "Recovery", content: v3Recovery },
      { id: "operations", label: "Operations", content: v3Operations },
      { id: "deployment", label: "Deployment", content: v3Deployment },
    ],
  },
  {
    id: "v25",
    label: "V2.5",
    title: "V2.5 - Session Manager Migration",
    subtitle: "Lifecycle release",
    docs: [
      { id: "readme", label: "Overview", content: v25Readme },
      { id: "system", label: "System", content: v25System },
      { id: "session-manager", label: "Session Manager", content: v25SessionManager },
      { id: "migration", label: "Migration", content: v25Migration },
    ],
  },
  {
    id: "v2",
    label: "V2",
    title: "V2 - Runtime Flow Cleanup",
    subtitle: "Pipeline release",
    docs: [
      { id: "readme", label: "Overview", content: v2Readme },
      { id: "system", label: "System", content: v2System },
      { id: "runtime", label: "Runtime", content: v2Runtime },
      { id: "webhook-flow", label: "Webhook Flow", content: v2WebhookFlow },
      { id: "migration", label: "Migration", content: v2Migration },
    ],
  },
  {
    id: "v1",
    label: "V1",
    title: "V1 - Foundation",
    subtitle: "Initial release",
    docs: [
      { id: "readme", label: "Overview", content: v1Readme },
      { id: "system", label: "System", content: v1System },
      { id: "server", label: "Server", content: v1Server },
      { id: "webhook", label: "Webhook", content: v1Webhook },
      { id: "rendering", label: "Rendering", content: v1Rendering },
      { id: "storage", label: "Storage", content: v1Storage },
      { id: "sessions", label: "Sessions", content: v1Sessions },
      { id: "components", label: "Components", content: v1Components },
      { id: "deployment", label: "Deployment", content: v1Deployment },
      { id: "blog", label: "Blog", content: v1Blog },
    ],
  },
];

export default function App() {
  const [versionId, setVersionId] = useState("v4");
  const [docId, setDocId] = useState("readme");

  const activeRelease = useMemo(
    () => releases.find((release) => release.id === versionId) ?? releases[0],
    [versionId],
  );

  const activeDoc = useMemo(
    () => activeRelease.docs.find((doc) => doc.id === docId) ?? activeRelease.docs[0],
    [activeRelease, docId],
  );

  const onVersionChange = (event) => {
    const nextVersionId = event.target.value;
    const nextRelease = releases.find((release) => release.id === nextVersionId) ?? releases[0];
    setVersionId(nextVersionId);
    setDocId(nextRelease.docs[0].id);
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
            <p className="lede">Full release markdown rendered in-app.</p>
          </div>
        </header>

        <div className="shell">
          <aside className="sidebar" aria-label="Release index">
            <div className="sidebar__inner">
              <p className="sidebar__label">Version</p>
              <select className="version-select" value={versionId} onChange={onVersionChange}>
                {releases.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.label}
                  </option>
                ))}
              </select>

              <p className="sidebar__label sidebar__label--section">Document</p>
              <select
                className="version-select"
                value={activeDoc.id}
                onChange={(event) => setDocId(event.target.value)}
              >
                {activeRelease.docs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.label}
                  </option>
                ))}
              </select>

              <p className="sidebar__label sidebar__label--section">Quick Sections</p>
              <nav className="sidebar__nav">
                {activeRelease.docs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`week-link${activeDoc.id === doc.id ? " is-active" : ""}`}
                    onClick={() => setDocId(doc.id)}
                  >
                    <span className="week-link__title">{doc.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <section className="article">
            <article className="article__card">
              <p className="article__date">{activeRelease.subtitle}</p>
              <h2 className="article__title">{activeRelease.title}</h2>

              <div className="article__body">
                <section className="entry markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeDoc.content}</ReactMarkdown>
                </section>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

const fromId = (id) => document.getElementById(id);

const docs = [
  { id: "home", title: "Documentation Home", path: "./README.md", group: "Current release", summary: "Overview and release index." },
  { id: "deploy", title: "Deploying on Vercel", path: "./deploy.md", group: "Current release", summary: "How to host the docs site on Vercel." },
  { id: "v4-readme", title: "V4 Release Notes", path: "./v4-release-notes/README.md", group: "Current release", summary: "Current release summary." },
  { id: "v4-architecture", title: "V4 Architecture", path: "./v4-release-notes/architecture.md", group: "Current release", summary: "System overview and responsibilities." },
  { id: "v4-release", title: "V4 Release Summary", path: "./v4-release-notes/release.md", group: "Current release", summary: "What changed in V4." },
  { id: "v4-sequences", title: "V4 Sequences", path: "./v4-release-notes/sequences.md", group: "Current release", summary: "Request/response flows." },
  { id: "v4-persistent", title: "Persistent DoomGeneric", path: "./v4-release-notes/persistent-doomgeneric.md", group: "Current release", summary: "Persistent worker design." },
  { id: "v4-latency", title: "Latency and Caching", path: "./v4-release-notes/latency-and-caching.md", group: "Current release", summary: "Startup and publish latency." },
  { id: "v4-operations", title: "Operations", path: "./v4-release-notes/operations.md", group: "Current release", summary: "Operational runbook." },
  { id: "v35-readme", title: "V3.5 Release Notes", path: "./v3.5-release-notes/README.md", group: "Archive", summary: "Startup latency release." },
  { id: "v3-readme", title: "V3 Release Notes", path: "./v3-release-notes/README.md", group: "Archive", summary: "Persistence and recovery release." },
  { id: "v25-readme", title: "V2.5 Release Notes", path: "./v2.5-release-notes/README.md", group: "Archive", summary: "Session manager migration." },
  { id: "v2-readme", title: "V2 Release Notes", path: "./v2-release-notes/README.md", group: "Archive", summary: "Runtime and webhook updates." },
  { id: "v1-readme", title: "V1 Release Notes", path: "./v1-release-notes/README.md", group: "Archive", summary: "Initial docs and components." }
];

const docsById = new Map(docs.map((doc) => [doc.id, doc]));
const docsByPath = new Map(docs.map((doc) => [normalizePath(doc.path), doc]));

const archiveCheckbox = fromId("archive_checkbox");
const archiveContainer = fromId("archive_container");
const currentReleaseLinks = fromId("current_release_links");
const archiveLinks = fromId("archive_links");
const docViewer = fromId("doc_viewer");
const docTitle = fromId("doc_title");
const docPath = fromId("doc_path");
const playButton = fromId("play_button");

let activeDocId = null;

function normalizePath(path) {
  return path.replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function resolveSitePath(path) {
  const current = new URL(window.location.href);
  const baseHref = current.pathname.endsWith("/") ? current.href : `${current.href}/`;
  return new URL(path, baseHref).toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function resolveRelativePath(basePath, targetPath) {
  const baseDir = dirname(basePath);
  const segments = baseDir ? baseDir.split("/") : [];

  for (const segment of targetPath.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function resolveLinkTarget(url, basePath) {
  const cleaned = url.trim();
  if (/^(https?:)?\/\//i.test(cleaned) || cleaned.startsWith("mailto:")) {
    return { href: cleaned, external: true };
  }

  const pathOnly = cleaned.split("#")[0].split("?")[0];
  const normalized = normalizePath(pathOnly.startsWith("/") ? pathOnly : resolveRelativePath(basePath, pathOnly));
  const mapped = docsByPath.get(normalized);
  if (mapped) {
    return { href: `#doc=${encodeURIComponent(mapped.id)}`, external: false };
  }

  return { href: cleaned, external: false };
}

function renderInline(text, basePath) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const target = resolveLinkTarget(url, basePath);
    const attrs = target.external ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${escapeHtml(target.href)}"${attrs}>${label}</a>`;
  });

  return linked
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function flushBlock(state, output, basePath) {
  if (state.paragraph.length) {
    output.push(`<p>${renderInline(state.paragraph.join(" "), basePath)}</p>`);
    state.paragraph = [];
  }

  if (state.list) {
    const items = state.list.items.map((item) => `<li>${renderInline(item, basePath)}</li>`).join("");
    output.push(`<${state.list.type}>${items}</${state.list.type}>`);
    state.list = null;
  }

  if (state.quote.length) {
    const quote = state.quote.map((line) => renderInline(line, basePath)).join("<br>");
    output.push(`<blockquote><p>${quote}</p></blockquote>`);
    state.quote = [];
  }
}

function pushListLine(state, line) {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
  if (!match) {
    return false;
  }

  const listType = /^\d+\.$/.test(match[2]) ? "ol" : "ul";
  if (!state.list || state.list.type !== listType) {
    return false;
  }

  state.list.items.push(match[3].trim());
  return true;
}

function renderMarkdown(markdown, basePath) {
  const output = [];
  const state = {
    paragraph: [],
    list: null,
    quote: [],
    code: null
  };

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (state.code) {
      if (line.startsWith("```")) {
        output.push(`<pre><code${state.code.lang ? ` class="language-${escapeHtml(state.code.lang)}"` : ""}>${escapeHtml(state.code.lines.join("\n"))}</code></pre>`);
        state.code = null;
      } else {
        state.code.lines.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushBlock(state, output);
      state.code = { lang: line.slice(3).trim(), lines: [] };
      continue;
    }

    if (!line.trim()) {
      flushBlock(state, output);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushBlock(state, output, basePath);
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2], basePath)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushBlock(state, output, basePath);
      output.push("<hr>");
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushBlock(state, output, basePath);
      state.quote.push(line.replace(/^>\s?/, "").trim());
      continue;
    }

    if (pushListLine(state, line)) {
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (listMatch) {
      flushBlock(state, output, basePath);
      state.list = {
        type: "ul",
        items: [listMatch[3].trim()]
      };
      continue;
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushBlock(state, output, basePath);
      state.list = {
        type: "ol",
        items: [orderedMatch[2].trim()]
      };
      continue;
    }

    state.paragraph.push(line.trim());
  }

  flushBlock(state, output, basePath);
  if (state.code) {
    output.push(`<pre><code${state.code.lang ? ` class="language-${escapeHtml(state.code.lang)}"` : ""}>${escapeHtml(state.code.lines.join("\n"))}</code></pre>`);
  }

  return output.join("\n");
}

function setActiveDocButton() {
  document.querySelectorAll(".doc_button").forEach((button) => {
    button.classList.toggle("active", button.dataset.docId === activeDocId);
  });
}

function buildDocButton(doc) {
  const button = document.createElement("a");
  button.className = "doc_button";
  button.href = `#doc=${encodeURIComponent(doc.id)}`;
  button.dataset.docId = doc.id;
  button.textContent = doc.title;
  button.title = doc.summary;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    selectDoc(doc.id, true);
  });
  return button;
}

function renderDocLists() {
  const current = docs.filter((doc) => doc.group === "Current release");
  const archive = docs.filter((doc) => doc.group === "Archive");

  currentReleaseLinks.replaceChildren(...current.map(buildDocButton));
  archiveLinks.replaceChildren(...archive.map(buildDocButton));
}

async function loadDoc(doc) {
  docTitle.textContent = doc.title;
  docPath.textContent = doc.path;
  docViewer.innerHTML = "<p class=\"loading\">Loading document...</p>";

  const response = await fetch(resolveSitePath(doc.path));
  if (!response.ok) {
    throw new Error(`Unable to load ${doc.path} (${response.status})`);
  }

  const markdown = await response.text();
  docViewer.innerHTML = renderMarkdown(markdown, doc.path);
  setActiveDocButton();
}

function readDocIdFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("doc") || "home";
}

async function selectDoc(docId, updateHash) {
  const doc = docsById.get(docId) || docsById.get("home");
  if (!doc) {
    return;
  }

  activeDocId = doc.id;
  if (updateHash) {
    window.location.hash = `doc=${encodeURIComponent(doc.id)}`;
  }

  try {
    await loadDoc(doc);
  } catch (error) {
    docTitle.textContent = "Load error";
    docPath.textContent = doc.path;
    docViewer.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    setActiveDocButton();
  }
}

archiveCheckbox.addEventListener("change", () => {
  archiveContainer.style.display = archiveCheckbox.checked ? "flex" : "none";
});

playButton.addEventListener("click", (event) => {
  event.preventDefault();
  selectDoc("home", true);
});

window.addEventListener("hashchange", () => {
  const docId = readDocIdFromHash();
  if (docId !== activeDocId) {
    selectDoc(docId, false);
  }
});

renderDocLists();
archiveContainer.style.display = archiveCheckbox.checked ? "flex" : "none";
selectDoc(readDocIdFromHash(), false);

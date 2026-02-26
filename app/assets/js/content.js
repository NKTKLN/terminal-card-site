/* -----------------------------------------------------------
   Content module
   - Static content + small render helpers for data-driven output.
------------------------------------------------------------ */

/** Canonical command names (used for autocomplete + help). */
export const COMMANDS = [
  "help", "about", "projects", "contact", "clear",
  // "terminal-ish" commands (minimal + useful)
  "ls", "cat", "open", "github", "whoami", "echo"
];

/** Short aliases for convenience. */
export const ALIASES = {
  h: "help",
  a: "about",
  p: "projects",
  c: "contact",
  gh: "github",
};

/** Virtual file system (very small, not a toy). */
export const VFS = {
  "/": ["README.md", "projects.json", "contact.txt"],
  "/README.md": [
    "NKTKLN — ML / Python Engineer",
    "",
    "Try:",
    "  help",
    "  ls",
    "  cat README.md",
    "  projects",
    "  open github",
  ].join("\n"),

  // projects.json is "virtual": we render from PROJECTS array,
  // but cat projects.json returns a pretty JSON snapshot.
  "/contact.txt": [
    "Telegram: https://t.me/NKTKLN",
    "Email: mailto:nktkln@nktkln.com",
  ].join("\n"),
};

/** Projects data: edit here. */
export const PROJECTS = [
  {
    name: "project-1",
    description: "Short description of what it does (ML / infra / tooling).",
    url: "https://github.com/NKTKLN",
  },
  {
    name: "project-2",
    description: "Another project — add metrics/stack to make it concrete.",
    url: "https://github.com/NKTKLN",
  },
];

/**
 * Help text shown in the terminal.
 * We keep it as plain text and render it into <pre>.
 */
export function helpText() {
  return [
    "CORE",
    "    help        commands list",
    "    about       who am i",
    "    projects    selected works (rendered from data)",
    "    contact     ping me",
    "    clear       clear screen",
    "",
    "TERMINAL",
    "    ls          list files",
    "    cat <file>  print file content",
    "    open <t>    open target (github|telegram|email|url)",
    "    github      open GitHub profile",
    "    whoami      print user",
    "    echo <...>  print text",
    "",
    "KEYS",
    "    Tab/→ autocomplete, ↑/↓ history, Ctrl+L clear",
  ].join("\n");
}

/**
 * "Message of the day" block.
 * Kept as HTML because it includes clickable command links.
 */
export function motdHtml() {
  return `
<div class="motd">
<pre class="dim">
«Code is a tool to build the future, one line at a time.»

<span class="cyan">user</span>: <span class="pink">NKTKLN</span>
<span class="cyan">role</span>: <span class="muted">ML / Python Engineer</span>
<span class="cyan">focus</span>: <span class="muted">Machine Learning, Deep Learning, Infrastructure &amp; Systems</span>

<span class="muted">hint:</span> type or tap <a class="cmdlink" data-cmd="help">help</a> · <a class="cmdlink" data-cmd="ls">ls</a> · <a class="cmdlink" data-cmd="projects">projects</a>
</pre>
</div>
  `.trim();
}

/**
 * Rich output blocks for some commands.
 * These are HTML by design (colored spans + anchors).
 */
export const blocksHtml = {
  about: `
<pre><span class="pink">NKTKLN</span> — <span class="cyan">ML / Python Engineer</span>.

I build ML systems end-to-end:
<span class="cyan">•</span> classical ML + DL fundamentals (incl. implementations from scratch)
<span class="cyan">•</span> clean code, performance, reproducibility
<span class="cyan">•</span> production mindset: APIs, Docker, monitoring, IaC

Background: <span class="muted">Python, infrastructure &amp; systems.</span></pre>
  `.trim(),

  contact: `
<pre><span class="cyan">Telegram</span>: <a href="https://t.me/NKTKLN" target="_blank" rel="noopener noreferrer">https://t.me/NKTKLN</a>
<span class="cyan">Email</span>: <a href="mailto:nktkln@nktkln.com">mailto:nktkln@nktkln.com</a></pre>
  `.trim(),
};

/**
 * Render projects into a terminal-friendly HTML <pre>.
 * We keep HTML controlled (our data only).
 */
export function renderProjectsHtml() {
  const lines = [];
  lines.push(`<span class="cyan">GitHub</span>: <a href="https://github.com/NKTKLN" target="_blank" rel="noopener noreferrer">https://github.com/NKTKLN</a>`);
  lines.push("");

  for (const p of PROJECTS) {
    const name = escapeHtml(p.name);
    const desc = escapeHtml(p.description);
    const url = escapeHtml(p.url);

    lines.push(`<span class="muted">${name}</span>: ${desc}`);
    lines.push(`  <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    lines.push("");
  }

  return `<pre>${lines.join("\n").trim()}</pre>`;
}

/** Export some common “targets” for open/github commands. */
export const LINKS = {
  github: "https://github.com/NKTKLN",
  telegram: "https://t.me/NKTKLN",
  email: "mailto:nktkln@nktkln.com",
};

/* ----------------- tiny safe HTML helpers (local only) ---------------- */

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Create a JSON snapshot of projects (for `cat projects.json`). */
export function projectsJsonPretty() {
  return JSON.stringify(PROJECTS, null, 2);
}

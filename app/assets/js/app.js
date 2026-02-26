/* -----------------------------------------------------------
   Terminal app logic
   Additions in this version:
   - Data-driven projects rendering (PROJECTS array)
   - Minimal "terminal-ish" commands: ls, cat, open, github, pwd, whoami, echo
   - Bash-like autocomplete for commands AND arguments (cat/open)
------------------------------------------------------------ */

import {
  COMMANDS,
  ALIASES,
  VFS,
  blocksHtml,
  helpText,
  motdHtml,
  renderProjectsHtml,
  LINKS,
  projectsJsonPretty,
} from "./content.js";

/** DOM helpers */
const $ = (id) => document.getElementById(id);

/** Elements */
const scroll = $("scroll");
const cmd = $("cmd");
const ps1 = $("ps1");
const ghost = $("ghost");
const inputRow = $("inputrow");

/** Constants */
const STORAGE_KEY = "nktkln_terminal_history_v3";
const MAX_HISTORY = 60;

/** State */
let history = loadHistory();
let histIndex = -1;
let currentDraft = "";

/** Virtual current directory (kept simple). */
let cwd = "/";

/** Footer year */
$("year").textContent = new Date().getFullYear();

/* ----------------------------- Rendering ----------------------------- */

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function linkifyPlain(text) {
  const esc = escapeHtml(text);
  let html = esc.replace(/(mailto:[^\s]+)/g, '<a href="$1">$1</a>');
  html = html.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return html;
}

function addLine(html) {
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = html;
  scroll.appendChild(div);
  scroll.scrollTop = scroll.scrollHeight;
}

function addCommandEcho(command) {
  addLine(
    `<span class="prompt">${escapeHtml(ps1.textContent)}</span> ` +
    `<span class="cmd">${escapeHtml(command)}</span>`
  );
}

function addOutput(text, { interactiveHelp = false } = {}) {
  if (!text) return;

  if (interactiveHelp) {
    const lines = text
      .split("\n")
      .map((line) => {
        const m = line.match(/^(\s{4})([a-z]+)(\s{2,})(.*)$/i);
        if (m) {
          const [, indent, c, gap, rest] = m;
          const cmdName = escapeHtml(c);
          return `${escapeHtml(indent)}<a class="cmdlink" data-cmd="${cmdName}">${cmdName}</a>${escapeHtml(gap)}${escapeHtml(rest)}`;
        }
        return escapeHtml(line);
      })
      .join("\n");

    addLine(`<pre>${lines}</pre>`);
    return;
  }

  addLine(`<pre>${linkifyPlain(text)}</pre>`);
}

function addOutputHtml(html) {
  if (!html) return;
  addLine(html);
}

function clearAndMotd() {
  scroll.innerHTML = "";
  addLine(motdHtml());
}

/* ----------------------------- History ----------------------------- */

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // ignore
  }
}

function pushHistory(value) {
  const v = String(value || "").trim();
  if (!v) return;
  if (history[history.length - 1] !== v) {
    history.push(v);
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    saveHistory();
  }
}

/* ----------------------------- Parsing ----------------------------- */

/**
 * Parse user input into:
 * - raw (full string)
 * - cmd (normalized command)
 * - args (rest)
 */
function parseCommand(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { raw: "", cmd: "", args: [] };

  const parts = trimmed.split(/\s+/);
  const head = (parts[0] || "").toLowerCase();
  const cmdName = ALIASES[head] || head;

  return { raw: trimmed, cmd: cmdName, args: parts.slice(1) };
}

/* ----------------------------- Virtual FS helpers ----------------------------- */

/** Return list of entries in current directory. */
function vfsList(dir) {
  return VFS[dir] || [];
}

/** Resolve a simple filename in cwd to an absolute path in VFS. */
function vfsResolve(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  if (n.startsWith("/")) return n;
  return cwd === "/" ? `/${n}` : `${cwd}/${n}`;
}

/** Read a file content by path. Returns null if missing. */
function vfsRead(path) {
  if (path === "/projects.json") return projectsJsonPretty();
  const v = VFS[path];
  return typeof v === "string" ? v : null;
}

/* ----------------------------- Autocomplete (bash-like) ----------------------------- */

/**
 * Split input into tokens but keep enough info to replace the "current token".
 * We only autocomplete when caret is at end (bash-ish behavior).
 */
function getCompletionState(input) {
  const s = String(input ?? "");
  const end = s.length;

  // Find last whitespace boundary for the current token
  const lastWs = s.search(/\s(?!.*\s)/); // not reliable for multiple ws
  // Better: scan from end
  let i = end - 1;
  while (i >= 0 && !/\s/.test(s[i])) i--;
  const tokenStart = i + 1;

  // Command token boundary (first token)
  const m = s.match(/^\s*([^\s]*)/);
  const firstToken = (m?.[1] ?? "");
  const afterCmdIndex = (m ? m[0].length : 0);

  return {
    s,
    end,
    tokenStart,
    token: s.slice(tokenStart, end),
    firstToken,
    afterCmdIndex,
    endsWithSpace: /\s$/.test(s),
  };
}

/** Return the first matching candidate by prefix (case-insensitive). */
function findPrefixMatch(prefix, candidates) {
  const p = (prefix ?? "").toLowerCase();
  return candidates.find((c) => c.toLowerCase().startsWith(p)) || null;
}

/**
 * Compute completion for either:
 * - command name (first token)
 * - argument for specific commands (cat/open)
 *
 * Returns:
 * - { full: string, insertFrom: number } to replace from insertFrom..end with completion
 * - null if no completion
 */
function computeCompletion(input) {
  const st = getCompletionState(input);
  const trimmedLeft = st.s.replace(/^\s+/, ""); // we don't support leading spaces much, but ok

  // If user is still typing the command (cursor is in first token region)
  // - i.e., there is no whitespace yet before caret OR caret is within first token.
  const hasSpace = /\s/.test(trimmedLeft);
  const cmdToken = st.firstToken;
  const cmdNormalized = (ALIASES[cmdToken.toLowerCase()] || cmdToken.toLowerCase());

  const isTypingCommand = !hasSpace && st.tokenStart <= cmdToken.length;

  if (isTypingCommand) {
    if (!cmdToken.trim()) return null;
    const match = findPrefixMatch(cmdToken, COMMANDS);
    if (!match) return null;
    return {
      full: match,
      insertFrom: 0, // replace command token from start
    };
  }

  // Otherwise, we are completing an argument (current token after first space)
  // Determine the command (first token)
  const parts = trimmedLeft.split(/\s+/);
  const head = (parts[0] || "").toLowerCase();
  const cmdName = ALIASES[head] || head;

  // For bash-like behavior: if user typed "cat " and token is empty -> suggest first file
  const current = st.token; // the token at the caret (we only use caret at end)
  const tokenIsArg = true;

  if (!tokenIsArg) return null;

  if (cmdName === "cat") {
    const files = vfsList(cwd);
    const match = findPrefixMatch(current, files);
    if (!match) return null;

    // Replace only current token (from tokenStart to end) with matched filename
    return { full: st.s.slice(0, st.tokenStart) + match, insertFrom: st.tokenStart };
  }

  if (cmdName === "open") {
    const targets = Object.keys(LINKS); // github/telegram/email
    const match = findPrefixMatch(current, targets);
    if (!match) return null;

    return { full: st.s.slice(0, st.tokenStart) + match, insertFrom: st.tokenStart };
  }

  return null;
}

/** Update ghost overlay based on current input + completion. */
function updateGhost() {
  const typed = cmd.value || "";
  const completion = computeCompletion(typed);

  if (!typed.trim() || !completion) {
    ghost.textContent = "";
    return;
  }

  ghost.textContent = completion.full;
}

/** Accept completion into input. Returns true if accepted. */
function acceptCompletion() {
  const typed = cmd.value || "";
  const completion = computeCompletion(typed);
  if (!completion) return false;

  cmd.value = completion.full;
  updateGhost();

  requestAnimationFrame(() => cmd.setSelectionRange(cmd.value.length, cmd.value.length));
  return true;
}

/* ----------------------------- Command handlers ----------------------------- */

function cmdHelp() {
  addOutput(helpText(), { interactiveHelp: true });
}

function cmdAbout() {
  addOutputHtml(blocksHtml.about);
}

function cmdProjects() {
  addOutputHtml(renderProjectsHtml());
}

function cmdContact() {
  addOutputHtml(blocksHtml.contact);
}

function cmdClear() {
  clearAndMotd();
}

/** `ls` — list files in cwd. */
function cmdLs() {
  const items = vfsList(cwd);
  addOutput(items.join("  "));
}

/** `cat <file>` — print file content. */
function cmdCat(args) {
  const file = args[0];
  if (!file) {
    addOutput("usage: cat <file>\ntry: ls");
    return;
  }

  const path = vfsResolve(file);
  const content = path ? vfsRead(path) : null;

  if (content == null) {
    addOutput(`cat: ${file}: No such file`);
    return;
  }

  addOutput(content);
}

/**
 * `open <target>`
 * target can be:
 * - github / telegram / email
 * - url (https://..., mailto:...)
 */
function cmdOpen(args) {
  const target = (args[0] || "").trim();
  if (!target) {
    addOutput("usage: open <github|telegram|email|url>\nexample: open github");
    return;
  }

  const key = target.toLowerCase();
  const url = LINKS[key] || target;

  const ok = /^https?:\/\/\S+$/i.test(url) || /^mailto:\S+$/i.test(url);
  if (!ok) {
    addOutput(`open: unsupported target: ${target}\ntry: open github`);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  addOutput(`opened: ${url}`);
}

/** `github` — shorthand for open github. */
function cmdGithub() {
  window.open(LINKS.github, "_blank", "noopener,noreferrer");
  addOutput(`opened: ${LINKS.github}`);
}

/** `whoami` — show user name (static, consistent with prompt). */
function cmdWhoami() {
  addOutput("nktkln");
}

/** `echo ...` — print text back. */
function cmdEcho(args) {
  addOutput(args.join(" "));
}

/* ----------------------------- Runner ----------------------------- */

function runCommand(raw) {
  const { raw: typed, cmd: c, args } = parseCommand(raw);
  if (!typed) return;

  addCommandEcho(typed);

  const handlers = {
    help: () => cmdHelp(),
    about: () => cmdAbout(),
    projects: () => cmdProjects(),
    contact: () => cmdContact(),
    clear: () => cmdClear(),

    ls: () => cmdLs(args),
    cat: () => cmdCat(args),
    open: () => cmdOpen(args),
    github: () => cmdGithub(),
    whoami: () => cmdWhoami(),
    echo: () => cmdEcho(args),
  };

  const handler = handlers[c];
  if (handler) {
    handler();
    return;
  }

  addOutput(`command not found: ${typed}\ntry: help`);
}

/* ----------------------------- Events ----------------------------- */

scroll.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;

  if (t.classList.contains("cmdlink")) {
    e.preventDefault(); // avoid any default <a> behavior
    const c = t.getAttribute("data-cmd") || "";
    if (c) {
      pushHistory(c);
      histIndex = -1;
      currentDraft = "";
      runCommand(c);

      if (!isCoarsePointer) cmd.focus();
    }
    return;
  }

  if (!isCoarsePointer) cmd.focus();
});

cmd.addEventListener("input", updateGhost);

cmd.addEventListener("keydown", (e) => {
  const key = e.key;

  // Ctrl+L / Cmd+L: clear
  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "l") {
    e.preventDefault();
    cmd.value = "";
    ghost.textContent = "";
    runCommand("clear");
    return;
  }

  // Tab: autocomplete (commands + args)
  if (key === "Tab") {
    // Only bash-like: autocomplete when caret at end
    const atEnd =
      cmd.selectionStart === cmd.value.length &&
      cmd.selectionEnd === cmd.value.length;

    if (atEnd) {
      const accepted = acceptCompletion();
      if (accepted) e.preventDefault();
    }
    return;
  }

  // ArrowRight: accept completion only if caret is at end
  if (key === "ArrowRight") {
    const atEnd =
      cmd.selectionStart === cmd.value.length &&
      cmd.selectionEnd === cmd.value.length;

    if (atEnd) {
      const completion = computeCompletion(cmd.value || "");
      if (completion && (cmd.value || "") !== completion.full) {
        e.preventDefault();
        acceptCompletion();
      }
    }
    return;
  }

  // Enter: run
  if (key === "Enter") {
    e.preventDefault();
    const value = cmd.value || "";

    if (value.trim()) {
      pushHistory(value);
      histIndex = -1;
      currentDraft = "";
    }

    cmd.value = "";
    ghost.textContent = "";
    runCommand(value);
    return;
  }

  // Up: history (latest first)
  if (key === "ArrowUp") {
    if (!history.length) return;
    e.preventDefault();

    if (histIndex === -1) currentDraft = cmd.value;
    histIndex = Math.min(history.length - 1, histIndex + 1);

    cmd.value = history[history.length - 1 - histIndex];
    updateGhost();
    requestAnimationFrame(() => cmd.setSelectionRange(cmd.value.length, cmd.value.length));
    return;
  }

  // Down: history back to draft
  if (key === "ArrowDown") {
    if (!history.length) return;
    if (histIndex === -1) return;

    e.preventDefault();

    histIndex -= 1;
    cmd.value = histIndex === -1 ? currentDraft : history[history.length - 1 - histIndex];

    updateGhost();
    requestAnimationFrame(() => cmd.setSelectionRange(cmd.value.length, cmd.value.length));
    return;
  }
});

inputRow.addEventListener("click", () => cmd.focus());

/* ----------------------------- Boot ----------------------------- */

clearAndMotd();
updateGhost();
cmd.focus();

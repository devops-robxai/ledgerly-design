#!/usr/bin/env node
/**
 * Local runbook page for the design workshop.
 *
 * Reads RUNBOOK.md and serves it at http://127.0.0.1:43176/runbooks/101.
 * Node 20+ standard library only. Diagrams use the vendored Mermaid
 * script in web/static/ (mermaid 11.4.1, MIT). Nothing is fetched at runtime.
 * Port 43176 stays clear of the app on 43175, the Go app on 43173, and the
 * platform runbook on 43174.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNBOOK = path.join(ROOT, "RUNBOOK.md");
const STATIC = path.join(ROOT, "web", "static");
const PORT = 43176;
const HOST = "127.0.0.1";

const CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const EM_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const UL_RE = /^[-*]\s+/;
const OL_RE = /^\d+\.\s+/;
const NON_SLUG = /[^a-z0-9]+/g;
const ALIGN_RE = /^:?-+:?$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(title) {
  let text = title.toLowerCase().replaceAll("—", " ").replaceAll("–", " ").replaceAll("→", " ");
  text = text.replace(NON_SLUG, "-").replace(/^-|-$/g, "");
  if (text.length > 56) text = text.slice(0, 56).replace(/-$/g, "");
  return text || "section";
}

function uniqueId(used, base) {
  used[base] = (used[base] || 0) + 1;
  if (used[base] === 1) return base;
  return `${base}-${used[base]}`;
}

function renderEmphasis(text) {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(LINK_RE, (_match, label, url) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      return `<a href="${escapeHtml(url)}">${label}</a>`;
    }
    return `<code>${label}</code>`;
  });
  escaped = escaped.replace(BOLD_RE, "<strong>$1</strong>");
  escaped = escaped.replace(EM_RE, "<em>$1</em>");
  return escaped;
}

function renderInline(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(CODE_RE)) {
    parts.push(renderEmphasis(text.slice(last, match.index)));
    parts.push(`<code>${escapeHtml(match[1])}</code>`);
    last = match.index + match[0].length;
  }
  parts.push(renderEmphasis(text.slice(last)));
  return parts.join("");
}

function isTableLine(line) {
  const stripped = line.trim();
  return stripped.startsWith("|") && stripped.endsWith("|") && stripped.split("|").length >= 3;
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isAlignRow(cells) {
  return cells.length > 0 && cells.every((cell) => ALIGN_RE.test(cell.replaceAll(" ", "")));
}

function renderTable(lines) {
  const rows = lines.map(splitRow);
  let header = null;
  let body = rows;
  if (rows.length >= 2 && isAlignRow(rows[1])) {
    header = rows[0];
    body = rows.slice(2);
  }
  const out = ["<table>"];
  if (header) {
    out.push("<thead><tr>");
    for (const cell of header) out.push(`<th>${renderInline(cell)}</th>`);
    out.push("</tr></thead>");
  }
  out.push("<tbody>");
  for (const row of body) {
    out.push("<tr>");
    for (const cell of row) out.push(`<td>${renderInline(cell)}</td>`);
    out.push("</tr>");
  }
  out.push("</tbody></table>");
  return out.join("");
}

function renderList(lines, ordered) {
  let start = 1;
  if (ordered) {
    const match = /^(\d+)\.\s+/.exec(lines[0]);
    if (match) start = Number(match[1]);
  }
  const open = ordered && start !== 1 ? `<ol start="${start}">` : ordered ? "<ol>" : "<ul>";
  const close = ordered ? "</ol>" : "</ul>";
  const items = lines.map((line) => {
    const text = ordered ? line.replace(OL_RE, "") : line.replace(UL_RE, "");
    return `<li>${renderInline(text)}</li>`;
  });
  return open + items.join("") + close;
}

function renderMarkdown(text) {
  const chunks = text.trim().split(/\n\s*\n/);
  const parts = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.replace(/\s+$/g, "")).filter((line) => line.trim());
    if (lines.length === 0) continue;
    if (lines.every(isTableLine)) {
      parts.push(renderTable(lines));
      continue;
    }
    if (lines.every((line) => UL_RE.test(line))) {
      parts.push(renderList(lines, false));
      continue;
    }
    if (lines.every((line) => OL_RE.test(line))) {
      parts.push(renderList(lines, true));
      continue;
    }
    if (lines[0].startsWith("### ")) {
      parts.push(`<h3>${renderInline(lines[0].slice(4).trim())}</h3>`);
      const rest = lines.slice(1).join("\n").trim();
      if (rest) parts.push(renderMarkdown(rest));
      continue;
    }
    const paragraph = lines.map((line) => line.trim()).join(" ");
    parts.push(`<p>${renderInline(paragraph)}</p>`);
  }
  return parts.join("\n");
}

function parseBlocks(lines) {
  const blocks = [];
  let buf = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (text) blocks.push(["md", text]);
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      flush();
      const lang = line.slice(3).trim().toLowerCase() || "text";
      index += 1;
      const body = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push([lang, body.join("\n").replace(/^\n|\n$/g, "")]);
      continue;
    }
    buf.push(line);
    index += 1;
  }
  flush();
  return blocks;
}

function parseRunbook(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  let title = "";
  const intro = [];
  const sections = [];
  let current = null;
  let body = [];
  const used = {};

  const flushSection = () => {
    if (!current) return;
    current.blocks = parseBlocks(body);
    sections.push(current);
    current = null;
    body = [];
  };

  for (const line of lines) {
    if (line.startsWith("# ") && !title && !current) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flushSection();
      const heading = line.slice(3).trim();
      current = { title: heading, id: uniqueId(used, slug(heading)), blocks: [] };
      continue;
    }
    if (!current) intro.push(line);
    else body.push(line);
  }
  flushSection();
  return {
    title: title || "Runbook",
    intro_blocks: parseBlocks(intro),
    sections,
  };
}

function promptHtml(text, label = "Paste in Cursor") {
  return (
    '<div class="prompt-block">' +
    '<div class="prompt-toolbar">' +
    `<span class="meta">${escapeHtml(label)}</span>` +
    '<button type="button" class="copy-btn" data-copy>Copy</button>' +
    "</div>" +
    `<pre tabindex="0"><code>${escapeHtml(text)}</code></pre>` +
    "</div>"
  );
}

function blocksHtml(blocks, mdClass) {
  const bits = [];
  for (const [kind, body] of blocks) {
    if (kind === "md") {
      const rendered = renderMarkdown(body);
      if (rendered) bits.push(`<div class="${mdClass}">${rendered}</div>`);
    } else if (kind === "mermaid") {
      bits.push(`<pre class="mermaid">${escapeHtml(body)}</pre>`);
    } else if (kind === "text") {
      bits.push(promptHtml(body));
    } else if (kind === "json") {
      bits.push(promptHtml(body, "Config"));
    } else {
      bits.push(`<pre class="code-fence"><code>${escapeHtml(body)}</code></pre>`);
    }
  }
  return bits;
}

function pageHtml(track) {
  const nav = [];
  const cards = [];
  for (const section of track.sections) {
    nav.push(`<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`);
    const bits = [`<h2>${escapeHtml(section.title)}</h2>`, ...blocksHtml(section.blocks, "runbook-detail")];
    cards.push(
      `<section class="card runbook-section" id="${escapeHtml(section.id)}">` + bits.join("\n") + "</section>",
    );
  }
  const introBits = blocksHtml(track.intro_blocks, "runbook-intro");
  const title = escapeHtml(track.title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Ledgerly</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
<div class="shell">
  <header class="topbar">
    <a class="brand" href="/runbooks/101">Ledger<span>ly</span></a>
    <nav>
      <a href="/runbooks/101" class="active">Runbook</a>
    </nav>
  </header>
  <h1>${title}</h1>
  ${introBits.join("\n")}
  <nav class="runbook-jump" aria-label="Runbook sections">
    ${nav.join("")}
  </nav>
  <div class="stack runbook">
    ${cards.join("\n")}
  </div>
  <p class="meta">Source of truth: <span class="mono">RUNBOOK.md</span> in the repo. Review every agent result.</p>
  <p class="footer">Ledgerly design · local runbook · sample data only</p>
</div>
<script src="/static/mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: true, securityLevel: "strict", theme: "neutral" });
</script>
<script>
(function () {
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject();
  }
  function selectBlock(pre) {
    var range = document.createRange();
    range.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var block = btn.closest(".prompt-block");
      var pre = block && block.querySelector("pre");
      if (!pre) return;
      var text = pre.innerText.replace(/\\n$/, "");
      copyText(text).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      }).catch(function () {
        selectBlock(pre);
        try { document.execCommand("copy"); btn.textContent = "Copied"; } catch (e) {}
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      });
    });
  });
})();
</script>
</body>
</html>
`;
}

function loadTrack() {
  if (!fs.existsSync(RUNBOOK)) fail(`missing ${RUNBOOK}`);
  return parseRunbook(fs.readFileSync(RUNBOOK, "utf8"));
}

function iterBlocks(track) {
  const found = [["intro", track.intro_blocks]];
  for (const section of track.sections) found.push([section.title, section.blocks]);
  return found;
}

function checkPage() {
  const track = loadTrack();
  const page = pageHtml(track);
  const prompts = [];
  for (const [title, blocks] of iterBlocks(track)) {
    for (const [kind, body] of blocks) {
      if (kind === "text") prompts.push([title, body]);
    }
  }
  const problems = [];
  if (prompts.length < 8) problems.push(`expected at least 8 beat prompts, found ${prompts.length}`);
  if (!page.includes("Paste in Cursor") || !page.includes("data-copy")) {
    problems.push("copy button markup missing");
  }
  for (const [title, body] of prompts) {
    if (!page.includes(escapeHtml(body))) problems.push(`prompt missing from page: ${title}: ${body.slice(0, 60)}`);
    const needle = `<pre tabindex="0"><code>${escapeHtml(body)}</code></pre>`;
    if (!page.includes(needle)) problems.push(`prompt is not inside a copy block: ${title}`);
  }
  for (const [title, blocks] of iterBlocks(track)) {
    for (const [kind, body] of blocks) {
      if (kind !== "json") continue;
      const needle = `<pre tabindex="0"><code>${escapeHtml(body)}</code></pre>`;
      if (!page.includes(needle)) problems.push(`json is not inside a copy block: ${title}`);
    }
  }
  let mermaidBlocks = 0;
  for (const [, blocks] of iterBlocks(track)) {
    for (const [kind] of blocks) if (kind === "mermaid") mermaidBlocks += 1;
  }
  if (mermaidBlocks !== 4) problems.push(`expected 4 mermaid diagrams, found ${mermaidBlocks}`);
  if (!page.includes('src="/static/mermaid.min.js"')) problems.push("page does not load the vendored mermaid script");
  const fetched = [...page.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  if (fetched.length > 0) problems.push(`page fetches external assets: ${fetched.join(", ")}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return 1;
  }
  console.log(`prompts ${prompts.length}`);
  for (const [title, body] of prompts) {
    const first = body.split("\n")[0] || "";
    console.log(`  ${title}: ${first}`);
  }
  console.log(`diagrams ${mermaidBlocks}`);
  return 0;
}

function serve() {
  if (!fs.existsSync(path.join(STATIC, "mermaid.min.js")) || !fs.existsSync(path.join(STATIC, "app.css"))) {
    fail("web/static is missing app.css or mermaid.min.js");
  }
  let port = PORT;
  const envPort = (process.env.LEDGERLY_RUNBOOK_PORT || "").trim();
  if (envPort) port = Number(envPort);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}`);
    const pathname = url.pathname;
    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (pathname === "/" || pathname === "/runbooks" || pathname === "/runbooks/") {
      res.writeHead(302, { Location: "/runbooks/101" });
      res.end();
      return;
    }
    if (pathname === "/runbooks/101") {
      const body = Buffer.from(pageHtml(loadTrack()), "utf8");
      send(res, 200, "text/html; charset=utf-8", body, req.method === "HEAD");
      return;
    }
    if (pathname === "/static/app.css") {
      sendFile(res, path.join(STATIC, "app.css"), "text/css; charset=utf-8", req.method === "HEAD");
      return;
    }
    if (pathname === "/static/mermaid.min.js") {
      sendFile(res, path.join(STATIC, "mermaid.min.js"), "text/javascript; charset=utf-8", req.method === "HEAD");
      return;
    }
    send(res, 404, "text/plain; charset=utf-8", Buffer.from("not found\n"), req.method === "HEAD");
  });
  server.on("error", (exc) => fail(`could not listen on ${HOST}:${port}: ${exc.message}`));
  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}/runbooks/101`;
    console.log("Ledgerly design runbook");
    console.log(url);
    console.log("Stop with Ctrl+C.");
  });
}

function send(res, status, contentType, body, headOnly) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  if (!headOnly) res.end(body);
  else res.end();
}

function sendFile(res, file, contentType, headOnly) {
  if (!fs.existsSync(file)) {
    send(res, 404, "text/plain; charset=utf-8", Buffer.from("not found\n"), headOnly);
    return;
  }
  send(res, 200, contentType, fs.readFileSync(file), headOnly);
}

function main(argv) {
  if (argv.length > 3 || (argv.length === 3 && argv[2] !== "--check")) {
    fail("usage: runbook.mjs [--check]");
  }
  if (argv.length === 3) process.exit(checkPage());
  serve();
}

main(process.argv);

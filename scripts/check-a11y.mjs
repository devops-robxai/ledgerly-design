import fs from "node:fs";
import path from "node:path";

const MIN_RATIO = 4.5;

function channel(value) {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = hex.slice(1);
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n.slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const left = luminance(a);
  const right = luminance(b);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVars(css) {
  const vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const match of css.matchAll(re)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function resolveValue(value, vars, depth = 0) {
  if (depth > 6) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, name) => {
    const next = vars[name];
    if (!next) return "";
    return resolveValue(next, vars, depth + 1);
  });
}

function firstHex(value) {
  const match = value.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/);
  return match ? match[0] : null;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function declarations(body) {
  const map = {};
  for (const part of body.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key) map[key] = value;
  }
  return map;
}

function tagEnd(text, from) {
  let quote = null;
  let brace = 0;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === ">" && brace === 0) return i;
  }
  return -1;
}

function buttonProblems(file, text) {
  const problems = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("<button", cursor);
    if (start === -1) break;
    const after = start + "<button".length;
    const boundary = text[after];
    if (boundary && /[A-Za-z0-9_-]/.test(boundary)) {
      cursor = after;
      continue;
    }
    const openEnd = tagEnd(text, after);
    if (openEnd === -1) break;
    const attrs = text.slice(after, openEnd);
    const close = text.indexOf("</button>", openEnd);
    if (close === -1) break;
    const named = /(?:^|\s)(?:aria-label|aria-labelledby|title)\s*=\s*(?:"[^"]*\S[^"]*"|'[^']*\S[^']*')/i.test(attrs);
    const textOnly = text
      .slice(openEnd + 1, close)
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!named && textOnly.length === 0) {
      problems.push(
        `${file}:${lineOf(text, start)}: button has no accessible name. Add visible text or an aria-label.`,
      );
    }
    cursor = close + "</button>".length;
  }
  const img = /<img\b([^>]*)\/?>/g;
  for (const match of text.matchAll(img)) {
    const attrs = match[1];
    if (!/\balt\s*=/.test(attrs)) {
      problems.push(`${file}:${lineOf(text, match.index)}: image has no alt text.`);
    }
  }
  return problems;
}

function contrastProblems(cssFiles, vars) {
  const problems = [];
  for (const file of cssFiles) {
    const text = fs.readFileSync(file.path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const re = /([^{}]+)\{([^{}]+)\}/g;
    for (const match of text.matchAll(re)) {
      const decls = declarations(match[2]);
      const fgSource = decls.color;
      const bgSource = decls["background-color"] || decls.background;
      if (!fgSource || !bgSource) continue;
      if (/gradient|url\(/i.test(bgSource)) continue;
      const fg = firstHex(resolveValue(fgSource, vars));
      const bg = firstHex(resolveValue(bgSource, vars));
      if (!fg || !bg) continue;
      const ratio = contrast(fg, bg);
      if (ratio + 1e-6 < MIN_RATIO) {
        const selector = match[1].trim().replace(/\s+/g, " ");
        problems.push(
          `${file.rel}:${lineOf(text, match.index)}: ${selector} text ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below WCAG AA ${MIN_RATIO}:1.`,
        );
      }
    }
  }
  return problems;
}

export function checkA11y(root) {
  const src = path.join(root, "src");
  const problems = [];
  const cssFiles = [];
  const tokens = fs.readFileSync(path.join(src, "tokens.css"), "utf8");
  const vars = cssVars(tokens);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (entry.name.endsWith(".tsx")) {
        problems.push(...buttonProblems(rel, fs.readFileSync(full, "utf8")));
      }
      if (entry.name.endsWith(".css")) {
        cssFiles.push({ path: full, rel });
        Object.assign(vars, cssVars(fs.readFileSync(full, "utf8")));
      }
    }
  }

  walk(src);
  problems.push(...contrastProblems(cssFiles, vars));
  return problems;
}

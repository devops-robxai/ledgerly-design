import fs from "node:fs";
import path from "node:path";

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const RGB = /\b(?:rgb|hsl)a?\(/g;
const SPACE_PROPS =
  /(?:^|[;{\n])\s*(padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap)\s*:\s*([^;}{]+)/gi;
const JSX_SPACE =
  /\b(padding|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginTop|marginRight|marginBottom|marginLeft|gap|rowGap|columnGap)\s*:\s*([^,\n}]+)/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function allowedSpacing(tokensCss) {
  const allowed = new Set([0, 1]);
  const re = /--space-[\w-]+\s*:\s*(\d+(?:\.\d+)?)px/g;
  let match = re.exec(tokensCss);
  while (match) {
    allowed.add(Number(match[1]));
    match = re.exec(tokensCss);
  }
  return allowed;
}

function pxNumbers(value) {
  const nums = [];
  const re = /(\d+(?:\.\d+)?)px/g;
  let match = re.exec(value);
  while (match) {
    nums.push(Number(match[1]));
    match = re.exec(value);
  }
  for (const part of value.trim().split(/\s+/)) {
    if (part === "0") nums.push(0);
  }
  return nums;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

export function checkTokens(root) {
  const src = path.join(root, "src");
  const tokensPath = path.join(src, "tokens.css");
  const tokensCss = fs.readFileSync(tokensPath, "utf8");
  const allowed = allowedSpacing(tokensCss);
  const scale = [...allowed]
    .filter((n) => n !== 0 && n !== 1)
    .sort((a, b) => a - b)
    .join(", ");
  const problems = [];

  for (const file of walk(src)) {
    if (path.resolve(file) === path.resolve(tokensPath)) continue;
    const text = fs.readFileSync(file, "utf8");
    const where = rel(root, file);

    for (const match of text.matchAll(HEX)) {
      problems.push(
        `${where}:${lineOf(text, match.index)}: hard-coded colour ${match[0]}. Use a token from src/tokens.css.`,
      );
    }
    for (const match of text.matchAll(RGB)) {
      problems.push(
        `${where}:${lineOf(text, match.index)}: hard-coded colour ${match[0]}. Use a token from src/tokens.css.`,
      );
    }

    const isJs = file.endsWith(".ts") || file.endsWith(".tsx");
    const spaceRe = isJs ? JSX_SPACE : SPACE_PROPS;
    for (const match of text.matchAll(spaceRe)) {
      const value = match[2];
      if (value.includes("var(") && !value.includes("px")) continue;
      for (const n of pxNumbers(value)) {
        if (!allowed.has(n)) {
          problems.push(
            `${where}:${lineOf(text, match.index)}: spacing ${n}px is off the scale (${scale}). Use a spacing token.`,
          );
        }
      }
    }
  }

  return problems;
}

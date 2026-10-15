#!/usr/bin/env node
// Workshop commands for macOS, Windows, and Linux.
// Git and npm are invoked without a shell on macOS and Linux.
// On Windows, npm is npm.cmd and Node requires a shell to launch .cmd files.
// Paths printed by this file use forward slashes so the check output matches on every OS.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkA11y } from "./check-a11y.mjs";
import { checkTokens } from "./check-tokens.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RESTORE = [
  "src",
  "index.html",
  "vite.config.ts",
  "eslint.config.js",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "scripts",
  "Makefile",
  "research",
  "reference",
  "web",
  ".cursor/environment.json",
  ".cursor/rules/.gitkeep",
  ".devcontainer",
  ".cursorignore",
  ".gitignore",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function display(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function spawnGit(args, inherit) {
  return spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  });
}

function gitOk(ref) {
  const proc = spawnGit(["rev-parse", "--verify", "--quiet", ref]);
  return proc.status === 0;
}

function which(name) {
  const proc = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return proc.status === 0;
}

function report(level, name, detail) {
  const label = name.padEnd(14, " ");
  console.log(`${level.padEnd(4, " ")} ${label} ${detail}`);
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function baselineProblems() {
  const problems = [];
  if (fs.existsSync(path.join(ROOT, "AGENTS.md"))) problems.push("AGENTS.md is present");
  if (fs.existsSync(path.join(ROOT, ".cursor", "mcp.json"))) {
    problems.push(".cursor/mcp.json is present");
  }
  const rulesDir = path.join(ROOT, ".cursor", "rules");
  for (const file of walkFiles(rulesDir)) {
    if (file.endsWith(".md") || file.endsWith(".mdc")) {
      problems.push(`${display(file)} is present`);
    }
  }
  if (fs.existsSync(path.join(ROOT, ".cursor", "skills"))) problems.push(".cursor/skills is present");
  if (fs.existsSync(path.join(ROOT, ".agents"))) problems.push(".agents is present");
  return problems;
}

function depsInstalled() {
  return (
    fs.existsSync(path.join(ROOT, "node_modules", "react", "package.json")) &&
    fs.existsSync(path.join(ROOT, "node_modules", "typescript", "bin", "tsc")) &&
    fs.existsSync(path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"))
  );
}

function cmdPreflight() {
  let fails = 0;
  let warns = 0;
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) {
    report("PASS", "node", process.version);
  } else {
    report("FAIL", "node", `${process.version} is older than 20. Install Node.js 20+ from https://nodejs.org/`);
    fails += 1;
  }

  const npm = spawnSync(npmBin(), ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (npm.status === 0) {
    report("PASS", "npm", (npm.stdout || "").trim());
  } else {
    report("FAIL", "npm", "not on PATH. Install Node.js 20+ from https://nodejs.org/ and leave Add to PATH enabled.");
    fails += 1;
  }

  if (which("git")) report("PASS", "git", "present");
  else {
    report("FAIL", "git", "not on PATH.");
    fails += 1;
  }

  if (depsInstalled()) report("PASS", "dependencies", "node_modules is installed");
  else {
    report("FAIL", "dependencies", "missing. Fix: npm run ready");
    fails += 1;
  }

  const problems = baselineProblems();
  if (problems.length === 0) {
    report("PASS", "baseline", "no project rules, no project skills, no AGENTS.md, no .cursor/mcp.json");
  } else {
    report("FAIL", "baseline", `${problems.join("; ")}. Fix: npm run demo-reset`);
    fails += 1;
  }

  if (which("make")) report("PASS", "make", "present");
  else {
    report("WARN", "make", "not on PATH. npm scripts work without it.");
    warns += 1;
  }

  if (!which("docker")) {
    report("WARN", "docker", "not installed. Optional, for the dev container.");
    warns += 1;
  } else {
    report("PASS", "docker", "available");
  }

  console.log();
  if (fails > 0) {
    console.log("NOT READY: fix the items above");
    return 1;
  }
  if (warns === 1) console.log("READY (1 warning)");
  else if (warns > 1) console.log(`READY (${warns} warnings)`);
  else console.log("READY");
  return 0;
}

function cmdReady() {
  console.log("Installing dependencies");
  const install = spawnSync(npmBin(), ["install"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if ((install.status ?? 1) !== 0) {
    console.error("npm install failed");
    return install.status ?? 1;
  }
  console.log();
  return cmdPreflight();
}

function runBin(label, relScript, args) {
  console.log(`======== ${label} ========`);
  const script = path.join(ROOT, relScript);
  if (!fs.existsSync(script)) {
    console.log(`missing ${relScript}`);
    console.log();
    return false;
  }
  const proc = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  console.log();
  return (proc.status ?? 1) === 0;
}

function cmdCheck() {
  if (!depsInstalled()) {
    console.error("Dependencies are not installed. Run npm run ready");
    return 1;
  }
  const results = [];
  results.push(["eslint", runBin("eslint", "node_modules/eslint/bin/eslint.js", ["src"])]);
  results.push(["typecheck", runBin("typecheck", "node_modules/typescript/bin/tsc", ["--noEmit", "-p", "tsconfig.json"])]);

  console.log("======== tokens ========");
  const tokenProblems = checkTokens(ROOT);
  if (tokenProblems.length === 0) console.log("PASS tokens");
  else for (const line of tokenProblems) console.log(line);
  console.log();
  results.push(["tokens", tokenProblems.length === 0]);

  console.log("======== accessibility ========");
  const a11yProblems = checkA11y(ROOT);
  if (a11yProblems.length === 0) console.log("PASS accessibility");
  else for (const line of a11yProblems) console.log(line);
  console.log();
  results.push(["accessibility", a11yProblems.length === 0]);

  console.log("======== summary ========");
  let failed = false;
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    if (!ok) failed = true;
  }
  if (failed) {
    console.log("one or more checks failed");
    return 1;
  }
  console.log("all checks passed");
  return 0;
}

function removeMatching(dir, suffixes) {
  for (const file of walkFiles(dir)) {
    if (suffixes.some((suffix) => file.toLowerCase().endsWith(suffix))) {
      fs.rmSync(file, { force: true });
      console.log(`removed ${display(file)}`);
    }
  }
}

function removeTree(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return;
  fs.rmSync(full, { recursive: true, force: true });
  console.log(`removed ${rel.split(path.sep).join("/")}`);
}

function removeUntracked(dirs) {
  const proc = spawnGit(["status", "--porcelain", "-u", "--", ...dirs]);
  if (proc.status !== 0) return;
  for (const line of (proc.stdout || "").split(/\r?\n/)) {
    if (!line.startsWith("?? ")) continue;
    let rel = line.slice(3).trim();
    if (rel.startsWith('"') && rel.endsWith('"')) {
      rel = rel.slice(1, -1);
    }
    const full = path.resolve(ROOT, rel);
    const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    if (full !== ROOT && !full.startsWith(rootWithSep)) continue;
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`removed ${rel.split("\\").join("/")}`);
  }
}

function cmdDemoReset() {
  if (!which("git")) fail("git is required for demo-reset");
  let base = (process.env.DEMO_BASELINE || "").trim();
  if (!base) {
    if (gitOk("refs/tags/demo-baseline")) base = "demo-baseline";
    else if (gitOk("origin/main")) base = "origin/main";
    else fail("No demo-baseline tag or origin/main to restore from.");
  }
  console.log(`Restoring planted files from ${base}`);
  const checkout = spawnGit(["checkout", base, "--", ...RESTORE], true);
  if ((checkout.status ?? 1) !== 0) return checkout.status ?? 1;

  removeUntracked(["src", "research"]);
  removeMatching(path.join(ROOT, ".cursor", "rules"), [".md", ".mdc"]);
  removeTree(".cursor/skills");
  removeTree(".agents");
  const agents = path.join(ROOT, "AGENTS.md");
  if (fs.existsSync(agents)) {
    fs.rmSync(agents);
    console.log("removed AGENTS.md");
  }
  const mcp = path.join(ROOT, ".cursor", "mcp.json");
  if (fs.existsSync(mcp)) {
    fs.rmSync(mcp);
    console.log("removed .cursor/mcp.json in the repo root");
  }
  console.log("left ~/.cursor/mcp.json untouched");
  console.log();
  console.log("Working tree restored. Not committed.");
  console.log("Expect npm run check to fail on tokens and accessibility.");
  console.log("eslint and typecheck should still pass.");
  console.log("RUNBOOK.md was not changed.");
  return 0;
}

function main(argv) {
  const command = argv[2];
  const known = ["ready", "check", "preflight", "demo-reset"];
  if (!known.includes(command) || argv.length !== 3) {
    fail(`usage: workshop.mjs ${known.join("|")}`);
  }
  const commands = {
    ready: cmdReady,
    check: cmdCheck,
    preflight: cmdPreflight,
    "demo-reset": cmdDemoReset,
  };
  process.exit(commands[command]());
}

main(process.argv);

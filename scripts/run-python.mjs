#!/usr/bin/env node
/**
 * Runs a project script with the Python interpreter inside apps/server/venv.
 * Works on Windows (venv\Scripts\python.exe) and Linux/macOS (venv/bin/python).
 *
 * Used by the root npm scripts so `npm run dev` and `npm run demo` are not tied
 * to a POSIX-only `venv/bin/python` path.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const PYTHON = path.join(ROOT, "apps", "server", "venv", IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error("usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(2);
}

if (!existsSync(PYTHON)) {
  console.error(`Python environment not found at ${PYTHON}.`);
  console.error("Run: node scripts/wearright.mjs install");
  process.exit(1);
}

const result = spawnSync(PYTHON, [path.resolve(ROOT, script), ...args], { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);

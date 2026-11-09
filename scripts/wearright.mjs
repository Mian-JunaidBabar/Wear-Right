#!/usr/bin/env node
/**
 * Cross-platform tasks for Wear Right.
 *
 * The same commands work in PowerShell on Windows and in a Linux/macOS shell:
 *
 *   node scripts/wearright.mjs install
 *   node scripts/wearright.mjs seed
 *   node scripts/wearright.mjs build
 *   node scripts/wearright.mjs demo
 *
 * It deliberately uses Node (already required by the web app) so Windows users
 * do not need Make, WSL, bash, sed or tar.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "apps", "server");
const WEB = path.join(ROOT, "apps", "web");
const VENV = path.join(SERVER, "venv");
const IS_WIN = process.platform === "win32";
const VENV_PY = path.join(VENV, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const ENV_FILE = path.join(SERVER, ".env");
const ENV_EXAMPLE = path.join(SERVER, ".env.example");

function info(message) {
  console.log(message);
}

function warn(message) {
  console.warn(`WARNING: ${message}`);
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/** Quote one argument for cmd.exe. Most project args are already safe. */
function quoteWin(value) {
  if (/^[A-Za-z0-9_./:=+@-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function run(command, args, { cwd = ROOT, allowFailure = false } = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    if (allowFailure) return result;
    die(`Could not run "${command}": ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return result;
    process.exit(result.status ?? 1);
  }
  return result;
}

/**
 * npm is a .cmd shim on Windows, which spawn() cannot execute without a shell.
 * Going through cmd.exe also keeps paths with spaces working.
 */
function runNpm(args, options = {}) {
  if (!IS_WIN) return run("npm", args, options);
  const line = ["npm", ...args].map(quoteWin).join(" ");
  return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line], options);
}

function runPython(args, options = {}) {
  if (!existsSync(VENV_PY)) {
    die("The Python environment is missing. Run: node scripts/wearright.mjs install");
  }
  return run(VENV_PY, args, { cwd: SERVER, ...options });
}

function runDjango(args, options = {}) {
  return runPython(["manage.py", ...args], options);
}

function dockerCompose(args, options = {}) {
  return run("docker", ["compose", ...args], options);
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9)) {
    die(`Node.js 20.9+ is required; this is ${process.versions.node}. Install the current LTS from https://nodejs.org/`);
  }
}

function detectPython() {
  const candidates = IS_WIN
    ? [
        { command: "py", prefix: ["-3.12"], label: "py -3.12" },
        { command: "py", prefix: ["-3"], label: "py -3" },
        { command: "python", prefix: [], label: "python" },
        { command: "python3", prefix: [], label: "python3" },
      ]
    : [
        { command: "python3.12", prefix: [], label: "python3.12" },
        { command: "python3", prefix: [], label: "python3" },
        { command: "python", prefix: [], label: "python" },
      ];

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.prefix, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
      { encoding: "utf8" },
    );
    if (result.status !== 0) continue;
    const match = String(result.stdout || "").trim().match(/^(\d+)\.(\d+)$/);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major === 3 && minor >= 12) {
      if (minor !== 12) {
        warn(`Found Python ${major}.${minor}. The project is tested on Python 3.12; if a package fails to install, use 3.12.`);
      }
      return { ...candidate, version: `${major}.${minor}` };
    }
  }

  die(
    "Python 3.12+ was not found. Install it from https://www.python.org/downloads/ " +
      "(on Windows, tick 'Add python.exe to PATH' or keep the py launcher installed), then reopen the terminal.",
  );
}

function ensureVenv() {
  if (existsSync(VENV_PY)) return;
  const python = detectPython();
  info(`Creating the Python environment with ${python.label} (${python.version})...`);
  mkdirSync(VENV, { recursive: true });
  run(python.command, [...python.prefix, "-m", "venv", VENV]);
  if (!existsSync(VENV_PY)) die(`The venv was created but ${VENV_PY} is missing.`);
}

function ensureEnv() {
  let text = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, "utf8")
    : existsSync(ENV_EXAMPLE)
      ? readFileSync(ENV_EXAMPLE, "utf8")
      : null;

  if (text === null) {
    die("apps/server/.env.example is missing; cannot create apps/server/.env.");
  }

  if (!/^SECRET_KEY=\S+/m.test(text)) {
    const key = randomBytes(48).toString("base64url");
    text = /^SECRET_KEY=.*$/m.test(text)
      ? text.replace(/^SECRET_KEY=.*$/m, `SECRET_KEY=${key}`)
      : `${text.trimEnd()}\nSECRET_KEY=${key}\n`;
    writeFileSync(ENV_FILE, text, "utf8");
    info(`Created ${path.relative(ROOT, ENV_FILE)} with a random SECRET_KEY.`);
  } else if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, text, "utf8");
  }
}

function dockerAvailable() {
  const result = spawnSync("docker", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

function dbUp() {
  if (!dockerAvailable()) {
    die(
      "Docker was not found. Install Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux), " +
        "start it, and run this command again.",
    );
  }
  info("Starting Postgres and Mailpit...");
  dockerCompose(["up", "-d", "--wait"]);
}

function migrate() {
  info("Applying database migrations...");
  runDjango(["migrate", "--noinput"]);
}

function seedProducts() {
  info("Seeding products, categories, colours, recommender tone rules, admin and demo users...");
  runDjango(["seed_products"]);
}

const MANNEQUIN_KITS = [
  path.join(ROOT, "extras", "mannequin-alpha-kit"),
];

function findMannequinKit(explicit) {
  const candidates = [explicit, process.env.MANNEQUIN_KIT, ...MANNEQUIN_KITS].filter(Boolean);
  return candidates.find((candidate) => existsSync(path.join(candidate, "manifest.csv"))) || null;
}

function ensureModels() {
  const clothModel = path.join(SERVER, "ml_models", "rembg", "models", "u2net_cloth_seg", "u2net_cloth_seg.onnx");
  if (existsSync(clothModel)) return;
  info("Downloading the AI models needed by the mannequin import (one-time, large)...");
  runDjango(["download_models"]);
}

function seedMannequin(explicitKit) {
  const kit = findMannequinKit(explicitKit);
  if (!kit) {
    warn(
      "Mannequin kit not found, so mannequin data was skipped. " +
        "Put the kit at extras/mannequin-alpha-kit or pass --mannequin-kit <path>. " +
        "The rest of the demo data is ready.",
    );
    return;
  }

  info(`Importing mannequin data from ${kit}`);
  info("The kit references catalogue products, so this needs the product rows already in the database.");
  info("On a fresh database, import the Kaggle catalogue first (make import-catalog) or restore a database backup.");
  ensureModels();

  let imported = 0;
  for (const gender of ["men", "women"]) {
    if (!existsSync(path.join(kit, "base", `${gender}.png`))) continue;
    runDjango(["import_alpha_mannequin", "--source", kit, "--gender", gender]);
    imported += 1;
  }
  if (imported === 0) {
    warn("The kit has no base/men.png or base/women.png, so there was nothing to import.");
    return;
  }

  const publishCommand = path.join(SERVER, "catalog", "management", "commands", "publish_mannequin_demo.py");
  if (existsSync(publishCommand)) {
    info("Publishing the imported mannequin products for the demo...");
    runDjango(["publish_mannequin_demo"]);
  }
}

function commandInstall() {
  checkNode();
  info("Wear Right installer (Windows, Linux and macOS)");
  info(`Project: ${ROOT}`);
  ensureVenv();
  ensureEnv();

  info("Installing Python packages...");
  runPython(["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]);
  runPython(["-m", "pip", "install", "-r", path.join(SERVER, "requirements.txt")]);

  info("Installing Node packages...");
  // `npm ci` uses the committed lockfile and replaces a stale node_modules
  // (for example one left at an older Next.js version by a previous checkout).
  runNpm([existsSync(path.join(ROOT, "package-lock.json")) ? "ci" : "install"]);
  runNpm(["--prefix", WEB, existsSync(path.join(WEB, "package-lock.json")) ? "ci" : "install"]);

  if (!dockerAvailable()) {
    warn("Docker is not available yet. Install/start Docker before running the database commands.");
  }

  console.log(`
Install finished.

Next:
  node scripts/wearright.mjs seed      # database + demo data + mannequin (if the kit is present)
  node scripts/wearright.mjs build     # production build of the web app
  node scripts/wearright.mjs demo      # database, build and production-style run

If you also want the end-to-end tests: cd apps/web && npx playwright install chromium`);
}

function commandSeed(options) {
  checkNode();
  dbUp();
  migrate();
  seedProducts();
  if (!options.skipMannequin) seedMannequin(options.mannequinKit);
  console.log(`
Seed finished.

Logins (created when DEBUG=True):
  customer  demo@wearright.local   / demo12345
  admin     admin@wearright.com    / admin123
  legacy    admin                  / admin12345`);
}

function commandBuild() {
  checkNode();
  if (!existsSync(path.join(WEB, "node_modules"))) {
    die("apps/web/node_modules is missing. Run: node scripts/wearright.mjs install");
  }
  info("Creating the production Next.js build...");
  runNpm(["--prefix", WEB, "run", "build"]);
  info("Production build finished: apps/web/.next");
}

function commandDemo(options) {
  checkNode();
  dbUp();
  migrate();
  if (!options.noSeed) seedProducts();
  if (!options.skipBuild) commandBuild();

  info("Starting the production demo:");
  info("  web       http://localhost:3000");
  info("  API       http://127.0.0.1:8000 (reached through the web proxy)");
  info("  Mailpit   http://localhost:8025");
  info("Press Ctrl+C to stop.");
  runNpm(["run", "demo"]);
}

function commandDev() {
  checkNode();
  dbUp();
  migrate();
  info("Starting development servers on http://localhost:3000 ...");
  runNpm(["run", "dev"]);
}

function commandTest() {
  checkNode();
  dbUp();
  runPython(["-m", "pytest"]);
  runNpm(["--prefix", WEB, "test"]);
  runNpm(["--prefix", WEB, "run", "typecheck"]);
  runNpm(["--prefix", WEB, "run", "lint"]);
}

function commandDoctor() {
  info(`OS:        ${process.platform} ${process.arch}`);
  info(`Node:      ${process.versions.node}`);
  const npm = spawnSync(IS_WIN ? "cmd.exe" : "npm", IS_WIN ? ["/d", "/s", "/c", "npm --version"] : ["--version"], {
    encoding: "utf8",
  });
  info(`npm:       ${String(npm.stdout || "").trim() || "not found"}`);
  info(`Python:    ${existsSync(VENV_PY) ? VENV_PY : "venv missing - run install"}`);
  const docker = spawnSync("docker", ["--version"], { encoding: "utf8" });
  info(`Docker:    ${String(docker.stdout || "").trim() || "not found"}`);
  info(`.env:      ${existsSync(ENV_FILE) ? "present" : "missing - run install"}`);
  info(`web deps:  ${existsSync(path.join(WEB, "node_modules")) ? "installed" : "missing - run install"}`);
}

function usage() {
  console.log(`
Wear Right tasks (the same command works on Windows, Linux and macOS)

  node scripts/wearright.mjs install
      Create apps/server/venv, apps/server/.env (with a random SECRET_KEY),
      and install the Python + Node packages.

  node scripts/wearright.mjs seed [--mannequin-kit PATH] [--skip-mannequin]
      Start Postgres/Mailpit, apply migrations, seed products, taxonomy,
      recommender tone rules, the demo customer and both admin logins. If the
      mannequin kit is present (extras/mannequin-alpha-kit by default), its
      layers and looks are imported and published for the demo. Use
      --skip-mannequin to skip that.

  node scripts/wearright.mjs build
      Create the production Next.js build (apps/web/.next).

  node scripts/wearright.mjs demo [--no-seed] [--skip-build]
      Start every Docker service (Postgres + Mailpit), migrate, seed the
      base demo data, build the web app, then run Django and next start.

  node scripts/wearright.mjs dev
      Start Docker, migrate and run Django + Next in development mode.

  node scripts/wearright.mjs db-up|db-down|db-reset
      Start / stop / destroy the Docker services.

  node scripts/wearright.mjs test      Run backend and web tests.
  node scripts/wearright.mjs doctor    Show what is installed.

On Linux/macOS the Makefile equivalents still work: make install, make demo-data, make build, make demo.
`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skip-mannequin") options.skipMannequin = true;
    else if (arg === "--no-seed") options.noSeed = true;
    else if (arg === "--skip-build") options.skipBuild = true;
    else if (arg === "--mannequin-kit") {
      const value = args[++index];
      if (!value || value.startsWith("--")) die("--mannequin-kit needs a folder path.");
      options.mannequinKit = value;
    }
    else if (arg.startsWith("--mannequin-kit=")) options.mannequinKit = arg.slice("--mannequin-kit=".length);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else die(`Unknown option: ${arg}\nRun with --help to see the available options.`);
  }
  return options;
}

const [command = "help", ...rest] = process.argv.slice(2);
const options = parseOptions(rest);

if (options.help) {
  usage();
  process.exit(0);
}

switch (command) {
  case "install":
    commandInstall();
    break;
  case "seed":
    commandSeed(options);
    break;
  case "build":
    commandBuild();
    break;
  case "demo":
    commandDemo(options);
    break;
  case "dev":
    commandDev();
    break;
  case "db-up":
    dbUp();
    break;
  case "db-down":
    dockerCompose(["down"]);
    break;
  case "db-reset":
    dockerCompose(["down", "-v"]);
    dbUp();
    break;
  case "test":
    commandTest();
    break;
  case "doctor":
    commandDoctor();
    break;
  case "help":
  case "--help":
  case "-h":
    usage();
    break;
  default:
    die(`Unknown command: ${command}\nRun with --help to see the available commands.`);
}

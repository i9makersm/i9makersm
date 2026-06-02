const fs = require("node:fs");
const path = require("node:path");
const { spawn, execSync } = require("node:child_process");

function loadEnvFile(envPath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, timeoutMs = 60000) {
  const url = `http://127.0.0.1:${port}/health`;
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }

  throw new Error(`Health check failed for ${url}: ${lastError?.message ?? "timeout"}`);
}

function portHealthy(port) {
  return fetch(`http://127.0.0.1:${port}/health`)
    .then((response) => response.ok)
    .catch(() => false);
}

async function startServer(scriptName, envOverrides = {}) {
  const child = spawn(npmCmd, ["run", scriptName], {
    cwd: process.cwd(),
    env: { ...process.env, ...envOverrides },
    stdio: ["ignore", "inherit", "inherit"],
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

async function main() {
  execSync(`${npmCmd} run db:bootstrap`, { stdio: "inherit", cwd: process.cwd() });

  const children = [];
  try {
    if (!(await portHealthy(4000))) {
      children.push(await startServer("dev:api"));
    }
    if (!(await portHealthy(4001))) {
      children.push(await startServer("dev:api2", { PORT: "4001" }));
    }

    await waitForHealth(4000);
    await waitForHealth(4001);

    console.log(JSON.stringify({ ok: true, verified: [4000, 4001] }, null, 2));
  } finally {
    for (const child of children.reverse()) {
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

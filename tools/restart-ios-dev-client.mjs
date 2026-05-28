#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const bundleId = "com.trustedriders.prototype";
const devClientScheme = process.env.TR_DEV_CLIENT_SCHEME ?? bundleId;
const metroPort = process.env.TR_METRO_PORT ?? "8081";
const metroBaseUrls = [`http://localhost:${metroPort}`, `http://127.0.0.1:${metroPort}`];
const metroBootTimeoutMs = 45_000;

async function main() {
  let metroBaseUrl = await getRunningMetroBaseUrl();
  if (!metroBaseUrl) {
    console.log("[ios:restart] Metro is not running. Starting Expo...");
    startMetro();
    metroBaseUrl = await waitForMetro();
  } else {
    console.log(`[ios:restart] Metro is already running at ${metroBaseUrl}.`);
  }

  const devClientUrl = `${devClientScheme}://expo-development-client/?url=${encodeURIComponent(metroBaseUrl)}`;
  await run("xcrun", ["simctl", "terminate", "booted", bundleId], { allowFailure: true });
  console.log(`[ios:restart] Opening ${devClientUrl}`);
  await run("xcrun", ["simctl", "openurl", "booted", devClientUrl]);
  console.log("[ios:restart] Relaunched TrustedRiders with the Expo development-client URL.");
}

async function getRunningMetroBaseUrl() {
  for (const baseUrl of metroBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(1200) });
      const text = await response.text();
      if (response.ok && text.trim() === "packager-status:running") {
        return baseUrl;
      }
    } catch {
      // Try the next localhost variant. Expo may bind IPv4 or IPv6 depending on the host.
    }
  }
  return null;
}

function startMetro() {
  const { command, args } = resolveNpmStartCommand();
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      EXPO_UNSTABLE_HEADLESS: "1",
      PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
    },
    stdio: "ignore",
  });
  child.unref();
}

function resolveNpmStartCommand() {
  const npmExecPath = process.env.npm_execpath;
  const startArgs = ["start", "--", "--dev-client", "--localhost", "--port", metroPort];

  if (npmExecPath && existsSync(npmExecPath)) {
    return { command: process.execPath, args: [npmExecPath, ...startArgs] };
  }

  const npmBinary = process.platform === "win32" ? "npm.cmd" : "npm";
  const siblingNpm = join(dirname(process.execPath), npmBinary);
  if (existsSync(siblingNpm)) {
    return { command: siblingNpm, args: startArgs };
  }

  const npmCli = join(dirname(dirname(process.execPath)), "lib/node_modules/npm/bin/npm-cli.js");
  if (existsSync(npmCli)) {
    return { command: process.execPath, args: [npmCli, ...startArgs] };
  }

  return { command: npmBinary, args: startArgs };
}

async function waitForMetro() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < metroBootTimeoutMs) {
    const metroBaseUrl = await getRunningMetroBaseUrl();
    if (metroBaseUrl) {
      console.log(`[ios:restart] Metro is ready at ${metroBaseUrl}.`);
      return metroBaseUrl;
    }
    await delay(1000);
  }

  throw new Error("Metro did not become ready within 45 seconds.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (stdout.trim()) process.stdout.write(stdout);
      if (stderr.trim()) process.stderr.write(stderr);
      if (error && !options.allowFailure) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

main().catch((error) => {
  console.error(`[ios:restart] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

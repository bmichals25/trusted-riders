#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const bundleId = "com.trustedriders.prototype";
const metroStatusUrl = "http://localhost:8081/status";
const devClientUrl = "trustedriders://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081";
const metroBootTimeoutMs = 45_000;

async function main() {
  if (!(await isMetroRunning())) {
    console.log("[ios:restart] Metro is not running. Starting Expo...");
    startMetro();
    await waitForMetro();
  } else {
    console.log("[ios:restart] Metro is already running.");
  }

  await run("xcrun", ["simctl", "terminate", "booted", bundleId], { allowFailure: true });
  await run("xcrun", ["simctl", "openurl", "booted", devClientUrl]);
  console.log("[ios:restart] Relaunched TrustedRiders with the Expo development-client URL.");
}

async function isMetroRunning() {
  try {
    const response = await fetch(metroStatusUrl, { signal: AbortSignal.timeout(1200) });
    const text = await response.text();
    return response.ok && text.trim() === "packager-status:running";
  } catch {
    return false;
  }
}

function startMetro() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCommand, ["start"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function waitForMetro() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < metroBootTimeoutMs) {
    if (await isMetroRunning()) {
      console.log("[ios:restart] Metro is ready.");
      return;
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

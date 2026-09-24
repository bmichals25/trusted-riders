// BEN-29: token in the secure store (with one-time migration out of AsyncStorage), push token
// unregistration and the full "trustedriders-*" wipe on sign-out.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

function loadTsModule(relativePath, mocks = {}, globals = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const context = {
    AbortController,
    clearTimeout,
    setTimeout,
    console,
    module,
    exports: module.exports,
    __DEV__: false,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith(".")) return {};
      throw new Error(`unexpected import ${specifier}`);
    },
    ...globals,
  };
  vm.runInNewContext(compiled, context, { filename });
  return module.exports;
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => (data.has(key) ? data.get(key) : null),
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
}

function fakeSecureStore() {
  const items = new Map();
  const calls = [];
  return {
    items,
    calls,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
    getValueWithKeyAsync: async (key, options) => {
      calls.push(["get", key, options]);
      return items.has(key) ? items.get(key) : null;
    },
    setValueWithKeyAsync: async (value, key, options) => {
      calls.push(["set", key, options]);
      items.set(key, value);
    },
    deleteValueWithKeyAsync: async (key, options) => {
      calls.push(["delete", key, options]);
      items.delete(key);
    },
  };
}

function loadSecureStore(native, storage) {
  return loadTsModule("lib/secure-token-store.ts", {
    expo: { requireOptionalNativeModule: (name) => (name === "ExpoSecureStore" ? native : null) },
    "react-native": { Platform: { OS: "ios" } },
    "./storage": storage,
  });
}

test("the token moves from AsyncStorage into the secure store once, then the plain copy is deleted", async () => {
  const native = fakeSecureStore();
  const storage = memoryStorage({ "trustedriders-auth-token": "legacy-jwt" });
  const store = loadSecureStore(native, storage);

  assert.equal(await store.getSecureItem("trustedriders-auth-token"), "legacy-jwt");
  assert.equal(native.items.get("trustedriders-auth-token"), "legacy-jwt");
  assert.equal(storage.data.has("trustedriders-auth-token"), false);
  // Readable while the phone is locked (background location task), never restored to another device.
  assert.deepEqual({ ...native.calls.find((c) => c[0] === "set")[2] }, { keychainAccessible: 7 });

  assert.equal(await store.getSecureItem("trustedriders-auth-token"), "legacy-jwt");

  await store.setSecureItem("trustedriders-auth-token", "new-jwt");
  assert.equal(native.items.get("trustedriders-auth-token"), "new-jwt");
  assert.equal(storage.data.has("trustedriders-auth-token"), false);

  await store.deleteSecureItem("trustedriders-auth-token");
  assert.equal(native.items.has("trustedriders-auth-token"), false);
  assert.equal(await store.getSecureItem("trustedriders-auth-token"), null);
});

test("without the native module (binary not rebuilt yet) the token stays in AsyncStorage", async () => {
  const storage = memoryStorage();
  const store = loadSecureStore(null, storage);
  assert.equal(store.isSecureStoreAvailable(), false);
  await store.setSecureItem("trustedriders-auth-token", "jwt");
  assert.equal(storage.data.get("trustedriders-auth-token"), "jwt");
  assert.equal(await store.getSecureItem("trustedriders-auth-token"), "jwt");
  await store.deleteSecureItem("trustedriders-auth-token");
  assert.equal(storage.data.has("trustedriders-auth-token"), false);
});

function loadPush({ granted = true, fetchCalls = [], expoToken = "ExponentPushToken[device]" } = {}) {
  const notifications = {
    getPermissionsAsync: async () => ({ granted, status: granted ? "granted" : "denied" }),
    requestPermissionsAsync: async () => {
      throw new Error("sign-out must never prompt for notification permission");
    },
    getExpoPushTokenAsync: async ({ projectId }) => {
      assert.equal(projectId, "project-123");
      return { data: expoToken };
    },
  };
  return loadTsModule(
    "lib/push-notifications.ts",
    {
      "expo-constants": { __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "project-123" } } } } },
      "expo-notifications": notifications,
      expo: { requireOptionalNativeModule: (name) => (name === "ExpoPushTokenManager" ? {} : null) },
      "react-native": { Platform: { OS: "ios" } },
      "./config": { FLEET_API_URL: "https://example.test" },
      "./demo-mode": { DEMO_MODE: false },
      "./fleet-api": { getToken: () => "jwt" },
    },
    {
      fetch: async (url, init) => {
        fetchCalls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
        return { ok: true, status: 200 };
      },
    },
  );
}

test("sign-out unregisters this device's push token", async () => {
  const fetchCalls = [];
  await loadPush({ fetchCalls }).unregisterPushToken();
  assert.deepEqual(fetchCalls, [{
    url: "https://example.test/api/push_tokens",
    method: "DELETE",
    body: JSON.stringify({ token: "ExponentPushToken[device]" }),
    auth: "Bearer jwt",
  }]);
});

test("no notification permission means no token to unregister (and no prompt)", async () => {
  const fetchCalls = [];
  await loadPush({ granted: false, fetchCalls }).unregisterPushToken();
  assert.deepEqual(fetchCalls, []);
});

test("sign-out wipes every trustedriders-* key; a session end drops ride PHI", async () => {
  const removedPrefixes = [];
  const removedKeys = [];
  let memoryCleared = 0;
  const sessionCache = loadTsModule("lib/session-cache.ts", {
    "./storage": {
      remove: async (key) => void removedKeys.push(key),
      removeByPrefix: async (prefix) => void removedPrefixes.push(prefix),
    },
    "./fleet-ride-detail-cache": {
      clearRideDetailCache: () => void (memoryCleared += 1),
      clearPersistedRideDetails: async () => void removedPrefixes.push("trustedriders-ride-detail:"),
    },
  });

  await sessionCache.clearSessionScopedCaches();
  assert.deepEqual(removedPrefixes, ["trustedriders-ride-detail:"]);
  assert.deepEqual(removedKeys.sort(), ["trustedriders-active-ride", "trustedriders-last-active-ride"]);

  await sessionCache.clearAllAppStorage();
  assert.deepEqual(removedPrefixes.at(-1), "trustedriders-");
  assert.equal(memoryCleared, 2);
});

test("no hardcoded sample ride is served when a ride detail fetch fails", () => {
  const source = fs.readFileSync(path.join(root, "lib/fleet-ride-detail-cache.ts"), "utf8");
  assert.doesNotMatch(source, /Fallback|William St|Greenwich St/);
});

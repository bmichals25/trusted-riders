// Dispatch chat: emoji-safe text (lib/chat-text.ts) and the message pipeline (lib/chat-api.ts).
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
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    console,
    Headers,
    AbortController,
    setTimeout,
    clearTimeout,
    ...globals,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith(".")) return {};
      throw new Error(`unexpected import ${specifier}`);
    },
  }, { filename });
  return module.exports;
}

const hasLoneSurrogate = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

// Run the helpers both with Intl.Segmenter (Node, browsers) and without it (Hermes on the phone).
const withSegmenter = loadTsModule("lib/chat-text.ts", {}, { Intl });
const withoutSegmenter = loadTsModule("lib/chat-text.ts", {}, { Intl: {} });

for (const [label, text] of [["Intl.Segmenter", withSegmenter], ["code-point fallback", withoutSegmenter]]) {
  test(`emoji survive previews and truncation (${label})`, () => {
    assert.equal(text.chatPreviewText("Thank you! 🙏"), "Thank you! 🙏");
    assert.equal(text.chatPreviewText("  On my way\n\n😊  "), "On my way 😊");

    // "Thank you! " is 11 UTF-16 units; slice(0, 12) would keep half of the 🙏 surrogate pair.
    const message = "Thank you! 🙏🙏 see you soon";
    assert.equal(hasLoneSurrogate(message.slice(0, 12)), true, "sanity: naive slicing breaks the emoji");
    for (let max = 1; max <= message.length + 2; max += 1) {
      const cut = text.truncateChatText(message, max);
      assert.equal(hasLoneSurrogate(cut), false, `max=${max} produced ${JSON.stringify(cut)}`);
    }
    assert.equal(text.truncateChatText(message, 13), "Thank you! 🙏…");
    assert.equal(text.truncateChatText("🙏", 1), "🙏");
    assert.equal(text.truncateChatText("short", 0), "");

    // Multi-code-point emoji stay whole.
    assert.deepEqual([...text.splitGraphemes("a👍🏽b")], ["a", "👍🏽", "b"]);
    assert.deepEqual([...text.splitGraphemes("👩‍⚕️!")], ["👩‍⚕️", "!"]);
    assert.deepEqual([...text.splitGraphemes("❤️🇺🇸")], ["❤️", "🇺🇸"]);
    assert.equal(text.truncateChatText("Nurse 👩‍⚕️ here", 7), "Nurse…"); // never a dangling space
    assert.equal(text.truncateChatText("Nurse 👩‍⚕️ here", 8), "Nurse 👩‍⚕️…");

    assert.equal(text.firstCharacter("dana"), "D");
    assert.equal(text.firstCharacter("🙂Dana"), "🙂");
    assert.equal(text.firstCharacter(""), "");
  });
}

test("the chat API keeps emoji intact from the backend's JSON", () => {
  const chatApi = loadTsModule("lib/chat-api.ts", {
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": {},
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "token" },
  });
  // Flask escapes non-ASCII as \uXXXX surrogate pairs; JSON.parse must give back the real emoji.
  const raw = JSON.parse('{"id":106,"text":"Thank you! \\ud83d\\ude4f \\ud83d\\ude0a","sender":"dispatcher"}');
  const message = chatApi.normalizeChatMessage(raw);
  assert.equal(message.text, "Thank you! 🙏 😊");
  assert.equal(hasLoneSurrogate(message.text), false);
});

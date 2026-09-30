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
// Hermes-like: Intl.Segmenter exists but its segments aren't iterable.
class BrokenSegmenter { segment() { return {}; } }
const brokenSegmenter = loadTsModule("lib/chat-text.ts", {}, { Intl: { Segmenter: BrokenSegmenter } });

for (const [label, text] of [
  ["Intl.Segmenter", withSegmenter],
  ["code-point fallback", withoutSegmenter],
  ["non-iterable Intl.Segmenter", brokenSegmenter],
]) {
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

test("the TR's own messages stay on the TR's side whoever wrote them", () => {
  const chatApi = loadTsModule("lib/chat-api.ts", {
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": {},
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "token" },
  });
  // What the backend stores for the TR: the app's sends and server-written ones (Ready to Return, ride
  // declines, GPS replies), plus "driver" from older builds; any case/spacing.
  for (const sender of ["trusted rider", "Trusted Rider", "TRUSTED_RIDER", "trustedrider", " driver ", "TR"]) {
    const m = chatApi.normalizeChatMessage({ id: 1, text: "On my way", sender, sender_name: "Marcus Bell",
      client_message_id: "shot-1" });
    assert.equal(m.sender, "driver", sender);
    assert.equal(m.sender_name, "Marcus Bell");
    assert.equal(chatApi.isOwnChatSender(sender), true, sender);
  }
  // Written from another device: no "driver-" client id, still ours.
  assert.equal(chatApi.normalizeChatMessage({ id: 2, text: "x", sender: "trusted rider", client_message_id: "" }).sender, "driver");
  // Dispatch stays on the other side.
  assert.equal(chatApi.normalizeChatMessage({ id: 3, text: "x", sender: "dispatcher" }).sender, "dispatch");
  assert.equal(chatApi.normalizeChatMessage({ id: 4, text: "x", sender: "admin" }).sender, "admin");
  assert.equal(chatApi.normalizeChatMessage({ id: 5, text: "x", sender: "system" }).sender, "system");
  assert.equal(chatApi.normalizeChatMessage({ id: 6, text: "x", sender: "Dana" }).sender, "admin");
  assert.equal(chatApi.isOwnChatSender("dispatcher"), false);
  assert.equal(chatApi.isOwnChatSender(undefined), false);

  // Sender photo fields come through; photo flags without an account are ignored.
  const withPhoto = chatApi.normalizeChatMessage({ id: 7, text: "x", sender: "dispatcher", sender_user_id: 8,
    sender_has_photo: true, sender_photo_updated_at: "2026-09-30T00:19:48Z" });
  assert.equal(withPhoto.sender_user_id, 8);
  assert.equal(withPhoto.sender_has_photo, true);
  assert.equal(withPhoto.sender_photo_updated_at, "2026-09-30T00:19:48Z");
  const noAccount = chatApi.normalizeChatMessage({ id: 8, text: "x", sender: "dispatcher", sender_has_photo: true });
  assert.equal(noAccount.sender_user_id, null);
  assert.equal(noAccount.sender_has_photo, false);
});

test("chat avatars load photos with the Authorization header, never a token in the URL", () => {
  const photo = loadTsModule("lib/chat-photo.ts", {
    "./config": { FLEET_API_URL: "https://api.example.test" },
    "./demo-mode": { DEMO_MODE: false },
  });
  const dana = { userId: 8, hasPhoto: true, photoUpdatedAt: "2026-09-30T00:19:48Z" };
  const src = photo.chatSenderPhotoSource(dana, false, "thumb", "secret-token");
  assert.equal(src.uri, "https://api.example.test/api/chat/participants/8/photo?size=thumb&v=2026-09-30T00%3A19%3A48Z");
  assert.equal(src.headers.Authorization, "Bearer secret-token");
  assert.equal(src.uri.includes("secret-token"), false);

  const mine = photo.chatSenderPhotoSource({ userId: 9, hasPhoto: true, photoUpdatedAt: null }, true, "thumb", "t");
  assert.equal(mine.uri, "https://api.example.test/api/me/photo?size=thumb");

  // Initials only: no photo, no account behind the message, signed out, demo data.
  assert.equal(photo.chatSenderPhotoSource({ ...dana, hasPhoto: false }, false, "thumb", "t"), null);
  assert.equal(photo.chatSenderPhotoSource({ ...dana, userId: null }, false, "thumb", "t"), null);
  assert.equal(photo.chatSenderPhotoSource(dana, false, "thumb", null), null);
  assert.equal(photo.chatSenderPhotoSource(dana, false, "thumb", "t", { demoMode: true }), null);
});

test("an avatar shows on the last bubble of each sender's run", () => {
  const model = loadTsModule("features/chat/chat-model.ts", { "@/lib/chat-api": { formatChatTimestamp: () => "" } });
  const msg = (id, sender, senderUserId, senderName) => ({ id, text: id, sender, senderUserId, senderName,
    timestamp: "", createdAt: "2026-09-29T19:00:00Z" });
  const messages = [
    msg("a", "admin", 8, "Dana Reyes"),
    msg("b", "admin", 8, "Dana Reyes"),
    msg("c", "admin", 12, "Eve Park"),
    msg("d", "operator", 9, "Marcus Bell"),
    msg("e", "operator", null, null), // a pending send: still the TR
    msg("f", "admin", null, "Dispatch"),
  ];
  assert.deepEqual(messages.map((_, i) => model.isLastInSenderRun(messages, i)), [false, true, true, false, true, true]);
});

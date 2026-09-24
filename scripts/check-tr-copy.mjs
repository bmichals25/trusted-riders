#!/usr/bin/env node
/**
 * BEN-14 copy sweep: list user-visible "driver"/"Driver" text (and the old one-word
 * "TrustedRider(s)") that should read "Trusted Rider" / "TR".
 *
 * Parses every source file with @babel/parser and only looks at string literals,
 * template-literal text and JSX text. It ignores:
 *   - comments, identifiers, imports/exports, object keys, TS types
 *   - strings in comparisons / switch cases / member access (API fields, status keys)
 *   - console.* calls (developer-only)
 *   - key-like strings with no spaces and no capitals ("driver", "/drivers", "driver-chat")
 *   - the canonical backend status strings ("driver accepted", ...)
 *   - entries in scripts/tr-copy-allowlist.txt ("path|exact text  # reason")
 *
 * Usage: node scripts/check-tr-copy.mjs [dir ...]   (default: app components features lib)
 * Exit code 1 when anything is found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const { parse } = require("@babel/parser");

const DEFAULT_DIRS = ["app", "components", "features", "lib"];
const EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "ios", "android", "tests", "__tests__"]);

const WORD = /\bdrivers?\b/i;
// Old one-word branding; the copy standard is "Trusted Rider(s)" (or "TR").
const ONE_WORD = /\bTrustedRiders?\b/;
const KEY_LIKE = /^[a-z0-9_./:#?=&{}$-]+$/; // no spaces, no capitals: route, key, field, css class
const CANONICAL = new Set([
  "driver declined",
  "scheduled-driver assigned",
  "driver accepted",
  "driver in transit",
  "driver at pickup",
  "driver/passenger in transit",
  "driver/passenger at dropoff",
]);

function loadAllowlist() {
  const file = join(ROOT, "scripts", "tr-copy-allowlist.txt");
  const set = new Set();
  if (!existsSync(file)) return set;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    set.add(line);
  }
  return set;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name)) && !/\.(test|spec)\./.test(name)) out.push(p);
  }
  return out;
}

const CODE_ATTRS = new Set(["className", "key", "to", "href", "id", "htmlFor", "name", "type", "testID", "nativeID", "value", "src", "path", "route", "icon"]);

function isConsoleCall(node) {
  const c = node.callee;
  return (
    c &&
    c.type === "MemberExpression" &&
    c.object.type === "Identifier" &&
    c.object.name === "console"
  );
}

/** Walk the AST, collecting candidate user-visible strings. */
function collect(ast, push) {
  const visit = (node, parent, parentKey, skip) => {
    if (!node || typeof node.type !== "string") return;
    let skipHere = skip;
    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "ExportNamedDeclaration":
        if (node.source) return; // re-export / import paths
        break;
      case "TSLiteralType":
      case "TSTypeAnnotation":
      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration":
        return;
      case "CallExpression":
        if (isConsoleCall(node)) return;
        if (node.callee.type === "Import" || (node.callee.type === "Identifier" && node.callee.name === "require")) return;
        break;
      case "BinaryExpression":
        if (["===", "!==", "==", "!="].includes(node.operator)) skipHere = true;
        break;
      case "SwitchCase":
        visit(node.test, node, "test", true);
        for (const s of node.consequent) visit(s, node, "consequent", skip);
        return;
      case "JSXAttribute": {
        const n = node.name && node.name.name;
        if (typeof n === "string" && (CODE_ATTRS.has(n) || n.startsWith("data-"))) return;
        break;
      }
      case "StringLiteral":
        if (skipHere) return;
        if (
          parent &&
          ((parent.type === "ObjectProperty" && parentKey === "key" && !parent.computed) ||
            (parent.type === "MemberExpression" && parentKey === "property") ||
            (parent.type === "OptionalMemberExpression" && parentKey === "property") ||
            parent.type === "ClassProperty" && parentKey === "key")
        )
          return;
        push(node.value, node.loc.start.line);
        return;
      case "TemplateElement":
        if (!skipHere) push(node.value.cooked ?? node.value.raw, node.loc.start.line);
        return;
      case "JSXText":
        push(node.value, node.loc.start.line);
        return;
      default:
        break;
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end" || key === "leadingComments" || key === "trailingComments" || key === "innerComments" || key === "extra") continue;
      const v = node[key];
      if (Array.isArray(v)) {
        for (const child of v) if (child && typeof child.type === "string") visit(child, node, key, skipHere);
      } else if (v && typeof v.type === "string") {
        visit(v, node, key, skipHere);
      }
    }
  };
  visit(ast.program, null, null, false);
}

const allow = loadAllowlist();
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS;
const files = dirs.flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d), []) : []));
let hits = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const code = readFileSync(file, "utf8");
  if (!WORD.test(code) && !ONE_WORD.test(code)) continue;
  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      errorRecovery: true,
      plugins: ["jsx", "typescript", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
    });
  } catch (e) {
    console.error(`?? ${rel}: parse error (${e.message})`);
    continue;
  }
  collect(ast, (text, line) => {
    const t = String(text).replace(/\s+/g, " ").trim();
    if (!t) return;
    if (!WORD.test(t) && !ONE_WORD.test(t)) return;
    if (CANONICAL.has(t)) return;
    if (KEY_LIKE.test(t)) return;
    if (allow.has(`${rel}|${t}`)) return;
    hits += 1;
    console.log(`${rel}:${line}: ${t.length > 160 ? t.slice(0, 157) + "..." : t}`);
  });
}

if (hits) {
  console.error(`\n${hits} user-visible "driver" string(s) found. Use "Trusted Rider" / "TR", or allowlist in scripts/tr-copy-allowlist.txt with a reason.`);
  process.exit(1);
}

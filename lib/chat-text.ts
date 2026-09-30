// Emoji-safe text helpers for chat previews, banners and initials.
//
// JavaScript strings are UTF-16: an emoji such as 🙏 is two code units (a surrogate pair), and 👍🏽 or 👩‍⚕️
// are several code points joined by modifiers. `text.slice(0, n)` or `name[0]` can cut one in half, and a
// lone surrogate renders as a "?" / "�" box. These helpers only ever cut between whole characters.

type Segmenter = { segment(input: string): Iterable<{ segment: string }> };

function graphemeSegmenter(): Segmenter | null {
  const Ctor = (globalThis as { Intl?: { Segmenter?: new (locale?: string, options?: object) => Segmenter } })
    .Intl?.Segmenter;
  if (typeof Ctor !== "function") return null;
  try {
    return new Ctor(undefined, { granularity: "grapheme" });
  } catch {
    return null;
  }
}

// Code points that attach to the character before them (so they must never start a new "character").
function isExtender(codePoint: number): boolean {
  return (
    codePoint === 0x200d || // zero-width joiner (family / profession emoji)
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // variation selectors (❤️ = ❤ + FE0F)
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) || // skin tones
    (codePoint >= 0x0300 && codePoint <= 0x036f) || // combining accents
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // combining marks for symbols (keycaps)
    (codePoint >= 0xe0020 && codePoint <= 0xe007f) // tag characters (flag subdivisions)
  );
}

/** The user-perceived characters of `text`: 🙏, 👍🏽 and 👩‍⚕️ each count as one. */
export function splitGraphemes(text: string): string[] {
  const segmenter = graphemeSegmenter();
  if (segmenter) {
    // Trust the engine's segmenter only when it round-trips: some runtimes expose Intl.Segmenter
    // whose segments aren't iterable (Array.from gives []), which would drop every character.
    try {
      const parts = Array.from(segmenter.segment(text) ?? [], (part) => part?.segment ?? "");
      if (parts.join("") === text) return parts;
    } catch {
      // fall through to the code-point splitter
    }
  }

  // Fallback (Hermes has no Intl.Segmenter): whole code points, with joiners/modifiers kept on the
  // character they belong to, and regional-indicator pairs (flags) kept together.
  const out: string[] = [];
  let previousWasJoiner = false;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const last = out.length - 1;
    const isRegional = codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
    const lastIsLoneRegional =
      last >= 0 && Array.from(out[last]).length === 1 && (out[last].codePointAt(0) ?? 0) >= 0x1f1e6 &&
      (out[last].codePointAt(0) ?? 0) <= 0x1f1ff;
    if (last >= 0 && (isExtender(codePoint) || previousWasJoiner || (isRegional && lastIsLoneRegional))) {
      out[last] += char;
    } else {
      out.push(char);
    }
    previousWasJoiner = codePoint === 0x200d;
  }
  return out;
}

/** At most `max` characters of `text` (emoji count as one), with "…" when something was cut. */
export function truncateChatText(text: string, max: number): string {
  if (max <= 0) return "";
  // Fast path: no cut needed when even the code-unit length fits.
  if (text.length <= max) return text;
  const parts = splitGraphemes(text);
  if (parts.length <= max) return text;
  return `${parts.slice(0, Math.max(0, max - 1)).join("").trimEnd()}…`;
}

/** One-line preview for banners and lists: whitespace collapsed, emoji kept whole. */
export function chatPreviewText(text: string, max = 140): string {
  const oneLine = String(text ?? "").replace(/\s+/g, " ").trim();
  return truncateChatText(oneLine, max);
}

/** First character of a word, uppercased (a whole emoji when the word starts with one). */
export function firstCharacter(word: string): string {
  const [first = ""] = splitGraphemes(word);
  return first.toUpperCase();
}

// Tiny markdown subset for the Trusted Rider agreement (BEN-20): "#"–"###"
// headings, paragraphs, "-"/"*" bullets, "1." numbered items, "> " callouts and
// **bold** inline. Anything else is shown as plain paragraph text. Keeps the
// agreement screen free of a markdown dependency.

export type InlineSpan = { text: string; bold: boolean };

export type AgreementBlock =
  | { type: "heading"; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "bullet"; spans: InlineSpan[] }
  | { type: "numbered"; number: string; spans: InlineSpan[] }
  | { type: "callout"; spans: InlineSpan[] };

/** "a **b** c" -> [{a, false}, {b, true}, {c, false}]. An unmatched "**" stays literal. */
export function parseInlineMarkdown(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = rest.indexOf("**");
    const close = open >= 0 ? rest.indexOf("**", open + 2) : -1;
    if (open < 0 || close < 0) {
      spans.push({ text: rest, bold: false });
      break;
    }
    if (open > 0) spans.push({ text: rest.slice(0, open), bold: false });
    const boldText = rest.slice(open + 2, close);
    if (boldText) spans.push({ text: boldText, bold: true });
    rest = rest.slice(close + 2);
  }
  return spans.filter((span) => span.text.length > 0);
}

export function parseAgreementMarkdown(markdown: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = [];
  let paragraph: string[] = [];
  let callout: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", spans: parseInlineMarkdown(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushCallout = () => {
    if (callout.length) blocks.push({ type: "callout", spans: parseInlineMarkdown(callout.join(" ")) });
    callout = [];
  };
  const flush = () => {
    flushParagraph();
    flushCallout();
  };

  for (const rawLine of String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        spans: parseInlineMarkdown(heading[2].trim()),
      });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      if (quote[1].trim()) callout.push(quote[1].trim());
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push({ type: "bullet", spans: parseInlineMarkdown(bullet[1].trim()) });
      continue;
    }
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flush();
      blocks.push({ type: "numbered", number: numbered[1], spans: parseInlineMarkdown(numbered[2].trim()) });
      continue;
    }
    flushCallout();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

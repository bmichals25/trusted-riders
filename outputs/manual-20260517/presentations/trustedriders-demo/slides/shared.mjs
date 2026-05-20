import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const asset = (name) => path.resolve(__dirname, "../assets", name);
export const brandLogo = path.resolve(__dirname, "../../../../../assets/TR_logo.png");

export const C = {
  bg: "#F2F5F9",
  paper: "#FFFFFF",
  ink: "#0F172A",
  mute: "#64748B",
  faint: "#E2E8F0",
  dark: "#0F172A",
  blue: "#2F66F2",
  green: "#16A34A",
  yellow: "#F8C21B",
  red: "#DC2626",
  cream: "#FFF2C7",
};

export function shape(ctx, slide, x, y, w, h, fill = C.paper, opts = {}) {
  return ctx.addShape(slide, {
    left: x,
    top: y,
    width: w,
    height: h,
    geometry: opts.geometry ?? "rect",
    fill,
    line: opts.line ?? ctx.line(opts.stroke ?? "#00000000", opts.strokeWidth ?? 0),
  });
}

export function text(ctx, slide, value, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text: value,
    left: x,
    top: y,
    width: w,
    height: h,
    fontSize: opts.size ?? 24,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    typeface: opts.face ?? "Aptos",
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    fill: "#00000000",
    line: ctx.line(),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  });
}

export function kicker(ctx, slide, label, x = 72, y = 52, color = C.blue) {
  shape(ctx, slide, x, y + 7, 11, 11, color);
  text(ctx, slide, label.toUpperCase(), x + 24, y, 480, 26, {
    size: 13,
    bold: true,
    color: C.mute,
  });
}

export function title(ctx, slide, value, x = 72, y = 92, w = 760, size = 46) {
  text(ctx, slide, value, x, y, w, 112, {
    size,
    bold: true,
    color: C.ink,
    face: "Aptos Display",
  });
}

export function footer(ctx, slide, n, note = "TrustedRiders mobile Expo app demo | screenshots captured from local demo API, May 17 2026") {
  shape(ctx, slide, 72, 676, 1136, 1, C.faint);
  text(ctx, slide, note, 72, 688, 880, 18, { size: 10, color: C.mute });
  text(ctx, slide, String(n).padStart(2, "0"), 1160, 684, 48, 24, {
    size: 13,
    bold: true,
    color: C.mute,
    align: "right",
  });
}

export function bullet(ctx, slide, label, body, x, y, w, color = C.blue) {
  shape(ctx, slide, x, y + 7, 10, 10, color);
  text(ctx, slide, label, x + 24, y, w - 24, 26, { size: 20, bold: true, color: C.ink });
  text(ctx, slide, body, x + 24, y + 28, w - 24, 46, { size: 14, color: C.mute });
}

export async function phone(ctx, slide, imageName, x, y, h, opts = {}) {
  const w = h * (390 / 844);
  shape(ctx, slide, x - 10, y - 10, w + 20, h + 20, "#D7DEE8");
  shape(ctx, slide, x - 4, y - 4, w + 8, h + 8, "#0B1220");
  await ctx.addImage(slide, {
    path: asset(imageName),
    left: x,
    top: y,
    width: w,
    height: h,
    fit: opts.fit ?? "cover",
    alt: opts.alt ?? imageName,
  });
  return { w, h };
}

export function statusPill(ctx, slide, label, x, y, fill, color = C.ink, w = 132) {
  shape(ctx, slide, x, y, w, 34, fill);
  text(ctx, slide, label.toUpperCase(), x, y + 8, w, 18, {
    size: 11,
    bold: true,
    color,
    align: "center",
  });
}

import { C, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  await phone(ctx, slide, "mobile-home-current-crop.png", 78, 54, 585);
  kicker(ctx, slide, "Home screen proof", 596, 68);
  title(ctx, slide, "Current ride view is the strongest demo moment.", 596, 108, 560, 41);
  text(ctx, slide, "The driver lands on a glanceable command surface: status, map context, pickup time, rider identity, pickup/drop-off, care notes, emergency contact, and live location state.", 596, 228, 532, 92, { size: 20, color: C.mute });
  shape(ctx, slide, 596, 354, 520, 1, C.faint);
  text(ctx, slide, "What it proves", 596, 382, 220, 28, { size: 18, bold: true, color: C.ink });
  text(ctx, slide, "1. Ride payload normalization is feeding real UI.\n2. Route coordinates can draw a map path.\n3. The app now feels like an operations tool, not a static prototype.", 596, 426, 520, 120, { size: 20, color: C.ink });
  shape(ctx, slide, 596, 588, 520, 44, "#FEF2F2");
  text(ctx, slide, "Needs cleanup: the dev build reports a nested <button> warning on this screen.", 612, 601, 488, 22, { size: 14, bold: true, color: C.red });
  footer(ctx, slide, 3);
  return slide;
}

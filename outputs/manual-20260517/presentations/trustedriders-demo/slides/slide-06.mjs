import { C, bullet, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  kicker(ctx, slide, "Driver operations");
  title(ctx, slide, "Settings shows the production readiness line.");
  text(ctx, slide, "The settings screen is valuable in the demo because it makes the remaining backend ownership explicit instead of hiding placeholder state.", 72, 204, 540, 74, { size: 20, color: C.mute });
  bullet(ctx, slide, "Operational toggles", "Live location, push notification intent, auto-accept, and haptics settings are represented.", 72, 324, 520, C.green);
  bullet(ctx, slide, "Backend-dependent identity", "Certifications and vehicle fields are still marked pending because /api/me is not deployed yet.", 72, 436, 520, C.red);
  bullet(ctx, slide, "Demo framing", "Use this slide to explain what is product-complete versus what still needs live backend data.", 72, 548, 520, C.blue);
  await phone(ctx, slide, "mobile-settings.png", 746, 54, 596);
  footer(ctx, slide, 6);
  return slide;
}

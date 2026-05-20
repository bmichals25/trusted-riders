import { C, bullet, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  kicker(ctx, slide, "Current capability");
  title(ctx, slide, "What works today");
  text(ctx, slide, "The mobile app now has the core driver loop visible in one place: sign in, see the current ride, review trip context, launch the mission, and share live location.", 72, 206, 570, 74, { size: 20, color: C.mute });
  bullet(ctx, slide, "Backend-authenticated entry", "Login posts to the Fleet API, persists JWT state, and gates the app behind the driver session.", 72, 314, 520, C.green);
  bullet(ctx, slide, "Ride polling and enrichment", "The app reads ride lists plus per-ride detail payloads for coordinates, addresses, notes, and metadata.", 72, 410, 520, C.blue);
  bullet(ctx, slide, "Live operations surface", "Current ride, scheduled rides, pending requests, status notices, and location indicator are wired into the driver shell.", 72, 506, 520, C.yellow);
  await phone(ctx, slide, "mobile-login.png", 728, 84, 522);
  await phone(ctx, slide, "mobile-home-current-crop.png", 940, 84, 522);
  footer(ctx, slide, 2);
  return slide;
}

import { C, brandLogo, footer, kicker, phone, shape, statusPill, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  shape(ctx, slide, 0, 0, ctx.W, 720, C.dark);
  await ctx.addImage(slide, { path: brandLogo, left: 72, top: 56, width: 280, height: 78, fit: "contain", alt: "TrustedRiders logo" });
  kicker(ctx, slide, "Mobile prototype status", 72, 166, C.green);
  title(ctx, slide, "The driver app is demoable, but not yet production complete.", 72, 210, 610, 45);
  text(ctx, slide, "Expo / React Native mobile app focused on authenticated drivers, live rides, mission execution, location sharing, and backend integration with Suresh's Fleet API.", 72, 340, 560, 92, { size: 21, color: "#D9E3F0" });
  statusPill(ctx, slide, "Demoable now", 72, 474, "#DCFCE7", C.green, 170);
  statusPill(ctx, slide, "Backend gaps", 260, 474, "#FEF3C7", "#B45309", 170);
  statusPill(ctx, slide, "UI cleanup", 448, 474, "#FEE2E2", C.red, 144);
  await phone(ctx, slide, "mobile-home-current-crop.png", 746, 76, 560);
  await phone(ctx, slide, "mobile-active-mission.png", 954, 120, 500);
  footer(ctx, slide, 1, "TrustedRiders mobile Expo app demo | local demo API used for screenshot data");
  return slide;
}

import { C, bullet, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  await phone(ctx, slide, "mobile-active-mission.png", 72, 52, 596);
  kicker(ctx, slide, "Mission mode", 590, 68, C.green);
  title(ctx, slide, "Active mission flow is in place.", 590, 108, 560, 48);
  text(ctx, slide, "The mission screen gives the driver a map-first workflow with staged progress, navigation launch, passenger action, support/help, emergency escalation, and background location tracking hooks.", 590, 204, 540, 100, { size: 20, color: C.mute });
  bullet(ctx, slide, "Driver guidance", "Four-step mission model tracks pickup, facility arrival, return pickup, and arrival home.", 590, 342, 520, C.blue);
  bullet(ctx, slide, "Backend telemetry", "Mission screen sets active ride context for foreground and background location pings.", 590, 448, 520, C.green);
  bullet(ctx, slide, "Remaining risk", "Status transitions need live backend confirmation and error recovery, especially after app backgrounding.", 590, 554, 520, C.red);
  footer(ctx, slide, 5);
  return slide;
}

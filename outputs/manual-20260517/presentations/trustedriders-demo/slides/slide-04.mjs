import { C, bullet, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  kicker(ctx, slide, "Ride request");
  title(ctx, slide, "Pending rides are reviewable, actionable, and map-backed.");
  text(ctx, slide, "This is the handoff point between dispatch assignment and driver acceptance. It is ready for a demo of intended workflow, while the accept/decline backend contract still needs production hardening.", 72, 210, 555, 92, { size: 19, color: C.mute });
  bullet(ctx, slide, "Done", "Route preview, rider details, pickup/drop-off, care notes, and decision controls render cleanly.", 72, 336, 520, C.green);
  bullet(ctx, slide, "Still needed", "Backend-owned accept/decline endpoint behavior and status reconciliation need to be completed and verified against live data.", 72, 448, 520, C.red);
  await phone(ctx, slide, "mobile-ride-details-pending.png", 746, 54, 596);
  footer(ctx, slide, 4);
  return slide;
}

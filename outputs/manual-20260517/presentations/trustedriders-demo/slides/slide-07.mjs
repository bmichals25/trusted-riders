import { C, bullet, footer, kicker, phone, shape, text, title } from "./shared.mjs";

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  await phone(ctx, slide, "mobile-admin-chat.png", 78, 70, 560);
  kicker(ctx, slide, "Open work", 596, 70, C.red);
  title(ctx, slide, "The gaps are mostly integration endpoints and hardening.", 596, 110, 560, 44);
  bullet(ctx, slide, "Admin-driver chat", "The UI route exists, but live chat backend is unavailable in the current mobile demo path.", 596, 256, 520, C.red);
  bullet(ctx, slide, "Push registration", "POST /api/register-push-token is documented as not deployed on the live backend.", 596, 360, 520, C.yellow);
  bullet(ctx, slide, "Driver profile", "GET /api/me is still needed to replace settings/profile placeholders.", 596, 464, 520, C.blue);
  bullet(ctx, slide, "Production polish", "Resolve nested button warning, validation/error states, and TestFlight permission copy before a broader pilot.", 596, 568, 520, C.green);
  footer(ctx, slide, 7);
  return slide;
}

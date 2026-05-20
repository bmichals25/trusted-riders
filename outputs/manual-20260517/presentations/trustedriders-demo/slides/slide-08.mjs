import { C, footer, kicker, shape, statusPill, text, title } from "./shared.mjs";

function row(ctx, slide, y, label, owner, status, fill) {
  text(ctx, slide, label, 102, y, 560, 28, { size: 21, bold: true, color: C.ink });
  text(ctx, slide, owner, 690, y + 2, 180, 24, { size: 15, color: C.mute });
  statusPill(ctx, slide, status, 940, y - 2, fill, status === "done" ? C.green : status === "blocked" ? C.red : "#B45309", 150);
  shape(ctx, slide, 102, y + 54, 988, 1, C.faint);
}

export async function addSlide(presentation, ctx) {
  const slide = presentation.slides.add();
  shape(ctx, slide, 0, 0, ctx.W, ctx.H, C.bg);
  kicker(ctx, slide, "Recommended demo narrative");
  title(ctx, slide, "Show the app as a working driver loop with a clear backend punch list.", 72, 104, 960, 44);
  text(ctx, slide, "The deck should lead with confidence, then be specific about what remains. That creates trust: the app is real enough to demo, and the open work is tractable.", 72, 210, 920, 54, { size: 21, color: C.mute });
  shape(ctx, slide, 72, 312, 1060, 282, C.paper);
  row(ctx, slide, 350, "Demo auth, current ride, ride request, and mission flow", "Mobile app", "done", "#DCFCE7");
  row(ctx, slide, 424, "Wire deployed accept/decline, push token, chat, and /api/me", "Backend", "blocked", "#FEE2E2");
  row(ctx, slide, 498, "Fix nested button warning and final permission/error states", "Mobile app", "next", "#FEF3C7");
  text(ctx, slide, "Suggested live demo order: sign in → current ride → ride request detail → active mission → settings → remaining backend work.", 102, 616, 940, 28, { size: 18, bold: true, color: C.ink });
  footer(ctx, slide, 8);
  return slide;
}

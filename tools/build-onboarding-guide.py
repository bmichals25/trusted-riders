#!/usr/bin/env python3
"""Build the TrustedRide Certified team onboarding PDF."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
ASSET_DIR = DOCS_DIR / "onboarding-guide-assets"
OUTPUT_PDF = DOCS_DIR / "TrustedRide-Certified-Team-Onboarding-Guide.pdf"

TRC_LOGO = ROOT / "assets" / "trustedride_certified_main_logo_transparent.png"
APP_ICON = ROOT / "assets" / "TRC_APP_ICON_2.png"
MUSE_LOGO = Path("/Users/benmichals/Documents/MuseLabs Website/public/logo.png")
CONTACT_SHEET = ROOT / "tmp" / "trustedriders-demo-contact-sheet.jpg"

DEFAULT_TESTFLIGHT_URL = "https://testflight.apple.com/join/dkszr1ry"
TESTFLIGHT_URL = os.environ.get("TRUSTEDRIDERS_TESTFLIGHT_URL", DEFAULT_TESTFLIGHT_URL)

PAGE_W, PAGE_H = letter
MARGIN = 42
FONT_REGULAR = "AppSystem"
FONT_MEDIUM = "AppSystemMedium"
FONT_BOLD = "AppSystemBold"

NAVY = colors.HexColor("#0F172A")
NAVY_2 = colors.HexColor("#1E293B")
BLUE = colors.HexColor("#2563EB")
BLUE_DARK = colors.HexColor("#1D4ED8")
INK = colors.HexColor("#122033")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F4F7FA")
LIGHTER = colors.HexColor("#FCFDFE")
LINE = colors.HexColor("#E2E8F0")
AMBER = colors.HexColor("#D97706")
AMBER_DARK = colors.HexColor("#92400E")
AMBER_SOFT = colors.HexColor("#FEF3C7")
BLUE_SOFT = colors.HexColor("#DBEAFE")
GREEN = colors.HexColor("#16A34A")


def ensure_dirs() -> None:
    DOCS_DIR.mkdir(exist_ok=True)
    ASSET_DIR.mkdir(exist_ok=True)


def register_pdf_fonts() -> None:
    font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
    try:
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, font_path, subfontIndex=0))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, font_path, subfontIndex=1))
        pdfmetrics.registerFont(TTFont(FONT_MEDIUM, font_path, subfontIndex=10))
    except Exception:
        globals()["FONT_REGULAR"] = "Helvetica"
        globals()["FONT_MEDIUM"] = "Helvetica-Bold"
        globals()["FONT_BOLD"] = "Helvetica-Bold"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=size, index=1 if bold else 0)
    except OSError:
        pass
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_rectangle(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill,
    outline=None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_phone_chrome(draw: ImageDraw.ImageDraw) -> None:
    draw.text((48, 22), "9:41", font=font(19, True), fill="#111827")
    rounded_rectangle(draw, (154, 20, 236, 47), 16, "#111111")
    draw.text((302, 24), "Wi-Fi", font=font(11, True), fill="#111827")
    rounded_rectangle(draw, (342, 24, 374, 39), 5, None, outline="#111827", width=2)
    rounded_rectangle(draw, (346, 27, 366, 36), 3, "#111827")


def paste_centered(base: Image.Image, image_path: Path, box: tuple[int, int, int, int]) -> None:
    image = Image.open(image_path).convert("RGBA")
    x1, y1, x2, y2 = box
    max_w = x2 - x1
    max_h = y2 - y1
    image.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = x1 + (max_w - image.width) // 2
    y = y1 + (max_h - image.height) // 2
    base.alpha_composite(image, (x, y))


def crop_contact_sheet() -> dict[str, Path]:
    crops = {
        "home": (0, 0),
        "ride_detail": (2, 0),
        "chat": (0, 1),
        "schedule": (0, 3),
        "settings": (1, 4),
    }
    out: dict[str, Path] = {}
    sheet = Image.open(CONTACT_SHEET).convert("RGB")
    panel_w = sheet.width // 5
    panel_h = sheet.height // 5
    for name, (col, row) in crops.items():
        crop = sheet.crop((col * panel_w, row * panel_h, (col + 1) * panel_w, (row + 1) * panel_h))
        crop = crop.resize((390, 844), Image.Resampling.LANCZOS)
        path = ASSET_DIR / f"{name}.jpg"
        crop.save(path, quality=94)
        out[name] = path
    return out


def make_login_screen() -> Path:
    img = Image.new("RGBA", (390, 844), "#eef3fa")
    draw = ImageDraw.Draw(img)
    draw_phone_chrome(draw)
    rounded_rectangle(draw, (30, 92, 360, 720), 18, "#ffffff", outline="#dbe5f2", width=1)
    paste_centered(img, TRC_LOGO, (56, 124, 334, 220))

    draw.text((56, 266), "Email", font=font(16, True), fill="#122033")
    rounded_rectangle(draw, (56, 292, 334, 348), 8, "#f8fafc", outline="#cbd8ea", width=2)
    draw.text((74, 311), "you@trustedriders.org", font=font(16), fill="#59687a")

    draw.text((56, 382), "Password", font=font(16, True), fill="#122033")
    rounded_rectangle(draw, (56, 408, 334, 464), 8, "#f8fafc", outline="#cbd8ea", width=2)
    draw.text((74, 427), "**********", font=font(18), fill="#59687a")
    draw.text((286, 428), "Show", font=font(13, True), fill="#1559dc")

    rounded_rectangle(draw, (56, 508, 334, 568), 8, "#071b3d")
    draw.text((160, 528), "Sign In", font=font(17, True), fill="#ffffff")
    draw.text((56, 604), "Use the account assigned by dispatch or build owner.", font=font(13), fill="#59687a")
    draw.text((56, 624), "Example text is not a shared team password.", font=font(13), fill="#59687a")

    path = ASSET_DIR / "login-example.png"
    img.convert("RGB").save(path, quality=95)
    return path


def make_location_screen() -> Path:
    img = Image.new("RGBA", (390, 844), "#eef3fa")
    draw = ImageDraw.Draw(img)
    draw_phone_chrome(draw)
    rounded_rectangle(draw, (34, 168, 356, 592), 18, "#ffffff", outline="#dbe5f2", width=1)
    rounded_rectangle(draw, (152, 214, 238, 300), 16, "#1559dc")
    draw.ellipse((175, 237, 215, 277), fill="#ffffff")
    draw.ellipse((187, 249, 203, 265), fill="#1559dc")
    draw.text((95, 336), "Turn on location", font=font(26, True), fill="#071b3d")
    wrapped = [
        "TrustedRide Certified needs",
        "location access for maps,",
        "pickup navigation, and dispatch",
        "updates during active rides.",
    ]
    y = 382
    for line in wrapped:
        w = draw.textlength(line, font=font(15, True))
        draw.text(((390 - w) / 2, y), line, font=font(15, True), fill="#59687a")
        y += 24
    rounded_rectangle(draw, (64, 500, 326, 560), 8, "#1559dc")
    draw.text((129, 520), "Enable Tracking", font=font(16, True), fill="#ffffff")

    rounded_rectangle(draw, (42, 628, 348, 742), 16, "#ffffff", outline="#cbd8ea", width=1)
    draw.text((71, 654), '"TrustedRide" Would Like', font=font(16, True), fill="#122033")
    draw.text((98, 677), "to Use Your Location", font=font(16, True), fill="#122033")
    draw.line((42, 705, 348, 705), fill="#dbe5f2", width=1)
    draw.text((99, 718), "Allow While Using App", font=font(16, True), fill="#1559dc")

    path = ASSET_DIR / "location-example.png"
    img.convert("RGB").save(path, quality=95)
    return path


def make_testflight_screen() -> Path:
    img = Image.new("RGBA", (390, 844), "#f3f6fb")
    draw = ImageDraw.Draw(img)
    draw_phone_chrome(draw)
    draw.text((36, 88), "TestFlight", font=font(34, True), fill="#071b3d")
    rounded_rectangle(draw, (30, 148, 360, 480), 18, "#ffffff", outline="#dbe5f2", width=1)
    paste_centered(img, APP_ICON, (132, 185, 258, 311))
    draw.text((82, 332), "TrustedRide Certified", font=font(24, True), fill="#122033")
    draw.text((137, 363), "Prototype", font=font(15), fill="#59687a")
    rounded_rectangle(draw, (110, 406, 280, 460), 10, "#1559dc")
    draw.text((165, 423), "Install", font=font(17, True), fill="#ffffff")

    rounded_rectangle(draw, (30, 530, 360, 695), 16, "#ffffff", outline="#dbe5f2", width=1)
    draw.text((56, 558), "Quick check", font=font(18, True), fill="#071b3d")
    checks = ["Open the QR link on iPhone", "Accept the beta invite", "Install, then launch the app"]
    y = 594
    for item in checks:
        draw.ellipse((56, y + 2, 76, y + 22), fill="#18a058")
        draw.text((61, y + 1), "+", font=font(15, True), fill="#ffffff")
        draw.text((88, y), item, font=font(15), fill="#122033")
        y += 34

    path = ASSET_DIR / "testflight-example.png"
    img.convert("RGB").save(path, quality=95)
    return path


def prepare_assets() -> dict[str, Path]:
    ensure_dirs()
    assets = crop_contact_sheet()
    assets["login"] = make_login_screen()
    assets["location"] = make_location_screen()
    assets["testflight"] = make_testflight_screen()
    return assets


def framed_phone_asset(image_path: Path) -> Path:
    out = ASSET_DIR / f"{image_path.stem}-phone-frame.png"
    source = Image.open(image_path).convert("RGB")
    border = 14
    body_w = source.width + border * 2
    body_h = source.height + border * 2
    frame = Image.new("RGBA", (body_w, body_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((0, 0, body_w, body_h), radius=42, fill="#111827")

    screen_mask = Image.new("L", source.size, 0)
    mask_draw = ImageDraw.Draw(screen_mask)
    mask_draw.rounded_rectangle((0, 0, source.width, source.height), radius=28, fill=255)
    frame.paste(source.convert("RGBA"), (border, border), screen_mask)

    # Restore a crisp device edge after the clipped screen is seated inside.
    draw.rounded_rectangle((0, 0, body_w - 1, body_h - 1), radius=42, outline="#111827", width=7)
    frame.save(out)
    return out


def wrapped_lines(text: str, width: float, font_name: str, font_size: float) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_wrapped(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font_name: str = FONT_REGULAR,
    font_size: float = 10.8,
    leading: float | None = None,
    color=INK,
) -> float:
    leading = leading or font_size * 1.48
    c.setFont(font_name, font_size)
    c.setFillColor(color)
    for line in wrapped_lines(text, width, font_name, font_size):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_qr(c: canvas.Canvas, data: str, x: float, y: float, size: float) -> None:
    code = qr.QrCodeWidget(data)
    bounds = code.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(code)
    renderPDF.draw(drawing, c, x, y)


def round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, r: float, fill, stroke=None) -> None:
    c.setFillColor(fill)
    if stroke is None:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)
    else:
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)


def label(c: canvas.Canvas, text: str, x: float, y: float, color=BLUE) -> None:
    c.setFillColor(color)
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(x, y, text.upper())


def title_block(c: canvas.Canvas, step: str, title: str, subtitle: str, y: float = 662, width: float = 448) -> float:
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(MARGIN, y + 36, step.upper())
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 29)
    y = draw_wrapped(c, title, MARGIN, y, width, FONT_BOLD, 29, 33, NAVY)
    y -= 7
    return draw_wrapped(c, subtitle, MARGIN, y, width, FONT_REGULAR, 11.6, 16.6, MUTED)


def page_shell(c: canvas.Canvas, section: str, page_num: int) -> None:
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.drawImage(str(TRC_LOGO), MARGIN, PAGE_H - 68, width=160, height=48, mask="auto", preserveAspectRatio=True)
    if MUSE_LOGO.exists():
        c.drawImage(str(MUSE_LOGO), PAGE_W - MARGIN - 102, PAGE_H - 58, width=24, height=24, mask="auto")
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 13.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 52, "MuseLabs")
    c.setFillColor(MUTED)
    c.setFont(FONT_BOLD, 8.4)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 88, section.upper())
    c.setFillColor(MUTED)
    c.setFont(FONT_REGULAR, 8.4)
    c.drawString(MARGIN, 24, "TrustedRide Certified app onboarding")
    c.drawRightString(PAGE_W - MARGIN, 24, f"Page {page_num}")


def draw_phone(c: canvas.Canvas, image_path: Path, x: float, y: float, height: float, caption: str) -> tuple[float, float]:
    image_path = framed_phone_asset(image_path)
    image = Image.open(image_path)
    width = height * image.width / image.height
    c.drawImage(str(image_path), x, y, width=width, height=height, preserveAspectRatio=True, mask="auto")
    c.setFillColor(MUTED)
    c.setFont(FONT_BOLD, 7.7)
    c.drawCentredString(x + width / 2, y - 17, caption.upper())
    return width, height


def numbered_list(c: canvas.Canvas, items: Iterable[str], x: float, y: float, width: float) -> float:
    for index, item in enumerate(items, 1):
        c.setFillColor(BLUE)
        c.circle(x + 9, y + 1, 9, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 8.6)
        c.drawCentredString(x + 9, y - 2, str(index))
        y = draw_wrapped(c, item, x + 30, y, width - 30, FONT_REGULAR, 10.9, 15.8, INK)
        y -= 10
    return y


def bullets(c: canvas.Canvas, items: Iterable[str], x: float, y: float, width: float, color=INK) -> float:
    for item in items:
        c.setFillColor(BLUE)
        c.circle(x + 4, y + 3, 3, fill=1, stroke=0)
        y = draw_wrapped(c, item, x + 17, y, width - 17, FONT_REGULAR, 10.8, 15.8, color)
        y -= 7
    return y


def info_panel(c: canvas.Canvas, title: str, body: str, x: float, y: float, w: float, h: float, tone: str = "blue") -> None:
    fill = {"blue": BLUE_SOFT, "amber": AMBER_SOFT, "neutral": LIGHT}.get(tone, BLUE_SOFT)
    accent = {"blue": BLUE_DARK, "amber": AMBER_DARK, "neutral": NAVY}.get(tone, BLUE_DARK)
    round_rect(c, x, y, w, h, 8, fill)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 8.4)
    c.drawString(x + 16, y + h - 24, title.upper())
    draw_wrapped(c, body, x + 16, y + h - 45, w - 32, FONT_REGULAR, 10.4, 15, INK)


def cover_page(c: canvas.Canvas) -> None:
    rail_w = 252
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, 0, rail_w, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY_2)
    c.rect(0, 0, rail_w, 172, fill=1, stroke=0)

    c.drawImage(str(TRC_LOGO), 32, 674, width=178, height=58, mask="auto", preserveAspectRatio=True)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 32)
    c.drawString(34, 592, "Team")
    c.drawString(34, 552, "Onboarding")
    c.drawString(34, 512, "Guide")
    c.setFont(FONT_REGULAR, 12.2)
    draw_wrapped(c, "Install, sign in, approve location, and run the first TrustedRide Certified beta workflow.", 34, 458, 182, FONT_REGULAR, 12.2, 17.4, colors.HexColor("#CBD5E1"))
    c.setFont(FONT_BOLD, 8.4)
    c.setFillColor(colors.HexColor("#CBD5E1"))
    c.drawString(34, 112, "PREPARED JUNE 4, 2026")
    if MUSE_LOGO.exists():
        c.drawImage(str(MUSE_LOGO), 34, 70, width=24, height=24, mask="auto")
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 14)
    c.drawString(64, 76, "MuseLabs")

    right_x = 292
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(right_x, 696, "PUBLIC TESTFLIGHT INVITE")
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 28)
    c.drawString(right_x, 652, "Scan to install")
    draw_wrapped(c, "Open this QR on the tester's iPhone, accept the beta invite, then install TrustedRide Certified through TestFlight.", right_x, 620, 244, FONT_REGULAR, 11.4, 16.2, MUTED)

    round_rect(c, right_x, 392, 238, 190, 8, LIGHT)
    draw_qr(c, TESTFLIGHT_URL, right_x + 22, 420, 140)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 11.6)
    c.drawString(right_x + 176, 508, "TestFlight")
    c.drawString(right_x + 176, 492, "invite")
    c.setFillColor(MUTED)
    c.setFont(FONT_REGULAR, 7.6)
    c.drawString(right_x + 176, 470, "testflight.apple.com")
    c.drawString(right_x + 176, 458, "/join/dkszr1ry")

    label(c, "Guide contents", right_x, 316)
    bullets(
        c,
        [
            "Install the iOS beta and open the app.",
            "Sign in with assigned tester credentials.",
            "Approve location access before the first ride.",
            "Use current ride, chat, schedule, and settings.",
        ],
        right_x,
        288,
        248,
    )
    c.showPage()


def page_install(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "01 install", 2)
    title_block(c, "01 / Install", "Install through TestFlight", "Use the public beta invitation on the same iPhone that will run the app.", width=342)
    label(c, "Install steps", MARGIN, 538)
    numbered_list(
        c,
        [
            "Scan the QR code or open the TestFlight invitation link on the tester's iPhone.",
            "Install Apple's TestFlight app if iOS asks for it.",
            "Tap Accept, then Install for TrustedRide Certified.",
            "Open the app from the home screen or from TestFlight.",
        ],
        MARGIN,
        508,
        278,
    )
    info_panel(c, "Public beta link", TESTFLIGHT_URL, MARGIN, 140, 278, 74, "blue")
    draw_phone(c, assets["testflight"], 386, 176, 410, "TestFlight install")
    c.showPage()


def page_login(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "02 sign in", 3)
    title_block(c, "02 / Sign in", "Use assigned credentials", "Each tester should use an assigned Trusted Rider account. The sample email shown in this guide is placeholder text.", width=430)
    draw_phone(c, assets["login"], 74, 118, 430, "Sign-in screen")
    x = 320
    label(c, "Credential checklist", x, 532)
    numbered_list(
        c,
        [
            "Enter the assigned Trusted Rider email.",
            "Enter the assigned password.",
            "Tap Sign In and wait for the ride home screen.",
        ],
        x,
        502,
        222,
    )
    info_panel(
        c,
        "If sign-in fails",
        "Confirm the account exists, then check whether the phone can reach the Fleet API network. Network failures can look like invalid credentials.",
        x,
        188,
        222,
        126,
        "amber",
    )
    c.showPage()


def page_location(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "03 location setup", 4)
    title_block(c, "03 / Location", "Approve location access", "Location access is required for route maps, pickup navigation, and dispatch visibility during active ride work.", width=430)
    draw_phone(c, assets["location"], 64, 106, 430, "Location gate")
    x = 318
    label(c, "First launch", x, 532)
    numbered_list(
        c,
        [
            "Tap Enable Tracking when the app asks for setup.",
            "When iOS prompts, choose Allow While Using App.",
            "If iOS later asks about background location for active rides, approve according to team testing policy.",
            "If location was denied, open iPhone Settings and set Location back to Allow.",
        ],
        x,
        502,
        232,
    )
    info_panel(c, "Why it matters", "Location powers your map, pickup routing, and live dispatch visibility during active rides.", x, 118, 232, 92, "blue")
    c.showPage()


def page_ride(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "04 ride workflow", 5)
    title_block(c, "04 / Ride Workflow", "Run the daily ride workflow", "The Home tab keeps the active assignment visible. Ride Detail provides pickup, dropoff, notes, and navigation context.", width=448)
    draw_phone(c, assets["home"], 74, 196, 360, "Home: current ride")
    draw_phone(c, assets["ride_detail"], 330, 196, 360, "Ride detail")
    label(c, "Operating rhythm", MARGIN, 148)
    bullets(
        c,
        [
            "Keep Home open while waiting for current or upcoming rides.",
            "Pull to refresh if dispatch says a ride was assigned but it has not appeared.",
            "Open Ride Detail before moving so pickup, dropoff, notes, and vehicle needs are clear.",
        ],
        MARGIN,
        124,
        514,
    )
    c.showPage()


def page_messages(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "05 dispatch messages", 6)
    title_block(c, "05 / Messages", "Confirm with dispatch", "Use Messages for short confirmations and updates tied to the active ride.", width=430)
    draw_phone(c, assets["chat"], 72, 104, 472, "Dispatch messages")
    x = 318
    label(c, "Use messages for", x, 522)
    bullets(
        c,
        [
            "Confirm you are en route.",
            "Report pickup readiness or arrival context.",
            "Keep updates short and tied to the active ride.",
        ],
        x,
        494,
        226,
    )
    info_panel(c, "Team expectation", "Messages should support the ride workflow, not replace dispatch policy or urgent phone communication.", x, 216, 226, 100, "neutral")
    c.showPage()


def page_schedule_settings(c: canvas.Canvas, assets: dict[str, Path]) -> None:
    page_shell(c, "06 schedule and settings", 7)
    title_block(c, "06 / Schedule + Settings", "Review future work and session state", "Use Schedule to preview assignments. Use Settings to verify chaperone, location, haptics, and sign-out state.", width=462)
    draw_phone(c, assets["schedule"], 90, 188, 330, "Schedule")
    draw_phone(c, assets["settings"], 346, 188, 330, "Settings")
    label(c, "End-of-session check", MARGIN, 132)
    bullets(
        c,
        [
            "Review tomorrow's assigned rides before a testing shift.",
            "Confirm the active chaperone and live location state.",
            "Sign out after shared-device testing.",
        ],
        MARGIN,
        108,
        514,
    )
    c.showPage()


def page_handoff(c: canvas.Canvas) -> None:
    page_shell(c, "07 team handoff", 8)
    title_block(c, "07 / Team Handoff", "Quick checks before distribution", "Use this page when inviting testers or diagnosing the first launch on an iPhone.", width=430)
    round_rect(c, MARGIN, 400, 250, 150, 8, LIGHT)
    label(c, "Tester packet", MARGIN + 16, 516)
    bullets(
        c,
        [
            "Public TestFlight link or QR code.",
            "Assigned login credentials.",
            "Expected first ride or demo scenario.",
        ],
        MARGIN + 16,
        486,
        218,
    )
    round_rect(c, PAGE_W - MARGIN - 170, 392, 170, 166, 8, LIGHT)
    draw_qr(c, TESTFLIGHT_URL, PAGE_W - MARGIN - 146, 426, 118)
    c.setFillColor(MUTED)
    c.setFont(FONT_BOLD, 8)
    c.drawCentredString(PAGE_W - MARGIN - 85, 410, "TESTFLIGHT QR")

    x1 = MARGIN
    x2 = MARGIN + 274
    info_panel(c, "Cannot log in", "Verify the tester has a real backend account and that the iPhone can reach the Fleet API network.", x1, 250, 250, 96, "blue")
    info_panel(c, "Location blocked", "Open iPhone Settings > TrustedRide Certified > Location and allow access again.", x2, 250, 250, 96, "blue")
    info_panel(c, "No rides appear", "Pull to refresh, confirm assignment with dispatch, then reopen the app if needed.", x1, 128, 250, 96, "neutral")
    info_panel(c, "Still blocked", "Share the tester email, device model, and a screenshot with the build owner or dispatch lead.", x2, 128, 250, 96, "amber")
    c.showPage()


def build_pdf() -> None:
    register_pdf_fonts()
    assets = prepare_assets()
    c = canvas.Canvas(str(OUTPUT_PDF), pagesize=letter)
    c.setTitle("TrustedRide Certified Team Onboarding Guide")
    c.setAuthor("MuseLabs")
    cover_page(c)
    page_install(c, assets)
    page_login(c, assets)
    page_location(c, assets)
    page_ride(c, assets)
    page_messages(c, assets)
    page_schedule_settings(c, assets)
    page_handoff(c)
    c.save()


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT_PDF)

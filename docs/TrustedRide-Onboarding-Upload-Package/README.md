# TrustedRide Certified Onboarding Upload Package

This folder contains the files used to create and review the TrustedRide Certified team onboarding guide.

## Final Deliverable

- `final/TrustedRide-Certified-Team-Onboarding-Guide.pdf`

## Source Files

- `source/tools/build-onboarding-guide.py` - PDF generator script.
- `source/assets/trustedride_certified_main_logo_transparent.png` - TrustedRide Certified logo.
- `source/assets/TRC_APP_ICON_2.png` - TrustedRide Certified app icon.
- `source/assets/muselabs-logo.png` - MuseLabs logo.
- `source/assets/trustedriders-demo-contact-sheet.jpg` - original app screenshot contact sheet used to crop app screens.

## Generated Assets

- `generated/onboarding-guide-assets/` - cropped screenshots, synthetic example screens, and phone-frame composites used inside the PDF.

## Preview Images

- `previews/onboarding-guide-rendered/` - rendered PNG previews of every PDF page for upload/review.

## QR Link

The TestFlight QR in the PDF points to:

`https://testflight.apple.com/join/dkszr1ry`

## Font Note

The PDF embeds Helvetica Neue for the document text. The generator uses the local macOS Helvetica Neue font when rebuilding.

// Source of truth for the in-app token implementation of DESIGN.md.
export const colors = {
  surface: "#FFFFFF",
  surfaceLow: "#F4F7FA",
  surfaceHigh: "#E2E8F0",
  surfaceLowest: "#FCFDFE",
  surfaceFrosted: "rgba(255,255,255,0.88)",
  surfaceScrim80: "rgba(255,255,255,0.8)",
  surfaceScrim70: "rgba(255,255,255,0.7)",
  surfaceScrim46: "rgba(255,255,255,0.46)",
  mapPlaceholder: "#E5EBF2",
  primary: "#0F172A",
  primarySoft: "#334155",
  accent: "#FACC15",
  error: "#DC2626",
  errorSoft: "rgba(220, 38, 38, 0.06)",
  errorSoftDark: "rgba(220, 38, 38, 0.15)",
  errorSoftStrong: "rgba(220, 38, 38, 0.2)",
  errorLight: "#FCA5A5",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  greenSoftDark: "rgba(22, 163, 74, 0.15)",
  greenLight: "#86EFAC",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  purple: "#7C3AED",
  purpleSoft: "#EDE9FE",
  slate500: "#64748B",
  slate400: "#94A3B8",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  shadow: "rgba(15, 23, 42, 0.12)",
  overlay: "rgba(15, 23, 42, 0.4)",
  scrim: "rgba(0,0,0,0.32)",
  ghostBorder: "rgba(148, 163, 184, 0.15)",
};

// Status badge color pairs — background + text for each operational state.
export const statusColors = {
  scheduled:  { bg: "#DBEAFE", text: "#1D4ED8" },
  enRoute:    { bg: "#FEF3C7", text: "#B45309" },
  inTransit:  { bg: "#EDE9FE", text: "#6D28D9" },
  arrived:    { bg: "#DCFCE7", text: "#15803D" },
  completed:  { bg: "#DCFCE7", text: "#15803D" },
  cancelled:  { bg: "#FEE2E2", text: "#B91C1C" },
  noShow:     { bg: "#FEF3C7", text: "#B45309" },
  available:  { bg: "#DCFCE7", text: "#15803D" },
  onRide:     { bg: "#DBEAFE", text: "#1D4ED8" },
  offDuty:    { bg: "#F1F5F9", text: "#64748B" },
} as const;

export type StatusKey = keyof typeof statusColors;

export const statusLabels: Record<StatusKey, string> = {
  scheduled:  "Scheduled",
  enRoute:    "En Route",
  inTransit:  "In Transit",
  arrived:    "Arrived",
  completed:  "Completed",
  cancelled:  "Cancelled",
  noShow:     "No Show",
  available:  "Available",
  onRide:     "On Ride",
  offDuty:    "Off Duty",
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shadows = {
  soft: {
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
  } as const,
  floating: {
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.10)",
  } as const,
  inset: {
    boxShadow: "inset 0 2px 6px rgba(15, 23, 42, 0.05)",
  } as const,
};

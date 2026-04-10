// Source of truth for the in-app token implementation of DESIGN.md.
export const colors = {
  surface: "#FFFFFF",
  surfaceLow: "#F4F7FA",
  surfaceHigh: "#E2E8F0",
  surfaceLowest: "#FCFDFE",
  primary: "#0F172A",
  primarySoft: "#334155",
  accent: "#FACC15",
  error: "#DC2626",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
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
  md: 8,
  lg: 8,
  xl: 8,
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
    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.06)",
  } as const,
  floating: {
    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.06)",
  } as const,
  inset: {
    boxShadow: "inset 0 2px 8px rgba(15, 23, 42, 0.06)",
  } as const,
};

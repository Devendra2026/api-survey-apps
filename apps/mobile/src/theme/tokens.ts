export const colors = {
  background: "#FAFBFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F3F8",
  border: "#D8E0EA",
  text: "#0F172A",
  textSecondary: "#64748B",
  textInverse: "#FFFFFF",
  /** SDV navy — logo primary */
  primary: "#002366",
  primaryPressed: "#001A4D",
  /** SDV red — logo accent */
  accent: "#C01D1A",
  danger: "#DC2626",
  dangerMuted: "#FEE2E2",
  success: "#059669",
  successMuted: "#D1FAE5",
  warning: "#D97706",
  warningMuted: "#FEF3C7",
  overlay: "rgba(15, 23, 42, 0.4)",
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 20,
  },
} as const

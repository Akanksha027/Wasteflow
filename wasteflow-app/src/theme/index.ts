// src/theme/index.ts
export const Colors = {
  // Backgrounds
  background: '#121212', // True black/dark grey
  surface: '#1A1A1A', // Dark grey for surfaces
  card: '#222222', // Lighter dark grey for cards
  cardHover: '#2A2A2A',
  border: '#333333',
  divider: '#333333',

  // Brand
  primary: '#FCA311', // Bright orange from mockup
  primaryDark: '#E0910F',
  primaryLight: '#FFB84D',
  primaryGlow: 'rgba(252, 163, 17, 0.15)',

  // Semantic
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textTertiary: '#737373',
  textDisabled: '#525252',

  // Stop status
  statusPending: '#737373',
  statusScanned: '#FCA311', // Orange to match theme
  statusSkipped: '#EF4444',

  // Waste types
  wasteWet: '#22C55E',
  wasteDry: '#FCA311',
  wasteReject: '#EF4444',
  wastePlastic: '#0EA5E9',
  wastePaper: '#A16207',
  wasteMetal: '#64748B',
  wasteGlass: '#0D9488',
  wasteGarden: '#65A30D',
  wasteOther: '#7C3AED',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const Typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 19,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
    '4xl': 40,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24, // Highly rounded cards
  '2xl': 32,
  full: 999, // Pill shaped buttons
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  }),
};

export const WASTE_TYPE_COLORS: Record<string, string> = {
  WET: Colors.wasteWet,
  DRY: Colors.wasteDry,
  REJ: Colors.wasteReject,
  PLA: Colors.wastePlastic,
  PAP: Colors.wastePaper,
  MET: Colors.wasteMetal,
  GLS: Colors.wasteGlass,
  GRD: Colors.wasteGarden,
  OTH: Colors.wasteOther,
};

export const WASTE_TYPE_NAMES: Record<string, string> = {
  WET: 'Wet / Biodegradable',
  DRY: 'Dry / Recyclable',
  REJ: 'Reject / Sanitary',
  PLA: 'Plastic',
  PAP: 'Paper',
  MET: 'Metal',
  GLS: 'Glass',
  GRD: 'Garden',
  OTH: 'Other',
};

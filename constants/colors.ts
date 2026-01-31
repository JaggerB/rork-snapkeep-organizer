const palette = {
  ink: "#0B1220",
  ink2: "#1B2A3A",
  muted: "#6B7786",
  paper: "#F7F4EF",
  card: "#FFFFFF",
  border: "rgba(11, 18, 32, 0.10)",
  brand: "#1C5D99",
  brand2: "#11A36A",
  danger: "#D93D2F",
  shadow: "rgba(11, 18, 32, 0.12)",
} as const;

export default {
  light: {
    text: palette.ink,
    background: palette.paper,
    card: palette.card,
    border: palette.border,
    tint: palette.brand,
    accent: palette.brand2,
    mutedText: palette.muted,
    danger: palette.danger,
    shadow: palette.shadow,
  },
};

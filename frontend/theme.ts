import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 6,
  defaultRadius: "md",
  fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif',
    fontWeight: "700",
  },
  colors: {
    brand: [
      "#eef6ff",
      "#d8ebff",
      "#bfe0ff",
      "#93c7ff",
      "#69a8ff",
      "#3f86ff",
      "#2f6ef5",
      "#1f5bd8",
      "#1848b2",
      "#12378d",
    ],
  },
  shadows: {
    md: "0 10px 30px rgba(31, 91, 216, 0.14)",
  },
});

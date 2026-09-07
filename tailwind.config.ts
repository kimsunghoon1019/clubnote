import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        muted: "var(--bg-muted)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        ink: "var(--text)",
        sub: "var(--text-sub)",
        faint: "var(--text-muted)",
        brand: "var(--brand)",
        "brand-soft": "var(--brand-soft)",
        "brand-text": "var(--brand-text)",
        up: "var(--up)",
        down: "var(--down)",
        warn: "var(--warn)",
      },
      fontFamily: {
        sans: ["Pretendard", ...defaultTheme.fontFamily.sans],
      },
      letterSpacing: {
        tight2: "-0.02em",
      },
      borderRadius: {
        card: "16px",
        btn: "12px",
        chip: "999px",
      },
      boxShadow: {
        toast: "0 8px 24px rgba(25, 31, 40, 0.12)",
      },
      keyframes: {
        "save-press": {
          "0%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(49, 130, 246, 0.4)" },
          "32%": { transform: "scale(0.88)", boxShadow: "0 0 0 0 rgba(49, 130, 246, 0.4)" },
          "64%": { transform: "scale(1.07)", boxShadow: "0 0 0 8px rgba(49, 130, 246, 0.16)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(49, 130, 246, 0)" },
        },
      },
      animation: {
        "save-press": "save-press 520ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
      fontSize: {
        caption: ["12px", { lineHeight: "16px", letterSpacing: "-0.02em" }],
        body: ["14px", { lineHeight: "20px", letterSpacing: "-0.02em" }],
        table: ["13px", { lineHeight: "18px", letterSpacing: "-0.02em" }],
        title: ["18px", { lineHeight: "26px", letterSpacing: "-0.02em" }],
        compact: ["16px", { lineHeight: "22px", letterSpacing: "-0.02em" }],
        "compact-title": ["20px", { lineHeight: "28px", letterSpacing: "-0.02em" }],
        "compact-caption": ["13px", { lineHeight: "18px", letterSpacing: "-0.02em" }],
      },
      minHeight: {
        touch: "var(--touch)",
      },
      minWidth: {
        touch: "var(--touch)",
      },
      height: {
        touch: "var(--touch)",
      },
      width: {
        touch: "var(--touch)",
      },
      transitionDuration: {
        motion: "var(--motion)",
      },
    },
  },
  plugins: [],
};

export default config;

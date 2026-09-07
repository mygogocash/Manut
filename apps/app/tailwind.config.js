const { hairlineWidth } = require("nativewind/theme");

/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          strong: "hsl(var(--sidebar-foreground-strong))",
          primary: "hsl(var(--sidebar-primary))",
          border: "hsl(var(--sidebar-border))",
        },
        // Manut Intelligence accent (Brand CI §6) — AI actions and status only.
        intelligence: {
          50: "hsl(var(--intelligence-50))",
          100: "hsl(var(--intelligence-100))",
          200: "hsl(var(--intelligence-200))",
          300: "hsl(var(--intelligence-300))",
          400: "hsl(var(--intelligence-400))",
          500: "hsl(var(--intelligence-500))",
          600: "hsl(var(--intelligence-600))",
          700: "hsl(var(--intelligence-700))",
          800: "hsl(var(--intelligence-800))",
          900: "hsl(var(--intelligence-900))",
          DEFAULT: "hsl(var(--intelligence-500))",
          foreground: "hsl(var(--intelligence-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        // CI §11 scale: buttons 8-10, cards 12-14, dialogs 16, AI surfaces 16-20.
        xs: "var(--radius-xs)",
        sm: "calc(var(--radius) - 4px)", // 6px — shadcn bridge
        md: "calc(var(--radius) - 0px)", // 10px — shadcn bridge (buttons)
        lg: "calc(var(--radius) + 4px)", // 14px — shadcn bridge (cards)
        xl: "var(--radius-xl)",
        full: "999px",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      transitionTimingFunction: {
        manut: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        normal: "180ms",
        panel: "220ms",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("tailwindcss-animate")],
};

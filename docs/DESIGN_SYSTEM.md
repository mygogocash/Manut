# Intranet - Design System

> Complete design system specification extracted from the demo portal, including colors, typography, spacing, and component patterns for shadcn/ui customization.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Patterns](#component-patterns)
6. [Tailwind Configuration](#tailwind-configuration)
7. [shadcn/ui Customization](#shadcnui-customization)
8. [Dark Mode](#dark-mode)
9. [Icons](#icons)
10. [Animation](#animation)

---

## Design Principles

### Visual Identity

Intranet's design language reflects **institutional quality** with **warm, professional aesthetics**:

1. **Warm Neutrals** - Cream/beige backgrounds instead of cold grays
2. **Gold Accents** - Luxurious gold tones for primary actions
3. **Serif Headlines** - DM Serif Display for elegant headings
4. **Clean Data Presentation** - Tables and cards with subtle shadows
5. **Generous Whitespace** - Spacious layouts for readability

### Design Tokens Philosophy

- **Semantic naming** - Colors named by purpose, not appearance
- **Consistent scale** - Predictable spacing and sizing
- **Theme-aware** - All tokens support light/dark modes
- **Component-driven** - Reusable patterns across modules

---

## Color System

### Light Mode (Default)

#### Background Colors

| Token      | Hex       | CSS Variable          | Usage                 |
| ---------- | --------- | --------------------- | --------------------- |
| `bg`       | `#F4F2EC` | `--background`        | Page background       |
| `bg2`      | `#F5F2EB` | `--background-secondary` | Secondary background |
| `surface`  | `#FFFFFF` | `--surface`           | Card/panel background |
| `surface2` | `#F9F7F2` | `--surface-secondary` | Elevated surface      |

#### Text Colors

| Token   | Hex       | CSS Variable       | Usage                  |
| ------- | --------- | ------------------ | ---------------------- |
| `text`  | `#0D0B07` | `--text`           | Primary text           |
| `text2` | `#3A3530` | `--text-secondary` | Secondary text         |
| `text3` | `#ADA89F` | `--text-muted`     | Muted/placeholder text |

#### Accent Colors

| Token       | Hex                     | CSS Variable     | Usage                         |
| ----------- | ----------------------- | ---------------- | ----------------------------- |
| `accent`    | `#8B6B3D`               | `--accent`       | Primary accent (gold dark)    |
| `accent2`   | `#C8A84B`               | `--accent-light` | Secondary accent (gold light) |
| `accentDim` | `rgba(139,107,61,0.08)` | `--accent-dim`   | Accent background tint        |

#### Semantic Colors

| Token       | Hex                    | CSS Variable   | Usage                   |
| ----------- | ---------------------- | -------------- | ----------------------- |
| `success`   | `#2D6A4F`              | `--success`    | Success/approved states |
| `successBg` | `rgba(45,106,79,0.08)` | `--success-bg` | Success background      |
| `error`     | `#C0392B`              | `--error`      | Error/rejected states   |
| `errorBg`   | `rgba(192,57,43,0.08)` | `--error-bg`   | Error background        |
| `warning`   | `#D24726`              | `--warning`    | Warning/pending states  |
| `warningBg` | `rgba(210,71,38,0.1)`  | `--warning-bg` | Warning background      |
| `info`      | `#1A3A5C`              | `--info`       | Info/neutral states     |
| `infoBg`    | `rgba(26,58,92,0.1)`   | `--info-bg`    | Info background         |

#### Border Colors

| Token     | Hex                  | CSS Variable     | Usage          |
| --------- | -------------------- | ---------------- | -------------- |
| `border`  | `rgba(13,11,7,0.08)` | `--border`       | Default border |
| `border2` | `rgba(13,11,7,0.04)` | `--border-light` | Subtle border  |

### Dark Mode

#### Background Colors

| Token      | Hex       | CSS Variable          | Usage                 |
| ---------- | --------- | --------------------- | --------------------- |
| `bg`       | `#0D0B07` | `--bg`                | Page background       |
| `bg2`      | `#1A1815` | `--bg-secondary`      | Secondary background  |
| `surface`  | `#252320` | `--surface`           | Card/panel background |
| `surface2` | `#2E2B27` | `--surface-secondary` | Elevated surface      |

#### Text Colors

| Token   | Hex       | CSS Variable       | Usage                  |
| ------- | --------- | ------------------ | ---------------------- |
| `text`  | `#F5F2EB` | `--text`           | Primary text           |
| `text2` | `#C9C4BB` | `--text-secondary` | Secondary text         |
| `text3` | `#6B665E` | `--text-muted`     | Muted/placeholder text |

#### Accent Colors (Same in both modes)

| Token     | Hex       | CSS Variable     |
| --------- | --------- | ---------------- |
| `accent`  | `#8B6B3D` | `--accent`       |
| `accent2` | `#C8A84B` | `--accent-light` |

#### Border Colors (Dark Mode)

| Token     | Hex                      | CSS Variable     |
| --------- | ------------------------ | ---------------- |
| `border`  | `rgba(245,242,235,0.08)` | `--border`       |
| `border2` | `rgba(245,242,235,0.04)` | `--border-light` |

### Sidebar Colors

| Token              | Hex                      | Usage                      |
| ------------------ | ------------------------ | -------------------------- |
| Sidebar Background | `#0D0B07`                | Dark sidebar               |
| Sidebar Text       | `rgba(255,255,255,0.5)`  | Nav item text              |
| Sidebar Text Hover | `rgba(255,255,255,0.85)` | Hovered nav item           |
| Sidebar Active     | `#C8A84B`                | Active nav item text       |
| Sidebar Active Bg  | `rgba(200,168,75,0.1)`   | Active nav item background |
| Sidebar Section    | `rgba(255,255,255,0.2)`  | Section header text        |
| Sidebar Border     | `rgba(255,255,255,0.06)` | Divider lines              |

---

## Typography

### Font Families

| Token   | Font Stack                           | CSS Variable   | Usage             |
| ------- | ------------------------------------ | -------------- | ----------------- |
| `sans`  | `'DM Sans', system-ui, sans-serif`   | `--font-sans`  | Body text, UI     |
| `serif` | `'DM Serif Display', Georgia, serif` | `--font-serif` | Headlines, titles |
| `mono`  | `'DM Mono', monospace`               | `--font-mono`  | Code, numbers     |

### Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&family=DM+Mono&display=swap"
/>
```

### Type Scale

| Name            | Size   | Weight | Line Height | Usage                           |
| --------------- | ------ | ------ | ----------- | ------------------------------- |
| `page-title`    | 24px   | 400    | 1.2         | Page headings (serif)           |
| `section-title` | 20px   | 400    | 1.2         | Section headings (serif)        |
| `card-title`    | 10px   | 700    | 1.4         | Card section labels (uppercase) |
| `body`          | 14px   | 400    | 1.5         | Default body text               |
| `body-sm`       | 12.5px | 400    | 1.5         | Table cells, secondary text     |
| `caption`       | 11px   | 400    | 1.4         | Timestamps, meta info           |
| `label`         | 10.5px | 600    | 1.2         | Form labels (uppercase)         |
| `tiny`          | 9.5px  | 700    | 1.2         | Badges, KPI labels (uppercase)  |

### Typography Patterns

```css
/* Page Title */
.pg-title {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 400;
}

/* KPI Value */
.kpi-val {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 300;
  line-height: 1.15;
}

/* KPI Label */
.kpi-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Card Title (Section Header) */
.card-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Table Header */
.tbl th {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Form Label */
.inp-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

---

## Spacing & Layout

### Spacing Scale

| Token | Size | Usage         |
| ----- | ---- | ------------- |
| `1`   | 4px  | Tight spacing |
| `2`   | 8px  | Element gap   |
| `3`   | 12px | Component gap |
| `4`   | 16px | Section gap   |
| `5`   | 20px | Page padding  |
| `6`   | 24px | Large gap     |

### Layout Constants

| Token             | Size      | Usage                |
| ----------------- | --------- | -------------------- |
| `sidebar-width`   | 220px     | Sidebar width        |
| `topbar-height`   | 50px      | Top bar height       |
| `content-padding` | 20px 24px | Page content padding |

### Grid Layouts

```css
/* 2 Column Grid */
.g2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* 3 Column Grid */
.g3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

/* 4 Column Grid */
.g4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* KPI Row (always 4 cols) */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* Split Layouts */
.split-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.split-2-1 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.split-1-2 {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}
.split-3-1 {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 16px;
}
```

### Border Radius

| Token  | Size   | Usage           |
| ------ | ------ | --------------- |
| `sm`   | 5px    | Small elements  |
| `md`   | 7px    | Buttons, inputs |
| `lg`   | 10px   | Cards           |
| `xl`   | 12px   | Modals          |
| `full` | 9999px | Pills, avatars  |

### Shadows

```css
:root {
  --shadow-sm: 0 1px 2px rgba(13, 11, 7, 0.04), 0 2px 8px rgba(13, 11, 7, 0.04);
  --shadow-md:
    0 2px 4px rgba(13, 11, 7, 0.05), 0 6px 20px rgba(13, 11, 7, 0.06);
  --shadow-lg: 0 8px 24px rgba(13, 11, 7, 0.12);
  --shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.2);
}
```

---

## Component Patterns

### Card

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
```

### KPI Card

```css
.kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
}

.kpi-label {
  /* uppercase, tiny, muted */
}
.kpi-val {
  /* serif, 26px */
}
.kpi-change {
  font-size: 10.5px;
  color: var(--text-muted);
  margin-top: 4px;
}
```

### Button Variants

```css
/* Primary (Gold) */
.btn-pri {
  background: linear-gradient(135deg, #8b6b3d, #9e7a4a);
  color: #fff;
  box-shadow: 0 1px 3px rgba(139, 107, 61, 0.3);
}
.btn-pri:hover {
  background: #7a5c34;
}

/* Secondary */
.btn-sec {
  background: #fff;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn-sec:hover {
  background: var(--bg);
}

/* Accent */
.btn-acc {
  background: var(--accent-light);
  color: #fff;
}
.btn-acc:hover {
  background: #b8963e;
}

/* Danger */
.btn-danger {
  background: var(--error-bg);
  color: var(--error);
  border: 1px solid rgba(192, 57, 43, 0.2);
}
.btn-danger:hover {
  background: rgba(192, 57, 43, 0.15);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  border: none;
  color: var(--text-muted);
}
.btn-ghost:hover {
  background: var(--border);
  color: var(--text-secondary);
}

/* Common Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.12s;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
```

### Input Fields

```css
.inp {
  border: 1px solid rgba(13, 11, 7, 0.12);
  background: var(--bg-secondary);
  border-radius: 7px;
  padding: 8px 11px;
  font-size: 13px;
  color: var(--text);
  outline: none;
  width: 100%;
  font-family: var(--font-sans);
}
.inp:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(139, 107, 61, 0.1);
}
.inp::placeholder {
  color: var(--text-muted);
}

textarea.inp {
  resize: vertical;
  min-height: 80px;
}

select.inp {
  cursor: pointer;
  appearance: none;
  background-image: url("chevron-down.svg");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
```

### Badge Variants

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
}

.badge-green {
  background: rgba(45, 106, 79, 0.1);
  color: #2d6a4f;
}
.badge-amber {
  background: rgba(210, 71, 38, 0.1);
  color: #d24726;
}
.badge-red {
  background: rgba(192, 57, 43, 0.1);
  color: #c0392b;
}
.badge-gold {
  background: rgba(200, 168, 75, 0.12);
  color: #8b6b3d;
}
.badge-blue {
  background: rgba(26, 58, 92, 0.1);
  color: #1a3a5c;
}
.badge-grey {
  background: rgba(13, 11, 7, 0.06);
  color: var(--text-muted);
}
```

### Table

```css
.tbl-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl thead {
  background: #fafaf8;
}

.tbl th {
  padding: 10px 14px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.tbl td {
  padding: 11px 14px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-secondary);
  vertical-align: middle;
}

.tbl tbody tr:last-child td {
  border-bottom: none;
}
.tbl tbody tr:hover td {
  background: rgba(139, 107, 61, 0.025);
}
```

### Tabs

```css
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.tab {
  padding: 9px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.12s;
}

.tab:hover {
  color: var(--text-secondary);
}
.tab.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

### Modal

```css
.form-modal {
  position: fixed;
  inset: 0;
  background: rgba(13, 11, 7, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.form-box {
  background: var(--surface);
  border-radius: 14px;
  padding: 24px;
  width: 480px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.form-box-lg {
  width: 680px;
}
.form-box-xl {
  width: 900px;
}

.form-title {
  font-family: var(--font-serif);
  font-size: 20px;
}

.form-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
```

### Progress Bar

```css
.progress {
  height: 5px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 3px;
  transition: width 0.3s;
}
```

---

## Tailwind Configuration

> **The app is on Tailwind v4** — there is no `tailwind.config.ts`. Tokens, theme mapping, and
> plugins live in `apps/web/src/app/globals.css` via `@import "tailwindcss"`, `@theme inline`,
> `@plugin`, and `@custom-variant dark (&:is(.dark *))`. The light/dark CSS variables there are
> the source of truth (see the `globals.css` excerpt below for the current values). The v3-style
> config below is kept as a token reference; the actual values are defined in `globals.css`, not a
> JS config object.

### Reference config (v3 shape — illustrative only)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background
        background: "hsl(var(--background))",
        "background-secondary": "hsl(var(--background-secondary))",

        // Surface
        surface: "hsl(var(--surface))",
        "surface-secondary": "hsl(var(--surface-secondary))",

        // Text
        foreground: "hsl(var(--foreground))",
        "foreground-secondary": "hsl(var(--foreground-secondary))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        // Accent (Primary)
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
        },

        // Semantic
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },

        // Component specific
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Sidebar
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },

        // Card
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Popover
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10px
        xs: ["0.6875rem", { lineHeight: "1rem" }], // 11px
        sm: ["0.78125rem", { lineHeight: "1.25rem" }], // 12.5px
        base: ["0.875rem", { lineHeight: "1.5rem" }], // 14px
      },

      borderRadius: {
        lg: "10px",
        md: "7px",
        sm: "5px",
      },

      boxShadow: {
        sm: "0 1px 2px rgba(13,11,7,0.04), 0 2px 8px rgba(13,11,7,0.04)",
        md: "0 2px 4px rgba(13,11,7,0.05), 0 6px 20px rgba(13,11,7,0.06)",
        lg: "0 8px 24px rgba(13,11,7,0.12)",
        xl: "0 20px 60px rgba(0,0,0,0.2)",
      },

      spacing: {
        sidebar: "220px",
        topbar: "50px",
      },

      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },

      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar")],
};

export default config;
```

### CSS Variables (globals.css)

```css
@import "tailwindcss";

@layer base {
  :root {
    /* Background — values below are illustrative; globals.css is source of truth */
    --background: 45 27% 94%; /* #F4F2EC */
    --background-secondary: 47 22% 92%; /* #F5F2EB */

    /* Surface */
    --surface: 0 0% 100%; /* #FFFFFF */
    --surface-secondary: 40 29% 97%; /* #F9F7F2 */

    /* Foreground */
    --foreground: 30 27% 3%; /* #0D0B07 */
    --foreground-secondary: 26 8% 21%; /* #3A3530 */

    /* Muted */
    --muted: 40 10% 65%; /* #ADA89F */
    --muted-foreground: 40 10% 65%;

    /* Primary (Gold) */
    --primary: 34 40% 40%; /* #8B6B3D */
    --primary-foreground: 0 0% 100%;
    --primary-light: 43 52% 54%; /* #C8A84B */

    /* Semantic Colors */
    --success: 153 40% 30%; /* #2D6A4F */
    --success-foreground: 0 0% 100%;

    --warning: 14 67% 49%; /* #D24726 */
    --warning-foreground: 0 0% 100%;

    --destructive: 6 63% 46%; /* #C0392B */
    --destructive-foreground: 0 0% 100%;

    --info: 210 53% 24%; /* #1A3A5C */
    --info-foreground: 0 0% 100%;

    /* Border & Input */
    --border: 30 27% 3% / 0.08;
    --input: 43 26% 94%;
    --ring: 34 40% 40%;

    /* Card */
    --card: 0 0% 100%;
    --card-foreground: 30 27% 3%;

    /* Popover */
    --popover: 0 0% 100%;
    --popover-foreground: 30 27% 3%;

    /* Sidebar */
    --sidebar-background: 30 27% 3%; /* #0D0B07 */
    --sidebar-foreground: 0 0% 100% / 0.5;
    --sidebar-primary: 43 52% 54%; /* #C8A84B */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 43 52% 54% / 0.1;
    --sidebar-accent-foreground: 43 52% 54%;
    --sidebar-border: 0 0% 100% / 0.06;

    /* Radius */
    --radius: 10px;
  }

  .dark {
    /* Background */
    --background: 30 27% 3%; /* #0D0B07 */
    --background-secondary: 30 12% 9%; /* #1A1815 */

    /* Surface */
    --surface: 30 9% 14%; /* #252320 */
    --surface-secondary: 30 9% 17%; /* #2E2B27 */

    /* Foreground */
    --foreground: 43 26% 94%; /* #F5F2EB */
    --foreground-secondary: 35 10% 76%; /* #C9C4BB */

    /* Muted */
    --muted: 30 7% 40%; /* #6B665E */
    --muted-foreground: 30 7% 40%;

    /* Border */
    --border: 43 26% 94% / 0.08;
    --input: 30 12% 9%;

    /* Card */
    --card: 30 9% 14%;
    --card-foreground: 43 26% 94%;

    /* Popover */
    --popover: 30 9% 14%;
    --popover-foreground: 43 26% 94%;

    /* Sidebar (same in dark) */
    --sidebar-background: 30 27% 3%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-size: 14px;
  }

  h1,
  h2,
  h3 {
    @apply font-serif;
  }
}
```

---

## shadcn/ui Customization

### Button Component

```typescript
// apps/web/src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary:
          "bg-surface text-foreground-secondary border-border hover:bg-background border",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
        ghost:
          "hover:bg-border text-muted-foreground hover:text-foreground-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-primary-light hover:bg-primary-light/90 text-white",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

### Badge Component

```typescript
// apps/web/src/components/ui/badge.tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[9.5px] font-bold capitalize",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
        muted: "bg-muted/20 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
```

### Card Component

```typescript
// apps/web/src/components/ui/card.tsx
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
);
```

### Input Component

```typescript
// apps/web/src/components/ui/input.tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background-secondary px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
```

---

## Dark Mode

### Implementation

1. **Class-based toggle**: Use `dark` class on `<html>` element
2. **System preference**: Respect `prefers-color-scheme` initially
3. **User preference**: Store in localStorage and persist

### Toggle Component

```typescript
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

### Theme Provider Setup

```typescript
// apps/web/src/providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

---

## Icons

### Icon Library

Use **Lucide React** for consistent iconography.

```bash
pnpm add lucide-react
```

### Common Icons Mapping

| Demo Icon  | Lucide Equivalent                 |
| ---------- | --------------------------------- |
| Home       | `Home`, `LayoutDashboard`         |
| Messages   | `MessageSquare`, `MessagesSquare` |
| Projects   | `FolderKanban`, `Layers`          |
| CRM        | `Users`, `Building2`              |
| Calendar   | `Calendar`, `CalendarDays`        |
| Leave      | `CalendarOff`, `Palmtree`         |
| Payroll    | `Wallet`, `CreditCard`            |
| HRMS       | `Users`, `UserCircle`             |
| Learning   | `GraduationCap`, `BookOpen`       |
| Visa       | `Plane`, `Globe`                  |
| Office     | `Building`, `MapPin`              |
| Directory  | `Contact`, `Users`                |
| Accounting | `Calculator`, `PieChart`          |
| Settings   | `Settings`, `Cog`                 |
| Admin      | `Shield`, `Lock`                  |

### Icon Sizing

| Size | Pixels | Usage         |
| ---- | ------ | ------------- |
| sm   | 14px   | Sidebar icons |
| md   | 16px   | Default       |
| lg   | 20px   | Headers       |
| xl   | 24px   | Feature icons |

---

## Animation

### Transition Defaults

```css
/* Default transition */
transition: all 0.12s ease;

/* Slower for modals */
transition: all 0.2s ease;
```

### Hover States

- **Buttons**: Darken background by 10%
- **Cards**: Subtle border color change or shadow increase
- **Table rows**: Light background tint
- **Links**: Color change to accent

### Enter/Exit Animations

```typescript
// Tailwind Animate classes
"animate-in fade-in-0";
"animate-in slide-in-from-top-2";
"animate-out fade-out-0";
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [API Specification](./API_SPECIFICATION.md)
- [Task Planning](./TASK_PLANNING.md)

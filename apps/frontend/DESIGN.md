# DESIGN.md

Frontend design source of truth for CSUI Zenith Admin & Directory (`zenith.csui.dev`). Built with `shadcn/ui` and Tailwind CSS v4 semantic tokens.

## Theme

- Light-first (`:root`), with dark mode (`.dark`) toggled via header switch.
- Technical, data-first hierarchy inspired by `zenith.csui.dev` celestial slate and sky-blue accents.
- Style exclusively through semantic tokens; never hardcode hex values in `.tsx` files.

## Colors

### Light (`:root`)
- background: `#f8fafc`
- foreground: `#0f172a`
- card: `#ffffff`
- primary: `#0284c7` (primary-foreground: `#ffffff`)
- secondary: `#0f172a` (secondary-foreground: `#ffffff`)
- muted: `#f1f5f9` (muted-foreground: `#475569`)
- accent: `#e0f2fe` (accent-foreground: `#0369a1`)
- destructive: `#dc2626`
- border / input: `#e2e8f0`
- ring: `#0284c7`
- sidebar: `#ffffff` (sidebar-foreground: `#0f172a`)

### Dark (`.dark`)
- background: `#0b0f19`
- foreground: `#f8fafc`
- card: `#111827`
- primary: `#38bdf8` (primary-foreground: `#082f49`)
- secondary: `#1e293b` (secondary-foreground: `#f8fafc`)
- muted: `#1e293b` (muted-foreground: `#94a3b8`)
- accent: `#1e293b` (accent-foreground: `#38bdf8`)
- destructive: `#ef4444`
- border / input: `#1e293b`
- ring: `#38bdf8`
- sidebar: `#0d1322` (sidebar-foreground: `#f8fafc`)

## Typography

- Headings (`h1`-`h4`): `Geist Variable` (`--font-heading`)
- UI Body: `Inter` (`--font-sans`)
- Numerals & Codes (NPM, years, SKS, KPI): `JetBrains Mono` (`--font-mono`, `tabular-nums`)
- Scale:
  - Page title: `text-2xl font-semibold tracking-tight` (24px)
  - Card title: `text-base font-medium` (16px)
  - Body: `text-sm leading-relaxed` (14px, 1.5 line-height)
  - Hint / Caption: `text-xs text-muted-foreground` (12px)

## Layout & Components

- Container width: `max-w-7xl` with `p-4 md:p-6` and 8px spacing multiples.
- Primitives: `Card`, `Table`, `Badge`, `Button`, `Dialog`, `Select`, `Field`, `ListState`, `EmptyState`, `ConfirmDialog`, `ImageUploadEditor`.
- Async states: always render via `ListState` (`loading`, `error`, `empty`).

## Anti-Slop Gates

- **R-01 (No Unmotivated Gradients or Glows):** Surface separation uses semantic borders and flat surface contrast (`bg-background`, `bg-card`, `border-border`). No decorative neon blurs or rainbow gradients.
- **R-02 (Direct Copywriting):** Zero em-dashes or en-dashes in UI copy. Zero corporate buzzwords (such as "unlock", "elevate", "seamless", "robust", or "empower"). Use direct, functional labels.
- **R-03 (Accessible Affordances & Motion):** Functional transitions stay between `150ms` and `200ms`, wrapped with `prefers-reduced-motion` safeguards. All icon-only buttons require `aria-label`. Interactive controls meet `44x44px` touch targets on mobile.
- **R-04 (Code Hygiene):** No literal colors in `.tsx` components, no empty `catch` blocks, and no `window.confirm`.

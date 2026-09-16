# B2B Marketplace — Design System

An Alibaba.com-inspired wholesale marketplace visual language. Dense, commercial,
trust-first. The look of a trading floor, not a SaaS dashboard.

> Source of truth: `app/globals.css`. Every color below is defined there once as a
> semantic token — always use `bg-primary`, `text-muted-foreground`, `border-border`,
> never raw hex in components.

---

## 1. Color

Palette anchored on **Alibaba orange `#FF6A00`** + **navy `#0A1D3C`** + cool neutrals.

### Light mode

| Token | Hex | Notes |
|---|---|---|
| `--primary` | `#FF6A00` | Brand orange — CTAs, active tabs, links, verification rail |
| `--brand-dark` | `#E85F00` | Hover state for primary buttons/badges |
| `--brand-amber` | `#FF9A00` | Light orange support ("Price Negotiable" chip) |
| `--brand-navy` | `#0A1D3C` | Footer background / dark surfaces |
| `--background` | `#F7F8FA` | Cool near-white page canvas |
| `--card` / `--popover` | `#FFFFFF` | Elevated surfaces |
| `--foreground` | `#1B2026` | Primary text (navy-tinted near-black) |
| `--secondary` / `--accent` | `#F4F6F8` | Subtle surface fills |
| `--muted` | `#EFF2F5` | Skeleton / disabled fills |
| `--muted-foreground` | `#6B7076` | Secondary text, micro-labels |
| `--border` / `--input` | `#D9DEE3` | Crisp cool borders |
| `--success` | `#237804` | Verified, stock, approvals |
| `--warning` | `#AD6800` | Pending states |
| `--info` | `#0958D9` | Informational |
| `--destructive` | `#CF1322` | Errors, rejections |
| `--ring` | `#FF6A00` | Focus rings |

Dark mode: navy-tinted neutral darks (cool hue, no warm cast), same orange primary,
`--border`/`--input` are translucent white (`12%` / `15%`).

### Rules
- Use **semantic** tokens only. No raw hex in components.
- `success` for *verified / live / in-stock*, `warning` for *pending*, `destructive`
  for *rejected / errors*, `info` for neutral calls-to-action.
- Orange `--brand-dark` belongs to hovered/active brand elements; do not add more
  oranges.

---

## 2. Typography

- **Family:** Inter (`app/layout.tsx`), `--font-sans`. System fallbacks only.
- **Scale rules of thumb:**
  - Titles/hero: bold + `tracking-tight` (`text-xl`–`text-3xl`).
  - Body/dense content: `text-sm`.
  - Micro-labels (specs, stats): `text-[11px]` uppercase `tracking-wide`
    `text-muted-foreground`.
  - Prices: `font-bold tabular-nums`, ₹ via `toLocaleString("en-IN")`.

---

## 3. Radius scale

| Name | Value |
|---|---|
| `rounded-sm` | 2px (tiny chips/notches) |
| `rounded-md` | 4px (buttons, inputs, selects) |
| `rounded-lg` | 6px (cards, dialogs — default `--radius`) |
| `rounded-xl`+ | 8px+ (large containers, sheets) |

- **Pills are forbidden** except semantic circles (avatars, radio inputs, switch
  thumbs, scrollbar thumbs, carousel dots).
- Do not override with `rounded-full` on buttons/cards/tags.

---

## 4. Components

### Card (`components/ui/card.tsx`)
- `flex flex-col gap-(--card-spacing)` with 24px default vertical padding (`py`).
- **Gotcha:** media cards (product/category tiles) must override with
  `!gap-0 !py-0` and manage their own internal padding — otherwise unwanted 24px
  gaps appear above/below and between the image and content.
  Example: `components/storefront/product-card.tsx`.
- Cards use crisp `border-border`; soft shadows only on hover (`hover:shadow-md`).

### Button (`components/ui/button.tsx`)
- `rounded-md`, `h-9`, size `xs`/`sm`/`default`/`lg`.
- Primary `default`: `bg-primary hover:bg-brand-dark` — orange, no gradients.
- `outline` for secondary/ghost-style actions.
- Record `render` + `nativeButton={false}` for link buttons.

### Badge (`components/ui/badge.tsx`)
- `rounded-sm`. Variants: `default` (orange), `success` (green), `warning`
  (amber), `destructive`, `secondary`, `outline`.
- `success` = verified/live; `default` = marketing emphasis.

### Tables (`components/ui/table.tsx`)
- Dense headers: `h-10`, `text-xs uppercase tracking-wide text-muted-foreground`.
- Right-align money, `tabular-nums`.

### Tabs, Inputs, Selects, etc.
- Active tab trigger = `bg-primary text-primary-foreground` (orange pill-rect, not
  underline-only).
- All form controls `rounded-md`, `bg-card` (or `bg-input/30`), focus `ring-primary`.

---

## 5. Layout patterns

### Storefront header (`components/layout/storefront-header.tsx`)
Three tiers: (1) logo + nav + auth actions, (2) full-width search, (3) horizontal
category rail.

### Footer (`components/layout/storefront-footer.tsx`)
Alibaba-style dark navy band: `bg-brand-navy text-white`, white `Separator`, two
link columns under the brand block, bottom legal bar in `text-white/50`.

### Product card (`components/storefront/product-card.tsx`)
Image (square, `object-cover`) → title → **price** (bold `lg`, unit muted) → MOQ →
footer bar (`border-t bg-muted/30`): supplier name + verification shield + location
| "Enquiry" outline button. `!gap-0 !py-0` card.

### Category tile (`app/page.tsx` `CategoryTile`)
Square `aspect-square` image, tight `px-2 py-1.5` caption (name `text-xs semibold`,
count `text-[11px]`). `!gap-0 !py-0`.

### Product detail (`app/products/[id]/product-detail.tsx`)
2-column grid `lg:grid-cols-[minmax(0,1fr)_440px]`:
- Left: square gallery (sticky `lg:sticky lg:top-4`) + thumbnails.
- Right: title → price/MOQ card → quantity pricing → quick specs → supplier card →
  actions → **Description/Specifications/Variants tabs** (right column only).

---

## 6. Do / Don't

| Do | Don't |
|---|---|
| Use semantic color tokens, Inter, radius scale | Raw hex, new fonts, pill buttons/cards |
| Emphasize price, MOQ, supplier + verification | Hide commercial info behind fluff |
| Render real data (from `lib/storefront.ts`) | Invent counts for empty states (e.g. hero stats) |
| Use `!gap-0 !py-0` + own padding on media cards | Rely on Card's default padding for media layouts |
| ₹ formatted with `en-IN`, `tabular-nums` | Inconsistent currency/number formatting |
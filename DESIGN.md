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

| Token                      | Hex       | Notes                                                      |
| -------------------------- | --------- | ---------------------------------------------------------- |
| `--primary`                | `#FF6A00` | Brand orange — CTAs, active tabs, links, verification rail |
| `--brand-dark`             | `#E85F00` | Hover state for primary buttons/badges                     |
| `--brand-amber`            | `#FF9A00` | Light orange support ("Price Negotiable" chip)             |
| `--brand-navy`             | `#0A1D3C` | Footer background / dark surfaces                          |
| `--background`             | `#F7F8FA` | Cool near-white page canvas                                |
| `--card` / `--popover`     | `#FFFFFF` | Elevated surfaces                                          |
| `--foreground`             | `#1B2026` | Primary text (navy-tinted near-black)                      |
| `--secondary` / `--accent` | `#F4F6F8` | Subtle surface fills                                       |
| `--muted`                  | `#EFF2F5` | Skeleton / disabled fills                                  |
| `--muted-foreground`       | `#6B7076` | Secondary text, micro-labels                               |
| `--border` / `--input`     | `#D9DEE3` | Crisp cool borders                                         |
| `--success`                | `#237804` | Verified, stock, approvals                                 |
| `--warning`                | `#AD6800` | Pending states                                             |
| `--info`                   | `#0958D9` | Informational                                              |
| `--destructive`            | `#CF1322` | Errors, rejections                                         |
| `--ring`                   | `#FF6A00` | Focus rings                                                |

Dark mode: navy-tinted neutral darks (cool hue, no warm cast), same orange primary,
`--border`/`--input` are translucent white (`12%` / `15%`).

### Rules

- Use **semantic** tokens only. No raw hex in components.
- `success` for _verified / live / in-stock_, `warning` for _pending_, `destructive`
  for _rejected / errors_, `info` for neutral calls-to-action.
- Orange `--brand-dark` belongs to hovered/active brand elements; do not add more
  oranges.

---

## 2. Typography

- **Family:** Inter (`app/layout.tsx`), `--font-sans`. System fallbacks only.
  (The apple-design skill prefers the OS system font; Inter is this product's
  deliberate, brand-level override — keep it, don't add faces.)
- **Scale rules of thumb:**
  - Titles/hero: bold + `tracking-tight` (`text-xl`–`text-3xl`).
  - Body/dense content: `text-sm`.
  - Micro-labels (specs, stats): `text-[11px]` uppercase `tracking-wide`
    `text-muted-foreground`.
  - Prices: `font-bold tabular-nums`, ₹ via `toLocaleString("en-IN")`.
- **Tracking and leading are size-specific — never one value for everything.**
  Type tightens as it grows (titles `tracking-tight`, hero near `-0.02em`), body
  sits near `0`, small labels keep positive tracking; leading is tight on large
  headings and more open on body copy.
- **Hierarchy comes from weight + size + leading as a set** — emphasise with
  weight before reaching for a bigger size.
- **Layout scales with the user's text size**: spacing uses `rem`/`--spacing`
  tokens, never px coupled to font-size, so Dynamic Type reflows instead of
  breaking.

---

## 3. Radius scale

| Name          | Value                                     |
| ------------- | ----------------------------------------- |
| `rounded-sm`  | 2px (tiny chips/notches)                  |
| `rounded-md`  | 4px (buttons, inputs, selects)            |
| `rounded-lg`  | 6px (cards, dialogs — default `--radius`) |
| `rounded-xl`+ | 8px+ (large containers, sheets)           |

- **Pills are forbidden** except semantic circles (avatars, radio inputs, switch
  thumbs, scrollbar thumbs, carousel dots).
- Do not override with `rounded-full` on buttons/cards/tags.
- **Narrow exception:** segmented _filter chip rows_ on list screens (e.g. the
  order status/payment filter pills) may be pill-shaped — approved in the 2026
  order-screen redesign. Nothing else gets a free pass.

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
- **Press feedback is on pointer-down:** `active:scale-[0.97]` at 100ms
  (`--motion-press`), never waiting for release. Non-button controls (links,
  card links, filter chips, tiles) opt in with the `press` utility — same
  instant response. Never combine `press` with Motion-driven transforms (use
  `whileTap` there instead).

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

One row on desktop: logo, nav links, and search + cart + account actions. The
search action is an icon that opens the [top search overlay](#top-search-overlay)
instead of rendering a full-width search tier in the header. On mobile that
row keeps the menu + logo and hides the desktop actions because the
[bottom navigation](#mobile-bottom-navigation) covers those destinations.
The mobile app bar is `h-(--storefront-header-height)` with `pt-(--safe-area-top)`
so the brand row clears notches; menu and cart controls use 40px hit areas.
Nav links come from `navLinksFor(user)` (`lib/nav.ts`): the discovery links
always, plus **Orders** (`/orders`) for every signed-in user — buyers otherwise
reach their orders only through the account menu, and suppliers/admins shop
too. Their own order queues stay in the account menu. Signed-out visitors keep
the discovery-only list.
The bar is an **opaque surface** (`bg-card`): content scrolls underneath it,
and it carries `scroll-edge` with `data-scrolled` toggled by a passive scroll
listener so the fade at the content boundary appears only when something is
actually scrolling beneath.

### Home search hero (`components/storefront/search-mega-menu.tsx`)

On mobile the hero is a search _field_, not a card: the 48px bordered input
carries the search glyph, the inline camera action (separated by a hairline) and
no outer panel padding, so it costs ~110px including the category chip row.
Popular categories render as a horizontally scrolling row of image + label chips
(`scroll-pl-4` keeps the first chip clear of the edge); the "Hot" search row
returns from `sm` up, where the desktop/tablet panel and category browse grid
also live. Live suggestions and the camera popover must not be clipped by the
field, so it relies on rounded children rather than `overflow-hidden`.

### Homepage products (`components/storefront/home-sections.tsx`)

`AllProductsSection` opens with the shared `SectionHeader` — "Popular products"
plus a "View all" link to `/products` — then the dense two-column mobile grid.
No popularity metric is implied by the heading; it labels the real `getProducts`
result, not a fabricated ranking.

### Top search overlay (`components/layout/storefront-search-overlay.tsx`)

Desktop-only search entry point. The top-bar search icon opens the same
`SearchMegaMenu` used by the homepage hero, inside a full-width panel fixed
directly below the header (`top-(--storefront-header-offset)`); the page behind
it is dimmed and blurred by the backdrop. No page content shifts, and the
overlay closes on Escape, outside press, route/query change, or any link click.
It is rendered from Base UI `Dialog` primitives with `modal="trap-focus"` so
focus stays in the search UI while the header remains clickable; page scroll is
locked manually while open. Mega-menu categories come from the cached
`getCachedMegaMenuCategories()` call in the storefront layout, and "Hot"
searches come from the shared `TRENDING_SEARCHES` constant in
`lib/search-suggest.ts`. The homepage hero itself is unchanged.

### Mobile bottom navigation (`components/layout/storefront-bottom-nav.tsx`)

Fixed, buyer/storefront-only tab bar. Rendered by
`components/layout/storefront-shell.tsx`, which wraps every public storefront
page (`/`, `/products`, `/category/[slug]`, `/products/[id]`). It is `lg:hidden`
— desktop navigation is untouched. It is **separate from supplier/admin
workspace navigation** and must not be added to `/supplier/*` or `/admin/*`.

Five items, in order:

| Item         | Action                                                                            | Active when                                |
| ------------ | --------------------------------------------------------------------------------- | ------------------------------------------ |
| Home         | `/`                                                                               | `pathname === "/"`                         |
| Categories   | `/categories` (category discovery)                                                 | `/categories`, `/category/*`               |
| All Products | `/products` (the complete catalog, never a search or category view)                | `/products` without a search query         |
| Search       | opens a bottom sheet reusing `StorefrontSearchForm` (submits to `/products?q=…`)  | `/products` with `?q` or `?img`            |
| Account      | signed in: existing `AccountMenu` (opens upward); signed out: `/auth/login`       | `/account/*`                               |

- Active-state logic lives in `isStorefrontTabActive()` (`lib/nav.ts`) and is
  shared with the mobile drawer. Search results win over All Products:
  `/products?q=…` (and image search `?img=…`) highlights Search, while every
  other `/products` view highlights All Products.
- Icons come from the existing Hugeicons set (`Home01Icon`, `GridViewIcon`,
  `Package01Icon`, `Search01Icon`, `UserCircleIcon`). No new icon library.
- Each item is `flex-1` with a visible 11px label below a 20px icon; the bar
  stays 56px tall, so five tabs fit 360px without wrapping, clipping, or
  horizontal scrolling. Interactive areas are the full 56px-tall tab.
- Active state is never colour alone: a 20×2px top rule and a heavier icon
  stroke accompany the deeper orange label (`text-brand-700`, AA on the
  opaque bar); inactive items stay `text-muted-foreground`. No pills, fills or gradients. Links set
  `aria-current="page"`; the signed-in Account trigger and Search sheet trigger
  expose it too. Every tab has an inset `focus-visible` ring.
- Semantic `<nav aria-label="Storefront">`; every item has a visible label and an
  accessible name.
- The bar is `fixed inset-x-0 bottom-0 z-40`; sheets/dropdowns (`z-50`) cover it.
  Search is the one sheet that must dismiss on navigation: the shell persists
  across route changes, so the bottom nav remounts the sheet (keyed by route +
  query) and it cannot stay over a results page.
  It is built as an opaque `bg-card` surface with a light top edge — the
  hairline that separates it from content — drawn as an inset
  pseudo-element so it does not add layout height.
- Safe area: the bar adds `pb-(--safe-area-bottom)`; the interactive row is
  `h-(--bottom-nav-height)`. Both vars live in `app/globals.css`.
- Keyboard: the Search sheet measures `window.visualViewport` while open,
  lifts itself by the keyboard inset (ignoring small browser-chrome deltas) and
  caps its height to the visible viewport, so the focused input stays visible
  above the software keyboard on iOS Safari and Chromium. Its live suggestions
  render in flow (`inlineSuggestions`) instead of as an absolute dropdown, so
  the sheet grows upward to show them rather than clipping them below the
  screen edge; longer lists scroll inside the capped sheet.

**Fixed mobile navigation must never overlap scrollable content.** The storefront
shell reserves `pb-(--bottom-nav-offset)` (= nav height + safe-area inset +
a 1px rounding buffer) at the
bottom of the page and clears it with `lg:pb-0`. Do not add per-page bottom
padding; the shell is the single source of spacing so long lists, empty states,
pagination, forms, the footer and product-detail actions all remain reachable.
The five-item bar keeps the same 56px height and safe-area padding. Its top
hairline is drawn with a pseudo-element rather than a layout border, so the
clearance token adds only a 1px rounding buffer and no footer edge can sit
beneath the bar even at fractional device sizes.

### Mobile drawer (`components/layout/mobile-nav.tsx`)

The header menu opens the retained left `Sheet` drawer. Its structure is:

- **Brand header** — orange logo mark, "B2B Marketplace", "Wholesale sourcing",
  and the standard close control (the title reserves space for it).
- **Marketplace** — Home, Categories, All Products. Active rows use the same
  `isStorefrontTabActive()` contract as the bottom bar.
- **Business** — signed-in only: Orders and Cart. Signed-out visitors get Sign in
  and Become a Supplier in the footer instead.
- **Popular Categories** — rendered from `getCachedNavigationCategories()`; long
  lists scroll with the drawer body. Active category rows mark
  `aria-current="page"`.
- **Footer** — signed-in buyers get My account + Sign out; supplier/admin/staff
  get their role-appropriate Dashboard + Sign out. Buyer accounts never see a
  workspace dashboard link.

Only implemented routes are rendered: there is no supplier directory, New
Arrivals, or Wholesale Deals destination, so those recommended entries are
omitted rather than linking to `/products` under a different label. The drawer
width, overlay, dismissal, focus trapping, and the 40px header trigger are
unchanged in behaviour. Active drawer rows use a left orange rule plus a tinted
row, so state is not colour-only; every row has a focus-visible ring and
pointer-down press feedback.

### Footer (`components/layout/storefront-footer.tsx`)

Alibaba-style dark navy band: `bg-brand-navy text-white`, white `Separator`, two
link columns under the brand block, bottom legal bar in `text-white/50`.

### Product card (`components/storefront/product-card.tsx`)

Image (square, `object-cover`) → title → **price** (bold `lg`, unit muted) → MOQ
(`bg-muted` micro-badge) → footer bar (`border-t bg-muted/30`): supplier name +
verification shield + location | icon-only add-to-cart action. `!gap-0 !py-0`
card composed with `CardContent`/`CardFooter`; the add action is a 40px
primary-outline icon button so it never dominates the card, and shows a spinner
while the server action is pending. Negotiable flag is a `Badge` (`default`);
price uses `tabular-nums`; the shield icon carries an `sr-only` "Verified
supplier" label (never color-alone). Missing or failed product images render a
deliberate `ImageNotFound` + "No image" fallback inside the stable square.

### Category tile (`components/storefront/home-sections.tsx` `CategoryTile`)

Compact visual category tile used by the homepage "Popular Categories" navigation grid.
Reduced-height image (`h-16`, `object-cover`) supports quick visual scanning without
dominating the tile; the concise single-line category name (`text-xs semibold`) is the
primary reading focus. No product count is shown — the homepage showcase is for
navigation and discovery, not analytics. Rendered in a dense responsive grid
(4 columns mobile → 5–6 tablet → 8 desktop). `!gap-0 !py-0`.

### Product detail (`app/products/[id]/product-detail.tsx`)

2-column grid `lg:grid-cols-[minmax(0,576px)_minmax(380px,440px)] lg:gap-8`:

- Left: **bounded** gallery — 64px thumbnail rail + 12px gap + a 500px square `bg-muted`
  `object-contain` inspection area. The image is never cropped and never grows with the
  viewport, and it scrolls away with the page (no sticky positioning).
- Right: title → price/MOQ card → quantity pricing → quick specs → supplier card →
  actions → **Description/Specifications/Variants tabs** (right column only).

### Product gallery (`components/storefront/product-gallery.tsx`)

One responsive component, no carousel library. The main image comes first in the DOM
(mobile order: image → thumbnails); `lg:order-first` moves the thumbnail rail to the
left on desktop, so mobile is a horizontal scrolling strip and desktop is a vertical
rail. The rail is `lg:max-h-[500px] lg:overflow-y-auto` so many images never make the
gallery tall, and no image is hidden or reordered.

- Thumbnails are `size-16` with `gap-2.5`; selected = `border-primary` **plus** a
  `CheckmarkCircle01Icon` badge (selection is never signalled by color alone) and
  `aria-current`; unselected = `border-border`. Focus uses the standard
  `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`.
- The main image stays `object-contain`; only the thumbnails use `object-cover`.

### Supplier dashboard sidebar (`app/supplier/dashboard/sidebar.tsx`)

Supplier workspace navigation mirrors a modern seller dashboard hierarchy, ordered:
Dashboard, Orders, Delivery, Products (expandable), Analytics, Payouts, Discounts,
Audience, Appearance, Plugins, Settings (expandable).

- **Products** is an expandable parent preserving the existing entries: **Products**
  (`/supplier/dashboard/products`) and **Add product** (`/supplier/dashboard/products/new`),
  plus **Margin** (`/supplier/dashboard/products/margin`) — the supplier's single
  `companies.margin_pct` markup, kept out of the business profile;
  the group opens and highlights when any product route is active, including product edits.
  **Margin** is owner-only and hidden from staff.
- **Settings** is an expandable parent holding the existing **Business profile**
  (`/supplier/dashboard/business`) and **Verification** (`/supplier/dashboard/verification`)
  entries so existing pages stay reachable, plus **Team**
  (`/supplier/dashboard/team`) — the owner's staff list (add by email, revoke).
  Settings is owner-only: staff neither see the group nor its pages (page-level
  `requireOwnerCompany` redirects them to the dashboard).
- Top-level items without a route yet (Orders, Delivery, Analytics, Payouts, Discounts,
  Audience, Appearance, Plugins) render as **inert "Coming soon"** entries — `aria-disabled`,
  no link, no invented route.
- Icons come from the existing Hugeicons set; active state uses `isActive`/`data-active`
  sidebar tokens. Collapse/expand uses the sidebar `Collapsible` + `SidebarMenuSub` pattern
  (chevron rotates on the group's `data-open`). All header/footer/`SidebarRail` and
  `collapsible="icon"` behavior is unchanged.

### Loading states (`components/*/skeletons.tsx`, `app/**/loading.tsx`)

Every route segment owns a `loading.tsx` whose skeleton mirrors the real page —
same container width, section order, grid columns, card heights and row counts —
so navigation never reflows when content arrives.

- Compose the shared primitives instead of hand-rolling:
  `ProductGridSkeleton`, `OrderListSkeleton`, `OrderDetailSkeleton`,
  `CartSkeleton`, `CheckoutSkeleton`, `AccountSkeleton`,
  `SearchHeroSkeleton` (`components/storefront/skeletons.tsx`);
  `PageHeaderSkeleton`, `KpiRowSkeleton`, `ChipRowSkeleton`,
  `TableCardSkeleton`, `FormSectionSkeleton`, `ProductFormSkeleton`,
  `CategoryFormSkeleton`, `BannerFormSkeleton`, `ItemRowsSkeleton`,
  `DetailCardSkeleton` (`components/dashboard/skeletons.tsx`).
- Use the real layout wrappers (bordered `div`, `Card`, the same grid classes)
  with `Skeleton` blocks for content — never one grey rectangle for a whole page.
- Mirror radii (`rounded-sm` badges, `rounded-md` controls, `rounded-lg` cards,
  `rounded-full` chips) and heights (`h-9` controls, `h-10` table headers,
  `h-14` rows, `h-[72px]` KPI cards).
- Skeletons are decorative: `aria-hidden` on the tree, no fake counts, labels or
  focusable controls. `animate-pulse` stops under `prefers-reduced-motion`.

---

## 6. Do / Don't

| Do                                                           | Don't                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| Use semantic color tokens, Inter, radius scale               | Raw hex, new fonts, pill buttons/cards                    |
| Emphasize price, MOQ, supplier + verification                | Hide commercial info behind fluff                         |
| Render real data (from `lib/storefront.ts`)                  | Invent counts for empty states (e.g. hero stats)          |
| Use `!gap-0 !py-0` + own padding on media cards              | Rely on Card's default padding for media layouts          |
| ₹ formatted with `en-IN`, `tabular-nums`                     | Inconsistent currency/number formatting                   |
| Springs from `lib/motion.ts`, press feedback on pointer-down | Overshoot on menus/dialogs, feedback on release only      |
| `bg-card` + `scroll-edge` for top/bottom bars                | Hard 1px dividers under sticky UI                        |
| `MotionConfig reducedMotion="user"` + the CSS media queries  | Animating transform/opacity without a reduced-motion path |
| A route `loading.tsx` that mirrors the real page layout      | One generic skeleton reused for unrelated routes          |

---

## 7. Motion & materials (apple-design)

Source of the interaction language: `.agents/skills/apple-design/SKILL.md`.
The through-line: motion starts from the current on-screen value, stays
interruptible mid-flight, and responds on **pointer-down** — never only on
release.

### Tokens (`app/globals.css`)

| Token                                  | Value                            | Use                                                                 |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `--motion-press`                       | `100ms`                          | press feedback — instant                                            |
| `--motion-fast` / `--motion-base`      | `150ms` / `200ms`                | hover, fades, edges                                                 |
| `--motion-settle`                      | `cubic-bezier(0.22, 1, 0.36, 1)` | critically damped settle: dialogs, menus, panels — never overshoots |
| `--motion-sheet`                       | `cubic-bezier(0.32, 0.72, 0, 1)` | drag-attached sheets/drawers (follows the finger, then settles)     |
| `--material-blur`                      | `blur(20px) saturate(180%)`      | translucent chrome blur                                             |
| `--material-thin` / `--material-heavy` | `--card` @ 78% / 92%             | floating chrome / structural surfaces                               |

### Rules

- **Springs for anything a user can touch.** `lib/motion.ts` exports
  `spring` (critically damped, response 0.4s), `springSnappy` (0.25s),
  `springMomentum` (bounce 0.2 — _only_ after a flick/drag release) and
  `fade`/`fadeRise` variants. The root layout wraps everything in
  `<MotionConfig reducedMotion="user">`. Shared `layoutId` springs handle
  hand-offs: the order ladder's **Now** badge slides to the next step, and
  `StatusFilterChip`'s active fill travels its row (one `layoutId` per row —
  rows never hand off to each other).
- **Never lock input during a transition.** Animate from the live on-screen
  value and let Motion carry velocity through re-targets.
- **Overlays stay on Base UI's CSS transitions** (they are not gesture-driven):
  dialogs/alert-dialogs `duration-200`, menus/popovers/selects/tooltips
  `duration-150`, all on `ease-(--motion-settle)`. The swipeable Drawer keeps
  its own Apple curves (`(0.32,0.72,0,1)`, `(0.22,1,0.36,1)`).
- **Pointer-down response:** buttons press in `button.tsx`; links, tiles,
  filter chips and card links opt in with `press`. Form controls settle rather
  than snap: switch thumb + checkbox/radio fill use `duration-200
ease-(--motion-settle)`; the check/dot indicator pops in with
  `animate-in fade-in zoom-in-95`.
- **One-shot entrances use tw-animate, not Motion** — e.g. KPI cards:
  `animate-in fade-in slide-in-from-bottom-2` + `animation-duration-500` +
  settle ease. CSS plays before hydration (nothing waits for JS, nothing
  renders invisibly), and `animation-duration-*` keeps entrance timing off the
  element's transition clock. Springs stay for touch/layout.
- **Materials:** top and bottom navigation bars are opaque `bg-card` surfaces;
  use `scroll-edge` instead of hard dividers under sticky UI (toggled by
  `data-scrolled`; static always-overlapping chrome sets `data-scrolled="true"`).
  Bottom-anchored chrome adds `data-edge="above"` so the fade sits over content
  sliding underneath (e.g. the product form's sticky action bar). `material` /
  `material-strong` remain available for structural surfaces, but the navigation
  bars do not use them.
- **Accessibility is three signals, all wired globally:** `prefers-reduced-motion`
  (CSS turns transitions into 200ms opacity/colour cross-fades and strips
  slide/zoom from tw-animate keyframes; Motion collapses transforms),
  `prefers-reduced-transparency` and `prefers-contrast: more` (both solidify
  materials to `var(--card)`).

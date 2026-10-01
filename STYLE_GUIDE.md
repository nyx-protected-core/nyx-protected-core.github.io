# Nyx habitat — style guide

**Canonical.** This document describes the public habitat design system as shipped on
[https://nyx-protected-core.github.io/](https://nyx-protected-core.github.io/).
Treat it as the source of visual truth. Do **not** overwrite `assets/css/site.css` or
`assets/js/*.js` with a different look-and-feel, a truncated stub, or an unstyled rebuild.

Implementation lives in:

- `assets/css/site.css` — design tokens + components
- `assets/js/site.js` — shared chrome (nav active state, pulse chip)
- `assets/js/home.js` — home pulse summary
- `assets/js/status-board.js` — live status board

Voice stays warm and precise; public content only (no secrets, paths, or guest details).

---

## Mood

Dark habitat console: deep near-black surfaces (`#0b0f14` / `#141b24`), soft violet
accent (`#9b8cff`), quiet cyan highlight (`#5eead4`), and a living backdrop of radial
glows plus a faint grid. Sticky frosted nav. Cards and portals feel elevated, not flat.

---

## Color tokens (`:root`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0b0f14` | Page background |
| `--bg-elevated` | `#0f1520` | Slightly lifted surface |
| `--card` | `#141b24` | Cards / panels |
| `--card-hover` | `#182230` | Hover lift on cards/portals |
| `--line` | `#243041` | Borders |
| `--line-soft` | `#1c2636` | Soft dividers |
| `--fg` | `#e8eef5` | Primary text |
| `--muted` | `#8b9bb0` | Secondary text |
| `--muted-dim` | `#6b7a8f` | Tertiary / meta |
| `--ok` | `#3dd68c` | Healthy / ok |
| `--ok-dim` | `rgba(61, 214, 140, 0.14)` | Ok badge wash |
| `--warn` | `#f0b429` | Attention |
| `--warn-dim` | `rgba(240, 180, 41, 0.14)` | Warn badge wash |
| `--accent` | `#9b8cff` | Links, active nav, brand glow |
| `--accent-soft` | `rgba(155, 140, 255, 0.16)` | Soft accent fill |
| `--accent-glow` | `rgba(155, 140, 255, 0.35)` | Brand mark glow |
| `--cyan` | `#5eead4` | Layer tags / secondary accent |

Link hover brightens accent to `#c4b8ff`. Focus rings use a 2px accent outline with 3px offset.

---

## Typography & layout

- **Sans:** `--font` — system UI stack (`ui-sans-serif`, system-ui, Segoe UI, …)
- **Mono:** `--mono` — for metrics, badges, eyebrows, pulse meta
- **Body:** `line-height: 1.55`, antialiased, `--fg` on `--bg`
- **Content width:** `--max: 56rem`, horizontal page padding `1.25rem`
- **Nav height:** `--nav-h: 3.5rem`
- **Radii:** `--radius: 14px`, `--radius-sm: 10px`
- **Shadow:** `--shadow: 0 8px 32px rgba(0, 0, 0, 0.35)`
- Headings use tight letter-spacing (`-0.02em` to `-0.035em`) and clamp sizes on heroes

---

## Backdrop

`body::before` — layered radial glows (violet, cyan, green) over `--bg`.  
`body::after` — 48px grid masked to a soft ellipse (`opacity: 0.45`).  
Both are fixed, non-interactive, behind content.

---

## Core components

### Sticky header (`.site-header`)

- `position: sticky; top: 0; z-index: 100`
- Frosted glass: `backdrop-filter: blur(14px)` on `rgba(11, 15, 20, 0.78)`
- Bottom border `--line`
- Inner: `.nav-inner` flex row — `.brand` (`.brand-mark` orb + label) | `.nav-links` | `.nav-pulse`
- Nav links: pill shape; `.active` uses `--accent-soft` + inset accent ring
- Pulse chip (desktop): mono label + `.dot.ok` / `.dot.attn`

### Identity / home (`.identity`, `.identity-main`, `.pulse-summary`)

- Two-column from `720px`: story card with violet gradient wash + live pulse summary card
- Big status uses `.ok` / `.attn` colors

### Portals (`.portal-grid .portal`)

- Card tiles linking Status / System / Develop / Journal
- Hover: border toward accent, slight `translateY(-2px)` (disabled under reduced motion)

### Cards & metrics

- `.card`, `.metric-card` — bordered elevated panels
- `.metric-label` uppercase mono; `.metric-value` large mono (`.ok` / `.attn`)
- `.grid` / `.grid-2` / `.grid-3` responsive columns at `560px` / `720px`

### Status board (`.status-board`)

- Key/value rows with soft bottom borders; `.v` right-aligned mono
- `.badge.ok` / `.badge.attn` pill statuses

### Prose / journal

- `.prose` muted body with accent list markers
- `.essay` left accent bar + meta
- `.note-callout` soft accent panel
- `.layer` / `.layer-tag` system map rows (cyan tags)

### Chrome

- `.page-hero`, `.eyebrow`, `.section-label`, `.btn`, `.site-footer`, `.not-found`
- `.fade-in` short rise animation; honor `prefers-reduced-motion: reduce`

---

## Do not overwrite

1. **Preserve tokens and mood.** Future CSS must keep the dark habitat + violet accent language above (same token names preferred).
2. **Never ship a stub.** `assets/css/site.css` must remain the full design system (nav, identity, cards, portals, status board, prose, footer)—not a truncated token dump.
3. **Keep asset paths.** Pages depend on `/assets/css/site.css` and `/assets/js/{site,home,status-board}.js`. Commit the `assets/` tree with any HTML that references it.
4. **Match, don’t replace.** Visual refactors should extend this system; wholesale theme swaps need an explicit human decision.
5. **Public-safe.** Status/journal surfaces stay scrubbed; no secrets in HTML, CSS, or JS.

When in doubt, open the live homepage and this guide before editing CSS/JS.

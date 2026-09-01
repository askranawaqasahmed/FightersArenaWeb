# Theme and Design System

## Brand Direction

**Product:** eFightersArena  
**Mood:** professional esports, high energy, trustworthy statistics, and operator-grade clarity.  
**Default mode:** light. Dark arena imagery and code surfaces are used selectively for depth rather than across the entire interface.  
**Rule:** neon is an accent, not a background flood. Competition data remains readable for long sessions.

## Core Palette

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#F7F9FC` | Main app and public-site background |
| `text-primary` | `#111820` | Primary headings and essential content |
| `accent-primary` | `#00FF85` | Primary actions, live/verified emphasis, selected state |
| `accent-secondary` | `#1E90FF` | Links, information, charts, secondary actions |
| `accent-hover` | `#FF0099` | Intentional hover/focus flourish and promotional emphasis |

The original `#0D0D0D` and `#FFFFFF` pair remains the optional dark-theme foundation and may be used on photographic hero overlays or future user-selectable dark mode.

## Supporting Tokens

| Token | Suggested value | Usage |
| --- | --- | --- |
| `surface-1` | `#FFFFFF` | Cards and navigation |
| `surface-2` | `#EEF3F7` | Raised panels, tables, inputs |
| `surface-3` | `#E2E9EF` | Hovered neutral surfaces |
| `border-subtle` | `#D7E0E8` | Dividers and card borders |
| `text-secondary` | `#44515F` | Supporting copy |
| `text-muted` | `#71808F` | Metadata; avoid for critical small text |
| `success` | `#00D975` | Success independent from brand neon |
| `warning` | `#FFB020` | Warnings and pending states |
| `danger` | `#FF4D5E` | Destructive actions and errors |
| `focus-ring` | `#63B3FF` | Accessible keyboard focus |

```css
:root {
  --color-background: #f7f9fc;
  --color-surface-1: #ffffff;
  --color-surface-2: #eef3f7;
  --color-surface-3: #e2e9ef;
  --color-border-subtle: #d7e0e8;
  --color-text-primary: #111820;
  --color-text-secondary: #44515f;
  --color-text-muted: #71808f;
  --color-accent-primary: #00ff85;
  --color-accent-secondary: #1e90ff;
  --color-accent-hover: #ff0099;
  --color-success: #00d975;
  --color-warning: #ffb020;
  --color-danger: #ff4d5e;
  --color-focus-ring: #63b3ff;
}
```

These names are platform-neutral and should be exported to the future mobile app from one token source.

## Color Usage

- Use near-black on white/light surfaces for primary text.
- Use white on the limited dark photographic/code surfaces.
- Use dark text on neon green filled buttons; verify contrast at final component size.
- Electric blue is the default inline-link color.
- Vivid pink is primarily hover, promotional, or rivalry energy—not the only indicator of state.
- Never encode winners, losses, live state, or errors with color alone; add text/icon/pattern.
- Limit glow effects to hero art, selected navigation, live indicators, and key calls to action.

## Typography

- Display: a licensed geometric/condensed sans with strong numerals; proposed starting point is `Barlow Condensed`.
- Interface/body: `Inter` or a comparable highly legible sans.
- Statistics: tabular numerals enabled for brackets, standings, dates, scores, and dashboards.
- Body text should generally remain at least 16px on public/mobile views and 14px only for dense admin metadata.

## Layout and Components

- Use an 8px spacing foundation, restrained 10–16px radii, and thin neutral borders.
- Public pages may use angled motifs and subtle grid/noise textures; admin screens prioritize straight data alignment.
- Core components: app shell, hero carousel, entity card, stat chip, verification badge, match card, bracket canvas, standings table, timeline, filter bar, command/search palette, status badge, and audit drawer.
- Brackets need horizontal pan/zoom, round focus, compact mobile match lists, keyboard navigation, and a non-visual accessible representation.
- Tables need sticky headers, clear sorting, column controls, row actions, empty/loading/error states, and responsive alternatives.

## Motion

- Use 120–220ms transitions for hover/focus and 240–400ms for panels.
- Animate bracket advancement and score updates without shifting surrounding layout.
- Honor `prefers-reduced-motion` and provide static equivalents.

## Imagery

- Favor authentic player/event photography, game-neutral competitive lighting, and strong subject crops.
- Admin-managed hero images require desktop and mobile focal points, alt text, attribution/rights metadata, publish dates, and optimized variants.
- Avoid using publisher artwork, game logos, team logos, or player likenesses without appropriate permission.

## Accessibility Acceptance

- Target WCAG 2.2 AA for public and admin interfaces.
- Verify actual text/background pairs with a contrast tool; palette ownership does not guarantee every composition passes.
- All interactive elements have visible focus, names, keyboard access, touch targets, and non-color state cues.
- Live score updates use polite announcements and avoid excessive screen-reader noise.
- Charts, brackets, and carousels provide structured text/table alternatives.

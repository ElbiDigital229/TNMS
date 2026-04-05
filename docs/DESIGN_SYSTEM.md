# Design System

## Color Palette

### Primary (Teal)
The primary brand color is teal, defined in Tailwind config with shades 50-950:
- `primary-500` / `primary-600`: Main action color (#0ea899)
- Used for: buttons, links, active states, badges, progress indicators

### Sidebar (Dark Navy)
- Base: `#0D2637`
- Hover: slightly lighter
- Active: slightly lighter than hover
- Border: subtle light border
- Text: muted white, brightens on hover/active

### Status Colors
| Status | Color |
|--------|-------|
| OPEN | Blue (bg-blue-50, text-blue-700) |
| IN_PROGRESS | Amber (bg-amber-50, text-amber-700) |
| OVERDUE | Red (bg-red-50, text-red-700) |
| COMPLETED | Emerald (bg-emerald-50, text-emerald-700) |
| ACTIVE | Emerald |
| INACTIVE | Gray |
| BLOCKED | Red |

### Priority Colors
| Priority | Color |
|----------|-------|
| CRITICAL | Red |
| HIGH | Orange |
| MEDIUM | Amber |
| LOW | Sky blue |

### Asset Condition Colors
| Condition | Color |
|-----------|-------|
| EXCELLENT | Emerald |
| GOOD | Sky |
| FAIR | Amber |
| POOR | Red |

### Task Type Colors (Charts)
| Type | Color |
|------|-------|
| COMPLAIN | Red |
| MAINTENANCE | Orange |
| INSPECT | Violet |
| TASK | Sky |

## Typography

- **Font**: Inter (loaded via Google Fonts)
- **Page title**: `text-lg font-semibold text-gray-900`
- **Page subtitle**: `text-sm text-gray-500`
- **Monospace**: `font-mono text-sm`

## Component Classes (`cls` object)

All reusable class strings are centralized in `client/src/lib/styles.ts`. Import and use:

```tsx
import { cls } from "../lib/styles";

<h1 className={cls.pageTitle}>Page Title</h1>
<div className={cls.card}>
  <div className={cls.cardPad}>Content</div>
</div>
```

### Layout
- `cls.card` - White rounded card with shadow and border
- `cls.cardPad` - Standard card padding
- `cls.section` - Section spacing

### Typography
- `cls.pageTitle` - Page heading
- `cls.pageSub` - Page subtitle
- `cls.mono` - Monospace text
- `cls.link` - Styled link

### Buttons
- `cls.btnPrimary` - Teal filled button
- `cls.btnSecondary` - Gray outlined button
- `cls.btnDanger` - Red filled button
- `cls.btnGhost` - Transparent with hover
- `cls.btnIcon` - Icon-only button

### Forms
- `cls.input` - Text input styling
- `cls.select` - Select dropdown styling
- `cls.label` - Form label
- `cls.textarea` - Textarea styling

### Tables
- `cls.table` - Table base styling
- `cls.th` - Table header cell
- `cls.td` - Table data cell
- `cls.tr` - Table row
- `cls.trClick` - Clickable table row with hover

### Badges
- `cls.badge` - Base badge styling
- `cls.badgeDot` - Small dot badge

### Pagination
- Pagination container and button classes

### Empty States
- `cls.emptyIcon` - Empty state icon styling
- `cls.emptyTitle` - Empty state heading
- `cls.emptySub` - Empty state description

## Status Badge Helper

```tsx
import { statusBadge } from "../lib/styles";

const { bg, text } = statusBadge["OPEN"];
// bg = "bg-blue-50", text = "text-blue-700"
```

Similar helpers exist for priority, condition, and task type badges.

## Mobile Responsiveness

- Mobile tab bar: dark navy background matching sidebar
- Responsive breakpoints via Tailwind (sm, md, lg, xl)
- Mobile-specific layouts: horizontal scroll strips instead of grids
- Touch-friendly tap targets
- Swipe support in lightbox viewer

## Splash Screen

On app load, a branded splash screen shows:
- Dark navy background (#0D2637)
- TRUE NORTH logo (animated fade-in)
- Teal spinning loader
- Fades out (0.4s transition) once React app is ready
- Implemented as inline HTML/CSS in `index.html` for instant display

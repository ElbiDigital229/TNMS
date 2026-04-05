# TNMS Design System

## Color Palette

### Primary — Deep Teal
Derived from the sidebar panel. Used for primary actions, navigation, and brand identity.

| Token         | Hex       | Usage                                      |
|---------------|-----------|---------------------------------------------|
| `primary-50`  | `#effcf9` | Subtle backgrounds, hover states            |
| `primary-100` | `#c7f7ec` | Light badges, active nav backgrounds        |
| `primary-200` | `#93efdd` | Focus rings, light borders                  |
| `primary-300` | `#55dfca` | Soft accents                                |
| `primary-400` | `#24c9b2` | Icons, secondary buttons                    |
| `primary-500` | `#0ea899` | Primary accent, links, active states        |
| `primary-600` | `#07897e` | Primary buttons, active nav items           |
| `primary-700` | `#096e68` | Button hover, emphasized text               |
| `primary-800` | `#0b5753` | Dark accents                                |
| `primary-900` | `#0e4744` | Dark badges                                 |
| `primary-950` | `#032b2b` | Darkest accent, contrasting elements        |

### Sidebar — Dark Navy Teal
Used exclusively for the sidebar/navigation panel.

| Token            | Hex       | Usage                                   |
|------------------|-----------|------------------------------------------|
| `sidebar-bg`     | `#0D2637` | Main sidebar background                  |
| `sidebar-hover`  | `#143345` | Hovered nav items                        |
| `sidebar-active` | `#1A4058` | Active/selected nav item                 |
| `sidebar-border` | `#1C3D52` | Dividers inside sidebar                  |
| `sidebar-text`   | `#8BA4B8` | Inactive nav text                        |
| `sidebar-text-active` | `#FFFFFF` | Active nav text + icons              |

### Neutral — Warm Gray
For text, borders, backgrounds, and cards.

| Token       | Hex       | Usage                           |
|-------------|-----------|----------------------------------|
| `gray-50`   | `#f8fafb` | Page background                  |
| `gray-100`  | `#f1f4f6` | Card hover, secondary background |
| `gray-200`  | `#e3e8ec` | Borders, dividers                |
| `gray-300`  | `#cdd5dc` | Disabled borders                 |
| `gray-400`  | `#9ba8b5` | Placeholder text, disabled       |
| `gray-500`  | `#6b7b8a` | Secondary text                   |
| `gray-600`  | `#4b5c6b` | Body text                        |
| `gray-700`  | `#374855` | Headings, emphasis               |
| `gray-800`  | `#243440` | Strong text                      |
| `gray-900`  | `#152330` | Primary text                     |

### Semantic Colors

| Token         | Hex       | Usage                             |
|---------------|-----------|-----------------------------------|
| `success-500` | `#16a34a` | Completed, success states         |
| `success-50`  | `#f0fdf4` | Success badges background         |
| `warning-500` | `#ea9010` | Overdue, due-soon, caution        |
| `warning-50`  | `#fffbeb` | Warning badges background         |
| `danger-500`  | `#dc2626` | Critical, errors, destructive     |
| `danger-50`   | `#fef2f2` | Danger badges background          |
| `info-500`    | `#0ea5e9` | Info states, open tickets         |
| `info-50`     | `#f0f9ff` | Info badges background            |

---

## Typography

**Font**: Inter (with `cv02`, `cv03`, `cv04`, `cv11` OpenType features)

| Element          | Size   | Weight | Color       | Line Height |
|------------------|--------|--------|-------------|-------------|
| Page heading     | 20px   | 600    | `gray-900`  | 1.4         |
| Section heading  | 13px   | 600    | `gray-900`  | 1.5         |
| Body             | 14px   | 400    | `gray-600`  | 1.5         |
| Body emphasis    | 14px   | 500    | `gray-900`  | 1.5         |
| Caption          | 13px   | 400    | `gray-500`  | 1.5         |
| Small / Meta     | 11px   | 500    | `gray-400`  | 1.4         |
| Mono (IDs)       | 12px   | 600    | `primary-600` | 1          |
| Nav item         | 13px   | 500    | sidebar     | 1           |

---

## Spacing & Layout

| Token  | Value | Usage                            |
|--------|-------|----------------------------------|
| `xs`   | 4px   | Inline gaps, badge padding       |
| `sm`   | 8px   | Between related items            |
| `md`   | 16px  | Card padding, section gaps       |
| `lg`   | 24px  | Between sections                 |
| `xl`   | 32px  | Page margins                     |
| `2xl`  | 48px  | Major section separators         |

---

## Border Radius

| Token      | Value | Usage                        |
|------------|-------|------------------------------|
| `sm`       | 6px   | Badges, small elements       |
| `DEFAULT`  | 8px   | Buttons, inputs              |
| `lg`       | 12px  | Cards, dropdowns             |
| `xl`       | 16px  | Modals, bottom sheets        |
| `2xl`      | 20px  | Mobile overlays              |
| `full`     | 9999px| Pills, avatars               |

---

## Shadows

| Token   | Value                                     | Usage              |
|---------|-------------------------------------------|--------------------|
| `sm`    | `0 1px 2px rgba(13,38,55,0.05)`           | Cards, inputs      |
| `md`    | `0 4px 12px rgba(13,38,55,0.08)`          | Dropdowns, hover   |
| `lg`    | `0 8px 24px rgba(13,38,55,0.12)`          | Modals, popovers   |
| `xl`    | `0 16px 48px rgba(13,38,55,0.16)`         | Full-screen sheets |
| `ring`  | `ring-1 ring-gray-950/5`                  | Card outlines      |

---

## Components

### Buttons

| Variant     | Background      | Text         | Border         | Hover               |
|-------------|-----------------|--------------|----------------|----------------------|
| Primary     | `primary-600`   | `white`      | none           | `primary-700`        |
| Secondary   | `white`         | `gray-700`   | `ring-gray-300`| `gray-50`            |
| Danger      | `danger-500`    | `white`      | none           | `danger-600`         |
| Ghost       | transparent     | `primary-600`| none           | `primary-50`         |
| Icon        | `gray-100`      | `gray-600`   | none           | `gray-200`           |

### Badges / Pills

| Variant    | Background    | Text           |
|------------|---------------|----------------|
| Open       | `info-50`     | `info-600`     |
| In Progress| `warning-50`  | `warning-600`  |
| Overdue    | `danger-50`   | `danger-700`   |
| Completed  | `success-50`  | `success-600`  |
| Blocked    | `orange-100`  | `orange-700`   |
| Critical   | `danger-50`   | `danger-600`   |
| High       | `orange-50`   | `orange-600`   |
| Medium     | `warning-50`  | `warning-600`  |
| Low        | `info-50`     | `info-600`     |

### Cards
- Background: `white`
- Border: `ring-1 ring-gray-950/5`
- Shadow: `shadow-sm`
- Radius: `rounded-xl` (12px)
- Padding: `p-5`
- Hover (if interactive): `hover:shadow-md`

### Inputs
- Background: `white`
- Border: `border border-gray-300`
- Radius: `rounded-lg` (8px)
- Padding: `px-4 py-2.5`
- Focus: `border-primary-400 ring-4 ring-primary-100`

### Table Rows (Interactive)
- Default: transparent
- Hover: `bg-primary-50/40`
- Cursor: `pointer` on clickable rows
- Border: `border-b border-gray-100`

---

## Animation

| Name       | Duration | Easing   | Usage                     |
|------------|----------|----------|---------------------------|
| `fade-in`  | 200ms    | ease-out | Page content entry        |
| `slide-up` | 200ms    | ease-out | Mobile bottom sheets      |
| `scale-in` | 200ms    | ease-out | Modals, dropdowns         |

---

## Responsive Breakpoints

| Breakpoint | Width  | Usage                              |
|------------|--------|------------------------------------|
| mobile     | < 768  | Bottom tab bar, card views, sheets |
| tablet     | 768+   | Sidebar, table views, dropdowns    |
| desktop    | 1024+  | Full sidebar visible, 3-col grid   |

---

## Iconography

- **Library**: Lucide React
- **Sizes**: 14px (inline), 16px (buttons), 18px (nav), 20px (tab bar), 24px (stat cards)
- **Style**: Stroke-based, 2px stroke width
- **Colors**: Follow text color of parent context

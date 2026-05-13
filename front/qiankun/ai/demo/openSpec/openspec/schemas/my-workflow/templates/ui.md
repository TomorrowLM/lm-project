# UI Design: [Change Name]

## Overview

Purpose and scope of the UI changes. What user problem does this solve? What are the key user flows?

## Layout

### Page Structure

Describe the overall page layout:
- Header / Navigation
- Main content area
- Sidebar (if applicable)
- Footer

### Wireframes

[Insert wireframe images or ASCII diagrams if available]

```
┌─────────────────────────────┐
│         Header              │
├─────────────────────────────┤
│                             │
│      Main Content           │
│                             │
├─────────────────────────────┤
│         Footer              │
└─────────────────────────────┘
```

## Components

### Component List

| Component | Purpose | States |
|-----------|---------|--------|
| Button | User actions | Default, Hover, Active, Disabled |
| Card | Content container | Default, Loading, Error |
| Modal | Overlay dialogs | Open, Closed, Transitioning |

### Component Details

#### [Component Name]

**Purpose**: What this component does

**Props/Attributes**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| variant | string | No | "default" | Visual style variant |

**States**:
- Default
- Hover
- Active/Focus
- Disabled
- Loading
- Error

## User Flow

### Flow 1: [Name]

1. User sees [initial state]
2. User performs [action]
3. System responds with [feedback]
4. UI transitions to [next state]

**Happy Path**:
```
[Step 1] → [Step 2] → [Step 3] → Success
```

**Error Path**:
```
[Step 1] → [Error] → [Error State] → Recovery
```

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | ≤ 767px | Single column, stacked |
| Tablet | 768px - 1023px | Two columns |
| Desktop | ≥ 1024px | Full layout |

### Mobile Adaptations

- Navigation: [Hamburger menu / Bottom nav / etc.]
- Content: [Stacked / Hidden / Simplified]
- Interactions: [Touch-optimized / Swipe gestures]

## Accessibility

### ARIA Labels

- [Element]: `aria-label="description"`
- [Element]: `role="region"`

### Keyboard Navigation

- Tab order: [Describe logical tab sequence]
- Shortcut keys: [List any keyboard shortcuts]
- Focus management: [How focus is handled]

### Contrast Ratios

| Element | Foreground | Background | Ratio | WCAG Level |
|---------|------------|------------|-------|------------|
| Primary Text | #111 | #FFF | 16:1 | AAA |
| Secondary Text | #666 | #FFF | 5.7:1 | AA |

## Design Tokens

### Colors

```css
--color-primary: #111;
--color-secondary: #666;
--color-border: #e0e0e0;
--color-background: #fff;
--color-error: #d32f2f;
--color-success: #2e7d32;
```

### Typography

```css
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 20px;
--font-size-xl: 24px;
```

### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

## Animations & Transitions

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Hover | Opacity change | 200ms | ease-in-out |
| Page transition | Fade | 300ms | ease |
| Modal open | Scale + Fade | 250ms | ease-out |

**Constraints**:
- Max transition duration: 300ms (performance)
- No `@keyframes` animations (per project convention)

## Assets

List required assets:
- Images: [SVG icons, illustrations, etc.]
- Fonts: [System fonts only, per convention]

## Open Questions

- [ ] Question about [specific UI decision]
- [ ] Need clarification on [user flow]
- [ ] Design review pending for [component]

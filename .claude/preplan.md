# Preplan: Google Vibe OS - Swiss Nihilism UI

**Source:** `/Users/lauriescheepers/CodeTonight/enter-konsult-website`
**Target:** Match enterkonsult.com aesthetic exactly
**Mode:** ut++ (maximum reasoning, all principles enforced)

---

## Swiss Nihilism Design Principles

From ENTER Konsult CLAUDE.md:

> **Visual Identity**: Swiss Nihilist Design - stark, asymmetric, intentional tension

### Core Tenets

1. **Every element must have visual purpose and tension**
2. **Asymmetric grid layouts** (12-column, offset content)
3. **Keyboard metaphors** (ENTER button right-aligned like return key)
4. **Typography hierarchy over decoration**
5. **Monospace for metadata/labels**
6. **Zero border-radius on interactive elements**
7. **Black buttons, orange hover**
8. **Grayscale-to-color image transitions**

---

## Colour Palette (Authoritative)

| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Paper Grey | `#EAEAEA` | `bg-[#EAEAEA]` | Page background |
| Black | `#000000` | `text-black` | Headings, buttons |
| Dark | `#1a1a1a` | `bg-[#1a1a1a]` | CLI panels, code blocks |
| Orange | `#ea580c` | `text-orange-600` | Accents, CTAs, active states |
| Grey 300 | - | `border-gray-300` | Borders, dividers |
| Grey 500 | - | `text-gray-500` | Secondary text |
| Grey 600 | - | `text-gray-600` | Muted body text |
| White | `#ffffff` | `bg-white` | Cards, form backgrounds |

---

## Typography System

| Element | Classes |
|---------|---------|
| Hero Heading | `text-4xl sm:text-5xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.95]` |
| Section Heading | `text-5xl md:text-7xl font-bold tracking-tighter` |
| Card Title | `text-xl font-bold tracking-tight` |
| Body | `text-lg md:text-xl font-sans` |
| Labels | `font-mono text-xs uppercase tracking-widest` |
| Metadata | `font-mono text-xs text-gray-500` |
| Code/CLI | `font-mono text-xs bg-[#1a1a1a] text-gray-300` |

---

## Component Patterns

### Buttons

```css
/* Primary (Black with orange hover) */
.btn-primary {
  background: #000000;
  color: #ffffff;
  padding: 1rem 2rem;
  border-radius: 0;           /* CRITICAL: Sharp corners */
  font-family: ui-monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background-color 0.3s;
}
.btn-primary:hover {
  background: #ea580c;
}

/* Secondary (Border only) */
.btn-secondary {
  background: transparent;
  border: 1px solid #000000;
  color: #000000;
  padding: 1rem 2rem;
  border-radius: 0;
}
.btn-secondary:hover {
  background: #000000;
  color: #ffffff;
}
```

### Cards

```css
.card-swiss {
  background: #ffffff;
  border: 1px solid #d1d5db;    /* gray-300 */
  border-radius: 0;             /* Sharp corners */
  padding: 2rem;
}

/* Accent bar variant */
.card-accent {
  border-left: 3px solid #ea580c;
}
```

### Navigation

```css
.nav-link {
  font-family: ui-monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;              /* gray-500 */
  transition: color 0.3s;
}
.nav-link:hover,
.nav-link.active {
  color: #000000;
}
.nav-link.active::after {
  content: '';
  display: block;
  height: 1px;
  background: #000000;
}
```

### Input Fields

```css
.input-swiss {
  background: #f9fafb;         /* gray-50 */
  border: none;
  border-bottom: 1px solid #d1d5db;
  padding: 0.75rem;
  font-family: inherit;
  border-radius: 0;
}
.input-swiss:focus {
  background: #ffffff;
  border-bottom-color: #ea580c;
  border-bottom-width: 2px;
  outline: none;
}
```

### Hover States

```css
/* Translate on hover */
.hover-translate:hover {
  transform: translateX(0.5rem);
}

/* Tracking expand on hover */
.hover-track:hover {
  letter-spacing: 0.15em;
}

/* Orange text on hover */
.hover-orange:hover {
  color: #ea580c;
}
```

---

## Gap Analysis: Current vs Target

### Current (Vibe OS)

```css
:root {
    --bg-color: #f8f9fc;                    /* Wrong - too blue */
    --card-bg: rgba(255,255,255,0.65);      /* Wrong - glassmorphism */
    --accent-primary: #6200ea;              /* Wrong - purple */
    --accent-secondary: #00b4d8;            /* Wrong - cyan */
    --glass-effect: blur(25px);             /* Wrong - no blur */
    --radius-lg: 24px;                      /* Wrong - too rounded */
    --radius-md: 16px;                      /* Wrong - too rounded */
}
```

### Target (Swiss Nihilism)

```css
:root {
    --bg-color: #EAEAEA;                    /* Paper Grey */
    --card-bg: #ffffff;                     /* Solid white */
    --text-primary: #1a1a1a;                /* Dark */
    --text-heading: #000000;                /* Black */
    --accent-primary: #ea580c;              /* Orange */
    --accent-secondary: #ea580c;            /* Mono-accent */
    --border-color: #d1d5db;                /* Gray 300 */
    --muted: #6b7280;                       /* Gray 500 */
    --glass-effect: none;                   /* No blur */
    --radius-lg: 0;                         /* Sharp */
    --radius-md: 0;                         /* Sharp */
    --font-mono: ui-monospace, "SF Mono", "Consolas", monospace;
}
```

---

## Implementation Plan

### Phase 1: CSS Variables (`dashboard/src/index.css`)

Replace entire `:root` block with Swiss Nihilism tokens.

### Phase 2: Body & Background

```css
body {
    background-color: #EAEAEA;
    background-image: none;          /* Remove gradients */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

### Phase 3: Header

```css
.header {
    background: rgba(234, 234, 234, 0.9);   /* Paper Grey with blur */
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #d1d5db;
    animation: none;                         /* Remove decorative animation */
}

.header-content h1 {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #000000;
    background: none;
    -webkit-text-fill-color: inherit;
}
```

### Phase 4: Cards

```css
.card {
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-left: 3px solid #ea580c;         /* Orange accent bar */
    border-radius: 0;
    backdrop-filter: none;
    box-shadow: none;
    padding: 2rem;
}

.card:hover {
    transform: none;                         /* No float */
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}
```

### Phase 5: Card Titles

```css
.card-title {
    font-family: ui-monospace;
    font-size: 0.75rem;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #000000;
}
```

### Phase 6: Badges

```css
.badge {
    background: #000000;
    color: #ffffff;
    font-family: ui-monospace;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.25rem 0.5rem;
    border-radius: 0;
}
```

### Phase 7: List Items

```css
.list-item {
    background: transparent;
    border: none;
    border-bottom: 1px solid #d1d5db;
    border-radius: 0;
    padding: 1rem 0;
    margin-bottom: 0;
}

.list-item:hover {
    background: rgba(234, 88, 12, 0.05);    /* Subtle orange tint */
    transform: none;
}

.list-item:last-child {
    border-bottom: none;
}
```

### Phase 8: File Cards

```css
.file-card {
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 0;
    padding: 1rem;
}

.file-thumb {
    border-radius: 0;
    filter: grayscale(100%);
    transition: filter 0.3s;
}

.file-card:hover .file-thumb {
    filter: grayscale(0%);
}
```

### Phase 9: Agent Panel (CLI Style)

```css
.agent-panel {
    background: #1a1a1a;                    /* Dark terminal */
    color: #d1d5db;
    border: 1px solid #374151;              /* gray-700 */
    border-radius: 0.5rem;                  /* Exception: terminal window */
}

.agent-chat-area {
    background: transparent;
    border: none;
}

/* Message bubbles */
.agent-message {
    background: #374151;                    /* gray-700 */
    color: #f3f4f6;
    border-radius: 0;
}

.user-message {
    background: #ea580c;
    color: #ffffff;
    border-radius: 0;
}

.agent-input {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 0;
    color: #f3f4f6;
}

.agent-input:focus {
    border-color: #ea580c;
    box-shadow: none;
}
```

### Phase 10: Buttons in JSX

**App.jsx Login Button:**

```jsx
style={{
    background: '#000000',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '0',
    fontFamily: 'ui-monospace',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
}}
```

**AgentPanel Send Button:**

```jsx
style={{
    background: '#ea580c',
    borderRadius: '0',
    width: '44px',
    height: '44px',
}}
```

### Phase 11: Animations

```css
/* Remove decorative animations */
.header {
    animation: none;
}

/* Keep subtle fade-in only */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Remove hover transforms */
.card:hover,
.list-item:hover,
.file-card:hover {
    transform: none;
}
```

### Phase 12: Icons

Update icon colours in App.jsx:

```jsx
// Mail icon
<Mail color="#ea580c" />

// Calendar icon
<Calendar color="#ea580c" />

// Drive icon
<HardDrive color="#ea580c" />
```

---

## Files to Modify

| File | Changes | Tokens |
|------|---------|--------|
| `dashboard/src/index.css` | Full CSS overhaul | ~1000 |
| `dashboard/src/App.jsx` | Inline styles, icon colours | ~600 |
| `dashboard/src/components/AgentPanel.jsx` | CLI styling, input/button | ~400 |

**Total Estimate:** ~2000 tokens

---

## Visual Checklist

- [ ] Paper Grey `#EAEAEA` background (full page)
- [ ] White cards with orange left border accent
- [ ] Black headings, no gradient text
- [ ] Zero border-radius on buttons and cards
- [ ] No glassmorphism/blur effects on cards
- [ ] No decorative shadows
- [ ] Monospace uppercase labels (ui-monospace)
- [ ] Orange `#ea580c` as ONLY accent colour
- [ ] No purple, no cyan
- [ ] No hover float animations
- [ ] CLI-style Agent Panel (dark terminal aesthetic)
- [ ] Grayscale-to-color on file thumbnails hover
- [ ] 1px `#d1d5db` borders

---

## Reference Screenshots

From enterkonsult.com App.jsx:

```jsx
// Background
<div className="min-h-screen bg-[#EAEAEA] text-black font-sans selection:bg-orange-600 selection:text-white">

// Header
<header className="sticky top-0 z-50 bg-[#EAEAEA]/90 backdrop-blur-sm border-b border-gray-300">

// Primary button
<button className="bg-black text-white px-8 py-4 hover:bg-orange-600 transition-colors">
    <span className="font-mono text-base tracking-widest uppercase">ENTER</span>
</button>

// Card/Panel
<div className="bg-black text-white p-8">

// Labels
<span className="font-mono text-xs uppercase tracking-widest text-gray-500">
```

---

## Execution Command

```bash
cc  # Fresh session with 2k tokens
# "Execute preplan from .claude/preplan.md - Swiss Nihilism UI transformation"
```

---

**Prepared:** 2025-12-26
**Source:** enter-konsult-website App.jsx + CLAUDE.md
**Status:** EXECUTED
**Executed:** 2025-12-26
**Estimated Tokens:** 2000

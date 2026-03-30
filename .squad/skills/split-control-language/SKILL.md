---
name: "Split Control Language"
description: "Visual differentiation between interactive controls (buttons/toggles with affordance) and informational elements (badges/pills that are passive)—preventing interactive UI from being mistaken for read-only content."
domain: "frontend"
confidence: "medium"
source: "earned"
---

## Context

In information-dense UI, mixing interactive and passive elements can create cognitive overload: users don't know what they can click. The solution is a visual language that separates the two clearly—interactive controls need affordance (hover state, tighter corners, visually "pressed"), while informational elements stay quiet and passive (rounded, neutral, no pointer).

This pattern is especially important in toolbars and summary sections where metrics (badges) sit near controls (toggles, buttons). Without clear differentiation, users waste time testing what's clickable.

## Patterns

### 1. Interactive Control Styling
Controls that change app state should have:
- **Tighter border radius** (4–6px vs. 16–24px for pills)
- **Visible hover state** (background color change, shadow, or border highlight)
- **Clear affordance** (cursor: pointer, background that invites clicks)
- **Focus outline** for keyboard users

```css
.control-button {
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-neutral);
  border: 1px solid var(--border-neutral);
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-button:hover,
.control-button:focus-visible {
  background: var(--bg-control-hover);
  border-color: var(--border-control-active);
  outline: 2px solid var(--focus-ring);
}

.control-button.active {
  background: var(--bg-control-active);
  color: var(--text-control-active);
}
```

### 2. Passive Element Styling
Informational elements (badges, pills, metric summaries) should be:
- **Fully rounded** (border-radius: 999px)
- **No hover state** (static appearance)
- **Neutral, de-emphasized colors** (gray, lighter tones)
- **No pointer cursor** (let users know they can't click)

```css
.metric-badge {
  border-radius: 999px;
  padding: 0.375rem 0.75rem;
  background: var(--bg-badge);
  color: var(--text-badge);
  font-size: 0.875rem;
  cursor: default;
  /* No hover state */
}
```

### 3. Toolbar Layout Pattern
Group controls and metrics into distinct areas within a toolbar:

```html
<!-- Controls on the left (interactive) -->
<div class="toolbar">
  <div class="toolbar-controls">
    <button class="control-button" data-action="hide-blocked">
      Hide Blocked
    </button>
    <button class="control-button" data-action="toggle-burndown">
      Show Progress <span class="icon-chevron">▼</span>
    </button>
  </div>

  <!-- Metrics on the right (passive info) -->
  <div class="toolbar-metrics">
    <span class="metric-badge">3 of 12 done</span>
    <span class="metric-badge">2 blocked</span>
  </div>
</div>
```

### 4. Active/Selected States for Controls
Communicating control state (pressed, toggled, selected) without relying on hover alone:

```css
.control-button.active {
  background: var(--bg-control-active);
  color: var(--text-control-active);
}

.control-button.active::after {
  content: '✓';
  margin-left: 0.25rem;
}
```

In markup:
```html
<button class="control-button active" data-action="hide-blocked">
  Hide Blocked ✓
</button>
```

### 5. Disclosure Control Pattern
For expandable/collapsible sections, communicate state in both text and iconography:

```html
<button class="control-button" data-action="toggle-burndown">
  <span class="toggle-label">Show Progress</span>
  <span class="toggle-icon">▼</span>
</button>

<!-- When expanded: -->
<button class="control-button" data-action="toggle-burndown">
  <span class="toggle-label">Hide Progress</span>
  <span class="toggle-icon">▲</span>
</button>
```

CSS:
```css
.toggle-icon {
  display: inline-block;
  transition: transform 0.2s ease;
  margin-left: 0.25rem;
}

.control-button[data-expanded="true"] .toggle-icon {
  transform: rotate(180deg);
}
```

## Examples

### Real Case: Toolbar Controls + Metric Pills

**Scenario:** The todo app has a toolbar with a "Hide Blocked" toggle, a "Show Progress" disclosure button, and passive metric badges showing progress and blocker counts.

**Before (unclear differentiation):**
```css
/* All items treated the same */
.toolbar-item {
  border-radius: 8px;
  padding: 0.5rem;
  background: var(--bg-neutral);
  color: var(--text-default);
}
```

HTML mixed controls and badges with no visual separation:
```html
<div class="toolbar">
  <span class="toolbar-item">Hide Blocked</span>
  <span class="toolbar-item">Show Progress</span>
  <span class="toolbar-item">3 of 12 done</span>
  <span class="toolbar-item">2 blocked</span>
</div>
```

Users had to test by clicking to figure out what was actionable.

**After (split language):**

Controls get tighter corners and hover affordance:
```css
.control-button {
  border-radius: 6px;
  background: var(--bg-neutral);
  border: 1px solid var(--border-neutral);
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  transition: all 0.15s ease;
}

.control-button:hover {
  background: var(--bg-control-hover);
  border-color: var(--border-control-active);
}
```

Metrics are fully rounded, static, and quiet:
```css
.metric-badge {
  border-radius: 999px;
  background: var(--bg-badge);
  padding: 0.375rem 0.75rem;
  cursor: default;
  /* No hover transition */
}
```

HTML now clearly groups them:
```html
<div class="toolbar">
  <div class="toolbar-controls">
    <button class="control-button" data-action="hide-blocked">
      Hide Blocked ✓
    </button>
    <button class="control-button" data-action="toggle-burndown">
      Show Progress ▼
    </button>
  </div>

  <div class="toolbar-metrics">
    <span class="metric-badge">3 of 12 done</span>
    <span class="metric-badge">2 blocked</span>
  </div>
</div>
```

**Result:** Users instantly recognize controls vs. metrics. The visual language is consistent, reducing cognitive load.

## Anti-Patterns

1. **Mixing hover states:** Don't apply hover effects to passive badges. They confuse users into thinking they're clickable.

2. **Using the same border radius everywhere:** 6px for controls, 999px for badges. If everything is rounded to 999px, nothing stands out as interactive.

3. **No focus states for keyboard users:** Controls must have visible focus outlines (`:focus-visible`), not just hover states.

4. **Passive elements with pointer cursor:** Never use `cursor: pointer` on read-only badges. Use `cursor: default` to signal they're not interactive.

5. **Forgetting state labels:** A toggle button needs to communicate its current state clearly (active checkmark, changed text, color shift). Don't rely solely on UI position.

6. **Putting controls and metrics in the same visual container without spacing:** Use flexbox gaps and distinct backgrounds to separate the sections visually.

7. **Controls that look like badges:** If a button has rounded corners and no hover state, it reads as a passive badge. Always add affordance.

## Implementation Checklist

- [ ] All interactive controls have 4–8px border radius
- [ ] All passive badges/pills have 999px border radius
- [ ] Controls have :hover and :focus-visible states
- [ ] Badges have no hover state (cursor: default)
- [ ] Controls and metrics are grouped in separate layout sections
- [ ] Active/selected states use color change + checkmark or text label
- [ ] Disclosure toggles show state in both text and icon
- [ ] Touch targets for controls are at least 44px × 44px (mobile a11y)

---

**Confidence: Medium** — Pattern confirmed by refactoring the todo app's toolbar, where moving the burndown toggle to the controls section and distinguishing it visually from metric pills resolved UI clarity issues.

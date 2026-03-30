---
name: "CSS Hidden-State Management"
description: "Explicit display: none overrides for elements using [hidden] attribute, preventing display property conflicts from breaking hide/show behavior."
domain: "css"
confidence: "medium"
source: "earned"
---

## Context

The HTML `[hidden]` attribute is a content attribute with a default user-agent style that sets `display: none`. However, CSS `display` properties (especially `display: flex`, `display: grid`, `display: block`) can override the browser's default `[hidden]` behavior if they appear later in the cascade or with higher specificity, causing supposedly-hidden elements to remain visible.

This creates a subtle but critical bug: an element with `[hidden]` stays visible because CSS display rules override the browser's default. The fix is to add an explicit `[hidden] { display: none !important; }` rule in your stylesheet whenever you use display-heavy components with the `[hidden]` attribute.

## Patterns

### 1. Always Override with Explicit [hidden] Rules
Add a global CSS rule that ensures `[hidden]` always hides, even if element styles set display to flex, grid, or block:

```css
/* Place this near the top of your stylesheet */
[hidden] {
  display: none !important;
}
```

### 2. Component-Specific Overrides
If a component class forces a display mode, add a corresponding override for that component when it uses `[hidden]`:

```css
/* Component that uses display: flex */
.status-metric-line {
  display: flex;
  gap: 0.5rem;
}

/* Ensure [hidden] still works on this component */
.status-metric-line[hidden] {
  display: none !important;
}
```

### 3. Testing Hide/Show Behavior
Write tests that verify `[hidden]` elements are actually hidden, especially after stylesheet refactors or component-class consolidation:

```javascript
// src/styles.test.js example
describe('CSS hidden attribute overrides', () => {
  test('[hidden] elements are not visible', () => {
    const el = document.createElement('div');
    el.className = 'status-metric-line';
    el.setAttribute('hidden', '');
    document.body.appendChild(el);

    const computed = window.getComputedStyle(el);
    expect(computed.display).toBe('none');

    document.body.removeChild(el);
  });
});
```

## Examples

### Real Bug: Burndown Badge Duplication

**Scenario:** The burndown panel had a summary badge (collapsed state) and a headline (expanded state). Both were rendered in the DOM, with `[hidden]` controlling which one showed.

**The regression:**
```css
/* Shared component class after refactor */
.status-metric-line {
  display: flex;
  gap: 0.5rem;
}

/* ❌ Missing [hidden] override */
```

When the shared `.status-metric-line` was applied to both the summary and headline, the collapsed summary badge stayed visible (even when `[hidden]`) because `.status-metric-line { display: flex; }` overrode the browser's default `[hidden]` behavior. This caused duplicate badges to show when the burndown panel expanded.

**The fix:**
```css
.status-metric-line {
  display: flex;
  gap: 0.5rem;
}

/* ✅ Explicit override ensures [hidden] works */
.status-metric-line[hidden] {
  display: none !important;
}
```

### Related Regression: Unblock Notification

**Scenario:** A dismissal notification alert used `.notification-alert { display: flex; }` and relied on `[hidden]` to hide.

**The fix:**
```css
.notification-alert {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-alert[hidden] {
  display: none !important;
}
```

## Anti-Patterns

1. **Forgetting the override after adding display properties:** When you refactor CSS and consolidate component classes, the `[hidden]` override can get lost in the shuffle. Always check for it during refactors.

2. **Using bare `display: none` without `!important`:** If other CSS rules have higher specificity, a bare `display: none` won't win. The `!important` flag ensures `[hidden]` always hides.

3. **Trying to toggle visibility with JavaScript instead of `[hidden]`:** Don't use `.hidden` classes or CSS custom properties when `[hidden]` is available—it's a standard attribute and cleaner semantically.

4. **Assuming a component will never use `[hidden]`:** Even if a component doesn't currently use the attribute, library code or future refactors might. It's safer to add the override proactively.

5. **Splitting `[hidden]` rules across multiple places:** Keep all `[hidden]` rules in one central place (top of stylesheet or a dedicated utilities section) so future developers don't miss them during edits.

## Testing Checklist

- [ ] Global `[hidden]` rule exists with `!important`
- [ ] Component-specific `[hidden]` rules added for any component using `display: flex|grid|block`
- [ ] Style regression tests verify computed `display: none` for hidden elements
- [ ] Visual testing confirms elements actually disappear when `[hidden]` is set

---

**Confidence: Medium** — Pattern confirmed by fixing two real bugs (burndown badge duplication and unblock notification) caused by missing `[hidden]` overrides after CSS refactors.

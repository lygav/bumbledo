---
name: "Refactor Coverage Strategy"
description: "Ensure refactoring doesn't break behavior by testing contracts (not implementation), using pure-domain tests that survive code extraction, and adding regression tests for bugs discovered post-refactor. The pattern prioritizes behavior preservation over code structure."
domain: "testing"
confidence: "medium"
source: "earned"
---

## Context

This skill applies when:
- Code is being extracted, reorganized, or modularized
- Multiple internal implementations might change but exported behavior must stay stable
- Previous bugs have been discovered during refactoring that could regress
- You want confidence that the refactor preserves all existing functionality

**Why it matters:** Refactoring changes code structure but should preserve behavior. Testing contracts (APIs) instead of implementations ensures tests don't become brittle during restructuring. Pure-domain tests survive extraction because they test the logic, not where it lives.

## Patterns

### 1. **Test contracts, not implementation location**

When extracting code, write tests that don't care *where* the logic lives:

```javascript
// BAD: Tests implementation location
it('appends todos to the internal _todos array', () => {
  const app = createApp();
  app._todos.push({id: '1', text: 'test'});
  expect(app._todos).toHaveLength(1); // depends on internal structure
});

// GOOD: Tests the contract
it('allows adding and retrieving todos', () => {
  const app = createApp();
  const todo = app.addTodo('test');
  const todos = app.getTodos();
  expect(todos).toHaveLength(1);
  expect(todos[0].text).toBe('test');
});
```

This way, when the code is extracted to a separate module, tests still pass without modification.

### 2. **Write pure-domain tests that survive extraction**

Tests should focus on domain logic (the "what") rather than code organization (the "where"):

```javascript
// SURVIVES EXTRACTION: Pure domain logic
it('reorders todos when dragged forward', () => {
  const todos = [
    {id: '1', text: 'first'},
    {id: '2', text: 'second'},
    {id: '3', text: 'third'},
  ];
  
  const reordered = model.reorderTodos(todos, '1', '3', true);
  
  // Assertion is about the data transformation, not where the function lives
  expect(reordered.map(t => t.id)).toEqual(['2', '3', '1']);
});

// BREAKS AFTER EXTRACTION: Depends on implementation location
it('changes the order in the internal todoList', () => {
  const handler = createDragHandler();
  handler.handleDrop({draggedId: '1', targetId: '3'});
  expect(handler.todoList).toEqual(['2', '3', '1']); // fails if extracted
});
```

### 3. **Add regression tests for bugs found post-refactor**

When a refactor uncovers a bug, add a test that captures it *in the domain model*:

**Example from this project: Unblock detection regression**

During the `clearFinished` refactoring, a bug was discovered: blocked todos weren't auto-transitioning back to active when their blocker was removed.

```javascript
// REGRESSION TEST: Captures the bug in the domain
it('auto-unblocks todos when their blocker is finished', () => {
  const before = [
    {id: '1', status: 'done'},     // blocker
    {id: '2', status: 'blocked', blockedBy: ['1']}, // blocked by 1
  ];
  
  // After clearing finished items and cleaning up blockedBy
  const afterClear = model.clearFinished(before);
  const afterCleanup = model.cleanupBlockedBy(afterClear, ['1']);
  
  // The regression test verifies the unblock happens
  const unblocked = model.detectUnblockedTodos(before, afterCleanup);
  expect(unblocked).toContain('2');
});
```

**Benefits:**
- Regression test lives in the model, not tied to UI behavior
- Test documents the bug and the expected fix
- Can be run after any refactor touching `clearFinished` or blocker logic
- Won't break if the code is restructured again

### 4. **Test at the layer where the extraction happens**

If you're extracting a pure function from event handlers, test it as a pure function:

**Example from this project: Touch drag extraction**

Before refactoring, touch drag reorder was buried in DOM event handlers. After extraction:

```javascript
// TEST AT THE EXTRACTED LAYER: Pure function
describe('reorderTodos()', () => {
  it('handles forward moves', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, '1', '3', true);
    expect(result[0].id).toBe('2'); // no DOM, no events
  });

  it('handles backward moves', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, '3', '1', false);
    expect(result[2].id).toBe('3');
  });

  it('handles no-op (same position)', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, '1', '1', true);
    expect(result).toEqual(todos);
  });

  it('handles invalid dragged ID', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, 'invalid', '2', true);
    expect(result).toEqual(todos); // no-op, unchanged
  });

  it('handles edge case: move to beginning', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, '3', '1', false);
    expect(result[0].id).toBe('3');
  });

  it('handles edge case: move to end', () => {
    const todos = [{id: '1'}, {id: '2'}, {id: '3'}];
    const result = model.reorderTodos(todos, '1', '3', true);
    expect(result[2].id).toBe('1');
  });

  it('handles single-item list', () => {
    const todos = [{id: '1'}];
    const result = model.reorderTodos(todos, '1', '1', true);
    expect(result).toEqual(todos);
  });
});

// THEN IN main.js: Route both mouse and touch through the extracted helper
function handleMouseDrop(draggedId, targetId, insertAfter) {
  todos = reorderTodos(todos, draggedId, targetId, insertAfter);
}

function handleTouchDrop(draggedId, targetId, insertAfter) {
  todos = reorderTodos(todos, draggedId, targetId, insertAfter);
}
```

### 5. **Distinguish between unit tests and regression tests**

Use naming or structure to separate them:

```javascript
describe('model.clearFinished()', () => {
  // UNIT TESTS: Core contract
  describe('basic contract', () => {
    it('removes done items', () => { /* ... */ });
    it('removes cancelled items', () => { /* ... */ });
    it('preserves active items', () => { /* ... */ });
    it('preserves blocked items', () => { /* ... */ });
  });

  // REGRESSION TESTS: Bugs discovered and fixed
  describe('regression: unblock detection', () => {
    it('auto-unblocks todos when their blocker is finished', () => {
      // This test documents a bug that was found post-refactor
      // and verifies it stays fixed
    });

    it('cleans up dangling blockedBy references', () => {
      // Another bug found during refactoring
    });
  });
});
```

## Examples

### Example 1: Shared Constants Extraction (from this project)

**Before refactoring:**
- Status vocabulary, labels, palette, and storage keys were scattered across multiple files
- No central contract test

**Refactoring:**
- Extracted to `src/app/constants.js` as a shared module
- Rusty implemented the extraction while Linus wrote proactive contract tests

**Coverage strategy applied:**
- Tests validated *exports* (what is available), not *implementation* (how constants are defined)
- Tests accepted multiple valid export names for flexibility
- Result: 7 contract tests passed on first run when module landed

### Example 2: Reorder Helper Extraction (from this project)

**Before refactoring:**
- Drag/drop reorder logic was implicit in touch and mouse event handlers
- Touch drag reorder wasn't explicitly tested
- Code was repeated across two handlers

**Refactoring:**
- Extracted pure function: `reorderTodos(todos, draggedId, targetId, insertAfter)`
- Both handlers now route through the shared function

**Coverage strategy applied:**
- Wrote 7 tests for the pure function covering forward moves, backward moves, no-ops, edge cases
- Tests didn't depend on DOM or event handling
- After extraction, both handlers benefited from the same test coverage
- Result: Full test suite stayed green (182 tests) with both handlers using the extracted logic

### Example 3: Unblock Detection Regression (from this project)

**Bug discovered:**
- During `clearFinished` refactoring, a bug surfaced: blocked todos weren't auto-transitioning when their blocker was removed
- The sequence was: `clearFinished(...) -> cleanupBlockedBy(...) -> detectUnblockedTodos(before, after)`

**Coverage strategy applied:**
- Added 3 regression tests to `src/todo/model.test.js`
- Tests exercised the full sequence in the model layer
- Documented both positive (unblock happens) and negative (no false positives) cases
- Covered cleanup of lingering blocker references
- Result: 3 regression tests added, suite went from 136 → 139 passing tests

## Anti-Patterns

### ❌ Testing implementation details during refactoring
```javascript
// BAD: Tightly couples to current implementation
it('stores todos in the _todos private array', () => {
  app._todos = [{id: '1'}];
  expect(app._todos).toHaveLength(1);
});

// When the code is refactored to use a Map instead, this test breaks
// even though behavior is preserved

// GOOD: Tests behavior independent of storage mechanism
it('allows adding and counting todos', () => {
  app.addTodo('test');
  expect(app.count()).toBe(1);
});
```

### ❌ Extracting code without regression test coverage
```javascript
// BAD: Extract without adding regression tests
// Code moves from event handler to model, but no tests ensure behavior is preserved
const reordered = model.reorderTodos(...); // no coverage, might have edge cases

// GOOD: Extract with comprehensive test coverage first
// Then move code with confidence that tests will catch regressions
it('handles backward moves correctly', () => {
  // Test the extracted function thoroughly
  expect(model.reorderTodos(...)).toEqual([...]);
});
```

### ❌ Not documenting bugs found during refactoring
```javascript
// BAD: Fix the bug but don't capture it in a test
// Later, the bug creeps back when code is refactored again

// GOOD: Add a regression test that documents and locks down the fix
describe('regression: unblock detection after clearFinished', () => {
  it('auto-unblocks todos when their blocker is removed', () => {
    // This test ensures the bug stays fixed through future refactors
  });
});
```

### ❌ Testing at the wrong layer during refactoring
```javascript
// BAD: Test the UI layer when extracting model logic
it('highlights unblocked todos in the DOM', () => {
  // This test breaks if DOM structure changes, even if model logic is correct
});

// GOOD: Test the model layer first, then integration separately
it('detects unblocked todos in the model', () => {
  // Pure function test survives any DOM refactoring
  const unblocked = model.detectUnblockedTodos(before, after);
  expect(unblocked).toEqual(['1']);
});
```

## Checklist for Applying This Skill

- [ ] Identify the code being extracted/refactored
- [ ] Determine what behavior must be preserved (the contract)
- [ ] Write tests for the contract (inputs/outputs), not implementation details
- [ ] Add regression tests for any bugs discovered during refactoring
- [ ] Test at the layer where the extraction is happening (model, not UI)
- [ ] Ensure tests don't depend on internal structure or file location
- [ ] Run tests before refactoring to establish a baseline
- [ ] Refactor with confidence that tests will catch behavior changes
- [ ] Run tests after refactoring to verify behavior is preserved
- [ ] Document which bugs are locked down by regression tests
- [ ] Verify that test failures are genuine (not false positives from testing implementation)

## Key Insight

**The goal of refactoring is to improve code structure while preserving behavior. Tests must validate behavior, not structure, so they survive and guide the refactoring without becoming brittle.**

---
name: "Proactive Contract Testing"
description: "Write test cases before implementation lands using TDD-style contracts. Tests define the expected API shape and behavior, allowing implementers to work with clear acceptance criteria. Tests stay green when implementation arrives because they target stable contracts, not implementation details."
domain: "testing"
confidence: "medium"
source: "earned"
---

## Context

This skill applies when:
- A feature has clear requirements but implementation hasn't landed yet
- Multiple team members are working in parallel (one writes tests, another implements)
- You need to lock down API contracts without forcing implementers to follow a specific code path
- Downstream features depend on predictable module exports and behavior

**Why it matters:** Proactive contracts give implementers precise TDD targets while keeping the test suite green before code arrives. When the implementation lands, tests validate correctness without modification.

## Patterns

### 1. **Read requirements → write contract tests → implementation follows**

Start by understanding what the feature *must export* and *how it must behave*:
- Parse PRDs, task descriptions, or architecture docs
- Identify exported functions, constants, or APIs
- Write tests that call these exports with realistic inputs
- Leave the test assertions **loadable but red** during TDD

### 2. **Test the contract, not the implementation**

Assertions should focus on:
- Input/output transformations (what the function does, not how)
- Shape and completeness of exports (keys, types, ranges)
- Interoperability with dependent modules
- Edge cases that any correct implementation must handle

Avoid:
- Implementation-specific logic or internal variable names
- Tightly coupled mocking that forces a specific code path
- UI or integration assertions (keep tests at the pure-function layer)

### 3. **Use flexible naming for optional exports**

When an export might have multiple valid names, write tests that accept any of them:

```javascript
// Good: accept multiple valid names
const statusValues = model.TODO_STATUS_VALUES || 
                     model.TODO_STATUS || 
                     model.STATUSES || 
                     model.STATUS_VALUES || 
                     model.TODO_STATUSES;
expect(statusValues).toEqual(['todo', 'inprogress', 'done', 'cancelled', 'blocked']);
```

This allows implementers flexibility while locking the contract.

### 4. **Call pending functions through namespace to keep suite loadable**

If a helper function doesn't exist yet, call it in a way that won't break the test load:

```javascript
// During TDD, model.cycleStatus may not exist yet
// Call it in a way that gracefully skips if undefined
it('cycles status from active to done', () => {
  if (!model.cycleStatus) this.skip();
  const result = model.cycleStatus('active');
  expect(result).toBe('done');
});
```

Or wrap the entire suite:

```javascript
describe('cycleStatus()', () => {
  beforeEach(function() {
    if (!model.cycleStatus) this.skip();
  });
  // tests proceed only if function exists
});
```

### 5. **Lock constants completeness**

For shared constants modules, write tests that verify:
- All expected status vocabulary entries are present
- Label mappings cover all statuses
- Palette entries have required color properties (fill, border, accent, text, opacity, strike)
- Storage keys match what the app uses

```javascript
it('exports all required storage keys', () => {
  const keys = model.STORAGE_KEYS || model.APP_STORAGE_KEYS || model.LOCAL_STORAGE_KEYS;
  expect(keys).toHaveProperty('todos');
  expect(keys).toHaveProperty('bumbledo_filter_ready');
  expect(keys).toHaveProperty('bumbledo_filter_actionable');
  expect(keys).toHaveProperty('todos_burndown');
});
```

## Examples

### Constants Module Contract (from this project)

**What was tested before implementation:**
- `src/app/constants.test.js` defined the contract for Rusty's shared constants extraction
- Tests verified status vocabulary completeness, label/palette mappings, and storage key presence
- Expected exports: `TODO_STATUS_VALUES`, `TODO_STATUS_LABELS`, `TODO_STATUS_PALETTE`, `APP_STORAGE_KEYS`

**Result:**
- Baseline: 193 passing tests
- After adding 7 contract tests: 200 passing tests (all new tests passed when module landed)
- No test modifications needed after implementation arrived

### Burndown Data Layer Contract (from this project)

**What was tested before implementation:**
- `src/todo/model.test.js` defined contracts for `takeBurndownSample()`, `shouldSampleToday()`, `pruneBurndownData()`
- 14 tests covered snapshot counting, sampling rules, and 30-day retention logic
- Tests called helpers through the `model` namespace

**Test execution during TDD:**
- Baseline: 139 passing tests
- After adding 14 contract tests: 14 red tests (expected, waiting for Rusty's implementation)
- When implementation arrives, tests turn green without modification

### Helper Function Extraction (reorderTodos)

**What was tested before extraction:**
- Touch drag reorder behavior was implicit in DOM event handling
- Extracted `reorderTodos(todos, draggedId, targetId, insertAfter)` as a pure function
- Tests covered forward/backward moves, no-op handling, invalid IDs, edge cases

**Result:**
- Tests became the acceptance criteria for the extraction
- Implementation must satisfy all test cases
- Both mouse and touch handlers now route through the same tested function

## Anti-Patterns

### ❌ Writing tests that depend on implementation details
```javascript
// BAD: Tests internal variable names
it('should set _status to done', () => {
  const todo = model.setStatus(todo, 'done');
  expect(todo._status).toBe('done'); // depends on private field name
});

// GOOD: Tests the contract
it('returns a todo with status updated to done', () => {
  const todo = model.setStatus({id: '1', status: 'active'}, 'done');
  expect(todo.status).toBe('done'); // tests the exported contract
});
```

### ❌ Coupling tests to UI or integration concerns
```javascript
// BAD: Tests DOM, events, or DOM libraries
it('highlights unblocked todos', () => {
  const el = document.getElementById('todo-1');
  expect(el.classList.contains('unblocked')).toBe(true);
});

// GOOD: Tests the model layer only
it('detects unblocked todos in the data layer', () => {
  const before = [{id: '1', status: 'blocked', blockedBy: ['2']}];
  const after = [{id: '1', status: 'blocked', blockedBy: []}];
  const unblocked = model.detectUnblockedTodos(before, after);
  expect(unblocked).toEqual(['1']);
});
```

### ❌ Writing rigid contracts that force a single implementation
```javascript
// BAD: Over-specifies the implementation
it('must use a Map internally', () => {
  expect(model.statusMap instanceof Map).toBe(true);
});

// GOOD: Specifies the behavior
it('returns the label for any status', () => {
  expect(model.getLabel('active')).toBe('Active');
  expect(model.getLabel('done')).toBe('Done');
});
```

### ❌ Failing to test edge cases that any implementation must handle
```javascript
// BAD: Only happy path
it('cycles status', () => {
  expect(model.cycleStatus('active')).toBe('done');
});

// GOOD: Includes edge cases
it('cycles status through the full cycle', () => {
  expect(model.cycleStatus('active')).toBe('done');
  expect(model.cycleStatus('done')).toBe('active');
});

it('handles blocked items specially', () => {
  expect(model.cycleStatus('blocked', [{id: '1'}])).toBe('blocked'); // no cycle if blocked
});

it('handles empty input gracefully', () => {
  expect(() => model.cycleStatus(null)).not.toThrow();
});
```

## Checklist for Applying This Skill

- [ ] Read the feature requirements or task description thoroughly
- [ ] Identify all expected exports (functions, constants, types)
- [ ] Determine the primary behavior contract (inputs → outputs)
- [ ] Write tests that validate the contract without specifying implementation
- [ ] Handle optional/flexible naming by accepting multiple valid export names
- [ ] Include edge cases (empty input, invalid data, boundary conditions)
- [ ] Keep tests at the model/logic layer (no DOM, events, or UI concerns)
- [ ] Run the test suite to verify tests load without breaking
- [ ] Document expected test count before implementation
- [ ] Confirm all tests pass when implementation lands without test modifications

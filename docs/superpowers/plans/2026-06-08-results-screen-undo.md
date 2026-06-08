# Results Screen Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Undo button to the dart game results screen so an accidental winning throw can be reverted before saving to ELO.

**Architecture:** Reuse the existing `undoLastDart` action in `useLiveGame`. `GameBoard` owns the live-game context and passes undo props into `GameResults`; `GameResults` only renders the UI entry point and calls the provided handler.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, jsdom, Tailwind CSS, shadcn/ui Button, lucide-react icons.

---

## File Structure

- Modify: `src/components/live-game/GameBoard.tsx`
  - Compute the existing undo availability check once.
  - Pass `undoLastDart` and `canUndo` into `GameResults`.
  - Reuse the same `canUndo` value for `DartInput`.
- Modify: `src/components/live-game/GameResults.tsx`
  - Accept `onUndo` and `canUndo` props.
  - Import `Undo2` from `lucide-react`.
  - Render a full-width `Undo Last Throw` button before New Game/Dashboard actions when the match has not been saved to ELO and undo is available.
- Create: `src/components/live-game/GameResults.test.tsx`
  - Verify the Undo button appears before saving, calls `onUndo`, and hides when undo is unavailable.
- Modify: `package.json` and `package-lock.json`
  - Add Vitest, React Testing Library, and jsdom dependencies.
  - Add the `test` script.
- Modify: `vite.config.ts`
  - Configure Vitest to run in jsdom.

This plan was revised after the user chose to add a real test runner instead of using a TypeScript build failure as the only RED check.

## Task 1: Add Test Runner And RED Test

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/components/live-game/GameResults.test.tsx`

- [ ] **Step 1: Run the current build as a baseline**

Run: `npm run build`

Expected: PASS before changing behavior. If it fails, capture the existing failure before editing.

- [ ] **Step 2: Install test dependencies**

Run: `npm install --save-dev "vitest@^2.1.9" "@testing-library/react@^16.1.0" "@testing-library/dom@^10.4.0" "jsdom@^25.0.1"`

Expected: `package.json` and `package-lock.json` include the test dependencies.

- [ ] **Step 3: Configure Vitest**

Add the `test` script to `package.json`:

```json
"test": "vitest run"
```

Update `vite.config.ts` to import `defineConfig` from `vitest/config` and add:

```ts
test: {
  environment: "jsdom",
},
```

- [ ] **Step 4: Write the failing component test**

Create `src/components/live-game/GameResults.test.tsx` with tests that render `GameResults` inside `QueryClientProvider` and `MemoryRouter`, click `Undo Last Throw`, and assert `onUndo` is called. Include a second test that renders with `canUndo={false}` and asserts the button is absent.

- [ ] **Step 5: Verify RED**

Run: `npm test -- "src/components/live-game/GameResults.test.tsx"`

Expected: FAIL because the results screen does not yet render an `Undo Last Throw` button.

## Task 2: Wire Results-Screen Undo UI

**Files:**
- Modify: `src/components/live-game/GameResults.tsx`
- Modify: `src/components/live-game/GameBoard.tsx`

- [ ] **Step 1: Add undo props and button to `GameResults`**

Add `onUndo` and `canUndo` to `GameResultsProps`, import `Undo2`, and render this button before the New Game/Dashboard grid:

```tsx
{!isSaved && canUndo && (
  <Button variant="outline" onClick={onUndo} className="w-full" size="lg">
    <Undo2 className="h-4 w-4 mr-2" />
    Undo Last Throw
  </Button>
)}
```

- [ ] **Step 2: Wire props from `GameBoard`**

Compute `canUndo` after the `gameState` null guard, pass `onUndo={undoLastDart}` and `canUndo={canUndo}` to `GameResults`, and reuse the same `canUndo` value for `DartInput`.

- [ ] **Step 3: Verify GREEN**

Run: `npm test -- "src/components/live-game/GameResults.test.tsx"`

Expected: PASS with both tests green.

- [ ] **Step 4: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npx eslint "src/components/live-game/GameResults.tsx" "src/components/live-game/GameBoard.tsx" "src/components/live-game/GameResults.test.tsx" "vite.config.ts"`

Expected: PASS.

Run: `npm run lint`

Expected: May FAIL with unrelated pre-existing lint debt outside the changed files; record the result.

- [ ] **Step 5: Review the diff**

Run: `git diff --stat` and inspect changed source files.

Expected: Diff shows Vitest setup, the focused test, the results-screen Undo button, prop wiring, and planning docs.

Do not commit unless the user explicitly requests it.

## Self-Review

- Spec coverage: The plan adds the results-screen Undo button, reuses `undoLastDart`, returns to the active board through existing state changes, hides undo after ELO save, and adds a focused Vitest test for the behavior.
- Placeholder scan: No placeholder markers or unspecified implementation steps remain.
- Type consistency: `onUndo` and `canUndo` are defined in `GameResultsProps`, consumed by `GameResults`, and passed by `GameBoard`.

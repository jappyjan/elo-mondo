# Results Screen Undo Design

## Goal

Add a way to undo an accidental winning throw from the game complete screen.

## Scope

- Show an Undo button on the results screen before the match is saved to ELO.
- Reuse the existing `undoLastDart` logic in `useLiveGame`.
- Return the user to the active game board after undoing the winning throw.
- Do not allow undo after the match has been saved to ELO, because saved rankings would no longer match the corrected live game.

## Approach

`GameBoard` already switches to `GameResults` when `gameState.isGameOver` is true. It also already has access to `undoLastDart`. Pass that handler and a `canUndo` flag into `GameResults`.

`GameResults` renders an Undo button in the action area while `isSaved` is false and undo is available. Clicking it calls the provided handler. The hook updates state so `isGameOver` becomes false, which naturally causes `GameBoard` to render the active board again.

## Error Handling

Keep the current `undoLastDart` error behavior. The existing hook logs database failures and updates local state optimistically. No separate results-screen error handling is needed for this minimal UI entry point.

## Testing

- Add Vitest with React Testing Library and jsdom because the repo did not have a unit test runner.
- Cover the results-screen Undo button with a focused component test.
- Build the app with the existing production build script.
- Run lint on the changed source files. Full-project lint may still report unrelated pre-existing issues.

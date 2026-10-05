---
name: spire-repo-routing
description: 'Use when changing or exploring this Slay the Spire enemy tracker, especially when deciding which files to inspect, where behavior belongs, or how to verify a change.'
user-invocable: false
---

# Repository Routing

Keep repository work local and testable. Do not reread the project overview or map unrelated files unless the task crosses those boundaries.

## Ownership Map

- `src/config/gameConfig.js`: shared limits and status constants.
- `src/data/enemies.js`: static enemy definitions and attack data.
- `src/models/Enemy.js`, `src/models/GameState.js`: entity and encounter state.
- `src/services/`: enemy selection/spawning, poison budget, and turn transitions.
- `src/controllers/AppController.js`: delegated UI actions and state-to-view coordination.
- `src/views/`: startup and game HTML rendering.
- `styles/`: base, layout, and component styling.
- `assets/images/`: enemy and defeated-state artwork.
- `tests/game-rules.test.js`: current behavior-focused tests.

## Workflow

1. Identify the behavior's owner from the map; inspect that file and one nearby caller or test only.
2. State a local behavior hypothesis and the smallest check that could disprove it before editing.
3. Keep state transitions in models/services, event routing in the controller, and markup in views.
4. Add or adjust a focused test when behavior changes; run `npm test` (`node --test`) after edits.
5. For visual changes, inspect the relevant view and stylesheet together; avoid loading unrelated game logic.

The app uses vanilla JavaScript ES modules and has no build or lint script declared in `package.json`.
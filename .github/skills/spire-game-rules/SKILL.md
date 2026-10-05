---
name: spire-game-rules
description: 'Use when changing enemy behavior, health, block, status effects, poison limits, turn handling, spawning, resurrection, attack cycles, or game-rule tests in this repository.'
user-invocable: false
---

# Game Rules

Start at the rule owner and its matching test in `tests/game-rules.test.js`; avoid reading views or styles unless the requested behavior changes what is displayed.

## Rule Ownership

- `src/models/Enemy.js`: health, block, status stacks, resurrection, and attack-cycle state.
- `src/models/GameState.js`: rows, active selection, turn/zoom state, enemy lookup, and aggregate poison.
- `src/services/PoisonBudgetService.js`: shared poison budget changes.
- `src/services/TurnService.js`: end-turn decay, poison damage, block reset, attack advancement, and turn count.
- `src/services/EnemyPoolService.js` and `src/data/enemies.js`: pool selection, front-of-row spawning, and static enemy definitions.
- `src/config/gameConfig.js`: shared rule constants.

## Change Loop

1. Read only the owner, relevant service if involved, and the closest existing test.
2. Preserve existing invariants: poison is budgeted across rows; poison damage bypasses block; ordinary damage consumes block first; resurrection restores the same enemy object; loop attacks advance on turn end.
3. Add a focused assertion beside the closest existing test for the changed edge case.
4. Run `npm test`. Do not add dependencies or a test framework for these Node built-in tests.

Treat the implementation and tests as the current contract; consult `Description.txt` only when clarifying intended product behavior.
---
name: spire-interface-assets
description: 'Use when changing the startup or battle UI, action handling, responsive styling, fullscreen behavior, enemy artwork, or attack/status presentation in this repository.'
user-invocable: false
---

# Interface and Assets

Keep UI changes within the existing vanilla-JS rendering flow. Read only the relevant view, its controller action, and the stylesheet or asset path being changed.

## Ownership Map

- `src/views/StartupView.js` and `src/views/GameView.js`: HTML-string templates and display formatting.
- `src/controllers/AppController.js`: delegated `data-action` handling and rerender flow.
- `src/utils/escapeHtml.js`: escape dynamic strings interpolated into markup.
- `styles/base.css`, `styles/layout.css`, `styles/components.css`: global foundations, page arrangement, and controls/components.
- `assets/images/` and `src/data/enemies.js`: artwork files and their enemy-definition references.

## Change Loop

1. Trace one UI action from its `data-action` in a view to the controller case and resulting render.
2. Keep user-provided or data-driven markup values escaped; preserve existing accessible labels and button semantics.
3. Keep styling in the stylesheet that owns the affected surface; avoid introducing a framework or build step.
4. For UI changes, start the existing local static server if available and inspect the affected viewport/interaction. For game behavior, run `npm test`.
5. When changing artwork paths, verify that the referenced file exists and that dead enemies still use the defeated artwork.
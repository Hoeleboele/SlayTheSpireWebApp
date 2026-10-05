import test from "node:test";
import assert from "node:assert/strict";
import { ENEMY_POOL } from "../src/data/enemies.js";
import { Enemy } from "../src/models/Enemy.js";
import { GameState } from "../src/models/GameState.js";
import { GameView } from "../src/views/GameView.js";
import { AppController } from "../src/controllers/AppController.js";
import { EnemyPoolService } from "../src/services/EnemyPoolService.js";
import { TurnService } from "../src/services/TurnService.js";
import { PoisonBudgetService } from "../src/services/PoisonBudgetService.js";

function createController(rowCount) {
  const controller = Object.create(AppController.prototype);
  controller.root = { innerHTML: "", querySelector: () => ({ value: String(rowCount) }) };
  controller.gameState = new GameState(rowCount);
  controller.gameView = new GameView();
  controller.startupView = { render(root) { root.innerHTML = "startup"; } };
  controller.enemyPool = new EnemyPoolService(ENEMY_POOL, () => 0);
  controller.turns = new TurnService();
  controller.poison = new PoisonBudgetService();
  controller.renderGame();
  return controller;
}

function click(controller, action, dataset = {}) {
  controller.handleClick({ target: { closest: () => ({ dataset: { action, ...dataset } }) } });
}

function buttonMarkup(controller, action) {
  const markup = controller.root.innerHTML.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`));
  assert.ok(markup, `Expected a ${action} button`);
  return markup[0];
}

test("populated rows render fixed, loop and dice attacks in both views", () => {
  const state = new GameState(1);
  state.rows[0].enemies = ENEMY_POOL.map((definition) => new Enemy(definition));
  const root = { innerHTML: "" };
  const view = new GameView();
  for (const zoomedOut of [false, true]) {
    state.zoomedOut = zoomedOut;
    view.render(root, state);
    assert.doesNotMatch(root.innerHTML, /undefined/);
    for (const definition of ENEMY_POOL) {
      assert.ok(root.innerHTML.includes(definition.name));
      assert.ok(root.innerHTML.includes(definition.kind));
      const behaviour = definition.attackBehaviour;
      if (behaviour.type === "fixed") {
        assert.ok(root.innerHTML.includes(behaviour.text));
      } else if (behaviour.type === "loop") {
        assert.ok(root.innerHTML.includes(`CYCLE 1/${behaviour.attacks.length}`));
        assert.match(root.innerHTML, /class="is-current"/);
        for (const attack of behaviour.attacks) assert.ok(root.innerHTML.includes(attack));
      } else {
        assert.ok(root.innerHTML.includes("D6"));
        for (const face of behaviour.faces) {
          assert.ok(root.innerHTML.includes(face.range));
          assert.ok(root.innerHTML.includes(face.text));
        }
      }
    }
  }
});

test("loading controls populate once and unlock front-of-row spawning", () => {
  for (const rowCount of [1, 4]) {
    const controller = createController(rowCount);
    const state = controller.gameState;
    assert.doesNotMatch(buttonMarkup(controller, "get-enemies"), /disabled/);
    assert.match(buttonMarkup(controller, "spawn"), /disabled/);
    click(controller, "spawn", { row: "0" });
    assert.equal(state.rows[0].enemies.length, 0);
    click(controller, "get-enemies");
    assert.ok(state.rows.every((row) => row.enemies.length > 0));
    assert.match(controller.root.innerHTML, /enemy-card/);
    assert.match(buttonMarkup(controller, "get-enemies"), /disabled/);
    assert.doesNotMatch(buttonMarkup(controller, "spawn"), /disabled/);
    const original = state.rows[0].enemies[0];
    original.takeDamage(5);
    original.addStatus("weak");
    click(controller, "get-enemies");
    assert.equal(state.rows[0].enemies[0], original);
    assert.equal(original.health, original.maxHealth - 5);
    assert.equal(original.statuses.weak, 1);
    click(controller, "spawn", { row: "0" });
    assert.notEqual(state.rows[0].enemies[0], original);
    assert.equal(state.rows[0].enemies[1], original);
    click(controller, "end-turn");
    assert.equal(state.turn, 2);
    assert.equal(original.statuses.weak, 0);
  }
});

test("navigation and overview remain usable before and after enemy population", () => {
  const controller = createController(4);
  for (const loaded of [false, true]) {
    if (loaded) click(controller, "get-enemies");
    click(controller, "navigate", { direction: "1" });
    assert.equal(controller.gameState.activeRow, 1);
    assert.match(controller.root.innerHTML, /data-row-index="1"/);
    assert.doesNotMatch(buttonMarkup(controller, "navigate"), /disabled/);
    click(controller, "navigate", { direction: "-1" });
    assert.equal(controller.gameState.activeRow, 0);
    assert.match(buttonMarkup(controller, "navigate"), /disabled/);
    click(controller, "toggle-overview");
    assert.equal(controller.gameState.zoomedOut, true);
    assert.equal((controller.root.innerHTML.match(/class="battle-row /g) || []).length, 4);
    if (loaded) {
      for (const row of controller.gameState.rows) {
        for (const enemy of row.enemies) assert.ok(controller.root.innerHTML.includes(enemy.id));
      }
    }
    click(controller, "select-row", { row: "3" });
    assert.equal(controller.gameState.zoomedOut, false);
    assert.equal(controller.gameState.activeRow, 3);
    assert.match(controller.root.innerHTML, /data-row-index="3"/);
    click(controller, "navigate", { direction: "1" });
    assert.equal(controller.gameState.activeRow, 3);
    click(controller, "navigate", { direction: "-3" });
    assert.equal(controller.gameState.activeRow, 0);
  }
});

test("leaving and starting a new game restores initial loading controls", () => {
  const controller = createController(4);
  click(controller, "get-enemies");
  const previous = controller.gameState;
  click(controller, "leave");
  assert.equal(controller.gameState, null);
  assert.equal(controller.root.innerHTML, "startup");
  let prevented = false;
  controller.handleSubmit({ target: { id: "start-form" }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.notEqual(controller.gameState, previous);
  assert.equal(controller.gameState.enemiesLoaded, false);
  assert.ok(controller.gameState.rows.every((row) => row.enemies.length === 0));
  assert.doesNotMatch(buttonMarkup(controller, "get-enemies"), /disabled/);
  assert.match(buttonMarkup(controller, "spawn"), /disabled/);
});
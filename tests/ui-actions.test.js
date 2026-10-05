import test from "node:test";
import assert from "node:assert/strict";
import { ENEMY_POOL } from "../src/data/enemies.js";

const groups = ENEMY_POOL.map((enemy) => [enemy.id, ...(enemy.companions ?? [])]);
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

test("rerendering preserves horizontal scrolling independently for each visible row", () => {
  const state = new GameState(2);
  state.zoomedOut = true;
  const previous = [280, 410].map((scrollLeft, index) => ({
    dataset: { rowIndex: String(index) }, querySelector: () => ({ scrollLeft }),
  }));
  const grids = [{ scrollLeft: 0 }, { scrollLeft: 0 }];
  const rendered = grids.map((grid, index) => ({
    dataset: { rowIndex: String(index) }, querySelector: () => grid,
  }));
  let rows = previous;
  const root = {
    set innerHTML(markup) { rows = rendered; },
    querySelectorAll: () => rows,
  };
  new GameView().render(root, state);
  assert.deepEqual(grids.map((grid) => grid.scrollLeft), [280, 410]);
});

test("backdrop clicks close enemy controls but clicks inside the dialog do not", () => {
  const controller = createController(1);
  click(controller, "get-enemies");
  const enemy = controller.gameState.rows[0].enemies[0];
  const dialog = {
    closest: () => null,
    getBoundingClientRect: () => ({ left: 100, right: 400, top: 100, bottom: 500 }),
    showModal() {},
  };
  controller.root.querySelector = () => dialog;
  for (const [clientX, clientY] of [[99, 200], [400, 200], [200, 99], [200, 500]]) {
    click(controller, "select-enemy", { enemyId: enemy.id });
    controller.handleClick({ target: dialog, clientX: 200, clientY: 200 });
    assert.equal(controller.gameState.selectedEnemyId, enemy.id);
    controller.handleClick({ target: { closest: () => null }, clientX, clientY });
    assert.equal(controller.gameState.selectedEnemyId, enemy.id);
    controller.handleClick({ target: dialog, clientX, clientY });
    assert.equal(controller.gameState.selectedEnemyId, null);
    assert.doesNotMatch(controller.root.innerHTML, /control-dialog/);
    assert.equal(enemy.health, enemy.maxHealth);
  }
  click(controller, "select-enemy", { enemyId: enemy.id });
  click(controller, "close-panel");
  assert.equal(controller.gameState.selectedEnemyId, null);
});

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

test("loading controls populate once and only configured cards unlock spawning", () => {
  for (const rowCount of [1, 4]) {
    const controller = createController(rowCount);
    const state = controller.gameState;
    assert.doesNotMatch(buttonMarkup(controller, "get-enemies"), /disabled/);
    assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
    click(controller, "spawn", { row: "0" });
    assert.equal(state.rows[0].enemies.length, 0);
    click(controller, "get-enemies");
    assert.ok(state.rows.every((row) => row.enemies.length > 0));
    assert.match(controller.root.innerHTML, /enemy-card/);
    assert.match(buttonMarkup(controller, "get-enemies"), /disabled/);
    assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
    const original = state.rows[0].enemies[0];
    original.takeDamage(5);
    original.addStatus("weak");
    click(controller, "get-enemies");
    assert.equal(state.rows[0].enemies[0], original);
    assert.equal(original.health, original.maxHealth - 5);
    assert.equal(original.statuses.weak, 1);
    click(controller, "spawn", { enemyId: original.id, row: "0" });
    assert.equal(state.rows[0].enemies[0], original);
    if (rowCount === 4) {
      click(controller, "select-row", { row: "3" });
      const source = state.rows[3].enemies[0];
      const button = buttonMarkup(controller, "spawn");
      assert.ok(button.includes(`data-enemy-id="${source.id}"`));
      assert.doesNotMatch(button, /data-row=|disabled/);
      click(controller, "spawn", { enemyId: source.id, row: "0" });
      assert.equal(state.rows[3].enemies[0].definitionId, "ironhowl");
      assert.equal(state.rows[3].enemies[1], source);
      assert.equal(state.rows[0].enemies[0], original);
      assert.equal(state.selectedEnemyId, null);
    }
    click(controller, "end-turn");
    assert.equal(state.turn, 2);
    assert.equal(original.statuses.weak, 1);
  }
});

test("Clear rows appears only after all enemies are defeated, including spawned enemies", () => {
  const controller = createController(4);
  const state = controller.gameState;
  assert.doesNotMatch(controller.root.innerHTML, /data-action="clear-rows"/);
  click(controller, "clear-rows");
  assert.equal(state.enemiesLoaded, false);
  click(controller, "get-enemies");
  const originalRows = state.rows.map((row) => row.enemies);
  click(controller, "clear-rows");
  state.rows.forEach((row, index) => assert.equal(row.enemies, originalRows[index]));
  const source = state.rows[3].enemies[0];
  const history = [...state.encounterHistory];
  click(controller, "spawn", { enemyId: source.id });
  const spawned = state.rows[3].enemies[0];
  assert.deepEqual([...state.encounterHistory], history);
  for (const enemies of originalRows) {
    for (const enemy of [...enemies]) {
      if (enemy !== spawned) click(controller, "kill", { enemyId: enemy.id });
    }
  }
  assert.doesNotMatch(controller.root.innerHTML, /data-action="clear-rows"/);
  click(controller, "clear-rows");
  assert.equal(state.enemiesLoaded, true);
  click(controller, "kill", { enemyId: spawned.id });
  assert.match(buttonMarkup(controller, "clear-rows"), /secondary-button/);
  assert.match(controller.root.innerHTML, /data-action="get-enemies"[^>]*>Get enemies<\/button>\s*<button[^>]*data-action="clear-rows"[^>]*>Clear rows<\/button>/);
  click(controller, "resurrect", { enemyId: source.id });
  assert.doesNotMatch(controller.root.innerHTML, /data-action="clear-rows"/);
  click(controller, "kill", { enemyId: source.id });
  click(controller, "spawn", { enemyId: source.id });
  assert.equal(state.rows[3].enemies.length, 2);
  assert.ok(buttonMarkup(controller, "clear-rows"));
  click(controller, "clear-rows");
  assert.equal(state.enemiesLoaded, false);
  assert.ok(state.rows.every((row) => row.enemies.length === 0));
});

test("clearing resets turn and view and enables loading new groups across cycles", () => {
  const controller = createController(4);
  const state = controller.gameState;
  for (const indexes of [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]) {
    click(controller, "get-enemies");
    assert.deepEqual(state.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
      indexes.map((index) => groups[index]));
    click(controller, "end-turn");
    click(controller, "select-row", { row: "3" });
    click(controller, "toggle-overview");
    const enemies = state.rows.flatMap((row) => row.enemies);
    enemies[0].addStatus("poison", 2);
    for (const enemy of enemies) click(controller, "kill", { enemyId: enemy.id });
    const history = [...state.encounterHistory];
    state.selectedEnemyId = enemies[0].id;
    click(controller, "clear-rows");
    assert.equal(state.turn, 1);
    assert.equal(state.activeRow, 0);
    assert.equal(state.zoomedOut, false);
    assert.equal(state.selectedEnemyId, null);
    assert.equal(state.poisonTotal, 0);
    assert.deepEqual([...state.encounterHistory], history);
    assert.ok(state.rows.every((row) => row.enemies.length === 0));
    assert.doesNotMatch(controller.root.innerHTML, /enemy-card|control-dialog|data-action="clear-rows"/);
    assert.doesNotMatch(buttonMarkup(controller, "get-enemies"), /disabled/);
    assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
    click(controller, "spawn", { row: "0" });
    assert.equal(state.rows[0].enemies.length, 0);
  }
});

test("poison defeating the last enemy makes Clear rows available", () => {
  const controller = createController(1);
  controller.enemyPool = new EnemyPoolService([ENEMY_POOL[0]], () => 0);
  click(controller, "get-enemies");
  const enemy = controller.gameState.rows[0].enemies[0];
  enemy.takeDamage(enemy.health - 1);
  enemy.addStatus("poison", 1);
  click(controller, "end-turn");
  assert.equal(enemy.isAlive, false);
  assert.ok(buttonMarkup(controller, "clear-rows"));
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
  assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
  assert.equal(controller.gameState.encounterHistory.size, 0);
  assert.doesNotMatch(controller.root.innerHTML, /data-action="clear-rows"/);
  click(controller, "get-enemies");
  assert.deepEqual(controller.gameState.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    groups);
});

test("clicking the weak tag removes one stack only on its enemy in either view", () => {
  for (const zoomedOut of [false, true]) {
    const controller = createController(2);
    click(controller, "get-enemies");
    controller.gameState.zoomedOut = zoomedOut;
    click(controller, "select-row", { row: "1" });
    controller.gameState.zoomedOut = zoomedOut;
    const [enemy, neighbour] = controller.gameState.rows[1].enemies;
    enemy.addStatus("weak", 3);
    enemy.addStatus("vulnerable", 2);
    neighbour.addStatus("weak", 2);
    controller.renderGame();
    const tag = buttonMarkup(controller, "reduce-weak");
    assert.ok(tag.includes(`data-enemy-id="${enemy.id}"`));
    assert.match(tag, /aria-label="Remove one Weak stack from/);
    assert.match(controller.root.innerHTML, /<\/button>\s*<div class="status-list"><button[^>]*data-action="reduce-vulnerable"[\s\S]*?<button[^>]*data-action="reduce-weak"/);
    for (const remaining of [2, 1, 0]) {
      click(controller, "reduce-weak", { enemyId: enemy.id });
      assert.equal(enemy.statuses.weak, remaining);
      const tags = controller.root.innerHTML.match(/<button[^>]*data-action="reduce-weak"[^>]*>/g);
      assert.equal(tags.some((markup) => markup.includes(`data-enemy-id="${enemy.id}"`)), remaining > 0);
      assert.equal(neighbour.statuses.weak, 2);
      assert.equal(controller.gameState.selectedEnemyId, null);
    }
    click(controller, "reduce-weak", { enemyId: enemy.id });
    assert.equal(enemy.statuses.weak, 0);
    assert.equal(enemy.statuses.vulnerable, 2);
    assert.equal(neighbour.statuses.weak, 2);
    assert.equal(controller.gameState.selectedEnemyId, null);
    assert.equal(controller.gameState.zoomedOut, zoomedOut);
    const remainingTags = controller.root.innerHTML.match(/<button[^>]*data-action="reduce-weak"[^>]*>/g);
    assert.equal(remainingTags.length, 1);
    assert.ok(remainingTags[0].includes(`data-enemy-id="${neighbour.id}"`));
    click(controller, "reduce-weak", { enemyId: "missing" });
    assert.equal(neighbour.statuses.weak, 2);
  }
});

test("clicking the vulnerable tag removes one stack only on its enemy in either view", () => {
  for (const zoomedOut of [false, true]) {
    const controller = createController(2);
    click(controller, "get-enemies");
    controller.gameState.zoomedOut = zoomedOut;
    click(controller, "select-row", { row: "1" });
    controller.gameState.zoomedOut = zoomedOut;
    const [enemy, neighbour] = controller.gameState.rows[1].enemies;
    enemy.addStatus("vulnerable", 3);
    enemy.addStatus("weak", 2);
    neighbour.addStatus("vulnerable", 2);
    controller.renderGame();
    const tag = buttonMarkup(controller, "reduce-vulnerable");
    assert.ok(tag.includes(`data-enemy-id="${enemy.id}"`));
    assert.match(tag, /aria-label="Remove one Vulnerable stack from/);
    assert.match(controller.root.innerHTML, /<\/button>\s*<div class="status-list"><button[^>]*data-action="reduce-vulnerable"/);
    for (const remaining of [2, 1, 0]) {
      click(controller, "reduce-vulnerable", { enemyId: enemy.id });
      assert.equal(enemy.statuses.vulnerable, remaining);
      const tags = controller.root.innerHTML.match(/<button[^>]*data-action="reduce-vulnerable"[^>]*>/g);
      assert.equal(tags.some((markup) => markup.includes(`data-enemy-id="${enemy.id}"`)), remaining > 0);
      assert.equal(enemy.statuses.weak, 2);
      assert.equal(neighbour.statuses.vulnerable, 2);
      assert.equal(enemy.health, enemy.maxHealth);
      assert.equal(controller.gameState.selectedEnemyId, null);
      assert.equal(controller.gameState.zoomedOut, zoomedOut);
    }
    click(controller, "reduce-vulnerable", { enemyId: enemy.id });
    assert.equal(enemy.statuses.vulnerable, 0);
    click(controller, "reduce-vulnerable", { enemyId: "missing" });
    assert.equal(neighbour.statuses.vulnerable, 2);
  }
});

test("card damage controls target their enemy without selecting it in either view", () => {
  for (const zoomedOut of [false, true]) {
    const controller = createController(2);
    click(controller, "get-enemies");
    controller.gameState.zoomedOut = zoomedOut;
    controller.renderGame();
    click(controller, "select-row", { row: "1" });
    controller.gameState.zoomedOut = zoomedOut;
    controller.renderGame();
    const [enemy, neighbour] = controller.gameState.rows[1].enemies;
    enemy.adjustBlock(3);
    const controls = controller.root.innerHTML.match(/<button class="card-damage-button"[^>]*>/g);
    assert.ok(controls.length >= 4);
    assert.ok(controls.some((markup) => markup.includes(`data-enemy-id="${enemy.id}"`) && markup.includes('data-amount="1"')));
    assert.ok(controls.some((markup) => markup.includes(`data-enemy-id="${enemy.id}"`) && markup.includes('data-amount="5"')));
    assert.match(controller.root.innerHTML, /<article class="enemy-card/);
    assert.match(controller.root.innerHTML, /<\/button>\s*<div class="status-list">[\s\S]*?<\/div>\s*<div class="card-damage-controls"/);
    click(controller, "damage", { enemyId: enemy.id, amount: "1" });
    assert.equal(enemy.block, 2);
    assert.equal(enemy.health, enemy.maxHealth);
    click(controller, "damage", { enemyId: enemy.id, amount: "5" });
    assert.equal(enemy.block, 0);
    assert.equal(enemy.health, enemy.maxHealth - 3);
    assert.equal(neighbour.health, neighbour.maxHealth);
    assert.equal(controller.gameState.selectedEnemyId, null);
    assert.equal(controller.gameState.zoomedOut, zoomedOut);
    assert.doesNotMatch(controller.root.innerHTML, /control-dialog/);
    assert.ok(controller.root.innerHTML.includes(`>${enemy.health}<i>`));
    enemy.health = 1;
    click(controller, "damage", { enemyId: enemy.id, amount: "5" });
    assert.equal(enemy.health, 0);
    assert.match(controller.root.innerHTML, /assets\/images\/fallen.svg/);
    const defeatedControls = controller.root.innerHTML.match(/<button class="card-damage-button"[^>]*>/g)
      .filter((markup) => markup.includes(`data-enemy-id="${enemy.id}"`));
    assert.equal(defeatedControls.length, 2);
    assert.ok(defeatedControls.every((markup) => markup.includes("disabled")));
    enemy.resurrect();
    controller.renderGame();
    const restoredControls = controller.root.innerHTML.match(/<button class="card-damage-button"[^>]*>/g)
      .filter((markup) => markup.includes(`data-enemy-id="${enemy.id}"`));
    assert.ok(restoredControls.every((markup) => !markup.includes("disabled")));
  }
});

test("spawn controls belong to living Ironhowl cards in focused view only", () => {
  const controller = createController(4);
  const state = controller.gameState;
  click(controller, "get-enemies");
  for (const row of [0, 1, 2]) {
    click(controller, "select-row", { row: String(row) });
    assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
  }
  click(controller, "select-row", { row: "3" });
  const source = state.rows[3].enemies[0];
  assert.match(buttonMarkup(controller, "spawn"), /aria-label="Spawn an enemy from Ironhowl Brute"/);
  assert.match(controller.root.innerHTML, /<div class="card-damage-controls"[^>]*>\s*<button class="spawn-button"/);
  click(controller, "spawn", { enemyId: source.id });
  const spawned = state.rows[3].enemies[0];
  assert.equal((controller.root.innerHTML.match(/data-action="spawn"/g) ?? []).length, 2);
  assert.equal(state.selectedEnemyId, null);
  assert.equal(state.activeRow, 3);
  assert.doesNotMatch(controller.root.innerHTML, /control-dialog/);
  click(controller, "toggle-overview");
  assert.doesNotMatch(controller.root.innerHTML, /data-action="spawn"/);
  click(controller, "toggle-overview");
  click(controller, "kill", { enemyId: source.id });
  assert.equal((controller.root.innerHTML.match(/data-action="spawn"/g) ?? []).length, 1);
  assert.ok(buttonMarkup(controller, "spawn").includes(spawned.id));
  click(controller, "spawn", { enemyId: source.id });
  click(controller, "spawn", { enemyId: "missing" });
  assert.equal(state.rows[3].enemies.length, 2);
  click(controller, "resurrect", { enemyId: source.id });
  assert.equal((controller.root.innerHTML.match(/data-action="spawn"/g) ?? []).length, 2);
  click(controller, "spawn", { enemyId: source.id });
  assert.equal(state.rows[3].enemies.length, 3);
});
import test from "node:test";
import assert from "node:assert/strict";
import { Enemy } from "../src/models/Enemy.js";
import { GameState } from "../src/models/GameState.js";
import { PoisonBudgetService } from "../src/services/PoisonBudgetService.js";
import { EnemyPoolService } from "../src/services/EnemyPoolService.js";
import { TurnService } from "../src/services/TurnService.js";
import { ENEMY_POOL, ENCOUNTER_PRESETS } from "../src/data/enemies.js";

const definition = {
  id: "test",
  name: "Test enemy",
  maxHealth: 20,
  image: "",
  attackBehaviour: { type: "loop", attacks: ["Hit", "Guard"] },
};

test("ordinary damage consumes block before health and healing is capped", () => {
  const enemy = new Enemy(definition, "enemy-1");
  enemy.adjustBlock(2);
  assert.deepEqual(enemy.takeDamage(5), { blocked: 2, healthLost: 3, health: 17, block: 0 });
  enemy.heal(10);
  assert.equal(enemy.health, 20);
});

test("poison bypasses block and status stacks obey their caps", () => {
  const enemy = new Enemy(definition, "enemy-1");
  enemy.adjustBlock(10);
  enemy.addStatus("weak", 8);
  assert.equal(enemy.statuses.weak, 3);
  enemy.addStatus("poison", 4);
  assert.equal(enemy.takePoisonDamage(enemy.statuses.poison), 4);
  assert.equal(enemy.health, 16);
  assert.equal(enemy.block, 10);
});

test("poison budget is shared across rows", () => {
  const game = new GameState(2);
  const first = new Enemy(definition, "first");
  const second = new Enemy(definition, "second");
  game.rows[0].enemies.push(first);
  game.rows[1].enemies.push(second);
  const poison = new PoisonBudgetService(3);
  assert.equal(poison.add(game, first, 2), 2);
  assert.equal(poison.add(game, second, 2), 1);
  assert.equal(game.poisonTotal, 3);
});

test("vulnerable loses one stack per health-damaging hit, including poison", () => {
  const enemy = new Enemy(definition, "enemy-1");
  enemy.addStatus("vulnerable", 3);
  enemy.addStatus("weak", 2);
  enemy.adjustBlock(5);
  enemy.takeDamage(0);
  enemy.takeDamage(5);
  enemy.takePoisonDamage(0);
  assert.equal(enemy.statuses.vulnerable, 3);
  enemy.takeDamage(2);
  assert.equal(enemy.statuses.vulnerable, 2);
  enemy.takePoisonDamage(2);
  assert.equal(enemy.statuses.vulnerable, 1);
  enemy.takeDamage(1);
  enemy.takeDamage(1);
  assert.equal(enemy.statuses.vulnerable, 0);
  assert.equal(enemy.statuses.weak, 2);
});

test("end turn preserves weak and vulnerable when no damage is taken", () => {
  const game = new GameState(1);
  const enemy = new Enemy(definition, "enemy-1");
  game.rows[0].enemies.push(enemy);
  enemy.addStatus("weak", 2);
  enemy.addStatus("vulnerable", 3);
  new TurnService().endTurn(game);
  assert.equal(enemy.statuses.weak, 2);
  assert.equal(enemy.statuses.vulnerable, 3);
});

test("end turn ticks poison through block, clears block and preserves weak", () => {
  const game = new GameState(1);
  const enemy = new Enemy(definition, "enemy-1");
  game.rows[0].enemies.push(enemy);
  enemy.adjustBlock(8);
  enemy.addStatus("poison", 3);
  enemy.addStatus("weak", 2);
  enemy.addStatus("vulnerable", 1);
  new TurnService().endTurn(game);
  assert.equal(enemy.health, 17);
  assert.equal(enemy.block, 0);
  assert.equal(enemy.statuses.weak, 2);
  assert.equal(enemy.statuses.vulnerable, 0);
  assert.equal(enemy.currentAttackIndex, 1);
  assert.equal(game.turn, 2);
});

test("spawning inserts at the front and resurrection preserves the enemy slot", () => {
  const game = new GameState(1);
  const original = new Enemy(definition, "original");
  game.rows[0].enemies.push(original);
  const pool = new EnemyPoolService([{ ...definition, id: "spawned" }], () => 0);
  const spawned = pool.spawnAtFront(game, 0);
  assert.equal(game.rows[0].enemies[0], spawned);
  assert.equal(game.rows[0].enemies[1], original);
  original.takeDamage(50);
  original.resurrect();
  assert.equal(game.rows[0].enemies[1], original);
  assert.equal(original.health, original.maxHealth);
});

test("preset population fills four rows with distinct ordered combinations", () => {
  const game = new GameState(4);
  const originalRows = [...game.rows];
  game.activeRow = 2;
  game.zoomedOut = true;
  game.turn = 3;
  new EnemyPoolService(ENEMY_POOL, () => 0).populateRows(game);
  assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    ENCOUNTER_PRESETS.slice(0, 4).map((preset) => preset.enemyIds));
  game.rows.forEach((row, index) => assert.equal(row, originalRows[index]));
  assert.equal(game.enemiesLoaded, true);
  assert.equal(game.activeRow, 2);
  assert.equal(game.zoomedOut, true);
  assert.equal(game.turn, 3);
  const enemies = game.rows.flatMap((row) => row.enemies);
  assert.equal(new Set(enemies.map((enemy) => enemy.id)).size, enemies.length);
  assert.notEqual(enemies[0], enemies[1]);
  enemies[0].takeDamage(1);
  assert.equal(enemies[1].health, enemies[1].maxHealth);
});

test("all six approved presets resolve to existing enemy definitions", () => {
  const expected = [
    ["ashbound", "ashbound"], ["glasswarden"], ["mireling", "mireling", "mireling"],
    ["ironhowl"], ["ashbound", "mireling"], ["glasswarden", "ashbound"],
  ];
  assert.deepEqual(ENCOUNTER_PRESETS.map((preset) => preset.enemyIds), expected);
  assert.equal(new Set(ENCOUNTER_PRESETS.map((preset) => preset.id)).size, expected.length);
  ENCOUNTER_PRESETS.forEach((preset, index) => {
    const game = new GameState(1);
    new EnemyPoolService(ENEMY_POOL, () => 0, [preset]).populateRows(game);
    assert.deepEqual(game.rows[0].enemies.map((enemy) => enemy.definitionId), expected[index]);
  });
});

test("selection draws from remaining presets rather than repeating a random group", () => {
  const game = new GameState(4);
  new EnemyPoolService(ENEMY_POOL, () => 0.999).populateRows(game);
  assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    ENCOUNTER_PRESETS.slice(2).reverse().map((preset) => preset.enemyIds));
});

test("initial population happens once and a new game resets availability", () => {
  const game = new GameState(1);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  service.populateRows(game);
  const enemies = game.rows[0].enemies;
  enemies[0].takeDamage(5);
  enemies[0].addStatus("weak");
  service.populateRows(game);
  assert.equal(game.rows[0].enemies, enemies);
  assert.equal(enemies[0].health, enemies[0].maxHealth - 5);
  assert.equal(enemies[0].statuses.weak, 1);
  const fresh = new GameState(1);
  assert.equal(fresh.enemiesLoaded, false);
  service.populateRows(fresh);
  assert.notEqual(fresh.rows[0].enemies[0].id, enemies[0].id);
});

test("invalid preset data cannot partially populate the encounter", () => {
  for (const presets of [
    [ENCOUNTER_PRESETS[0]],
    [ENCOUNTER_PRESETS[0], { id: "invalid", enemyIds: ["missing"] }],
    [ENCOUNTER_PRESETS[0], { id: "empty", enemyIds: [] }],
  ]) {
    const game = new GameState(2);
    const original = new Enemy(definition, "original");
    game.rows[0].enemies.push(original);
    assert.throws(() => new EnemyPoolService(ENEMY_POOL, () => 0, presets).populateRows(game),
      /Not enough encounter presets|Unknown enemy|Empty encounter preset/);
    assert.deepEqual(game.rows.map((row) => row.enemies), [[original], []]);
    assert.equal(game.enemiesLoaded, false);
  }
});
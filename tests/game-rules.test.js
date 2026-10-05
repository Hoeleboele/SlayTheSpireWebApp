import test from "node:test";
import assert from "node:assert/strict";
import { Enemy } from "../src/models/Enemy.js";
import { GameState } from "../src/models/GameState.js";
import { PoisonBudgetService } from "../src/services/PoisonBudgetService.js";
import { EnemyPoolService } from "../src/services/EnemyPoolService.js";
import { TurnService } from "../src/services/TurnService.js";

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

test("end turn ticks poison through block, clears block and decays statuses", () => {
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
  assert.equal(enemy.statuses.weak, 1);
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
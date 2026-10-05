import test from "node:test";
import assert from "node:assert/strict";
import { Enemy } from "../src/models/Enemy.js";
import { GameState } from "../src/models/GameState.js";
import { PoisonBudgetService } from "../src/services/PoisonBudgetService.js";
import { EnemyPoolService } from "../src/services/EnemyPoolService.js";
import { TurnService } from "../src/services/TurnService.js";
import { AVAILABLE_ENEMIES, ENEMY_POOL } from "../src/data/enemies.js";

const groups = ENEMY_POOL.map((enemy) => [enemy.id, ...(enemy.companions ?? [])]);

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

test("vulnerable loses one stack per ordinary health-damaging hit but not poison", () => {
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
  assert.equal(enemy.statuses.vulnerable, 2);
  enemy.takeDamage(1);
  assert.equal(enemy.statuses.vulnerable, 1);
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

test("end turn ticks poison through block, clears block and preserves weak and vulnerable", () => {
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
  assert.equal(enemy.statuses.vulnerable, 1);
  assert.equal(enemy.currentAttackIndex, 1);
  assert.equal(game.turn, 2);
  new TurnService().endTurn(game);
  assert.equal(enemy.health, 14);
  assert.equal(enemy.statuses.weak, 2);
  assert.equal(enemy.statuses.vulnerable, 1);
});

test("spawning inserts at the front and resurrection preserves the enemy slot", () => {
  const game = new GameState(1);
  const original = new Enemy({ ...definition, spawnPool: ["spawned"] }, "original");
  game.rows[0].enemies.push(original);
  game.enemiesLoaded = true;
  const pool = new EnemyPoolService([{ ...definition, id: "spawned" }], () => 0);
  const spawned = pool.spawnAtFront(game, original.id);
  assert.equal(game.rows[0].enemies[0], spawned);
  assert.equal(game.rows[0].enemies[1], original);
  original.takeDamage(50);
  original.resurrect();
  assert.equal(game.rows[0].enemies[1], original);
  assert.equal(original.health, original.maxHealth);
});

test("enemy-owned groups fill four rows with distinct ordered combinations", () => {
  const game = new GameState(4);
  const originalRows = [...game.rows];
  game.activeRow = 2;
  game.zoomedOut = true;
  game.turn = 3;
  new EnemyPoolService(ENEMY_POOL, () => 0).populateRows(game);
  assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    groups);
  game.rows.forEach((row, index) => assert.equal(row, originalRows[index]));
  assert.equal(game.enemiesLoaded, true);
  assert.equal(game.activeRow, 2);
  assert.equal(game.zoomedOut, true);
  assert.equal(game.turn, 3);
  const enemies = game.rows.flatMap((row) => row.enemies);
  assert.equal(new Set(enemies.map((enemy) => enemy.id)).size, enemies.length);
  const [first, companion] = game.rows[1].enemies;
  assert.notEqual(first, companion);
  first.takeDamage(1);
  first.addStatus("weak");
  first.adjustBlock(3);
  first.advanceAttack();
  assert.equal(companion.health, companion.maxHealth);
  assert.equal(companion.statuses.weak, 0);
  assert.equal(companion.block, 0);
  assert.equal(companion.currentAttackIndex, 0);
});

test("all four enemy-owned groups resolve to existing definitions", () => {
  const expected = [
    ["ashbound"], ["glasswarden", "glasswarden"], ["mireling", "mireling", "mireling"],
    ["ironhowl"],
  ];
  assert.deepEqual(groups, expected);
  assert.equal(new Set(ENEMY_POOL.map((enemy) => enemy.id)).size, expected.length);
  ENEMY_POOL.forEach((definition, index) => {
    const game = new GameState(1);
    new EnemyPoolService(ENEMY_POOL, () => index / ENEMY_POOL.length).populateRows(game);
    assert.deepEqual(game.rows[0].enemies.map((enemy) => enemy.definitionId), expected[index]);
  });
});

test("selection draws from remaining definitions rather than repeating a random group", () => {
  const game = new GameState(4);
  new EnemyPoolService(ENEMY_POOL, () => 0.999).populateRows(game);
  assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    [...groups].reverse());
});

test("initial population happens once and a new game resets availability", () => {
  const game = new GameState(1);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  service.populateRows(game);
  const enemies = game.rows[0].enemies;
  const history = [...game.encounterHistory];
  enemies[0].takeDamage(5);
  enemies[0].addStatus("weak");
  service.populateRows(game);
  assert.equal(game.rows[0].enemies, enemies);
  assert.equal(enemies[0].health, enemies[0].maxHealth - 5);
  assert.equal(enemies[0].statuses.weak, 1);
  assert.deepEqual([...game.encounterHistory], history);
  const fresh = new GameState(1);
  assert.equal(fresh.enemiesLoaded, false);
  service.populateRows(fresh);
  assert.notEqual(fresh.rows[0].enemies[0].id, enemies[0].id);
  assert.deepEqual([...fresh.encounterHistory], [ENEMY_POOL[0].id]);
});

test("later loads use unseen groups and exclude current groups when restarting mid-load", () => {
  const game = new GameState(3);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  const expectedLoads = [[0, 1, 2], [3, 0, 1], [2, 0, 1], [3, 0, 1]];
  const previousEnemies = new Set();
  for (const groupIndexes of expectedLoads) {
    service.populateRows(game);
    assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
      groupIndexes.map((index) => groups[index]));
    assert.equal(new Set(groupIndexes).size, game.rows.length);
    assert.deepEqual([...game.encounterHistory], groupIndexes.map((index) => ENEMY_POOL[index].id));
    for (const enemy of game.rows.flatMap((row) => row.enemies)) {
      assert.equal(previousEnemies.has(enemy.id), false);
      assert.equal(enemy.health, enemy.maxHealth);
      assert.equal(enemy.block, 0);
      assert.ok(Object.values(enemy.statuses).every((count) => count === 0));
      previousEnemies.add(enemy.id);
      enemy.takeDamage(100);
    }
    assert.equal(game.clearRows(), true);
  }
});

test("the pool restarts on the next load after exact exhaustion", () => {
  const game = new GameState(2);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  for (const groupIndexes of [[0, 1], [2, 3], [0, 1]]) {
    service.populateRows(game);
    assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
      groupIndexes.map((index) => groups[index]));
    game.rows.flatMap((row) => row.enemies).forEach((enemy) => enemy.takeDamage(100));
    assert.equal(game.clearRows(), true);
  }
  assert.deepEqual([...game.encounterHistory], ENEMY_POOL.slice(0, 2).map((enemy) => enemy.id));
});

test("clearing requires all enemies defeated and resets the encounter without losing history", () => {
  const game = new GameState(2);
  const rows = [...game.rows];
  assert.equal(game.canClearRows, false);
  assert.equal(game.clearRows(), false);
  game.enemiesLoaded = true;
  assert.equal(game.canClearRows, false);
  const first = new Enemy(definition, "first");
  const second = new Enemy(definition, "second");
  game.rows[0].enemies.push(first);
  game.rows[1].enemies.push(second);
  game.encounterHistory.add("seen-preset");
  game.turn = 5;
  game.activeRow = 1;
  game.zoomedOut = true;
  game.selectedEnemyId = second.id;
  first.takeDamage(100);
  assert.equal(game.clearRows(), false);
  assert.equal(game.turn, 5);
  assert.equal(game.rows[1].enemies[0], second);
  second.addStatus("poison", 2);
  second.takeDamage(100);
  assert.equal(game.canClearRows, true);
  second.resurrect();
  assert.equal(game.canClearRows, false);
  second.takeDamage(100);
  const spawned = new Enemy(definition, "spawned");
  game.rows[0].enemies.unshift(spawned);
  assert.equal(game.canClearRows, false);
  spawned.takeDamage(100);
  assert.equal(game.clearRows(), true);
  game.rows.forEach((row, index) => {
    assert.equal(row, rows[index]);
    assert.deepEqual(row.enemies, []);
  });
  assert.equal(game.turn, 1);
  assert.equal(game.activeRow, 0);
  assert.equal(game.zoomedOut, false);
  assert.equal(game.selectedEnemyId, null);
  assert.equal(game.enemiesLoaded, false);
  assert.equal(game.poisonTotal, 0);
  assert.deepEqual([...game.encounterHistory], ["seen-preset"]);
  assert.equal(game.canClearRows, false);
});

test("invalid group data cannot partially populate the encounter", () => {
  for (const pool of [
    [ENEMY_POOL[0]],
    [ENEMY_POOL[0], { ...definition, companions: ["missing"] }],
    [ENEMY_POOL[0], { ...definition, companions: "ashbound" }],
    [ENEMY_POOL[0], { ...definition, spawnPool: ["missing"] }],
    [ENEMY_POOL[0], { ...definition, spawnPool: "ashbound" }],
    [ENEMY_POOL[0], ENEMY_POOL[0]],
  ]) {
    const game = new GameState(2);
    const original = new Enemy(definition, "original");
    game.rows[0].enemies.push(original);
    game.encounterHistory.add(ENEMY_POOL[0].id);
    assert.throws(() => new EnemyPoolService(pool, () => 0).populateRows(game),
      /Not enough enemy groups|Unknown enemy|Invalid|Duplicate/);
    assert.deepEqual(game.rows.map((row) => row.enemies), [[original], []]);
    assert.equal(game.enemiesLoaded, false);
    assert.deepEqual([...game.encounterHistory], [ENEMY_POOL[0].id]);
  }
});

test("companions and spawned targets never recursively expand their companions", () => {
  const pool = [
    { ...definition, id: "primary", companions: ["companion"], spawnPool: ["companion"] },
    { ...definition, id: "companion", companions: ["primary"] },
    { ...definition, id: "solo", companions: [] },
  ];
  const game = new GameState(3);
  const service = new EnemyPoolService(pool, () => 0);
  service.populateRows(game);
  assert.deepEqual(game.rows.map((row) => row.enemies.map((enemy) => enemy.definitionId)),
    [["primary", "companion"], ["companion", "primary"], ["solo"]]);
  const source = game.rows[1].enemies[1];
  service.spawnAtFront(game, source.id);
  assert.deepEqual(game.rows[1].enemies.map((enemy) => enemy.definitionId),
    ["companion", "companion", "primary"]);
});

test("Ironhowl repeatedly spawns fresh Ironhowls without altering encounter state", () => {
  const game = new GameState(4);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  service.populateRows(game);
  const source = game.rows[3].enemies[0];
  const history = [...game.encounterHistory];
  game.selectedEnemyId = source.id;
  source.addStatus("poison", 2);
  source.adjustBlock(5);
  const first = service.spawnAtFront(game, source.id);
  const second = service.spawnAtFront(game, source.id);
  const third = service.spawnAtFront(game, first.id);
  assert.deepEqual(game.rows[3].enemies, [third, second, first, source]);
  for (const enemy of [first, second, third]) {
    assert.equal(enemy.definitionId, "ironhowl");
    assert.equal(enemy.health, enemy.maxHealth);
    assert.equal(enemy.block, 0);
    assert.ok(Object.values(enemy.statuses).every((count) => count === 0));
    assert.deepEqual(enemy.spawnPool, ["ironhowl"]);
    assert.notEqual(enemy.spawnPool, source.spawnPool);
    assert.notEqual(enemy.id, source.id);
  }
  assert.deepEqual([...game.encounterHistory], history);
  assert.equal(game.selectedEnemyId, source.id);
  assert.equal(game.turn, 1);
  assert.equal(game.activeRow, 0);
});

test("random spawning uses only the source enemy's configured pool", () => {
  for (const [random, expected] of [[0, "first"], [0.499, "first"], [0.5, "second"], [0.999, "second"]]) {
    const pool = [
      { ...definition, id: "unrelated" },
      { ...definition, id: "source", spawnPool: ["first", "second"] },
      { ...definition, id: "first" },
      { ...definition, id: "second" },
    ];
    const game = new GameState(1);
    game.enemiesLoaded = true;
    const source = new Enemy(pool[1]);
    game.rows[0].enemies.push(source);
    const spawned = new EnemyPoolService(pool, () => random).spawnAtFront(game, source.id);
    assert.equal(spawned.definitionId, expected);
    assert.equal(game.rows[0].enemies.length, 2);
  }
});

test("spawning rejects unloaded, missing, unconfigured, dead and invalid sources without mutation", () => {
  const game = new GameState(4);
  const service = new EnemyPoolService(ENEMY_POOL, () => 0);
  assert.equal(service.spawnAtFront(game, "missing"), null);
  service.populateRows(game);
  const originals = game.rows.map((row) => [...row.enemies]);
  const source = game.rows[3].enemies[0];
  for (const sourceId of [undefined, "missing", 0, game.rows[0].enemies[0].id]) {
    assert.equal(service.spawnAtFront(game, sourceId), null);
  }
  source.takeDamage(100);
  assert.equal(service.spawnAtFront(game, source.id), null);
  source.resurrect();
  source.spawnPool = [];
  assert.equal(service.spawnAtFront(game, source.id), null);
  source.spawnPool = ["ironhowl", "missing"];
  assert.throws(() => service.spawnAtFront(game, source.id), /Unknown enemy/);
  game.rows.forEach((row, index) => assert.deepEqual(row.enemies, originals[index]));
  source.spawnPool = ["ironhowl"];
  assert.equal(service.spawnAtFront(game, source.id).definitionId, "ironhowl");
  game.rows.flatMap((row) => row.enemies).forEach((enemy) => enemy.takeDamage(100));
  game.clearRows();
  service.populateRows(game);
  assert.equal(service.spawnAtFront(game, source.id), null);
});

test("available catalog is independent of starting groups", () => {
  assert.notEqual(AVAILABLE_ENEMIES, ENEMY_POOL);
  assert.ok(AVAILABLE_ENEMIES.every((enemy) => enemy.companions === undefined));
  assert.deepEqual(ENEMY_POOL.find((enemy) => enemy.id === "glasswarden").companions, ["glasswarden"]);
  assert.deepEqual(ENEMY_POOL.find((enemy) => enemy.id === "mireling").companions, ["mireling", "mireling"]);
});

test("catalog-only enemies can be companions and fixed spawns without becoming starting groups", () => {
  const available = [
    { ...definition, id: "leader" },
    { ...definition, id: "minion", maxHealth: 7, spawnPool: ["minion"] },
  ];
  const pool = [{ ...available[0], companions: ["minion", "minion"], spawnPool: ["minion"] }];
  const game = new GameState(1);
  const service = new EnemyPoolService(pool, () => 0.999, available);
  for (let load = 0; load < 3; load += 1) {
    service.populateRows(game);
    const [leader, first, second] = game.rows[0].enemies;
    assert.deepEqual(game.rows[0].enemies.map((enemy) => enemy.definitionId), ["leader", "minion", "minion"]);
    assert.deepEqual([...game.encounterHistory], ["leader"]);
    assert.equal(first.maxHealth, 7);
    assert.notEqual(first.id, second.id);
    first.takeDamage(1);
    assert.equal(second.health, 7);
    const spawned = service.spawnAtFront(game, leader.id);
    assert.equal(spawned.definitionId, "minion");
    assert.equal(spawned.health, 7);
    assert.equal(game.rows[0].enemies[0], spawned);
    assert.equal(service.spawnAtFront(game, spawned.id).definitionId, "minion");
    assert.deepEqual([...game.encounterHistory], ["leader"]);
    game.rows[0].enemies.forEach((enemy) => enemy.takeDamage(100));
    assert.equal(game.clearRows(), true);
  }
  assert.throws(() => service.populateRows(new GameState(2)), /Not enough enemy groups/);
});

test("random spawn pools resolve targets outside the starting pool", () => {
  const available = [
    { ...definition, id: "leader" },
    { ...definition, id: "first" },
    { ...definition, id: "second" },
    { ...definition, id: "unrelated" },
  ];
  const pool = [{ ...available[0], spawnPool: ["first", "second"] }];
  for (const [random, expected] of [[0, "first"], [0.5, "second"], [0.999, "second"]]) {
    const game = new GameState(1);
    const service = new EnemyPoolService(pool, () => random, available);
    service.populateRows(game);
    const source = game.rows[0].enemies[0];
    assert.equal(service.spawnAtFront(game, source.id).definitionId, expected);
    assert.deepEqual([...game.encounterHistory], ["leader"]);
  }
});

test("invalid independent catalogs leave encounter state unchanged", () => {
  const leader = { ...definition, id: "leader" };
  const minion = { ...definition, id: "minion" };
  for (const [pool, available] of [
    [[leader], [minion]],
    [[leader], [leader, leader]],
    [[leader, leader], [leader]],
    [[{ ...leader, companions: ["missing"] }], [leader, minion]],
    [[{ ...leader, spawnPool: ["missing"] }], [leader, minion]],
    [[leader], [leader, { ...minion, spawnPool: ["missing"] }]],
  ]) {
    const game = new GameState(1);
    const original = new Enemy(leader);
    game.rows[0].enemies.push(original);
    game.encounterHistory.add("previous");
    assert.throws(() => new EnemyPoolService(pool, () => 0, available).populateRows(game), /Unknown|Duplicate/);
    assert.deepEqual(game.rows[0].enemies, [original]);
    assert.deepEqual([...game.encounterHistory], ["previous"]);
    assert.equal(game.enemiesLoaded, false);
  }
});
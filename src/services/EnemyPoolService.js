import { Enemy } from "../models/Enemy.js";
import { AVAILABLE_ENEMIES, ENEMY_POOL } from "../data/enemies.js";

export class EnemyPoolService {
  constructor(pool = ENEMY_POOL, random = Math.random, availableEnemies = pool === ENEMY_POOL ? AVAILABLE_ENEMIES : pool) {
    this.pool = pool;
    this.random = random;
    this.availableEnemies = availableEnemies;
  }

  resolveDefinitions() {
    const definitions = new Map(this.availableEnemies.map((definition) => [definition.id, definition]));
    if (definitions.size !== this.availableEnemies.length) throw new Error("Duplicate enemy definition ID.");
    if (new Set(this.pool.map((definition) => definition.id)).size !== this.pool.length) {
      throw new Error("Duplicate enemy group ID.");
    }
    for (const definition of [...this.availableEnemies, ...this.pool]) {
      if (!definitions.has(definition.id)) throw new Error(`Unknown enemy group: ${definition.id}`);
      for (const field of ["companions", "spawnPool"]) {
        const enemyIds = definition[field] ?? [];
        if (!Array.isArray(enemyIds)) throw new Error(`Invalid ${field} for enemy: ${definition.id}`);
        for (const enemyId of enemyIds) {
          if (!definitions.has(enemyId)) throw new Error(`Unknown enemy in ${field}: ${enemyId}`);
        }
      }
    }
    return definitions;
  }

  populateRows(gameState) {
    if (gameState.enemiesLoaded) return;
    if (this.pool.length < gameState.rows.length) {
      throw new Error("Not enough enemy groups to fill every row.");
    }
    const definitions = this.resolveDefinitions();
    const combinations = this.pool.map((definition) => ({
      id: definition.id,
      enemies: [definition, ...(definition.companions ?? []).map((enemyId) => definitions.get(enemyId))],
    }));
    let history = new Set(gameState.encounterHistory);
    const chosen = new Set();
    const populatedRows = gameState.rows.map(() => {
      let available = combinations.filter((combination) => !history.has(combination.id));
      if (!available.length) {
        history = new Set(chosen);
        available = combinations.filter((combination) => !history.has(combination.id));
      }
      const index = Math.floor(this.random() * available.length);
      const combination = available[index];
      chosen.add(combination.id);
      history.add(combination.id);
      return combination.enemies.map((definition) => new Enemy(definition));
    });
    gameState.rows.forEach((row, index) => { row.enemies = populatedRows[index]; });
    gameState.encounterHistory = history;
    gameState.enemiesLoaded = true;
  }

  spawnAtFront(gameState, sourceEnemyId) {
    if (!gameState.enemiesLoaded) return null;
    const source = gameState.findEnemy(sourceEnemyId);
    if (!source?.enemy.isAlive || !source.enemy.spawnPool.length) return null;
    const definitions = this.resolveDefinitions();
    const targets = source.enemy.spawnPool.map((enemyId) => {
      const definition = definitions.get(enemyId);
      if (!definition) throw new Error(`Unknown enemy in spawnPool: ${enemyId}`);
      return definition;
    });
    const index = Math.floor(this.random() * targets.length);
    const enemy = new Enemy(targets[index]);
    const { row } = source;
    row.enemies.unshift(enemy);
    return enemy;
  }
}
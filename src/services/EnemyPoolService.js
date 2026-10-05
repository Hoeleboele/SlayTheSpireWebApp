import { Enemy } from "../models/Enemy.js";
import { ENEMY_POOL } from "../data/enemies.js";

export class EnemyPoolService {
  constructor(pool = ENEMY_POOL, random = Math.random) {
    this.pool = pool;
    this.random = random;
  }

  createRandomEnemy() {
    const index = Math.floor(this.random() * this.pool.length);
    return new Enemy(this.pool[index]);
  }

  populateRows(gameState) {
    for (const row of gameState.rows) {
      const count = 1 + Math.floor(this.random() * 3);
      row.enemies = Array.from({ length: count }, () => this.createRandomEnemy());
    }
  }

  spawnAtFront(gameState, rowIndex) {
    const row = gameState.rows[rowIndex];
    if (!row) return null;
    const enemy = this.createRandomEnemy();
    row.enemies.unshift(enemy);
    return enemy;
  }
}
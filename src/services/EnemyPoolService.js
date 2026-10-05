import { Enemy } from "../models/Enemy.js";
import { ENEMY_POOL, ENCOUNTER_PRESETS } from "../data/enemies.js";

export class EnemyPoolService {
  constructor(pool = ENEMY_POOL, random = Math.random, presets = ENCOUNTER_PRESETS) {
    this.pool = pool;
    this.random = random;
    this.presets = presets;
  }

  createRandomEnemy() {
    const index = Math.floor(this.random() * this.pool.length);
    return new Enemy(this.pool[index]);
  }

  populateRows(gameState) {
    if (gameState.enemiesLoaded) return;
    if (this.presets.length < gameState.rows.length) {
      throw new Error("Not enough encounter presets to fill every row.");
    }
    const definitions = new Map(this.pool.map((definition) => [definition.id, definition]));
    const available = this.presets.map((preset) => {
      if (!preset.enemyIds?.length) throw new Error(`Empty encounter preset: ${preset.id}`);
      return preset.enemyIds.map((enemyId) => {
        const definition = definitions.get(enemyId);
        if (!definition) throw new Error(`Unknown enemy in encounter preset: ${enemyId}`);
        return definition;
      });
    });
    const populatedRows = gameState.rows.map(() => {
      const index = Math.floor(this.random() * available.length);
      const [combination] = available.splice(index, 1);
      return combination.map((definition) => new Enemy(definition));
    });
    gameState.rows.forEach((row, index) => { row.enemies = populatedRows[index]; });
    gameState.enemiesLoaded = true;
  }

  spawnAtFront(gameState, rowIndex) {
    const row = gameState.rows[rowIndex];
    if (!row) return null;
    const enemy = this.createRandomEnemy();
    row.enemies.unshift(enemy);
    return enemy;
  }
}
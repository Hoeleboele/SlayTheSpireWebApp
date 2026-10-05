export class GameState {
  constructor(rowCount) {
    this.rows = Array.from({ length: rowCount }, (_, index) => ({ id: index, enemies: [] }));
    this.turn = 1;
    this.zoomedOut = false;
    this.activeRow = 0;
    this.selectedEnemyId = null;
    this.enemiesLoaded = false;
    this.encounterHistory = new Set();
  }

  get canClearRows() {
    const enemies = this.rows.flatMap((row) => row.enemies);
    return this.enemiesLoaded && enemies.length > 0 && enemies.every((enemy) => !enemy.isAlive);
  }

  clearRows() {
    if (!this.canClearRows) return false;
    this.rows.forEach((row) => { row.enemies = []; });
    this.turn = 1;
    this.zoomedOut = false;
    this.activeRow = 0;
    this.selectedEnemyId = null;
    this.enemiesLoaded = false;
    return true;
  }

  get poisonTotal() {
    return this.rows.reduce((total, row) => total + row.enemies.reduce(
      (rowTotal, enemy) => rowTotal + enemy.statuses.poison,
      0,
    ), 0);
  }

  findEnemy(enemyId) {
    for (const row of this.rows) {
      const enemy = row.enemies.find((candidate) => candidate.id === enemyId);
      if (enemy) return { enemy, row };
    }
    return null;
  }
}
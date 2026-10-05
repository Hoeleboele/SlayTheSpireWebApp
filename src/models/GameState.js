export class GameState {
  constructor(rowCount) {
    this.rows = Array.from({ length: rowCount }, (_, index) => ({ id: index, enemies: [] }));
    this.turn = 1;
    this.zoomedOut = false;
    this.activeRow = 0;
    this.selectedEnemyId = null;
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
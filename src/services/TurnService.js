import { STATUS_TYPES } from "../config/gameConfig.js";

export class TurnService {
  endTurn(gameState) {
    for (const row of gameState.rows) {
      for (const enemy of row.enemies) {
        enemy.removeStatus(STATUS_TYPES.VULNERABLE);
        enemy.removeStatus(STATUS_TYPES.WEAK);
        if (enemy.isAlive) enemy.takePoisonDamage(enemy.statuses[STATUS_TYPES.POISON]);
        enemy.block = 0;
        enemy.advanceAttack();
      }
    }
    gameState.turn += 1;
  }
}
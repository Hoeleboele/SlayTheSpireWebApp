import { POISON_BUDGET, STATUS_TYPES } from "../config/gameConfig.js";

export class PoisonBudgetService {
  constructor(budget = POISON_BUDGET) {
    this.budget = budget;
  }

  add(gameState, enemy, amount = 1) {
    const available = this.budget - gameState.poisonTotal;
    return enemy.addStatus(STATUS_TYPES.POISON, Math.min(amount, available));
  }

  remove(enemy, amount = 1) {
    return enemy.removeStatus(STATUS_TYPES.POISON, amount);
  }
}
import { MAX_ROWS, STATUS_TYPES } from "../config/gameConfig.js";
import { EnemyPoolService } from "../services/EnemyPoolService.js";
import { PoisonBudgetService } from "../services/PoisonBudgetService.js";
import { TurnService } from "../services/TurnService.js";
import { GameState } from "../models/GameState.js";
import { GameView } from "../views/GameView.js";
import { StartupView } from "../views/StartupView.js";

export class AppController {
  constructor(root) {
    this.root = root;
    this.startupView = new StartupView();
    this.gameView = new GameView();
    this.enemyPool = new EnemyPoolService();
    this.poison = new PoisonBudgetService();
    this.turns = new TurnService();
    this.gameState = null;
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
    document.addEventListener("keydown", (event) => this.handleKeydown(event));
    this.showStartup();
  }

  showStartup() {
    this.gameState = null;
    this.startupView.render(this.root);
  }

  renderGame() {
    this.gameView.render(this.root, this.gameState);
  }

  handleSubmit(event) {
    if (event.target.id !== "start-form") return;
    event.preventDefault();
    const input = this.root.querySelector("#row-count");
    const rowCount = Math.max(1, Math.min(MAX_ROWS, Number(input.value) || 1));
    this.gameState = new GameState(rowCount);
    this.renderGame();
  }

  handleClick(event) {
    let button = event.target.closest("[data-action]");
    if (this.gameState?.selectedEnemyId) {
      const dialog = this.root.querySelector(".control-dialog");
      if (dialog && event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX >= bounds.right
          || event.clientY < bounds.top || event.clientY >= bounds.bottom;
        if (outside) button = { dataset: { action: "close-panel" } };
      }
    }
    if (!button) return;
    const { action } = button.dataset;
    if (!this.gameState) {
      const input = this.root.querySelector("#row-count");
      if (action === "rows-up") input.value = Math.min(MAX_ROWS, Number(input.value || 1) + 1);
      if (action === "rows-down") input.value = Math.max(1, Number(input.value || 1) - 1);
      return;
    }

    const state = this.gameState;
    const selected = button.dataset.enemyId ? state.findEnemy(button.dataset.enemyId)?.enemy : null;
    switch (action) {
      case "leave": this.showStartup(); return;
      case "get-enemies":
        if (state.enemiesLoaded) return;
        this.enemyPool.populateRows(state);
        break;
      case "end-turn": this.turns.endTurn(state); break;
      case "toggle-overview": state.zoomedOut = !state.zoomedOut; break;
      case "select-row": state.activeRow = Number(button.dataset.row); state.zoomedOut = false; break;
      case "navigate": state.activeRow = Math.max(0, Math.min(state.rows.length - 1, state.activeRow + Number(button.dataset.direction))); break;
      case "spawn":
        if (!state.enemiesLoaded) return;
        this.enemyPool.spawnAtFront(state, Number(button.dataset.row));
        break;
      case "select-enemy": state.selectedEnemyId = button.dataset.enemyId; break;
      case "close-panel": state.selectedEnemyId = null; break;
      case "damage": selected?.takeDamage(Number(button.dataset.amount)); break;
      case "heal": selected?.heal(Number(button.dataset.amount)); break;
      case "block": selected?.adjustBlock(Number(button.dataset.amount)); break;
      case "reduce-weak": selected?.removeStatus(STATUS_TYPES.WEAK); break;
      case "status-add": {
        const type = button.dataset.amount;
        if (type === STATUS_TYPES.POISON) this.poison.add(state, selected);
        else selected?.addStatus(type);
        break;
      }
      case "status-remove": {
        const type = button.dataset.amount;
        if (type === STATUS_TYPES.POISON) this.poison.remove(selected);
        else selected?.removeStatus(type);
        break;
      }
      case "kill": selected?.takeDamage(selected.health + selected.block); break;
      case "resurrect": selected?.resurrect(); break;
      case "fullscreen": this.toggleFullscreen(); return;
      default: return;
    }
    this.renderGame();
  }

  handleKeydown(event) {
    if (event.key === "Escape" && this.gameState?.selectedEnemyId) {
      this.gameState.selectedEnemyId = null;
      this.renderGame();
      return;
    }
    if (!this.gameState || this.gameState.zoomedOut || this.gameState.selectedEnemyId || event.target.matches("input, button")) return;
    if (event.key === "ArrowUp") this.gameState.activeRow = Math.max(0, this.gameState.activeRow - 1);
    else if (event.key === "ArrowDown") this.gameState.activeRow = Math.min(this.gameState.rows.length - 1, this.gameState.activeRow + 1);
    else return;
    this.renderGame();
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        try { await screen.orientation?.lock?.("landscape"); } catch { /* Orientation lock is optional on some mobile browsers. */ }
      } else {
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
      }
    } catch {
      this.root.querySelector(".fullscreen-button")?.classList.add("fullscreen-unavailable");
    }
  }
}
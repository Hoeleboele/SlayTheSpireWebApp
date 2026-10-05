import { escapeHtml } from "../utils/escapeHtml.js";

function statusPills(enemy) {
  return Object.entries(enemy.statuses)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => name === "weak" || name === "vulnerable"
      ? `<button class="status-pill status-${name}" type="button" data-action="reduce-${name}" data-enemy-id="${escapeHtml(enemy.id)}" title="Remove one ${name === "weak" ? "Weak" : "Vulnerable"} stack" aria-label="Remove one ${name === "weak" ? "Weak" : "Vulnerable"} stack from ${escapeHtml(enemy.name)}"><i></i>${escapeHtml(name)} <b>${count}</b></button>`
      : `<span class="status-pill status-${name}"><i></i>${escapeHtml(name)} <b>${count}</b></span>`)
    .join("") || '<span class="no-status">No status</span>';
}

function attackMarkup(enemy) {
  const behaviour = enemy.attackBehaviour;
  if (behaviour.type === "fixed") {
    return `<p class="attack-line">${escapeHtml(behaviour.text)}</p>`;
  }
  if (behaviour.type === "loop") {
    return `<ol class="attack-loop">${behaviour.attacks.map((attack, index) => `
      <li class="${index === enemy.currentAttackIndex ? "is-current" : ""}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(attack)}</li>`).join("")}</ol>`;
  }
  return `<div class="dice-list">${behaviour.faces.map((face) => `
    <p><b>${escapeHtml(face.range)}</b><span>${escapeHtml(face.text)}</span></p>`).join("")}</div>`;
}

function enemyCard(enemy, rowIndex) {
  const image = enemy.isAlive ? enemy.image : "assets/images/fallen.svg";
  const behaviour = enemy.attackBehaviour;
  return `
    <article class="enemy-card ${enemy.isAlive ? "" : "is-dead"}" data-enemy-id="${escapeHtml(enemy.id)}">
    <button class="enemy-select" type="button" data-action="select-enemy" data-enemy-id="${escapeHtml(enemy.id)}" data-row="${rowIndex}" aria-label="Select ${escapeHtml(enemy.name)}${enemy.isAlive ? "" : ", defeated"}">
      <span class="enemy-art"><img src="${escapeHtml(image)}" alt="" draggable="false"><span class="art-index">${String(rowIndex + 1).padStart(2, "0")}</span>${enemy.isAlive ? "" : '<span class="defeated-stamp">DEFEATED</span>'}</span>
      <span class="enemy-content">
        <span class="enemy-heading"><span><span class="enemy-kind">${escapeHtml(enemy.kind)}</span><strong>${escapeHtml(enemy.name)}</strong></span><span class="select-mark" aria-hidden="true">↗</span></span>
        <span class="vitals">
          <span class="vital health-vital"><small>HEALTH</small><b>${enemy.health}<i> / ${enemy.maxHealth}</i></b><span class="meter"><i style="width:${Math.max(0, enemy.health / enemy.maxHealth * 100)}%"></i></span></span>
          <span class="vital block-vital"><small>BLOCK</small><b>${enemy.block}</b><span class="block-mark" aria-hidden="true">▧</span></span>
        </span>
        <span class="attack-box"><span class="attack-label"><span>INTENT</span><span>${behaviour.type === "loop" ? `CYCLE ${enemy.currentAttackIndex + 1}/${behaviour.attacks.length}` : behaviour.type === "dice" ? "D6" : "REPEAT"}</span></span>${attackMarkup(enemy)}</span>
      </span>
    </button>
    <div class="status-list">${statusPills(enemy)}</div>
    <div class="card-damage-controls" role="group" aria-label="Damage ${escapeHtml(enemy.name)}">
      <span>Damage</span>
      ${[1, 5].map((amount) => `<button class="card-damage-button" type="button" data-action="damage" data-amount="${amount}" data-enemy-id="${escapeHtml(enemy.id)}" title="Deal ${amount} damage to ${escapeHtml(enemy.name)}" aria-label="Deal ${amount} damage to ${escapeHtml(enemy.name)}" ${enemy.isAlive ? "" : "disabled"}>-${amount}</button>`).join("")}
    </div>
    </article>`;
}

function rowMarkup(row, index, state) {
  const active = !state.zoomedOut;
  return `
    <section class="battle-row ${state.zoomedOut ? "overview-row" : "focused-row"}" data-row-index="${index}">
      <header class="row-heading">
        <button class="row-title ${state.zoomedOut ? "row-select" : ""}" type="button" ${state.zoomedOut ? `data-action="select-row" data-row="${index}"` : "disabled"}>
          <span class="row-number">${String(index + 1).padStart(2, "0")}</span><span><small>ENCOUNTER LANE</small><strong>Row ${index + 1}</strong></span>${state.zoomedOut ? '<span class="row-open">OPEN ↗</span>' : ""}
        </button>
        ${active ? `<button class="spawn-button" type="button" data-action="spawn" data-row="${index}" ${state.enemiesLoaded ? "" : "disabled"}><span aria-hidden="true">＋</span> Spawn enemy</button>` : `<span class="enemy-count">${row.enemies.length} ${row.enemies.length === 1 ? "ENEMY" : "ENEMIES"}</span>`}
      </header>
      ${row.enemies.length ? `<div class="enemy-grid" tabindex="0" role="region" aria-label="Row ${index + 1} enemies">${row.enemies.map((enemy) => enemyCard(enemy, index)).join("")}</div>` : '<div class="empty-row"><span>—</span><p>Lane is clear. Get enemies to begin.</p></div>'}
    </section>`;
}

function controlPanel(state) {
  const selected = state.selectedEnemyId ? state.findEnemy(state.selectedEnemyId) : null;
  if (!selected) return "";
  const { enemy, row } = selected;
  const control = (label, action, amount, extra = "") => `<button type="button" class="control-button ${extra}" data-action="${action}" data-amount="${amount}" data-enemy-id="${escapeHtml(enemy.id)}">${label}</button>`;
  return `
    <dialog class="control-dialog">
      <div class="panel-head"><div><p class="eyebrow">ROW ${row.id + 1} / ENEMY CONTROL</p><h2>${escapeHtml(enemy.name)}</h2></div><button class="icon-button" type="button" data-action="close-panel" aria-label="Close controls">×</button></div>
      ${enemy.isAlive ? `
        <section class="control-section"><div class="section-title"><h3>Health</h3><span>${enemy.health} / ${enemy.maxHealth}</span></div><div class="control-grid">${control("−1 damage", "damage", 1)}${control("−5 damage", "damage", 5)}${control("+1 heal", "heal", 1)}${control("+5 heal", "heal", 5)}</div><p class="control-hint">Damage removes block first. Healing stops at max health.</p></section>
        <section class="control-section"><div class="section-title"><h3>Block</h3><span>${enemy.block}</span></div><div class="control-grid">${control("−1", "block", -1)}${control("−5", "block", -5)}${control("+1", "block", 1)}${control("+5", "block", 5)}</div></section>
        <section class="control-section"><div class="section-title"><h3>Status effects</h3><span class="poison-budget">${state.poisonTotal} / 30 poison</span></div>${["vulnerable", "weak", "poison"].map((status) => `<div class="status-control"><span class="status-name status-${status}"><i></i>${status}<b>${enemy.statuses[status]}</b></span><span class="status-buttons">${control("−", "status-remove", status, "small-control")}${control("+", "status-add", status, "small-control")}</span></div>`).join("")}</section>
        <button class="danger-button" type="button" data-action="kill" data-enemy-id="${escapeHtml(enemy.id)}">Mark defeated</button>` : `
        <div class="resurrection-note"><span>✦</span><p>This enemy is defeated.<br>Resurrection restores full health in this lane.</p></div>
        <button class="primary-button resurrect-button" type="button" data-action="resurrect" data-enemy-id="${escapeHtml(enemy.id)}">Resurrect at full health</button>`}
      <p class="panel-foot">END TURN CLEARS BLOCK · POISON BYPASSES BLOCK</p>
    </dialog>`;
}

export class GameView {
  render(root, state) {
    const scrollPositions = new Map(Array.from(root.querySelectorAll?.(".battle-row") ?? [], (row) => [
      row.dataset.rowIndex, row.querySelector(".enemy-grid")?.scrollLeft ?? 0,
    ]));
    const currentRow = state.rows[state.activeRow];
    root.innerHTML = `
      <section class="game-screen ${state.zoomedOut ? "is-overview" : ""}">
        <header class="topbar">
          <a class="wordmark" href="#" aria-label="Spirekeeper home"><span class="wordmark-glyph">S</span><span>SPIREKEEPER<small>ENCOUNTER TRACKER</small></span></a>
          <div class="topbar-meta"><span class="turn-count"><small>TURN</small><b>${String(state.turn).padStart(2, "0")}</b></span><span class="poison-meter"><i aria-hidden="true">✳</i><span><b>${state.poisonTotal}</b><small> / 30 POISON</small></span><span class="poison-track"><i style="width:${Math.min(100, state.poisonTotal / 30 * 100)}%"></i></span></span><button class="icon-button fullscreen-button" type="button" data-action="fullscreen" aria-label="Enter full screen" title="Full screen">⛶</button></div>
        </header>
        <section class="encounter-toolbar">
          <div class="encounter-title"><span class="live-dot"></span><span><small>ACTIVE ENCOUNTER</small><strong>${state.zoomedOut ? "All rows" : `Row ${state.activeRow + 1} <i>/ ${state.rows.length}</i>`}</strong></span></div>
          <div class="toolbar-actions">
            <button class="secondary-button" type="button" data-action="get-enemies" ${state.enemiesLoaded ? "disabled" : ""}>Get enemies</button>
            ${state.canClearRows ? '<button class="secondary-button" type="button" data-action="clear-rows">Clear rows</button>' : ""}
            <button class="secondary-button overview-toggle" type="button" data-action="toggle-overview">${state.zoomedOut ? "Focus row" : "Show all rows"}</button>
            <button class="primary-button end-turn-button" type="button" data-action="end-turn">End turn <span aria-hidden="true">↗</span></button>
            <button class="leave-button" type="button" data-action="leave">Leave</button>
          </div>
        </section>
        <main class="battlefield">
          ${state.zoomedOut ? state.rows.map((row, index) => rowMarkup(row, index, state)).join("") : `
            <div class="row-switcher"><button class="nav-arrow" type="button" data-action="navigate" data-direction="-1" aria-label="Previous row" ${state.activeRow === 0 ? "disabled" : ""}>↑</button><span>ROW ${String(state.activeRow + 1).padStart(2, "0")} <i>OF</i> ${String(state.rows.length).padStart(2, "0")}</span><button class="nav-arrow" type="button" data-action="navigate" data-direction="1" aria-label="Next row" ${state.activeRow === state.rows.length - 1 ? "disabled" : ""}>↓</button></div>
            ${rowMarkup(currentRow, state.activeRow, state)}`}
          <footer class="battle-footer"><span>SPIREKEEPER <i>·</i> LOCAL SESSION</span><span>BLOCK RESETS ON TURN END <i>·</i> POISON IS TRUE DAMAGE</span></footer>
        </main>
        ${controlPanel(state)}
      </section>`;
    if (state.selectedEnemyId) root.querySelector(".control-dialog")?.showModal();
    for (const row of root.querySelectorAll?.(".battle-row") ?? []) {
      const grid = row.querySelector(".enemy-grid");
      if (grid) grid.scrollLeft = scrollPositions.get(row.dataset.rowIndex) ?? 0;
    }
  }
}
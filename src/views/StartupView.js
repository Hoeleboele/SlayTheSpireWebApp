import { MAX_ROWS } from "../config/gameConfig.js";

export class StartupView {
  render(root) {
    root.innerHTML = `
      <section class="start-screen">
        <div class="start-art" aria-hidden="true">
          <div class="spire-mark"><span></span><i></i><b></b></div>
          <p class="art-caption">THE ASCENT<br>IS NEVER QUIET</p>
        </div>
        <form class="start-panel" id="start-form">
          <p class="eyebrow">ENCOUNTER RECORD / 01</p>
          <h1>Spire<span>keeper</span></h1>
          <p class="intro-copy">Keep the battle in view. Track each enemy, every status, and the turn as it turns.</p>
          <label class="field-label" for="row-count">Enemy rows</label>
          <div class="stepper">
            <button class="step-button" type="button" data-action="rows-down" aria-label="Decrease row count">−</button>
            <input id="row-count" name="rowCount" type="number" min="1" max="${MAX_ROWS}" value="2" inputmode="numeric">
            <button class="step-button" type="button" data-action="rows-up" aria-label="Increase row count">+</button>
          </div>
          <div class="range-note"><span>1 ROW</span><span>MAX ${MAX_ROWS}</span></div>
          <button class="primary-button start-button" type="submit">Enter the encounter <span aria-hidden="true">↗</span></button>
          <p class="local-note">ENCOUNTER DATA STAYS ON THIS DEVICE</p>
        </form>
      </section>`;
  }
}
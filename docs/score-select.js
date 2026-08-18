// Touch-safe score picker for PuckBoss.
// No MutationObserver and no virtual keyboard: tapping a score opens a
// small native-looking touch keypad with values 0-10.
(() => {
  let activeInput = null;
  let keypad = null;

  function ensureKeypad() {
    if (keypad) return keypad;

    keypad = document.createElement("div");
    keypad.id = "puckbossKeypad";
    keypad.innerHTML = `
      <div class="pb-keypad-backdrop"></div>
      <div class="pb-keypad-panel" role="dialog" aria-label="Tipp auswählen">
        <div class="pb-keypad-title">Tore auswählen</div>
        <div class="pb-keypad-grid">
          ${Array.from({ length: 11 }, (_, value) => `<button type="button" class="pb-key" data-value="${value}">${value}</button>`).join("")}
        </div>
        <button type="button" class="pb-key-clear">Tipp löschen</button>
      </div>`;

    document.body.appendChild(keypad);

    keypad.addEventListener("pointerdown", event => {
      const key = event.target.closest(".pb-key");
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      if (!activeInput) return;
      activeInput.value = key.dataset.value;
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      closeKeypad();
    }, true);

    keypad.querySelector(".pb-key-clear").addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      if (activeInput) {
        activeInput.value = "";
        activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      closeKeypad();
    }, true);

    keypad.querySelector(".pb-keypad-backdrop").addEventListener("pointerdown", event => {
      event.preventDefault();
      closeKeypad();
    }, true);

    return keypad;
  }

  function openKeypad(input) {
    activeInput = input;
    input.readOnly = true;
    ensureKeypad().classList.add("open");
  }

  function closeKeypad() {
    if (keypad) keypad.classList.remove("open");
    activeInput = null;
  }

  // Capture the tap before the browser tries to focus the text input.
  // This prevents the iOS keyboard/focus problem entirely.
  document.addEventListener("pointerdown", event => {
    const input = event.target.closest?.("#tipsView .tip-input");
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    openKeypad(input);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeKeypad();
  });
})();

// Mobile-friendly score picker for PuckBoss.
// It avoids the iOS text-input/keyboard focus problem by using a touch keypad.
(() => {
  let activeInput = null;
  let keypad = null;

  function build() {
    if (keypad) return keypad;
    keypad = document.createElement("div");
    keypad.id = "puckbossKeypad";
    keypad.innerHTML = `
      <div class="pb-keypad-backdrop"></div>
      <div class="pb-keypad-panel" role="dialog" aria-label="Tipp auswählen">
        <div class="pb-keypad-title">Tore auswählen</div>
        <div class="pb-keypad-grid">
          ${Array.from({length: 11}, (_, i) => `<button type="button" class="pb-key" data-value="${i}">${i}</button>`).join("")}
        </div>
        <button type="button" class="pb-key-clear">Tipp löschen</button>
      </div>`;
    document.body.appendChild(keypad);

    keypad.addEventListener("pointerdown", e => {
      const key = e.target.closest(".pb-key");
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      if (!activeInput) return;
      const value = key.dataset.value;
      activeInput.value = value;
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      close();
    }, true);

    keypad.querySelector(".pb-key-clear").addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
      if (activeInput) {
        activeInput.value = "";
        activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      close();
    }, true);

    keypad.querySelector(".pb-keypad-backdrop").addEventListener("pointerdown", e => {
      e.preventDefault();
      close();
    }, true);

    return keypad;
  }

  function open(input) {
    activeInput = input;
    input.readOnly = true;
    build().classList.add("open");
  }

  function close() {
    if (keypad) keypad.classList.remove("open");
    activeInput = null;
  }

  document.addEventListener("pointerdown", e => {
    const input = e.target.closest?.("#tipsView .tip-input");
    if (!input) return;
    e.preventDefault();
    e.stopPropagation();
    open(input);
  }, true);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
  });
})();

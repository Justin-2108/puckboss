// Mobile-safe score selector.
// Replaces the editable text score fields with native <select> controls.
// Native selects are reliably tappable on iOS/Android and do not depend on
// the virtual keyboard. A hidden input mirrors the selected value so the
// existing save logic in app.js can remain unchanged.
(function () {
  const MAX_GOALS = 30;
  let observer = null;
  let busy = false;

  function makeSelect(input) {
    if (!input || input.dataset.scoreSelect === "true") return;

    const select = document.createElement("select");
    select.className = "score-select";
    select.dataset.id = input.dataset.id || "";
    select.dataset.side = input.dataset.side || "";
    select.setAttribute("aria-label", select.dataset.side === "home" ? "Heimtore" : "Auswärtstore");

    const current = String(input.value == null ? "" : input.value).trim();
    for (let value = 0; value <= MAX_GOALS; value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      if (String(value) === current || (current === "" && value === 0)) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    const mirror = document.createElement("input");
    mirror.type = "hidden";
    mirror.dataset.id = select.dataset.id;
    mirror.dataset.side = select.dataset.side;
    mirror.value = select.value;
    mirror.className = "score-mirror";

    select.addEventListener("change", () => {
      mirror.value = select.value;
    });

    input.replaceWith(select);
    select.after(mirror);
  }

  function convert() {
    if (busy) return;
    const container = document.getElementById("tipsView");
    if (!container) return;
    const inputs = container.querySelectorAll('input[type="text"][data-id][data-side]');
    if (!inputs.length) return;

    busy = true;
    inputs.forEach(makeSelect);
    busy = false;
  }

  function init() {
    const container = document.getElementById("tipsView");
    if (!container || observer) return;

    observer = new MutationObserver(() => {
      // Wait until app.js has finished inserting the whole game list.
      requestAnimationFrame(convert);
    });

    observer.observe(container, { childList: true, subtree: true });
    convert();
  }

  const wait = setInterval(() => {
    if (document.getElementById("tipsView")) {
      clearInterval(wait);
      init();
    }
  }, 100);
})();

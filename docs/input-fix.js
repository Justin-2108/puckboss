// Mobile tip-input guard.
// Keeps the user's draft and restores focus/value if another script redraws the tip list.
(() => {
  const drafts = new Map();
  let focusedKey = null;
  let restoring = false;

  function key(input) {
    return input && input.dataset && input.dataset.id
      ? input.dataset.id + ":" + (input.dataset.side || "")
      : null;
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!input.matches || !input.matches("#tipsView input")) return;
    const k = key(input);
    if (!k) return;
    drafts.set(k, input.value);
  }, true);

  document.addEventListener("focusin", (event) => {
    const input = event.target;
    if (!input.matches || !input.matches("#tipsView input")) return;
    focusedKey = key(input);
    const saved = drafts.get(focusedKey);
    if (saved !== undefined && input.value !== saved) input.value = saved;
  }, true);

  document.addEventListener("focusout", (event) => {
    const input = event.target;
    if (!input.matches || !input.matches("#tipsView input")) return;
    const k = key(input);
    if (k) drafts.set(k, input.value);
  }, true);

  const observer = new MutationObserver(() => {
    if (restoring || !focusedKey) return;
    const replacement = document.querySelector('#tipsView input[data-id][data-side]');
    if (!replacement) return;
    const candidates = document.querySelectorAll('#tipsView input[data-id][data-side]');
    let target = null;
    for (const input of candidates) {
      if (key(input) === focusedKey) {
        target = input;
        break;
      }
    }
    if (!target) return;
    const saved = drafts.get(focusedKey);
    restoring = true;
    if (saved !== undefined) target.value = saved;
    requestAnimationFrame(() => {
      if (document.activeElement !== target) target.focus({ preventScroll: true });
      restoring = false;
    });
  });

  observer.observe(document.getElementById("tipsView") || document.body, { childList: true, subtree: true });
})();

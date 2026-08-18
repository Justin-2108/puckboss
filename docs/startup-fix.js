// One-time startup recovery for the initial tips view.
// If the first render is interrupted by a Firebase/statistics request,
// retry the normal Tippen view once instead of leaving the user on an error card.
setTimeout(() => {
  const tipsView = document.getElementById("tipsView");
  const tipsButton = document.querySelector('.nav[data-view="tips"]');
  if (!tipsView || !tipsButton) return;
  if (tipsView.querySelector(".error")) {
    tipsButton.click();
  }
}, 1200);

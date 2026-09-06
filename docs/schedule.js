// PuckBoss schedule loader
//
// The official schedule and imported results in games.json are authoritative.
// Do NOT read the complete Firestore games collection here: doing so would
// consume one Firestore document read for every game on every page load.
// Firestore is reserved for user data (tips, league membership, etc.).

const originalFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!url.includes("data/games.json")) return originalFetch(input, init);
  return originalFetch(input, { ...(init || {}), cache: "no-store" });
};

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const scheduleApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const scheduleDb = getFirestore(scheduleApp);
const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!url.includes("data/games.json")) return originalFetch(input, init);

  // games.json is the authoritative schedule. Firestore only overlays
  // live result fields, so a stale Firestore schedule can never replace
  // newly imported dates/times from the official schedule.
  try {
    const response = await originalFetch(input, { ...(init || {}), cache: "no-store" });
    const games = await response.json();

    try {
      const snapshot = await getDocs(collection(scheduleDb, "games"));
      const firestoreGames = new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));

      const merged = games.map(game => {
        const live = firestoreGames.get(game.id);
        if (!live || live.homeScore == null || live.awayScore == null) return game;
        return {
          ...game,
          homeScore: live.homeScore,
          awayScore: live.awayScore,
          status: live.status || "finished",
          overtime: live.overtime === true
        };
      });

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.warn("Firestore-Ergebnisse nicht verfügbar, verwende games.json.", error);
      return new Response(JSON.stringify(games), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.warn("Spielplan konnte nicht geladen werden.", error);
    return originalFetch(input, init);
  }
};

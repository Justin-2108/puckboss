import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const scheduleApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const scheduleDb = getFirestore(scheduleApp);
const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!url.includes("data/games.json")) return originalFetch(input, init);

  try {
    const snapshot = await getDocs(collection(scheduleDb, "games"));
    if (!snapshot.empty) {
      const games = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      games.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      return new Response(JSON.stringify(games), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.warn("Firestore-Spielplan nicht verfügbar, verwende Fallback.", error);
  }

  return originalFetch(input, init);
};

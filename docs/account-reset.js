import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const KEY = "puckboss-last-auth-uid";

onAuthStateChanged(auth, currentUser => {
  const previousUid = sessionStorage.getItem(KEY);
  const currentUid = currentUser?.uid || "";

  if (previousUid && previousUid !== currentUid) {
    sessionStorage.setItem(KEY, currentUid);
    window.location.reload();
    return;
  }

  sessionStorage.setItem(KEY, currentUid);
});

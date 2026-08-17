import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let games = [];
let user = null;
let leagues = [];
let league = null;
let register = false;
let showCode = false;
let tipRefreshTimer = null;
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2500);
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function gameDate(game) {
  if (game.dateTime) return new Date(game.dateTime);
  if (game.date) {
    if (String(game.date).includes("T")) return new Date(game.date);
    return new Date(game.date + "T" + (game.time || "00:00"));
  }
  return new Date("");
}

function gameTime(game) {
  if (game.time) return game.time;
  const date = game.dateTime || game.date;
  if (!date || !String(date).includes("T")) return "";
  const match = String(date).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function locked(game) {
  return gameDate(game).getTime() <= Date.now();
}

function scheduleTipRefresh() {
  if (tipRefreshTimer) clearTimeout(tipRefreshTimer);
  tipRefreshTimer = null;
  if (!league) return;

  const upcoming = games
    .map(gameDate)
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > Date.now())
    .sort((a, b) => a - b)[0];

  if (!upcoming) return;

  const delay = Math.max(250, upcoming.getTime() - Date.now() + 250);
  tipRefreshTimer = setTimeout(async () => {
    tipRefreshTimer = null;
    if (league) await renderTips();
  }, delay);
}

async function loadGames() {
  try {
    const response = await fetch("data/games.json?v=" + Date.now(), { cache: "no-store" });
    games = await response.json();
  } catch (error) {
    games = [];
    console.error(error);
    toast("Spielplan konnte nicht geladen werden.");
  }
}

async function loadMemberships() {
  leagues = [];
  const snapshot = await getDocs(query(collection(db, "leagueMembers"), where("uid", "==", user.uid)));
  for (const member of snapshot.docs) {
    const data = member.data();
    const leagueSnapshot = await getDoc(doc(db, "leagues", data.leagueId));
    if (leagueSnapshot.exists()) leagues.push({ id: leagueSnapshot.id, ...leagueSnapshot.data() });
  }
  if (!league && leagues.length) league = leagues[0];
}

async function createLeague(name) {
  name = name.trim();
  if (name.length < 3) throw new Error("Der Liganame muss mindestens 3 Zeichen lang sein.");
  let code = makeCode();
  while ((await getDoc(doc(db, "leagueCodes", code))).exists()) code = makeCode();
  const ref = await addDoc(collection(db, "leagues"), { name, code, ownerUid: user.uid, createdAt: serverTimestamp() });
  await setDoc(doc(db, "leagueCodes", code), { leagueId: ref.id });
  await setDoc(doc(db, "leagueMembers", user.uid + "_" + ref.id), {
    uid: user.uid, leagueId: ref.id, displayName: user.displayName || user.email.split("@")[0], joinedAt: serverTimestamp()
  });
  league = { id: ref.id, name, code, ownerUid: user.uid };
  showCode = true;
  await loadMemberships();
  await renderLeague();
  toast("Liga erstellt.");
}

async function joinLeague(input) {
  const code = input.trim().toUpperCase();
  if (code.length !== 8) throw new Error("Der Einladungscode muss 8 Zeichen haben.");
  const codeSnapshot = await getDoc(doc(db, "leagueCodes", code));
  if (!codeSnapshot.exists()) throw new Error("Einladungscode nicht gefunden.");
  const leagueId = codeSnapshot.data().leagueId;
  const leagueSnapshot = await getDoc(doc(db, "leagues", leagueId));
  if (!leagueSnapshot.exists()) throw new Error("Liga nicht gefunden.");
  const data = leagueSnapshot.data();
  await setDoc(doc(db, "leagueMembers", user.uid + "_" + leagueId), {
    uid: user.uid, leagueId, displayName: user.displayName || user.email.split("@")[0], joinedAt: serverTimestamp()
  });
  league = { id: leagueId, ...data };
  showCode = false;
  await loadMemberships();
  await renderLeague();
  toast("Liga beigetreten.");
}

async function getTips() {
  if (!league) return {};
  const snapshot = await getDoc(doc(db, "leagueTips", league.id, "users", user.uid));
  return snapshot.exists() ? (snapshot.data().tips || {}) : {};
}

async function saveTips(tips) {
  await setDoc(doc(db, "leagueTips", league.id, "users", user.uid), {
    uid: user.uid, displayName: user.displayName || user.email.split("@")[0], tips, updatedAt: serverTimestamp()
  });
}

function points(tip, game) {
  if (!tip || tip.home == null || tip.away == null || game.homeScore == null) return 0;
  if (tip.home === game.homeScore && tip.away === game.awayScore) return 3;
  if (tip.home - tip.away === game.homeScore - game.awayScore) return 2;
  return Math.sign(tip.home - tip.away) === Math.sign(game.homeScore - game.awayScore) ? 1 : 0;
}

function gamesByDay() {
  const groups = new Map();
  games.forEach((game) => {
    const day = String(game.date || game.dateTime).slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(game);
  });
  groups.forEach((list) => list.sort((a, b) => gameDate(a) - gameDate(b)));
  return groups;
}

function logo(team) {
  const files = {
    "Eisbären Berlin": "assets/teams/eisbaeren-berlin.svg",
    "Straubing Tigers": "assets/teams/straubing-tigers.svg",
    "Kölner Haie": "assets/teams/koelner-haie.svg",
    "Grizzlys Wolfsburg": "assets/teams/grizzlys-wolfsburg.svg",
    "Nürnberg Ice Tigers": "assets/teams/nuernberg-ice-tigers.svg",
    "Augsburger Panther": "assets/teams/augsburger-panther.svg",
    "Krefeld Pinguine": "assets/teams/krefeld-pinguine.svg",
    "Pinguins Bremerhaven": "assets/teams/pinguins-bremerhaven.svg",
    "Iserlohn Roosters": "assets/teams/iserlohn-roosters.svg",
    "ERC Ingolstadt": "assets/teams/erc-ingolstadt.svg",
    "EHC Red Bull München": "assets/teams/ehc-red-bull-muenchen.svg",
    "Adler Mannheim": "assets/teams/adler-mannheim.svg",
    "Schwenninger Wild Wings": "assets/teams/schwenninger-wild-wings.svg",
    "Löwen Frankfurt": "assets/teams/loewen-frankfurt.svg"
  };
  return files[team] ? '<img class="team-logo" src="' + files[team] + '" alt="" onerror="this.style.display=\'none\'">' : "";
}

function team(teamName, right) {
  const image = logo(teamName);
  const name = '<span class="team-name">' + esc(teamName) + '</span>';
  return right ? name + image : image + name;
}

async function renderTips() {
  if (!league) {
    $("tipsView").innerHTML = '<div class="card">Erstelle zuerst eine Liga oder tritt einer Liga bei.</div>';
    scheduleTipRefresh();
    return;
  }
  const tips = await getTips();
  let html = "";
  gamesByDay().forEach((list, day) => {
    html += '<section class="gameGroup"><h2>' + new Date(day + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) + '</h2><div class="gameList">';
    list.forEach((game) => {
      const tip = tips[game.id] || {};
      const time = gameTime(game);
      html += '<div class="game"><div class="date"><b>' + esc(time) + '</b><small>Spiel ' + esc(game.round) + '</small></div>';
      html += '<div class="teams"><span class="team home-team">' + team(game.home, true) + '</span><span class="vs">vs.</span><span class="team away-team">' + team(game.away, false) + '</span></div><div class="score">';
      if (locked(game)) {
        html += '<div class="locked">' + (game.homeScore != null ? 'Endstand <b>' + game.homeScore + ':' + game.awayScore + '</b>' : 'Tipp geschlossen') + '</div>';
      } else {
        html += '<input type="number" min="0" max="30" data-id="' + esc(game.id) + '" data-side="home" value="' + (tip.home == null ? "" : tip.home) + '"><b>:</b><input type="number" min="0" max="30" data-id="' + esc(game.id) + '" data-side="away" value="' + (tip.away == null ? "" : tip.away) + '">';
      }
      html += '</div></div>';
    });
    html += '</div></section>';
  });
  html += '<div class="save"><button class="primary" id="saveAll">Tipps speichern</button></div>';
  $("tipsView").innerHTML = html;
  $("saveAll").onclick = async () => {
    const updated = Object.assign({}, tips);
    document.querySelectorAll("#tipsView input").forEach((input) => {
      if (!updated[input.dataset.id]) updated[input.dataset.id] = {};
      updated[input.dataset.id][input.dataset.side] = Number(input.value);
    });
    try { await saveTips(updated); toast("Tipps gespeichert."); await updateStats(); }
    catch (error) { console.error(error); toast("Tipps konnten nicht gespeichert werden."); }
  };
  scheduleTipRefresh();
}

async function ranking() {
  if (!league) return [];
  const snapshot = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", league.id)));
  const result = [];
  for (const member of snapshot.docs) {
    const data = member.data();
    const tipSnapshot = await getDoc(doc(db, "leagueTips", league.id, "users", data.uid));
    const tips = tipSnapshot.exists() ? (tipSnapshot.data().tips || {}) : {};
    let total = 0;
    let count = 0;
    games.forEach((game) => { total += points(tips[game.id], game); if (tips[game.id] && tips[game.id].home != null && tips[game.id].away != null) count++; });
    result.push({ uid: data.uid, name: data.displayName || "PuckBoss", points: total, count });
  }
  result.sort((a, b) => b.points - a.points || b.count - a.count || a.name.localeCompare(b.name));
  return result;
}

async function renderTable() {
  const list = await ranking();
  $("tableView").innerHTML = '<div class="card"><h2>' + esc(league ? league.name : "Rangliste") + '</h2><table class="table"><thead><tr><th>#</th><th>PuckBoss</th><th>Punkte</th><th>Tipps</th></tr></thead><tbody>' + list.map((entry, i) => '<tr class="' + (entry.uid === user.uid ? "me" : "") + '"><td>' + (i + 1) + '</td><td>' + esc(entry.name) + '</td><td><b>' + entry.points + '</b></td><td>' + entry.count + '</td></tr>').join("") + '</tbody></table></div>';
}

async function renderResults() {
  const tips = await getTips();
  const done = games.filter((game) => game.homeScore != null);
  if (!done.length) { $("resultsView").innerHTML = '<div class="card">Noch keine Ergebnisse vorhanden.</div>'; return; }
  $("resultsView").innerHTML = '<div class="card"><h2>Ergebnisse</h2>' + done.slice().reverse().map((game) => '<div class="result"><div>' + esc(game.date || "") + '<small>' + esc(gameTime(game)) + '</small></div><div class="teams"><span class="team">' + team(game.home, true) + '</span><span class="vs">vs.</span><span class="team">' + team(game.away, false) + '</span><br><b>' + game.homeScore + ':' + game.awayScore + '</b></div><div>' + (tips[game.id] ? 'Tipp ' + tips[game.id].home + ':' + tips[game.id].away + '<br><b>' + points(tips[game.id], game) + ' Punkte</b>' : 'Kein Tipp') + '</div></div>').join("") + '</div>';
}

async function updateStats() {
  if (!league) { $("tipCount").textContent = "0"; $("points").textContent = "0"; $("rank").textContent = "–"; return; }
  const tips = await getTips();
  const list = await ranking();
  let total = 0;
  games.forEach((game) => { total += points(tips[game.id], game); });
  $("tipCount").textContent = Object.keys(tips).length;
  $("points").textContent = total;
  const position = list.findIndex((entry) => entry.uid === user.uid);
  $("rank").textContent = position < 0 ? "–" : String(position + 1);
}

async function renderLeague() {
  $("leagueSelect").innerHTML = leagues.map((item) => '<option value="' + item.id + '">' + esc(item.name) + '</option>').join("");
  if (league) $("leagueSelect").value = league.id;
  $("leagueName").textContent = league ? league.name : "Keine Liga";
  $("leagueCode").textContent = showCode && league ? league.code : "••••••••";
  $("leagueBox").classList.toggle("hidden", !league);
  $("toggleCode").textContent = showCode ? "Verbergen" : "Anzeigen";
  await renderTips();
  await updateStats();
}

function view(name) {
  ["tips", "table", "results"].forEach((item) => $(item + "View").classList.toggle("hidden", item !== name));
  document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (name === "tips") renderTips();
  if (name === "table") renderTable();
  if (name === "results") renderResults();
}

function authMode(value) {
  register = value;
  $("loginTab").classList.toggle("active", !value);
  $("registerTab").classList.toggle("active", value);
  $("nameWrap").classList.toggle("hidden", !value);
  $("authSubmit").textContent = value ? "Registrieren" : "Anmelden";
}

$("loginTab").onclick = () => authMode(false);
$("registerTab").onclick = () => authMode(true);
$("authForm").onsubmit = async (event) => {
  event.preventDefault();
  $("authMessage").textContent = "";
  try {
    if (register) {
      const credential = await createUserWithEmailAndPassword(auth, $("email").value, $("password").value);
      await updateProfile(credential.user, { displayName: $("displayName").value.trim() || "PuckBoss" });
    } else {
      await signInWithEmailAndPassword(auth, $("email").value, $("password").value);
    }
  } catch (error) {
    console.error(error);
    $("authMessage").textContent = error.message.replace("Firebase: ", "");
  }
};
$("logoutBtn").onclick = async () => { showCode = false; league = null; leagues = []; if (tipRefreshTimer) clearTimeout(tipRefreshTimer); tipRefreshTimer = null; await signOut(auth); };
$("createLeague").onclick = async () => { try { await createLeague($("newLeagueName").value); $("newLeagueName").value = ""; } catch (error) { $("leagueMessage").textContent = error.message; } };
$("joinLeague").onclick = async () => { try { await joinLeague($("joinCode").value); $("joinCode").value = ""; } catch (error) { $("leagueMessage").textContent = error.message; } };
$("toggleCode").onclick = async () => { showCode = !showCode; await renderLeague(); };
$("copyCode").onclick = async () => { if (!league) return; await navigator.clipboard.writeText(league.code); showCode = true; await renderLeague(); toast("Einladungscode kopiert."); };
$("leagueSelect").onchange = async (event) => { league = leagues.find((item) => item.id === event.target.value) || null; showCode = false; await renderLeague(); };
document.querySelectorAll(".nav").forEach((button) => { button.onclick = () => view(button.dataset.view); });

onAuthStateChanged(auth, async (loggedInUser) => {
  user = loggedInUser;
  showCode = false;
  await loadGames();
  if (!user) {
    $("authCard").classList.remove("hidden");
    $("app").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    $("userLabel").textContent = "";
    return;
  }
  $("authCard").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("userLabel").textContent = user.displayName || user.email;
  try { await loadMemberships(); await renderLeague(); }
  catch (error) { console.error(error); $("leagueMessage").textContent = "Ligen konnten nicht geladen werden."; }
});

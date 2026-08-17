# PuckBoss

PENNY DEL Tippspiel 2026/27 mit persönlichen Tipps und privaten Tipp-Ligen.

## Funktionen
- Registrierung und Anmeldung per Firebase Authentication
- Tippabgabe bis zum Spielbeginn
- 3 Punkte für exaktes Ergebnis, 2 für richtige Tordifferenz, 1 für richtigen Spielausgang
- Eigene Tipp-Ligen erstellen
- 8-stellige Einladungscodes
- Mehrere Ligen pro Benutzer möglich
- Rangliste je Liga
- Ergebnisse und persönliche Punkte
- GitHub Pages als Frontend

## Einrichtung
1. Firebase-Projekt erstellen.
2. Authentication → E-Mail/Passwort aktivieren.
3. Firestore aktivieren.
4. Web-App anlegen.
5. Werte in `docs/firebase-config.js` eintragen.
6. `firestore.rules` in Firebase veröffentlichen.
7. GitHub Pages auf `main` und `/docs` stellen.

## Hinweis
Die Anwendung ist vorbereitet, aber ohne deine Firebase-Konfiguration können Benutzer, Ligen und Tipps noch nicht gespeichert werden.

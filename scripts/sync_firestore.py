import json
import os
from pathlib import Path
from google.cloud import firestore
from google.oauth2 import service_account

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data" / "games.json"


def main():
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT secret is missing")
    info = json.loads(raw)
    credentials = service_account.Credentials.from_service_account_info(info)
    project_id = info.get("project_id", "puckboss-7551e")
    db = firestore.Client(project=project_id, credentials=credentials)

    games = json.loads(DATA.read_text(encoding="utf-8"))
    batch = db.batch()
    count = 0
    for game in games:
        game = dict(game)
        game.setdefault("season", "2026/27")
        game.setdefault("phase", "regular")
        game.setdefault("status", "scheduled")
        game.setdefault("playoffRound", None)
        game.setdefault("seriesId", None)
        game.setdefault("gameNumber", None)
        ref = db.collection("games").document(game["id"])
        batch.set(ref, game, merge=True)
        count += 1
        if count == 400:
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()
    print(f"Synchronized {len(games)} games to Firestore.")


if __name__ == "__main__":
    main()

import json
import re
from datetime import datetime
from pathlib import Path
import requests
from pypdf import PdfReader

PDF_URL = "https://www.penny-del.org/fileadmin/user_upload/downloads/Spielplan_2026-27_260626.pdf"
OUTPUT = Path("docs/data/games.json")
SEASON = "2026/27"
TEAM_NAMES = {"Red Bull München": "EHC Red Bull München", "Schwenninger Willd Wings": "Schwenninger Wild Wings"}
TEAMS = {"Augsburger Panther", "Adler Mannheim", "Eisbären Berlin", "ERC Ingolstadt", "EHC Red Bull München", "Red Bull München", "Fischtown Pinguins", "Pinguins Bremerhaven", "Grizzlys Wolfsburg", "Iserlohn Roosters", "Kölner Haie", "Krefeld Pinguine", "Löwen Frankfurt", "Nürnberg Ice Tigers", "Schwenninger Wild Wings", "Schwenninger Willd Wings", "Straubing Tigers"}
DAYS = "Mo|Di|Mi|Do|Fr|Sa|So"
TEAM_PATTERN = "|".join(re.escape(team) for team in sorted(TEAMS, key=len, reverse=True))
GAME_PATTERN = re.compile(rf"(?P<round>\d{{1,2}})\s+(?P<date>\d{{2}}\.\d{{2}}\.\d{{2}})\s+(?P<day>{DAYS})\s+(?P<time>\d{{2}}:\d{{2}})\s+(?P<home>{TEAM_PATTERN})\s+(?P<away>{TEAM_PATTERN})")

def normalize_team(value):
    return TEAM_NAMES.get(" ".join(value.split()), " ".join(value.split()))

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

def make_regular_game_id(date, time, home, away):
    return f"regular-{date.isoformat()}-{time.replace(':', '')}-{slug(home)}-{slug(away)}"

def parse_pdf():
    response = requests.get(PDF_URL, timeout=60)
    response.raise_for_status()
    pdf_path = Path("/tmp/penny-del.pdf")
    pdf_path.write_bytes(response.content)
    reader = PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    text = re.sub(r"\s+", " ", text)
    games = []
    for match in GAME_PATTERN.finditer(text):
        data = match.groupdict()
        date = datetime.strptime(data["date"], "%d.%m.%y").date()
        time = data["time"]
        home = normalize_team(data["home"])
        away = normalize_team(data["away"])
        games.append({"id": make_regular_game_id(date, time, home, away), "season": SEASON, "phase": "regular", "round": int(data["round"]), "playoffRound": None, "seriesId": None, "gameNumber": None, "date": date.isoformat(), "dateTime": f"{date.isoformat()}T{time}:00", "time": time, "home": home, "away": away, "homeScore": None, "awayScore": None, "status": "scheduled"})
    return sorted({game["id"]: game for game in games}.values(), key=lambda game: game["dateTime"])

def preserve_existing_data(games):
    if not OUTPUT.exists():
        return games
    try:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return games
    old_by_key = {(x.get("date"), x.get("time"), x.get("home"), x.get("away")): x for x in existing if x.get("phase", "regular") == "regular"}
    for game in games:
        old = old_by_key.get((game["date"], game["time"], game["home"], game["away"]))
        if old:
            game["homeScore"] = old.get("homeScore")
            game["awayScore"] = old.get("awayScore")
            if old.get("status") not in (None, "scheduled"):
                game["status"] = old["status"]
    return games

def main():
    games = preserve_existing_data(parse_pdf())
    if len(games) < 350:
        raise RuntimeError(f"Nur {len(games)} Hauptrundenspiele erkannt. Import wird abgebrochen, damit kein fehlerhafter Spielplan veröffentlicht wird.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(games, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(games)} regular-season games for {SEASON}.")

if __name__ == "__main__":
    main()

import json
import re
from datetime import datetime
from pathlib import Path

import requests
from pypdf import PdfReader

PDF_URL = "https://www.penny-del.org/fileadmin/user_upload/downloads/Spielplan_2026-27_260626.pdf"
OUTPUT = Path("docs/data/games.json")
SEASON = "2026/27"

TEAM_NAMES = {
    "Red Bull München": "EHC Red Bull München",
    "Schwenninger Willd Wings": "Schwenninger Wild Wings",
}

TEAMS = {
    "Augsburger Panther", "Adler Mannheim", "Eisbären Berlin", "ERC Ingolstadt",
    "EHC Red Bull München", "Red Bull München", "Fischtown Pinguins", "Pinguins Bremerhaven",
    "Grizzlys Wolfsburg", "Iserlohn Roosters", "Kölner Haie", "Krefeld Pinguine",
    "Löwen Frankfurt", "Nürnberg Ice Tigers", "Schwenninger Wild Wings",
    "Schwenninger Willd Wings", "Straubing Tigers"
}

DAYS = "Mo|Di|Mi|Do|Fr|Sa|So"
TEAM_PATTERN = "|".join(re.escape(team) for team in sorted(TEAMS, key=len, reverse=True))
GAME_PATTERN = re.compile(
    rf"(?P<round>\d{{1,2}})\s+"
    rf"(?P<date>\d{{2}}\.\d{{2}}\.\d{{2}})\s+"
    rf"(?P<day>{DAYS})\s+"
    rf"(?P<time>\d{{2}}:\d{{2}})\s+"
    rf"(?P<home>{TEAM_PATTERN})\s+"
    rf"(?P<away>{TEAM_PATTERN})"
)


def normalize_team(value):
    return TEAM_NAMES.get(" ".join(value.split()), " ".join(value.split()))


def make_regular_game_id(home, away):
    slug = lambda value: re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return f"regular-{slug(home)}-{slug(away)}"


def parse_pdf():
    response = requests.get(PDF_URL, timeout=60)
    response.raise_for_status()
    pdf_path = Path("/tmp/penny-del.pdf")
    pdf_path.write_bytes(response.content)
    reader = PdfReader(str(pdf_path))

    # pypdf occasionally joins the last row of one PDF page with the first
    # row of the next page. Therefore we parse the complete extracted text
    # with one regex instead of relying on line boundaries.
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    text = re.sub(r"\s+", " ", text)

    games = []
    for match in GAME_PATTERN.finditer(text):
        data = match.groupdict()
        round_number = int(data["round"])
        date = datetime.strptime(data["date"], "%d.%m.%y").date()
        time = data["time"]
        home = normalize_team(data["home"])
        away = normalize_team(data["away"])
        dt = datetime.strptime(
            f"{date.isoformat()} {time}", "%Y-%m-%d %H:%M"
        ).isoformat()

        games.append({
            "id": make_regular_game_id(home, away),
            "season": SEASON,
            "phase": "regular",
            "round": round_number,
            "playoffRound": None,
            "seriesId": None,
            "gameNumber": None,
            "date": date.isoformat(),
            "dateTime": dt,
            "time": time,
            "home": home,
            "away": away,
            "homeScore": None,
            "awayScore": None,
            "status": "scheduled",
        })

    # Keep the first occurrence of each stable home/away pairing.
    unique = {game["id"]: game for game in games}
    result = sorted(unique.values(), key=lambda game: game["dateTime"])
    return result


def preserve_existing_data(games):
    if not OUTPUT.exists():
        return games

    try:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return games

    old_by_match = {
        (item.get("home"), item.get("away")): item
        for item in existing
        if item.get("phase", "regular") == "regular"
    }

    for game in games:
        old = old_by_match.get((game["home"], game["away"]))
        if not old:
            continue
        if old.get("homeScore") is not None:
            game["homeScore"] = old["homeScore"]
        if old.get("awayScore") is not None:
            game["awayScore"] = old["awayScore"]
        if old.get("status") not in (None, "scheduled"):
            game["status"] = old["status"]

    return games


def main():
    games = parse_pdf()

    # A complete PENNY DEL regular season has 52 rounds with 7 games each.
    # Never publish a partial/broken import.
    if len(games) < 350:
        raise RuntimeError(
            f"Nur {len(games)} Hauptrundenspiele erkannt. Import wird abgebrochen, "
            "damit kein fehlerhafter Spielplan veröffentlicht wird."
        )

    games = preserve_existing_data(games)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(games, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Imported {len(games)} regular-season games for {SEASON}.")
    print("Existing results/status values were preserved where the matchup was unchanged.")
    print("Playoff games use the same schema with phase='playoffs' and are added separately.")


if __name__ == "__main__":
    main()

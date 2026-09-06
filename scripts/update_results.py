import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SOURCE_URL = "https://www.penny-del.org/spiele"
DATA = Path("docs/data/games.json")
SEASON = "2026/27"

TEAM_NAMES = {
    "Augsburger Panther",
    "Adler Mannheim",
    "Eisbären Berlin",
    "ERC Ingolstadt",
    "EHC Red Bull München",
    "Pinguins Bremerhaven",
    "Grizzlys Wolfsburg",
    "Iserlohn Roosters",
    "Kölner Haie",
    "Krefeld Pinguine",
    "Löwen Frankfurt",
    "Nürnberg Ice Tigers",
    "Schwenninger Wild Wings",
    "Straubing Tigers",
}

TEAM_PATTERN = "|".join(re.escape(name) for name in sorted(TEAM_NAMES, key=len, reverse=True))
TEAM_RE = re.compile(rf"(?P<team>{TEAM_PATTERN})")
DATE_RE = re.compile(r"(?P<date>\d{2}\.\d{2}\.\d{4})")
TIME_RE = re.compile(r"(?P<time>\d{2}:\d{2})")
SCORE_RE = re.compile(r"(?P<home>\d{1,2})\s*-\s*(?P<away>\d{1,2})(?:\s*(?P<extra>OT|SO|n\.V\.|nV))?", re.IGNORECASE)


def clean(text):
    return " ".join(text.split())


def parse_source():
    response = requests.get(
        SOURCE_URL,
        timeout=60,
        headers={"User-Agent": "PuckBoss/1.0 (+https://justin-2108.github.io/puckboss/)"},
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    found = {}

    for row in soup.select("tr"):
        text = clean(row.get_text(" ", strip=True))
        date_match = DATE_RE.search(text)
        time_match = TIME_RE.search(text)
        if not date_match or not time_match:
            continue

        teams = [match.group("team") for match in TEAM_RE.finditer(text)]
        if len(teams) < 2:
            continue
        home, away = teams[0], teams[1]

        score_match = SCORE_RE.search(text)
        if not score_match:
            continue

        date = date_match.group("date")
        iso_date = f"{date[6:10]}-{date[3:5]}-{date[0:2]}"
        key = (iso_date, time_match.group("time"), home, away)
        found[key] = {
            "homeScore": int(score_match.group("home")),
            "awayScore": int(score_match.group("away")),
            "overtime": bool(score_match.group("extra")),
        }

    return found


def main():
    games = json.loads(DATA.read_text(encoding="utf-8"))
    results = parse_source()
    changed = 0

    for game in games:
        if game.get("season") != SEASON or game.get("phase", "regular") != "regular":
            continue
        key = (game.get("date"), game.get("time"), game.get("home"), game.get("away"))
        result = results.get(key)
        if not result:
            continue

        if (
            game.get("homeScore") != result["homeScore"]
            or game.get("awayScore") != result["awayScore"]
            or game.get("status") != "finished"
            or game.get("overtime", False) != result["overtime"]
        ):
            game["homeScore"] = result["homeScore"]
            game["awayScore"] = result["awayScore"]
            game["status"] = "finished"
            game["overtime"] = result["overtime"]
            changed += 1

    DATA.write_text(json.dumps(games, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Found {len(results)} completed PENNY DEL games on the official site.")
    print(f"Updated {changed} games in {DATA}.")


if __name__ == "__main__":
    main()

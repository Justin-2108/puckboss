import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DATA = Path("docs/data/games.json")
SEASON = "2026/27"
BASE_URL = "https://www.penny-del.org/teams/{slug}/spielplan"

TEAM_SLUGS = {
    "Augsburger Panther": "augsburger-panther",
    "Adler Mannheim": "adler-mannheim",
    "Eisbären Berlin": "eisbaeren-berlin",
    "ERC Ingolstadt": "erc-ingolstadt",
    "EHC Red Bull München": "ehc-red-bull-muenchen",
    "Pinguins Bremerhaven": "pinguins-bremerhaven",
    "Grizzlys Wolfsburg": "grizzlys-wolfsburg",
    "Iserlohn Roosters": "iserlohn-roosters",
    "Kölner Haie": "koelner-haie",
    "Krefeld Pinguine": "krefeld-pinguine",
    "Löwen Frankfurt": "loewen-frankfurt",
    "Nürnberg Ice Tigers": "nuernberg-ice-tigers",
    "Schwenninger Wild Wings": "schwenninger-wild-wings",
    "Straubing Tigers": "straubing-tigers",
}

TEAM_NAMES = set(TEAM_SLUGS)
TEAM_PATTERN = "|".join(re.escape(name) for name in sorted(TEAM_NAMES, key=len, reverse=True))
TEAM_RE = re.compile(rf"(?P<team>{TEAM_PATTERN})")
DATE_RE = re.compile(r"(?P<date>\d{2}\.\d{2}\.\d{4})")
SCORE_RE = re.compile(
    r"(?P<home>\d{1,2})\s*[-:]\s*(?P<away>\d{1,2})"
    r"(?:\s*\((?P<details>[^)]*)\))?"
)


def clean(text):
    return " ".join(text.split())


def iso_date(date):
    return f"{date[6:10]}-{date[3:5]}-{date[0:2]}"


def parse_team_page(session, team_name, slug):
    url = BASE_URL.format(slug=slug)
    response = session.get(url, timeout=60)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    found = {}

    # Team schedule pages contain one game per table row. Unlike /spiele,
    # completed games are rendered with their final score in the HTML.
    for row in soup.select("tr"):
        text = clean(row.get_text(" ", strip=True))
        date_match = DATE_RE.search(text)
        if not date_match:
            continue

        teams = [match.group("team") for match in TEAM_RE.finditer(text)]
        if len(teams) < 2:
            continue

        score_match = SCORE_RE.search(text)
        if not score_match:
            continue

        home, away = teams[0], teams[1]
        details = (score_match.group("details") or "").upper()
        overtime = "OT" in details or "SO" in details or "N.V." in details or "NV" in details

        key = (iso_date(date_match.group("date")), home, away)
        found[key] = {
            "homeScore": int(score_match.group("home")),
            "awayScore": int(score_match.group("away")),
            "overtime": overtime,
        }

    return found


def parse_source():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "PuckBoss/1.0 (+https://justin-2108.github.io/puckboss/)"
    })

    found = {}
    errors = []

    for team_name, slug in TEAM_SLUGS.items():
        try:
            found.update(parse_team_page(session, team_name, slug))
        except Exception as error:
            errors.append(f"{team_name}: {error}")

    if errors:
        print("Warnings while reading official team schedules:")
        for error in errors:
            print(f"  - {error}")

    return found


def main():
    games = json.loads(DATA.read_text(encoding="utf-8"))
    results = parse_source()
    changed = 0

    for game in games:
        if game.get("season") != SEASON or game.get("phase", "regular") != "regular":
            continue

        key = (game.get("date"), game.get("home"), game.get("away"))
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

    DATA.write_text(
        json.dumps(games, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Found {len(results)} completed PENNY DEL games on the official team schedules.")
    print(f"Updated {changed} games in {DATA}.")


if __name__ == "__main__":
    main()

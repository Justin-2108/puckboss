import json
import re
from datetime import datetime
from pathlib import Path

import requests
from pypdf import PdfReader

PDF_URL = "https://www.penny-del.org/fileadmin/user_upload/downloads/Spielplan_2026-27_260626.pdf"
OUTPUT = Path("docs/data/games.json")

TEAM_NAMES = {
    "Red Bull München": "EHC Red Bull München",
    "Schwenninger Willd Wings": "Schwenninger Wild Wings",
}

DATE_RE = re.compile(r"^(\d{2}\.\d{2}\.\d{2})$")
TIME_RE = re.compile(r"^(\d{2}:\d{2})$")
ROUND_RE = re.compile(r"^(\d{1,2})$")
TEAMS = {
    "Augsburger Panther", "Adler Mannheim", "Eisbären Berlin", "ERC Ingolstadt",
    "EHC Red Bull München", "Red Bull München", "Fischtown Pinguins", "Pinguins Bremerhaven",
    "Grizzlys Wolfsburg", "Iserlohn Roosters", "Kölner Haie", "Krefeld Pinguine",
    "Löwen Frankfurt", "Nürnberg Ice Tigers", "Schwenninger Wild Wings",
    "Schwenninger Willd Wings", "Straubing Tigers"
}

def normalize_team(value):
    value = " ".join(value.split())
    return TEAM_NAMES.get(value, value)

def is_team(value):
    return normalize_team(value) in {normalize_team(x) for x in TEAMS}

def parse_pdf():
    response = requests.get(PDF_URL, timeout=60)
    response.raise_for_status()
    pdf_path = Path("/tmp/penny-del.pdf")
    pdf_path.write_bytes(response.content)
    reader = PdfReader(str(pdf_path))

    games = []
    current_round = None
    current_date = None
    lines = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines.extend(line.strip() for line in text.splitlines() if line.strip())

    i = 0
    while i < len(lines):
        line = lines[i]
        if ROUND_RE.match(line) and i + 1 < len(lines) and DATE_RE.match(lines[i + 1]):
            current_round = int(line)
            i += 1
            line = lines[i]
        if DATE_RE.match(line):
            current_date = datetime.strptime(line, "%d.%m.%y").date()
            i += 1
            if i >= len(lines):
                break
            if lines[i] in {"Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"}:
                i += 1
            if i >= len(lines) or not TIME_RE.match(lines[i]):
                continue
            time = lines[i]
            i += 1
            if i + 1 >= len(lines):
                break
            home = normalize_team(lines[i])
            away = normalize_team(lines[i + 1])
            if is_team(home) and is_team(away):
                dt = datetime.strptime(
                    f"{current_date.isoformat()} {time}", "%Y-%m-%d %H:%M"
                ).isoformat()
                games.append({
                    "id": f"{current_date.isoformat()}-{time.replace(':', '')}-{home}-{away}".lower().replace(" ", "-"),
                    "date": current_date.isoformat(),
                    "dateTime": dt,
                    "time": time,
                    "round": current_round,
                    "home": home,
                    "away": away,
                    "homeScore": None,
                    "awayScore": None,
                })
                i += 2
                continue
        i += 1

    unique = {game["id"]: game for game in games}
    result = list(unique.values())
    result.sort(key=lambda game: game["dateTime"])
    return result


def main():
    games = parse_pdf()
    if len(games) < 300:
        raise RuntimeError(f"Nur {len(games)} Spiele erkannt. Import wird abgebrochen, damit kein fehlerhafter Spielplan veröffentlicht wird.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(games, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(games)} games from the official PENNY DEL schedule.")

if __name__ == "__main__":
    main()

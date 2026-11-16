"""Build a daily NFL matchup research board from published player logs.

No sportsbook prices or claimed winning probabilities are generated.
The ESPN scoreboard is a public, unofficial endpoint; availability may change.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
STATS = ROOT / "data" / "stats.json"
OUTPUT = ROOT / "data" / "game-picks.json"
UK = ZoneInfo("Europe/London")
# ESPN and nflverse use slightly different abbreviations for some teams.
ALIASES = {"WSH": "WAS", "LAR": "LA", "JAX": "JAC", "NYJ": "NYJ", "NYG": "NYG"}
MARKETS = {
    "QB": [("passing_yards", (150, 175, 200, 225, 250), "passing yards"),
           ("completions", (12, 15, 18, 20), "completions")],
    "RB": [("rushing_yards", (20, 30, 40, 50, 60, 70), "rushing yards"),
           ("receptions", (2, 3, 4), "receptions")],
    "WR": [("receiving_yards", (20, 30, 40, 50, 60, 70), "receiving yards"),
           ("receptions", (2, 3, 4, 5), "receptions")],
    "TE": [("receiving_yards", (15, 20, 30, 40, 50), "receiving yards"),
           ("receptions", (2, 3, 4), "receptions")],
}

def fetch_day(date):
    endpoint = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=" + date.strftime("%Y%m%d")
    req = Request(endpoint, headers={"User-Agent": "EdgeCheck/1.0 (NFL matchup research)", "Accept": "application/json"})
    with urlopen(req, timeout=30) as response:
        return json.load(response).get("events", [])

def team_code(competitor):
    team = competitor.get("team", {})
    return ALIASES.get(team.get("abbreviation", ""), team.get("abbreviation", ""))

def fixtures(now):
    today = now.astimezone(UK).date()
    found = {}
    # An evening US game can be after midnight in the UK.
    for offset in (-1, 0, 1, 2):
        for event in fetch_day(today + timedelta(days=offset)):
            try:
                kickoff = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
                if kickoff.astimezone(UK).date() != today:
                    continue
                teams = event["competitions"][0]["competitors"]
                home = next(x for x in teams if x["homeAway"] == "home")
                away = next(x for x in teams if x["homeAway"] == "away")
                found[event["id"]] = {
                    "id": str(event["id"]), "kickoff": kickoff.isoformat(),
                    "home": home["team"]["displayName"],
                    "away": away["team"]["displayName"],
                    "home_code": team_code(home), "away_code": team_code(away)
                }
            except (KeyError, IndexError, StopIteration, ValueError, TypeError):
                continue
    return sorted(found.values(), key=lambda g: g["kickoff"])

def candidate(player, most_recent_week):
    games = player.get("games", [])
    if len(games) < 5 or not player.get("team") or not player.get("name"):
        return None
    if most_recent_week - int(games[0].get("week", 0)) > 2:
        return None
    position = player.get("position")
    if position == "FB":
        position = "RB"
    available = MARKETS.get(position, [])
    options = []
    for field, lines, description in available:
        last5 = [g[field] for g in games[:5] if g.get(field) is not None]
        last10 = [g[field] for g in games[:10] if g.get(field) is not None]
        if len(last5) != 5 or len(last10) < 5:
            continue
        for line in lines:
            hits5 = sum(float(value) >= line for value in last5)
            hits10 = sum(float(value) >= line for value in last10)
            if hits5 < 4 or hits10 / len(last10) < 0.6:
                continue
            # Higher of several consistently-hit thresholds, without claiming probability.
            options.append((hits5, hits10 / len(last10), line, field, description))
    if not options:
        return None
    hits5, rate10, line, field, description = max(options, key=lambda v: (v[0], v[1], v[2]))
    return {
        "player": player["name"], "team": player["team"], "label": f"{line}+ {description}",
        "market": field, "line": line, "hits": hits5, "sample": 5,
        "hits_10_rate": round(rate10 * 100), "player_id": player["id"],
    }

def build(stats, games):
    players = stats.get("players", [])
    latest_week = max((int(g.get("week", 0)) for p in players for g in p.get("games", [])), default=0)
    for game in games:
        allowed = {game["home_code"], game["away_code"]}
        suggestions = [candidate(p, latest_week) for p in players if p.get("team") in allowed]
        suggestions = [s for s in suggestions if s]
        suggestions.sort(key=lambda s: (-s["hits"], -s["hits_10_rate"], s["player"]))
        game["suggestions"] = suggestions[:5]
        game.pop("home_code")
        game.pop("away_code")
    return games

def main():
    now = datetime.now(timezone.utc)
    with STATS.open(encoding="utf-8") as f:
        stats = json.load(f)
    if not stats.get("players"):
        raise RuntimeError("No player stats available; refusing to publish an empty research board.")
    games = fixtures(now)
    output = {
        "date_uk": now.astimezone(UK).date().isoformat(),
        "updated_at": now.isoformat(),
        "source": "ESPN NFL scoreboard (unofficial public endpoint) and nflverse weekly player logs",
        "methodology": "Last five games 4/5+, last ten games at least 60%; historical filters, not betting probabilities.",
        "games": build(stats, games),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Wrote {len(games)} UK-date NFL fixtures to {OUTPUT}")

if __name__ == "__main__":
    main()

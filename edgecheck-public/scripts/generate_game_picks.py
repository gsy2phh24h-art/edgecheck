"""Build a daily NFL matchup research board from published player logs.

No sportsbook prices or claimed winning probabilities are generated.
The ESPN scoreboard is a public, unofficial endpoint; availability may change.
"""
import json
import re
import unicodedata
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
    "QB": [("passing_yards", (175, 200, 225, 250, 275), "passing yards"),
           ("completions", (18, 20, 22, 25), "completions")],
    "RB": [("rushing_yards", (40, 50, 60, 70, 80), "rushing yards"),
           ("receptions", (3, 4, 5), "receptions")],
    "WR": [("receiving_yards", (40, 50, 60, 70, 80, 90), "receiving yards"),
           ("receptions", (3, 4, 5, 6), "receptions")],
    "TE": [("receiving_yards", (25, 30, 40, 50, 60), "receiving yards"),
           ("receptions", (3, 4, 5), "receptions")],
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
    for offset in range(-1, 9):
        for event in fetch_day(today + timedelta(days=offset)):
            try:
                kickoff = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
                # Only show fixtures with kickoffs in the next seven days.
                # This includes US Monday-night games after UK midnight.
                if not (now <= kickoff <= now + timedelta(days=7)):
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


def normalise(name):
    value = unicodedata.normalize("NFKD", name or "")
    return re.sub(r"[^a-z0-9]", "", value.lower())

def current_roster(code):
    """Current-team roster; fail closed if this source is unavailable."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{code.lower()}/roster"
    req = Request(url, headers={"User-Agent": "EdgeCheck/1.1", "Accept": "application/json"})
    with urlopen(req, timeout=25) as response:
        data = json.load(response)
    players = {}
    def visit(node):
        if isinstance(node, list):
            for item in node:
                visit(item)
        elif isinstance(node, dict):
            if node.get("displayName") and (node.get("position") or node.get("jersey")):
                name = normalise(node.get("displayName"))
                status = node.get("status")
                if isinstance(status, dict):
                    status = status.get("name") or status.get("type") or ""
                status = str(status or "").lower()
                if name:
                    players[name] = status
            for key in ("athletes", "items"):
                if key in node:
                    visit(node[key])
    visit(data.get("athletes", []))
    if len(players) < 15:
        raise RuntimeError(f"ESPN roster for {code} returned only {len(players)} athletes")
    return players

def defensive_context(stats):
    """Directional opponent totals from available weekly offensive player logs."""
    week_teams = {}
    for p in stats.get("players", []):
        team = p.get("team")
        if not team:
            continue
        for g in p.get("games", []):
            opp = g.get("opponent")
            week = g.get("week")
            if not opp or opp == "?" or not week:
                continue
            group = week_teams.setdefault((team, week, opp), {"passing": 0.0, "rushing": 0.0})
            if p.get("position") == "QB":
                group["passing"] = max(group["passing"], float(g.get("passing_yards") or 0))
            group["rushing"] += float(g.get("rushing_yards") or 0)
    allowed = {}
    for (_team, _week, opp), totals in week_teams.items():
        allowed.setdefault(opp, []).append(totals)
    context = {}
    for team, games in allowed.items():
        if len(games) >= 5:
            context[team] = {
                "pass_yards_allowed_avg": round(sum(g["passing"] for g in games) / len(games)),
                "rush_yards_allowed_avg": round(sum(g["rushing"] for g in games) / len(games)),
                "sample_games": len(games),
            }
    return context

def candidate(player, most_recent_week):
    """Produce a balanced and a higher-risk statistical target without implying true odds."""
    games = player.get("games", [])
    if len(games) < 5 or not player.get("team") or not player.get("name"):
        return None
    if most_recent_week - int(games[0].get("week", 0)) > 2:
        return None
    position = "RB" if player.get("position") == "FB" else player.get("position")
    available = MARKETS.get(position, [])
    candidates = []
    for field, lines, description in available:
        recent5 = [g.get(field) for g in games[:5]]
        recent10 = [g.get(field) for g in games[:10]]
        if any(v is None for v in recent5) or len(recent10) < 7 or any(v is None for v in recent10):
            continue
        avg5 = sum(float(v) for v in recent5) / 5
        for line in lines:
            hits5 = sum(float(v) >= line for v in recent5)
            hits10 = sum(float(v) >= line for v in recent10)
            rate10 = hits10 / len(recent10)
            # These labels describe historical difficulty, not forecast probabilities.
            tier = "balanced" if hits5 >= 3 and rate10 >= 0.55 else (
                "higher" if hits5 >= 2 and rate10 >= 0.40 else None)
            if not tier:
                continue
            # Prefer a substantial target close to recent average over a tiny 5/5 line.
            closeness = min(line / max(avg5, 1), 1.5)
            score = (closeness * 10) + (line / max(lines) * 4) + rate10 * 2
            candidates.append({
                "player": player["name"], "team": player["team"],
                "label": f"{line}+ {description}", "market": field, "line": line,
                "hits": hits5, "sample": 5, "hits_10_rate": round(rate10 * 100),
                "player_id": player["id"], "risk_tier": tier,
                "score": round(score, 2),
            })
    if not candidates:
        return None
    choices = {}
    for tier in ("balanced", "higher"):
        eligible = [v for v in candidates if v["risk_tier"] == tier]
        if eligible:
            # Don't simply rank by 5/5 hit rate; favour more meaningful targets.
            choices[tier] = max(eligible, key=lambda x: (x["score"], x["line"]))
    if not choices:
        return None
    return choices

def build(stats, games):
    players = stats.get("players", [])
    latest_week = max((int(g.get("week", 0)) for p in players for g in p.get("games", [])), default=0)
    defence = defensive_context(stats)
    roster_cache = {}
    unavailable = {"out", "injured reserve", "ir", "inactive", "suspended", "questionable", "doubtful", "physically unable to perform", "pup"}
    for game in games:
        home = game["home_code"]
        away = game["away_code"]
        game["defensive_context"] = {
            home: defence.get(home), away: defence.get(away)
        }
        game["context_note"] = "Defensive averages are approximate, derived from published opponent player logs, not official team rankings."
        verified = {}
        errors = []
        for code in (home, away):
            if code not in roster_cache:
                try:
                    roster_cache[code] = current_roster(code)
                except Exception as exc:
                    print(f"Roster lookup failed for {code}: {exc}")
                    roster_cache[code] = None
            verified[code] = roster_cache[code]
            if verified[code] is None:
                errors.append(f"{code} roster unavailable")
        suggestions = []
        for p in players:
            team = p.get("team")
            if team not in (home, away):
                continue
            roster = verified.get(team)
            if roster is None:
                continue
            name = normalise(p.get("name"))
            if name not in roster:
                continue
            status = roster[name]
            if any(flag in status for flag in unavailable):
                continue
            items = candidate(p, latest_week)
            if items:
                for tier, item in items.items():
                    item["roster_verified"] = True
                    item["availability_note"] = "Team roster verified. Game-day injury and active status must still be checked."
                    item["opponent"] = away if team == home else home
                    suggestions.append(item)
        for tier, field in (("balanced", "suggestions"), ("higher", "higher_risk_suggestions")):
            eligible = [s for s in suggestions if s["risk_tier"] == tier]
            eligible.sort(key=lambda s: (-s["score"], -s["line"], s["player"]))
            game[field] = eligible[:5]
        game["verification_note"] = "; ".join(errors) if errors else "Players checked against current team rosters; injuries and game-day actives not fully verified."
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
        "methodology": "Balanced: 3/5+ recent hits and 55%+ across available last ten; higher risk: 2/5+ and 40%+. Both favour more meaningful thresholds. These are historical filters, not predicted probabilities; game-day actives still require checking.",
        "games": build(stats, games),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Wrote {len(games)} upcoming NFL fixtures to {OUTPUT}")

if __name__ == "__main__":
    main()

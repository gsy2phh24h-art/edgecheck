"""Daily NFL stats exporter. Uses the live nflverse stats_player weekly CSV release."""
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SEASON = int(os.environ.get('NFL_SEASON', datetime.now(timezone.utc).year))
URL = f'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{SEASON}.csv'
FIELDS = ('passing_yards','receiving_yards','rushing_yards','passing_tds','receiving_tds','rushing_tds','receptions','completions','attempts','carries')


def number(value):
    if value is None or str(value).strip() in ('', 'NA', 'NaN', 'null'):
        return None
    try:
        return float(value) if '.' in str(value) else int(value)
    except (ValueError, TypeError):
        return None


def main():
    print('Downloading', URL)
    request = Request(URL, headers={'User-Agent': 'EdgeCheck-Stats/1.0'})
    with urlopen(request, timeout=90) as response:
        content = response.read().decode('utf-8-sig')
    rows = csv.DictReader(io.StringIO(content))
    players = {}
    for row in rows:
        if row.get('season_type') not in (None, '', 'REG'):
            continue
        pid = row.get('player_id') or row.get('player_gsis_id')
        name = row.get('player_display_name') or row.get('player_name')
        if not pid or not name:
            continue
        pos = row.get('position') or ''
        if pos not in ('QB', 'RB', 'WR', 'TE', 'FB'):
            continue
        week = number(row.get('week'))
        if week is None:
            continue
        key = str(pid)
        entry = players.setdefault(key, {'id': key, 'name': name, 'team': row.get('team') or row.get('recent_team') or '', 'position': pos, 'games': []})
        entry['team'] = row.get('team') or row.get('recent_team') or entry['team']
        game = {'week': int(week), 'opponent': row.get('opponent_team') or '?'}
        game.update({field: number(row.get(field)) for field in FIELDS})
        entry['games'].append(game)
    result = []
    for p in players.values():
        p['games'].sort(key=lambda x: x['week'], reverse=True)
        if p['games']:
            result.append(p)
    result.sort(key=lambda p: p['name'])
    if len(result) < 100:
        raise RuntimeError(f'Only {len(result)} players: refusing to replace existing stats.')
    payload = {'season': SEASON, 'updated_at': datetime.now(timezone.utc).isoformat(), 'source': URL, 'players': result}
    target = Path(__file__).resolve().parents[1] / 'data' / 'stats.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
    print(f'Wrote {len(result)} players to {target}')


if __name__ == '__main__':
    main()

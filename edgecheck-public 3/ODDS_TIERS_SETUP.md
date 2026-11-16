# EdgeCheck: decimal-odds suggestions

## What this update does
Four tabs: around 2.00 (1.80–2.25), 3.00 (2.70–3.35), 4.00 (3.60–4.45), and 6.00 (5.40–6.65). Only shows time-stamped bet365 quotes from an authorised feed; expires after 10 minutes, kickoff or supplied expiry. There is **no automatic odds feed included** and no demonstration odds passed off as real.

## Feed contract
Place `verified-odds.json` into `edgecheck-public/data/` with this shape:

```json
{
  "date_uk": "YYYY-MM-DD",
  "updated_at": "ISO-8601 timestamp",
  "offers": [
    {
      "game": "Away at Home",
      "title": "Suggested bet builder",
      "legs": ["Player A 40+ receiving yards", "Player B 50+ rushing yards"],
      "decimal_odds": 3.05,
      "bookmaker": "bet365",
      "status": "verified",
      "source_name": "Permitted bet365-licensed odds provider",
      "source_reference": "Provider event+market+quote reference",
      "checked_at": "ISO-8601 timestamp",
      "kickoff": "ISO-8601 timestamp",
      "expires_at": "ISO-8601 timestamp",
      "bet365_url": "https://www.bet365.com/"
    }
  ]
}
```

Do not mark offers verified merely because someone entered odds manually. The upstream data process must confirm that the *combined bet-builder price* is quoted by a permitted provider and that all legs refer to the same event. The site cannot independently authenticate arbitrary JSON content, so protect the publishing pipeline. Scheduled stat refresh does NOT provide bet365 odds. Bet365 links open its site but do not fill a slip.

# UK bookmaker price comparison

EdgeCheck now has a private serverless price comparison endpoint at `/api/compare-odds` and a **Compare UK bookmaker prices** button on upcoming NFL matchups.

## Activation (one-time)

1. Register with [The Odds API](https://the-odds-api.com/).
2. Check the subscription covers **NFL player props**, **UK bookmaker feeds**, and **bookmaker event/market/selection links**, and that public display of prices is permitted.
3. In Vercel, open the EdgeCheck project → Settings → Environment Variables.
4. Add **`THE_ODDS_API_KEY`** with the provider's key for **Production**. Keep it private; never commit the key to GitHub or include it in a URL.
5. Redeploy the latest production build from Vercel so the serverless function sees the environment variable.
6. Open an upcoming game and click **Compare UK bookmaker prices**.

The comparison only displays an exact match between the selected player, stat market, and threshold (e.g. 40+ rushing yards = Over 39.5). Quotes must have been checked within 30 minutes and are ordered by decimal odds. If no UK prices or direct links are supplied, the site says so instead of inventing them.

**Data coverage warning:** The Odds API documents that player-prop coverage is primarily US bookmakers. UK NFL player props and alternate lines may be absent even with a paid key. Verify with the provider before purchasing.

## Security and limitations

- Only the serverless function calls The Odds API; browsers cannot see the private API key.
- A public serverless endpoint can consume provider credits, so monitor quota and traffic.
- The odds service may link to a selection, market, event, or nothing. It must never claim an event link automatically places a bet.
- No bookmaker prices are shown before activating a valid API key.
- Quotes change and are not assurances of availability or winnings.
- Users must be adults and comply with local laws. The site should be reviewed for UK gambling advertising compliance before promotion or monetisation.

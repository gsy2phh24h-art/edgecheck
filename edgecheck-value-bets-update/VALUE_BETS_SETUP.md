# Today’s value bets setup

This feature is included in EdgeCheck but **does not contain live bet365 odds** until a licensed/authorised feed is connected. Do not scrape bet365. Its terms prohibit scraping and use of unauthorised automated systems.

The website fetches `/data/value-bets.json`. It safely shows an empty state until validated quote entries are supplied. Quote entries require `selection`, `event`, `sport`, `bookmaker` (`bet365`), `decimal_odds` (number), `fair_probability` (number from 0 to 1), `quoted_at`, `starts_at`, `expires_at` (ISO 8601 time strings), `source` (named permitted provider), and `methodology` (independent, explained estimate). Optional `authorised_selection_url` must be an approved bet365 HTTPS link. Otherwise only the bet365 home page is linked.

The site automatically hides entries more than two hours after the quote, entries for events outside today's UK calendar day, and entries past expiry. It calculates edge as `(probability × decimal odds - 1) × 100` and does not infer fair probabilities from five-game hit rates. A bookmaker's quoted odds are not a probability estimate.

To publish automatically, contract with a provider which explicitly licenses redistribution of bet365 NFL player-prop prices and linking; implement a secure server-side integration that updates the JSON and creates audited probability estimates. Check coverage for your markets before purchase. Do not store API keys in browser JavaScript or public JSON.

## Upload on GitHub

Your Vercel root directory is `edgecheck-public`, within repository `edgecheck`. Upload the updated `index.html`, `app.js`, `styles.css`, `data/value-bets.json` and this setup guide **inside that same folder**. Don't accidentally create a second nested `edgecheck-public` directory. Vercel should redeploy automatically.

Personal price-checker entries are saved in localStorage on the user's own device and do not create public tips.

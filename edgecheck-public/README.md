# EdgeCheck — deployable NFL prop research website

Responsive static website. No paid API, Node.js build, or database required for the initial release.

## Launch it publicly

1. Create an empty GitHub repository (for example `edgecheck`).
2. Upload **all files**, including `.github/workflows/refresh-stats.yml`, keeping the folder structure.
3. Go to the GitHub **Actions** tab → **Refresh NFL statistics** → **Run workflow**. Allow Actions write permissions under repository Settings → Actions → General → Workflow permissions (read and write), if required.
4. Confirm `data/stats.json` was added to the repository by the action.
5. Visit https://vercel.com/new, import the GitHub repository, choose the **Other** framework, leave build command blank, and deploy.
6. Visit your public `*.vercel.app` URL. Optionally connect a custom domain in Vercel project settings.

Daily at 10:20 UTC, GitHub Actions downloads the current season's published nflverse stats, validates them and commits the latest stats file. Vercel automatically publishes the updated file. The site shows the date of the latest successful refresh.

**Important:** GitHub scheduled workflows can be delayed. GitHub Actions may disable scheduled workflows in inactive public repositories. The public stats source is not guaranteed to be permanently available. The nightly refresh is not live in-game updates. Errors should be monitored in GitHub Actions.

## Local preview

Run `python -m http.server 8000` in the repository folder and visit `http://localhost:8000`. Player search stays disabled until the stats refresh has generated `data/stats.json`.

## Supported markets

Passing, rushing and receiving yards; passing, rushing and receiving touchdowns; receptions; completions; pass attempts and rushing attempts. All thresholds are inclusive. History windows: 5, 10 and 20 recorded game logs **within the current season**. Older years are not yet backfilled. The default window can therefore contain fewer games. Injuries, projected starting status and opponent-specific adjustments are **not** calculated. Historical hit rates are descriptive, not predictive. Odds and stake are entered by the user. Saved selections live only in that browser's local storage and are not synchronised across devices. No bookmaker integration or bets placed.

## Data credit

Source: https://github.com/nflverse/nflverse-data, release `stats_player`, file `stats_player_week_{YEAR}.csv`. Verify nflverse's licensing and attribution requirements before commercial use. This project is not affiliated with the NFL, nflverse, or any bookmaker.

## Before a large public launch

Add automated schema tests, logging/alerting for failed refreshes, reliable injury/schedule data from a licensed provider, a privacy policy, age-appropriate safeguards and jurisdiction-specific legal review if including advertising or affiliate bookmaker links. Do not label hit rates as win probabilities.

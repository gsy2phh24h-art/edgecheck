'use strict';

// Server-side UK NFL prop price comparison. Never expose the provider API key.
const MARKET = Object.freeze({
  passing_yards: 'player_pass_yds',
  rushing_yards: 'player_rush_yds',
  receiving_yards: 'player_reception_yds',
  receptions: 'player_receptions',
  completions: 'player_pass_completions',
  attempts: 'player_pass_attempts',
  carries: 'player_rush_attempts'
});
const norm = v => String(v || '').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const safeUrl = v => {
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; }
  catch { return null; }
};
const respond = (res, status, value) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
  return res.status(status).json(value);
};
async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(url, {signal: controller.signal, headers:{Accept:'application/json'}});
    if (!response.ok) throw Error('Provider returned HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return respond(res, 405, {status:'method_not_allowed'});
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return respond(res, 200, {status:'not_configured', message:'Connect a licensed odds data key to compare bookmaker prices.', comparisons:[]});
  let feed;
  try { feed = require('../data/game-picks.json'); }
  catch { return respond(res, 200, {status:'no_picks', comparisons:[]}); }
  const id = String(req.query.game || '').trim();
  if (!/^\d{7,15}$/.test(id)) return respond(res, 400, {status:'invalid_game'});
  const game = (feed.games || []).find(g => String(g.id) === id);
  const kick = Date.parse(game?.kickoff || '');
  if (!game || !Number.isFinite(kick) || kick <= Date.now()) return respond(res, 200, {status:'not_upcoming', comparisons:[]});
  const selections = (game.suggestions || []).filter(s => MARKET[s.market] && Number.isInteger(Number(s.line))).slice(0, 8);
  if (!selections.length) return respond(res, 200, {status:'no_selections', comparisons:[]});
  const base = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl';
  const eventsUrl = base + '/events?apiKey=' + encodeURIComponent(key);
  try {
    const events = await fetchJson(eventsUrl);
    const event = (Array.isArray(events) ? events : []).find(e =>
      norm(e.home_team) === norm(game.home) &&
      norm(e.away_team) === norm(game.away) &&
      Math.abs(Date.parse(e.commence_time) - kick) < 7200000
    );
    if (!event) return respond(res, 200, {status:'no_event_coverage', comparisons:[]});
    const markets = [...new Set(selections.map(s => MARKET[s.market]))];
    // Alternate markets are needed to match exact 40+, 50+, etc thresholds.
    const marketKeys = markets.flatMap(m => [m, m+'_alternate']).join(',');
    const url = base+'/events/'+encodeURIComponent(event.id)+'/odds?'+
      'apiKey='+encodeURIComponent(key)+'&regions=uk&oddsFormat=decimal&includeLinks=true&markets='+encodeURIComponent(marketKeys);
    const quote = await fetchJson(url);
    const now = Date.now();
    const comparisons = selections.map(s => {
      const correctPoint = Number(s.line)-0.5;
      const matches = [];
      for (const book of quote.bookmakers || []) {
        for (const market of book.markets || []) {
          if (![MARKET[s.market], MARKET[s.market]+'_alternate'].includes(market.key)) continue;
          const updated = Date.parse(market.last_update || book.last_update || '');
          if (!Number.isFinite(updated) || updated > now+120000 || now-updated > 1800000) continue;
          for (const outcome of market.outcomes || []) {
            if (norm(outcome.description) !== norm(s.player) || norm(outcome.name) !== 'over') continue;
            if (Math.abs(Number(outcome.point)-correctPoint) > 0.001) continue;
            const price = Number(outcome.price);
            if (!Number.isFinite(price) || price <= 1) continue;
            // Prefer selection link; otherwise distinguish market/event link.
            const selectionLink = safeUrl(outcome.link);
            const marketLink = safeUrl(market.link);
            const eventLink = safeUrl(book.link || quote.link);
            matches.push({
              bookmaker: String(book.title || book.key || ''),
              odds: price,
              checked_at: new Date(updated).toISOString(),
              url: selectionLink || marketLink || eventLink,
              link_type: selectionLink ? 'selection' : marketLink ? 'market' : eventLink ? 'event' : null
            });
          }
        }
      }
      matches.sort((a,b) => b.odds - a.odds);
      return {player:s.player, market:s.market, line:s.line, label:s.label, quotes:matches.slice(0,8)};
    });
    return respond(res, 200, {status:'ok', provider:'The Odds API', event:game.away+' at '+game.home,
      retrieved_at:new Date(now).toISOString(), comparisons});
  } catch (err) {
    // Do not leak the private key, request URL or internal provider response to visitors.
    return respond(res, 200, {status:'provider_unavailable',
      message:'Bookmaker prices are temporarily unavailable. Please check the bookmaker before betting.',comparisons:[]});
  }
};

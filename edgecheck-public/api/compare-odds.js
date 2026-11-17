'use strict';
// EdgeCheck: private ParlayAPI bookmaker comparison for upcoming NFL props.
// Never reveal PARLAY_API_KEY. Quotes are historical snapshots, not guarantees.
const MARKETS = Object.freeze({
  passing_yards:'player_pass_yds',
  rushing_yards:'player_rush_yds',
  receiving_yards:'player_rec_yds',
  receptions:'player_receptions',
  completions:'player_pass_completions',
  attempts:'player_pass_attempts',
  carries:'player_rush_attempts'
});
const UK_BOOKS = new Set(['bet365','unibet']); // Verified bookmaker identities, not regional licence.
const norm = s => String(s||'').normalize('NFKD').toLowerCase()
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const respond = (res, value, code=200) => {
  res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=300');
  return res.status(code).json(value);
};
const americanToDecimal = v => {
  const n=Number(v);
  if(!Number.isFinite(n)||n===0) return null;
  return n>0 ? 1+n/100 : 1+100/Math.abs(n);
};
const urlIfSafe = v => {
  try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}
};
async function fetchProps(key, markets) {
  const params=new URLSearchParams({
    markets:markets.join(','), bookkeepers:'', maxAgeSec:'1800', limit:'10000'
  });
  params.delete('bookkeepers');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch('https://parlay-api.com/v1/sports/americanfootball_nfl/props?'+params,
      {signal:controller.signal,headers:{'X-API-Key':key,Accept:'application/json'}});
    if (!response.ok) {
      const err=new Error('Provider returned '+response.status);err.status=response.status;
      throw err;
    }
    const rows=await response.json();
    return Array.isArray(rows) ? rows : (Array.isArray(rows.rows)? rows.rows : []);
  } finally {clearTimeout(timeout);}
}
module.exports=async function handler(req,res) {
  if(req.method!=='GET') return respond(res,{status:'method_not_allowed'},405);
  const key=process.env.PARLAY_API_KEY;
  if(!key)return respond(res,{status:'not_configured',comparisons:[]});
  const id=String(req.query.game||'');
  if(!/^\d{7,15}$/.test(id))return respond(res,{status:'invalid_game',comparisons:[]},400);
  let feed;
  try{feed=require('../data/game-picks.json');}
  catch{return respond(res,{status:'no_picks',comparisons:[]});}
  const game=(feed.games||[]).find(g=>String(g.id)===id);
  const kickoff=Date.parse(game?.kickoff);
  if(!game||!Number.isFinite(kickoff)||kickoff<=Date.now())
    return respond(res,{status:'not_upcoming',comparisons:[]});
  const picks=[...(game.suggestions||[]),...(game.higher_risk_suggestions||[])]
    .filter(s=>MARKETS[s.market]&&Number.isFinite(Number(s.line)))
    .filter((s,i,all)=>all.findIndex(v=>v.player_id===s.player_id&&v.market===s.market&&Number(v.line)===Number(s.line))===i)
    .slice(0,16);
  if(!picks.length)return respond(res,{status:'no_selections',comparisons:[]});
  try {
    const rows=await fetchProps(key,[...new Set(picks.map(s=>MARKETS[s.market]))]);
    const now=Date.now();
    const comps=picks.map(p=>{
      const quotes=[];
      for(const row of rows){
        if(!row || !UK_BOOKS.has(norm(row.bookmaker)))continue;
        const aliases={
          player_pass_yds:['player_pass_yds','player_passing_yards','player_pass_yards'],
          player_rush_yds:['player_rush_yds','player_rushing_yards'],
          player_rec_yds:['player_rec_yds','player_reception_yds','player_receiving_yards']
        };
        const accepted=aliases[MARKETS[p.market]]||[MARKETS[p.market]];
        if(norm(row.player)!==norm(p.player)||!accepted.includes(row.market_key))continue;
        // 40+ on a whole-number stat is equivalent to Over 39.5.
        const line=Number(row.line);
        if(!Number.isFinite(line) || Math.abs(line-(Number(p.line)-0.5))>0.001)continue;
        if(row.period && String(row.period).toUpperCase()!=='FULL')continue;
        if(norm(row.home_team)!==norm(game.home)||norm(row.away_team)!==norm(game.away))continue;
        const quotedKickoff=Date.parse(row.commence_time);
        if(!Number.isFinite(quotedKickoff)||Math.abs(quotedKickoff-kickoff)>7200000)continue;
        const raw=typeof row.last_update==='number'?row.last_update:null;
        const checked=raw!==null && raw>1e11 ? raw : Date.parse(row.last_update || '');
        const age=Number.isFinite(Number(row.age_seconds))?Number(row.age_seconds)*1000:null;
        const observation=Number.isFinite(checked)&&checked>1e11?checked:(age!==null?now-age:NaN);
        if(!Number.isFinite(observation)||observation>now+120000||now-observation>1800000)continue;
        const price=americanToDecimal(row.over_price);
        if(!price||price<=1||price>1000)continue;
        const link=urlIfSafe(row.selection_url||row.market_url||row.event_url||row.bookmaker_url);
        quotes.push({
          bookmaker:String(row.bookmaker_title||row.bookmaker),
          odds:Math.round(price*100)/100,
          checked_at:new Date(observation).toISOString(),
          url:link,
          link_type:link?'event':null
        });
      }
      quotes.sort((a,b)=>b.odds-a.odds);
      return {player:p.player,market:p.market,line:p.line,label:p.label,quotes:quotes.slice(0,8)};
    });
    const any=comps.some(x=>x.quotes.length);
    return respond(res,{
      status:any?'ok':'no_exact_lines',provider:'ParlayAPI',
      event:game.away+' at '+game.home,retrieved_at:new Date(now).toISOString(),
      comparisons:comps
    });
  }catch(error){
    const status=error.status===401?'key_invalid':
      error.status===402||error.status===403?'plan_required':
      error.status===429?'quota_exhausted':'provider_unavailable';
    return respond(res,{status,comparisons:[]});
  }
};

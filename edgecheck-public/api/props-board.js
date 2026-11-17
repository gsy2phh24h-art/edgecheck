'use strict';
// Live NFL prop offers. One server-side request for the current slate, cached
// for 30 minutes at the CDN to conserve the free ParlayAPI monthly credit allowance.
const MARKETS={
  player_pass_yds:'Passing yards',
  player_pass_completions:'Pass completions',
  player_rush_yds:'Rushing yards',
  player_rec_yds:'Receiving yards',
  player_receptions:'Receptions',
  player_pass_tds:'Passing TDs',
  player_anytime_td:'Anytime touchdown'
};
const MARKET_ALIASES={
  player_passing_yards:'player_pass_yds',
  player_pass_yards:'player_pass_yds',
  player_receiving_yards:'player_rec_yds',
  player_reception_yds:'player_rec_yds',
  player_rushing_yards:'player_rush_yds'
};
const EXCLUDED=new Set(['prizepicks','underdog','betr','sleeper','pick6','kalshi','polymarket','novig','robinhood']);
const normal=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const dec=(n)=>{n=Number(n);if(!Number.isFinite(n)||!n)return null;return +(n>0?1+n/100:1+100/Math.abs(n)).toFixed(2);};
function send(res,obj,status=200){
 res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=300');
 return res.status(status).json(obj);
}
const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
module.exports=async function handler(req,res){
 if(req.method!=='GET')return send(res,{status:'method_not_allowed'},405);
 const key=process.env.PARLAY_API_KEY;
 if(!key)return send(res,{status:'not_configured',offers:[]});
 let feed;try{feed=require('../data/game-picks.json');}catch{return send(res,{status:'missing_fixtures',offers:[]});}
 const now=Date.now();
 const games=(feed.games||[]).filter(g=>Date.parse(g.kickoff)>now && Date.parse(g.kickoff)<now+8*86400000);
 if(!games.length)return send(res,{status:'no_upcoming_games',offers:[]});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11000);
 try{
  const p=new URLSearchParams({limit:'10000',maxAgeSec:'1800'});
  // Request all provider markets and books once; only show regulated sportsbooks,
  // not DFS synthetic payouts or prediction-market contracts.
  const response=await fetch('https://parlay-api.com/v1/sports/americanfootball_nfl/props?'+p.toString(),{
    headers:{'X-API-Key':key,Accept:'application/json'},signal:controller.signal
  });
  if(!response.ok){
    return send(res,{status:response.status===401?'key_invalid':response.status===429?'quota_exhausted':response.status===403?'plan_required':'provider_unavailable',offers:[]});
  }
  const body=await response.json();
  const rows=Array.isArray(body)?body: Array.isArray(body.rows)?body.rows:[];
  const offers=[];
  const dedupe=new Set();
  for(const row of rows){
    if(!row || (row.period&&String(row.period).toUpperCase()!=='FULL'))continue;
    const market=MARKET_ALIASES[row.market_key]||row.market_key;
    if(!MARKETS[market])continue;
    const bookmaker=String(row.bookmaker||'').toLowerCase();
    if(!bookmaker || EXCLUDED.has(bookmaker))continue;
    const game=games.find(g=>normal(g.home)===normal(row.home_team)&&normal(g.away)===normal(row.away_team)&&
      Math.abs(Date.parse(g.kickoff)-Date.parse(row.commence_time))<7200000);
    if(!game)continue; // Never infer fixtures from player names when source omits teams.
    const player=String(row.player||'').trim();
    const line=Number(row.line);
    if(!player || !Number.isFinite(line))continue;
    const stamp=typeof row.last_update==='number'?(row.last_update<1e11?row.last_update*1000:row.last_update):Date.parse(row.last_update||'');
    const age=Number(row.age_seconds);
    const checked=Number.isFinite(stamp)&&stamp>1e11?stamp:(Number.isFinite(age)?now-age*1000:NaN);
    if(!Number.isFinite(checked)||checked>now+120000||now-checked>1800000)continue;
    const over=dec(row.over_price), under=dec(row.under_price);
    for(const [side,odds] of [['Over',over],['Under',under]]){
      if(!odds||odds<=1)continue;
      const id=[game.id,normal(player),market,line,bookmaker,side].join(':');
      if(dedupe.has(id))continue;dedupe.add(id);
      offers.push({
       id,game_id:String(game.id),game:game.away+' at '+game.home,
       kickoff:game.kickoff, player,market,market_label:MARKETS[market],
       side,line,bookmaker: String(row.bookmaker_title||bookmaker),
       bookmaker_key:bookmaker, odds,checked_at:new Date(checked).toISOString(),
       url:safeLink(row.selection_url||row.market_url||row.event_url||row.bookmaker_url),
       link_type:row.selection_url?'selection':row.market_url?'market':'event'
      });
    }
  }
  // Prefer bet365 within each game, but spread the response across fixtures
  // so one busy game cannot crowd every other upcoming match off the page.
  offers.sort((a,b)=>(b.bookmaker_key==='bet365')-(a.bookmaker_key==='bet365')||
    Date.parse(b.checked_at)-Date.parse(a.checked_at));
  const groups=new Map();
  for(const o of offers){
    if(!groups.has(o.game_id))groups.set(o.game_id,[]);
    if(groups.get(o.game_id).length<90)groups.get(o.game_id).push(o);
  }
  const balanced=[];
  let pending=true;
  while(pending&&balanced.length<600){
    pending=false;
    for(const group of groups.values()){
      if(group.length && balanced.length<600){balanced.push(group.shift());pending=true;}
    }
  }
  return send(res,{
    status:balanced.length?'ok':'no_coverage',source:'ParlayAPI',
    retrieved_at:new Date(now).toISOString(),
    message:balanced.length?'Bookmaker quotes available; geographic eligibility and bet365 market availability require checking.':'No fresh, fixture-verified NFL prop quotes from sportsbooks were returned.',
    offers:balanced
  });
 }catch(e){return send(res,{status:'provider_unavailable',offers:[]});}
 finally{clearTimeout(timeout);}
};

'use strict';
// NBA and six supported football competitions only. Private provider key never leaves Vercel.
const SPORTS=Object.freeze({
 nba:'basketball_nba',
 'eng.1':'soccer_epl',
 'esp.1':'soccer_spain_la_liga',
 'ita.1':'soccer_italy_serie_a',
 'ger.1':'soccer_germany_bundesliga',
 'fra.1':'soccer_france_ligue_one',
 'uefa.champions':'soccer_uefa_champs_league'
});
const NBA=Object.freeze({
 player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',
 player_threes:'Three-pointers',player_three_pointers:'Three-pointers',
 player_pra:'Points + rebounds + assists',player_pts_rebs_asts:'Points + rebounds + assists',
 player_pts_rebs:'Points + rebounds',player_pts_asts:'Points + assists',
 player_rebs_asts:'Rebounds + assists',player_steals:'Steals',
 player_blocks:'Blocks',player_turnovers:'Turnovers',player_double_double:'Double-double'
});
const FOOTBALL=Object.freeze({
 player_shots_on_target:'Shots on target',player_shots:'Shots',
 player_fouls:'Fouls',player_assists:'Assists',
 player_anytime_goalscorer:'Anytime goalscorer',
 player_anytime_goal_scorer:'Anytime goalscorer',
 player_goals:'Goals',player_goals_assists:'Goals + assists'
});
const EXCLUDED=new Set(['prizepicks','underdog','betr','sleeper','pick6','kalshi','polymarket','novig','robinhood']);
const normal=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function decimal(v){const n=Number(v);return Number.isFinite(n)&&n!==0?+(n>0?1+n/100:1+100/Math.abs(n)).toFixed(2):null;}
function send(res,data,status=200){
 res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=300');
 return res.status(status).json(data);
}
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
module.exports=async function handler(req,res){
 if(req.method!=='GET')return send(res,{status:'method_not_allowed'},405);
 const league=String(req.query?.league||'');
 const sport=SPORTS[league];
 if(!Object.prototype.hasOwnProperty.call(SPORTS,league))return send(res,{status:'unsupported_competition',offers:[]},400);
 const key=process.env.PARLAY_API_KEY;
 if(!key)return send(res,{status:'not_configured',offers:[]});
 const markets=league==='nba'?NBA:FOOTBALL;
 const control=new AbortController(), timer=setTimeout(()=>control.abort(),10000);
 try{
  const url='https://parlay-api.com/v1/sports/'+sport+'/props?'+new URLSearchParams({limit:'10000',maxAgeSec:'1800'});
  const response=await fetch(url,{headers:{'X-API-Key':key,Accept:'application/json'},signal:control.signal});
  if(!response.ok)return send(res,{
   status:response.status===401?'key_invalid':
    response.status===403||response.status===402?'plan_required':
    response.status===429?'quota_exhausted':'provider_unavailable',offers:[]
  });
  const body=await response.json();
  const rows=Array.isArray(body)?body:Array.isArray(body.rows)?body.rows:[];
  const now=Date.now(),result=[],used=new Set();
  for(const row of rows){
   if(!row||row.period&&String(row.period).toUpperCase()!=='FULL')continue;
   const market=String(row.market_key||'');
   if(!Object.prototype.hasOwnProperty.call(markets,market))continue;
   const bookmakerKey=String(row.bookmaker||'').toLowerCase();
   if(!bookmakerKey||EXCLUDED.has(bookmakerKey))continue;
   const player=String(row.player||'').trim();
   const home=String(row.home_team||'').trim(),away=String(row.away_team||'').trim();
   const start=Date.parse(row.commence_time||'');
   if(!player||!home||!away||!Number.isFinite(start)||start<=now||start>now+14*86400000)continue;
   const line=Number(row.line);
   if(!Number.isFinite(line))continue;
   const stamp=typeof row.last_update==='number'?(row.last_update<1e11?row.last_update*1000:row.last_update):Date.parse(row.last_update||'');
   const age=Number(row.age_seconds);
   const checked=Number.isFinite(stamp)&&stamp>1e11?stamp:Number.isFinite(age)?now-age*1000:NaN;
   if(!Number.isFinite(checked)||checked>now+120000||now-checked>1800000)continue;
   const id=[normal(home),normal(away),Math.floor(start/3600000)].join('_');
   const marketIsBinary=market.includes('goalscorer')||market==='player_double_double';
   for(const [side,price] of [['Over',decimal(row.over_price)],['Under',decimal(row.under_price)]]){
    if(marketIsBinary&&side==='Under')continue;
    if(!price||price<=1||price>1000)continue;
    const k=[id,normal(player),market,line,side,bookmakerKey].join('|');
    if(used.has(k))continue;used.add(k);
    result.push({id:k,game_id:id,game:away+' at '+home,away,home,kickoff:new Date(start).toISOString(),
      player,market,market_label:markets[market],side,line,odds:price,
      bookmaker:String(row.bookmaker_title||row.bookmaker),bookmaker_key:bookmakerKey,
      checked_at:new Date(checked).toISOString(),
      url:safeUrl(row.selection_url||row.market_url||row.event_url||row.bookmaker_url)
    });
   }
  }
  result.sort((a,b)=>(b.bookmaker_key==='bet365')-(a.bookmaker_key==='bet365')||Date.parse(b.checked_at)-Date.parse(a.checked_at));
  // Preserve diverse fixtures instead of letting one busy event fill the board.
  const byGame=new Map();
  for(const o of result){if(!byGame.has(o.game_id))byGame.set(o.game_id,[]);if(byGame.get(o.game_id).length<95)byGame.get(o.game_id).push(o);}
  const offers=[];let left=true;
  while(left&&offers.length<650){left=false;for(const rows of byGame.values())if(rows.length&&offers.length<650){offers.push(rows.shift());left=true;}}
  return send(res,{status:offers.length?'ok':'no_coverage',league,source:'ParlayAPI',retrieved_at:new Date().toISOString(),offers});
 }catch{
  return send(res,{status:'provider_unavailable',offers:[]});
 }finally{clearTimeout(timer);}
};
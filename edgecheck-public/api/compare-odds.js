'use strict';
// OddsLink NFL prop comparison. The server keeps ODDSLINK_API_KEY private.
const MARKET = Object.freeze({
  passing_yards:'player_pass_yds',
  rushing_yards:'player_rush_yds',
  receiving_yards:'player_reception_yds',
  receptions:'player_receptions',
  completions:'player_pass_completions',
  attempts:'player_pass_attempts',
  carries:'player_rush_attempts'
});
const UK_BOOKS = new Set([
  'bet365','skybet','paddypower','betfair','betfair sportsbook',
  'williamhill','ladbrokes','coral','unibet','betway','888sport',
  'virginbet','boylesports','betfred','sportingindex','kwiff',
  'spreadex','betvictor','talksportbet','10bet'
]);
const normalise = s => String(s||'').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const UK_KEYS = new Set([...UK_BOOKS].map(normalise));
const isUK = b => UK_KEYS.has(normalise(b.key)) || UK_KEYS.has(normalise(b.title));
const validLink = s => {
  try {const u=new URL(s);return u.protocol==='https:'?u.href:null;}
  catch{return null;}
};
function respond(res,status,payload){
  res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=60');
  return res.status(status).json(payload);
}
async function getJson(url,key){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{'X-API-Key':key,Accept:'application/json'}});
    if(!r.ok){
      let code='PROVIDER_ERROR';
      try{const body=await r.json();code=String(body?.error?.code||code);}
      catch{}
      const e=new Error('Provider rejected request');
      e.status=r.status;e.code=code;throw e;
    }
    return await r.json();
  } finally {clearTimeout(timeout);}
}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return respond(res,405,{status:'method_not_allowed'});
  const key=process.env.ODDSLINK_API_KEY;
  if(!key)return respond(res,200,{status:'not_configured',comparisons:[]});
  const id=String(req.query.game||'');
  if(!/^\d{7,15}$/.test(id))return respond(res,400,{status:'invalid_game',comparisons:[]});
  let feed;
  try{feed=require('../data/game-picks.json');}
  catch{return respond(res,200,{status:'no_picks',comparisons:[]});}
  const game=(feed.games||[]).find(g=>String(g.id)===id);
  if(!game||Date.parse(game.kickoff)<=Date.now())
    return respond(res,200,{status:'not_upcoming',comparisons:[]});
  const selections=(game.suggestions||[]).filter(s=>MARKET[s.market]&&Number.isInteger(Number(s.line))).slice(0,8);
  if(!selections.length)return respond(res,200,{status:'no_selections',comparisons:[]});
  const markets=[...new Set(selections.map(s=>MARKET[s.market]))];
  const q=new URLSearchParams({markets:markets.join(','),oddsFormat:'decimal'});
  try{
    // One paid request for all upcoming NFL fixtures, filtered to our current matchup.
    const data=await getJson('https://oddslink.app/v1/sports/nfl/props?'+q.toString(),key);
    const event=(Array.isArray(data)?data:[]).find(e=>
      normalise(e.home_team)===normalise(game.home) &&
      normalise(e.away_team)===normalise(game.away) &&
      Math.abs(Date.parse(e.commence_time)-Date.parse(game.kickoff))<7200000);
    if(!event)return respond(res,200,{status:'no_event_coverage',comparisons:[]});
    const now=Date.now();
    const comparisons=selections.map(s=>{
      const quotes=[];
      for(const prop of event.props||[]){
        if(!prop || prop.period || prop.stat!==MARKET[s.market] ||
          normalise(prop.player)!==normalise(s.player) ||
          Math.abs(Number(prop.point)-(Number(s.line)-0.5))>0.001)continue;
        const book=prop.bookmaker||{};
        if(!isUK(book))continue;
        const checked=Date.parse(book.last_update||'');
        if(!Number.isFinite(checked)||checked>now+120000||now-checked>1800000)continue;
        for(const outcome of prop.outcomes||[]){
          if(outcome.name!=='Over'||!Number.isFinite(Number(outcome.price))||Number(outcome.price)<=1)continue;
          const url=validLink(book.link);
          quotes.push({bookmaker:String(book.title||book.key||''),
            odds:Number(outcome.price),checked_at:new Date(checked).toISOString(),
            url,link_type:url?'event':null});
        }
      }
      quotes.sort((a,b)=>b.odds-a.odds);
      return {player:s.player,market:s.market,line:s.line,label:s.label,quotes:quotes.slice(0,8)};
    });
    const any=comparisons.some(s=>s.quotes.length);
    return respond(res,200,{
      status:any?'ok':'no_exact_lines',provider:'OddsLink',
      event:game.away+' at '+game.home,retrieved_at:new Date().toISOString(),comparisons
    });
  }catch(err){
    if(err.code==='PLAN_REQUIRED'||err.status===403)
      return respond(res,200,{status:'plan_required',message:'OddsLink player props require the Growth plan or higher.',comparisons:[]});
    if(err.code==='INVALID_MARKET')
      return respond(res,200,{status:'market_not_supported',message:'OddsLink did not accept a requested player-prop market.',comparisons:[]});
    if(err.status===401)
      return respond(res,200,{status:'key_invalid',comparisons:[]});
    return respond(res,200,{status:'provider_unavailable',comparisons:[]});
  }
};

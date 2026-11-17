'use strict';
let db=null, selected=null, win=5;
const $=id=>document.getElementById(id);
const marketNames={passing_yards:'Passing yards',receiving_yards:'Receiving yards',rushing_yards:'Rushing yards',passing_tds:'Passing TDs',receiving_tds:'Receiving TDs',rushing_tds:'Rushing TDs',receptions:'Receptions',completions:'Completions',attempts:'Pass attempts',carries:'Rush attempts'};
let slips=[];
try { const saved=JSON.parse(localStorage.getItem('edgecheck_slip_v1')||'[]');if(Array.isArray(saved))slips=saved.slice(0,30); } catch {}
const save=()=>localStorage.setItem('edgecheck_slip_v1',JSON.stringify(slips));
const toNumber=v=>Number.isFinite(Number(v))?Number(v):0;
function gamesFor(id){const p=db?.players?.find(p=>p.id===id);return p?.games||[]}
function hitStats(games,market,line,n){const subset=games.slice(0,n);const valid=subset.filter(g=>g[market]!==null&&g[market]!==undefined);const hits=valid.filter(g=>Number(g[market])>=line).length;return {valid,hits,rate:valid.length?Math.round(100*hits/valid.length):null};}
function selectPlayer(p){selected=p;$('player-search').value=p.name;$('suggestions').hidden=true;$('selected').innerHTML=`<div class="avatar">${escapeHtml(p.name.slice(0,1))}</div><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.team||'NFL')} · ${escapeHtml(p.position||'Player')} · ${p.games.length} game logs</small></div>`;renderResult()}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderResult(){let out=$('result');$('add-leg').disabled=!selected||!db;if(!selected||!db){out.innerHTML='<div class="empty">Select a player to analyse a prop.</div>';return}const market=$('market').value,line=Math.max(0,toNumber($('line').value)),s=hitStats(selected.games,market,line,win);if(!s.valid.length){out.innerHTML='<div class="empty">No recorded games for this player and stat market.</div>';$('add-leg').disabled=true;return;}const avg=(s.valid.reduce((sum,g)=>sum+toNumber(g[market]),0)/s.valid.length).toFixed(1);out.innerHTML=`<div class="analysis-top"><div><b>${s.rate}%</b><small>Hit rate · ${s.hits} of ${s.valid.length} games</small></div><div class="metricbox"><strong>${avg}</strong><small>Average · last ${s.valid.length} games</small></div></div><div class="gamelog">${s.valid.map(g=>`<div class="game ${Number(g[market])>=line?'hit':'miss'}"><strong>${escapeHtml(g[market])}</strong><small>W${escapeHtml(g.week)} · ${escapeHtml(g.opponent||'?')}</small></div>`).join('')}</div><div class="statmeta">${escapeHtml(marketNames[market])} ≥ ${line} · ${escapeHtml(selected.name)} · ${escapeHtml(db.season)} season</div>`;}
function renderSlip(){const root=$('legs');$('slip-count').textContent=slips.length;if(!slips.length){root.innerHTML='<div class="slip-empty"><span>▤</span><strong>Your slip is empty</strong><p>Research a player, then add a selection to start comparing legs.</p></div>';}else{root.innerHTML=slips.map((l,i)=>{const p=db?.players?.find(p=>p.id===l.id);const stats=p?hitStats(p.games,l.market,l.line,5):null;return `<div class="leg"><span class="leg-index">${i+1}</span><div class="leg-content"><strong>${escapeHtml(l.name)} · ${l.line}+ ${escapeHtml(marketNames[l.market])}</strong><small>Last 5 games · updated on data refresh</small><div class="rate ${stats?.rate!==null&&stats?.rate<50?'low':''}">${stats?.rate==null?'Stats unavailable':`${stats.rate}% hit rate · ${stats.hits}/${stats.valid.length}`}</div></div><button class="remove" aria-label="Remove ${escapeHtml(l.name)}" data-remove="${i}">×</button></div>`}).join('');}const odds=Number($('decimal-odds').value),stake=Number($('stake').value);$('returns').textContent=odds>=1&&stake>=0&&Number.isFinite(odds*stake)?`£${(odds*stake).toFixed(2)}`:'—';$('implied').textContent=odds>1?`${(100/odds).toFixed(1)}%`:'—';const ranked=slips.map(l=>{const p=db?.players?.find(p=>p.id===l.id);return p?{name:l.name,rate:hitStats(p.games,l.market,l.line,5).rate}:null}).filter(x=>x&&x.rate!==null).sort((a,b)=>a.rate-b.rate);$('weakest').textContent=ranked.length?`${ranked[0].name} (${ranked[0].rate}%)`:'—';}
$('player-search').addEventListener('input',()=>{selected=null;$('add-leg').disabled=true;$('selected').innerHTML='<div class="avatar">?</div><div><strong>No player selected</strong><small>Choose a player below</small></div>';renderResult();const q=$('player-search').value.trim().toLowerCase();const matches=q.length>=2&&db?db.players.filter(p=>p.name.toLowerCase().includes(q)).slice(0,10):[];$('suggestions').innerHTML=matches.map(p=>`<button type="button" data-player="${escapeHtml(p.id)}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.team)} · ${escapeHtml(p.position)}</small></button>`).join('');$('suggestions').hidden=!matches.length});
$('suggestions').addEventListener('click',e=>{const b=e.target.closest('[data-player]');if(b)selectPlayer(db.players.find(p=>p.id===b.dataset.player))});
document.addEventListener('click',e=>{if(!e.target.closest('.searchwrap'))$('suggestions').hidden=true});
$('market').addEventListener('change',renderResult);$('line').addEventListener('input',renderResult);
document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>{win=+b.dataset.window;document.querySelectorAll('[data-window]').forEach(x=>x.classList.toggle('on',x===b));renderResult()}));
$('add-leg').addEventListener('click',()=>{if(!selected||slips.length>=30)return;slips.push({id:selected.id,name:selected.name,market:$('market').value,line:Math.max(0,toNumber($('line').value))});save();renderSlip();});
$('legs').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b){slips.splice(Number(b.dataset.remove),1);save();renderSlip()}});
$('clear-slip').addEventListener('click',()=>{slips=[];save();renderSlip()});
$('stake').addEventListener('input',renderSlip);$('decimal-odds').addEventListener('input',renderSlip);
$('copy-slip').addEventListener('click',async()=>{let summary=slips.map((l,i)=>`${i+1}. ${l.name} ${l.line}+ ${marketNames[l.market]}`).join('\n');summary+=`\nStake: £${$('stake').value}\nDecimal odds: ${$('decimal-odds').value||'Not provided'}\nResearch: EdgeCheck (${db?.updated_at||'data unavailable'})`;try{await navigator.clipboard.writeText(summary);$('copy-slip').textContent='Copied!';setTimeout(()=>$('copy-slip').textContent='Copy slip summary',1600)}catch{window.prompt('Copy summary:',summary)}});
async function boot(){try{const res=await fetch('/data/stats.json?cb='+Math.floor(Date.now()/3600000),{cache:'no-store'});if(!res.ok)throw Error('No statistics published yet');const j=await res.json();if(!j.players?.length)throw Error('No statistics published yet');db=j;$('player-search').disabled=false;$('player-count').textContent=j.players.length.toLocaleString('en-GB');$('game-count').textContent=j.players.reduce((sum,p)=>sum+p.games.length,0).toLocaleString('en-GB');$('update-date').textContent=new Date(j.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'});const age=(Date.now()-Date.parse(j.updated_at))/(3600000);$('data-status').textContent=age>48?'Stats may be delayed':'Stats available';if(age>48){$('alert').hidden=false;$('alert').textContent=`The latest statistics were published ${new Date(j.updated_at).toLocaleString('en-GB')}. Updates may be delayed. Check official injury reports separately.`}}catch(err){$('data-status').textContent='Stats not yet available';$('alert').hidden=false;$('alert').textContent='NFL statistics have not yet been imported. The site is ready, but a GitHub Actions data refresh must complete before player search will work. No sample statistics are presented as live data.';}renderSlip()}
boot();

// Game-by-game research ideas from the daily server-side data import.
function prettyKickoff(iso){const dt=new Date(iso);return Number.isNaN(+dt)?'Time unknown':dt.toLocaleString('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' UK';}
async function loadGamePicks(){const out=$('game-picks-list');if(!out)return;
 try{const resp=await fetch('/data/game-picks.json?b='+Math.floor(Date.now()/300000),{cache:'no-store'});if(!resp.ok)throw Error('Picks not imported');const data=await resp.json();
  const ageHours=(Date.now()-Date.parse(data.updated_at))/3600000;
  if(!Number.isFinite(ageHours)||ageHours>48||ageHours< -1)throw Error('Picks feed is out of date');
  $('picks-date').textContent='Upcoming NFL games · next 7 days';
  $('picks-updated').textContent='Updated '+prettyKickoff(data.updated_at);
  const games=(Array.isArray(data.games)?data.games:[]).filter(g=>Number.isFinite(Date.parse(g.kickoff))&&Date.parse(g.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  currentUpcomingGames=games;
  updateBuilderGameMenu();
  if(!games.length){out.innerHTML='<div class="value-empty"><strong>No upcoming fixtures in the latest update.</strong><p>The next fixture refresh will check the NFL schedule again.</p></div>';return;}
  $('fixture-count').textContent=games.length+' upcoming '+(games.length===1?'game':'games');
  const dateKey=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  const dateLabel=iso=>new Date(iso).toLocaleDateString('en-GB',{timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long'});
  const gameGroups=new Map();
  for(const game of games){const day=dateKey(game.kickoff);if(!gameGroups.has(day))gameGroups.set(day,[]);gameGroups.get(day).push(game);}
  out.innerHTML=[...gameGroups.values()].map(group=>'<section class="fixture-day"><div class="fixture-day-title"><h3>'+escapeHtml(dateLabel(group[0].kickoff))+'</h3><span>'+group.length+' '+(group.length===1?'match':'matches')+'</span></div><div class="fixture-day-grid">'+group.map(g=>{const before=Date.parse(g.kickoff)>Date.now();const picks=before&&Array.isArray(g.suggestions)?g.suggestions:[];const boldPicks=before&&Array.isArray(g.higher_risk_suggestions)?g.higher_risk_suggestions:[];
    return `<details class="match-card match-accordion"><summary class="match-head"><div class="fixture-team-block"><span class="fixture-eyebrow">NFL · ${escapeHtml(new Date(g.kickoff).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}))} UK</span><h3><span>${escapeHtml(g.away)}</span><span class="fixture-vs">at</span><span>${escapeHtml(g.home)}</span></h3></div><span class="fixture-expand">View picks <span class="match-chevron" aria-hidden="true">⌄</span></span></summary><div class="match-accordion-body">
    ${['balanced','higher'].map(tier=>{const arr=tier==='balanced'?picks:boldPicks;return `<div class="risk-group" data-risk-group="${tier}" ${tier==='higher'?'hidden':''}>${arr.length?`<div class="match-picks">${arr.map(p=>`<div class="match-pick"><div><strong>${escapeHtml(p.player)}</strong><small>${escapeHtml(p.team)} · ${escapeHtml(p.label)}</small><small>Against ${escapeHtml(p.opponent||'opponent')} · roster checked</small></div><button type="button" class="pick-add" data-add-suggested="${encodeURIComponent(JSON.stringify({game_id:String(g.id),player:p.player,market:p.market,line:p.line}))}" title="Add this target to the copyable builder">+ Builder</button><div class="pick-rate">${p.hits}/${p.sample}<small>Last 5 hit</small></div></div>`).join('')}</div>`:'<p class="no-picks">No qualifying selections in this category. Historical performance does not guarantee future outcomes.</p>'}</div>`}).join('')}
    <p class="no-picks"><small>${escapeHtml(g.verification_note||'Roster and availability checks are not available.')}</small></p>
    ${g.defensive_context?`<details class="match-context"><summary>Opponent defence context (estimated)</summary>${Object.entries(g.defensive_context).map(([team,s])=>s?`<p><strong>${escapeHtml(team)}</strong> · Pass yards conceded/game: ${s.pass_yards_allowed_avg} · Rush yards conceded/game: ${s.rush_yards_allowed_avg} · ${s.sample_games} games</p>`:'').join('')}<small>${escapeHtml(g.context_note||'Approximations from weekly game logs, not official defensive statistics.')}</small></details>`:''}
    ${before && (picks.length || boldPicks.length) ? `<div class="compare-actions"><button class="compare-btn" type="button" data-compare-game="${escapeHtml(String(g.id))}">Compare UK bookmaker prices</button><div id="bookmaker-results-${escapeHtml(String(g.id))}" class="bookmaker-results" aria-live="polite"></div></div>` : ''}
    <a href="https://www.bet365.com/" class="check-bookmaker" target="_blank" rel="noopener noreferrer">Check available markets at bet365 ↗</a><p class="no-picks"><a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Check official NFL injury reports ↗</a> · Confirm line-ups and market availability before betting.</p>
    </div></details>`}).join('')+'</div></section>').join('');
  // The odds board and builder depend on the latest matchup IDs.
  if(typeof renderLiveProps==='function')renderLiveProps();
  if(document.body.dataset.page==='builders')loadLiveOddsBoard();
 }catch(e){$('picks-date').textContent='No current suggestions';$('picks-updated').textContent='';out.innerHTML='<div class="value-empty"><strong>Today’s suggestions are not available yet.</strong><p>Game picks will appear automatically after the statistics and matchup data have been imported. No unverified recommendations are shown.</p></div>';}}
if(['picks','builders','props'].includes(document.body.dataset.page))loadGamePicks();


// Real decimal-odds board. Individual verified quotes only; never invent acca prices.
let activeOddsTier=2;
let selectedBuilderGame='';
function updateBuilderGameMenu(){
 const select=$('builder-game-select');
 if(!select)return;
 const previous=select.value||selectedBuilderGame;
 const choices=currentUpcomingGames.filter(g=>Date.parse(g.kickoff)>Date.now());
 select.innerHTML='<option value="">All upcoming games</option>'+choices.map(g=>
  '<option value="'+escapeHtml(String(g.id))+'">'+escapeHtml(g.away+' at '+g.home+' · '+prettyKickoff(g.kickoff))+'</option>').join('');
 selectedBuilderGame=choices.some(g=>String(g.id)===previous)?previous:'';
 select.value=selectedBuilderGame;
}
$('builder-game-select')?.addEventListener('change',e=>{
 selectedBuilderGame=e.target.value;
 renderOddsBoard();
});
const oddsIntervals={2:[1.8,2.25],3:[2.7,3.35],4:[3.6,4.45],6:[5.4,6.65]};
let currentUpcomingGames=[];
let livePriceOffers=[];
let livePriceChecked=0;
let livePriceError='';
let livePriceLoading=false;

// Reuse one server-side, cached odds request for both the price board and builder.
let propFeedCache=null;
let propFeedPromise=null;
let propFeedAt=0;
const PROP_REFRESH_MS=30*60*1000; // Match the shared CDN refresh window.
async function getPropFeed(force=false){
 // "Refresh" only updates the view from the shared cache until the window expires.
 if(propFeedCache&&Date.now()-propFeedAt<PROP_REFRESH_MS)return propFeedCache;
 if(propFeedPromise)return propFeedPromise;
 propFeedPromise=(async()=>{
  // No cache-busting parameter or no-store header: both bypass the CDN and waste credits.
  const response=await fetch('/api/props-board');
  if(!response.ok)throw Error('Live player market service returned HTTP '+response.status);
  const data=await response.json();
  propFeedCache=data;propFeedAt=Date.now();
  return data;
 })();
 try{return await propFeedPromise;}finally{propFeedPromise=null;}
}
function explainPropFeed(status){
 return ({
  not_configured:'A ParlayAPI key is required to display live props.',
  key_invalid:'The saved ParlayAPI key has been rejected.',
  plan_required:'The connected API plan cannot access these prop markets.',
  quota_exhausted:'ParlayAPI has reached its credit or rate limit.',
  no_upcoming_games:'No upcoming games are available in the latest fixture update.',
  missing_fixtures:'The NFL fixtures have not loaded.',
  no_coverage:'No recent, game-verified sportsbook player props are available from the feed.',
  provider_unavailable:'The player-prop provider is temporarily unavailable.'
 })[status]||'The provider has no verified player-prop prices for this selection.';
}
async function loadLiveOddsBoard(force=false){
 if(livePriceLoading)return;
 livePriceLoading=true;
 livePriceError='';
 $('odds-board-results').innerHTML='<div class="value-empty">Checking available sportsbook prices…</div>';
 try{
  const data=await getPropFeed(force);
  const rows=Array.isArray(data.offers)?data.offers:[];
  livePriceOffers=rows.filter(o=>o.side==='Over').map(o=>({
   game:o.game,game_id:o.game_id,player:o.player,
   label:o.side+' '+o.line+' '+o.market_label,
   market:o.market,side:o.side,line:o.line,
   bookmaker:o.bookmaker,bookmaker_key:o.bookmaker_key,
   odds:Number(o.odds),url:o.url,checked_at:o.checked_at,
   link_type:o.link_type||'event',id:o.id
  }));
  if(data.status!=='ok')livePriceError=explainPropFeed(data.status);
  if(!livePriceOffers.length&&!livePriceError)livePriceError=explainPropFeed('no_coverage');
 }catch(e){livePriceOffers=[];livePriceError=e.message||'Unable to retrieve player props.';}
 finally{livePriceChecked=Date.now();livePriceLoading=false;renderOddsBoard();}
}
// Assemble illustrative same-game combinations around the requested band.
// The product of single-market prices is NOT a bookmaker's same-game builder quote.
let suggestedBuilders=[];
function makeSuggestedBuilders(offers,target){
 const bands=oddsIntervals[target];
 const groups=new Map();
 const now=Date.now();
 for(const o of offers){
  if(!o.game_id||!o.player||!o.market||!o.bookmaker_key||!Number.isFinite(o.odds)||
      o.odds<1.12||o.odds>2.55||!Number.isFinite(Date.parse(o.checked_at))||
      now-Date.parse(o.checked_at)>1800000)continue;
  const key=o.game_id+'|'+o.bookmaker_key;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(o);
 }
 const options=[];
 for(const [groupKey,rows] of groups){
  // Limit to one line per player and market, eliminating repetitive/contradictory props.
  const seen=new Map();
  for(const o of rows){
   if(o.side!=='Over')continue;
   const key=o.player.toLowerCase()+'|'+o.market;
   const existing=seen.get(key);
   if(!existing||Math.abs(o.odds-1.55)<Math.abs(existing.odds-1.55))seen.set(key,o);
  }
  const eligible=[...seen.values()].sort((x,y)=>x.player.localeCompare(y.player)).slice(0,24);
  if(eligible.length<2)continue;
  // Bounded beam search produces 2-4 different-player selections.
  let beam=[{legs:[],estimate:1,players:new Set(),next:0}];
  for(let depth=1;depth<=4;depth++){
   const next=[];
   for(const state of beam){
    for(let i=state.next;i<eligible.length;i++){
     const leg=eligible[i];
     if(state.players.has(leg.player.toLowerCase()))continue;
     const estimate=state.estimate*leg.odds;
     if(estimate>bands[1]*1.25)continue;
     const players=new Set(state.players);players.add(leg.player.toLowerCase());
     const draft={legs:[...state.legs,leg],estimate,players,next:i+1};
     next.push(draft);
     if(depth>=2&&estimate>=bands[0]&&estimate<=bands[1]){
      options.push({legs:draft.legs,estimate,game:leg.game,
       bookmaker:leg.bookmaker,bookmaker_key:leg.bookmaker_key,game_id:leg.game_id});
     }
    }
   }
   next.sort((x,y)=>Math.abs(Math.log(x.estimate/target))-
    Math.abs(Math.log(y.estimate/target)));
   beam=next.slice(0,85);
   if(!beam.length)break;
  }
 }
 options.sort((x,y)=>{
   const xb=x.bookmaker_key==='bet365',yb=y.bookmaker_key==='bet365';
   if(xb!==yb)return xb?-1:1;
   return Math.abs(x.estimate-target)-Math.abs(y.estimate-target);
 });
 // Avoid displaying many near-identical combinations.
 const unique=new Set();
 return options.filter(x=>{
  const k=x.game_id+'|'+x.legs.map(l=>l.player).sort().join('|');
  if(unique.has(k))return false;unique.add(k);return true;
 }).slice(0,6);
}
function trustedBet365Url(value){
 try {
  const u=new URL(value);
  const h=u.hostname.toLowerCase();
  if(u.protocol==='https:' && /(^|\\.)bet365\\.(com|co\\.uk)$/.test(h))return u.href;
 }catch{}
 return null;
}
function builderBet365Link(legs){
 const verified=(legs||[]).find(leg=>String(leg.bookmaker_key||'').toLowerCase()==='bet365'&&trustedBet365Url(leg.url));
 return verified?trustedBet365Url(verified.url):'https://www.bet365.com/';
}
function openBet365ForSelections(text,legs){
 // Browser popup blockers require the destination to open within this click.
 const target=builderBet365Link(legs);
 const newTab=window.open(target,'_blank','noopener,noreferrer');
 if(!newTab)window.location.assign(target);
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(text).then(()=>{},()=>{window.prompt('Copy your selections:',text);});
 }else window.prompt('Copy your selections:',text);
}
function shareableBuilderUrl(gameId,legs){
 if(!/^\d{7,15}$/.test(String(gameId)))return null;
 if(!Array.isArray(legs)||!legs.length||legs.length>8)return null;
 const clean=legs.map(l=>({
  player:String(l.player||'').slice(0,90),
  market:String(l.market||'').slice(0,45),
  market_label:String(l.market_label||l.market||'').slice(0,65),
  side:l.side==='Under'?'Under':'Over',
  line:Number(l.line)
 }));
 if(clean.some(l=>!l.player||!l.market||!Number.isFinite(l.line)))return null;
 const data={v:1,game_id:String(gameId),legs:clean};
 const url=new URL('/props.html',window.location.origin);
 url.searchParams.set('builder',JSON.stringify(data));
 return url.href;
}
async function copyEdgeCheckShareLink(gameId,legs,button){
 const url=shareableBuilderUrl(gameId,legs);
 if(!url)return;
 try{
  await navigator.clipboard.writeText(url);
  if(button)button.textContent='Share link copied ✓';
  if($('share-feedback'))$('share-feedback').textContent='Anyone with this link can view your selections on EdgeCheck. They must enter them into their bookmaker manually.';
 }catch{window.prompt('Copy this EdgeCheck builder link:',url);}
}
function suggestedBuilderText(b){
 return ['EdgeCheck suggested NFL bet builder',b.game,
  ...b.legs.map((l,i)=>(i+1)+'. '+l.player+' | '+l.side+' '+l.line+' '+(l.market_label||l.market)),
  '','Illustrative multiplied single-leg decimal odds: '+b.estimate.toFixed(2),
  'NOT a quoted bet365 Bet Builder price. Same-game selections can be correlated.',
  'Enter manually in bet365 Bet Builder and check the actual combined price, availability and player status.'].join('\n');
}
function renderOddsBoard(){
 const el=$('odds-board-results');if(!el)return;
 document.querySelectorAll('[data-odds-tier]').forEach(b=>{
  const active=Number(b.dataset.oddsTier)===activeOddsTier;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
 suggestedBuilders=makeSuggestedBuilders(
  selectedBuilderGame?livePriceOffers.filter(o=>String(o.game_id)===selectedBuilderGame):livePriceOffers,
  activeOddsTier
 );
 $('odds-board-date').textContent=livePriceChecked?
   'Source prices checked '+new Date(livePriceChecked).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})+' UK':
   'Waiting for bookmaker market prices';
 $('odds-board-count').textContent=suggestedBuilders.length+' possible builders';
 if(!suggestedBuilders.length){
  el.innerHTML='<div class="value-empty"><strong>No qualifying same-game builders around '+
   activeOddsTier.toFixed(2)+'</strong><p>'+
   escapeHtml(livePriceError||(selectedBuilderGame?
    'No matching 2–4-leg combination around this decimal target was found for the selected NFL game. Try another target or fixture.':
    'No matching combination of 2–4 independently priced selections from one game and one bookmaker is currently available. This may be a free-feed coverage limitation.'))+
   '</p><button class="compare-btn" id="refresh-odds" type="button">Check prices again</button></div>';
  return;
 }
 el.innerHTML=suggestedBuilders.map((b,i)=>
  '<article class="odds-offer combo-card"><div class="odds-offer-header"><div>'+
  '<span class="overline">'+escapeHtml(b.game)+'</span><h3>'+b.legs.length+
  '-leg bet builder idea</h3><small>Source: '+escapeHtml(b.bookmaker)+
  ' · Individual market quotes only</small></div>'+
  '<div class="combo-odds"><strong class="bigodds">~'+b.estimate.toFixed(2)+'</strong><small>Illustrative total</small></div></div>'+
  '<ol class="combo-legs">'+b.legs.map(leg=>
   '<li><strong>'+escapeHtml(leg.player)+'</strong> · '+escapeHtml(leg.side+' '+leg.line+' '+(leg.market_label||leg.market))+
   ' <small>('+leg.odds.toFixed(2)+' single price)</small></li>').join('')+'</ol>'+
  '<p class="no-picks">The estimated total multiplies standalone prices. A real bet365 Bet Builder can offer different odds, restrict legs or reject the combination.</p>'+
  '<div class="combo-actions"><button type="button" class="compare-btn" data-copy-suggested="'+i+'">Copy builder</button>'+
  '<button type="button" class="compare-btn" data-load-suggested="'+i+'">Add to my builder</button>'+
  '<button type="button" class="compare-btn" data-share-suggested="'+i+'">Share builder link</button>'+
  '<button type="button" class="compare-btn bet365-combo-launch" data-copy-open-suggested="'+i+'">Copy &amp; open bet365 ↗</button></div></article>'
 ).join('');
}
document.addEventListener('click',async e=>{
 const copy=e.target.closest('[data-copy-suggested]');
 const load=e.target.closest('[data-load-suggested]');
 const launch=e.target.closest('[data-copy-open-suggested]');
 const share=e.target.closest('[data-share-suggested]');
 if(!copy&&!load&&!launch&&!share)return;
 const click=copy||load||launch||share;
 const index=Number(click.dataset[copy?'copySuggested':load?'loadSuggested':launch?'copyOpenSuggested':'shareSuggested']);
 const builder=suggestedBuilders[index];if(!builder)return;
 if(share){
  await copyEdgeCheckShareLink(builder.game_id,builder.legs,share);
  return;
 }
 if(launch){
  openBet365ForSelections(suggestedBuilderText(builder),builder.legs);
  launch.textContent='Opened bet365 · selections copied';
  return;
 }
 if(copy){
  const content=suggestedBuilderText(builder);
  try{await navigator.clipboard.writeText(content);copy.textContent='Copied ✓';}
  catch{window.prompt('Copy bet builder selections:',content);}
 }else{
  builderFixture=builder.game_id;
  builderLegs=builder.legs.map(o=>({
   game_id:String(o.game_id),player:String(o.player),
   market:String(o.market),market_label:String(o.market_label||o.market),
   side:o.side,line:Number(o.line),odds:Number(o.odds),
   bookmaker:String(o.bookmaker),bookmaker_key:String(o.bookmaker_key||''),url:o.url||null
  }));
  if(document.body.dataset.page!=='props'){
    try{sessionStorage.setItem('edgecheck_pending_builder',JSON.stringify({game_id:builderFixture,legs:builderLegs}));}catch{}
    window.location.href='/props.html';
    return;
  }
  renderBuilder();
  renderLiveProps();
  document.querySelector('#live-props')?.scrollIntoView({behavior:'smooth'});
 }
});
document.querySelectorAll('[data-odds-tier]').forEach(b=>b.addEventListener('click',()=>{
 activeOddsTier=Number(b.dataset.oddsTier);
 if(!livePriceChecked)loadLiveOddsBoard();else renderOddsBoard();
}));
document.addEventListener('click',e=>{if(e.target.closest('#refresh-odds'))loadLiveOddsBoard();});
renderOddsBoard();


// Compare exact quoted player props across available UK bookmakers.
document.addEventListener('click', async event => {
  const btn = event.target.closest('[data-compare-game]');
  if (!btn) return;
  const id = btn.getAttribute('data-compare-game');
  if (!/^\d{7,15}$/.test(id)) return;
  const panel = document.getElementById('bookmaker-results-' + id);
  if (!panel) return;
  btn.disabled = true;
  panel.textContent = 'Checking available UK bookmaker prices…';
  try {
    const response = await fetch('/api/compare-odds?game=' + encodeURIComponent(id));
    if (!response.ok) throw Error('No response');
    const data = await response.json();
    if (data.status !== 'ok') {
      const messages = {
        not_configured: 'ParlayAPI has not been configured for this website.',
        plan_required: 'The ParlayAPI account does not currently permit this player-prop request.',
        key_invalid: 'ParlayAPI rejected the API key. Check your ParlayAPI account.',
        market_not_supported: 'The requested player-prop market is not supported.',
        no_event_coverage: 'This NFL game is not currently covered by the selected odds provider.',
        no_uk_prop_coverage: 'No verified UK bookmaker player-prop prices are available for this fixture.',
        no_exact_lines: 'ParlayAPI returned no recent verified bet365 or Unibet quote for these exact player targets. Its coverage may mainly be outside the UK.',
        not_upcoming: 'Pre-match prices are no longer available for this fixture.',
        provider_unavailable: 'Price provider temporarily unavailable. Check prices directly with bookmakers.',
        quota_exhausted: 'ParlayAPI has reached its current rate or credit limit. Try again after the allowance renews.',
        no_selections: 'No suitable player selections available for comparison.'
      };
      panel.textContent = messages[data.status] || 'No verified prices available right now.';
      return;
    }
    const comparisons = Array.isArray(data.comparisons) ? data.comparisons : [];
    panel.innerHTML = comparisons.map(item => {
      const quotes = Array.isArray(item.quotes) ? item.quotes : [];
      return `<div class="bookmaker-line"><strong>${escapeHtml(item.player)}: ${escapeHtml(item.label)}</strong>
        ${quotes.length ? quotes.slice(0, 4).map((q, i) => {
          let link = '';
          if (q.url) {
            const label = q.link_type === 'selection' ? 'Open selection' :
              q.link_type === 'market' ? 'Open market' : 'Open game';
            link = `<a href="${escapeHtml(q.url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
          }
          return `<div class="bookmaker-quote">${i === 0 ? '<span class="best-quote">Best price</span>' : ''}
            <span>${escapeHtml(q.bookmaker)}</span><b>${Number(q.odds).toFixed(2)}</b>${link}
            <small>Checked ${escapeHtml(new Date(q.checked_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}))} UK</small>
          </div>`;
        }).join('') : '<p class="no-picks">No fresh UK bookmaker quote for this exact player and target.</p>'}
      </div>`;
    }).join('') + '<p class="no-picks">Prices may change. Links are only as specific as the bookmaker permits. Confirm the selection before betting.</p>';
  } catch {
    panel.textContent = 'Unable to retrieve prices. Please try again later.';
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener('click', e=>{
 const btn=e.target.closest('[data-risk-choice]');if(!btn)return;
 const tier=btn.dataset.riskChoice;
 if(!['balanced','higher'].includes(tier))return;
 document.querySelectorAll('[data-risk-choice]').forEach(b=>{const selected=b.dataset.riskChoice===tier;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
 document.querySelectorAll('[data-risk-group]').forEach(el=>el.hidden=el.dataset.riskGroup!==tier);
});


// Copyable single-game bet365 player-prop list. Bet365 does not expose a
// documented public import API; copied text is for manual selection.
let builderLegs=[];
let builderFixture='';
let builderAllOffers=[];
let builderStatus='';
let builderBusy=false;
const builderLabel=o=>o.player+' | '+o.side+' '+o.line+' '+o.market_label;
function builderGames(){
 const select=$('prop-game');
 if(!select)return;
 const existing=select.value;
 const games=currentUpcomingGames.filter(g=>Date.parse(g.kickoff)>Date.now());
 select.innerHTML='<option value="">Choose a fixture…</option>'+games.map(g=>
   '<option value="'+escapeHtml(String(g.id))+'">'+escapeHtml(g.away+' at '+g.home)+' · '+escapeHtml(prettyKickoff(g.kickoff))+'</option>').join('');
 select.value=games.some(g=>String(g.id)===existing)?existing:(builderFixture||String(games[0]?.id||''));
 if(!select.value&&games[0])select.value=String(games[0].id);
}
function builderFixtureName(id){
 const g=currentUpcomingGames.find(g=>String(g.id)===String(id));
 return g?g.away+' at '+g.home:'NFL fixture';
}
function renderBuilder(){
 const box=$('builder-legs');if(!box)return;
 $('builder-count').textContent=String(builderLegs.length);
 $('builder-game').textContent=builderFixture?builderFixtureName(builderFixture):'Choose an NFL fixture and add player props.';
 box.innerHTML=builderLegs.length?builderLegs.map((leg,i)=>{
  const price=leg.odds?' · '+Number(leg.odds).toFixed(2)+' at '+escapeHtml(leg.bookmaker):' · target only, no verified price';
  return '<div class="builder-leg"><div><strong>'+escapeHtml(builderLabel(leg))+'</strong><small>'+price+'</small></div><button type="button" data-builder-remove="'+i+'" aria-label="Remove '+escapeHtml(leg.player)+'">×</button></div>';
 }).join(''):'<p class="no-picks">No selections added yet.</p>';
 $('copy-builder').disabled=!builderLegs.length;
}
function addBuilderLeg(offer){
 if(!offer||!offer.player||!offer.market||!Number.isFinite(Number(offer.line)))return;
 const id=String(offer.game_id||'');
 if(!id)return;
 if(builderFixture&&builderFixture!==id){
  // A bet365 Bet Builder is for ONE fixture, never concatenate cross-game bets.
  builderLegs=[];
 }
 builderFixture=id;
 const gameSelect=$('prop-game');
 if(gameSelect)gameSelect.value=id;
 const same=builderLegs.findIndex(v=>v.player===offer.player&&v.market===offer.market);
 const leg={game_id:id,player:String(offer.player),market:String(offer.market),
  market_label:String(offer.market_label||marketNames[offer.market]||offer.market),
  side:offer.side==='Under'?'Under':'Over',line:Number(offer.line),
  odds:Number.isFinite(Number(offer.odds))&&Number(offer.odds)>1?Number(offer.odds):null,
  bookmaker:String(offer.bookmaker||''),bookmaker_key:String(offer.bookmaker_key||''),url:offer.url||null};
 if(same>=0)builderLegs.splice(same,1,leg);
 else if(builderLegs.length<8)builderLegs.push(leg);
 else{$('props-status').textContent='This builder has a maximum of eight selections.';return;}
 if(document.body.dataset.page!=='props'){
  try{sessionStorage.setItem('edgecheck_pending_builder',JSON.stringify({game_id:builderFixture,legs:builderLegs}));}catch{}
  window.location.href='/props.html';
  return;
 }
 renderBuilder();renderLiveProps();
}
function filteredProps(){
 const gameId=$('prop-game')?.value||'';
 const market=$('prop-market')?.value||'';
 const rows=builderAllOffers.filter(o=>String(o.game_id)===gameId&&(!market||o.market===market)&&
  Date.parse(o.kickoff)>Date.now()&&Number(o.odds)>1);
 const deduped=new Map();
 for(const o of rows){
  const key=[o.player,o.market,o.side,o.line].join('|');
  const previous=deduped.get(key);
  // Prefer a quote explicitly sourced from bet365, otherwise the top comparable price.
  if(!previous||(o.bookmaker_key==='bet365'&&previous.bookmaker_key!=='bet365')||
    (o.bookmaker_key===previous.bookmaker_key&&o.odds>previous.odds))deduped.set(key,o);
 }
 const sort=$('prop-sort')?.value||'odds-desc';
 const selected=Array.from(deduped.values());
 const byPlayer=(a,b)=>a.player.localeCompare(b.player)||a.market_label.localeCompare(b.market_label)||Number(a.line)-Number(b.line);
 selected.sort((a,b)=>{
  if(sort==='odds-asc')return Number(a.odds)-Number(b.odds)||byPlayer(a,b);
  if(sort==='player-asc')return byPlayer(a,b);
  if(sort==='player-desc')return -a.player.localeCompare(b.player)||a.market_label.localeCompare(b.market_label)||Number(a.line)-Number(b.line);
  return Number(b.odds)-Number(a.odds)||byPlayer(a,b);
 });
 return selected.slice(0,75);
}
function renderLiveProps(){
 const el=$('live-props-results');if(!el)return;
 builderGames();
 const rows=filteredProps();
 $('props-status').textContent=builderStatus||'Showing '+rows.length+' priced props · quotes are not guaranteed at bet365';
 if(!rows.length){
  el.innerHTML='<div class="value-empty"><strong>No fresh priced props for this fixture and market.</strong><p>'+escapeHtml(builderStatus||'Try another fixture or market, or add a statistical target from the suggested picks. No odds will be invented.')+'</p></div>';
  return;
 }
 el.innerHTML='<div class="prop-offer-list">'+rows.map(o=>{
  const is365=o.bookmaker_key==='bet365';
  const label=o.side+' '+o.line+' '+o.market_label;
  const added=builderLegs.some(l=>l.game_id===o.game_id&&l.player===o.player&&l.market===o.market&&l.line===o.line&&l.side===o.side);
  return '<div class="prop-offer"><div class="prop-offer-info"><strong>'+escapeHtml(o.player)+'</strong><small>'+escapeHtml(label)+'</small><small>'+escapeHtml(o.bookmaker)+' · '+escapeHtml(is365?'bet365 source quote':'Reference quote, not a bet365 price')+' · '+escapeHtml(new Date(o.checked_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}))+' UK</small></div><b>'+Number(o.odds).toFixed(2)+'</b><button type="button" data-add-live="'+escapeHtml(o.id)+'">'+(added?'Change':'Add')+'</button></div>';
 }).join('')+'</div>';
}
async function loadPlayerProps(force=false){
 if(builderBusy)return;
 builderBusy=true;builderStatus='Checking live player props…';renderLiveProps();
 try{
  const data=await getPropFeed(force);
  builderAllOffers=Array.isArray(data.offers)?data.offers:[];
  builderStatus=data.status==='ok'?'':explainPropFeed(data.status);
 }catch(e){builderAllOffers=[];builderStatus='Player-prop feed could not be loaded.';}
 finally{builderBusy=false;renderLiveProps();}
}
$('prop-game')?.addEventListener('change',e=>{
 if(builderLegs.length&&builderFixture&&builderFixture!==e.target.value){
   builderLegs=[];builderFixture=e.target.value;renderBuilder();
 }
 renderLiveProps();
});
$('prop-market')?.addEventListener('change',renderLiveProps);
$('prop-sort')?.addEventListener('change',renderLiveProps);
$('load-props')?.addEventListener('click',()=>{
 // Manual refresh re-renders cached offers. It cannot repeatedly bill the provider.
 loadPlayerProps();
});
$('live-props-results')?.addEventListener('click',e=>{
 const btn=e.target.closest('[data-add-live]');if(!btn)return;
 const offer=builderAllOffers.find(o=>o.id===btn.dataset.addLive);
 if(offer)addBuilderLeg(offer);
});
$('builder-legs')?.addEventListener('click',e=>{
 const btn=e.target.closest('[data-builder-remove]');if(!btn)return;
 const i=Number(btn.dataset.builderRemove);
 if(Number.isInteger(i)&&i>=0&&i<builderLegs.length){builderLegs.splice(i,1);renderBuilder();renderLiveProps();}
});
$('clear-builder')?.addEventListener('click',()=>{builderLegs=[];builderFixture='';renderBuilder();renderLiveProps();});
$('open-copied-builder')?.addEventListener('click',()=>{
 if(!builderLegs.length)return;
 const text=['EdgeCheck NFL Bet Builder',builderFixtureName(builderFixture),
 ...builderLegs.map((l,i)=>(i+1)+'. '+builderLabel(l)),
 '','Open the game in bet365, tap Bet Builder, and add these manually.',
 'Prices and combined odds must be verified in bet365.'].join('\\n');
 openBet365ForSelections(text,builderLegs);
});
$('share-builder')?.addEventListener('click',()=>copyEdgeCheckShareLink(builderFixture,builderLegs,$('share-builder')));
$('copy-builder')?.addEventListener('click',async()=>{
 if(!builderLegs.length)return;
 const text=['EdgeCheck NFL Bet Builder selections','Game: '+builderFixtureName(builderFixture),
   ...builderLegs.map((l,i)=>(i+1)+'. '+builderLabel(l)),
   '','Enter these selections manually at bet365 → Bet Builder.',
   'Check actual available lines, injuries and the combined Bet Builder odds. These are NOT pre-priced combined odds.'].join('\n');
 try{
  await navigator.clipboard.writeText(text);
  const btn=$('copy-builder');btn.textContent='Copied selections ✓';
  setTimeout(()=>btn.textContent='Copy bet builder selections',1800);
 }catch{window.prompt('Copy your bet builder selections:',text);}
});
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-add-suggested]');if(!button)return;
 const payload=button.dataset.addSuggested;
 try{
  const p=JSON.parse(decodeURIComponent(payload));
  if(p&&Number.isFinite(Number(p.line))){
   addBuilderLeg({game_id:p.game_id,player:p.player,market:p.market,
    market_label:marketNames[p.market]||p.market,side:'Over',
    line:Number(p.line)-0.5,bookmaker:'',odds:null});
   document.querySelector('#live-props')?.scrollIntoView({behavior:'smooth'});
  }
 }catch{}
});
if(document.body.dataset.page==='props'){
 try {
  const shared=new URL(window.location.href).searchParams.get('builder');
  if(shared && shared.length<4500){
   const payload=JSON.parse(shared);
   if(payload.v===1 && /^\d{7,15}$/.test(String(payload.game_id)) &&
      Array.isArray(payload.legs) && payload.legs.length>0 && payload.legs.length<=8){
    builderFixture=String(payload.game_id);
    builderLegs=payload.legs.filter(l=>l&&typeof l.player==='string'&&l.player.length<=90&&
      typeof l.market==='string'&&l.market.length<=45&&Number.isFinite(Number(l.line))&&
      (l.side==='Over'||l.side==='Under')).map(l=>({
        game_id:builderFixture,player:l.player,market:l.market,
        market_label:String(l.market_label||l.market).slice(0,65),
        side:l.side,line:Number(l.line),odds:null,bookmaker:''
    })).slice(0,8);
   }
  }else{
  const saved=sessionStorage.getItem('edgecheck_pending_builder');
  if(saved){
    sessionStorage.removeItem('edgecheck_pending_builder');
    const parsed=JSON.parse(saved);
    if(/^\d{7,15}$/.test(String(parsed.game_id))&&Array.isArray(parsed.legs)){
      builderFixture=String(parsed.game_id);
      builderLegs=parsed.legs.filter(l=>l&&String(l.game_id)===builderFixture&&l.player&&l.market&&Number.isFinite(Number(l.line))).slice(0,8);
    }
  }
  }
 }catch{}
 renderBuilder();
 loadPlayerProps();
}

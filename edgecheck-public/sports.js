'use strict';
// Fixture-only sports hub. No invented prop prices or suggested bets.
// ESPN's public scoreboard endpoints can change; failures are displayed plainly.
const LEAGUES=Object.freeze({
 'eng.1':'Premier League','esp.1':'La Liga','ita.1':'Serie A',
 'ger.1':'Bundesliga','fra.1':'Ligue 1','uefa.champions':'Champions League'
});
const screen=document.getElementById('sports-fixtures');
const updated=document.getElementById('schedule-updated');
const sport=document.body.dataset.page;
let chosen='eng.1';
const DAY_MS=86400000;
const asDate=d=>[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('');
const safe=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ukDate=d=>new Date(d).toLocaleDateString('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short'});
const ukTime=d=>new Date(d).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
const cache=new Map();
async function getMatches(league){
 const now=Date.now();
 const saved=cache.get(league);
 if(saved&&now-saved.time<1800000)return saved.matches;
 const from=asDate(new Date(now-DAY_MS));
 const to=asDate(new Date(now+14*DAY_MS));
 const sportPath=sport==='nba'?'basketball/nba':'soccer/'+encodeURIComponent(league);
 const url='https://site.api.espn.com/apis/site/v2/sports/'+sportPath+'/scoreboard?dates='+from+'-'+to+'&limit=250';
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),9000);
 try{
  const r=await fetch(url,{signal:ctrl.signal});
  if(!r.ok)throw Error('Fixture provider returned '+r.status);
  const data=await r.json();
  if(!Array.isArray(data.events))throw Error('Fixture feed unavailable');
  const matches=data.events.map(event=>{
   const competition=event.competitions?.[0];
   const teams=competition?.competitors||[];
   const home=teams.find(x=>x.homeAway==='home');
   const away=teams.find(x=>x.homeAway==='away');
   return {id:String(event.id),date:event.date,home:home?.team?.displayName||home?.team?.name,
    away:away?.team?.displayName||away?.team?.name,status:event.status?.type?.description||'Scheduled',
    completed:Boolean(event.status?.type?.completed)};
  }).filter(g=>g.home&&g.away&&Number.isFinite(Date.parse(g.date))&&Date.parse(g.date)>=now-2*3600000)
    .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,65);
  cache.set(league,{time:Date.now(),matches});
  return matches;
 }finally{clearTimeout(timer);}
}
function draw(matches){
 if(!matches.length){screen.innerHTML='<div class="value-empty"><strong>No fixtures found in the next fortnight.</strong><p>Try again later when the schedule provider updates.</p></div>';return;}
 const groups=new Map();
 for(const m of matches){
  const day=ukDate(m.date);
  if(!groups.has(day))groups.set(day,[]);
  groups.get(day).push(m);
 }
 screen.innerHTML=[...groups.entries()].map(([day,list])=>
  '<section class="sport-day"><h3>'+safe(day)+'</h3><div class="sport-match-grid">'+list.map(g=>
  '<article class="sport-match"><span class="sport-match-time">'+safe(ukTime(g.date))+' UK</span><strong>'+safe(g.away)+'</strong><span class="sport-match-at">at</span><strong>'+safe(g.home)+'</strong><small>'+safe(g.status)+'</small></article>').join('')+'</div></section>').join('');
}
async function render(){
 if(!screen)return;
 const league=sport==='nba'?'nba':chosen;
 screen.innerHTML='<div class="value-empty">Checking upcoming fixtures…</div>';
 updated.textContent='Loading '+(sport==='nba'?'NBA':LEAGUES[league])+' matches…';
 try{
  const result=await getMatches(league);
  // Ignore obsolete requests after the user switches competitions.
  if(sport==='football'&&chosen!==league)return;
  draw(result);
  updated.textContent=(sport==='nba'?'NBA':LEAGUES[league])+' · '+result.length+' upcoming '+(result.length===1?'match':'matches')+' · source: ESPN';
 }catch(e){
  if(sport==='football'&&chosen!==league)return;
  screen.innerHTML='<div class="value-empty"><strong>Fixtures are temporarily unavailable.</strong><p>Could not load '+safe(sport==='nba'?'NBA':LEAGUES[league])+' fixtures. No matches will be invented.</p><button id="retry-schedule" class="compare-btn" type="button">Try again</button></div>';
  updated.textContent='Could not reach the fixture provider';
 }
}
document.querySelectorAll('[data-league]').forEach(button=>button.addEventListener('click',()=>{
 chosen=button.dataset.league;
 document.querySelectorAll('[data-league]').forEach(b=>{const yes=b===button;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});
 render();
}));
screen?.addEventListener('click',e=>{if(e.target.closest('#retry-schedule'))render();});
render();


// Sport-specific sourced player markets and illustrative same-match builders.
const board=document.getElementById('sports-props-results');
const gamePicker=document.getElementById('sports-game');
const marketPicker=document.getElementById('sports-market');
const sortPicker=document.getElementById('sports-sort');
const oddsStatus=document.getElementById('sports-odds-status');
const comboBox=document.getElementById('sports-builder-results');
let priceCache=new Map();
let priceOffers=[];
let priceStatus='';
let chosenGame='';
let chosenMarket='';
let chosenSort='high';
let targetPrice=2;
let selectedLegs=[];
let combos=[];
const priceBands={2:[1.8,2.25],3:[2.7,3.35],4:[3.6,4.45],6:[5.4,6.65]};
const bookLink=legs=>{
 const valid=(legs||[]).find(o=>o.bookmaker_key==='bet365'&&o.url);
 if(valid){try{const u=new URL(valid.url);if(u.protocol==='https:'&&/(^|\\.)bet365\\.(com|co\\.uk)$/i.test(u.hostname))return u.href;}catch{}}
 return 'https://www.bet365.com/';
};
function selectionText(legs){
 if(!legs.length)return '';
 return ['EdgeCheck '+(sport==='nba'?'NBA':LEAGUES[chosen])+' player selections',
  legs[0].game,...legs.map((o,i)=>(i+1)+'. '+o.player+' | '+o.side+' '+o.line+' '+o.market_label),
  '','Individual bookmaker quotes are not guaranteed combined Bet Builder odds.',
  'Check all lines and player eligibility at the bookmaker before placing a bet.'].join('\n');
}
async function copySelectionText(content,button){
 try{await navigator.clipboard.writeText(content);if(button)button.textContent='Copied ✓';}
 catch{window.prompt('Copy selections:',content);}
}
function shareUrl(legs){
 if(!legs.length)return '';
 const payload={v:1,league:sport==='nba'?'nba':chosen,legs:legs.slice(0,8).map(o=>({
  game_id:o.game_id,game:o.game,player:o.player,market:o.market,
  market_label:o.market_label,side:o.side,line:o.line
 }))};
 const url=new URL(window.location.href);url.searchParams.set('selections',JSON.stringify(payload));
 return url.href;
}
function selectedFixture(){
 return priceOffers.filter(o=>!chosenGame||o.game_id===chosenGame);
}
function renderPriceFilters(){
 if(!gamePicker||!marketPicker)return;
 const fixtures=new Map();
 for(const o of priceOffers){if(!fixtures.has(o.game_id))fixtures.set(o.game_id,{game:o.game,kickoff:o.kickoff});}
 const ordered=[...fixtures.entries()].sort((a,b)=>Date.parse(a[1].kickoff)-Date.parse(b[1].kickoff));
 if(chosenGame&&!fixtures.has(chosenGame))chosenGame='';
 gamePicker.innerHTML='<option value="">All upcoming matches</option>'+ordered.map(([id,g])=>
  '<option value="'+safe(id)+'">'+safe(g.game)+' · '+safe(ukDate(g.kickoff))+'</option>').join('');
 gamePicker.value=chosenGame;
 const markets=new Map();
 for(const o of priceOffers.filter(o=>!chosenGame||o.game_id===chosenGame))markets.set(o.market,o.market_label);
 if(chosenMarket&&!markets.has(chosenMarket))chosenMarket='';
 marketPicker.innerHTML='<option value="">All available markets</option>'+[...markets.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=>
  '<option value="'+safe(id)+'">'+safe(name)+'</option>').join('');
 marketPicker.value=chosenMarket;sortPicker.value=chosenSort;
}
function bestAvailableOffers(rows){
 const dedup=new Map();
 for(const o of rows){
  const key=[o.game_id,o.player,o.market,o.side,o.line].join('|');
  const old=dedup.get(key);
  if(!old||(o.bookmaker_key==='bet365'&&old.bookmaker_key!=='bet365')||
   (o.bookmaker_key===old.bookmaker_key&&o.odds>old.odds))dedup.set(key,o);
 }
 return [...dedup.values()];
}
function refreshOddsResults(){
 if(!board)return;
 renderPriceFilters();
 let rows=bestAvailableOffers(selectedFixture().filter(o=>!chosenMarket||o.market===chosenMarket));
 rows.sort((a,b)=>chosenSort==='low'?a.odds-b.odds:chosenSort==='name'?
  a.player.localeCompare(b.player):b.odds-a.odds);
 rows=rows.slice(0,100);
 oddsStatus.textContent=priceStatus||('Showing '+rows.length+' sourced prop quotes · cached up to 30 minutes');
 if(!rows.length){
  board.innerHTML='<div class="value-empty"><strong>No verified priced player props for this selection.</strong><p>'+safe(priceStatus||'Try another match, market or competition. Coverage depends on your connected provider plan.')+'</p></div>';
 }else{
  board.innerHTML='<div class="prop-offer-list">'+rows.map(o=>
   '<div class="prop-offer"><div class="prop-offer-info"><strong>'+safe(o.player)+'</strong><small>'+safe(o.side+' '+o.line+' '+o.market_label)+'</small><small>'+safe(o.game)+' · '+safe(o.bookmaker)+' · '+safe(ukTime(o.checked_at))+' UK</small></div><b>'+Number(o.odds).toFixed(2)+'</b><button type="button" data-sport-add="'+safe(o.id)+'">Add</button></div>').join('')+'</div>';
 }
 renderSelectionList();
 renderCombos();
}
function renderSelectionList(){
 const el=document.getElementById('sports-builder-legs');if(!el)return;
 document.getElementById('sports-selection-count').textContent=selectedLegs.length;
 el.innerHTML=selectedLegs.length?selectedLegs.map((o,i)=>
  '<div class="builder-leg"><div><strong>'+safe(o.player)+'</strong><small>'+safe(o.side+' '+o.line+' '+o.market_label)+' · '+safe(o.game)+'</small></div><button type="button" data-sport-remove="'+i+'" aria-label="Remove '+safe(o.player)+'">×</button></div>').join(''):'<p class="no-picks">Add up to eight player props from the same fixture.</p>';
 for(const id of ['sports-copy','sports-share','sports-open'])document.getElementById(id).disabled=!selectedLegs.length;
}
function makeSportCombos(){
 const group=new Map(),now=Date.now();
 for(const o of selectedFixture()){
  if(!o.game_id||!o.player||!o.bookmaker_key||!Number.isFinite(o.odds)||
     o.odds<1.12||o.odds>3.5||now-Date.parse(o.checked_at)>1800000)continue;
  const key=o.game_id+'|'+o.bookmaker_key;
  if(!group.has(key))group.set(key,[]);
  group.get(key).push(o);
 }
 const found=[];
 for(const lines of group.values()){
  const dedup=new Map();
  for(const o of lines){
   if(o.side!=='Over')continue;
   const k=o.player.toLowerCase()+'|'+o.market;
   const old=dedup.get(k);
   if(!old||Math.abs(o.odds-1.55)<Math.abs(old.odds-1.55))dedup.set(k,o);
  }
  const eligible=[...dedup.values()].sort((a,b)=>a.player.localeCompare(b.player)).slice(0,22);
  if(eligible.length<2)continue;
  let beam=[{legs:[],next:0,price:1,players:new Set()}];
  for(let depth=1;depth<=4;depth++){
   const next=[];
   for(const state of beam)for(let i=state.next;i<eligible.length;i++){
    const leg=eligible[i];if(state.players.has(leg.player.toLowerCase()))continue;
    const price=state.price*leg.odds;if(price>priceBands[targetPrice][1]*1.3)continue;
    const players=new Set(state.players);players.add(leg.player.toLowerCase());
    const draft={legs:[...state.legs,leg],price,next:i+1,players};
    next.push(draft);
    if(depth>=2&&price>=priceBands[targetPrice][0]&&price<=priceBands[targetPrice][1])
      found.push(draft);
   }
   next.sort((a,b)=>Math.abs(a.price-targetPrice)-Math.abs(b.price-targetPrice));
   beam=next.slice(0,70);if(!beam.length)break;
  }
 }
 found.sort((a,b)=>Math.abs(a.price-targetPrice)-Math.abs(b.price-targetPrice));
 const unique=new Set();return found.filter(c=>{
  const k=c.legs[0].game_id+'|'+c.legs.map(o=>o.player).sort().join('|');
  if(unique.has(k))return false;unique.add(k);return true;
 }).slice(0,6);
}
function renderCombos(){
 if(!comboBox)return;
 document.querySelectorAll('[data-sports-target]').forEach(b=>b.classList.toggle('active',Number(b.dataset.sportsTarget)===targetPrice));
 combos=makeSportCombos();
 comboBox.innerHTML=combos.length?combos.map((c,i)=>'<article class="odds-offer combo-card"><div class="odds-offer-header"><div><span class="overline">'+safe(c.legs[0].game)+'</span><h3>'+c.legs.length+'-leg builder idea</h3><small>Source: '+safe(c.legs[0].bookmaker)+'</small></div><div class="combo-odds"><strong class="bigodds">~'+c.price.toFixed(2)+'</strong><small>Illustrative only</small></div></div><ol class="combo-legs">'+c.legs.map(o=>'<li><strong>'+safe(o.player)+'</strong> · '+safe(o.side+' '+o.line+' '+o.market_label)+' <small>('+o.odds.toFixed(2)+')</small></li>').join('')+'</ol><div class="combo-actions"><button class="compare-btn" type="button" data-sport-combo="'+i+'">Add to my selections</button><button class="compare-btn" type="button" data-sport-combo-share="'+i+'">Copy share link</button></div><p class="no-picks">Estimated total multiplies separate prices. Same-game correlation can change or invalidate bookmaker odds.</p></article>').join(''):
 '<div class="value-empty"><strong>No sourced '+targetPrice.toFixed(2)+' builder combinations are available.</strong><p>Try another fixture or target. This tool never invents prices or player selections.</p></div>';
}
async function loadSportsPrices(){
 if(!board)return;
 const league=sport==='nba'?'nba':chosen;
 const existing=priceCache.get(league);
 if(existing&&Date.now()-existing.when<1800000){applyPrices(league,existing.data);return;}
 priceStatus='Checking cached '+(sport==='nba'?'NBA':LEAGUES[league])+' player markets…';refreshOddsResults();
 try{
  const response=await fetch('/api/sports-props?league='+encodeURIComponent(league));
  const data=await response.json();
  if(!response.ok)throw Error('Provider gateway returned '+response.status);
  priceCache.set(league,{when:Date.now(),data});
  if(sport==='football'&&league!==chosen)return;
  applyPrices(league,data);
 }catch(e){
  if(sport==='football'&&league!==chosen)return;
  priceOffers=[];priceStatus='Player-prop feed unavailable. Check the API plan or try later.';refreshOddsResults();
 }
}
function applyPrices(league,data){
 priceOffers=Array.isArray(data.offers)?data.offers:[];
 priceStatus=data.status==='ok'?'':({
  not_configured:'No ParlayAPI key is configured.',
  key_invalid:'The connected odds key was rejected.',
  plan_required:'The provider plan cannot access these player markets.',
  quota_exhausted:'The provider has reached its API credit or rate limit.',
  no_coverage:'The provider returned no recent verified player-prop quotes for this competition.',
  provider_unavailable:'Player-prop provider temporarily unavailable.'
 })[data.status]||'No verified player-prop prices are available.';
 refreshOddsResults();
}
if(board){
 gamePicker.addEventListener('change',e=>{chosenGame=e.target.value;chosenMarket='';refreshOddsResults();});
 marketPicker.addEventListener('change',e=>{chosenMarket=e.target.value;refreshOddsResults();});
 sortPicker.addEventListener('change',e=>{chosenSort=e.target.value;refreshOddsResults();});
 document.getElementById('sports-reload').addEventListener('click',loadSportsPrices);
 document.querySelectorAll('[data-sports-target]').forEach(b=>b.addEventListener('click',()=>{targetPrice=Number(b.dataset.sportsTarget);renderCombos();}));
 board.addEventListener('click',e=>{
  const btn=e.target.closest('[data-sport-add]');if(!btn)return;
  const offer=priceOffers.find(o=>o.id===btn.dataset.sportAdd);if(!offer)return;
  if(selectedLegs.length&&selectedLegs[0].game_id!==offer.game_id)selectedLegs=[];
  const key=o=>o.player+'|'+o.market;
  const position=selectedLegs.findIndex(o=>key(o)===key(offer));
  if(position>=0)selectedLegs.splice(position,1,offer);
  else if(selectedLegs.length<8)selectedLegs.push(offer);
  renderSelectionList();
 });
 document.getElementById('sports-builder-legs').addEventListener('click',e=>{
  const btn=e.target.closest('[data-sport-remove]');if(!btn)return;
  selectedLegs.splice(Number(btn.dataset.sportRemove),1);renderSelectionList();
 });
 document.getElementById('sports-clear').addEventListener('click',()=>{selectedLegs=[];renderSelectionList();});
 document.getElementById('sports-copy').addEventListener('click',e=>copySelectionText(selectionText(selectedLegs),e.target));
 document.getElementById('sports-share').addEventListener('click',e=>copySelectionText(shareUrl(selectedLegs),e.target));
 document.getElementById('sports-open').addEventListener('click',()=>{
  const url=bookLink(selectedLegs);
  const tab=window.open(url,'_blank','noopener,noreferrer');if(!tab)window.location.assign(url);
  copySelectionText(selectionText(selectedLegs));
 });
 comboBox.addEventListener('click',e=>{
  const add=e.target.closest('[data-sport-combo]');
  const share=e.target.closest('[data-sport-combo-share]');
  if(!add&&!share)return;
  const combo=combos[Number((add||share).dataset[add?'sportCombo':'sportComboShare'])];
  if(!combo)return;
  if(share){copySelectionText(shareUrl(combo.legs),share);return;}
  selectedLegs=[...combo.legs];renderSelectionList();
  document.getElementById('sports-selection-count').scrollIntoView({behavior:'smooth',block:'center'});
 });
 // Share links restore the same selections even after the original prices become stale.
 try{
  const raw=new URL(location.href).searchParams.get('selections');
  if(raw&&raw.length<4500){
   const payload=JSON.parse(raw),league=sport==='nba'?'nba':chosen;
   if(payload.v===1&&payload.league===league&&Array.isArray(payload.legs)&&payload.legs.length<=8){
    selectedLegs=payload.legs.filter(o=>o&&typeof o.player==='string'&&o.player.length<100&&
       typeof o.market==='string'&&Number.isFinite(Number(o.line))&&
       typeof o.game_id==='string'&&typeof o.game==='string').map(o=>({
      game_id:o.game_id,game:o.game.slice(0,150),player:o.player,
      market:o.market,market_label:String(o.market_label||o.market).slice(0,80),
      side:o.side==='Under'?'Under':'Over',line:Number(o.line),bookmaker:'',bookmaker_key:'',url:null
    })).slice(0,8);
   }
  }
 }catch{}
 renderSelectionList();
 loadSportsPrices();
}

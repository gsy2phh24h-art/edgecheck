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

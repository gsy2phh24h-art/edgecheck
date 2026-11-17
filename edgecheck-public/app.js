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
  if(!games.length){out.innerHTML='<div class="value-empty"><strong>No upcoming fixtures in the latest update.</strong><p>The next fixture refresh will check the NFL schedule again.</p></div>';return;}
  out.innerHTML='<div class="risk-picker" role="group" aria-label="Pick difficulty"><button type="button" class="active" data-risk-choice="balanced">Balanced targets</button><button type="button" data-risk-choice="higher">Higher-risk targets</button></div>'+games.map(g=>{const before=Date.parse(g.kickoff)>Date.now();const picks=before&&Array.isArray(g.suggestions)?g.suggestions:[];const boldPicks=before&&Array.isArray(g.higher_risk_suggestions)?g.higher_risk_suggestions:[];
    return `<article class="match-card"><div class="match-head"><div><span class="overline">NFL MATCHUP</span><h3>${escapeHtml(g.away)} <span class="muted">at</span> ${escapeHtml(g.home)}</h3><small>${escapeHtml(prettyKickoff(g.kickoff))}</small></div><span class="tag">${before?'UPCOMING':'STARTED / FINISHED'}</span></div>
    ${['balanced','higher'].map(tier=>{const arr=tier==='balanced'?picks:boldPicks;return `<div class="risk-group" data-risk-group="${tier}" ${tier==='higher'?'hidden':''}>${arr.length?`<div class="match-picks">${arr.map(p=>`<div class="match-pick"><div><strong>${escapeHtml(p.player)}</strong><small>${escapeHtml(p.team)} · ${escapeHtml(p.label)}</small><small>Against ${escapeHtml(p.opponent||'opponent')} · roster checked</small></div><div class="pick-rate">${p.hits}/${p.sample}<small>Last 5 hit</small></div></div>`).join('')}</div>`:'<p class="no-picks">No qualifying selections in this category. Historical performance does not guarantee future outcomes.</p>'}</div>`}).join('')}
    <p class="no-picks"><small>${escapeHtml(g.verification_note||'Roster and availability checks are not available.')}</small></p>
    ${g.defensive_context?`<details class="match-context"><summary>Opponent defence context (estimated)</summary>${Object.entries(g.defensive_context).map(([team,s])=>s?`<p><strong>${escapeHtml(team)}</strong> · Pass yards conceded/game: ${s.pass_yards_allowed_avg} · Rush yards conceded/game: ${s.rush_yards_allowed_avg} · ${s.sample_games} games</p>`:'').join('')}<small>${escapeHtml(g.context_note||'Approximations from weekly game logs, not official defensive statistics.')}</small></details>`:''}
    ${before && (picks.length || boldPicks.length) ? `<div class="compare-actions"><button class="compare-btn" type="button" data-compare-game="${escapeHtml(String(g.id))}">Compare UK bookmaker prices</button><div id="bookmaker-results-${escapeHtml(String(g.id))}" class="bookmaker-results" aria-live="polite"></div></div>` : ''}
    <a href="https://www.bet365.com/" class="check-bookmaker" target="_blank" rel="noopener noreferrer">Check available markets at bet365 ↗</a><p class="no-picks"><a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Check official NFL injury reports ↗</a> · Confirm line-ups and market availability before betting.</p>
    </article>`}).join('');
 }catch(e){$('picks-date').textContent='No current suggestions';$('picks-updated').textContent='';out.innerHTML='<div class="value-empty"><strong>Today’s suggestions are not available yet.</strong><p>Game picks will appear automatically after the statistics and matchup data have been imported. No unverified recommendations are shown.</p></div>';}}
loadGamePicks();


// Real decimal-odds board. Individual verified quotes only; never invent acca prices.
let activeOddsTier=2;
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
async function getPropFeed(force=false){
 if(!force&&propFeedCache&&Date.now()-propFeedAt<180000)return propFeedCache;
 if(propFeedPromise)return propFeedPromise;
 propFeedPromise=(async()=>{
  const response=await fetch('/api/props-board?cb='+Math.floor(Date.now()/180000),{cache:'no-store'});
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
function renderOddsBoard(){
 const el=$('odds-board-results');if(!el)return;
 document.querySelectorAll('[data-odds-tier]').forEach(b=>{
   const active=Number(b.dataset.oddsTier)===activeOddsTier;
   b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
 const band=oddsIntervals[activeOddsTier];
 const filtered=livePriceOffers.filter(q=>q.odds>=band[0]&&q.odds<=band[1]);
 $('odds-board-date').textContent=livePriceChecked?'Prices checked '+new Date(livePriceChecked).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})+' UK':'Live bookmaker prices · not yet checked';
 $('odds-board-count').textContent=filtered.length+' quoted player props';
 if(!filtered.length){
  el.innerHTML='<div class="value-empty"><strong>No verified player-prop quotes around '+activeOddsTier.toFixed(2)+'</strong><p>'+escapeHtml(livePriceError||'The connected feed has not supplied prices in this range. The buttons filter actual single-bet prices, not bet-builder totals.')+'</p><button class="compare-btn" id="refresh-odds" type="button">Check prices again</button></div>';
  return;
 }
 el.innerHTML=filtered.map(q=>{
   const link=q.url?'<a class="check-bookmaker" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(q.url)+'">Open '+escapeHtml(q.link_type==='selection'?'selection':q.link_type==='market'?'market':'match')+' ↗</a>':'';
   return '<article class="odds-offer"><div class="odds-offer-header"><div><span class="overline">'+escapeHtml(q.game)+'</span><h3>'+escapeHtml(q.player)+' · '+escapeHtml(q.label)+'</h3><small>'+escapeHtml(q.bookmaker)+' · Checked '+escapeHtml(new Date(q.checked_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}))+' UK</small></div><strong class="bigodds">'+q.odds.toFixed(2)+'</strong></div>'+link+'</article>';
 }).join('')+'<p class="no-picks">These are individual bookmaker prices, not pre-priced accumulators. All quotes may change.</p>';
}
document.querySelectorAll('[data-odds-tier]').forEach(b=>b.addEventListener('click',()=>{
 activeOddsTier=Number(b.dataset.oddsTier);
 if(!livePriceChecked)loadLiveOddsBoard();else renderOddsBoard();
}));
document.addEventListener('click',e=>{if(e.target.closest('#refresh-odds')){livePriceChecked=0;loadLiveOddsBoard();}});
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

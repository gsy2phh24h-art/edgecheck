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
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  if(data.date_uk!==today)throw Error('Daily picks have not refreshed for today');
  $('picks-date').textContent='Games for '+new Date(today+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'});
  $('picks-updated').textContent='Updated '+prettyKickoff(data.updated_at);
  const games=Array.isArray(data.games)?data.games:[];
  if(!games.length){out.innerHTML='<div class="value-empty"><strong>No NFL games scheduled today.</strong><p>Check back on the next game day.</p></div>';return;}
  out.innerHTML=games.map(g=>{const before=Date.parse(g.kickoff)>Date.now();const picks=before&&Array.isArray(g.suggestions)?g.suggestions:[];
    return `<article class="match-card"><div class="match-head"><div><span class="overline">NFL MATCHUP</span><h3>${escapeHtml(g.away)} <span class="muted">at</span> ${escapeHtml(g.home)}</h3><small>${escapeHtml(prettyKickoff(g.kickoff))}</small></div><span class="tag">${before?'UPCOMING':'STARTED / FINISHED'}</span></div>
    ${picks.length?`<div class="match-picks">${picks.map(p=>`<div class="match-pick"><div><strong>${escapeHtml(p.player)}</strong><small>${escapeHtml(p.team)} · ${escapeHtml(p.label)}</small><small>Against ${escapeHtml(p.opponent||'opponent')} · roster checked</small></div><div class="pick-rate">${p.hits}/${p.sample}<small>Last 5 hit</small></div></div>`).join('')}</div>`:'<p class="no-picks">'+(before?'No roster-verified suggestions available for this matchup.':'Pregame suggestions are hidden once kickoff has passed.')+'</p>'}
    <p class="no-picks"><small>${escapeHtml(g.verification_note||'Roster and availability checks are not available.')}</small></p>
    ${g.defensive_context?`<details class="match-context"><summary>Opponent defence context (estimated)</summary>${Object.entries(g.defensive_context).map(([team,s])=>s?`<p><strong>${escapeHtml(team)}</strong> · Pass yards conceded/game: ${s.pass_yards_allowed_avg} · Rush yards conceded/game: ${s.rush_yards_allowed_avg} · ${s.sample_games} games</p>`:'').join('')}<small>${escapeHtml(g.context_note||'Approximations from weekly game logs, not official defensive statistics.')}</small></details>`:''}
    ${before && picks.length ? `<div class="compare-actions"><button class="compare-btn" type="button" data-compare-game="${escapeHtml(String(g.id))}">Compare UK bookmaker prices</button><div id="bookmaker-results-${escapeHtml(String(g.id))}" class="bookmaker-results" aria-live="polite"></div></div>` : ''}
    <a href="https://www.bet365.com/" class="check-bookmaker" target="_blank" rel="noopener noreferrer">Check available markets at bet365 ↗</a><p class="no-picks"><a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Check official NFL injury reports ↗</a> · Confirm line-ups and market availability before betting.</p>
    </article>`}).join('');
 }catch(e){$('picks-date').textContent='No current suggestions';$('picks-updated').textContent='';out.innerHTML='<div class="value-empty"><strong>Today’s suggestions are not available yet.</strong><p>Game picks will appear automatically after the statistics and matchup data have been imported. No unverified recommendations are shown.</p></div>';}}
loadGamePicks();


// Decimal odds suggestions: fail closed unless prices have a recent trusted source.
let activeOddsTier=2;
const oddsIntervals={2:[1.8,2.25],3:[2.7,3.35],4:[3.6,4.45],6:[5.4,6.65]};
const permittedSourceHosts=['bet365.com','www.bet365.com'];
const validISO=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
function todayUK(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=k=>parts.find(x=>x.type===k)?.value||'';return `${v('year')}-${v('month')}-${v('day')}`;}
function safeBookmakerUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&permittedSourceHosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:'https://www.bet365.com/';}catch{return 'https://www.bet365.com/';}}
function validOffer(o,feed){
 if(!o||o.bookmaker!=='bet365'||o.status!=='verified'||!Array.isArray(o.legs)||!o.legs.length||o.legs.length>8)return false;
 if(!Number.isFinite(o.decimal_odds)||o.decimal_odds<=1||!validISO(o.checked_at)||!validISO(o.kickoff))return false;
 if(!o.source_name||!o.source_reference||!validISO(feed.updated_at)||feed.date_uk!==todayUK())return false;
 // A quoted price must be recent, pre-kickoff, and pre-expiry. No fake 'live' labels.
 const now=Date.now(), checked=Date.parse(o.checked_at),kickoff=Date.parse(o.kickoff);
 if(checked>now+120000||now-checked>10*60*1000||now>=kickoff)return false;
 if(o.expires_at&&(!validISO(o.expires_at)||now>=Date.parse(o.expires_at)))return false;
 if(!o.game||!o.legs.every(l=>typeof l==='string'&&l.trim().length>0))return false;
 return true;
}
let oddsFeed=null;
function renderOddsBoard(){
 const el=$('odds-board-results');if(!el)return;
 document.querySelectorAll('[data-odds-tier]').forEach(b=>{const on=Number(b.dataset.oddsTier)===activeOddsTier;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
 const bounds=oddsIntervals[activeOddsTier];const offers=Array.isArray(oddsFeed?.offers)?oddsFeed.offers.filter(o=>validOffer(o,oddsFeed)&&o.decimal_odds>=bounds[0]&&o.decimal_odds<=bounds[1]):[];
 $('odds-board-date').textContent=oddsFeed?.date_uk===todayUK()?`Today · ${todayUK()} · prices checked within 10 minutes`:`Today · ${todayUK()}`;
 $('odds-board-count').textContent=`${offers.length} price-checked ${offers.length===1?'bet':'bets'}`;
 if(!offers.length){el.innerHTML=`<div class="value-empty"><strong>No verified bets around ${activeOddsTier.toFixed(2)} right now.</strong><p>EdgeCheck is waiting for fresh, permitted bookmaker-price data in this odds range. No prices or suggested combinations are invented.</p><a class="check-bookmaker" href="https://www.bet365.com/" rel="noopener noreferrer" target="_blank">Check bet365 markets ↗</a></div>`;return;}
 el.innerHTML=offers.map(o=>{const stamp=new Date(o.checked_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});return `<article class="odds-offer"><div class="odds-offer-header"><div><span class="overline">${escapeHtml(o.game)}</span><h3>${escapeHtml(o.title||'Suggested bet builder')}</h3></div><strong class="bigodds">${o.decimal_odds.toFixed(2)}</strong></div><ul>${o.legs.map(l=>`<li>${escapeHtml(l)}</li>`).join('')}</ul><div class="odds-verified"><span>Price checked ${escapeHtml(stamp)} UK · ${escapeHtml(o.source_name)}</span><span>Reference: ${escapeHtml(o.source_reference)}</span></div><a class="check-bookmaker" href="${escapeHtml(safeBookmakerUrl(o.bet365_url))}" target="_blank" rel="noopener noreferrer">Check current price at bet365 ↗</a></article>`}).join('');
}
async function loadOddsBoard(){try{const r=await fetch('/data/verified-odds.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Odds not published');const j=await r.json();oddsFeed=j;}catch{oddsFeed=null;}renderOddsBoard();}
document.querySelectorAll('[data-odds-tier]').forEach(b=>b.addEventListener('click',()=>{activeOddsTier=Number(b.dataset.oddsTier);renderOddsBoard()}));
loadOddsBoard();


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
        not_configured: 'Live odds are not connected yet. An authorised odds API subscription is required.',
        no_event_coverage: 'No UK bookmaker player-prop prices were returned for this matchup.',
        not_upcoming: 'Pre-match prices are no longer available for this fixture.',
        provider_unavailable: 'Price provider temporarily unavailable. Check prices directly with bookmakers.',
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
        }).join('') : '<p class="no-picks">No exact UK price verified for this player and target.</p>'}
      </div>`;
    }).join('') + '<p class="no-picks">Prices may change. Links are only as specific as the bookmaker permits. Confirm the selection before betting.</p>';
  } catch {
    panel.textContent = 'Unable to retrieve prices. Please try again later.';
  } finally {
    btn.disabled = false;
  }
});

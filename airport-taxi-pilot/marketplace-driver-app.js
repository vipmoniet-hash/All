/* MARKETPLACE_V1_DRIVER_UI */
const API=window.TAXI4_API_BASE||location.origin;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
let driverId=q('#driver')?.value||'',marketState=null,poolFilter='all';

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pay=m=>m==='bit'?'Bit':'מזומן';
const fmt=d=>new Date(d).toLocaleString('he-IL',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const dayKey=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const money=n=>Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:2});

function ensureMarketplaceUi(){
  if(!q('#marketplaceDevBadge')){
    const badge=document.createElement('div');
    badge.id='marketplaceDevBadge';
    badge.className='marketplace-dev-badge';
    badge.textContent='VanClick Taxi 1–4 · סביבת בדיקה מבודדת';
    q('.shell')?.prepend(badge);
  }
  if(!q('#driverStats')){
    const stats=document.createElement('section');
    stats.id='driverStats';
    stats.className='market-stats';
    q('.datebar')?.after(stats);
  }
  if(!q('#poolFilters')){
    const filters=document.createElement('div');
    filters.id='poolFilters';
    filters.className='market-filters';
    filters.innerHTML='<button class="active" data-pool-filter="all">הכל</button><button data-pool-filter="soon">שעתיים הקרובות</button><button data-pool-filter="today">היום</button><button data-pool-filter="later">בהמשך</button>';
    q('#pool')?.before(filters);
    filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      poolFilter=b.dataset.poolFilter;
      filters.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
      renderPool();
    });
  }
}

function claimReason(reason){
  return ({
    insufficient_wallet:'אין מספיק יתרה לעמלה',
    schedule_conflict:'יש לך נסיעה אחרת בזמן הזה'
  })[reason]||'לא ניתן לקחת את הנסיעה כרגע';
}

function matchesPoolFilter(o){
  if(poolFilter==='all')return true;
  const now=Date.now(),trip=new Date(o.tripAt).getTime(),mins=(trip-now)/60000;
  if(poolFilter==='soon')return mins>=-15&&mins<=120;
  if(poolFilter==='today')return dayKey(o.tripAt)===dayKey(new Date());
  if(poolFilter==='later')return dayKey(o.tripAt)!==dayKey(new Date())||mins>120;
  return true;
}

function issueButtons(o){
  if(o.issue?.status==='open'){
    return '<div class="issue-open">⚠ דווחה בעיה: '+esc(o.issue.type)+'</div>';
  }
  return `<div class="issue-menu hidden" id="issue-${o.id}">
    <button onclick="reportIssue('${o.id}','client_unreachable')">לקוח לא עונה</button>
    <button onclick="reportIssue('${o.id}','customer_not_ready')">לקוח לא מוכן</button>
    <button onclick="reportIssue('${o.id}','client_no_show')">לקוח לא הגיע</button>
    <button onclick="reportIssue('${o.id}','flight_delay')">בעיה בטיסה</button>
    <button onclick="reportIssue('${o.id}','pickup_problem')">בעיה באיסוף</button>
    <button onclick="reportIssue('${o.id}','vehicle_problem')">בעיה ברכב</button>
    <button onclick="reportIssue('${o.id}','other')">אחר</button>
  </div>`;
}

function card(o,owned=false){
  const blocked=!owned&&o.canClaim===false;
  const action=owned
    ? `<div class="actions compact-actions">
        ${o.canConfirmEnRoute?`<button class="secondary" onclick="enroute('${o.id}')">אני בדרך</button>`:''}
        ${o.status==='driver_enroute'?`<button class="buy" onclick="completeTrip('${o.id}')">הנסיעה הושלמה</button>`:''}
        <button class="secondary" onclick="toggleIssue('${o.id}')">בעיה</button>
        ${o.canSelfCancel?`<button class="danger" onclick="cancelOrder('${o.id}')">החזר לפול</button>`:''}
      </div>${issueButtons(o)}`
    : `<div class="actions"><button class="buy ${blocked?'claim-blocked':''}" ${blocked?'disabled':''} onclick="buy('${o.id}')">קח נסיעה · עמלה ${o.commission} ₪</button>${blocked?`<div class="claim-reason">${claimReason(o.claimBlockReason)}</div>`:''}</div>`;

  return `<article class="ride ${owned?'owned':''} ${blocked?'blocked':''}" data-order-id="${o.id}">
    <div class="ride-top">
      <div><div class="route">${esc(o.fromArea)} ← ${esc(o.toArea)}</div><small>${fmt(o.tripAt)}${o.estimatedTripMinutes?` · כ־${o.estimatedTripMinutes} דק׳`:''}</small></div>
      <div class="fare"><strong>${money(o.fare)} ₪</strong><small>מחיר ללקוח</small></div>
    </div>
    <div class="facts">
      <span class="fact">👥 ${o.passengers}</span>
      <span class="fact">🧳 ${o.largeLuggage||0}</span>
      <span class="fact">👜 ${o.smallLuggage||0}</span>
      ${o.flightNumber?`<span class="fact flight">✈ ${esc(o.flightNumber)}${o.terminal?' · T'+esc(o.terminal):''}</span>`:''}
      <span class="fact">${pay(o.ridePaymentMethod)}</span>
    </div>
    <div class="moneybar">
      <div><span>מחיר</span><b>${money(o.fare)} ₪</b></div>
      <div><span>עמלת VanClick</span><b>${money(o.commission)} ₪</b></div>
      <div class="net"><span>נשאר לנהג</span><b>${money(o.driverNet)} ₪</b></div>
    </div>
    ${owned?`<div class="private"><b>${esc(o.customerName)} · <a href="tel:${esc(o.customerPhone)}">${esc(o.customerPhone)}</a></b><br>📍 ${esc(o.exactPickup)}<br>🏁 ${esc(o.exactDropoff)}${o.notes?`<br>📝 ${esc(o.notes)}`:''}</div>${o.status==='driver_enroute'?'<div class="warning">הסטטוס: בדרך ללקוח</div>':''}`:''}
    ${action}
  </article>`;
}

function renderPool(){
  const items=(marketState?.pool||[]).filter(matchesPoolFilter);
  q('#pool').innerHTML=items.length?items.map(o=>card(o)).join(''):'<div class="empty">אין נסיעות מתאימות למסנן הזה</div>';
  q('#poolCount').textContent=(marketState?.pool||[]).length?`(${(marketState?.pool||[]).length})`:'';
}

function renderState(){
  if(!marketState)return;
  const s=marketState;
  q('#wallet').textContent=money(s.driver.wallet);
  q('#mineCount').textContent=s.mine.length?`(${s.mine.length})`:'';
  q('#mine').innerHTML=s.mine.length?s.mine.map(o=>card(o,true)).join(''):'<div class="empty">אין נסיעות פעילות</div>';
  renderPool();

  const stats=s.stats||{};
  q('#driverStats').innerHTML=`
    <div><span>נסיעות שהושלמו</span><b>${stats.completedTrips||0}</b></div>
    <div><span>מחזור שהושלם</span><b>${money(stats.completedFare)} ₪</b></div>
    <div><span>נטו לנהג</span><b>${money(stats.completedDriverNet)} ₪</b></div>
    <div><span>עמלה נטו ששולמה</span><b>${money(stats.netCommissionPaid)} ₪</b></div>`;

  q('#history').innerHTML=s.completed.length?s.completed.map(o=>`<div class="ride"><div class="ride-top"><div><div class="route">${esc(o.fromArea)} ← ${esc(o.toArea)}</div><small>${fmt(o.tripAt)}</small></div><span class="status">הושלם</span></div><div class="moneybar"><div><span>מחיר</span><b>${money(o.fare)} ₪</b></div><div><span>עמלה</span><b>${money(o.commission)} ₪</b></div><div class="net"><span>נטו</span><b>${money(o.driverNet)} ₪</b></div></div></div>`).join(''):'<div class="empty">אין היסטוריה</div>';
  q('#topupHistory').innerHTML=s.topups.length?'<h3>בקשות אחרונות</h3>'+s.topups.map(t=>`<div>${money(t.amount)} ₪ · ${pay(t.method)} · ${esc(t.status)}</div>`).join(''):'';
}

async function load(silent=false){
  driverId=q('#driver')?.value||driverId;
  try{
    const r=await fetch(`${API}/api/drivers/${encodeURIComponent(driverId)}/state`,{cache:'no-store'}),s=await r.json();
    if(!r.ok)throw Error(s.error);
    marketState=s;renderState();
  }catch(e){if(!silent)alert(e.message);}
}

async function post(url,body={}){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),j=await r.json();
  if(!r.ok)throw Error(j.error);return j;
}

window.buy=async id=>{
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/buy`);await load(true)}
  catch(e){
    const msg=e.message==='INSUFFICIENT_WALLET_BALANCE'?'אין מספיק יתרה בארנק':e.message==='DRIVER_SCHEDULE_CONFLICT'?'הנסיעה מתנגשת עם נסיעה שכבר לקחת':e.message==='ORDER_ALREADY_TAKEN'?'נהג אחר כבר לקח את הנסיעה':e.message;
    alert(msg);await load(true);
  }
};

window.cancelOrder=async id=>{
  if(!confirm('להחזיר את הנסיעה לפול? לפי הכללים המותרים העמלה תוחזר.'))return;
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/cancel`);await load(true)}catch(e){alert(e.message)}
};

window.enroute=async id=>{
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/enroute`);await load(true)}
  catch(e){alert(e.message==='DRIVER_CONFIRM_TOO_EARLY'?'אפשר לאשר יציאה סמוך לזמן הנסיעה':e.message)}
};

window.completeTrip=async id=>{
  if(!confirm('לסמן שהנסיעה הושלמה?'))return;
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/complete`);await load(true)}catch(e){alert(e.message)}
};

window.toggleIssue=id=>q('#issue-'+id)?.classList.toggle('hidden');
window.reportIssue=async(id,type)=>{
  let note='';
  if(type==='other')note=prompt('תיאור קצר של הבעיה')||'';
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/issue`,{type,note});await load(true)}
  catch(e){alert(e.message)}
};

q('#topup').onsubmit=async e=>{
  e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);
  try{await post(`${API}/api/drivers/${driverId}/topups`,b);q('#topupStatus').textContent='הבקשה נשלחה לאישור';e.target.reset();await load(true)}
  catch(err){q('#topupStatus').textContent=err.message}
};
q('#driver').onchange=()=>load();
q('#refresh').onclick=()=>load();
qa('.tabs button').forEach(b=>b.onclick=()=>{
  qa('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
  qa('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));
});

ensureMarketplaceUi();
q('#today').textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
load();
setInterval(()=>{if(document.visibilityState==='visible')load(true)},12000);

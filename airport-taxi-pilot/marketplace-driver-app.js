/* MARKETPLACE_V1_DRIVER_UI */
const API=window.TAXI4_API_BASE||location.origin;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const previewMode=new URLSearchParams(location.search).get('admin_preview')==='1';
const previewDriverId=sessionStorage.getItem('taxi4_preview_driver_id')||'';
const previewStaffToken=sessionStorage.getItem('taxi4_dispatch_token')||'';
let driverId=previewMode?previewDriverId:(sessionStorage.getItem('taxi4_driver_id')||q('#driver')?.value||''),marketState=null,poolFilter='all',authRequired=false,authToken=previewMode?previewStaffToken:(sessionStorage.getItem('taxi4_driver_token')||'');

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pay=m=>m==='bit'?'Bit':'מזומן';
const fmt=d=>new Date(d).toLocaleString('he-IL',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const dayKey=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const money=n=>Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:2});
const TOPUP_VAT_RATE=0.18;
const topupCredits=t=>Number(t?.credits??t?.amount??0);
const topupVat=t=>Number(t?.vatAmount??(topupCredits(t)*TOPUP_VAT_RATE).toFixed(2));
const topupTotal=t=>Number(t?.totalAmount??(topupCredits(t)+topupVat(t)).toFixed(2));
function renderTopupCalc(){
  const input=q('#topup input[name="amount"]'),credits=Number(input?.value||0),el=q('#topupCalc');
  if(!el)return;
  if(!(credits>0)){el.textContent='לדוגמה: 100 קרדיטים = 100 ₪ + מע״מ 18% = 118 ₪ לתשלום';return;}
  const vat=Number((credits*TOPUP_VAT_RATE).toFixed(2)),total=Number((credits+vat).toFixed(2));
  el.textContent=`${money(credits)} קרדיטים = ${money(credits)} ₪ + מע״מ 18% (${money(vat)} ₪) = ${money(total)} ₪ לתשלום`;
}

function authFetch(url,opts={}){
  const headers={...(opts.headers||{})};
  if(authToken)headers.authorization='Bearer '+authToken;
  return fetch(url,{...opts,headers});
}
function ensureDriverAuthUi(){
  if(!q('#driverAuthOverlay')){
    const wrap=document.createElement('div');
    wrap.id='driverAuthOverlay';
    wrap.className='auth-overlay hidden';
    wrap.innerHTML=`<form id="driverAuthForm" class="auth-card">
      <h2>כניסת נהג</h2>
      <p>הזן מספר טלפון או קוד נהג ואת ה-PIN שקיבלת מ-VanClick.</p>
      <small>בעלים/מנהל יכול להיכנס כאן עם פרטי VanClick הישנים ויועבר אוטומטית לניהול.</small>
      <input name="driverId" inputmode="tel" autocomplete="username" placeholder="טלפון / קוד נהג" required>
      <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="\\d{4,12}" placeholder="PIN" required>
      <button class="buy">כניסה</button>
      <div id="driverAuthStatus"></div>
    </form>`;
    document.body.appendChild(wrap);
    q('#driverAuthForm').onsubmit=async e=>{
      e.preventDefault();
      const b=Object.fromEntries(new FormData(e.target));
      q('#driverAuthStatus').textContent='';
      try{
        const r=await fetch(API+'/api/auth/driver/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
        const j=await r.json();
        if(!r.ok)throw Error(j.error);
        if(['admin','dispatcher'].includes(j.role)){
          sessionStorage.setItem('taxi4_dispatch_token',j.token);
          sessionStorage.setItem('taxi4_staff_role',j.role);
          location.replace('/unified/dispatch/');
          return;
        }
        authToken=j.token;driverId=j.driver.id;
        sessionStorage.setItem('taxi4_driver_token',authToken);
        sessionStorage.setItem('taxi4_driver_id',driverId);
        let option=[...q('#driver').options].find(x=>x.value===driverId);
        if(!option){option=document.createElement('option');option.value=driverId;option.textContent=j.driver.name||driverId;q('#driver').appendChild(option);}
        q('#driver').value=driverId;
        q('#driverAuthOverlay').classList.add('hidden');
        q('#driverLogout')?.classList.remove('hidden');
        q('#driver').classList.add('hidden');
        await load(true);
      }catch(err){q('#driverAuthStatus').textContent=err.message==='INVALID_CREDENTIALS'?'פרטי כניסה שגויים':err.message==='OWNER_AUTH_UNAVAILABLE'?'לא ניתן לאמת כרגע את כניסת המנהל הישנה':err.message;}
    };
  }
}
function showDriverLogin(message=''){
  ensureDriverAuthUi();
  authToken='';
  sessionStorage.removeItem('taxi4_driver_token');
  q('#driverAuthStatus').textContent=message;
  q('#driverAuthOverlay').classList.remove('hidden');
}
function exitDriverPreview(){
  sessionStorage.removeItem('taxi4_preview_driver_id');
  location.href='/unified/dispatch/';
}
async function driverLogout(){
  if(previewMode){exitDriverPreview();return;}
  try{if(authToken)await authFetch(API+'/api/auth/logout',{method:'POST'});}catch{}
  authToken='';driverId='';
  sessionStorage.removeItem('taxi4_driver_token');sessionStorage.removeItem('taxi4_driver_id');
  showDriverLogin();
}
async function initDriverAuth(){
  if(previewMode){
    authRequired=true;
    if(!authToken||!driverId){location.replace('/unified/dispatch/');return false;}
    q('#driver')?.classList.add('hidden');
    q('#driverAuthOverlay')?.classList.add('hidden');
    return true;
  }
  ensureDriverAuthUi();
  const r=await fetch(API+'/api/auth/status',{cache:'no-store'});
  const j=await r.json();
  authRequired=!!j.required;
  if(!authRequired){
    q('#driverLogout')?.classList.add('hidden');
    return true;
  }
  q('#driver').classList.add('hidden');
  q('#driverLogout')?.classList.remove('hidden');
  if(!authToken){showDriverLogin();return false;}
  return true;
}

function ensureMarketplaceUi(){
  if(previewMode&&!q('#driverPreviewBanner')){
    const banner=document.createElement('div');
    banner.id='driverPreviewBanner';
    banner.className='marketplace-dev-badge';
    banner.innerHTML='<b>תצוגת מנהל לקריאה בלבד</b> · כך הנהג רואה את האפליקציה <button type="button" class="secondary" onclick="exitDriverPreview()">חזרה לניהול</button>';
    q('.shell')?.prepend(banner);
  }
  if(!q('#marketplaceDevBadge')){
    const badge=document.createElement('div');
    badge.id='marketplaceDevBadge';
    badge.className='marketplace-dev-badge';
    badge.textContent='VanClick Taxi 1–4 · סביבת בדיקה מבודדת';
    q('.shell')?.prepend(badge);
  }
  if(!q('#driverLogout')){
    const logout=document.createElement('button');
    logout.id='driverLogout';
    logout.className='secondary hidden';
    logout.textContent=previewMode?'חזרה לניהול':'יציאה';
    logout.onclick=driverLogout;
    q('.top-actions')?.appendChild(logout);
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
  const dis=previewMode?' disabled aria-disabled="true"':'';
  return `<div class="issue-menu hidden" id="issue-${o.id}">
    <button${dis} onclick="reportIssue('${o.id}','client_unreachable')">לקוח לא עונה</button>
    <button${dis} onclick="reportIssue('${o.id}','customer_not_ready')">לקוח לא מוכן</button>
    <button${dis} onclick="reportIssue('${o.id}','client_no_show')">לקוח לא הגיע</button>
    <button${dis} onclick="reportIssue('${o.id}','flight_delay')">בעיה בטיסה</button>
    <button${dis} onclick="reportIssue('${o.id}','pickup_problem')">בעיה באיסוף</button>
    <button${dis} onclick="reportIssue('${o.id}','vehicle_problem')">בעיה ברכב</button>
    <button${dis} onclick="reportIssue('${o.id}','other')">אחר</button>
  </div>`;
}

function card(o,owned=false){
  const blocked=!owned&&o.canClaim===false;
  const ro=previewMode?' disabled aria-disabled="true"':'';
  const action=owned
    ? `<div class="actions compact-actions">
        ${o.canConfirmEnRoute?`<button class="secondary"${ro} onclick="enroute('${o.id}')">אני בדרך</button>`:''}
        ${o.status==='driver_enroute'?`<button class="buy"${ro} onclick="completeTrip('${o.id}')">הנסיעה הושלמה</button>`:''}
        <button class="secondary"${ro} onclick="toggleIssue('${o.id}')">בעיה</button>
        ${o.canSelfCancel?`<button class="danger"${ro} onclick="cancelOrder('${o.id}')">החזר לפול</button>`:''}
      </div>${issueButtons(o)}`
    : `<div class="actions"><button class="buy ${blocked?'claim-blocked':''}" ${blocked||previewMode?'disabled':''} aria-disabled="${blocked||previewMode?'true':'false'}" onclick="buy('${o.id}')">קח נסיעה · עמלה ${o.commission} ₪</button>${blocked?`<div class="claim-reason">${claimReason(o.claimBlockReason)}</div>`:''}</div>`;

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
  q('#topupHistory').innerHTML=s.topups.length?'<h3>בקשות אחרונות</h3>'+s.topups.map(t=>`<div>${money(topupCredits(t))} קרדיטים · ${money(topupTotal(t))} ₪ כולל מע״מ 18% · ${pay(t.method)} · ${esc(t.status)}</div>`).join(''):'';
}

async function load(silent=false){
  if(!authRequired)driverId=q('#driver')?.value||driverId;
  if(authRequired&&!authToken){
    if(previewMode){location.replace('/unified/dispatch/');return;}
    showDriverLogin();return;
  }
  try{
    const url=previewMode?`${API}/api/unified/admin/driver-preview/${encodeURIComponent(driverId)}`:`${API}/api/drivers/${encodeURIComponent(driverId)}/state`;
    const r=await authFetch(url,{cache:'no-store'}),s=await r.json();
    if((r.status===401||r.status===403)&&previewMode){location.replace('/unified/dispatch/');return;}
    if(r.status===401&&authRequired){showDriverLogin('נדרש להתחבר מחדש');return;}
    if(!r.ok)throw Error(s.error);
    marketState=s;renderState();
  }catch(e){if(!silent)alert(e.message);}
}

async function post(url,body={}){
  if(previewMode)throw Error('PREVIEW_READ_ONLY');
  const r=await authFetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),j=await r.json();
  if(r.status===401&&authRequired){showDriverLogin('נדרש להתחבר מחדש');throw Error('UNAUTHORIZED');}
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
  try{const t=await post(`${API}/api/drivers/${driverId}/topups`,b);q('#topupStatus').textContent=`נשלח לאישור: ${money(t.credits??t.amount)} קרדיטים · ${money(t.totalAmount)} ₪ כולל מע״מ`;e.target.reset();renderTopupCalc();await load(true)}
  catch(err){q('#topupStatus').textContent=err.message}
};
q('#driver').onchange=()=>{if(!authRequired)load();};
q('#refresh').onclick=()=>load();
qa('.tabs button').forEach(b=>b.onclick=()=>{
  qa('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
  qa('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));
});

async function boot(){
  ensureMarketplaceUi();
  q('#today').textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const topupInput=q('#topup input[name="amount"]');if(topupInput)topupInput.addEventListener('input',renderTopupCalc);renderTopupCalc();
  if(previewMode){
    q('#topup')?.querySelectorAll('input,select,button').forEach(el=>{el.disabled=true;el.setAttribute('aria-disabled','true')});
  }
  const ready=await initDriverAuth();
  if(ready)await load(true);
}
boot();
setInterval(()=>{if(document.visibilityState==='visible'&&(!authRequired||authToken))load(true)},12000);

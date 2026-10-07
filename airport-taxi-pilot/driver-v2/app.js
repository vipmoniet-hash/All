const API=window.TAXI4_API_BASE||window.location.origin;
const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
let driverId=localStorage.getItem('vanclick_driver_id')||q('#driver')?.value||'drv-001';
let state=null;
let deferredInstall=null;
let toastTimer=null;

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pay=m=>m==='bit'?'Bit':'מזומן';
const fmt=d=>new Date(d).toLocaleString('he-IL',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const enc=v=>encodeURIComponent(String(v||''));
const waze=a=>`https://waze.com/ul?q=${enc(a)}&navigate=yes`;

if(new URLSearchParams(location.search).get('test')==='1') document.body.classList.add('test-mode');
if(q('#driver')){
  q('#driver').value=driverId;
  q('#driver').addEventListener('change',()=>{driverId=q('#driver').value;localStorage.setItem('vanclick_driver_id',driverId);load();});
}

q('#today').textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});

function toast(msg){
  const el=q('#toast'); if(!el)return;
  el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
function surcharge(o){
  if(o.surchargeReason==='shabbat'||o.surchargePercent===15) return '<span class="fact payment">שבת +15%</span>';
  if(o.surchargeReason==='peak'||o.surchargePercent===5) return '<span class="fact payment">עומס +5%</span>';
  return '';
}
function publicCard(o){
  return `<article class="ride">
    <div class="ride-statusline"><b>נסיעה זמינה</b><time>${fmt(o.tripAt)}</time></div>
    <div class="ride-main">
      <div class="route">${esc(o.fromArea)} ← ${esc(o.toArea)}<small>הפרטים המדויקים נפתחים רק אחרי רכישת הנסיעה</small></div>
      <div class="fare"><strong>${o.fare} ₪</strong><small>מחיר ללקוח</small></div>
    </div>
    <div class="facts">
      <span class="fact">👥 ${o.passengers} נוסעים</span>
      <span class="fact">🧳 ${o.largeLuggage||0} גדולות</span>
      <span class="fact">👜 ${o.smallLuggage||0} קטנות</span>
      ${o.flightNumber?`<span class="fact flight">✈ ${esc(o.flightNumber)}${o.terminal?' · T'+esc(o.terminal):''}</span>`:''}
      <span class="fact payment">${pay(o.ridePaymentMethod)}</span>
      ${surcharge(o)}
    </div>
    <div class="moneybar">
      <div><span>מחיר</span><b>${o.fare} ₪</b></div>
      <div><span>עמלה</span><b>${o.commission} ₪</b></div>
      <div class="net"><span>כלכלית לנהג</span><b>${o.driverNet} ₪</b></div>
    </div>
    <div class="actions"><button class="buy" onclick="buy('${o.id}')">שלם ${o.commission} ₪ וקבל נסיעה</button></div>
  </article>`;
}
function ownedCard(o){
  return `<article class="ride owned">
    <div class="ride-statusline"><b>${o.status==='driver_enroute'?'בדרך ללקוח':'נסיעה שלי'}</b><time>${fmt(o.tripAt)}</time></div>
    <div class="ride-main">
      <div class="route">${esc(o.fromArea)} ← ${esc(o.toArea)}<small>${pay(o.ridePaymentMethod)} · ${o.passengers} נוסעים</small></div>
      <div class="fare"><strong>${o.fare} ₪</strong><small>משולם לנהג</small></div>
    </div>
    <div class="facts">
      <span class="fact">🧳 ${o.largeLuggage||0} גדולות</span>
      <span class="fact">👜 ${o.smallLuggage||0} קטנות</span>
      ${o.flightNumber?`<span class="fact flight">✈ ${esc(o.flightNumber)}${o.terminal?' · T'+esc(o.terminal):''}</span>`:''}
      ${surcharge(o)}
    </div>
    <div class="private">
      <div class="client-row">
        <b>${esc(o.customerName)}</b>
        <div class="client-actions">
          <a href="tel:${esc(o.customerPhone)}" aria-label="התקשר ללקוח">☎</a>
        </div>
      </div>
      <div class="address"><small>איסוף</small><b>${esc(o.exactPickup)}</b><a href="${waze(o.exactPickup)}" target="_blank" rel="noopener">פתח Waze →</a></div>
      <div class="address"><small>יעד</small><b>${esc(o.exactDropoff)}</b><a href="${waze(o.exactDropoff)}" target="_blank" rel="noopener">פתח Waze →</a></div>
      ${o.notes?`<div class="notes">📝 ${esc(o.notes)}</div>`:''}
    </div>
    ${o.status==='driver_enroute'?'<div class="warning">הסטטוס: בדרך ללקוח</div>':''}
    <div class="actions">
      ${o.canConfirmEnRoute?`<button class="primary" onclick="enroute('${o.id}')">אני בדרך</button>`:''}
      ${o.status==='driver_enroute'?`<button class="primary" onclick="completeTrip('${o.id}')">הנסיעה הושלמה</button>`:''}
      ${o.canSelfCancel?`<button class="danger" onclick="cancelOrder('${o.id}')">ביטול</button>`:''}
    </div>
  </article>`;
}
function historyCard(o){
  return `<article class="ride"><div class="ride-statusline"><span class="status">הושלם</span><time>${fmt(o.tripAt)}</time></div><div class="ride-main"><div class="route">${esc(o.fromArea)} ← ${esc(o.toArea)}</div><div class="fare"><strong>${o.fare||''} ₪</strong><small>מחיר</small></div></div></article>`;
}
function empty(title,text=''){
  return `<div class="empty"><strong>${title}</strong>${text?esc(text):''}</div>`;
}
function counts(s){
  const p=s.pool.length,m=s.mine.length;
  q('#poolCount').textContent=p?`(${p})`:'';
  q('#mineCount').textContent=m?`(${m})`:'';
  const pb=q('#poolCountBottom'),mb=q('#mineCountBottom');
  if(pb){pb.textContent=p||'';pb.classList.toggle('has',!!p)}
  if(mb){mb.textContent=m||'';mb.classList.toggle('has',!!m)}
}
async function load(){
  try{
    const r=await fetch(`${API}/api/drivers/${driverId}/state`,{cache:'no-store'});
    const s=await r.json();
    if(!r.ok) throw new Error(s.error||'LOAD_FAILED');
    state=s;
    q('#wallet').textContent=s.driver.wallet;
    q('#walletBig').textContent=s.driver.wallet;
    counts(s);
    q('#pool').innerHTML=s.pool.length?s.pool.map(publicCard).join(''):empty('אין כרגע נסיעות זמינות','המסך מתעדכן אוטומטית.');
    q('#mine').innerHTML=s.mine.length?s.mine.map(ownedCard).join(''):empty('אין נסיעות פעילות');
    q('#history').innerHTML=s.completed.length?s.completed.map(historyCard).join(''):empty('אין היסטוריה');
    q('#topupHistory').innerHTML=s.topups.length?'<h3>בקשות אחרונות</h3>'+s.topups.map(t=>`<div class="topup-item">${t.amount} ₪ · ${pay(t.method)} · ${esc(t.status)}</div>`).join(''):'';
  }catch(e){
    q('#pool').innerHTML=empty('אין חיבור למערכת','בדוק אינטרנט ונסה לרענן.');
  }
}
async function post(url,body={}){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||'REQUEST_FAILED');
  return j;
}
window.buy=async id=>{
  const o=state?.pool?.find(x=>x.id===id);
  if(!o) return;
  if(!confirm(`רכישת הנסיעה תוריד ${o.commission} ₪ מהארנק ורק אז ייפתחו פרטי הלקוח. להמשיך?`)) return;
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/buy`);toast('הנסיעה נרכשה. פרטי הלקוח נפתחו.');switchTab('mine');await load();}
  catch(e){toast(e.message==='INSUFFICIENT_WALLET_BALANCE'?'אין מספיק יתרה בארנק':e.message)}
};
window.cancelOrder=async id=>{
  if(!confirm('להחזיר את הנסיעה לפול? אם הביטול מותר, העמלה תוחזר לארנק.'))return;
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/cancel`);toast('הנסיעה הוחזרה לפול');await load();}catch(e){toast(e.message)}
};
window.enroute=async id=>{
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/enroute`);toast('סומן: בדרך ללקוח');await load();}
  catch(e){toast(e.message==='DRIVER_CONFIRM_TOO_EARLY'?'אפשר לאשר יציאה רק סמוך לזמן הנסיעה':e.message)}
};
window.completeTrip=async id=>{
  if(!confirm('לסמן שהנסיעה הושלמה?'))return;
  try{await post(`${API}/api/drivers/${driverId}/orders/${id}/complete`);toast('הנסיעה הושלמה');await load();}catch(e){toast(e.message)}
};
q('#topup').onsubmit=async e=>{
  e.preventDefault();
  const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);
  try{await post(`${API}/api/drivers/${driverId}/topups`,b);q('#topupStatus').textContent='הבקשה נשלחה לאישור';e.target.reset();await load();}
  catch(err){q('#topupStatus').textContent=err.message}
};
function switchTab(id){
  qa('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  qa('.pane').forEach(x=>x.classList.toggle('active',x.id===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
qa('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
q('#refresh')?.addEventListener('click',()=>{toast('מרענן…');load();});

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstall=e;
  q('#installBtn')?.classList.remove('hidden');
  q('#installBanner')?.classList.remove('hidden');
});
async function installApp(){
  if(!deferredInstall)return;
  deferredInstall.prompt();
  await deferredInstall.userChoice.catch(()=>null);
  deferredInstall=null;
  q('#installBtn')?.classList.add('hidden');
  q('#installBanner')?.classList.add('hidden');
}
q('#installBtn')?.addEventListener('click',installApp);
q('#installBannerBtn')?.addEventListener('click',installApp);
window.addEventListener('appinstalled',()=>toast('VanClick Driver הותקן'));

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/driver/sw.js',{scope:'/driver/'}).catch(()=>{}));
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
load();
setInterval(()=>{if(document.visibilityState==='visible')load();},20000);

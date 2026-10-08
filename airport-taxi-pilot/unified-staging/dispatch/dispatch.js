(()=>{
const C={
ru:{
title:'Единый центр управления',lead:'Admin и назначенные диспетчеры управляют обеими линиями из одного экрана. Owner-only настройки остаются только у администратора.',
loginTitle:'Вход в VanClick',loginText:'Введите телефон и PIN из VanClick. Администратор и назначенные диспетчеры работают в одном центре по обеим линиям.',login:'Войти',logout:'Выйти',
orders:'Заказы',topups:'Пополнения',drivers:'Водители',customers:'Клиенты',journal:'Журнал',
small:'Taxi 1–4',smallText:'Новые заказы сначала проверяет персонал, затем публикует в общий пул.',
large:'Large 5–6',largeText:'Отдельная управляемая очередь больших машин без водительской комиссии.',
topupsText:'Заявки водителей 1–4 на пополнение баланса.',driversText:'Проверка, включение, отключение и PIN водителей 1–4.',
customersText:'Единый профиль по поездкам 1–4 и 5–6.',journalText:'Общий аудит действий и событий обеих линий.',
newSmall:'Новые 1–4',pool:'В пуле 1–4',active:'В работе 1–4',largeNew:'Новые 5–6',
pass:'пасс.',bags:'багаж',fare:'Цена',commission:'Комиссия',driver:'Водитель',wallet:'Баланс',completed:'Завершено',
approve:'Подтвердить',assign:'Назначить водителя',enroute:'В пути',complete:'Завершить',cancel:'Отменить',
publish:'В общий пул',release:'Снять водителя',resolve:'Закрыть проблему',message:'WhatsApp',copyGroup:'Для группы',copyPool:'Для WhatsApp',
advancedSmall:'Расширенный режим',noOrders:'Заказов нет',noTopups:'Нет ожидающих пополнений',noDrivers:'Водителей нет',
noCustomers:'Клиентов пока нет',noJournal:'Событий пока нет',trips:'поездок',lastTrip:'Последняя',
pending:'Ожидает',approved:'Подтверждено',rejected:'Отклонено',verify:'Проверить',enable:'Включить',disable:'Выключить',resetPin:'Сменить PIN',
addDriver:'Добавить',driverName:'Имя водителя',driverPhone:'Телефон',vehiclePlate:'Номер машины',driverPin:'PIN 4–12 цифр',driverView:'Как водитель',
badPin:'Неверный PIN',forbidden:'Нет доступа к этой линии',notConfigured:'Доступ персонала ещё не настроен в Render',
roleAdmin:'ADMIN · обе линии',roleDispatcher:'DISPATCHER · обе линии',
copied:'Скопировано',copyEmpty:'Нет новых или свободных поездок для отправки',
ready:'Staging готов к cutover',notReady:'Staging пока не готов к cutover',reasonPostgres:'PostgreSQL не подключён',reasonAdmin:'Не задан Admin PIN',statusAwaiting:'Новый',statusPool:'В пуле',statusAssigned:'Назначен',statusEnroute:'Водитель в пути',statusCompleted:'Завершён',statusCancelled:'Отменён',statusConfirmed:'Подтверждён'
},
he:{
title:'מרכז ניהול מאוחד',lead:'Admin והסדרנים שמונו מנהלים את שני הקווים ממסך אחד. הגדרות Owner-only נשארות רק למנהל.',
loginTitle:'כניסה ל־VanClick',loginText:'הזן טלפון ו-PIN של VanClick. המנהל והסדרנים שמונו עובדים באותו מרכז בשני הקווים.',login:'כניסה',logout:'יציאה',
orders:'הזמנות',topups:'טעינות',drivers:'נהגים',customers:'לקוחות',journal:'יומן',
small:'Taxi 1–4',smallText:'הזמנה חדשה נבדקת קודם על ידי הצוות ורק אחר כך מתפרסמת למאגר הנהגים.',
large:'Large 5–6',largeText:'תור נפרד לרכב גדול ללא עמלת נהג.',
topupsText:'בקשות טעינה של נהגי 1–4.',driversText:'אימות, הפעלה, השבתה ו-PIN לנהגי 1–4.',
customersText:'פרופיל לקוח משותף לנסיעות 1–4 ו-5–6.',journalText:'יומן ביקורת משותף לפעולות ואירועים בשני הקווים.',
newSmall:'חדשות 1–4',pool:'במאגר 1–4',active:'בטיפול 1–4',largeNew:'חדשות 5–6',
pass:'נוסעים',bags:'מטען',fare:'מחיר',commission:'עמלה',driver:'נהג',wallet:'יתרה',completed:'הושלמו',
approve:'אשר',assign:'שייך נהג',enroute:'בדרך',complete:'הושלם',cancel:'בטל',
publish:'שלח למאגר',release:'הסר נהג',resolve:'סגור בעיה',message:'WhatsApp',copyGroup:'לקבוצה',copyPool:'ל-WhatsApp',
advancedSmall:'מצב מתקדם',noOrders:'אין הזמנות',noTopups:'אין טעינות ממתינות',noDrivers:'אין נהגים',
noCustomers:'אין לקוחות',noJournal:'אין אירועים',trips:'נסיעות',lastTrip:'אחרונה',
pending:'ממתין',approved:'אושר',rejected:'נדחה',verify:'אמת',enable:'הפעל',disable:'כבה',resetPin:'שנה PIN',
addDriver:'הוסף',driverName:'שם נהג',driverPhone:'טלפון',vehiclePlate:'מספר רכב',driverPin:'PIN בן 4–12 ספרות',driverView:'תצוגת נהג',
badPin:'PIN שגוי',forbidden:'אין גישה לקו הזה',notConfigured:'גישת הצוות עדיין לא הוגדרה ב-Render',
roleAdmin:'ADMIN · שני הקווים',roleDispatcher:'סדרן · שני הקווים',
copied:'הועתק',copyEmpty:'אין נסיעות חדשות או פנויות לשליחה',
ready:'Staging מוכן ל-cutover',notReady:'Staging עדיין לא מוכן ל-cutover',reasonPostgres:'PostgreSQL לא מחובר',reasonAdmin:'Admin PIN לא הוגדר',statusAwaiting:'חדש',statusPool:'במאגר',statusAssigned:'שויך',statusEnroute:'הנהג בדרך',statusCompleted:'הושלם',statusCancelled:'בוטל',statusConfirmed:'אושר'
}};
let lang=localStorage.getItem('vcUnifiedLang')||'ru';
let token=sessionStorage.getItem('taxi4_dispatch_token')||'';
let role=sessionStorage.getItem('taxi4_staff_role')||'';
let adminTab=localStorage.getItem('vcUnifiedAdminTab')||'orders';
let authRequired=false,state=null,readiness=null;
const $=id=>document.getElementById(id);
const t=k=>C[lang]?.[k]||k;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString(lang==='he'?'he-IL':'ru-RU',{maximumFractionDigits:2});

function headers(hasBody){const h={};if(hasBody)h['content-type']='application/json';if(token)h.authorization='Bearer '+token;return h}
async function api(path,opts={}){
  const body=opts.body===undefined?undefined:JSON.stringify(opts.body);
  const r=await fetch(path,{method:opts.method||'GET',headers:headers(body!==undefined),body,cache:'no-store'});
  let j={};try{j=await r.json()}catch{}
  if(!r.ok){const e=new Error(j.error||('HTTP '+r.status));e.status=r.status;throw e}
  return j;
}
function fmt(v){
  const x=new Date(v),locale=lang==='he'?'he-IL':'ru-RU',tz='Asia/Jerusalem';
  const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:tz}).format(x);
  const weekday=new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:tz}).format(x);
  const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:tz}).format(x);
  return date+' ('+weekday+') '+time;
}
function statusLabel(s){return ({
  awaiting_dispatch:t('statusAwaiting'),pool:t('statusPool'),assigned:t('statusAssigned'),driver_enroute:t('statusEnroute'),
  completed:t('statusCompleted'),cancelled:t('statusCancelled'),confirmed:t('statusConfirmed')
})[s]||s}
function apply(){
  document.documentElement.lang=lang;document.documentElement.dir=lang==='he'?'rtl':'ltr';
  document.querySelectorAll('[data-t]').forEach(el=>{const v=C[lang]?.[el.dataset.t];if(v)el.textContent=v});
  document.querySelectorAll('[data-ph]').forEach(el=>{const v=C[lang]?.[el.dataset.ph];if(v)el.placeholder=v});
  document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
  renderRole();renderReadiness();
}
function renderReadiness(){
  const box=$('readinessBanner');if(!box)return;
  if(!readiness){box.hidden=true;return}
  box.hidden=false;
  const ready=readiness.readyForUnifiedCutover===true;
  box.classList.toggle('ready',ready);
  box.classList.toggle('not-ready',!ready);
  const map={postgres:'reasonPostgres',admin_pin:'reasonAdmin'};
  const reasons=(readiness.readinessReasons||[]).map(x=>t(map[x]||x));
  box.innerHTML='<strong>'+esc(ready?t('ready'):t('notReady'))+'</strong>'+(reasons.length?'<span>'+esc(reasons.join(' · '))+'</span>':'');
}
function renderRole(){
  const b=$('roleBadge');if(!b)return;
  b.textContent=role==='admin'?t('roleAdmin'):role==='dispatcher'?t('roleDispatcher'):'';
  $('logoutBtn').hidden=!authRequired||!token;
}
function showAuth(msg=''){const o=$('staffAuthOverlay');o.hidden=false;$('staffAuthStatus').textContent=msg}
function hideAuth(){$('staffAuthOverlay').hidden=true}
function routeRole(){return false}
function largeOrders(){return ['admin','dispatcher'].includes(role)?(state?.largeOrders||[]):[]}

function setAdminTab(tab){
  if(!['admin','dispatcher'].includes(role))tab='orders';
  const allowed=['orders','topups','drivers','customers','journal'];
  adminTab=allowed.includes(tab)?tab:'orders';
  if(['admin','dispatcher'].includes(role))localStorage.setItem('vcUnifiedAdminTab',adminTab);
  document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===adminTab));
  for(const name of allowed){const pane=$(name+'Pane');if(pane)pane.hidden=name!==adminTab}
}
function renderMetrics(){
  const m=[];
  if(['admin','dispatcher'].includes(role)){
    const c=state?.counts||{},lc=state?.largeCounts||{};
    m.push([t('newSmall'),c.awaiting_dispatch||0],[t('pool'),c.pool||0],[t('active'),(c.assigned||0)+(c.driver_enroute||0)],[t('largeNew'),lc.awaiting_dispatch||0]);
  }
  $('metrics').innerHTML=m.map(([n,v])=>'<div class="metric"><span>'+esc(n)+'</span><b>'+Number(v||0)+'</b></div>').join('');
}
function smallActionButtons(o){
  const out=[];
  if(o.status==='awaiting_dispatch'){
    out.push('<input class="fare-input" id="smallFare-'+esc(o.id)+'" type="number" min="1" value="'+Number(o.quotedFare||o.fare||0)+'" aria-label="'+esc(t('fare'))+'">');
    out.push('<button class="primary" onclick="smallPublish(\''+esc(o.id)+'\')">'+esc(t('publish'))+'</button>');
  }
  if(o.status==='assigned')out.push('<button class="secondary" onclick="smallRelease(\''+esc(o.id)+'\')">'+esc(t('release'))+'</button>');
  if(o.issue?.status==='open')out.push('<button class="secondary" onclick="smallResolve(\''+esc(o.id)+'\')">'+esc(t('resolve'))+'</button>');
  if(['pool','assigned','driver_enroute'].includes(o.status))out.push('<button class="secondary" onclick="smallMessage(\''+esc(o.id)+'\',\''+(o.status==='pool'?'approved':o.status==='assigned'?'driver':'enroute')+'\')">'+esc(t('message'))+'</button>');
  if(['awaiting_dispatch','pool'].includes(o.status))out.push('<button class="secondary" onclick="copySmallGroup(\''+esc(o.id)+'\')">'+esc(t('copyGroup'))+'</button>');
  if(!['completed','cancelled'].includes(o.status))out.push('<button class="danger-link" onclick="smallCancel(\''+esc(o.id)+'\')">'+esc(t('cancel'))+'</button>');
  return out.join('');
}
function renderSmallOrders(){
  const box=$('smallQueue');if(!box)return;
  if(!['admin','dispatcher'].includes(role)){box.innerHTML='';return}
  const xs=(state?.orders||[]).slice().sort((a,b)=>{
    const final=s=>['completed','cancelled'].includes(s)?1:0;
    return final(a.status)-final(b.status)||new Date(a.tripAt)-new Date(b.tripAt);
  }).slice(0,60);
  box.innerHTML=xs.length?xs.map(o=>'<article class="queue-card order-card"><div class="order-title"><h3>'+esc(o.bookingCode||o.id)+' · '+fmt(o.tripAt)+'</h3><span class="status-pill">'+esc(statusLabel(o.status))+'</span></div><div>'+esc(o.fromArea)+' → '+esc(o.toArea)+' · '+Number(o.passengers||0)+' '+esc(t('pass'))+'</div><div class="muted">'+Number(o.largeLuggage||0)+' + '+Number(o.smallLuggage||0)+' '+esc(t('bags'))+' · '+esc(o.customerName||'')+' · '+esc(o.customerPhone||'')+'</div><div class="muted">'+esc(t('fare'))+': '+money(o.fare??o.quotedFare??0)+' ₪ · '+esc(t('commission'))+': '+money(o.commission||0)+' ₪'+(o.assignedDriverId?' · '+esc(t('driver'))+': '+esc(o.assignedDriverId):'')+'</div><div class="actions queue-actions">'+smallActionButtons(o)+'</div></article>').join(''):'<div class="muted">'+esc(t('noOrders'))+'</div>';
}
function largeActionButtons(o){
  const parts=[];
  if(o.status==='awaiting_dispatch')parts.push('<button class="primary" onclick="largeApprove(\''+esc(o.id)+'\')">'+esc(t('approve'))+'</button>');
  if(o.status==='confirmed')parts.push('<button class="primary" onclick="largeAssign(\''+esc(o.id)+'\')">'+esc(t('assign'))+'</button>');
  if(o.status==='assigned')parts.push('<button class="primary" onclick="largeEnroute(\''+esc(o.id)+'\')">'+esc(t('enroute'))+'</button>');
  if(o.status==='driver_enroute')parts.push('<button class="primary" onclick="largeComplete(\''+esc(o.id)+'\')">'+esc(t('complete'))+'</button>');
  if(!['completed','cancelled'].includes(o.status))parts.push('<button class="danger-link" onclick="largeCancel(\''+esc(o.id)+'\')">'+esc(t('cancel'))+'</button>');
  return parts.join('');
}
function renderLarge(){
  const box=$('largeQueue');if(!box)return;
  const xs=largeOrders().slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt));
  box.innerHTML=xs.length?xs.map(o=>'<article class="queue-card order-card"><div class="order-title"><h3>'+esc(o.bookingCode||o.id)+' · '+fmt(o.tripAt)+'</h3><span class="status-pill">'+esc(statusLabel(o.status))+'</span></div><div>'+esc(o.fromArea||o.city)+' → '+esc(o.toArea||'Ben Gurion')+' · '+Number(o.passengers||0)+' '+esc(t('pass'))+'</div><div class="muted">'+Number(o.largeLuggage||0)+' + '+Number(o.smallLuggage||0)+' '+esc(t('bags'))+' · '+esc(o.customerName||'')+' · '+esc(o.customerPhone||'')+'</div><div class="muted">'+esc(t('fare'))+': '+(o.fare==null?'—':money(o.fare)+' ₪')+(o.assignedDriverName?' · '+esc(t('driver'))+': '+esc(o.assignedDriverName):'')+'</div><div class="actions queue-actions">'+largeActionButtons(o)+'</div></article>').join(''):'<div class="muted">'+esc(t('noOrders'))+'</div>';
}
function renderTopups(){
  const box=$('topupQueue');if(!box)return;
  if(!['admin','dispatcher'].includes(role)){box.innerHTML='';return}
  const xs=(state?.topups||[]).slice().sort((a,b)=>{
    const pa=a.status==='pending'?0:1,pb=b.status==='pending'?0:1;
    return pa-pb||new Date(b.createdAt||b.at||0)-new Date(a.createdAt||a.at||0);
  }).slice(0,60);
  box.innerHTML=xs.length?xs.map(x=>'<article class="queue-card"><div class="order-title"><h3>'+esc(x.driverId||'—')+' · '+money(x.amount)+' ₪</h3><span class="status-pill">'+esc(t(x.status)||x.status)+'</span></div><div class="muted">'+esc(x.method||'')+((x.createdAt||x.at)?' · '+fmt(x.createdAt||x.at):'')+'</div>'+(x.status==='pending'?'<div class="actions queue-actions"><button class="primary" onclick="topupApprove(\''+esc(x.id)+'\')">'+esc(t('approve'))+'</button><button class="danger-link" onclick="topupReject(\''+esc(x.id)+'\')">'+esc(t('rejected'))+'</button></div>':'')+'</article>').join(''):'<div class="muted">'+esc(t('noTopups'))+'</div>';
}
function renderDrivers(){
  const box=$('driverQueue');if(!box)return;
  if(!['admin','dispatcher'].includes(role)){box.innerHTML='';return}
  const xs=(state?.drivers||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),lang==='he'?'he':'ru'));
  box.innerHTML=xs.length?xs.map(d=>'<article class="queue-card driver-card"><div class="order-title"><h3>'+esc(d.name||d.id)+'</h3><span class="status-pill">'+esc(d.verified?(d.active?t('approved'):t('disable')):t('pending'))+'</span></div><div>'+esc(d.phone||'')+(d.vehiclePlate?' · '+esc(d.vehiclePlate):'')+'</div><div class="muted">'+esc(t('wallet'))+': '+money(d.wallet)+' ₪ · '+esc(t('completed'))+': '+Number(d.completedTrips||0)+'</div><div class="actions queue-actions">'+(!d.verified?'<button class="primary" onclick="driverVerify(\''+esc(d.id)+'\')">'+esc(t('verify'))+'</button>':'<button class="secondary" onclick="driverToggle(\''+esc(d.id)+'\','+(d.active?'false':'true')+')">'+esc(d.active?t('disable'):t('enable'))+'</button>')+'<button class="secondary" onclick="driverResetPin(\''+esc(d.id)+'\')">'+esc(t('resetPin'))+'</button>'+(role==='admin'?'<button class="secondary" onclick="driverPreview(\''+esc(d.id)+'\')">'+esc(t('driverView'))+'</button>':'')+'</div></article>').join(''):'<div class="muted">'+esc(t('noDrivers'))+'</div>';
}
function renderCustomers(){
  const box=$('customerProfiles');if(!box)return;
  const xs=['admin','dispatcher'].includes(role)?(state?.customerProfiles||[]):[];
  box.innerHTML=xs.length?xs.slice(0,100).map(p=>'<article class="queue-card"><h3>'+esc(p.customerName||p.customerPhone)+'</h3><div>'+esc(p.customerPhone)+' · '+Number(p.totalTrips||0)+' '+esc(t('trips'))+'</div><div class="muted">'+esc((p.serviceTypes||[]).join(' · '))+(p.lastTripAt?' · '+esc(t('lastTrip'))+': '+fmt(p.lastTripAt):'')+'</div></article>').join(''):'<div class="muted">'+esc(t('noCustomers'))+'</div>';
}
function renderJournal(){
  const box=$('unifiedJournal');if(!box)return;
  const xs=['admin','dispatcher'].includes(role)?(state?.unifiedJournal||[]):[];
  box.innerHTML=xs.length?xs.slice(0,200).map(e=>'<article class="queue-card"><h3>'+esc(e.type||e.kind||e.eventType||'event')+'</h3><div>'+esc(e.serviceType||'system')+(e.orderId?' · '+esc(e.orderId):'')+'</div><div class="muted">'+esc(e.actor||'')+((e.at||e.createdAt||e.timestamp)?' · '+fmt(e.at||e.createdAt||e.timestamp):'')+'</div></article>').join(''):'<div class="muted">'+esc(t('noJournal'))+'</div>';
}
function render(){
  const staff=['admin','dispatcher'].includes(role);
  $('adminTabs').hidden=!staff;
  $('smallCard').hidden=!staff;
  $('largeCard').hidden=!staff;
  renderMetrics();renderSmallOrders();renderLarge();renderTopups();renderDrivers();renderCustomers();renderJournal();
  setAdminTab(staff?adminTab:'orders');
  apply();
}
async function load(){
  if(['admin','dispatcher'].includes(role))state=await api('/api/unified/admin/state');
  else throw new Error('NO_ROLE');
  render();
}
function digits(v){return String(v||'').replace(/\D/g,'')}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch{}
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;
}
function publicSmallRideText(o){
  return ['🚐 VanClick · Taxi 1–4','📅 '+fmt(o.tripAt),'📍 '+String(o.fromArea||'')+' → '+String(o.toArea||''),'👥 '+Number(o.passengers||0),'🧳 '+Number(o.largeLuggage||0)+' + '+Number(o.smallLuggage||0),'💰 '+money(o.fare??o.quotedFare??0)+' ₪'].join('\n');
}
window.copySmallGroup=async id=>{const o=(state?.orders||[]).find(x=>x.id===id);if(!o)return;if(await copyText(publicSmallRideText(o)))alert(t('copied'))};
$('copySmallPool').onclick=async()=>{const xs=(state?.orders||[]).filter(o=>['awaiting_dispatch','pool'].includes(o.status));if(!xs.length)return alert(t('copyEmpty'));if(await copyText(xs.map(publicSmallRideText).join('\n\n──────────\n\n')))alert(t('copied')+' · '+xs.length)};

window.smallPublish=async id=>{const input=$('smallFare-'+id),fare=Number(input?.value);if(!Number.isFinite(fare)||fare<=0)return;await api('/api/dispatch/orders/'+id+'/publish',{method:'POST',body:{fare}});await load()};
window.smallRelease=async id=>{if(!confirm(t('release')+'?'))return;await api('/api/dispatch/orders/'+id+'/release',{method:'POST',body:{refundCommission:true}});await load()};
window.smallCancel=async id=>{if(!confirm(t('cancel')+'?'))return;await api('/api/dispatch/orders/'+id+'/cancel',{method:'POST',body:{refundCommission:true,reason:'admin_cancelled'}});await load()};
window.smallResolve=async id=>{const note=prompt(lang==='he'?'הערת פתרון':'Комментарий решения')||'';await api('/api/dispatch/orders/'+id+'/issue/resolve',{method:'POST',body:{note}});await load()};
window.smallMessage=async(id,kind)=>{const x=await api('/api/dispatch/orders/'+id+'/message/'+kind);const phone=digits(x.phone);if(phone)window.open('https://wa.me/'+(phone.startsWith('0')?'972'+phone.slice(1):phone)+'?text='+encodeURIComponent(x.message),'_blank','noopener')};

window.topupApprove=async id=>{await api('/api/dispatch/topups/'+id+'/approve',{method:'POST',body:{approvedBy:'admin'}});await load()};
window.topupReject=async id=>{await api('/api/dispatch/topups/'+id+'/reject',{method:'POST',body:{rejectedBy:'admin'}});await load()};
window.driverVerify=async id=>{await api('/api/dispatch/drivers/'+id+'/verification',{method:'POST',body:{verified:true,active:true}});await load()};
window.driverToggle=async(id,active)=>{await api('/api/dispatch/drivers/'+id+'/verification',{method:'POST',body:{active}});await load()};
window.driverResetPin=async id=>{const pin=prompt(t('driverPin'))||'';if(!/^\d{4,12}$/.test(pin))return;await api('/api/dispatch/drivers/'+id+'/pin',{method:'POST',body:{pin}});alert(t('approved'))};
window.driverPreview=id=>{if(role!=='admin')return;sessionStorage.setItem('taxi4_preview_driver_id',id);location.href='/driver/?admin_preview=1'};

window.largeApprove=async id=>{const raw=prompt(t('fare'));if(raw==null)return;const fare=Number(raw);if(!Number.isFinite(fare)||fare<=0)return;await api('/api/unified/large/orders/'+id+'/approve',{method:'POST',body:{fare}});await load()};
window.largeAssign=async id=>{const driverName=prompt(t('driver'));if(!driverName)return;const driverPhone=prompt(t('driverPhone'));if(!driverPhone)return;const vehiclePlate=prompt(t('vehiclePlate'))||'';await api('/api/unified/large/orders/'+id+'/assign',{method:'POST',body:{driverName,driverPhone,vehiclePlate}});await load()};
window.largeEnroute=async id=>{await api('/api/unified/large/orders/'+id+'/enroute',{method:'POST',body:{}});await load()};
window.largeComplete=async id=>{await api('/api/unified/large/orders/'+id+'/complete',{method:'POST',body:{}});await load()};
window.largeCancel=async id=>{if(!confirm(t('cancel')+'?'))return;await api('/api/unified/large/orders/'+id+'/cancel',{method:'POST',body:{reason:'staff_cancelled'}});await load()};

$('addDriverForm').onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));if(body.accessPin&&!/^\d{4,12}$/.test(body.accessPin))return;await api('/api/dispatch/drivers',{method:'POST',body});e.target.reset();await load()};
document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>setAdminTab(b.dataset.adminTab));
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=async()=>{lang=b.dataset.lang;localStorage.setItem('vcUnifiedLang',lang);apply();if(state)render()});

$('staffAuthForm').onsubmit=async e=>{
  e.preventDefault();$('staffAuthStatus').textContent='';
  try{
    const r=await fetch('/api/auth/dispatch/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:$('staffPhone').value,pin:$('staffPin').value})});
    let j={};try{j=await r.json()}catch{}
    if(!r.ok){const er=new Error(j.error||'LOGIN');er.status=r.status;throw er}
    token=j.token;role=j.role;sessionStorage.setItem('taxi4_dispatch_token',token);sessionStorage.setItem('taxi4_staff_role',role);
    if(routeRole())return;hideAuth();await load();
  }catch(e){
    $('staffAuthStatus').textContent=e.status===401?t('badPin'):e.status===403?t('forbidden'):e.message==='STAFF_PIN_NOT_CONFIGURED'?t('notConfigured'):e.message;
  }
};
$('logoutBtn').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST'})}catch{}sessionStorage.removeItem('taxi4_dispatch_token');sessionStorage.removeItem('taxi4_staff_role');token='';role='';location.reload()};

async function init(){
  readiness=await fetch('/health',{cache:'no-store'}).then(r=>r.json()).catch(()=>null);renderReadiness();
  const s=await fetch('/api/auth/status',{cache:'no-store'}).then(r=>r.json()).catch(()=>({required:true}));
  authRequired=s.required!==false;
  if(!authRequired){role='admin';hideAuth();await load();return}
  if(token&&role){
    try{if(routeRole())return;await load();hideAuth();return}
    catch(e){if(e.status===401||e.status===403){token='';role='';sessionStorage.removeItem('taxi4_dispatch_token');sessionStorage.removeItem('taxi4_staff_role')}else throw e}
  }
  showAuth();
}
apply();
init().catch(e=>showAuth(e.message));
setInterval(()=>{if(token||!authRequired)load().catch(()=>{})},12000);
})();
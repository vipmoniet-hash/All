/* MARKETPLACE_V1_DISPATCH_UI */
const API=window.TAXI4_API_BASE||location.origin;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
let state=null,authRequired=false,authToken=sessionStorage.getItem('taxi4_dispatch_token')||'',staffRole=sessionStorage.getItem('taxi4_staff_role')||'',dispatchLang=localStorage.getItem('taxi4_dispatch_lang')||'ru';

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pay=m=>m==='bit'?'Bit':'наличные';
const statusRu=s=>({awaiting_dispatch:dispatchLang==='he'?'חדש':'Новый',pool:dispatchLang==='he'?'פנוי':'Свободен',assigned:dispatchLang==='he'?'נלקח על ידי נהג':'Взят водителем',driver_enroute:dispatchLang==='he'?'הנהג בדרך':'Водитель в пути',completed:dispatchLang==='he'?'הושלם':'Завершён',cancelled:dispatchLang==='he'?'בוטל':'Отменён'})[s]||s;
const fmt=d=>{const x=new Date(d),locale=dispatchLang==='he'?'he-IL':'ru-RU',tz='Asia/Jerusalem';const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:tz}).format(x);const weekday=new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:tz}).format(x);const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:tz}).format(x);return date+' ('+weekday+') '+time;};
const money=n=>Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2});
const TOPUP_VAT_RATE=0.18;
const topupCredits=t=>Number(t?.credits??t?.amount??0);
const topupVat=t=>Number(t?.vatAmount??(topupCredits(t)*TOPUP_VAT_RATE).toFixed(2));
const topupTotal=t=>Number(t?.totalAmount??(topupCredits(t)+topupVat(t)).toFixed(2));

const HE_REPLACEMENTS=[
  ['VanClick Taxi 1–4 · изолированная тестовая среда','VanClick Taxi 1–4 · סביבת בדיקה מבודדת'],
  ['Вход в диспетчерскую','כניסה למוקד'],
  ['Для администратора: телефон из старого VanClick и тот же PIN. Диспетчер может войти по своему PIN.','למנהל: הטלפון מה-VanClick הישן ואותו PIN. סדרן יכול להיכנס עם ה-PIN שלו.'],
  ['Телефон администратора (если входите как владелец)','טלפון המנהל (אם נכנסים כבעלים)'],
  ['PIN администратора / диспетчера','PIN מנהל / סדרן'],
  ['Неверные данные входа','פרטי התחברות שגויים'],
  ['Не удалось проверить старый Admin-вход','לא ניתן לאמת כרגע את כניסת המנהל הישנה'],
  ['Нужно войти снова','יש להתחבר מחדש'],
  ['Выйти','יציאה'],
  ['Заказы','הזמנות'],
  ['Пополнения','טעינות'],
  ['Водители','נהגים'],
  ['Журнал','יומן'],
  ['Новые','חדשות'],
  ['Внимание','דורש טיפול'],
  ['Пул','מאגר'],
  ['В работе','בטיפול'],
  ['Требует вмешательства','דורש התערבות'],
  ['Здесь только исключения — обычные заказы водители забирают сами.','כאן מופיעים רק חריגים — הזמנות רגילות הנהגים לוקחים בעצמם.'],
  ['Нет ситуаций, требующих вмешательства','אין מצבים הדורשים התערבות'],
  ['Проблема водителя','בעיה של נהג'],
  ['Свободный заказ скоро','הזמנה פנויה בקרוב'],
  ['Просроченный свободный заказ','הזמנה פנויה שעברה את זמן האיסוף'],
  ['Водитель не подтвердил выезд','הנהג לא אישר יציאה'],
  ['Открыть заказ','פתח הזמנה'],
  ['Решено','טופל'],
  ['Новый','חדש'],
  ['Свободен','פנוי'],
  ['Взят водителем','נלקח על ידי נהג'],
  ['Водитель в пути','הנהג בדרך'],
  ['Завершён','הושלם'],
  ['Отменён','בוטל'],
  ['Пассажиры','נוסעים'],
  ['Багаж','מטען'],
  ['больших','גדולות'],
  ['малых','קטנות'],
  ['Цена','מחיר'],
  ['Комиссия','עמלה'],
  ['Водителю','לנהג'],
  ['Оплата','תשלום'],
  ['Рейс','טיסה'],
  ['Подача:','איסוף:'],
  ['Назначение:','יעד:'],
  ['Комментарий:','הערה:'],
  ['Водитель:','נהג:'],
  ['Отправить в общий пул','שלח למאגר הנהגים'],
  ['📋 Для группы','📋 לקבוצה'],
  ['↗ WhatsApp','↗ WhatsApp'],
  ['WhatsApp: заказ получен','WhatsApp: ההזמנה התקבלה'],
  ['Снять + вернуть комиссию','הסר נהג + החזר עמלה'],
  ['Снять без возврата','הסר ללא החזר'],
  ['WhatsApp: водитель','WhatsApp: נהג'],
  ['Закрыть проблему','סגור בעיה'],
  ['WhatsApp: водитель в пути','WhatsApp: הנהג בדרך'],
  ['Отменить','בטל'],
  ['Нет заказов по этому фильтру','אין הזמנות במסנן הזה'],
  ['Требуют внимания','דורשות טיפול'],
  ['В общем пуле','במאגר הכללי'],
  ['Завершены','הושלמו'],
  ['Чистая комиссия','עמלה נטו'],
  ['WhatsApp-группы · без данных клиента','קבוצות WhatsApp · ללא פרטי לקוח'],
  ['Копировать видимые','העתק מוצגות'],
  ['Поделиться видимыми','שתף מוצגות'],
  ['Нет ожидающих пополнений','אין טעינות ממתינות'],
  ['Проверить + включить','אמת + הפעל'],
  ['Выключить','כבה'],
  ['Включить','הפעל'],
  ['Сменить PIN','שנה PIN'],
  ['Журнал пуст','היומן ריק'],
  ['Проверить','אמת'],
  ['Баланс','יתרה'],
  ['баланс ','יתרה '],
  ['завершено ','הושלמו '],
  ['проверен','מאומת'],
  ['НЕ проверен','לא מאומת'],
  ['активен','פעיל'],
  ['выключен','כבוי'],
  ['Подтвердить','אשר'],
  ['Отклонить','דחה'],
  ['наличные','מזומן'],
  ['мин','דק׳'],
  ['обратно','חזור'],
  ['туда','הלוך'],
  ['Скопировано','הועתק'],
  ['Скопировано поездок:','מספר נסיעות שהועתקו:'],
  ['Нет видимых свободных или новых поездок','אין נסיעות חדשות או פנויות מוצגות'],
  ['Ответьте кодом','השב עם הקוד'],
  ['если готовы взять поездку.','אם אתה מוכן לקחת את הנסיעה.'],
  ['пасс.','נוסעים']
];

const tr=(ru,he)=>dispatchLang==='he'?he:ru;
function translateTextValue(value){
  let out=String(value??'');
  if(dispatchLang==='he'){
    for(const [ru,he] of HE_REPLACEMENTS)out=out.split(ru).join(he);
  }else{
    for(const [ru,he] of [...HE_REPLACEMENTS].reverse())out=out.split(he).join(ru);
  }
  return out;
}
function applyDispatchLanguage(){
  const he=dispatchLang==='he';
  document.documentElement.lang=he?'he':'ru';
  document.documentElement.dir=he?'rtl':'ltr';
  document.body?.classList.toggle('lang-he',he);
  document.title=he?'VanClick Taxi 1–4 · מוקד':'VanClick Taxi 1–4 · Диспетчерская';
  const root=document.body;
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement?.closest('script,style'))continue;
    if(he)node.nodeValue=translateTextValue(node.nodeValue);
  }
  root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{
    if(!el.dataset.ruPlaceholder)el.dataset.ruPlaceholder=el.getAttribute('placeholder')||'';
    el.setAttribute('placeholder',he?translateTextValue(el.dataset.ruPlaceholder):el.dataset.ruPlaceholder);
  });
  root.querySelectorAll('[data-lang-choice]').forEach(btn=>btn.classList.toggle('active',btn.dataset.langChoice===dispatchLang));
}
function setDispatchLang(lang){
  dispatchLang=lang==='he'?'he':'ru';
  localStorage.setItem('taxi4_dispatch_lang',dispatchLang);
  if(state)render();
  const auth=q('#dispatchAuthOverlay');if(auth){auth.remove();ensureDispatchAuthUi();}
  applyDispatchLanguage();
}
function ensureLanguageSwitch(){
  if(q('#dispatchLanguageSwitch'))return;
  const wrap=document.createElement('div');
  wrap.id='dispatchLanguageSwitch';
  wrap.className='dispatch-language-switch';
  wrap.innerHTML='<button type="button" data-lang-choice="ru">Русский</button><button type="button" data-lang-choice="he">עברית</button>';
  wrap.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setDispatchLang(btn.dataset.langChoice));
  const top=q('.topbar')||q('.shell');
  top?.appendChild(wrap);
  applyDispatchLanguage();
}

function publicOfferCode(o){return 'VC-'+String(o.id||'').slice(-5).toUpperCase();}
function publicRideText(o){
  const fare=Number(o.fare??o.quotedFare??0);
  const commission=Number(o.commission??o.quotedCommission??0);
  const driverNet=Math.max(0,fare-commission);
  const bags=[Number(o.largeLuggage||0)?'🧳 '+Number(o.largeLuggage||0):'',Number(o.smallLuggage||0)?'👜 '+Number(o.smallLuggage||0):''].filter(Boolean).join(' · ')||'без указанного багажа';
  return [
    '🚕 VanClick · '+publicOfferCode(o),
    '📅 '+fmt(o.tripAt),
    '📍 '+String(o.fromArea||'')+' → '+String(o.toArea||''),
    '👥 '+Number(o.passengers||1)+' пасс. · '+bags,
    '💰 Водителю: '+money(driverNet)+' ₪',
    '💳 '+pay(o.ridePaymentMethod),
    'Ответьте кодом '+publicOfferCode(o)+' если готовы взять поездку.'
  ].join('\n');
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true;}
  catch{
    const ta=document.createElement('textarea');
    ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;
  }
}
async function shareText(text){
  if(navigator.share){
    try{await navigator.share({text});return true;}catch(err){if(err?.name==='AbortError')return false;}
  }
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
  return true;
}
function visibleGroupOrders(){
  const filter=q('#filter')?.value||'all';
  return (state?.orders||[])
    .filter(o=>['awaiting_dispatch','pool'].includes(o.status))
    .filter(o=>filter==='all'||o.status===filter)
    .sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt))
    .slice(0,25);
}

function authFetch(url,opts={}){
  const headers={...(opts.headers||{})};
  if(authToken)headers.authorization='Bearer '+authToken;
  return fetch(url,{...opts,headers});
}
function ensureDispatchAuthUi(){
  if(!q('#dispatchAuthOverlay')){
    const wrap=document.createElement('div');
    wrap.id='dispatchAuthOverlay';
    wrap.className='auth-overlay hidden';
    wrap.innerHTML=`<form id="dispatchAuthForm" class="auth-card">
      <h2>Вход в диспетчерскую</h2>
      <p>Для администратора: телефон из старого VanClick и тот же PIN. Диспетчер может войти по своему PIN.</p>
      <input name="phone" inputmode="tel" autocomplete="username" placeholder="Телефон администратора (если входите как владелец)">
      <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN администратора / диспетчера" required>
      <button>Войти</button>
      <div id="dispatchAuthStatus"></div>
    </form>`;
    document.body.appendChild(wrap);
    q('#dispatchAuthForm').onsubmit=async e=>{
      e.preventDefault();
      const b=Object.fromEntries(new FormData(e.target));
      q('#dispatchAuthStatus').textContent='';
      try{
        const r=await fetch(API+'/api/auth/dispatch/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
        const j=await r.json();
        if(!r.ok)throw Error(j.error);
        authToken=j.token;
        staffRole=j.role||'';
        sessionStorage.setItem('taxi4_dispatch_token',authToken);
        sessionStorage.setItem('taxi4_staff_role',staffRole);
        if(staffRole==='dispatcher_5_6'){location.replace('/unified/dispatch/');return;}
        q('#dispatchAuthOverlay').classList.add('hidden');
        q('#dispatchLogout')?.classList.remove('hidden');
        await load(true);
      }catch(err){q('#dispatchAuthStatus').textContent=err.message==='INVALID_CREDENTIALS'?(dispatchLang==='he'?'פרטי התחברות שגויים':'Неверные данные входа'):err.message==='OWNER_AUTH_UNAVAILABLE'?(dispatchLang==='he'?'לא ניתן לאמת כרגע את כניסת המנהל הישנה':'Не удалось проверить старый Admin-вход'):err.message;applyDispatchLanguage();}
    };
  }
}
function showDispatchLogin(message=''){
  ensureDispatchAuthUi();
  authToken='';staffRole='';
  sessionStorage.removeItem('taxi4_dispatch_token');
  sessionStorage.removeItem('taxi4_staff_role');
  q('#dispatchAuthStatus').textContent=dispatchLang==='he'?translateTextValue(message):message;
  q('#dispatchAuthOverlay').classList.remove('hidden');
}
async function dispatchLogout(){
  try{if(authToken)await authFetch(API+'/api/auth/logout',{method:'POST'});}catch{}
  authToken='';staffRole='';sessionStorage.removeItem('taxi4_dispatch_token');sessionStorage.removeItem('taxi4_staff_role');showDispatchLogin();
}
async function initDispatchAuth(){
  ensureDispatchAuthUi();
  const r=await fetch(API+'/api/auth/status',{cache:'no-store'});
  const j=await r.json();
  authRequired=!!j.required;
  if(!authRequired){q('#dispatchLogout')?.classList.add('hidden');return true;}
  q('#dispatchLogout')?.classList.remove('hidden');
  if(!authToken){showDispatchLogin();return false;}
  if(staffRole==='dispatcher_5_6'){location.replace('/unified/dispatch/');return false;}
  return true;
}

function ensureMarketplaceUi(){
  if(!q('#marketplaceDevBadge')){
    const badge=document.createElement('div');
    badge.id='marketplaceDevBadge';
    badge.className='marketplace-dev-badge';
    badge.textContent='VanClick Taxi 1–4 · изолированная тестовая среда';
    q('.shell')?.prepend(badge);
  }
  if(!q('#dispatchLogout')){
    const logout=document.createElement('button');
    logout.id='dispatchLogout';
    logout.className='secondary hidden';
    logout.textContent='Выйти';
    logout.onclick=dispatchLogout;
    q('.topbar')?.appendChild(logout);
  }
  const driverForm=q('#addDriver');
  if(driverForm&&!driverForm.querySelector('[name="accessPin"]')){
    const pin=document.createElement('input');
    pin.name='accessPin';pin.type='password';pin.inputMode='numeric';pin.pattern='\\d{4,12}';pin.placeholder='PIN водителя (4–12 цифр)';pin.required=true;
    driverForm.querySelector('button')?.before(pin);
  }
  if(!q('#attentionPanel')){
    const panel=document.createElement('section');
    panel.id='attentionPanel';
    panel.className='attention-panel';
    const toolbar=q('#ordersPane .toolbar');
    toolbar?.after(panel);
  }
  if(!q('#groupExportBar')){
    const bar=document.createElement('div');
    bar.id='groupExportBar';
    bar.className='group-export-bar';
    bar.innerHTML='<span>WhatsApp-группы · без данных клиента</span><div><button class="secondary" id="copyVisibleGroup">Копировать видимые</button><button id="shareVisibleGroup">Поделиться видимыми</button></div>';
    q('#attentionPanel')?.after(bar);
    q('#copyVisibleGroup').onclick=exportVisibleForGroup;
    q('#shareVisibleGroup').onclick=shareVisibleForGroup;
  }
}

async function post(path,body={}){
  const r=await authFetch(API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),j=await r.json();
  if(r.status===401&&authRequired){showDispatchLogin('Нужно войти снова');throw Error('UNAUTHORIZED');}
  if(!r.ok)throw Error(j.error);return j;
}
async function message(id,kind){
  const r=await authFetch(`${API}/api/dispatch/orders/${id}/message/${kind}`),j=await r.json();
  if(r.status===401&&authRequired){showDispatchLogin('Нужно войти снова');return;}
  if(!r.ok)return alert(j.error);
  const phone=String(j.phone||'').replace(/\D/g,'').replace(/^0/,'972');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(j.message)}`,'_blank');
}

function attentionLabel(a){
  return ({
    open_issue:dispatchLang==='he'?'בעיה של נהג':'Проблема водителя',
    unclaimed_soon:dispatchLang==='he'?'הזמנה פנויה בקרוב':'Свободный заказ скоро',
    unclaimed_overdue:dispatchLang==='he'?'הזמנה פנויה שעברה את זמן האיסוף':'Просроченный свободный заказ',
    driver_not_enroute:dispatchLang==='he'?'הנהג לא אישר יציאה':'Водитель не подтвердил выезд'
  })[a.kind]||a.kind;
}

function renderAttention(){
  const items=state.attention||[];
  q('#attentionPanel').innerHTML=`<div class="attention-head"><div><small>Требует вмешательства</small><b>${items.length}</b></div><span>Здесь только исключения — обычные заказы водители забирают сами.</span></div>`+
    (items.length?items.map(a=>{
      const o=(state.orders||[]).find(x=>x.id===a.orderId);
      return `<div class="attention-item ${a.severity||''}">
        <div><b>${attentionLabel(a)}</b><span>${o?esc(o.fromArea)+' → '+esc(o.toArea):esc(a.orderId)} · ${Number.isFinite(a.minutesUntilTrip)?a.minutesUntilTrip+' мин':''}</span></div>
        <div class="attention-actions">
          <button onclick="focusOrder('${a.orderId}')">Открыть заказ</button>
          ${a.kind==='open_issue'?`<button class="secondary" onclick="resolveIssue('${a.orderId}')">Решено</button>`:''}
        </div>
      </div>`;
    }).join(''):'<div class="all-clear">Нет ситуаций, требующих вмешательства</div>');
}

function setQuickFilter(filter){
  const select=q('#filter');
  if(filter==='attention'){
    select.value='all';
    renderOrders();
    q('#attentionPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    select.value=filter;
    renderOrders();
    q('#ordersPane')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  qa('.dispatch-quick-nav button').forEach(b=>b.classList.toggle('active',b.dataset.quick===filter));
}

function ensureQuickNav(){
  if(q('#dispatchQuickNav'))return;
  const nav=document.createElement('nav');
  nav.id='dispatchQuickNav';
  nav.className='dispatch-quick-nav';
  nav.innerHTML=`
    <button data-quick="awaiting_dispatch"><span>Новые</span><b id="quickNew">0</b></button>
    <button data-quick="attention"><span>Внимание</span><b id="quickAttention">0</b></button>
    <button data-quick="pool"><span>Пул</span><b id="quickPool">0</b></button>
    <button data-quick="assigned"><span>В работе</span><b id="quickActive">0</b></button>`;
  document.body.appendChild(nav);
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>setQuickFilter(b.dataset.quick));
}

function orderPriority(o){
  const attention=(state.attention||[]).some(a=>a.orderId===o.id);
  return attention?0:1;
}

function renderOrders(){
  const f=q('#filter').value;
  const xs=(state.orders||[]).filter(o=>f==='all'||o.status===f).sort((a,b)=>orderPriority(a)-orderPriority(b)||new Date(a.tripAt)-new Date(b.tripAt));
  q('#orders').innerHTML=xs.length?xs.map(o=>{
    const issue=o.issue?.status==='open'?o.issue:null;
    return `<article class="order compact-order ${issue?'has-issue':''}" id="order-${o.id}">
      <button class="order-expand" type="button" onclick="toggleOrderDetails('${o.id}')" aria-label="Показать детали">⋯</button>
      <div class="order-head">
        <span class="code">${esc(o.bookingCode||o.id)}</span>
        <div class="route">${esc(o.fromArea)} → ${esc(o.toArea)}<small>${fmt(o.tripAt)} · ${o.leg===2?'обратно':'туда'}</small></div>
        <span class="state">${statusRu(o.status)}</span>
      </div>
      ${issue?`<div class="issue-open"><b>⚠ ${esc(issue.type)}</b>${issue.note?' · '+esc(issue.note):''}</div>`:''}
      <div class="details collapsible-details">
        <div class="detail">Пассажиры<b>${o.passengers}</b></div>
        <div class="detail">Багаж<b>${o.largeLuggage||0} больших · ${o.smallLuggage||0} малых</b></div>
        <div class="detail">Цена<b>${money(o.fare??o.quotedFare)} ₪</b></div>
        <div class="detail">Комиссия<b>${money(o.commission??o.quotedCommission)} ₪</b></div>
        <div class="detail">Водителю<b>${money((o.fare??o.quotedFare)-(o.commission??o.quotedCommission??0))} ₪</b></div>
        <div class="detail">Оплата<b>${pay(o.ridePaymentMethod)}</b></div>
        ${o.flightNumber?`<div class="detail">Рейс<b>✈ ${esc(o.flightNumber)} ${o.terminal?'· T'+esc(o.terminal):''}</b></div>`:''}
      </div>
      <div class="private collapsible-details"><b>${esc(o.customerName)} · ${esc(o.customerPhone)}</b><br>Подача: ${esc(o.exactPickup)}<br>Назначение: ${esc(o.exactDropoff)}${o.notes?`<br>Комментарий: ${esc(o.notes)}`:''}${o.assignedDriverId?`<br>Водитель: ${esc(o.assignedDriverId)}`:''}</div>
      <div class="order-actions">
        ${o.status==='awaiting_dispatch'?`<input id="fare-${o.id}" type="number" min="1" value="${o.quotedFare}"><button onclick="publishOrder('${o.id}')">Отправить в общий пул</button>`:''}
        ${o.status==='pool'?`<button onclick="message('${o.id}','approved')">WhatsApp: заказ получен</button>`:''}
        ${['assigned','driver_enroute'].includes(o.status)?`
          <button class="secondary" onclick="releaseOrder('${o.id}',true)">Снять + вернуть комиссию</button>
          <button class="danger-soft" onclick="releaseOrderNoRefund('${o.id}')">Снять без возврата</button>
          <button onclick="message('${o.id}','driver')">WhatsApp: водитель</button>`:''}
        ${issue?`<button class="secondary" onclick="resolveIssue('${o.id}')">Закрыть проблему</button>`:''}
        ${o.status==='driver_enroute'?`<button onclick="message('${o.id}','enroute')">WhatsApp: водитель в пути</button>`:''}
        ${!['completed','cancelled'].includes(o.status)?`<button class="danger" onclick="cancelOrder('${o.id}')">Отменить</button>`:''}
      </div>
    </article>`;
  }).join(''):'<div class="panel muted">Нет заказов по этому фильтру</div>';
}

function render(){
  const c=state.counts||{},f=state.finance||{};
  q('#metrics').innerHTML=[
    ['Новые',c.awaiting_dispatch||0],
    ['Требуют внимания',state.attentionCount||0],
    ['В общем пуле',c.pool||0],
    ['В работе',(c.assigned||0)+(c.driver_enroute||0)],
    ['Завершены',c.completed||0],
    ['Чистая комиссия',money(f.netCommissionCollected)+' ₪']
  ].map(([a,b])=>`<div class="metric"><span>${a}</span><b>${b}</b></div>`).join('');

  renderAttention();
  renderOrders();
  applyDispatchLanguage();
  if(q('#quickNew'))q('#quickNew').textContent=c.awaiting_dispatch||0;
  if(q('#quickAttention'))q('#quickAttention').textContent=state.attentionCount||0;
  if(q('#quickPool'))q('#quickPool').textContent=c.pool||0;
  if(q('#quickActive'))q('#quickActive').textContent=(c.assigned||0)+(c.driver_enroute||0);

  q('#topups').innerHTML=(state.topups||[]).filter(t=>t.status==='pending').map(t=>`<div class="topup"><b>${esc(t.driverId)}</b> · ${money(topupCredits(t))} ${tr('кредитов','קרדיטים')} · ${money(topupTotal(t))} ₪ ${tr('к оплате, включая НДС 18%','לתשלום כולל מע״מ 18%')} · ${pay(t.method)} <button onclick="approve('${t.id}')">${tr('Подтвердить','אישור')}</button><button class="danger" onclick="rejectT('${t.id}')">${tr('Отклонить','דחייה')}</button></div>`).join('')||`<p class="muted">${tr('Нет ожидающих пополнений','אין טעינות ממתינות')}</p>`;

  q('#drivers').innerHTML=(state.drivers||[]).map(d=>`<div class="driver-row"><b>${esc(d.name)}</b> · ${esc(d.phone)} · ${esc(d.vehiclePlate||'—')} · ${tr('баланс','יתרה')} ${money(d.wallet)} ${tr('кредитов','קרדיטים')} · завершено ${Number(d.completedTrips||0)} · ${d.verified?'проверен':'НЕ проверен'} · ${d.active?'активен':'выключен'} ${!d.verified?`<button onclick="verifyDriver('${d.id}')">Проверить + включить</button>`:`<button onclick="toggleDriver('${d.id}',${d.active?'false':'true'})">${d.active?'Выключить':'Включить'}</button>`} <button class="secondary" onclick="resetDriverPin('${d.id}')">Сменить PIN</button></div>`).join('');

  q('#log').innerHTML=(state.events||[]).slice(0,150).map(e=>`<div class="logrow"><b>${esc(e.type)}</b> · ${esc(e.orderId||'—')}<br><span class="muted">${fmt(e.at)} · ${esc(e.actor||'system')}</span></div>`).join('')||'<p class="muted">Журнал пуст</p>';
}

async function load(silent=false){
  if(authRequired&&!authToken){showDispatchLogin();return;}
  try{
    const r=await authFetch(API+'/api/dispatch/state',{cache:'no-store'}),j=await r.json();
    if(r.status===401&&authRequired){showDispatchLogin('Нужно войти снова');return;}
    if(!r.ok)throw Error(j.error);
    state=j;render();
  }catch(e){if(!silent)alert(e.message);}
}

window.toggleOrderDetails=id=>q('#order-'+CSS.escape(id))?.classList.toggle('expanded');
window.copyRideForGroup=async id=>{
  const o=(state?.orders||[]).find(x=>x.id===id);if(!o)return;
  const ok=await copyText(publicRideText(o));
  const btn=q('#order-'+CSS.escape(id)+' .group-copy');
  if(btn&&ok){const old=btn.textContent;btn.textContent='✓ Скопировано';setTimeout(()=>btn.textContent=old,1300);}
};
window.shareRideForGroup=async id=>{
  const o=(state?.orders||[]).find(x=>x.id===id);if(!o)return;
  await shareText(publicRideText(o));
};
window.exportVisibleForGroup=async()=>{
  const xs=visibleGroupOrders();if(!xs.length)return alert(tr('Нет видимых свободных или новых поездок','אין נסיעות חדשות או פנויות מוצגות'));
  const text=xs.map(publicRideText).join('\n\n──────────\n\n');
  const ok=await copyText(text);if(ok)alert(tr('Скопировано поездок: ','מספר נסיעות שהועתקו: ')+xs.length);
};
window.shareVisibleForGroup=async()=>{
  const xs=visibleGroupOrders();if(!xs.length)return alert(tr('Нет видимых свободных или новых поездок','אין נסיעות חדשות או פנויות מוצגות'));
  await shareText(xs.map(publicRideText).join('\n\n──────────\n\n'));
};
window.publishOrder=async id=>{try{await post(`/api/dispatch/orders/${id}/publish`,{fare:Number(q(`#fare-${id}`).value)});await load(true)}catch(e){alert(e.message)}};
window.releaseOrder=async(id,refundCommission)=>{
  if(!confirm(refundCommission?tr('Снять водителя и вернуть ему комиссию?','להסיר את הנהג ולהחזיר לו את העמלה?'):tr('Снять водителя без возврата комиссии?','להסיר את הנהג ללא החזר עמלה?')))return;
  try{await post(`/api/dispatch/orders/${id}/release`,{refundCommission});await load(true)}catch(e){alert(e.message)}
};
window.releaseOrderNoRefund=async id=>{
  if(!confirm(tr('Снять водителя БЕЗ возврата комиссии? Используйте только когда это действительно соответствует ситуации.','להסיר את הנהג ללא החזר עמלה? השתמש רק כאשר זה באמת מתאים למקרה.')))return;
  try{await post(`/api/dispatch/orders/${id}/release`,{refundCommission:false});await load(true)}catch(e){alert(e.message)}
};
window.cancelOrder=async id=>{
  if(!confirm(tr('Отменить заказ? Если водитель назначен, комиссия будет возвращена.','לבטל את ההזמנה? אם הוקצה נהג, העמלה תוחזר.')))return;
  try{await post(`/api/dispatch/orders/${id}/cancel`,{refundCommission:true,reason:'dispatcher_cancelled'});await load(true)}catch(e){alert(e.message)}
};
window.resolveIssue=async id=>{
  const note=prompt(tr('Короткое решение/комментарий диспетчера','פתרון קצר / הערת סדרן'))||'';
  try{await post(`/api/dispatch/orders/${id}/issue/resolve`,{note});await load(true)}catch(e){alert(e.message)}
};
window.focusOrder=id=>{
  q('#filter').value='all';renderOrders();
  setTimeout(()=>q('#order-'+CSS.escape(id))?.scrollIntoView({behavior:'smooth',block:'center'}),50);
};
window.approve=async id=>{await post(`/api/dispatch/topups/${id}/approve`,{approvedBy:'dispatcher'});load(true)};
window.rejectT=async id=>{await post(`/api/dispatch/topups/${id}/reject`,{rejectedBy:'dispatcher'});load(true)};
window.message=message;
window.verifyDriver=async id=>{await post(`/api/dispatch/drivers/${id}/verification`,{verified:true,active:true});load(true)};
window.toggleDriver=async(id,active)=>{await post(`/api/dispatch/drivers/${id}/verification`,{active});load(true)};
window.resetDriverPin=async id=>{const pin=prompt(tr('Новый PIN водителя (4–12 цифр)','PIN חדש לנהג (4–12 ספרות)'))||'';if(!/^\\d{4,12}$/.test(pin))return alert(tr('PIN должен содержать 4–12 цифр','ה-PIN חייב להכיל 4–12 ספרות'));try{await post(`/api/dispatch/drivers/${id}/pin`,{pin});alert(tr('PIN обновлён','ה-PIN עודכן'))}catch(e){alert(e.message)}};

q('#filter').onchange=renderOrders;
q('#refresh').onclick=()=>load();
q('#addDriverToggle').onclick=()=>q('#addDriver').classList.toggle('hidden');
q('#addDriver').onsubmit=async e=>{
  e.preventDefault();
  try{await post('/api/dispatch/drivers',Object.fromEntries(new FormData(e.target)));e.target.reset();await load(true)}catch(err){alert(err.message)}
};
qa('.tabs button').forEach(b=>b.onclick=()=>{
  qa('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
  qa('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));
});

async function boot(){
  ensureMarketplaceUi();
  ensureLanguageSwitch();
  ensureQuickNav();
  q('#filter').value='awaiting_dispatch';
  const ready=await initDispatchAuth();
  if(ready){await load(true);setQuickFilter('awaiting_dispatch');}
}
boot();
setInterval(()=>{if(document.visibilityState==='visible'&&(!authRequired||authToken))load(true)},10000);


/* UNIFIED_ADMIN_PARENT_LOGIN */
const UNIFIED_PARENT_ORIGIN='https://vanclick.co.il';
async function unifiedParentLogin(phone,pin){
  try{
    const response=await fetch(API+'/api/auth/dispatch/login',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({phone:String(phone||''),pin:String(pin||'')})
    });
    const payload=await response.json();
    if(!response.ok)throw Error(payload.error||'INVALID_CREDENTIALS');
    authToken=payload.token;
    staffRole=payload.role||'';
    sessionStorage.setItem('taxi4_dispatch_token',authToken);
    sessionStorage.setItem('taxi4_staff_role',staffRole);
    if(staffRole==='dispatcher_5_6')throw Error('FORBIDDEN');
    q('#dispatchAuthOverlay')?.classList.add('hidden');
    q('#dispatchLogout')?.classList.remove('hidden');
    await load(true);
    window.parent?.postMessage({type:'vanclick-unified-auth-result',surface:'taxi_1_4',ok:true,role:staffRole},UNIFIED_PARENT_ORIGIN);
  }catch(error){
    window.parent?.postMessage({type:'vanclick-unified-auth-result',surface:'taxi_1_4',ok:false,error:String(error?.message||error||'AUTH_FAILED')},UNIFIED_PARENT_ORIGIN);
  }
}
window.addEventListener('message',event=>{
  if(event.origin!==UNIFIED_PARENT_ORIGIN)return;
  if(event.data?.type!=='vanclick-unified-login')return;
  unifiedParentLogin(event.data.phone,event.data.pin);
});
try{
  if(window.parent&&window.parent!==window)window.parent.postMessage({type:'vanclick-unified-surface-ready',surface:'taxi_1_4',authenticated:Boolean(authToken),role:staffRole||''},UNIFIED_PARENT_ORIGIN);
}catch{}

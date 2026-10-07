(() => {
  const LARGE='https://vanclick.co.il/#calculator';
  const GOOGLE='https://www.google.com/maps/search/?api=1&query=VanClick&query_place_id=ChIJJ0rMhnYJ7w0RuUQKhFcvpYs';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

  function addMeta(name,content){
    let el=document.querySelector('meta[name="'+name+'"]');
    if(!el){el=document.createElement('meta');el.name=name;document.head.appendChild(el)}
    el.content=content;
  }
  function replaceHeader(){
    document.querySelectorAll('header,.header,.topbar,.navbar').forEach((h,i)=>{if(i===0)h.remove()});
    const h=document.createElement('header');
    h.className='vc-site-header';
    h.innerHTML=`
      <div class="vc-header-inner">
        <a class="vc-brand" href="/client/" aria-label="VanClick">
          <span class="vc-brand-mark">V</span>
          <span class="vc-brand-copy"><strong>VanClick</strong><small>מונית לנתב״ג • עד 4 נוסעים</small></span>
        </a>
        <span class="vc-header-spacer"></span>
        <nav class="vc-header-nav">
          <button type="button" class="vc-existing-order" id="vcExistingOrder">יש לי הזמנה</button>
          <a class="vc-header-large" href="${LARGE}">5–6 נוסעים → מונית גדולה</a>
        </nav>
      </div>`;
    document.body.prepend(h);
    h.querySelector('#vcExistingOrder').addEventListener('click',()=>{
      const t=document.getElementById('tracker');
      if(t){t.classList.remove('hidden');t.scrollIntoView({behavior:'smooth',block:'start'});}
    });
  }
  function buildHero(main,quote,booking){
    const hero=document.createElement('section');
    hero.className='vc-cro-hero';
    hero.id='vc-book';
    hero.innerHTML=`
      <div class="vc-cro-container">
        <div class="vc-cro-grid">
          <div class="vc-cro-copy">
            <span class="vc-eyebrow">VANCLICK • מונית רגילה לנתב״ג</span>
            <h1>אותו VanClick.<br>רכב קטן יותר.</h1>
            <p class="vc-cro-lede">ל-1–4 נוסעים: בוחרים כיוון ועיר, רואים מחיר קבוע מראש וממשיכים להזמנה קצרה. ל-5–6 נוסעים עוברים אוטומטית למסלול המונית הגדולה.</p>
            <div class="vc-proof-row">
              <span>מחיר מראש</span><span>עד 4 נוסעים</span><span>נהגים מורשים</span><span>Bit / מזומן</span>
            </div>
            <div class="vc-size-switch">
              <span class="vc-size-current">✓ 1–4 נוסעים</span>
              <a class="vc-size-large" href="${LARGE}">5–6 נוסעים / הרבה מזוודות</a>
            </div>
          </div>
          <div class="vc-booking-slot">
            <div class="vc-booking-label">מחיר והזמנה</div>
            <div class="vc-booking-title">בדיקת מחיר לנתב״ג</div>
            <div class="vc-booking-hint">רק עיר, כיוון, זמן ומספר נוסעים — המחיר מופיע לפני שאר הפרטים.</div>
          </div>
        </div>
        <div class="vc-details-slot"></div>
      </div>`;
    main.prepend(hero);
    if(quote) hero.querySelector('.vc-booking-slot').appendChild(quote);
    if(booking) hero.querySelector('.vc-details-slot').appendChild(booking);
    return hero;
  }
  function support(main){
    if(document.getElementById('vc-how')) return;
    const wrap=document.createElement('div');
    wrap.className='vc-support';
    wrap.innerHTML=`
      <section class="vc-section" id="vc-how">
        <div class="vc-section-head"><span class="vc-section-kicker">פשוט כמו VanClick</span><h2>שלושה צעדים וזהו</h2><p>אותה לוגיקה מוכרת: מחיר קודם, פרטים אחר כך.</p></div>
        <div class="vc-steps">
          <article class="vc-step"><span class="vc-step-num">1</span><strong>בודקים מחיר</strong><p>עיר, כיוון, תאריך ושעה ומספר נוסעים.</p></article>
          <article class="vc-step"><span class="vc-step-num">2</span><strong>משלימים פרטים</strong><p>כתובות מדויקות, קשר, מזוודות וטיסה אם צריך.</p></article>
          <article class="vc-step"><span class="vc-step-num">3</span><strong>מקבלים נהג</strong><p>ההזמנה עוברת לאישור ושיבוץ נהג מורשה.</p></article>
        </div>
      </section>
      <section class="vc-section" id="vc-trust">
        <div class="vc-trust-grid">
          <article class="vc-trust-card"><span class="vc-trust-icon">₪</span><strong>מחיר ברור</strong><p>במסלולים הנתמכים המחיר מוצג לפני שליחת ההזמנה.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">✓</span><strong>אותו סטנדרט</strong><p>אותו עסק VanClick, אותו כיוון שירות, רק רכב עד 4 נוסעים.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">↗</span><strong>צריכים גדול?</strong><p>5–6 נוסעים עוברים ישירות למסלול המונית הגדולה.</p></article>
        </div>
      </section>
      <section class="vc-section" id="vc-reviews">
        <div class="vc-review-panel"><div><strong>ביקורות VanClick בגוגל</strong><p>אותו עסק ואותו סטנדרט שירות.</p></div><a href="${GOOGLE}" target="_blank" rel="noopener">לצפייה בביקורות</a></div>
      </section>
      <section class="vc-section"><div class="vc-large-card"><div><h3>5–6 נוסעים או הרבה מזוודות?</h3><p>עברו למונית הגדולה של VanClick.</p></div><a href="${LARGE}">למונית גדולה</a></div></section>`;
    const tracker=document.getElementById('tracker');
    if(tracker) main.insertBefore(wrap,tracker); else main.appendChild(wrap);
  }
  function normalize(){
    const q=document.getElementById('quoteCard');
    const b=document.getElementById('bookingCard');
    if(q) q.classList.add('vc-quote-card');
    if(b) b.classList.add('vc-booking-card');
    document.querySelectorAll('#quoteBtn,#submitBtn').forEach(x=>x.classList.add('vc-main-cta'));
    document.querySelectorAll('#largeTaxiBtn,#largeTaxiBottom').forEach(x=>x.classList.add('vc-secondary-cta'));
    const p=document.querySelector('#passengers');
    if(p) p.addEventListener('change',()=>{if(+p.value>=5) location.href=LARGE;});
    if(b){
      const obs=new MutationObserver(()=>{
        if(!b.classList.contains('hidden')){
          setTimeout(()=>b.scrollIntoView({behavior:'smooth',block:'start'}),100);
        }
      });
      obs.observe(b,{attributes:true,attributeFilter:['class']});
    }
  }
  function sticky(){
    if(document.querySelector('.vc-mobile-sticky')) return;
    const s=document.createElement('div');s.className='vc-mobile-sticky';
    s.innerHTML='<button type="button">בדיקת מחיר והמשך להזמנה</button>';
    s.firstElementChild.addEventListener('click',()=>{
      const b=document.getElementById('quoteBtn');
      const q=document.getElementById('quoteCard');
      if(q) q.scrollIntoView({behavior:'smooth',block:'center'});
      if(b) setTimeout(()=>b.focus(),250);
    });
    document.body.appendChild(s);
  }
  ready(()=>{
    document.documentElement.lang='he';document.documentElement.dir='rtl';
    document.title='VanClick | מונית לנתב״ג עד 4 נוסעים';
    addMeta('description','VanClick – מונית לנתב״ג ומנתב״ג לעד 4 נוסעים. מחיר מראש והזמנה קצרה.');
    addMeta('robots','noindex,nofollow');
    const main=document.querySelector('main')||document.body;
    const quote=document.getElementById('quoteCard');
    const booking=document.getElementById('bookingCard');
    const legacy=quote?.closest('.hero-shell');
    replaceHeader();
    buildHero(main,quote,booking);
    if(legacy) legacy.remove();
    document.querySelectorAll('.proof-strip,.how-it-works,.large-transfer').forEach(x=>x.remove());
    normalize();
    support(main);
    sticky();
    document.body.classList.add('vc-cro-ready');
  });
})();
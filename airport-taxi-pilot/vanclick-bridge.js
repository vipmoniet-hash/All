(() => {
  const ROOT='https://vanclick.co.il/';
  const LARGE='https://vanclick.co.il/#calculator';
  const GOOGLE='https://www.google.com/maps/search/?api=1&query=VanClick&query_place_id=ChIJJ0rMhnYJ7w0RuUQKhFcvpYs';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

  function meta(name,content){
    let el=document.querySelector('meta[name="'+name+'"]');
    if(!el){el=document.createElement('meta');el.name=name;document.head.appendChild(el)}
    el.content=content;
  }

  function buildHeader(){
    document.querySelectorAll('header,.header,.topbar,.navbar').forEach(h=>h.remove());
    const h=document.createElement('header');
    h.className='vc-site-header';
    h.innerHTML=`
      <div class="vc-header-inner">
        <a class="vc-brand" href="/client/" aria-label="VanClick">
          <span class="vc-brand-mark">V</span>
          <span class="vc-brand-copy"><strong>VanClick</strong><small>הסעות פרטיות בישראל</small></span>
        </a>
        <span class="vc-header-spacer"></span>
        <nav class="vc-header-nav" aria-label="Primary navigation">
          <a href="/client/#vc-book">נתב״ג</a>
          <a href="${ROOT}intercity">בין־עירוני</a>
          <a href="${ROOT}business">נהג צמוד</a>
          <a href="${ROOT}prices">מחירון</a>
          <a href="${ROOT}guides">מאמרים</a>
          <a href="#vc-reviews">ביקורות</a>
          <a class="vc-header-large" href="${LARGE}">5–6 נוסעים</a>
          <a class="vc-header-phone" href="tel:0545718740">054-5718740</a>
        </nav>
      </div>`;
    document.body.prepend(h);
  }

  function buildHero(main,quote,booking){
    const hero=document.createElement('section');
    hero.className='vc-cro-hero';
    hero.id='vc-book';
    hero.innerHTML=`
      <div class="vc-cro-container">
        <div class="vc-cro-grid">
          <div class="vc-cro-copy">
            <span class="vc-eyebrow">VANCLICK • מונית לנתב״ג עד 4 נוסעים</span>
            <h1>מונית לנתב״ג — עד 4 נוסעים</h1>
            <p class="vc-cro-lede">VanClick עכשיו גם למונית רגילה. בוחרים כיוון, עיר, תאריך ושעה, רואים מחיר מראש ורק אם הוא מתאים ממשיכים לפרטי ההזמנה.</p>
            <div class="vc-proof-row">
              <span>עד 4 נוסעים</span>
              <span>מחיר מראש</span>
              <span>נהגים מורשים</span>
              <span>תשלום לנהג</span>
            </div>
            <div class="vc-size-switch" role="group" aria-label="בחירת סוג רכב">
              <span class="vc-size-current">✓ מונית רגילה — 1–4 נוסעים</span>
              <a class="vc-size-large" href="${LARGE}">מונית גדולה — 5–6 נוסעים + מזוודות</a>
            </div>
          </div>
          <div class="vc-booking-slot"></div>
        </div>
        <div class="vc-details-slot"></div>
      </div>`;
    main.prepend(hero);
    if(quote) hero.querySelector('.vc-booking-slot').appendChild(quote);
    if(booking) hero.querySelector('.vc-details-slot').appendChild(booking);
    return hero;
  }

  function normalizeFlow(){
    const quote=document.getElementById('quoteCard');
    const booking=document.getElementById('bookingCard');

    if(quote) quote.classList.add('vc-quote-card');
    if(booking) booking.classList.add('vc-booking-card');

    document.querySelectorAll('#quoteBtn,#submitBtn').forEach(b=>b.classList.add('vc-main-cta'));
    document.querySelectorAll('#largeTaxiBtn,#largeTaxiBottom').forEach(b=>b.classList.add('vc-secondary-cta'));

    const passengers=document.getElementById('passengers');
    if(passengers){
      passengers.addEventListener('change',()=>{
        if(Number(passengers.value)>=5) location.assign(LARGE);
      });
    }

    if(booking){
      const observer=new MutationObserver(()=>{
        if(!booking.classList.contains('hidden')){
          setTimeout(()=>booking.scrollIntoView({behavior:'smooth',block:'start'}),120);
        }
      });
      observer.observe(booking,{attributes:true,attributeFilter:['class']});
    }
  }

  function addSupport(main){
    if(document.getElementById('vc-how')) return;
    const w=document.createElement('div');
    w.className='vc-support';
    w.innerHTML=`
      <section class="vc-section" id="vc-how">
        <div class="vc-section-head">
          <span class="vc-section-kicker">אותה חוויית VanClick</span>
          <h2>מחיר קודם. פרטים אחר כך.</h2>
          <p>אותה לוגיקת הזמנה של VanClick, רק לרכב המתאים ל-1–4 נוסעים.</p>
        </div>
        <div class="vc-steps">
          <article class="vc-step"><span class="vc-step-num">1</span><strong>בודקים מחיר</strong><p>כיוון, עיר, תאריך ושעה ומספר נוסעים.</p></article>
          <article class="vc-step"><span class="vc-step-num">2</span><strong>משלימים פרטים</strong><p>כתובות, טלפון, מזוודות וטיסה אם צריך.</p></article>
          <article class="vc-step"><span class="vc-step-num">3</span><strong>מקבלים נהג</strong><p>הבקשה עוברת לאישור ושיבוץ נהג מורשה.</p></article>
        </div>
      </section>
      <section class="vc-section" id="vc-trust">
        <div class="vc-trust-grid">
          <article class="vc-trust-card"><span class="vc-trust-icon">₪</span><strong>מחיר מראש</strong><p>במסלולים הנתמכים המחיר מוצג לפני שליחת ההזמנה.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">✓</span><strong>VanClick אחד</strong><p>אותו עסק ואותו סטנדרט שירות, עם התאמת הרכב לגודל הקבוצה.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">↗</span><strong>צריכים רכב גדול?</strong><p>5–6 נוסעים עוברים ישירות למסלול המונית הגדולה של VanClick.</p></article>
        </div>
      </section>
      <section class="vc-section" id="vc-reviews">
        <div class="vc-review-panel">
          <div><strong>מה הלקוחות שלנו אומרים ב-Google</strong><p>ביקורות VanClick שייכות לאותו עסק ולשירות כולו.</p></div>
          <a href="${GOOGLE}" target="_blank" rel="noopener">לכל הביקורות ב-Google</a>
        </div>
      </section>
      <section class="vc-section">
        <div class="vc-large-card">
          <div><h3>5–6 נוסעים או הרבה מזוודות?</h3><p>בחרו מונית גדולה של VanClick והמשיכו לאותו תהליך הזמנה.</p></div>
          <a href="${LARGE}">למונית גדולה</a>
        </div>
      </section>`;
    const tracker=document.getElementById('tracker');
    if(tracker) main.insertBefore(w,tracker); else main.appendChild(w);
  }

  function sticky(){
    if(document.querySelector('.vc-mobile-sticky')) return;
    const s=document.createElement('div');
    s.className='vc-mobile-sticky';
    s.innerHTML='<button type="button">בדיקת מחיר לנתב״ג</button>';
    s.firstElementChild.addEventListener('click',()=>{
      const q=document.getElementById('quoteCard');
      const b=document.getElementById('quoteBtn');
      if(q) q.scrollIntoView({behavior:'smooth',block:'center'});
      if(b) setTimeout(()=>b.focus(),220);
    });
    document.body.appendChild(s);
  }

  ready(()=>{
    document.documentElement.lang='he';
    document.documentElement.dir='rtl';
    document.title='מונית לנתב״ג עד 4 נוסעים | VanClick';
    meta('description','VanClick – מונית לנתב״ג ומנתב״ג לעד 4 נוסעים. מחיר מראש והזמנה קצרה וברורה.');
    meta('robots','noindex,nofollow');
    meta('theme-color','#f6f5f1');

    const main=document.querySelector('main')||document.body;
    const quote=document.getElementById('quoteCard');
    const booking=document.getElementById('bookingCard');
    const legacy=quote?.closest('.hero-shell');

    buildHeader();
    buildHero(main,quote,booking);
    if(legacy) legacy.remove();

    document.querySelectorAll('.proof-strip,.how-it-works,.large-transfer').forEach(x=>x.remove());

    normalizeFlow();
    addSupport(main);
    sticky();
    document.body.classList.add('vc-cro-ready');
  });
})();
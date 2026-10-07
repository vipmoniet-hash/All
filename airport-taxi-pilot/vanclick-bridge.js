(() => {
  const VCLARGE='https://vanclick.co.il/#calculator';
  const GOOGLE='https://www.google.com/maps/search/?api=1&query=VanClick&query_place_id=ChIJJ0rMhnYJ7w0RuUQKhFcvpYs';

  const ready=fn=>document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',fn,{once:true})
    : fn();

  function txt(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
  function visible(el){
    if(!el) return false;
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
  }
  function addMeta(name,content){
    let m=document.querySelector('meta[name="'+name+'"]');
    if(!m){m=document.createElement('meta');m.name=name;document.head.appendChild(m)}
    m.content=content;
  }
  function addLink(rel,href){
    let l=document.querySelector('link[rel="'+rel+'"]');
    if(!l){l=document.createElement('link');l.rel=rel;document.head.appendChild(l)}
    l.href=href;
  }

  function bookingRoot(main){
    const candidates=[...main.querySelectorAll(
      'form,.booking-card,.quote-card,.calculator,.calc-box,[class*="booking"],[class*="quote"],[class*="calculator"],[class*="funnel"]'
    )];
    let best=null,bestScore=-1;
    for(const el of candidates){
      const fields=el.querySelectorAll('input,select,textarea').length;
      const buttons=el.querySelectorAll('button,[role="button"]').length;
      const content=txt(el);
      const score=fields*10+buttons*2+
        (/מחיר|price|הזמ|order|נתב/.test(content)?12:0)+
        (/נוסע|passenger/.test(content)?8:0);
      if(score>bestScore){best=el;bestScore=score}
    }
    if(!best){
      const firstField=main.querySelector('input,select,textarea');
      best=firstField?.closest('section,article,div')||null;
    }
    if(best&&best.tagName==='FORM'){
      const parent=best.parentElement;
      if(parent && parent!==main && parent.querySelectorAll('input,select,textarea').length===best.querySelectorAll('input,select,textarea').length){
        const cls=String(parent.className||'');
        if(/card|box|panel|booking|quote|calculator/i.test(cls)) best=parent;
      }
    }
    return best;
  }

  function replaceHeader(){
    const old=document.querySelector('header,.header,.topbar,.navbar,[class*="header"]');
    const h=document.createElement('header');
    h.className='vc-site-header';
    h.innerHTML=`
      <div class="vc-header-inner">
        <a class="vc-brand" href="/" aria-label="VanClick Taxi">
          <span class="vc-brand-mark" aria-hidden="true">V</span>
          <span class="vc-brand-copy"><strong>VanClick</strong><small>מונית לנתב״ג • עד 4 נוסעים</small></span>
        </a>
        <span class="vc-header-spacer"></span>
        <nav class="vc-header-nav" aria-label="ניווט ראשי">
          <a href="#vc-how">איך זה עובד</a>
          <a href="#vc-trust">למה VanClick</a>
          <a href="#vc-reviews">ביקורות</a>
          <a class="vc-header-large" href="${VCLARGE}">5–6 נוסעים → מונית גדולה</a>
        </nav>
      </div>`;
    if(old) old.replaceWith(h); else document.body.prepend(h);
  }

  function markLegacyHero(main,root){
    const firstH1=main.querySelector('h1');
    if(!firstH1) return;
    let block=firstH1.closest('section');
    if(!block) block=firstH1.closest('article,div');
    if(block && block!==main && block!==root && !block.contains(root)) block.classList.add('vc-original-hero');
  }

  function makeHero(main,root){
    const hero=document.createElement('section');
    hero.className='vc-cro-hero';
    hero.id='vc-book';
    hero.innerHTML=`
      <div class="vc-cro-container">
        <div class="vc-cro-grid">
          <div class="vc-cro-copy">
            <span class="vc-eyebrow">VANCLICK • מונית רגילה לנתב״ג</span>
            <h1>מונית לנתב״ג — עד 4 נוסעים, מחיר ידוע מראש</h1>
            <p class="vc-cro-lede">אותו שירות VanClick, עכשיו גם למונית רגילה. בוחרים כיוון, עיר, תאריך ושעה, רואים מחיר לפני שממלאים את שאר הפרטים וממשיכים להזמנה קצרה וברורה.</p>
            <div class="vc-promise">
              <strong>קודם מחיר. אחר כך פרטים.</strong>
              <span>אין צורך לנחש כמה תעלה הנסיעה. במסלולים הנתמכים המחיר מוצג לפני שליחת ההזמנה.</span>
            </div>
            <div class="vc-proof-row">
              <span>עד 4 נוסעים</span>
              <span>מחיר מראש</span>
              <span>נהגים מורשים</span>
              <span>Bit / מזומן לנהג</span>
            </div>
            <div class="vc-size-switch" role="group" aria-label="בחירת סוג רכב">
              <span class="vc-size-current">✓ 1–4 נוסעים — אתם במקום הנכון</span>
              <a class="vc-size-large" href="${VCLARGE}">5–6 נוסעים / הרבה מזוודות → VanClick גדול</a>
            </div>
          </div>
          <div class="vc-booking-slot" id="vc-booking-slot">
            <div class="vc-booking-label">מחיר והזמנה</div>
            <div class="vc-booking-title">בדיקת מחיר לנתב״ג</div>
            <div class="vc-booking-hint">ממלאים רק את הפרטים הדרושים להצגת המחיר. לאחר מכן ממשיכים לכתובת ולפרטי הקשר.</div>
          </div>
        </div>
      </div>`;
    main.prepend(hero);
    const slot=hero.querySelector('#vc-booking-slot');
    if(root) slot.appendChild(root);
    return hero;
  }

  function addSupportSections(main){
    if(document.querySelector('#vc-how')) return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`
      <section class="vc-cro-band">
        <div class="vc-cro-band-inner">
          <div class="vc-cro-band-copy">
            <strong>אותו VanClick — לפי גודל הקבוצה שלכם</strong>
            <span>1–4 נוסעים נשארים כאן. קבוצה של 5–6 נוסעים או צורך ברכב גדול עוברים למסלול VanClick למונית גדולה.</span>
          </div>
          <a href="${VCLARGE}">למונית גדולה 5–6 נוסעים</a>
        </div>
      </section>

      <section class="vc-section" id="vc-how">
        <div class="vc-section-head">
          <span class="vc-section-kicker">פשוט וקצר</span>
          <h2>כך מזמינים</h2>
          <p>המסלול בנוי כמו ב-VanClick: קודם בודקים התאמה ומחיר, ורק אחר כך משלימים את ההזמנה.</p>
        </div>
        <div class="vc-steps">
          <article class="vc-step"><span class="vc-step-num">1</span><strong>בוחרים נסיעה</strong><p>כיוון, עיר, תאריך, שעה ומספר נוסעים.</p></article>
          <article class="vc-step"><span class="vc-step-num">2</span><strong>רואים מחיר</strong><p>המחיר מוצג לפני שמבקשים מכם למלא את כל פרטי הנסיעה.</p></article>
          <article class="vc-step"><span class="vc-step-num">3</span><strong>משלימים הזמנה</strong><p>כתובת, פרטי קשר, מזוודות ואופן תשלום. התשלום על הנסיעה מועבר ישירות לנהג.</p></article>
        </div>
      </section>

      <section class="vc-section" id="vc-trust">
        <div class="vc-section-head">
          <span class="vc-section-kicker">VanClick</span>
          <h2>אותם עקרונות שירות</h2>
          <p>הכיוון קטן יותר, הסטנדרט נשאר אותו סטנדרט.</p>
        </div>
        <div class="vc-trust-grid">
          <article class="vc-trust-card"><span class="vc-trust-icon">₪</span><strong>מחיר ברור מראש</strong><p>במסלולים הנתמכים תראו את מחיר הנסיעה לפני השלמת ההזמנה.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">✓</span><strong>נהג מורשה</strong><p>הנסיעה מבוצעת על ידי נהג מונית מורשה. VanClick מרכזת את ההזמנה וההתאמה.</p></article>
          <article class="vc-trust-card"><span class="vc-trust-icon">↗</span><strong>הרכב הנכון לקבוצה</strong><p>אם אתם 5–6 נוסעים, המערכת מפנה אתכם ישירות לשירות המונית הגדולה של VanClick.</p></article>
        </div>
      </section>

      <section class="vc-section" id="vc-reviews">
        <div class="vc-review-panel">
          <div><strong>ביקורות לקוחות VanClick בגוגל</strong><p>זה אותו עסק ואותו סטנדרט שירות. אפשר לראות את הביקורות הציבוריות בפרופיל Google של VanClick.</p></div>
          <a href="${GOOGLE}" target="_blank" rel="noopener">לצפייה בביקורות Google</a>
        </div>
      </section>

      <section class="vc-section">
        <div class="vc-large-card">
          <div><h3>צריכים יותר מקום?</h3><p>ל-5–6 נוסעים, משפחות עם הרבה מזוודות או מי שמעדיף רכב גדול — עוברים ל-VanClick מונית גדולה.</p></div>
          <a href="${VCLARGE}">בדיקת מחיר למונית גדולה</a>
        </div>
      </section>
    `;
    main.append(...wrap.children);
  }

  function replaceFooter(){
    document.querySelectorAll('footer,.footer').forEach(f=>f.remove());
    const f=document.createElement('footer');
    f.className='vc-cro-footer';
    f.innerHTML=`
      <div class="vc-cro-footer-inner">
        <div><strong>VanClick</strong><small>שירותי מוניות והסעות לנתב״ג לפי גודל הקבוצה. הפלטפורמה למונית עד 4 נוסעים פועלת בנפרד טכנית, תחת אותה חוויית שירות של VanClick.</small></div>
        <div><a href="${VCLARGE}">VanClick מונית גדולה 5–6 נוסעים</a></div>
      </div>`;
    document.body.appendChild(f);
  }

  function funnelNormalize(main){
    const buttons=[...main.querySelectorAll('button,[role="button"],a.btn,a[class*="btn"]')];
    for(const b of buttons){
      const t=txt(b);
      if(/בחר נסיעה|המשך|חשב|מחיר|בדיקת מחיר|calculate|price/i.test(t)){
        if(!/חזור|back|נהג|driver/i.test(t)) b.classList.add('primary-cta');
      }
    }

    const groups=[...main.querySelectorAll('label')];
    groups.forEach(l=>{
      const t=txt(l);
      if(/מזוודות גדולות|large luggage/i.test(t)) l.textContent='מזוודות גדולות';
      if(/מזוודות קטנות|small luggage|טרולי/i.test(t)) l.textContent='מזוודות קטנות / טרולי';
    });

    const payText=[...main.querySelectorAll('p,span,small,div')].find(el=>/bit|מזומן|cash/i.test(txt(el)) && txt(el).length<160);
    if(payText && !/ישירות לנהג/.test(txt(payText))) payText.insertAdjacentHTML('afterend','<div class="vc-route-warning">התשלום על הנסיעה מתבצע ישירות לנהג ב-Bit או במזומן.</div>');
  }

  function installPassengerRedirect(){
    const redirect=()=>window.location.assign(VCLARGE);
    document.addEventListener('change',e=>{
      const el=e.target;
      if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      const hint=(el.id+' '+el.name+' '+el.getAttribute('aria-label')+' '+txt(el.closest('label,div'))).toLowerCase();
      if(!/passenger|pax|נוסע/.test(hint)) return;
      const n=parseInt(el.value,10);
      if(Number.isFinite(n)&&n>=5) redirect();
    },true);

    document.addEventListener('click',e=>{
      const b=e.target.closest('button,[role="button"]');
      if(!b) return;
      const v=(b.dataset.value||b.value||txt(b)).trim();
      if(v!=='5'&&v!=='6') return;
      const container=b.closest('fieldset,.form-group,[class*="passenger"],[class*="pax"],div');
      if(container && /נוסע|passenger|pax/i.test(txt(container))) {
        e.preventDefault();redirect();
      }
    },true);
  }

  function mobileSticky(main){
    if(document.querySelector('.vc-mobile-sticky')) return;
    const s=document.createElement('div');
    s.className='vc-mobile-sticky';
    s.innerHTML='<button type="button">בדיקת מחיר והמשך להזמנה</button>';
    s.querySelector('button').addEventListener('click',()=>{
      const candidates=[...main.querySelectorAll('button[type="submit"],.primary-cta,button,[role="button"]')]
        .filter(el=>visible(el)&&!el.closest('.vc-mobile-sticky'));
      const target=candidates.find(el=>/מחיר|המשך|הזמ|חשב|price|continue|order/i.test(txt(el)))||main.querySelector('input,select');
      if(target){
        target.scrollIntoView({behavior:'smooth',block:'center'});
        if(target.matches('button,[role="button"]')) setTimeout(()=>target.click(),260);
        else setTimeout(()=>target.focus(),260);
      }
    });
    document.body.appendChild(s);
  }

  ready(()=>{
    document.documentElement.lang='he';
    document.documentElement.dir='rtl';
    document.title='VanClick | מונית לנתב״ג עד 4 נוסעים';
    addMeta('description','VanClick – הזמנת מונית לנתב״ג ומנתב״ג לעד 4 נוסעים. מחיר מוצג מראש במסלולים נתמכים והזמנה קצרה וברורה.');
    addMeta('theme-color','#f6f7f5');
    addMeta('robots','noindex,nofollow');
    addLink('icon','https://vanclick.co.il/favicon.svg');

    const main=document.querySelector('main')||document.body;
    const root=bookingRoot(main);
    markLegacyHero(main,root);
    replaceHeader();
    makeHero(main,root);
    funnelNormalize(main);
    addSupportSections(main);
    replaceFooter();
    installPassengerRedirect();
    mobileSticky(main);
    document.body.classList.add('vc-cro-ready');
  });
})();
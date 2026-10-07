(() => {
  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, {once:true})
    : fn();

  ready(() => {
    document.body.classList.add('vc-ecosystem');

    const header = document.querySelector('header,.header,.topbar,.navbar,[class*="header"]');
    if (header && !header.querySelector('.vc-brand-bridge')) {
      const existingBrand = header.querySelector('.brand,.logo,[class*="brand"],strong,h1');
      let name = existingBrand?.textContent?.trim().replace(/\s+/g,' ') || 'Airport Taxi';
      if (name.length > 28) name = 'Airport Taxi';
      const bar = document.createElement('div');
      bar.className = 'vc-brand-bridge';
      bar.innerHTML =
        '<span class="vc-brand-mark" aria-hidden="true">V</span>' +
        '<span class="vc-brand-copy"><strong></strong><small>מונית עד 4 נוסעים • נתב״ג</small></span>' +
        '<span class="vc-brand-spacer"></span>' +
        '<a class="vc-brand-chip" href="https://vanclick.co.il/" rel="noopener">5–6 נוסעים? VanClick</a>';
      bar.querySelector('strong').textContent = name;
      header.prepend(bar);
    }

    if (!document.querySelector('.vc-mobile-sticky')) {
      const sticky = document.createElement('div');
      sticky.className = 'vc-mobile-sticky';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'בדיקת מחיר והמשך להזמנה';
      button.addEventListener('click', () => {
        const candidates = [...document.querySelectorAll(
          'main button[type="submit"], main .btn-primary, main .primary-cta, main button, main [role="button"]'
        )].filter(el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 80 && r.height > 30 && s.display !== 'none' && s.visibility !== 'hidden' && !el.closest('.vc-mobile-sticky');
        });
        const target = candidates.find(el => /מחיר|המשך|הזמ|חשב|price|continue|order/i.test(el.textContent || '')) || candidates[0];
        if (target) {
          target.scrollIntoView({behavior:'smooth', block:'center'});
          setTimeout(() => target.click(), 260);
        }
      });
      sticky.appendChild(button);
      document.body.appendChild(sticky);
    }

    const largeTaxiLinks = [...document.querySelectorAll('a[href*="vanclick.co.il"]')];
    largeTaxiLinks.forEach(a => {
      if (!a.getAttribute('aria-label')) a.setAttribute('aria-label','VanClick — מונית גדולה ל-5–6 נוסעים');
    });
  });
})();
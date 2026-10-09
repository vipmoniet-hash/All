'use strict';

// Only the public Taxi 1–4 customer surface is normalized. Internal test tools
// stay in their own environment and must never be promoted to a sales page.
const pilotFooter=/<footer\b[^>]*>\s*<span\b[^>]*>\s*סביבת בדיקה\s*·\s*Airport Taxi Pilot\s*<\/span>\s*<a\b[^>]*>\s*כלי בדיקה\s*<\/a>\s*<\/footer>/gi;
const leakedPilot=/סביבת בדיקה\s*·\s*Airport Taxi Pilot|>\s*כלי בדיקה\s*<|href\s*=\s*["']https:\/\/vanclick\.co\.il\/test\/?["']/i;
const publicFooter='<footer class="vanclick-public-footer"><span>VanClick · מוניות לנתב״ג בהזמנה מראש</span><a href="https://vanclick.co.il/terms">תנאי השירות</a></footer>';

function normalizePublicClientFooter(html) {
  const result=String(html).replace(pilotFooter, publicFooter);
  if(leakedPilot.test(result)) throw new Error('Customer-facing Taxi 1–4 HTML still contains internal pilot or test links');
  return result;
}
module.exports={normalizePublicClientFooter};

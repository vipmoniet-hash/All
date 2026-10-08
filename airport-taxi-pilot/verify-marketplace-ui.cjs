const fs=require('fs');
const path=require('path');
const assert=require('assert').strict;

const root=process.argv[2]||'app';
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const driver=read('apps/driver/public/app.js');
const dispatch=read('apps/dispatch/public/app.js');
const client=read('apps/client/public/app.js');
const driverHtml=read('apps/driver/public/index.html');

assert.ok(driver.includes('MARKETPLACE_V1_DRIVER_UI'),'driver UI must carry marketplace v1 marker');
assert.ok(driver.includes('poolFilters'),'driver UI must provide high-volume pool filters');
assert.ok(driver.includes('claimBlockReason'),'driver UI must explain why a ride cannot be claimed');
assert.ok(driver.includes('/issue'),'driver UI must expose issue reporting');
assert.ok(driver.includes('location.origin'),'driver UI must default API to its isolated origin');
assert.ok(driver.includes('/api/auth/driver/login'),'driver UI must support protected driver login');
assert.ok(driver.includes('sessionStorage'),'driver UI must persist only browser-session auth token');
assert.ok(driver.includes('TOPUP_VAT_RATE'),'driver UI must calculate VAT for credit top-ups');
assert.ok(driver.includes('totalAmount'),'driver UI must show total payment including VAT');
assert.ok(driver.includes('admin_preview'),'driver UI must support admin preview mode');
assert.ok(driver.includes('/api/unified/admin/driver-preview/'),'admin preview must load through the protected read-only preview endpoint');
assert.ok(driver.includes('previewMode'),'driver UI must mark preview state explicitly');
assert.ok(driver.includes('חזרה לניהול'),'driver UI must provide a return-to-admin control in preview mode');
assert.ok(driverHtml.includes('קרדיטים'),'driver wallet UI must label balance and purchases as credits');
assert.ok(driverHtml.includes('מע״מ 18%'),'driver wallet UI must disclose 18% VAT');

assert.ok(dispatch.includes('MARKETPLACE_V1_DISPATCH_UI'),'dispatch UI must carry marketplace v1 marker');
assert.ok(dispatch.includes('state.attention'),'dispatch UI must render attention queue');
assert.ok(dispatch.includes('netCommissionCollected'),'dispatch UI must expose net commission metric');
assert.ok(dispatch.includes('/issue/resolve'),'dispatch UI must resolve driver issues');
assert.ok(dispatch.includes('refundCommission:false'),'dispatch UI must support release without automatic commission refund');
assert.ok(dispatch.includes('/api/auth/dispatch/login'),'dispatch UI must support protected dispatcher login');
assert.ok(dispatch.includes('taxi4_staff_role'),'small dispatch UI must remember the authenticated staff role');
assert.ok(dispatch.includes("['admin','dispatcher'].includes(staffRole)"),'small dispatch UI must recognize unified staff roles');
assert.ok(dispatch.includes('/unified/dispatch/'),'authenticated staff must be redirected to the unified dispatch');
for(const needle of ['vanclick-unified-login','vanclick-unified-session-probe','vanclick-unified-surface-ready','vanclick-unified-auth-result','UNIFIED_PARENT_ORIGIN']){
  assert.ok(dispatch.includes(needle),'working Taxi 1-4 dispatch bridge missing '+needle);
}
assert.ok(dispatch.includes('UNIFIED_EMBED'),'working Taxi 1-4 dispatch must detect iframe embed mode');
assert.ok(dispatch.includes("!UNIFIED_EMBED&&['admin','dispatcher'].includes(staffRole)"),'embedded Taxi 1-4 must not redirect itself out of the unified shell');

assert.ok(dispatch.includes('/drivers/${id}/pin'),'dispatch UI must support driver PIN rotation');
assert.ok(dispatch.includes('dispatchLang'),'dispatch UI must persist selected Russian/Hebrew language');
assert.ok(dispatch.includes('setDispatchLang'),'dispatch UI must expose language switch');
assert.ok(dispatch.includes('topupTotal'),'dispatch UI must show gross top-up payment');
assert.ok(dispatch.includes('18%'),'dispatch UI must disclose VAT on pending credit purchases');
assert.ok(dispatch.includes("document.documentElement.dir"),'dispatch UI must switch RTL/LTR direction');
assert.ok(dispatch.includes("עברית"),'dispatch UI must expose Hebrew language choice');
for(const pair of [["Заказы","הזמנות"],["Пополнения","טעינות"],["Водители","נהגים"],["Журнал","יומן"]]){
  assert.ok(dispatch.includes(`['${pair[0]}','${pair[1]}']`),`dispatch UI must contain Hebrew tab translation for ${pair[0]}`);
}
assert.ok(dispatch.includes("Русский"),'dispatch UI must expose Russian language choice');
assert.ok(dispatch.includes("Asia/Jerusalem"),'dispatch dates must be fixed to Israel timezone');
assert.ok(dispatch.includes("weekday:'short'"),'dispatch dates must include weekday');
assert.ok(dispatch.includes("dispatchLang==='he'?'he-IL':'ru-RU'"),'weekday locale must follow selected dispatcher language');
assert.ok(dispatch.includes("year:'numeric'"),'dispatch date must use full year');

assert.ok(client.includes('נמצאת בבדיקת המוקד'),'client confirmation must describe staff review before publication');
assert.ok(dispatch.includes('Отправить в общий пул'),'dispatch UI must expose explicit staff publication action');
assert.ok(dispatch.includes("awaiting_dispatch:dispatchLang==='he'?'חדש':'Новый'"),'dispatch UI must label private incoming rides in both languages');
assert.ok(dispatch.includes('publicRideText'),'dispatch UI must build privacy-safe WhatsApp ride text');
assert.ok(dispatch.includes('copyRideForGroup'),'dispatch UI must support one-tap single ride copy');
assert.ok(dispatch.includes('exportVisibleForGroup'),'dispatch UI must support batch export of visible rides');
assert.ok(dispatch.includes('navigator.share'),'dispatch UI must support native mobile sharing when available');
const publicRideTextBody=(dispatch.match(/function publicRideText\(o\)\{([\s\S]*?)\n\}/)||[])[1]||'';
assert.ok(publicRideTextBody,'privacy-safe group formatter must be extractable');
for(const forbidden of ['customerName','customerPhone','exactPickup','exactDropoff','notes','bookingCode','flightNumber']){
  assert.ok(!publicRideTextBody.includes(forbidden),'privacy-safe group formatter must exclude '+forbidden);
}

console.log('MARKETPLACE_V1_UI_GATE_OK',JSON.stringify({
  driver:true,
  dispatch:true,
  client:true
}));

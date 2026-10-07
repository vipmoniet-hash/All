const fs=require('fs');
const path=require('path');
const assert=require('assert').strict;

const root=process.argv[2]||'app';
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const driver=read('apps/driver/public/app.js');
const dispatch=read('apps/dispatch/public/app.js');
const client=read('apps/client/public/app.js');

assert.ok(driver.includes('MARKETPLACE_V1_DRIVER_UI'),'driver UI must carry marketplace v1 marker');
assert.ok(driver.includes('poolFilters'),'driver UI must provide high-volume pool filters');
assert.ok(driver.includes('claimBlockReason'),'driver UI must explain why a ride cannot be claimed');
assert.ok(driver.includes('/issue'),'driver UI must expose issue reporting');
assert.ok(driver.includes('location.origin'),'driver UI must default API to its isolated origin');
assert.ok(driver.includes('/api/auth/driver/login'),'driver UI must support protected driver login');
assert.ok(driver.includes('sessionStorage'),'driver UI must persist only browser-session auth token');

assert.ok(dispatch.includes('MARKETPLACE_V1_DISPATCH_UI'),'dispatch UI must carry marketplace v1 marker');
assert.ok(dispatch.includes('state.attention'),'dispatch UI must render attention queue');
assert.ok(dispatch.includes('netCommissionCollected'),'dispatch UI must expose net commission metric');
assert.ok(dispatch.includes('/issue/resolve'),'dispatch UI must resolve driver issues');
assert.ok(dispatch.includes('refundCommission:false'),'dispatch UI must support release without automatic commission refund');
assert.ok(dispatch.includes('/api/auth/dispatch/login'),'dispatch UI must support protected dispatcher login');
assert.ok(dispatch.includes('/drivers/${id}/pin'),'dispatch UI must support driver PIN rotation');

assert.ok(client.includes('נמצאת בבדיקת המוקד'),'client confirmation must describe staff review before publication');
assert.ok(dispatch.includes('Отправить в общий пул'),'dispatch UI must expose explicit staff publication action');
assert.ok(dispatch.includes("awaiting_dispatch:'Новый'"),'dispatch UI must label private incoming rides as new');

console.log('MARKETPLACE_V1_UI_GATE_OK',JSON.stringify({
  driver:true,
  dispatch:true,
  client:true
}));

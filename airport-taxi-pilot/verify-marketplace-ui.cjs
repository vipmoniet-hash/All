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

assert.ok(dispatch.includes('MARKETPLACE_V1_DISPATCH_UI'),'dispatch UI must carry marketplace v1 marker');
assert.ok(dispatch.includes('state.attention'),'dispatch UI must render attention queue');
assert.ok(dispatch.includes('netCommissionCollected'),'dispatch UI must expose net commission metric');
assert.ok(dispatch.includes('/issue/resolve'),'dispatch UI must resolve driver issues');
assert.ok(dispatch.includes('refundCommission:false'),'dispatch UI must support release without automatic commission refund');

assert.ok(client.includes('פורסמה לנהגים מאומתים'),'client confirmation must describe direct driver-pool publication');
assert.ok(!client.includes('הבקשה עוברת לאישור ושיבוץ נהג.'),'client must not claim routine manual approval is pending');

console.log('MARKETPLACE_V1_UI_GATE_OK',JSON.stringify({
  driver:true,
  dispatch:true,
  client:true
}));

const fs=require('fs');
const path=require('path');
const root=path.resolve(process.argv[2]||'app');
const assert=require('assert/strict');

const ui=fs.readFileSync(path.join(root,'apps','unified','public','dispatch','dispatch.js'),'utf8');
const html=fs.readFileSync(path.join(root,'apps','unified','public','dispatch','index.html'),'utf8');

for(const needle of [
  '/api/auth/status',
  '/api/auth/dispatch/login',
  "role==='admin'",
  "role==='dispatcher_1_4'",
  "role==='dispatcher_5_6'",
  '/api/unified/admin/state',
  '/api/unified/large/state',
  '/api/unified/large/orders/',
  '/approve',
  '/assign',
  '/enroute',
  '/complete',
  '/cancel',
  'taxi4_dispatch_token'
]) assert.ok(ui.includes(needle),'unified control UI missing '+needle);

assert.ok(html.includes('id="staffAuthOverlay"'),'control center must provide a staff login surface');
assert.ok(html.includes('noindex,nofollow'),'control center must remain noindex');

console.log('UNIFIED_CONTROL_UI_OK',JSON.stringify({
  roleLogin:true,
  adminView:true,
  dispatcher1to4Routing:true,
  dispatcher5to6View:true,
  largeActions:true
}));
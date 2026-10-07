import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4199;
const dataDir=path.join(root,'data','http-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir},
  stdio:['ignore','pipe','pipe']
});

let output='';
child.stdout.on('data',d=>output+=String(d));
child.stderr.on('data',d=>output+=String(d));

const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitForHealth(){
  for(let i=0;i<40;i++){
    try{
      const r=await fetch(base+'/health');
      if(r.ok)return;
    }catch{}
    await sleep(100);
  }
  throw new Error('HTTP_E2E_SERVER_NOT_READY '+output);
}
async function json(pathname,options={}){
  const r=await fetch(base+pathname,options);
  const j=await r.json();
  return {r,j};
}
const post=(pathname,body={})=>json(pathname,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(body)
});

try{
  await waitForHealth();

  const bookingBody={
    passengers:2,
    largeLuggage:0,
    smallLuggage:0,
    paymentMethod:'bit',
    customerName:'HTTP Test',
    customerPhone:'0501112233',
    fromArea:'ראשון לציון',
    toArea:'נתב״ג',
    tripAt:'2026-10-12T11:00',
    exactPickup:'הרצל 1 ראשון לציון',
    exactDropoff:'נתב״ג טרמינל 3'
  };
  let x=await post('/api/client/bookings',bookingBody);
  assert.equal(x.r.status,201,'booking endpoint returns 201');
  assert.equal(x.j.orders[0].status,'pool','HTTP booking enters pool');
  const orderId=x.j.orders[0].id;
  const bookingCode=x.j.bookingCode;

  x=await json('/api/drivers/drv-001/state');
  assert.equal(x.r.status,200,'driver state endpoint works');
  assert.ok(x.j.pool.some(o=>o.id===orderId),'new booking visible in driver pool');
  const initialWallet=x.j.driver.wallet;

  x=await post('/api/drivers/drv-001/orders/'+orderId+'/buy');
  assert.equal(x.r.status,200,'driver claim endpoint works');
  assert.equal(x.j.order.assignedDriverId,'drv-001','driver owns claimed ride');
  const afterFirst=x.j.wallet;
  assert.ok(afterFirst<initialWallet,'first claim debits commission');

  x=await post('/api/drivers/drv-001/orders/'+orderId+'/buy');
  assert.equal(x.r.status,200,'same driver retry is idempotent over HTTP');
  assert.equal(x.j.wallet,afterFirst,'retry does not debit wallet again');
  assert.equal(x.j.payment.status,'already_owned','retry reports existing ownership');

  x=await post('/api/drivers/drv-001/orders/'+orderId+'/issue',{type:'client_unreachable',note:'HTTP test'});
  assert.equal(x.r.status,200,'driver issue endpoint works: '+JSON.stringify(x.j));
  assert.equal(x.j.status,'open','driver issue opens');

  x=await json('/api/dispatch/state');
  assert.equal(x.r.status,200,'dispatch state endpoint works');
  assert.ok(x.j.attention.some(a=>a.orderId===orderId&&a.kind==='open_issue'),'dispatch sees issue attention');

  x=await post('/api/dispatch/orders/'+orderId+'/issue/resolve',{note:'HTTP resolved'});
  assert.equal(x.r.status,200,'dispatch issue resolution endpoint works');
  assert.equal(x.j.status,'resolved','dispatch resolves issue');

  x=await json('/api/client/bookings/'+encodeURIComponent(bookingCode)+'?phone='+encodeURIComponent(bookingBody.customerPhone));
  assert.equal(x.r.status,200,'client tracking endpoint works');
  assert.equal(x.j.orders[0].status,'assigned','client sees assigned ride');
  assert.equal(x.j.orders[0].driver?.name,'נהג הדגמה 1','client sees assigned driver details');

  console.log('MARKETPLACE_V1_HTTP_E2E_OK',JSON.stringify({
    orderId,
    bookingCode,
    walletBefore:initialWallet,
    walletAfter:afterFirst,
    issueFlow:true,
    clientTracking:true
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(r=>child.once('exit',r)),
    sleep(1000).then(()=>child.kill('SIGKILL'))
  ]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

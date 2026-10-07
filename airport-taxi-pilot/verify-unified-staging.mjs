import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4220;
const dataDir=path.join(root,'data','unified-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir,MARKETPLACE_AUTH_REQUIRED:'0',UNIFIED_REQUIRE_AUTH:'0',UNIFIED_REQUIRE_POSTGRES:'0'},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',d=>output+=String(d));
child.stderr.on('data',d=>output+=String(d));
const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHealth(){
  for(let i=0;i<60;i++){
    try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}
    await sleep(100);
  }
  throw new Error('UNIFIED_SERVER_NOT_READY '+output);
}
async function json(pathname,{method='GET',body}={}){
  const r=await fetch(base+pathname,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json();}catch{}
  return {r,j};
}

try{
  await waitHealth();

  for(const route of ['/unified/','/unified/large/','/unified/dispatch/']){
    const r=await fetch(base+route);
    assert.equal(r.status,200,route+' must be publicly reachable in isolated staging');
    const html=await r.text();
    assert.match(html,/noindex,nofollow/,route+' must stay out of search indexing');
  }

  let x=await json('/api/unified/large/bookings',{method:'POST',body:{
    direction:'to',
    city:'ראשון לציון',
    tripAt:'2026-10-20T11:30',
    passengers:6,
    largeLuggage:4,
    smallLuggage:2,
    customerName:'Unified Shadow Test',
    customerPhone:'0501234567',
    exactPickup:'Test pickup 1',
    exactDropoff:'Ben Gurion Airport',
    flightNumber:'',
    notes:'shadow only'
  }});
  assert.equal(x.r.status,201,'large shadow booking must be accepted without touching production');
  assert.equal(x.j.serviceType,'large_5_6','large shadow booking must carry explicit service type');
  assert.equal(x.j.status,'awaiting_dispatch','large shadow booking must enter staff-only intake');
  const largeId=x.j.id;

  x=await json('/api/client/bookings',{method:'POST',body:{
    passengers:2,
    largeLuggage:1,
    smallLuggage:1,
    paymentMethod:'cash',
    customerName:'Unified Small Test',
    customerPhone:'0507654321',
    fromArea:'ראשון לציון',
    toArea:'Ben Gurion Airport',
    tripAt:'2026-10-20T12:30',
    exactPickup:'Small test pickup',
    exactDropoff:'Ben Gurion Airport'
  }});
  assert.equal(x.r.status,201,'small booking must still use the Taxi 1-4 engine');
  assert.equal(x.j.orders[0].serviceType,'taxi_1_4','small booking response must expose the shared service type');
  const smallId=x.j.orders[0].id;

  x=await json('/api/dispatch/state');
  assert.equal(x.r.status,200,'small dispatch state must remain available');
  assert.ok(Array.isArray(x.j.orders)&&x.j.orders.every(o=>(o.serviceType||'taxi_1_4')==='taxi_1_4'),'small dispatch state stays isolated to Taxi 1-4');
  assert.equal('largeOrders' in x.j,false,'small dispatch state must not expose Large 5-6');

  x=await json('/api/unified/admin/state');
  assert.equal(x.r.status,200,'unified admin state must remain available in auth-disabled staging');
  assert.ok(Array.isArray(x.j.largeOrders),'admin state must expose isolated large shadow orders');
  assert.ok(x.j.largeOrders.some(o=>o.id===largeId),'admin must see the large shadow booking');
  assert.ok(Array.isArray(x.j.unifiedOrders),'admin state must expose a common order contract');
  assert.ok(x.j.unifiedOrders.some(o=>o.id===largeId&&o.serviceType==='large_5_6'),'common contract must include large 5-6');
  assert.ok(x.j.unifiedOrders.some(o=>o.id===smallId&&o.serviceType==='taxi_1_4'),'common contract must include Taxi 1-4');

  x=await json('/api/drivers/drv-001/state');
  assert.equal(x.r.status,200,'small-taxi driver state must remain available');
  assert.ok(!x.j.pool.some(o=>o.id===largeId),'large 5-6 shadow booking must never leak into 1-4 driver pool');

  const smallRoute=await fetch(base+'/unified/?direction=to&city=Rishon&date=2026-10-20&time=11:30&passengers=2');
  assert.equal(smallRoute.status,200,'unified client router remains available');

  console.log('UNIFIED_VANCLICK_HTTP_E2E_OK',JSON.stringify({
    publicUnified:true,
    largeShadowStored:true,
    unifiedOrderContract:true,
    staffVisible:true,
    smallDriverIsolation:true,
    productionUntouched:true
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1000).then(()=>child.kill('SIGKILL'))]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

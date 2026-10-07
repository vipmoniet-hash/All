import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4230;
const dataDir=path.join(root,'data','roles-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{
    ...process.env,
    PORT:String(port),
    TAXI4_DATA_DIR:dataDir,
    DATABASE_URL:'',
    MARKETPLACE_AUTH_REQUIRED:'1',
    UNIFIED_REQUIRE_POSTGRES:'0',
    UNIFIED_REQUIRE_AUTH:'0',
    MARKETPLACE_ADMIN_PIN:'864200',
    MARKETPLACE_DISPATCH_1_4_PIN:'753100',
    MARKETPLACE_DISPATCH_5_6_PIN:'642900',
    MARKETPLACE_DISPATCH_PIN:''
  },
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
  throw new Error('ROLE_SERVER_NOT_READY '+output);
}
async function call(pathname,{method='GET',body,token}={}){
  const headers={};
  if(body)headers['content-type']='application/json';
  if(token)headers.authorization='Bearer '+token;
  const r=await fetch(base+pathname,{method,headers,body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json();}catch{}
  return {r,j};
}
async function login(pin){
  const x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin}});
  assert.equal(x.r.status,200,'staff PIN must log in');
  return x.j;
}

try{
  await waitHealth();

  let x=await call('/api/client/bookings',{method:'POST',body:{
    passengers:2,largeLuggage:1,smallLuggage:0,paymentMethod:'cash',
    customerName:'Role Customer',customerPhone:'0501111111',
    fromArea:'ראשון לציון',toArea:'Ben Gurion Airport',
    tripAt:'2026-10-22T11:00',exactPickup:'Small pickup',exactDropoff:'Ben Gurion Airport'
  }});
  assert.equal(x.r.status,201,'small fixture must be created');

  x=await call('/api/unified/large/bookings',{method:'POST',body:{
    direction:'to',city:'ראשון לציון',tripAt:'2026-10-22T12:00',
    passengers:6,largeLuggage:4,smallLuggage:2,
    customerName:'Role Customer',customerPhone:'0501111111',
    exactPickup:'Large pickup',exactDropoff:'Ben Gurion Airport',notes:'role test'
  }});
  assert.equal(x.r.status,201,'large fixture must be created');

  const admin=await login('864200');
  assert.equal(admin.role,'admin','admin PIN must receive admin role');

  const small=await login('753100');
  assert.equal(small.role,'dispatcher','existing 1-4 dispatcher PIN must resolve to unified dispatcher');

  const large=await login('642900');
  assert.equal(large.role,'dispatcher','existing 5-6 dispatcher PIN must resolve to unified dispatcher');

  x=await call('/api/dispatch/state',{token:small.token});
  assert.equal(x.r.status,200,'dispatcher_1_4 can access 1-4 dispatch state');
  assert.ok(Array.isArray(x.j.orders)&&x.j.orders.every(o=>(o.serviceType||'taxi_1_4')==='taxi_1_4'),'small state contains only 1-4');
  assert.equal(x.r.status,200,'unified dispatcher can access 1-4 dispatch state');

  x=await call('/api/unified/large/state',{token:small.token});
  assert.equal(x.r.status,200,'unified dispatcher can access 5-6 state');

  x=await call('/api/unified/large/state',{token:large.token});
  assert.equal(x.r.status,200,'unified dispatcher can access 5-6 state');
  assert.ok(Array.isArray(x.j.orders)&&x.j.orders.length===1,'large dispatcher receives large queue');
  assert.ok(x.j.orders.every(o=>o.serviceType==='large_5_6'),'large state contains only 5-6');

  x=await call('/api/dispatch/state',{token:large.token});
  assert.equal(x.r.status,200,'unified dispatcher can access 1-4 state');

  x=await call('/api/unified/admin/state',{token:admin.token});
  assert.equal(x.r.status,200,'admin can access unified state');
  assert.ok(x.j.unifiedOrders.some(o=>o.serviceType==='taxi_1_4'),'admin sees 1-4');
  assert.ok(x.j.unifiedOrders.some(o=>o.serviceType==='large_5_6'),'admin sees 5-6');
  assert.ok(Array.isArray(x.j.customerProfiles),'admin unified state exposes shared customer profiles');
  const profile=x.j.customerProfiles.find(p=>p.customerPhone==='0501111111');
  assert.ok(profile,'same customer across both lines must resolve to one profile');
  assert.equal(profile.totalTrips,2,'shared customer profile must count both 1-4 and 5-6 trips');
  assert.deepEqual(new Set(profile.serviceTypes),new Set(['taxi_1_4','large_5_6']),'shared customer profile must identify both service lines');
  assert.ok(Array.isArray(x.j.unifiedJournal),'admin unified state exposes one cross-line journal');
  assert.ok(x.j.unifiedJournal.some(e=>e.serviceType==='taxi_1_4'),'unified journal contains 1-4 events');
  assert.ok(x.j.unifiedJournal.some(e=>e.serviceType==='large_5_6'),'unified journal contains 5-6 events');

  x=await call('/api/unified/admin/state',{token:small.token});
  assert.equal(x.r.status,200,'owner-appointed dispatcher can access the full unified operational state');
  assert.ok(x.j.unifiedOrders.some(o=>o.serviceType==='taxi_1_4'),'dispatcher sees 1-4 in unified state');
  assert.ok(x.j.unifiedOrders.some(o=>o.serviceType==='large_5_6'),'dispatcher sees 5-6 in unified state');
  x=await call('/api/unified/admin/state',{token:large.token});
  assert.equal(x.r.status,200,'all existing dispatcher credentials open the same unified operational state');

  console.log('UNIFIED_ROLE_MODEL_OK',JSON.stringify({
    admin:'owner_all',
    dispatcher:'both_lines_operational',
    ownerOnlyAdminControls:true,
    serverEnforced:true
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1000).then(()=>child.kill('SIGKILL'))]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

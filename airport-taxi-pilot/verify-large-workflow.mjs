import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4240;
const dataDir=path.join(root,'data','large-flow-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{
    ...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir,DATABASE_URL:'',MARKETPLACE_AUTH_REQUIRED:'1',UNIFIED_REQUIRE_POSTGRES:'0',UNIFIED_REQUIRE_AUTH:'0',
    MARKETPLACE_ADMIN_PIN:'864200',MARKETPLACE_DISPATCH_1_4_PIN:'753100',MARKETPLACE_DISPATCH_5_6_PIN:'642900'
  },
  stdio:['ignore','pipe','pipe']
});
let output='';child.stdout.on('data',d=>output+=String(d));child.stderr.on('data',d=>output+=String(d));
const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHealth(){for(let i=0;i<60;i++){try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}await sleep(100)}throw new Error('LARGE_FLOW_SERVER_NOT_READY '+output)}
async function call(pathname,{method='GET',body,token}={}){
  const headers={};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization='Bearer '+token;
  const r=await fetch(base+pathname,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch{}return{r,j};
}
async function login(pin){const x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin}});assert.equal(x.r.status,200);return x.j}

try{
  await waitHealth();
  let x=await call('/api/unified/large/bookings',{method:'POST',body:{
    direction:'to',city:'ראשון לציון',tripAt:'2026-10-23T09:00',
    passengers:6,largeLuggage:4,smallLuggage:2,customerName:'Large Flow',
    customerPhone:'0503333333',exactPickup:'Large flow pickup',exactDropoff:'Ben Gurion Airport'
  }});
  assert.equal(x.r.status,201,'large order fixture created');
  const id=x.j.id;

  const large=await login('642900');
  const small=await login('753100');
  const admin=await login('864200');

  x=await call('/api/unified/large/orders/'+id+'/approve',{method:'POST',token:small.token,body:{fare:420}});
  assert.equal(x.r.status,200,'unified dispatcher can manage 5-6 order');

  x=await call('/api/unified/large/orders/'+id+'/approve',{method:'POST',token:large.token,body:{fare:420}});
  assert.equal(x.r.status,200,'any owner-appointed unified dispatcher can approve fare');
  assert.equal(x.j.status,'confirmed');
  assert.equal(x.j.fare,420);
  assert.equal(x.j.commission,0,'large staff approval does not create driver commission');

  x=await call('/api/unified/large/orders/'+id+'/assign',{method:'POST',token:large.token,body:{driverName:'Large Driver',driverPhone:'0504444444',vehiclePlate:'12-345-67'}});
  assert.equal(x.r.status,200,'unified dispatcher can assign a large driver');
  assert.equal(x.j.status,'assigned');
  assert.equal(x.j.assignedDriverName,'Large Driver');

  x=await call('/api/unified/large/orders/'+id+'/enroute',{method:'POST',token:large.token});
  assert.equal(x.r.status,200);
  assert.equal(x.j.status,'driver_enroute');

  x=await call('/api/unified/large/orders/'+id+'/complete',{method:'POST',token:large.token});
  assert.equal(x.r.status,200);
  assert.equal(x.j.status,'completed');

  x=await call('/api/unified/admin/state',{token:admin.token});
  assert.equal(x.r.status,200);
  const done=x.j.unifiedOrders.find(o=>o.id===id);
  assert.equal(done.status,'completed','admin unified state sees completed large order');

  x=await call('/api/unified/large/state',{token:large.token});
  assert.ok(x.j.events.some(e=>e.orderId===id&&e.actor==='dispatcher'),'large audit records unified dispatcher role');

  console.log('LARGE_5_6_WORKFLOW_OK',JSON.stringify({
    approved:true,assigned:true,enroute:true,completed:true,commission:0,audited:true
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1000).then(()=>child.kill('SIGKILL'))]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

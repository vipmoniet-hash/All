import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4210;
const dataDir=path.join(root,'data','load-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir,DATABASE_URL:'',MARKETPLACE_AUTH_REQUIRED:'0',UNIFIED_REQUIRE_AUTH:'0',UNIFIED_REQUIRE_POSTGRES:'0'},
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
  throw new Error('LOAD_SERVER_NOT_READY '+output);
}
async function post(pathname,body){
  const r=await fetch(base+pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let j={};try{j=await r.json();}catch{}
  return {status:r.status,j};
}
try{
  await waitHealth();

  const quoteJobs=Array.from({length:240},()=>post('/api/pricing/quote',{fromArea:'ראשון לציון',toArea:'נתב״ג'}));
  const quoteResults=await Promise.all(quoteJobs);
  assert.equal(quoteResults.filter(x=>x.status===200).length,240,'all 240 concurrent quote requests must succeed');

  const bookings=Array.from({length:120},(_,i)=>post('/api/client/bookings',{
    passengers:2,largeLuggage:0,smallLuggage:0,paymentMethod:'bit',
    customerName:'Load '+i,customerPhone:'0507'+String(i).padStart(6,'0'),
    fromArea:'ראשון לציון',toArea:'נתב״ג',
    tripAt:'2026-10-15T11:00',
    exactPickup:'Load '+i,exactDropoff:'TLV T3'
  }));
  const results=await Promise.all(bookings);
  const created=results.filter(x=>x.status===201);
  assert.equal(created.length,120,'all 120 concurrent booking requests must be accepted');

  const overflow=await Promise.all(Array.from({length:20},(_,i)=>post('/api/client/bookings',{
    passengers:2,largeLuggage:0,smallLuggage:0,paymentMethod:'bit',
    customerName:'Overflow '+i,customerPhone:'0599'+String(i).padStart(6,'0'),
    fromArea:'ראשון לציון',toArea:'נתב״ג',
    tripAt:'2026-10-15T12:00',
    exactPickup:'Overflow '+i,exactDropoff:'TLV T3'
  })));
  assert.equal(overflow.filter(x=>x.status===429).length,20,'excess single-IP booking burst must be rate-limited instead of crashing server');

  const health=await fetch(base+'/health');
  assert.equal(health.status,200,'server remains healthy after concurrent spike and rate-limit overflow');

  const state=await fetch(base+'/api/dispatch/state').then(r=>r.json());
  assert.equal(state.counts.awaiting_dispatch,120,'all spike bookings are persisted in staff-only intake');

  console.log('MARKETPLACE_V1_LOAD_OK',JSON.stringify({
    concurrentQuotes:240,
    concurrentBookings:120,
    created:created.length,
    awaitingDispatch:state.counts.awaiting_dispatch,
    overflowRateLimited:overflow.filter(x=>x.status===429).length,
    health:health.status
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1000).then(()=>child.kill('SIGKILL'))]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

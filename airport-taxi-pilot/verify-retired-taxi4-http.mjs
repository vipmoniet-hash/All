import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root=path.resolve(process.argv[2]||'app');
const port=4209;
const dataDir=path.join(root,'data','retired-taxi4-check');
await fs.rm(dataDir,{recursive:true,force:true});
const child=spawn(process.execPath,['server.js'],{
 cwd:root,env:{...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir,DATABASE_URL:'',MARKETPLACE_AUTH_REQUIRED:'0',UNIFIED_REQUIRE_AUTH:'0',UNIFIED_REQUIRE_POSTGRES:'0'},stdio:['ignore','pipe','pipe']
});
let log='';child.stdout.on('data',x=>log+=String(x));child.stderr.on('data',x=>log+=String(x));
const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await sleep(100);}throw Error('RETIREMENT_E2E_SERVER_NOT_READY '+log);}
async function post(url){const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({passengers:2,customerName:'Retirement Guard Test',customerPhone:'0501112233',tripAt:'2026-10-18T12:00',fromArea:'ראשון לציון',toArea:'נתב״ג'})});let body=await r.json();assert.equal(r.status,410,url+' must reject NEW small orders');assert.equal(body.error,'SERVICE_RETIRED');return body}
try{
 await ready();
 const direct=await fetch(base+'/client/',{redirect:'manual'});
 assert.equal(direct.status,302,'old direct marketplace client entry must redirect to large VanClick booking');
 assert.equal(direct.headers.get('location'),'https://vanclick.co.il/app/');
 const statusPage=await fetch(base+'/client/existing-order-test',{redirect:'manual'});
 assert.notEqual(statusPage.status,302,'historical deep links must not be redirected by root-only retirement');
 await post('/api/client/bookings');
 await post('/api/client/bookings/');
 await post('/api/unified/small/bookings');
 const history=await fetch(base+'/api/client/bookings/legacy?phone=0501112233');
 assert.notEqual(history.status,410,'historical booking lookup must remain accessible');
 const state=await fetch(base+'/api/dispatch/state');
 assert.ok(state.status!==410,'staff historical operations must not be blocked');
 console.log('TAXI4_RETIRED_HTTP_OK: new bookings rejected, old read endpoints preserved');
}finally{child.kill('SIGTERM');await fs.rm(dataDir,{recursive:true,force:true});}

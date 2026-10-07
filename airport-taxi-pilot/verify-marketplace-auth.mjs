import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=path.resolve(process.argv[2]||'app');
const port=4201;
const dataDir=path.join(root,'data','auth-e2e');
await fs.rm(dataDir,{recursive:true,force:true});

const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),TAXI4_DATA_DIR:dataDir,MARKETPLACE_AUTH_REQUIRED:'1',MARKETPLACE_ADMIN_PIN:'864200',MARKETPLACE_DISPATCH_1_4_PIN:'753100',MARKETPLACE_DISPATCH_5_6_PIN:'642900',MARKETPLACE_DISPATCH_PIN:''},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',d=>output+=String(d));child.stderr.on('data',d=>output+=String(d));
const base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHealth(){
  for(let i=0;i<40;i++){
    try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}
    await sleep(100);
  }
  throw new Error('AUTH_E2E_SERVER_NOT_READY '+output);
}
async function call(pathname,{method='GET',body,token,ip}={}){
  const headers={};
  if(ip)headers['x-forwarded-for']=ip;
  if(body!==undefined)headers['content-type']='application/json';
  if(token)headers.authorization='Bearer '+token;
  const r=await fetch(base+pathname,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const j=await r.json();
  return {r,j};
}
try{
  await waitHealth();

  let x=await call('/api/dispatch/state');
  assert.equal(x.r.status,401,'dispatch API is protected when auth is required');

  x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin:'000000'},ip:'198.51.100.10'});
  assert.equal(x.r.status,401,'wrong dispatcher PIN is rejected');
  for(let i=0;i<7;i++)await call('/api/auth/dispatch/login',{method:'POST',body:{pin:'000000'},ip:'198.51.100.10'});
  x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin:'000000'},ip:'198.51.100.10'});
  assert.equal(x.r.status,429,'repeated wrong staff PIN attempts are rate limited');

  x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin:'864200'},ip:'198.51.100.20'});
  assert.equal(x.r.status,200,'administrator can log in');
  assert.equal(x.j.role,'admin','admin PIN receives admin role');
  const adminToken=x.j.token;
  assert.ok(adminToken,'administrator login returns a token');

  x=await call('/api/auth/dispatch/login',{method:'POST',body:{pin:'753100'},ip:'198.51.100.21'});
  assert.equal(x.r.status,200,'dispatcher can log in');
  assert.equal(x.j.role,'dispatcher_1_4','dispatcher PIN receives dispatcher_1_4 role');
  const dispatchToken=x.j.token;
  x=await call('/api/dispatch/reset-demo',{method:'POST',token:dispatchToken});
  assert.equal(x.r.status,403,'dispatcher cannot reset persistent business state');
  x=await call('/api/dispatch/reset-demo',{method:'POST',token:adminToken});
  assert.equal(x.r.status,403,'demo reset is disabled unless an explicit environment flag enables it');
  x=await call('/api/dispatch/state',{token:dispatchToken});
  assert.equal(x.r.status,200,'dispatcher_1_4 role can manage small dispatch state');

  x=await call('/api/dispatch/drivers/drv-001/pin',{method:'POST',token:adminToken,body:{pin:'4321'}});
  assert.equal(x.r.status,200,'dispatcher can configure driver PIN');

  x=await call('/api/drivers/drv-001/state');
  assert.equal(x.r.status,401,'driver API is protected when auth is required');

  x=await call('/api/auth/driver/login',{method:'POST',body:{driverId:'drv-001',pin:'1111'}});
  assert.equal(x.r.status,401,'wrong driver PIN is rejected');

  x=await call('/api/auth/driver/login',{method:'POST',body:{driverId:'drv-001',pin:'4321'}});
  assert.equal(x.r.status,200,'driver can log in');
  const driverToken=x.j.token;
  assert.ok(driverToken,'driver login returns a token');

  x=await call('/api/drivers/drv-001/state',{token:driverToken});
  assert.equal(x.r.status,200,'driver token opens its own state');

  x=await call('/api/dispatch/state',{token:driverToken});
  assert.equal(x.r.status,403,'authenticated driver is forbidden from dispatcher state');

  x=await call('/api/drivers/drv-002/state',{token:driverToken});
  assert.equal(x.r.status,403,'authenticated driver is forbidden from impersonating another driver');

  x=await call('/api/auth/logout',{method:'POST',token:driverToken});
  assert.equal(x.r.status,200,'driver can log out');

  x=await call('/api/drivers/drv-001/state',{token:driverToken});
  assert.equal(x.r.status,401,'logged-out token is invalidated');

  console.log('MARKETPLACE_V1_AUTH_E2E_OK',JSON.stringify({
    dispatchProtected:true,
    adminAndDispatcherRoles:true,
    driverProtected:true,
    roleIsolation:true,
    logout:true,
    authRateLimit:true,
    destructiveResetGuard:true
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1000).then(()=>child.kill('SIGKILL'))]);
  await fs.rm(dataDir,{recursive:true,force:true});
}

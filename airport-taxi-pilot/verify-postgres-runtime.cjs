const fs=require('fs');
const path=require('path');
const os=require('os');
const {pathToFileURL}=require('url');
const {spawnSync}=require('child_process');
const assert=require('assert/strict');

const root=path.resolve(process.argv[2]||'app');
const serverSource=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.match(serverSource,/PERSISTENCE_BACKEND/,'runtime server must emit persistence backend telemetry without exposing credentials');
assert.match(serverSource,/UNIFIED_REQUIRE_POSTGRES/,'runtime must support a fail-closed Postgres requirement for future unified cutover');
{
  const guardEnv={...process.env,UNIFIED_REQUIRE_POSTGRES:'1'};
  delete guardEnv.DATABASE_URL;
  const guard=spawnSync(process.execPath,['server.js'],{cwd:root,encoding:'utf8',timeout:1500,env:guardEnv});
  assert.equal(guard.status,1,'UNIFIED_REQUIRE_POSTGRES=1 must refuse startup without DATABASE_URL');
  assert.match(String(guard.stdout||'')+String(guard.stderr||''),/PERSISTENCE_REQUIRED_POSTGRES_MISSING/,'fail-closed startup must explain missing Postgres binding without leaking secrets');
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vc-pg-runtime-'));
const nodeModules=path.join(root,'node_modules','pg');
const realPgBackup=path.join(root,'node_modules','.pg-real-backup');
const hadRealPg=fs.existsSync(nodeModules);
if(hadRealPg){
  fs.rmSync(realPgBackup,{recursive:true,force:true});
  fs.renameSync(nodeModules,realPgBackup);
}
fs.mkdirSync(nodeModules,{recursive:true});
fs.writeFileSync(path.join(nodeModules,'package.json'),JSON.stringify({name:'pg',version:'0.0.0-test',type:'module',exports:'./index.js'}));

const fakePg=[
  "import fs from 'node:fs';",
  "let payload=null;",
  "function log(q){if(process.env.PG_FAKE_LOG)fs.appendFileSync(process.env.PG_FAKE_LOG,String(q).replace(/\\s+/g,' ').trim()+'\\n');}",
  "export class Pool{",
  "  constructor(){}",
  "  async connect(){",
  "    let tx=null,inTx=false;",
  "    return {",
  "      async query(sql,params=[]){",
  "        const q=String(sql);log(q);",
  "        if(/^BEGIN/i.test(q.trim())){inTx=true;tx=payload==null?null:structuredClone(payload);return{rows:[]};}",
  "        if(/^COMMIT/i.test(q.trim())){payload=structuredClone(tx);inTx=false;return{rows:[]};}",
  "        if(/^ROLLBACK/i.test(q.trim())){tx=payload==null?null:structuredClone(payload);inTx=false;return{rows:[]};}",
  "        if(/CREATE TABLE IF NOT EXISTS vanclick_state/i.test(q))return{rows:[]};",
  "        if(/INSERT INTO vanclick_state/i.test(q)&&/DO NOTHING/i.test(q)){if((inTx?tx:payload)==null){const v=JSON.parse(params[1]);if(inTx)tx=v;else payload=v;}return{rows:[]};}",
  "        if(/SELECT payload FROM vanclick_state/i.test(q)){const v=inTx?tx:payload;return{rows:v==null?[]:[{payload:structuredClone(v)}]};}",
  "        if(/UPDATE vanclick_state SET payload/i.test(q)){tx=JSON.parse(params[0]);if(!inTx)payload=structuredClone(tx);return{rows:[],rowCount:1};}",
  "        if(/INSERT INTO vanclick_state/i.test(q)&&/DO UPDATE/i.test(q)){const v=JSON.parse(params[1]);if(inTx)tx=v;else payload=v;return{rows:[]};}",
  "        throw new Error('UNEXPECTED_SQL '+q);",
  "      },",
  "      release(){}",
  "    };",
  "  }",
  "}"
].join('\n');
fs.writeFileSync(path.join(nodeModules,'index.js'),fakePg);

const logFile=path.join(temp,'pg.log');
const childScript=path.join(temp,'run.mjs');
const persistenceUrl=pathToFileURL(path.join(root,'src','persistence.js')).href;
const childCode=[
  "import {readDb,resetDb,transact} from "+JSON.stringify(persistenceUrl)+";",
  "const base={drivers:[],orders:[{id:'pg-1'}],largeOrders:[],topups:[],ledger:[],events:[],sessions:[]};",
  "await resetDb(base);",
  "await transact(db=>{db.orders.push({id:'pg-2'});return true});",
  "const db=await readDb();",
  "console.log(JSON.stringify({orders:db.orders.map(x=>x.id),largeOrders:db.largeOrders.length}));"
].join('\n');
fs.writeFileSync(childScript,childCode);

const dataDir=path.join(temp,'json-data');
const run=spawnSync(process.execPath,[childScript],{
  encoding:'utf8',
  env:{...process.env,DATABASE_URL:'postgres://fake/vanclick',TAXI4_DATA_DIR:dataDir,PG_FAKE_LOG:logFile}
});
if(run.status!==0)throw new Error(run.stderr||run.stdout||'postgres runtime child failed');

const line=run.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
const out=JSON.parse(line);
assert.deepEqual(out.orders,['pg-1','pg-2'],'DATABASE_URL path must preserve persistence API over Postgres');
assert.equal(fs.existsSync(path.join(dataDir,'db.json')),false,'Postgres backend must not write JSON db file');
const sql=fs.readFileSync(logFile,'utf8');
assert.match(sql,/FOR UPDATE/i,'runtime Postgres path must use row locking');
assert.match(sql,/COMMIT/i,'runtime Postgres path must commit transaction');

fs.rmSync(nodeModules,{recursive:true,force:true});
if(hadRealPg)fs.renameSync(realPgBackup,nodeModules);
else fs.rmSync(realPgBackup,{recursive:true,force:true});
fs.rmSync(temp,{recursive:true,force:true});
console.log('POSTGRES_RUNTIME_SWITCH_OK',JSON.stringify({databaseUrlSwitch:true,jsonBypassed:true,rowLock:true,realPgPreserved:hadRealPg}));

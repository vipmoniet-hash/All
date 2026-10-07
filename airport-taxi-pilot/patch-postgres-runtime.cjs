const fs=require('fs');
const path=require('path');
const cp=require('child_process');

const root=process.argv[2]||'app';
fs.copyFileSync(path.join(__dirname,'postgres-state-store.js'),path.join(root,'src','postgres-state-store.js'));

function patchFile(rel,fn){
  const file=path.join(root,rel);
  let src=fs.readFileSync(file,'utf8');
  const api={
    replaceOnce(search,replacement,label){
      const before=src;
      src=src.replace(search,replacement);
      if(src===before)throw new Error('POSTGRES_RUNTIME_PATCH_MISS: '+rel+' :: '+label);
    },
    get(){return src;}
  };
  fn(api);
  fs.writeFileSync(file,api.get());
}

patchFile('src/persistence.js',({replaceOnce})=>{
  replaceOnce(
    "import crypto from 'node:crypto';",
    "import crypto from 'node:crypto';\nimport { createPostgresStateStore } from './postgres-state-store.js';",
    'postgres state-store import'
  );

  replaceOnce(
    "export function id(prefix) { return \`\${prefix}_\${crypto.randomBytes(6).toString('hex')}\`; }",
    `const USE_POSTGRES=Boolean(process.env.DATABASE_URL);
let postgresStorePromise=null;

async function postgresStore(){
  if(!USE_POSTGRES)return null;
  if(!postgresStorePromise){
    postgresStorePromise=(async()=>{
      const {Pool}=await import('pg');
      const config={
        connectionString:process.env.DATABASE_URL,
        max:Math.max(2,Number(process.env.TAXI4_DB_POOL_MAX||20)),
        idleTimeoutMillis:30000,
        connectionTimeoutMillis:5000,
        application_name:'vanclick-unified-staging'
      };
      if(String(process.env.TAXI4_DB_SSL||'')==='1')config.ssl={rejectUnauthorized:false};
      const pool=new Pool(config);
      return createPostgresStateStore({pool,seed,shape});
    })();
  }
  return postgresStorePromise;
}

export function id(prefix) { return \`\${prefix}_\${crypto.randomBytes(6).toString('hex')}\`; }`,
    'postgres backend router'
  );

  replaceOnce(
    "export async function ensureDb() {\n  await fs.mkdir(DATA_DIR, { recursive: true });",
    "export async function ensureDb() {\n  const pg=await postgresStore(); if(pg)return pg.ensureDb();\n  await fs.mkdir(DATA_DIR, { recursive: true });",
    'ensureDb backend switch'
  );

  replaceOnce(
    "export async function readDb() {\n  await ensureDb();",
    "export async function readDb() {\n  const pg=await postgresStore(); if(pg)return pg.readDb();\n  await ensureDb();",
    'readDb backend switch'
  );

  replaceOnce(
    "export async function transact(mutator) {\n  if(pendingWrites>=MAX_PENDING_WRITES)throw new Error('SERVER_BUSY');",
    "export async function transact(mutator) {\n  const pg=await postgresStore(); if(pg)return pg.transact(mutator);\n  if(pendingWrites>=MAX_PENDING_WRITES)throw new Error('SERVER_BUSY');",
    'transact backend switch'
  );

  replaceOnce(
    "export async function resetDb(custom = seed) {\n  await fs.mkdir(DATA_DIR, { recursive: true });",
    "export async function resetDb(custom = seed) {\n  const pg=await postgresStore(); if(pg)return pg.resetDb(custom);\n  await fs.mkdir(DATA_DIR, { recursive: true });",
    'reset backend switch'
  );

  replaceOnce(
    "export function persistenceStats(){return {pendingWrites,maxPendingWrites:MAX_PENDING_WRITES};}",
    "export function persistenceStats(){return USE_POSTGRES?{backend:'postgres',pendingWrites:0,maxPendingWrites:null}:{backend:'json',pendingWrites,maxPendingWrites:MAX_PENDING_WRITES};}",
    'backend health telemetry'
  );
});

patchFile('server.js',({replaceOnce})=>{
  replaceOnce(
    "await ensureDb();",
    "await ensureDb();\\nconsole.log('PERSISTENCE_BACKEND',JSON.stringify(persistenceStats()));",
    'startup persistence backend telemetry'
  );
});

if(process.env.DATABASE_URL){
  try{require.resolve('pg',{paths:[root]});}
  catch{
    cp.execFileSync('npm',['install','pg@8','--prefix',root,'--no-save','--omit=dev'],{stdio:'inherit'});
  }
}

console.log('POSTGRES_RUNTIME_PATCH_APPLIED',JSON.stringify({
  databaseUrlSwitch:true,
  jsonFallback:true,
  conditionalPgInstall:true
}));

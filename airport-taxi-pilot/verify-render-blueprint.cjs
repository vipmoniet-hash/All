const fs=require('fs');
const path=require('path');
const file=path.resolve(process.argv[2]||path.join(__dirname,'..','render.yaml'));
const src=fs.readFileSync(file,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error('RENDER_BLUEPRINT_CONTRACT: '+msg);};

assert(/name:\s*vanclick-taxi4-marketplace-scale/.test(src),'web service name');
assert(/healthCheckPath:\s*\/health/.test(src),'health check must be /health');
assert(/key:\s*DATABASE_URL[\s\S]*?fromDatabase:[\s\S]*?name:\s*vanclick-unified-staging-db[\s\S]*?property:\s*connectionString/.test(src),'DATABASE_URL must come from private Render Postgres');
assert(/name:\s*vanclick-unified-staging-db/.test(src),'database resource name');
assert(/name:\s*vanclick-unified-staging-db[\s\S]*?plan:\s*basic-256mb/.test(src),'database must use persistent basic-256mb plan');
assert(/postgresMajorVersion:\s*["']18["']/.test(src),'Postgres 18');
assert(/databaseName:\s*vanclick_unified_staging_db/.test(src),'database name');
assert(/ipAllowList:\s*\[\]/.test(src),'database must reject public inbound connections');
for(const key of ['MARKETPLACE_AUTH_REQUIRED','UNIFIED_REQUIRE_AUTH','UNIFIED_REQUIRE_POSTGRES']){
  const re=new RegExp('key:\\s*'+key+'[\\s\\S]*?value:\\s*["\\\']1["\\\']');
  assert(re.test(src),key+' must fail closed');
}
assert(!/postgres(?:ql)?:\/\//i.test(src),'connection string must never be committed');
function envBlock(key){
  const lines=src.split(/\r?\n/);
  const start=lines.findIndex(line=>line.includes('- key: '+key));
  assert(start>=0,key+' must be declared');
  const indent=(lines[start].match(/^\s*/)||[''])[0].length;
  const block=[lines[start]];
  for(let i=start+1;i<lines.length;i++){
    const line=lines[i];
    const trimmed=line.trim();
    const lineIndent=(line.match(/^\s*/)||[''])[0].length;
    if(trimmed.startsWith('- key:')&&lineIndent===indent)break;
    if(trimmed&&lineIndent<indent)break;
    block.push(line);
  }
  return block.join('\n');
}
for(const key of ['MARKETPLACE_ADMIN_PIN_HASH','MARKETPLACE_DISPATCH_1_4_PIN_HASH','MARKETPLACE_DISPATCH_5_6_PIN_HASH']){
  const block=envBlock(key);
  assert(/sync:\s*false/.test(block),key+' must be declared dashboard-only with sync:false');
  assert(!/\bvalue\s*:/.test(block),key+' must not contain a committed value');
}
for(const key of ['MARKETPLACE_ADMIN_PIN','MARKETPLACE_DISPATCH_1_4_PIN','MARKETPLACE_DISPATCH_5_6_PIN']){
  assert(!new RegExp('^- key:\\s*'+key+'\\s*
console.log('RENDER_BLUEPRINT_CONTRACT_OK',JSON.stringify({
  privatePostgres:true,
  databaseUrlReference:true,
  healthCheck:true,
  authFailClosed:true,
  postgresFailClosed:true,
  noCommittedSecrets:true,
  persistentPostgres:true,
  hashedStaffSecrets:true
}));
,'m').test(src),key+' plaintext slot must not exist in Blueprint');
}
console.log('RENDER_BLUEPRINT_CONTRACT_OK',JSON.stringify({
  privatePostgres:true,
  databaseUrlReference:true,
  healthCheck:true,
  authFailClosed:true,
  postgresFailClosed:true,
  noCommittedSecrets:true
}));

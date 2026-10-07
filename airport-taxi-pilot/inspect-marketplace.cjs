const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const targets=[
  'server.js',
  'src/domain.js',
  'src/service.js',
  'src/store.js',
  'src/pricing.js',
  'apps/client/public/app.js',
  'apps/driver/public/app.js',
  'apps/admin/public/app.js'
];

console.log('MARKETPLACE_INSPECT_BEGIN');
function walk(dir,out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p,out);
    else out.push(path.relative(root,p));
  }
  return out;
}
console.log('FILES',JSON.stringify(walk(root).filter(x=>/^(src|apps|server|test|tests)/.test(x)).slice(0,500)));
for(const rel of targets){
  const p=path.join(root,rel);
  if(!fs.existsSync(p)){ console.log('MISSING',rel); continue; }
  const text=fs.readFileSync(p,'utf8');
  console.log('\n===== '+rel+' =====\n'+text.slice(0,30000));
}
console.log('MARKETPLACE_INSPECT_END');
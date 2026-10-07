const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const targets={
  server:'server.js',
  domain:'src/domain.js',
  service:'src/service.js',
  persistence:'src/persistence.js',
  pricing:'src/pricing.js',
  driver:'apps/driver/public/app.js',
  dispatch:'apps/dispatch/public/app.js',
  client:'apps/client/public/app.js',
  driver_html:'apps/driver/public/index.html',
  dispatch_html:'apps/dispatch/public/index.html'
};

console.log('MARKETPLACE_INSPECT_V2_BEGIN');
for(const [name,rel] of Object.entries(targets)){
  const p=path.join(root,rel);
  if(!fs.existsSync(p)){ console.log('DUMP_MISSING|'+name+'|'+rel); continue; }
  const text=fs.readFileSync(p,'utf8');
  const b64=Buffer.from(text,'utf8').toString('base64');
  const chunk=7000;
  const total=Math.ceil(b64.length/chunk);
  console.log('DUMP_META|'+name+'|'+rel+'|chars='+text.length+'|chunks='+total);
  for(let i=0;i<total;i++){
    console.log('DUMP|'+name+'|'+String(i+1).padStart(3,'0')+'|'+total+'|'+b64.slice(i*chunk,(i+1)*chunk));
  }
}
console.log('MARKETPLACE_INSPECT_V2_END');
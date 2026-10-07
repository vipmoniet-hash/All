const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const css=fs.readFileSync('vanclick-bridge.css','utf8');
const js=fs.readFileSync('vanclick-bridge.js','utf8');
const marker='data-vanclick-cro="20261007-v2"';

function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p,out);
    else if(ent.isFile() && /\.html?$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const htmls=walk(root);
let changed=[];
for(const file of htmls){
  let html=fs.readFileSync(file,'utf8');
  const lower=file.toLowerCase();
  const looksClient=lower.includes('client') || /AIRPORT TAXI|סוגרים מחיר מראש|בדיקת מחיר|עד 4 נוסעים/.test(html);
  if(!looksClient) continue;
  html=html.replace(/<link[^>]+vanclick-bridge\.css[^>]*>/gi,'');
  html=html.replace(/<script[^>]+vanclick-bridge\.js[^>]*><\/script>/gi,'');
  html=html.replace(/<style[^>]+data-vanclick-cro[^>]*>[\s\S]*?<\/style>/gi,'');
  html=html.replace(/<script[^>]+data-vanclick-cro[^>]*>[\s\S]*?<\/script>/gi,'');
  const style='<style '+marker+'>'+css+'</style>';
  const code='<script '+marker+'>'+js+'<\/script>';
  if(/<\/head>/i.test(html)) html=html.replace(/<\/head>/i,style+'</head>');
  else html=style+html;
  if(/<\/body>/i.test(html)) html=html.replace(/<\/body>/i,code+'</body>');
  else html+=code;
  fs.writeFileSync(file,html);
  changed.push(file);
}
console.log('VanClick CRO injected into',changed.length,'client HTML files');
for(const f of changed) console.log('INJECTED',f);
if(!changed.length) throw new Error('No client HTML file found for VanClick CRO injection');

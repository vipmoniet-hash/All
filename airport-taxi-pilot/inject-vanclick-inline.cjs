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

const htmls=walk(root).filter(file=>/apps[\\/]client[\\/]public[\\/]/i.test(file));
let changed=[];
for(const file of htmls){
  let html=fs.readFileSync(file,'utf8');

  // Taxi 1–4: standard small-taxi drivers do not carry child seats/boosters.
  // Remove the option from the customer form entirely.
  html=html.replace(/<label[^>]*class=["'][^"']*field[^"']*compact[^"']*["'][^>]*>\s*<span>כיסאות\s*\/\s*בוסטר לילדים<\/span>\s*<select[^>]*name=["']childSeats["'][\s\S]*?<\/select>\s*<\/label>/gi,'');
  html=html.replace(/<label[^>]*>[\s\S]*?<select[^>]*name=["']childSeats["'][\s\S]*?<\/select>[\s\S]*?<\/label>/gi,(m)=>/כיסאות|בוסטר/.test(m)?'':m);
  html=html.replace(/<link[^>]+vanclick-bridge\.css[^>]*>/gi,'');
  html=html.replace(/<script[^>]+vanclick-bridge\.js[^>]*><\/script>/gi,'');
  html=html.replace(/<style[^>]+data-vanclick-cro[^>]*>[\s\S]*?<\/style>/gi,'');
  html=html.replace(/<script[^>]+data-vanclick-cro[^>]*>[\s\S]*?<\/script>/gi,'');
  const style='<style '+marker+'>'+css+'</style>';
  const code='<script '+marker+'>'+js+'<\/script>';
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,style+'</head>'):style+html;
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,code+'</body>'):html+code;
  fs.writeFileSync(file,html);
  changed.push(file);
}
console.log('VanClick CRO injected into',changed.length,'client HTML files');
for(const f of changed) console.log('INJECTED',f);
if(!changed.length) throw new Error('No apps/client/public HTML file found for VanClick CRO injection');


// Ensure the client never sends child-seat/booster data for Taxi 1–4.
const clientJs=path.join(root,'apps','client','public','app.js');
if(fs.existsSync(clientJs)){
  let js=fs.readFileSync(clientJs,'utf8');
  js=js.replace(/b\.childSeats=Number\(b\.childSeats\|\|0\);/g,'delete b.childSeats;');
  js=js.replace(/b\.childSeats\s*=\s*Number\([^;]+\);/g,'delete b.childSeats;');
  fs.writeFileSync(clientJs,js);
  console.log('REMOVED childSeats from Taxi 1–4 client payload');
}

// Apply full Taxi 1–4 driver-safe fare audit after unpacking source data.
require('child_process').execFileSync(process.execPath,[path.join(__dirname,'reprice-taxi4.cjs'),root],{stdio:'inherit'});
require('child_process').execFileSync(process.execPath,[path.join(__dirname,'patch-taxi4-policy.cjs'),root],{stdio:'inherit'});

// Policy regression gate: blocks deploys if surcharge or commission behavior regresses.
require('child_process').execFileSync(process.execPath,[path.join(__dirname,'verify-taxi4-policy.mjs'),root],{stdio:'inherit'});
require('child_process').execFileSync(process.execPath,[path.join(__dirname,'audit-taxi4-market.cjs'),root],{stdio:'inherit'});


// Marketplace regression gate.
require('child_process').execFileSync(process.execPath,[path.join(__dirname,'verify-marketplace-v1.mjs'),root],{stdio:'inherit'});

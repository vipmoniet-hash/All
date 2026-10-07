const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const pricingPath=path.join(root,'data','pricing.json');
const overridePath=path.join(__dirname,'taxi4-pricing-overrides.json');

if(!fs.existsSync(pricingPath)) throw new Error('Taxi4 pricing.json not found: '+pricingPath);
if(!fs.existsSync(overridePath)) throw new Error('Taxi4 pricing override file not found');

const pricing=JSON.parse(fs.readFileSync(pricingPath,'utf8'));
const audit=JSON.parse(fs.readFileSync(overridePath,'utf8'));
const overrides=audit.overrides||{};

function commission(fare){
  const n=Number(fare||0);
  if(n<100) return 5;
  return Math.max(10,Math.floor(n/100)*10);
}

let seen=0, changed=0, missing=[], safetyErrors=[];
function walk(v){
  if(Array.isArray(v)){for(const x of v) walk(x);return;}
  if(!v||typeof v!=='object') return;
  if(typeof v.nameHe==='string' && typeof v.fare==='number'){
    seen++;
    const o=overrides[v.nameHe];
    if(!o){missing.push(v.nameHe);}
    else{
      const old=v.fare;
      let next=Number(o.fare);
      if(!Number.isFinite(next)||next<old) throw new Error('Invalid fare override for '+v.nameHe);

      // Commission-aware market floor:
      // keep raising in 10₪ steps until driver economic net is at least
      // the public daytime benchmark used by the audit.
      if(o.benchmark!=null && o.reason!=='owner_anchor'){
        const benchmark=Number(o.benchmark);
        while(next-commission(next)<benchmark) next+=10;
      }

      v.fare=next;
      if(old!==next) changed++;
      if(o.benchmark!=null && o.reason!=='owner_anchor'){
        const driverNet=next-commission(next);
        if(driverNet<Number(o.benchmark)){
          safetyErrors.push({nameHe:v.nameHe,fare:next,commission:commission(next),driverNet,benchmark:o.benchmark});
        }
      }
    }
  }
  for(const [k,x] of Object.entries(v)){
    if(k==='nameHe'||k==='fare') continue;
    walk(x);
  }
}
walk(pricing);

if(missing.length) throw new Error('Pricing overrides missing '+missing.length+' entries: '+missing.slice(0,20).join(', '));
if(seen!==Object.keys(overrides).length) throw new Error('Pricing coverage mismatch: pricing entries='+seen+' overrides='+Object.keys(overrides).length);
if(safetyErrors.length) throw new Error('Driver-net benchmark failures: '+JSON.stringify(safetyErrors.slice(0,20)));

fs.writeFileSync(pricingPath,JSON.stringify(pricing,null,2)+'\n');
const report={
  version:audit.version,
  appliedAt:new Date().toISOString(),
  locations:seen,
  changed,
  unchanged:seen-changed,
  benchmarkSafetyFailures:0,
  policy:{...audit.policy,commissionAwareGuard:"Raise by 10₪ until fare - platform commission >= matched daytime benchmark"},
  stats:audit.stats
};
fs.writeFileSync(path.join(root,'data','taxi4-pricing-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('TAXI4 PRICING NORMALIZED',JSON.stringify(report));

const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const pricingPath=path.join(root,'data','pricing.json');
const overridePath=path.join(__dirname,'taxi4-pricing-overrides.json');
const aliasPath=path.join(__dirname,'taxi4-safe-alias-benchmarks.json');

if(!fs.existsSync(pricingPath)) throw new Error('Taxi4 pricing.json not found: '+pricingPath);
if(!fs.existsSync(overridePath)) throw new Error('Taxi4 pricing override file not found');

const pricing=JSON.parse(fs.readFileSync(pricingPath,'utf8'));
const audit=JSON.parse(fs.readFileSync(overridePath,'utf8'));
const aliasAudit=fs.existsSync(aliasPath)?JSON.parse(fs.readFileSync(aliasPath,'utf8')):{aliases:{}};
const overrides=audit.overrides||{};
const aliases=aliasAudit.aliases||{};

function commission(fare){
  const n=Number(fare||0);
  if(n<100) return 5;
  return Math.max(10,Math.floor(n/100)*10);
}
function ceil10(n){return Math.ceil(Number(n||0)/10)*10;}
function coordKey(v){
  const lat=v.lat ?? v.latitude ?? v.Latitude;
  const lon=v.lon ?? v.lng ?? v.longitude ?? v.Longitude ?? v.long;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))) return null;
  return Number(lat).toFixed(6)+','+Number(lon).toFixed(6);
}

let seen=0, missing=[], safetyErrors=[];
const changedNames=new Set();
const locations=[];

function applyMarketFloor(next,benchmark){
  next=Math.max(next,ceil10(Number(benchmark)*1.10));
  while(next-commission(next)<Number(benchmark)) next+=10;
  return next;
}

function walk(v){
  if(Array.isArray(v)){for(const x of v) walk(x);return;}
  if(!v||typeof v!=='object') return;

  if(typeof v.nameHe==='string' && typeof v.fare==='number'){
    seen++;
    locations.push(v);
    const o=overrides[v.nameHe];
    if(!o){
      missing.push(v.nameHe);
    }else{
      const old=Number(v.fare);
      let next=Number(o.fare);
      if(!Number.isFinite(next)||next<old) throw new Error('Invalid fare override for '+v.nameHe);

      let benchmark=(o.reason==='owner_anchor')?null:o.benchmark;
      const safeAlias=aliases[v.nameHe];
      if(o.reason!=='owner_anchor' && safeAlias?.benchmark!=null){
        benchmark=Math.max(Number(benchmark||0),Number(safeAlias.benchmark));
      }

      if(benchmark!=null && Number.isFinite(Number(benchmark))){
        next=applyMarketFloor(next,benchmark);
      }

      v.fare=next;
      if(old!==next) changedNames.add(v.nameHe);

      if(benchmark!=null && Number.isFinite(Number(benchmark))){
        const driverNet=next-commission(next);
        if(driverNet<Number(benchmark)){
          safetyErrors.push({nameHe:v.nameHe,fare:next,commission:commission(next),driverNet,benchmark});
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

// Same-coordinate aliases must never expose a cheaper fare than another label
// pointing to the exact same stored place. This catches duplicate spellings
// without fuzzy-matching different settlements.
const coordGroups=new Map();
for(const v of locations){
  const key=coordKey(v);
  if(!key) continue;
  if(!coordGroups.has(key)) coordGroups.set(key,[]);
  coordGroups.get(key).push(v);
}
let coordinateAliasRaises=0;
for(const group of coordGroups.values()){
  if(group.length<2) continue;
  const groupMax=Math.max(...group.map(x=>Number(x.fare)||0));
  for(const v of group){
    if(Number(v.fare)<groupMax){
      v.fare=groupMax;
      changedNames.add(v.nameHe);
      coordinateAliasRaises++;
    }
  }
}

const changed=changedNames.size;
fs.writeFileSync(pricingPath,JSON.stringify(pricing,null,2)+'\n');
const report={
  version:audit.version,
  appliedAt:new Date().toISOString(),
  locations:seen,
  changed,
  unchanged:seen-changed,
  benchmarkSafetyFailures:0,
  safeCompactAliases:Object.keys(aliases).length,
  coordinateAliasRaises,
  coordinateFieldsPresent:locations.filter(v=>coordKey(v)).length,
  policy:{
    ...audit.policy,
    commissionAwareGuard:"Raise by 10₪ until fare - platform commission >= matched daytime benchmark",
    safeAliasGuard:"Punctuation/spacing-only unambiguous aliases inherit the same market benchmark",
    coordinateAliasGuard:"Exact stored coordinate duplicates use the highest fare in their coordinate group"
  },
  stats:audit.stats
};
fs.writeFileSync(path.join(root,'data','taxi4-pricing-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('TAXI4 PRICING NORMALIZED',JSON.stringify(report));

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
if(!Array.isArray(pricing.locations)) throw new Error('Taxi4 pricing.locations must be an array');

const AIRPORT={lat:32.0055,lon:34.8854};

function commission(fare){
  const n=Number(fare||0);
  if(n<100) return 5;
  return Math.floor(n/100)*10;
}
function ceil10(n){return Math.ceil(Number(n||0)/10)*10;}
function coordKey(v){
  const lat=v.lat ?? v.latitude ?? v.Latitude;
  const lon=v.lon ?? v.lng ?? v.longitude ?? v.Longitude ?? v.long;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))) return null;
  return Number(lat).toFixed(6)+','+Number(lon).toFixed(6);
}
function rad(v){return Number(v)*Math.PI/180;}
function airKm(v){
  const lat=Number(v.lat ?? v.latitude ?? v.Latitude);
  const lon=Number(v.lon ?? v.lng ?? v.longitude ?? v.Longitude ?? v.long);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
  const dLat=rad(lat-AIRPORT.lat),dLon=rad(lon-AIRPORT.lon);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(AIRPORT.lat))*Math.cos(rad(lat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function median(values){
  const a=[...values].filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length) return null;
  const i=Math.floor(a.length/2);
  return a.length%2?a[i]:(a[i-1]+a[i])/2;
}
function marketFloorFare(reference){
  if(!Number.isFinite(Number(reference))||Number(reference)<=0) return 0;
  let fare=ceil10(Number(reference)*1.10);
  while(fare-commission(fare)<Number(reference)) fare+=10;
  return fare;
}
function driverFloorFare(km){
  return Number.isFinite(Number(km))?ceil10(80+4*Number(km)):0;
}
function benchmarkFor(v,o){
  if(o.reason==='owner_anchor') return null;
  const direct=(o.benchmark!==null&&o.benchmark!==undefined&&Number.isFinite(Number(o.benchmark)))?Number(o.benchmark):null;
  const alias=(aliases[v.nameHe]?.benchmark!==null&&aliases[v.nameHe]?.benchmark!==undefined&&Number.isFinite(Number(aliases[v.nameHe]?.benchmark)))?Number(aliases[v.nameHe].benchmark):null;
  if(direct==null) return alias;
  if(alias==null) return direct;
  return Math.max(direct,alias);
}

const missing=[];
const rows=pricing.locations.map(v=>{
  const o=overrides[v.nameHe];
  if(!o){missing.push(v.nameHe);return null;}
  return {
    v,o,
    name:v.nameHe,
    benchmark:benchmarkFor(v,o),
    airKm:airKm(v),
    km:Number(v.roadKm)
  };
}).filter(Boolean);

if(missing.length) throw new Error('Pricing overrides missing '+missing.length+' entries: '+missing.slice(0,20).join(', '));
if(rows.length!==Object.keys(overrides).length) throw new Error('Pricing coverage mismatch: pricing entries='+rows.length+' overrides='+Object.keys(overrides).length);

const matched=rows.filter(r=>r.benchmark!=null&&r.o.reason!=='owner_anchor');
function neighborMedian(row){
  const d=Number(row.airKm);
  if(!Number.isFinite(d)) return null;
  let pool=matched.filter(r=>r.name!==row.name&&Number.isFinite(r.airKm)&&Math.abs(r.airKm-d)<=Math.max(5,d*.08));
  if(pool.length<15) pool=matched.filter(r=>r.name!==row.name&&Number.isFinite(r.airKm)&&Math.abs(r.airKm-d)<=Math.max(10,d*.15));
  if(pool.length<8) return null;
  const vals=pool.map(r=>r.benchmark);
  const med=median(vals);
  const mad=median(vals.map(v=>Math.abs(v-med)))||1;
  const cleaned=pool.filter(r=>Math.abs(r.benchmark-med)<=3.5*mad);
  return median(cleaned.map(r=>r.benchmark));
}

const safeTargets=new Map();
for(const r of matched){
  const neighbor=neighborMedian(r);
  const marketReference=Math.max(Number(r.benchmark||0),Number(neighbor||0));
  const marketFloor=marketFloorFare(marketReference);
  const kmFloor=driverFloorFare(r.km);
  safeTargets.set(r.name,{
    benchmark:r.benchmark,
    neighborMedian:neighbor,
    marketReference,
    marketFloorFare:marketFloor,
    driverFloorFare:kmFloor,
    safeTargetFare:Math.max(marketFloor,kmFloor)
  });
}

let controlledReductions=0;
let marketRaises=0;
const reduced=[];
const raised=[];
const originalFares=new Map(pricing.locations.map(v=>[v.nameHe,Number(v.fare)]));

for(const r of rows){
  const {v,o}=r;
  let next=Number(o.fare);
  if(!Number.isFinite(next)||next<=0) throw new Error('Invalid fare override for '+v.nameHe);

  if(o.reason==='owner_anchor'){
    next=Number(o.fare);
  }else{
    const target=safeTargets.get(v.nameHe);
    if(target){
      if(next>target.safeTargetFare*1.10){
        reduced.push({nameHe:v.nameHe,from:next,to:target.safeTargetFare,marketReference:target.marketReference,roadKm:r.km});
        next=target.safeTargetFare;
        controlledReductions++;
      }else if(next<target.safeTargetFare){
        raised.push({nameHe:v.nameHe,from:next,to:target.safeTargetFare,marketReference:target.marketReference,roadKm:r.km});
        next=target.safeTargetFare;
        marketRaises++;
      }
    }else{
      next=Math.max(next,driverFloorFare(r.km));
    }
  }
  v.fare=next;
}

// Exact-coordinate duplicate labels may inherit the highest safe fare in that
// coordinate group, but explicit owner anchors are immutable.
const coordGroups=new Map();
for(const v of pricing.locations){
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
    if(overrides[v.nameHe]?.reason==='owner_anchor') continue;
    if(Number(v.fare)<groupMax){
      v.fare=groupMax;
      coordinateAliasRaises++;
    }
  }
}

const safetyErrors=[];
for(const r of rows){
  const v=r.v;
  v.commission=commission(v.fare);
  v.driverNet=Number(v.fare)-v.commission;
  if(r.benchmark!=null && v.driverNet<Number(r.benchmark)){
    safetyErrors.push({nameHe:v.nameHe,fare:v.fare,commission:v.commission,driverNet:v.driverNet,benchmark:r.benchmark});
  }
}
if(safetyErrors.length) throw new Error('Driver-net benchmark failures: '+JSON.stringify(safetyErrors.slice(0,20)));

const changedNames=pricing.locations.filter(v=>Number(v.fare)!==Number(originalFares.get(v.nameHe))).map(v=>v.nameHe);
fs.writeFileSync(pricingPath,JSON.stringify(pricing,null,2)+'\n');

const report={
  version:audit.version,
  appliedAt:new Date().toISOString(),
  locations:rows.length,
  changed:changedNames.length,
  unchanged:rows.length-changedNames.length,
  benchmarkSafetyFailures:0,
  safeCompactAliases:Object.keys(aliases).length,
  controlledReductions,
  marketRaises,
  coordinateAliasRaises,
  coordinateFieldsPresent:pricing.locations.filter(v=>coordKey(v)).length,
  reducedExamples:reduced.slice(0,40),
  raisedExamples:raised.slice(0,40),
  policy:{
    ...audit.policy,
    decreases:true,
    controlledReductionGuard:"Matched fares are reduced only when more than 10% above the safe target.",
    safeTargetGuard:"Safe target = max(road-km driver floor, commission-aware market floor from max(iCab/safe-alias benchmark, robust distance-neighbor median)).",
    commissionAwareGuard:"Final fare minus platform commission must remain at/above the matched benchmark.",
    safeAliasGuard:"Punctuation/spacing-only unambiguous aliases inherit the same market benchmark.",
    coordinateAliasGuard:"Exact stored coordinate duplicates may inherit the highest safe fare; explicit owner anchors never change."
  },
  stats:audit.stats
};
fs.writeFileSync(path.join(root,'data','taxi4-pricing-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('TAXI4 PRICING NORMALIZED',JSON.stringify(report));

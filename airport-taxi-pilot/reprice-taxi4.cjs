const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const pricingPath=path.join(root,'data','pricing.json');
const overridePath=path.join(__dirname,'taxi4-pricing-overrides.json');
const aliasPath=path.join(__dirname,'taxi4-safe-alias-benchmarks.json');
const marketPath=path.join(__dirname,'taxi4-market-mid-pricing.json');

for(const f of [pricingPath,overridePath,marketPath]){
  if(!fs.existsSync(f)) throw new Error('Taxi4 pricing file missing: '+f);
}

const pricing=JSON.parse(fs.readFileSync(pricingPath,'utf8'));
const audit=JSON.parse(fs.readFileSync(overridePath,'utf8'));
const aliasAudit=fs.existsSync(aliasPath)?JSON.parse(fs.readFileSync(aliasPath,'utf8')):{aliases:{}};
const marketAudit=JSON.parse(fs.readFileSync(marketPath,'utf8'));

if(!Array.isArray(pricing.locations)) throw new Error('Taxi4 pricing.locations must be an array');

const overrides=audit.overrides||{};
const aliases=aliasAudit.aliases||{};
const marketTargets=marketAudit.targets||{};

function commission(fare){
  const n=Number(fare||0);
  if(n<100) return 5;
  return Math.max(10,Math.floor(n/100)*10);
}
function ceil5(n){return Math.ceil(Number(n||0)/5)*5;}
function ceil10(n){return Math.ceil(Number(n||0)/10)*10;}
function driverFloorFare(km){
  return Number.isFinite(Number(km))?ceil10(80+4*Number(km)):0;
}
function marketFloorFare(reference){
  if(!Number.isFinite(Number(reference))||Number(reference)<=0) return 0;
  let fare=ceil5(Number(reference)*1.10);
  while(fare-commission(fare)<Number(reference)) fare+=5;
  return fare;
}
function coordKey(v){
  const lat=v.lat ?? v.latitude ?? v.Latitude;
  const lon=v.lon ?? v.lng ?? v.longitude ?? v.Longitude ?? v.long;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))) return null;
  return Number(lat).toFixed(6)+','+Number(lon).toFixed(6);
}

const originalFares=new Map(pricing.locations.map(v=>[v.nameHe,Number(v.fare)]));
const missing=[];
const raises=[];

for(const v of pricing.locations){
  const o=overrides[v.nameHe];
  const m=marketTargets[v.nameHe];
  if(!o||!m){missing.push(v.nameHe);continue;}

  const original=Number(v.fare);
  let next=Math.max(original,Number(o.fare||0),Number(m.fare||0));

  // Keep the earlier driver-protection floor for settlements without a usable
  // two-source market benchmark. It may only raise; never reduce.
  if(m.basis==='keep'){
    next=Math.max(next,driverFloorFare(v.roadKm));
  }

  // Safe spelling aliases may inherit the same iCab benchmark.
  const aliasBenchmark=Number(aliases[v.nameHe]?.benchmark);
  if(Number.isFinite(aliasBenchmark)&&aliasBenchmark>0){
    next=Math.max(next,marketFloorFare(aliasBenchmark));
  }

  if(!Number.isFinite(next)||next<=0) throw new Error('Invalid fare for '+v.nameHe);
  next=ceil5(next);

  if(next>original){
    raises.push({
      nameHe:v.nameHe,
      from:original,
      to:next,
      delta:next-original,
      icab:m.icab,
      terminal:m.terminal,
      basis:m.basis
    });
  }
  v.fare=next;
}

// Duplicate labels pointing to the exact same stored coordinates must never
// expose different lower prices. This can only raise the cheaper alias.
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
    if(Number(v.fare)<groupMax){
      v.fare=groupMax;
      coordinateAliasRaises++;
    }
  }
}

if(missing.length) throw new Error('Market pricing coverage missing '+missing.length+' entries: '+missing.slice(0,20).join(', '));
if(pricing.locations.length!==Object.keys(marketTargets).length) throw new Error('Market pricing coverage mismatch');

const safetyErrors=[];
for(const v of pricing.locations){
  const m=marketTargets[v.nameHe];
  v.commission=commission(v.fare);
  v.driverNet=Number(v.fare)-v.commission;

  // iCab is the lower/mass-market benchmark: driver net may not fall below it.
  if(Number.isFinite(Number(m.icab)) && v.driverNet<Number(m.icab)){
    safetyErrors.push({nameHe:v.nameHe,fare:v.fare,driverNet:v.driverNet,benchmark:m.icab,type:'icab'});
  }
  // Terminal-only settlements get a softer guard because Terminal is often
  // upper-middle: driver net must still retain at least 85% of that public fare.
  if(!Number.isFinite(Number(m.icab)) && Number.isFinite(Number(m.terminal)) && v.driverNet<Number(m.terminal)*0.85){
    safetyErrors.push({nameHe:v.nameHe,fare:v.fare,driverNet:v.driverNet,benchmark:Number(m.terminal)*0.85,type:'terminal85'});
  }
}
if(safetyErrors.length) throw new Error('Driver-net market guard failures: '+JSON.stringify(safetyErrors.slice(0,20)));

raises.sort((a,b)=>b.delta-a.delta||b.to-a.to);
const changedNames=pricing.locations.filter(v=>Number(v.fare)!==Number(originalFares.get(v.nameHe))).map(v=>v.nameHe);

fs.writeFileSync(pricingPath,JSON.stringify(pricing,null,2)+'\n');
const report={
  version:marketAudit.version,
  appliedAt:new Date().toISOString(),
  locations:pricing.locations.length,
  changed:changedNames.length,
  unchanged:pricing.locations.length-changedNames.length,
  marketRaises:raises.length,
  coordinateAliasRaises,
  benchmarkSafetyFailures:0,
  reductions:0,
  largestRaises:raises.slice(0,50),
  policy:{
    segment:'mid-market',
    neverReduce:true,
    bothSources:'Midpoint of iCab daytime max and Terminal Taxi small-car public fare, rounded to 5₪',
    icabOnly:'110% of iCab daytime max',
    terminalOnly:'90% of Terminal fare',
    driverGuard:'Net after VanClick commission >= iCab benchmark; Terminal-only >= 85% of Terminal',
    extras:'Peak +5%, Shabbat +15%, Bit +10 are applied separately by the quote engine'
  },
  sourceStats:marketAudit.stats
};
fs.writeFileSync(path.join(root,'data','taxi4-pricing-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('TAXI4 MID-MARKET PRICING APPLIED',JSON.stringify(report));

const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const pricing=JSON.parse(fs.readFileSync(path.join(root,'data','pricing.json'),'utf8'));
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'taxi4-pricing-overrides.json'),'utf8')).overrides||{};
const safeAliasPath=path.join(__dirname,'taxi4-safe-alias-benchmarks.json');
const safeAliases=fs.existsSync(safeAliasPath)?JSON.parse(fs.readFileSync(safeAliasPath,'utf8')).aliases||{}:{};

const AIRPORT={lat:32.0055,lon:34.8854};
function rad(v){return Number(v)*Math.PI/180;}
function airKm(x){
  const lat=Number(x.lat ?? x.latitude ?? x.Latitude);
  const lon=Number(x.lon ?? x.lng ?? x.longitude ?? x.Longitude ?? x.long);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
  const dLat=rad(lat-AIRPORT.lat),dLon=rad(lon-AIRPORT.lon);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(AIRPORT.lat))*Math.cos(rad(lat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const rows=pricing.locations.map(x=>{
  const b=bench[x.nameHe]||{};
  const a=safeAliases[x.nameHe]||{};
  const directBenchmark=(b.benchmark!==null && b.benchmark!==undefined && Number.isFinite(Number(b.benchmark)))?Number(b.benchmark):null;
  const aliasBenchmark=(a.benchmark!==null && a.benchmark!==undefined && Number.isFinite(Number(a.benchmark)))?Number(a.benchmark):null;
  const benchmark=directBenchmark==null?aliasBenchmark:(aliasBenchmark==null?directBenchmark:Math.max(directBenchmark,aliasBenchmark));
  const benchmarkSource=(b.reason==='owner_anchor')?'owner_anchor':(aliasBenchmark!=null && (directBenchmark==null || aliasBenchmark>directBenchmark)?'safe_alias':(b.reason||''));
  const air=airKm(x);
  const km=Number(x.roadKm);
  const roadValid=Number.isFinite(km)&&km>0&&air!=null&&km>=air*.95&&km<=air*2.2+20;
  return {
    name:x.nameHe,
    fare:Number(x.fare),
    km,
    airKm:air==null?null:Number(air.toFixed(1)),
    roadValid,
    benchmark,
    reason:benchmarkSource,
    matchedCity:a.matchedCity||null,
    oldFare:Number(b.oldFare)
  };
});

const matched=rows.filter(r=>r.benchmark!=null && r.reason!=='owner_anchor');
const pct=(a,b)=>b?((a/b)-1)*100:null;
function median(a){
  const x=[...a].filter(Number.isFinite).sort((m,n)=>m-n);
  if(!x.length)return null;
  const i=Math.floor(x.length/2);
  return x.length%2?x[i]:(x[i-1]+x[i])/2;
}
function neighborMedian(row){
  const d=Number(row.airKm);
  if(!Number.isFinite(d)) return null;
  let pool=matched.filter(r=>r.name!==row.name && Number.isFinite(r.airKm) && Math.abs(r.airKm-d)<=Math.max(5,d*.08));
  if(pool.length<15) pool=matched.filter(r=>r.name!==row.name && Number.isFinite(r.airKm) && Math.abs(r.airKm-d)<=Math.max(10,d*.15));
  if(pool.length<8) return null;
  const vals=pool.map(r=>r.benchmark);
  const med=median(vals);
  const dev=vals.map(v=>Math.abs(v-med));
  const mad=median(dev)||1;
  const cleaned=pool.filter(r=>Math.abs(r.benchmark-med)<=3.5*mad);
  return {median:median(cleaned.map(r=>r.benchmark)),n:cleaned.length,rawMedian:med,mad};
}

const analysed=matched.map(r=>{
  const n=neighborMedian(r);
  const marketReference=Math.max(Number(r.benchmark||0),Number(n?.median||0))||null;
  return {...r,
    vsBenchmarkPct:pct(r.fare,r.benchmark),
    neighborMedian:n?.median??null,
    vsNeighborPct:n?.median?pct(r.fare,n.median):null,
    benchmarkVsNeighborPct:n?.median?pct(r.benchmark,n.median):null,
    marketReference,
    vsMarketReferencePct:marketReference?pct(r.fare,marketReference):null,
    neighborN:n?.n??0
  };
});

const buckets={
  cheaper: analysed.filter(r=>r.vsBenchmarkPct < 0).length,
  zeroToTen: analysed.filter(r=>r.vsBenchmarkPct >=0 && r.vsBenchmarkPct <=10).length,
  tenToTwenty: analysed.filter(r=>r.vsBenchmarkPct >10 && r.vsBenchmarkPct <=20).length,
  twentyToThirtyFive: analysed.filter(r=>r.vsBenchmarkPct >20 && r.vsBenchmarkPct <=35).length,
  aboveThirtyFive: analysed.filter(r=>r.vsBenchmarkPct >35).length
};
const suspiciousMatches=analysed
  .filter(r=>Math.abs(r.benchmarkVsNeighborPct??0)>35 && r.neighborN>=8)
  .sort((a,b)=>Math.abs(b.benchmarkVsNeighborPct)-Math.abs(a.benchmarkVsNeighborPct));
const rawSignalDisagreements=analysed
  .filter(r=>r.vsBenchmarkPct>20 || (r.vsNeighborPct??0)>25)
  .sort((a,b)=>Math.max(b.vsBenchmarkPct,b.vsNeighborPct??-999)-Math.max(a.vsBenchmarkPct,a.vsNeighborPct??-999));
const overpriced=analysed
  .filter(r=>(r.vsMarketReferencePct??0)>25)
  .sort((a,b)=>(b.vsMarketReferencePct??-999)-(a.vsMarketReferencePct??-999));
const underpriced=analysed
  .filter(r=>r.vsBenchmarkPct<0 || (r.vsNeighborPct??0)<-10)
  .sort((a,b)=>Math.min(a.vsBenchmarkPct,a.vsNeighborPct??999)-Math.min(b.vsBenchmarkPct,b.vsNeighborPct??999));

const unmatched=rows.filter(r=>r.benchmark==null || r.reason==='owner_anchor');
const badRoad=rows.filter(r=>!r.roadValid).sort((a,b)=>(b.airKm??0)-(a.airKm??0));
const marketCurve=unmatched.map(r=>{
  const synthetic={...r,benchmark:null};
  const n=neighborMedian(synthetic);
  return {...r,neighborMedian:n?.median??null,vsNeighborPct:n?.median?pct(r.fare,n.median):null,neighborN:n?.n??0};
});
const unmatchedHigh=marketCurve.filter(r=>(r.vsNeighborPct??0)>25).sort((a,b)=>b.vsNeighborPct-a.vsNeighborPct);
const unmatchedLow=marketCurve.filter(r=>(r.vsNeighborPct??0)<-10).sort((a,b)=>a.vsNeighborPct-b.vsNeighborPct);

const out={
  total:rows.length,
  matched:matched.length,
  unmatched:unmatched.length,
  safeAliasBenchmarks:Object.keys(safeAliases).length,
  buckets,
  suspiciousMatchCount:suspiciousMatches.length,
  rawSignalDisagreementCount:rawSignalDisagreements.length,
  overpricedCount:overpriced.length,
  underpricedCount:underpriced.length,
  unmatchedHighCount:unmatchedHigh.length,
  unmatchedLowCount:unmatchedLow.length,
  badRoadKmCount:badRoad.length,
  topSuspiciousMatches:suspiciousMatches.slice(0,40),
  topRawSignalDisagreements:rawSignalDisagreements.slice(0,40),
  topOverpriced:overpriced.slice(0,40),
  topUnderpriced:underpriced.slice(0,30),
  topUnmatchedHigh:unmatchedHigh.slice(0,30),
  topUnmatchedLow:unmatchedLow.slice(0,30),
  topBadRoadKm:badRoad.slice(0,40)
};
console.log('TAXI4_MARKET_AUDIT',JSON.stringify(out));

const coordOf=x=>{
  const lat=x.lat ?? x.latitude ?? x.Latitude;
  const lon=x.lon ?? x.lng ?? x.longitude ?? x.Longitude ?? x.long;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))) return null;
  return Number(lat).toFixed(6)+','+Number(lon).toFixed(6);
};
const rawByName=new Map(pricing.locations.map(x=>[x.nameHe,x]));
const externalCovered=new Set(rows.filter(r=>r.benchmark!=null).map(r=>r.name));
const exactCoordinateAliasCandidates=[];
const groups=new Map();
for(const x of pricing.locations){
  const k=coordOf(x); if(!k) continue;
  if(!groups.has(k)) groups.set(k,[]);
  groups.get(k).push(x.nameHe);
}
for(const names of groups.values()){
  if(names.length<2) continue;
  const coveredNames=names.filter(n=>externalCovered.has(n));
  const uncoveredNames=names.filter(n=>!externalCovered.has(n));
  if(coveredNames.length && uncoveredNames.length){
    exactCoordinateAliasCandidates.push({uncovered:uncoveredNames,covered:coveredNames});
  }
}
console.log('TAXI4_COORD_ALIAS_CANDIDATES',JSON.stringify(exactCoordinateAliasCandidates));

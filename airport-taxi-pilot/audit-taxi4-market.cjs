const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const pricing=JSON.parse(fs.readFileSync(path.join(root,'data','pricing.json'),'utf8'));
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'taxi4-pricing-overrides.json'),'utf8')).overrides||{};

const rows=pricing.locations.map(x=>{
  const b=bench[x.nameHe]||{};
  return {
    name:x.nameHe,
    fare:Number(x.fare),
    km:Number(x.roadKm),
    benchmark:Number.isFinite(Number(b.benchmark))?Number(b.benchmark):null,
    reason:b.reason||'',
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
  let pool=matched.filter(r=>r.name!==row.name && Math.abs(r.km-row.km)<=Math.max(4,row.km*.08));
  if(pool.length<15) pool=matched.filter(r=>r.name!==row.name && Math.abs(r.km-row.km)<=Math.max(8,row.km*.15));
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
  return {...r,
    vsBenchmarkPct:pct(r.fare,r.benchmark),
    neighborMedian:n?.median??null,
    vsNeighborPct:n?.median?pct(r.fare,n.median):null,
    benchmarkVsNeighborPct:n?.median?pct(r.benchmark,n.median):null,
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
const overpriced=analysed
  .filter(r=>r.vsBenchmarkPct>20 || (r.vsNeighborPct??0)>25)
  .sort((a,b)=>Math.max(b.vsBenchmarkPct,b.vsNeighborPct??-999)-Math.max(a.vsBenchmarkPct,a.vsNeighborPct??-999));
const underpriced=analysed
  .filter(r=>r.vsBenchmarkPct<0 || (r.vsNeighborPct??0)<-10)
  .sort((a,b)=>Math.min(a.vsBenchmarkPct,a.vsNeighborPct??999)-Math.min(b.vsBenchmarkPct,b.vsNeighborPct??999));

const unmatched=rows.filter(r=>r.benchmark==null || r.reason==='owner_anchor');
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
  buckets,
  suspiciousMatchCount:suspiciousMatches.length,
  overpricedCount:overpriced.length,
  underpricedCount:underpriced.length,
  unmatchedHighCount:unmatchedHigh.length,
  unmatchedLowCount:unmatchedLow.length,
  topSuspiciousMatches:suspiciousMatches.slice(0,40),
  topOverpriced:overpriced.slice(0,40),
  topUnderpriced:underpriced.slice(0,30),
  topUnmatchedHigh:unmatchedHigh.slice(0,30),
  topUnmatchedLow:unmatchedLow.slice(0,30)
};
console.log('TAXI4_MARKET_AUDIT',JSON.stringify(out));

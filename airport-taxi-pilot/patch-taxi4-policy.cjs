const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';

function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function write(rel,src){fs.writeFileSync(path.join(root,rel),src);}
function mustReplace(src,search,replacement,label){
  const before=src;
  if(search instanceof RegExp) src=src.replace(search,replacement);
  else src=src.replace(search,replacement);
  if(src===before) throw new Error('TAXI4_POLICY_PATCH_MISS: '+label);
  return src;
}

// 1) Core platform commission: 1–99 => 5; 100–199 => 10; 200–299 => 20; then +10 per 100.
{
  const rel='src/domain.js';
  let src=read(rel);
  if(!src.includes("return Math.floor(n / 100) * 10;")){
    src=mustReplace(
      src,
      /export function commissionForFare\(fare\) \{[\s\S]*?\n\}/,
`export function commissionForFare(fare) {
  const n = Number(fare);
  if (!Number.isFinite(n) || n <= 0) throw new Error('FARE_MUST_BE_POSITIVE');
  if (n < 100) return 5;
  return Math.floor(n / 100) * 10;
}`,
      'domain commissionForFare'
    );
  }
  write(rel,src);
}

// 2) Quote engine: Israel-local peak/Shabbat surcharges, additive percentages,
// rounded UP to the nearest 5 NIS. Saturday is treated as the Shabbat calendar day.
{
  const rel='src/pricing.js';
  let src=read(rel);
  const replacement=`
function taxi4CommissionForFare(fare) {
  const n = Number(fare);
  if (!Number.isFinite(n) || n <= 0) throw new Error('FARE_MUST_BE_POSITIVE');
  if (n < 100) return 5;
  return Math.floor(n / 100) * 10;
}

function israelTripParts(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const naive = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);
  if (naive) {
    const [,y,mo,d,h,mi] = naive;
    const calendar = new Date(Date.UTC(Number(y), Number(mo)-1, Number(d)));
    return { weekday: calendar.getUTCDay(), minutes: Number(h)*60 + Number(mi) };
  }

  const instant = new Date(raw);
  if (Number.isNaN(instant.getTime())) throw new Error('INVALID_TRIP_AT');
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone:'Asia/Jerusalem', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  });
  const parts=Object.fromEntries(fmt.formatToParts(instant).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const weekday=({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[parts.weekday];
  return { weekday, minutes:Number(parts.hour)*60+Number(parts.minute) };
}

function finalFareForTrip(baseFare, tripAt) {
  const parts=israelTripParts(tripAt);
  const minute=parts?.minutes;
  const peak=Number.isFinite(minute) && (
    (minute >= 7*60 && minute <= 9*60+30) ||
    (minute >= 14*60 && minute <= 18*60)
  );
  const shabbat=parts?.weekday===6;
  const peakSurchargePct=peak?5:0;
  const shabbatSurchargePct=shabbat?15:0;
  const surchargePct=peakSurchargePct+shabbatSurchargePct;
  const raw=Number(baseFare)*(1+surchargePct/100);
  const fare=Math.ceil(raw/5)*5;
  return {fare,peakSurchargePct,shabbatSurchargePct,surchargePct};
}

export function quoteAirportRoute(fromArea, toArea, tripAt = '') {
  const from = resolveLocation(fromArea);
  const to = resolveLocation(toArea);
  if (!from) throw new Error('FROM_LOCATION_NOT_PRICED');
  if (!to) throw new Error('TO_LOCATION_NOT_PRICED');
  const fromAirport = from.type === 'airport';
  const toAirport = to.type === 'airport';
  if (fromAirport === toAirport) throw new Error('ONE_SIDE_MUST_BE_BEN_GURION');
  const location = fromAirport ? to : from;
  const baseFare=Number(location.fare);
  const adjusted=finalFareForTrip(baseFare,tripAt);
  const commission=taxi4CommissionForFare(adjusted.fare);
  return {
    version: pricing.version,
    currency: pricing.currency,
    from: fromAirport ? pricing.airport.nameHe : location.nameHe,
    to: toAirport ? pricing.airport.nameHe : location.nameHe,
    city: location.nameHe,
    baseFare,
    fare: adjusted.fare,
    commission,
    driverNet: adjusted.fare-commission,
    roadKm: location.roadKm,
    direction: fromAirport ? 'from_airport' : 'to_airport',
    peakSurchargePct: adjusted.peakSurchargePct,
    shabbatSurchargePct: adjusted.shabbatSurchargePct,
    surchargePct: adjusted.surchargePct
  };
}
`;
  src=mustReplace(
    src,
    /export function quoteAirportRoute\(fromArea, toArea\) \{[\s\S]*?\n\}\n\nexport function pricingStats/,
    replacement+'\nexport function pricingStats',
    'pricing quoteAirportRoute'
  );
  write(rel,src);
}

// 3) Booking engine must price the exact trip time, and naive datetime-local
// values must be interpreted as Israel time rather than Render server time.
{
  const rel='src/service.js';
  let src=read(rel);
  src=mustReplace(
    src,
    "function normalizeTripAt(value) { const d = new Date(value); if (Number.isNaN(d.getTime())) throw new Error('INVALID_TRIP_AT'); return d.toISOString(); }",
`const israelDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Asia/Jerusalem', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
});
function israelWallClockAsUtcMs(epochMs) {
  const parts=Object.fromEntries(israelDateTimeFormatter.formatToParts(new Date(epochMs)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
}
function normalizeTripAt(value) {
  const raw=String(value ?? '').trim();
  const naive=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);
  if (naive) {
    const [,y,mo,d,h,mi,s='0']=naive;
    const wall=Date.UTC(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi),Number(s));
    let epoch=wall-(israelWallClockAsUtcMs(wall)-wall);
    epoch=wall-(israelWallClockAsUtcMs(epoch)-epoch);
    const date=new Date(epoch);
    if (Number.isNaN(date.getTime())) throw new Error('INVALID_TRIP_AT');
    return date.toISOString();
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('INVALID_TRIP_AT');
  return d.toISOString();
}`,
    'service normalizeTripAt'
  );
  src=mustReplace(
    src,
    'const quote = quoteAirportRoute(input.fromArea, input.toArea);',
    'const quote = quoteAirportRoute(input.fromArea, input.toArea, input.tripAt);',
    'service makeOrder quote time'
  );
  write(rel,src);
}

// 4) Quote API receives the selected trip time.
{
  const rel='server.js';
  let src=read(rel);
  src=mustReplace(
    src,
    "if(req.method==='POST'&&url.pathname==='/api/pricing/quote'){const b=await body(req);return json(res,200,quoteAirportRoute(b.fromArea,b.toArea));}",
    "if(req.method==='POST'&&url.pathname==='/api/pricing/quote'){const b=await body(req);return json(res,200,quoteAirportRoute(b.fromArea,b.toArea,b.tripAt));}",
    'server quote endpoint tripAt'
  );
  write(rel,src);
}

// 5) Client sends tripAt to the quote API. Stored booking already sends it through the form.
{
  const rel=path.join('apps','client','public','app.js');
  let src=read(rel);
  src=mustReplace(
    src,
    "const r0=routeFromUi();q('#quoteResult')",
    "const r0={...routeFromUi(),tripAt:q('#tripAt').value};q('#quoteResult')",
    'client quote tripAt'
  );
  write(rel,src);
}

console.log('TAXI4_POLICY_PATCH_APPLIED');

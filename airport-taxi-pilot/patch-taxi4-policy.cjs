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

export function quoteAirportRoute(fromArea, toArea, tripAt = '', paymentMethod = '') {
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
  const paymentSurcharge=String(paymentMethod||'').toLowerCase()==='bit'?10:0;
  const transportFare=adjusted.fare;
  const fare=transportFare+paymentSurcharge;
  // Platform commission is based on the transport fare only.
  // The 10₪ Bit surcharge belongs to the payment method, not the trip-price band.
  const commission=taxi4CommissionForFare(transportFare);
  return {
    version: pricing.version,
    currency: pricing.currency,
    from: fromAirport ? pricing.airport.nameHe : location.nameHe,
    to: toAirport ? pricing.airport.nameHe : location.nameHe,
    city: location.nameHe,
    baseFare,
    transportFare,
    paymentSurcharge,
    paymentSurchargeReason:paymentSurcharge?'bit':null,
    fare,
    commission,
    driverNet: fare-commission,
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
    "if(req.method==='POST'&&url.pathname==='/api/pricing/quote'){const b=await body(req);return json(res,200,quoteAirportRoute(b.fromArea,b.toArea,b.tripAt,b.paymentMethod));}",
    'server quote endpoint tripAt'
  );
  write(rel,src);
}

// 5) Client sends tripAt to the quote API and shows the Bit +10₪ surcharge
// before confirmation. Cash keeps the transport fare unchanged.
{
  const rel=path.join('apps','client','public','app.js');
  let src=read(rel);
  src=mustReplace(
    src,
    "const r0=routeFromUi();q('#quoteResult')",
    "const r0={...routeFromUi(),tripAt:q('#tripAt').value};q('#quoteResult')",
    'client quote tripAt'
  );

  src=mustReplace(
    src,
    "function syncBooking(){if(!currentQuote)return;const r=routeFromUi();q('#formFromArea').value=r.fromArea;q('#formToArea').value=r.toArea;q('#formTripAt').value=q('#tripAt').value;q('#formPassengers').value=q('#passengers').value;q('#summaryRoute').textContent=\`\${r.fromArea} ← \${r.toArea}\`;q('#summaryFare').textContent=\`\${currentQuote.fare} ₪\`;q('#miniFare').textContent=\`\${currentQuote.fare} ₪\`;q('#submitFare').textContent=\`\${currentQuote.fare} ₪\`;q('#mobileFare').textContent=\`\${currentQuote.fare} ₪\`;",
    "function selectedPayment(){return q('[name=paymentMethod]:checked')?.value||'bit';}function visibleFare(){if(!currentQuote)return 0;return Number(currentQuote.fare)+(selectedPayment()==='bit'?10:0);}function syncBooking(){if(!currentQuote)return;const r=routeFromUi(),fee=selectedPayment()==='bit'?10:0,total=visibleFare();q('#formFromArea').value=r.fromArea;q('#formToArea').value=r.toArea;q('#formTripAt').value=q('#tripAt').value;q('#formPassengers').value=q('#passengers').value;q('#summaryRoute').textContent=\`\${r.fromArea} ← \${r.toArea}\`;q('#summaryFare').textContent=\`\${total} ₪\`;q('#miniFare').textContent=\`\${total} ₪\`;q('#submitFare').textContent=\`\${total} ₪\`;q('#mobileFare').textContent=\`\${total} ₪\`;const feeLine=q('#bitFeeLine');if(feeLine){feeLine.classList.toggle('hidden',!fee);q('#bitFeeAmount').textContent=fee?'+10 ₪':'';}const baseLine=q('#baseFareLine');if(baseLine)q('#baseFareAmount').textContent=\`\${currentQuote.fare} ₪\`;",
    'client Bit surcharge visible fare'
  );

  src=mustReplace(
    src,
    "q('#returnToggle').onchange=()=>{",
    "qa('[name=paymentMethod]').forEach(x=>x.onchange=syncBooking);q('#returnToggle').onchange=()=>{",
    'client payment change updates price'
  );
  write(rel,src);

  const htmlRel=path.join('apps','client','public','index.html');
  let html=read(htmlRel);
  html=mustReplace(
    html,
    '<label class="payment-option"><input type="radio" name="paymentMethod" value="bit" checked><span><b>Bit</b><small>ישירות לנהג</small></span></label>',
    '<label class="payment-option"><input type="radio" name="paymentMethod" value="bit" checked><span><b>Bit</b><small>ישירות לנהג · תוספת 10 ₪</small></span></label>',
    'client Bit option surcharge disclosure'
  );
  html=mustReplace(
    html,
    '<div class="summary-fare"><span>מחיר קבוע</span><strong id="summaryFare"></strong></div>',
    '<div class="price-breakdown"><div id="baseFareLine"><span>מחיר נסיעה</span><b id="baseFareAmount"></b></div><div id="bitFeeLine"><span>תוספת תשלום ב-Bit</span><b id="bitFeeAmount">+10 ₪</b></div></div><div class="summary-fare"><span>סה״כ לתשלום</span><strong id="summaryFare"></strong></div>',
    'client price breakdown'
  );
  html=mustReplace(
    html,
    '<li>✓ Bit או מזומן</li>',
    '<li>✓ מזומן ללא תוספת · Bit בתוספת 10 ₪</li>',
    'client payment summary disclosure'
  );
  write(htmlRel,html);
}

// 6) Driver wallet top-up is Bit-only.
// Money is transferred manually to the owner's Bit number and the dispatcher
// approves the wallet credit only after the transfer is verified.
{
  const rel='src/service.js';
  let src=read(rel);
  src=mustReplace(
    src,
    "export async function requestDriverTopup(driverId,amount,method){return transact(db=>{const driver=activeDriver(db,driverId);if(!driver)throw new Error('DRIVER_NOT_FOUND');const topup={id:id('top'),driverId,amount:positiveAmount(amount,'TOPUP_MUST_BE_POSITIVE'),method:normalizePaymentMethod(method),status:'pending',requestedAt:new Date().toISOString(),approvedAt:null,approvedBy:null};db.topups.push(topup);db.ledger.push({id:id('led'),at:topup.requestedAt,driverId,orderId:null,type:'wallet_topup_requested',amount:topup.amount,method:topup.method,topupId:topup.id});return topup;});}",
    "export async function requestDriverTopup(driverId,amount,method){return transact(db=>{const driver=activeDriver(db,driverId);if(!driver)throw new Error('DRIVER_NOT_FOUND');if(String(method||'').toLowerCase()!=='bit')throw new Error('BIT_TOPUP_ONLY');const topup={id:id('top'),driverId,amount:positiveAmount(amount,'TOPUP_MUST_BE_POSITIVE'),method:'bit',bitRecipient:'+972545718740',status:'pending',requestedAt:new Date().toISOString(),approvedAt:null,approvedBy:null};db.topups.push(topup);db.ledger.push({id:id('led'),at:topup.requestedAt,driverId,orderId:null,type:'wallet_topup_requested',amount:topup.amount,method:'bit',bitRecipient:topup.bitRecipient,topupId:topup.id});return topup;});}",
    'Bit-only driver topup'
  );
  write(rel,src);
}

// 7) Taxi 1–4 luggage capacity guard.
// A regular taxi may accept at most 4 large suitcases.
// 5+ requires VanClick large taxi and cannot be booked through Taxi 1–4.
{
  const htmlRel=path.join('apps','client','public','index.html');
  let html=read(htmlRel);

  html=mustReplace(
    html,
    '<label class="field"><span>מזוודות גדולות</span><select name="largeLuggage"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+</option></select></label>',
    '<label class="field"><span>מזוודות גדולות</span><select name="largeLuggage"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+ — נדרשת מונית גדולה</option></select><div id="largeLuggageWarning" class="large-luggage-warning hidden"><b>מעל 4 מזוודות גדולות נדרשת מונית גדולה</b><span>תא המטען של מונית רגילה אינו מתאים ליותר מ-4 מזוודות גדולות.</span><button type="button" id="largeLuggageHandoff">לעבור למונית גדולה של VanClick</button></div></label>',
    'Taxi4 large luggage selector'
  );
  write(htmlRel,html);

  const clientRel=path.join('apps','client','public','app.js');
  let client=read(clientRel);
  client=mustReplace(
    client,
    "q('#returnToggle').onchange=()=>{",
    "const largeBag=q('[name=largeLuggage]');const luggageWarning=q('#largeLuggageWarning');function syncLargeLuggage(){const tooMany=Number(largeBag?.value||0)>4;luggageWarning?.classList.toggle('hidden',!tooMany);q('#submitBtn').disabled=tooMany;if(tooMany){q('#submitBtn span').textContent='נדרשת מונית גדולה';}else{q('#submitBtn span').textContent='אישור הזמנה';}}largeBag?.addEventListener('change',syncLargeLuggage);q('#largeLuggageHandoff')?.addEventListener('click',()=>handoff('large_luggage_requires_large_vehicle').catch(e=>alert(e.message)));q('#returnToggle').onchange=()=>{",
    'Taxi4 large luggage client guard'
  );
  client=mustReplace(
    client,
    "b.largeLuggage=Number(b.largeLuggage||0);b.smallLuggage=Number(b.smallLuggage||0);",
    "b.largeLuggage=Number(b.largeLuggage||0);b.smallLuggage=Number(b.smallLuggage||0);if(b.largeLuggage>4){syncLargeLuggage();return handoff('large_luggage_requires_large_vehicle');}",
    'Taxi4 large luggage submit guard'
  );
  write(clientRel,client);

  const serviceRel='src/service.js';
  let service=read(serviceRel);
  if(!service.includes("LARGE_LUGGAGE_REQUIRES_LARGE_VEHICLE")){
    service=mustReplace(
      service,
      "const quote = quoteAirportRoute(input.fromArea, input.toArea, input.tripAt, input.paymentMethod);",
      "if(Number(input.largeLuggage||0)>4)throw new Error('LARGE_LUGGAGE_REQUIRES_LARGE_VEHICLE');const quote = quoteAirportRoute(input.fromArea, input.toArea, input.tripAt, input.paymentMethod);",
      'Taxi4 server large luggage guard'
    );
  }
  write(serviceRel,service);
}

console.log('LARGE_LUGGAGE_LIMIT_TAXI4');
console.log('TAXI4_POLICY_PATCH_APPLIED');

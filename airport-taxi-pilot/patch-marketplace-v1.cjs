const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';

function patchFile(rel, fn){
  const file=path.join(root,rel);
  let src=fs.readFileSync(file,'utf8');
  const api={
    replaceOnce(search,replacement,label){
      const before=src;
      src=src.replace(search,replacement);
      if(src===before) throw new Error('MARKETPLACE_V1_PATCH_MISS: '+rel+' :: '+label);
    },
    get(){return src;}
  };
  fn(api);
  fs.writeFileSync(file,api.get());
}

patchFile('src/persistence.js',({replaceOnce})=>{
  replaceOnce(
    "events: Array.isArray(db?.events) ? db.events : []",
    "events: Array.isArray(db?.events) ? db.events : [], sessions: Array.isArray(db?.sessions) ? db.sessions : []",
    'marketplace auth sessions'
  );
});

patchFile('src/service.js',({replaceOnce})=>{
  replaceOnce(
    "function activeDriver(db, driverId) { return db.drivers.find(d => d.id === driverId && d.active && d.verified !== false); }",
    `function activeDriver(db, driverId) { return db.drivers.find(d => d.id === driverId && d.active && d.verified !== false); }

function marketplaceBusyWindow(order) {
  const at = new Date(order.tripAt).getTime();
  if (!Number.isFinite(at)) throw new Error('INVALID_TRIP_AT');
  const km = Math.max(0, Number(order.roadKm || 0));
  const estimatedTripMinutes = Math.max(50, Math.min(360, Math.ceil(25 + km * 1.15)));
  return {
    start: at - 30 * 60000,
    end: at + (estimatedTripMinutes + 20) * 60000,
    estimatedTripMinutes
  };
}

function marketplaceClaimBlockReason(db, driver, order) {
  if (Number(driver.wallet) < Number(order.commission)) return 'insufficient_wallet';
  const target = marketplaceBusyWindow(order);
  const conflict = db.orders.some(existing => {
    if (existing.id === order.id || existing.assignedDriverId !== driver.id) return false;
    if (!['assigned','driver_enroute'].includes(existing.status)) return false;
    const busy = marketplaceBusyWindow(existing);
    return target.start < busy.end && busy.start < target.end;
  });
  return conflict ? 'schedule_conflict' : null;
}

function marketplacePoolView(db, driver, order) {
  const reason = marketplaceClaimBlockReason(db, driver, order);
  return {
    ...sanitizeOrderForPool(order),
    canClaim: !reason,
    claimBlockReason: reason,
    estimatedTripMinutes: marketplaceBusyWindow(order).estimatedTripMinutes
  };
}`,
    'claim safety helpers'
  );

  replaceOnce(
    "flightNumber, terminal:clean(input.terminal,20), quotedFare:quote.fare, quotedCommission:quote.commission,",
    "flightNumber, terminal:clean(input.terminal,20), quotedFare:quote.fare, quotedCommission:quote.commission, roadKm:Number(quote.roadKm||0),",
    'store route distance'
  );

  replaceOnce(
    "quoteVersion:quote.version, fare:null, commission:null, assignedDriverId:null, assignedAt:null,",
    "quoteVersion:quote.version, fare:quote.fare, commission:quote.commission, assignedDriverId:null, assignedAt:null,",
    'final fare and commission at booking'
  );

  replaceOnce(
    "const pool=db.orders.filter(o=>o.status==='pool').sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)).map(sanitizeOrderForPool);",
    "const pool=db.orders.filter(o=>o.status==='pool').sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)).map(o=>marketplacePoolView(db,driver,o));",
    'decorate driver pool eligibility'
  );

  replaceOnce(
    "driver.wallet=Number((Number(driver.wallet)+refund).toFixed(2));db.ledger.push({id:id('led'),at:new Date(now).toISOString(),driverId,orderId,type:'commission_refund_driver_cancel_ge_2h'",
    "driver.wallet=Number((Number(driver.wallet)+refund).toFixed(2));driver.selfCancelledTrips=Number(driver.selfCancelledTrips||0)+1;db.ledger.push({id:id('led'),at:new Date(now).toISOString(),driverId,orderId,type:'commission_refund_driver_cancel_ge_2h'",
    'count driver self cancellations'
  );

  replaceOnce(
    "return {driver:{id:driver.id,name:driver.name,wallet:driver.wallet,reliability:driver.reliability,vehiclePlate:driver.vehiclePlate||''},pool,mine,completed,topups};",
    `const allCompleted=db.orders.filter(o=>o.assignedDriverId===driverId&&o.status==='completed');
  const commissionDebited=db.ledger.filter(x=>x.driverId===driverId&&x.type==='commission_debit').reduce((s,x)=>s+Number(x.amount||0),0);
  const commissionRefunded=db.ledger.filter(x=>x.driverId===driverId&&String(x.type||'').startsWith('commission_refund')).reduce((s,x)=>s+Number(x.amount||0),0);
  const stats={
    completedTrips:allCompleted.length,
    completedFare:Number(allCompleted.reduce((s,x)=>s+Number(x.fare||0),0).toFixed(2)),
    completedDriverNet:Number(allCompleted.reduce((s,x)=>s+Number(x.fare||0)-Number(x.commission||0),0).toFixed(2)),
    commissionDebited:Number(commissionDebited.toFixed(2)),
    commissionRefunded:Number(commissionRefunded.toFixed(2)),
    netCommissionPaid:Number((commissionDebited-commissionRefunded).toFixed(2)),
    selfCancelledTrips:Number(driver.selfCancelledTrips||0)
  };
  return {driver:{id:driver.id,name:driver.name,wallet:driver.wallet,reliability:driver.reliability,vehiclePlate:driver.vehiclePlate||'',completedTrips:Number(driver.completedTrips||allCompleted.length)},pool,mine,completed,topups,stats};`,
    'driver finance stats'
  );


  replaceOnce(
    /export async function requestDriverTopup\(driverId,amount,method\)\{[\s\S]*?\n\nexport async function buyOrder/,
    `const DRIVER_TOPUP_VAT_RATE=0.18;
function driverTopupBreakdown(amount){
  const credits=positiveAmount(amount,'TOPUP_MUST_BE_POSITIVE');
  const vatAmount=Number((credits*DRIVER_TOPUP_VAT_RATE).toFixed(2));
  const totalAmount=Number((credits+vatAmount).toFixed(2));
  return {credits,netAmount:credits,vatRate:DRIVER_TOPUP_VAT_RATE,vatAmount,totalAmount};
}
function normalizeTopupTaxFields(topup){
  const b=driverTopupBreakdown(topup.credits??topup.amount);
  topup.amount=b.credits;
  topup.credits=b.credits;
  topup.netAmount=b.netAmount;
  topup.vatRate=b.vatRate;
  topup.vatAmount=b.vatAmount;
  topup.totalAmount=b.totalAmount;
  return b;
}
export async function requestDriverTopup(driverId,amount,method){return transact(db=>{
  const driver=activeDriver(db,driverId);if(!driver)throw new Error('DRIVER_NOT_FOUND');
  const b=driverTopupBreakdown(amount);
  const topup={id:id('top'),driverId,amount:b.credits,credits:b.credits,netAmount:b.netAmount,vatRate:b.vatRate,vatAmount:b.vatAmount,totalAmount:b.totalAmount,method:normalizePaymentMethod(method),status:'pending',requestedAt:new Date().toISOString(),approvedAt:null,approvedBy:null};
  db.topups.push(topup);
  db.ledger.push({id:id('led'),at:topup.requestedAt,driverId,orderId:null,type:'wallet_topup_requested',amount:b.credits,credits:b.credits,netAmount:b.netAmount,vatRate:b.vatRate,vatAmount:b.vatAmount,totalAmount:b.totalAmount,method:topup.method,topupId:topup.id});
  return topup;
});}
export async function approveDriverTopup(topupId,approvedBy='dispatcher'){return transact(db=>{
  const topup=db.topups.find(t=>t.id===topupId);if(!topup)throw new Error('TOPUP_NOT_FOUND');if(topup.status!=='pending')throw new Error('TOPUP_NOT_PENDING');
  const driver=activeDriver(db,topup.driverId);if(!driver)throw new Error('DRIVER_NOT_FOUND');
  const b=normalizeTopupTaxFields(topup);
  driver.wallet=Number((Number(driver.wallet)+b.credits).toFixed(2));
  topup.status='approved';topup.approvedAt=new Date().toISOString();topup.approvedBy=clean(approvedBy,100)||'dispatcher';
  db.ledger.push({id:id('led'),at:topup.approvedAt,driverId:driver.id,orderId:null,type:'wallet_topup_approved',amount:b.credits,credits:b.credits,netAmount:b.netAmount,vatRate:b.vatRate,vatAmount:b.vatAmount,totalAmount:b.totalAmount,method:topup.method,topupId:topup.id,approvedBy:topup.approvedBy});
  return{...topup,wallet:driver.wallet};
});}
export async function rejectDriverTopup(topupId,rejectedBy='dispatcher'){return transact(db=>{
  const topup=db.topups.find(t=>t.id===topupId);if(!topup)throw new Error('TOPUP_NOT_FOUND');if(topup.status!=='pending')throw new Error('TOPUP_NOT_PENDING');
  const b=normalizeTopupTaxFields(topup);
  topup.status='rejected';topup.approvedAt=new Date().toISOString();topup.approvedBy=clean(rejectedBy,100)||'dispatcher';
  db.ledger.push({id:id('led'),at:topup.approvedAt,driverId:topup.driverId,orderId:null,type:'wallet_topup_rejected',amount:b.credits,credits:b.credits,netAmount:b.netAmount,vatRate:b.vatRate,vatAmount:b.vatAmount,totalAmount:b.totalAmount,method:topup.method,topupId:topup.id});
  return topup;
});}

export async function buyOrder`,
    '18% VAT on driver credit top-ups'
  );



  replaceOnce(
    /export async function listAdminState\(\) \{[\s\S]*?\n\}/,
    `function marketplaceAttention(db, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const nowMs = current.getTime();
  const out = [];
  for (const order of db.orders) {
    const tripMs = new Date(order.tripAt).getTime();
    if (!Number.isFinite(tripMs)) continue;
    const minutes = Math.floor((tripMs - nowMs) / 60000);

    if (order.issue?.status === 'open') {
      out.push({
        id:'attention_issue_'+order.id,
        orderId:order.id,
        kind:'open_issue',
        severity:'critical',
        minutesUntilTrip:minutes,
        issue:order.issue
      });
    }

    if (order.status === 'pool' && minutes <= 90) {
      out.push({
        id:'attention_pool_'+order.id,
        orderId:order.id,
        kind:minutes < 0 ? 'unclaimed_overdue' : 'unclaimed_soon',
        severity:minutes < 0 ? 'critical' : 'high',
        minutesUntilTrip:minutes
      });
    }

    if (order.status === 'assigned' && minutes <= 30 && minutes >= -120 && !order.driverConfirmedAt) {
      out.push({
        id:'attention_enroute_'+order.id,
        orderId:order.id,
        kind:'driver_not_enroute',
        severity:'high',
        minutesUntilTrip:minutes,
        driverId:order.assignedDriverId
      });
    }
  }
  const rank={critical:0,high:1,medium:2,low:3};
  return out.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9) || a.minutesUntilTrip-b.minutesUntilTrip);
}

export async function listAdminState(now = new Date()) {
  const db=await readDb();
  const counts={};for(const o of db.orders)counts[o.status]=(counts[o.status]||0)+1;
  const attention=marketplaceAttention(db,now);
  const commissionDebited=db.ledger.filter(x=>x.type==='commission_debit').reduce((s,x)=>s+Number(x.amount||0),0);
  const commissionRefunded=db.ledger.filter(x=>String(x.type||'').startsWith('commission_refund')).reduce((s,x)=>s+Number(x.amount||0),0);
  const completedOrders=db.orders.filter(x=>x.status==='completed');
  const finance={
    commissionDebited:Number(commissionDebited.toFixed(2)),
    commissionRefunded:Number(commissionRefunded.toFixed(2)),
    netCommissionCollected:Number((commissionDebited-commissionRefunded).toFixed(2)),
    completedFare:Number(completedOrders.reduce((s,x)=>s+Number(x.fare||0),0).toFixed(2)),
    completedDriverNet:Number(completedOrders.reduce((s,x)=>s+Number(x.fare||0)-Number(x.commission||0),0).toFixed(2))
  };
  return {
    drivers:db.drivers,
    orders:db.orders.slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),
    topups:db.topups.slice().reverse(),
    ledger:db.ledger.slice(-500).reverse(),
    events:db.events.slice(-500).reverse(),
    counts,
    finance,
    attention,
    attentionCount:attention.length
  };
}`,
    'exception-first dispatch state'
  );

  replaceOnce(
    /export async function driverCompleteOrder\(orderId,driverId,now=new Date\(\)\)\{return transact\(db=>\{[^\n]+\}\);\}/,
    `export async function driverCompleteOrder(orderId,driverId,now=new Date()){return transact(db=>{
  const order=db.orders.find(o=>o.id===orderId);
  const driver=activeDriver(db,driverId);
  if(!order)throw new Error('ORDER_NOT_FOUND');
  if(!driver)throw new Error('DRIVER_NOT_FOUND');
  if(order.assignedDriverId!==driverId)throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
  if(order.status!=='driver_enroute')throw new Error('DRIVER_MUST_BE_ENROUTE');
  order.status='completed';
  order.completedAt=new Date(now).toISOString();
  driver.completedTrips=Number(driver.completedTrips||0)+1;
  event(db,order.id,'trip_completed','driver',{driverId});
  return revealOrderForAssignedDriver(order);
});}`,
    'completion requires enroute'
  );

  replaceOnce(
    "export async function registerDriver(input){return transact(db=>{",
    `export async function driverReportIssue(orderId,driverId,input={},now=new Date()){return transact(db=>{
  const order=db.orders.find(o=>o.id===orderId);
  const driver=activeDriver(db,driverId);
  if(!order)throw new Error('ORDER_NOT_FOUND');
  if(!driver)throw new Error('DRIVER_NOT_FOUND');
  if(order.assignedDriverId!==driverId || !['assigned','driver_enroute'].includes(order.status))throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
  if(order.issue?.status==='open')return order.issue;
  const type=clean(input.type,60);
  const allowed=['client_unreachable','customer_not_ready','client_no_show','flight_delay','pickup_problem','vehicle_problem','other'];
  if(!allowed.includes(type))throw new Error('INVALID_ISSUE_TYPE');
  order.issue={
    id:id('iss'),
    type,
    note:clean(input.note,500),
    status:'open',
    driverId,
    reportedAt:new Date(now).toISOString(),
    resolvedAt:null,
    resolutionNote:''
  };
  event(db,order.id,'driver_issue_reported','driver',{driverId,issueType:type});
  return order.issue;
});}

export async function adminResolveIssue(orderId,input={},now=new Date()){return transact(db=>{
  const order=db.orders.find(o=>o.id===orderId);
  if(!order)throw new Error('ORDER_NOT_FOUND');
  if(!order.issue || order.issue.status!=='open')throw new Error('ORDER_ISSUE_NOT_OPEN');
  order.issue.status='resolved';
  order.issue.resolvedAt=new Date(now).toISOString();
  order.issue.resolutionNote=clean(input.note,500);
  event(db,order.id,'dispatch_issue_resolved','dispatcher',{issueType:order.issue.type});
  return order.issue;
});}

export async function registerDriver(input){return transact(db=>{`,
    'driver issue workflow'
  );
  replaceOnce(
    /export async function buyOrder\(orderId,driverId\)\{return transact\(db=>\{[^\n]+\}\);\}/,
    `export async function buyOrder(orderId,driverId){return transact(db=>{
  const driver=activeDriver(db,driverId);if(!driver)throw new Error('DRIVER_NOT_FOUND');
  const order=db.orders.find(o=>o.id===orderId);if(!order)throw new Error('ORDER_NOT_FOUND');

  if(order.assignedDriverId===driverId && ['assigned','driver_enroute'].includes(order.status)){
    return {
      payment:{id:order.commissionPaymentId,amount:order.commission,status:'already_owned'},
      order:revealOrderForAssignedDriver(order),
      wallet:driver.wallet
    };
  }

  if(order.status!=='pool'||order.assignedDriverId)throw new Error('ORDER_ALREADY_TAKEN');
  if(!Number.isFinite(order.commission))throw new Error('ORDER_NOT_PRICED');

  const block=marketplaceClaimBlockReason(db,driver,order);
  if(block==='insufficient_wallet')throw new Error('INSUFFICIENT_WALLET_BALANCE');
  if(block==='schedule_conflict')throw new Error('DRIVER_SCHEDULE_CONFLICT');

  const paymentId=id('pay');
  driver.wallet=Number((Number(driver.wallet)-Number(order.commission)).toFixed(2));
  order.status='assigned';order.assignedDriverId=driverId;order.assignedAt=new Date().toISOString();
  order.commissionPaidAt=order.assignedAt;order.commissionPaymentId=paymentId;
  db.ledger.push({id:id('led'),at:order.commissionPaidAt,driverId,orderId,type:'commission_debit',amount:order.commission,paymentId});
  event(db,order.id,'driver_claimed','driver',{driverId});
  return{payment:{id:paymentId,amount:order.commission,status:'paid_from_wallet'},order:revealOrderForAssignedDriver(order),wallet:driver.wallet};
});}`,
    'idempotent schedule-safe buyOrder'
  );
});

patchFile('server.js',({replaceOnce})=>{
  replaceOnce(
    "import { ensureDb, readDb, resetDb } from './src/persistence.js';",
    "import { ensureDb, readDb, resetDb } from './src/persistence.js';\nimport { marketplaceAuthRequired, configureDriverPin, driverLogin, dispatchLogin, sessionForToken, logoutToken } from './src/auth.js';",
    'marketplace auth imports'
  );

  replaceOnce(
    "const statusFor=code=>({",
    "const bearerToken=req=>{const h=String(req.headers.authorization||'');const m=h.match(/^Bearer\\s+(.+)$/i);return m?m[1]:'';};\nasync function enforceMarketplaceAuth(req,url){if(!marketplaceAuthRequired())return;if(url.pathname.startsWith('/api/auth/'))return;if(url.pathname.startsWith('/api/dispatch/')){const s=await sessionForToken(bearerToken(req));if(!s||!['admin','dispatch'].includes(s.role))throw new Error('UNAUTHORIZED');return;}const m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)/);if(m){const s=await sessionForToken(bearerToken(req));if(!s||s.role!=='driver'||s.driverId!==decodeURIComponent(m[1]))throw new Error('UNAUTHORIZED');}}\nconst statusFor=code=>({",
    'marketplace auth helpers'
  );

  replaceOnce(
    "if(url.pathname.startsWith('/api/')){",
    "if(url.pathname.startsWith('/api/')){\n      if(req.method==='GET'&&url.pathname==='/api/auth/status')return json(res,200,{required:marketplaceAuthRequired()});\n      if(req.method==='POST'&&url.pathname==='/api/auth/driver/login'){const b=await body(req);return json(res,200,await driverLogin(b.driverId,b.pin));}\n      if(req.method==='POST'&&url.pathname==='/api/auth/dispatch/login'){const b=await body(req);return json(res,200,await dispatchLogin(b.pin));}\n      if(req.method==='POST'&&url.pathname==='/api/auth/logout')return json(res,200,await logoutToken(bearerToken(req)));\n      await enforceMarketplaceAuth(req,url);",
    'marketplace auth routes and guard'
  );

  replaceOnce(
    "driverConfirmEnRoute, driverCompleteOrder, adminCancelOrder, registerDriver,",
    "driverConfirmEnRoute, driverCompleteOrder, driverReportIssue, adminResolveIssue, adminCancelOrder, registerDriver,",
    'driver issue workflow imports'
  );

  replaceOnce(
    "ORDER_ALREADY_TAKEN:409,INSUFFICIENT_WALLET_BALANCE:402,LATE_CANCEL_REQUIRES_DISPATCH:409,",
    "ORDER_ALREADY_TAKEN:409,INSUFFICIENT_WALLET_BALANCE:402,DRIVER_SCHEDULE_CONFLICT:409,DRIVER_MUST_BE_ENROUTE:409,ORDER_ISSUE_NOT_OPEN:409,UNAUTHORIZED:401,INVALID_CREDENTIALS:401,DRIVER_NOT_ACTIVE:403,DRIVER_PIN_NOT_CONFIGURED:409,PIN_MUST_BE_4_TO_12_DIGITS:400,STAFF_PIN_NOT_CONFIGURED:503,CHILD_RESTRAINTS_REQUIRE_LARGE_VEHICLE:400,LATE_CANCEL_REQUIRES_DISPATCH:409,",
    'marketplace HTTP statuses'
  );

  replaceOnce(
    "if(req.method==='POST'&&url.pathname==='/api/client/bookings'){const b=await body(req);const route=routeDecisionWithHandoff(b);if(route.target==='vanclick')return json(res,409,{error:'VANCLICK_HANDOFF_REQUIRED',...route});return json(res,201,await createClientBooking(b));}",
    "if(req.method==='POST'&&url.pathname==='/api/client/bookings'){const b=await body(req);const childExtras=Number(b.childSeatCount||b.childSeats||0)>0||Number(b.boosterCount||b.boosters||0)>0||(['seat','booster'].includes(String(b.childSeat||'').toLowerCase()));if(childExtras)throw new Error('CHILD_RESTRAINTS_REQUIRE_LARGE_VEHICLE');const route=routeDecisionWithHandoff(b);if(route.target==='vanclick')return json(res,409,{error:'VANCLICK_HANDOFF_REQUIRED',...route});return json(res,201,await createClientBooking({...b,childSeats:0}));}",
    'child restraints require Large 5-6'
  );

  replaceOnce(
    "if(req.method==='POST'&&url.pathname==='/api/dispatch/drivers')return json(res,201,await registerDriver(await body(req)));",
    "if(req.method==='POST'&&url.pathname==='/api/dispatch/drivers'){const b=await body(req);const d=await registerDriver(b);if(b.accessPin)await configureDriverPin(d.id,b.accessPin);return json(res,201,d);}",
    'driver creation with PIN'
  );

  replaceOnce(
    "m=url.pathname.match(/^\\/api\\/dispatch\\/drivers\\/([^/]+)\\/verification$/);if(req.method==='POST'&&m)return json(res,200,await setDriverVerification(m[1],await body(req)));",
    "m=url.pathname.match(/^\\/api\\/dispatch\\/drivers\\/([^/]+)\\/verification$/);if(req.method==='POST'&&m)return json(res,200,await setDriverVerification(m[1],await body(req)));\n      m=url.pathname.match(/^\\/api\\/dispatch\\/drivers\\/([^/]+)\\/pin$/);if(req.method==='POST'&&m){const b=await body(req);return json(res,200,await configureDriverPin(m[1],b.pin));}",
    'driver PIN endpoint'
  );

  replaceOnce(
    "m=url.pathname.match(/^\\/api\\/dispatch\\/orders\\/([^/]+)\\/cancel$/);if(req.method==='POST'&&m)return json(res,200,await adminCancelOrder(m[1],await body(req)));",
    "m=url.pathname.match(/^\\/api\\/dispatch\\/orders\\/([^/]+)\\/cancel$/);if(req.method==='POST'&&m)return json(res,200,await adminCancelOrder(m[1],await body(req)));\n      m=url.pathname.match(/^\\/api\\/dispatch\\/orders\\/([^/]+)\\/issue\\/resolve$/);if(req.method==='POST'&&m)return json(res,200,await adminResolveIssue(m[1],await body(req)));",
    'dispatch issue resolve endpoint'
  );

  replaceOnce(
    "m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)\\/orders\\/([^/]+)\\/enroute$/);if(req.method==='POST'&&m)return json(res,200,await driverConfirmEnRoute(m[2],m[1]));",
    "m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)\\/orders\\/([^/]+)\\/issue$/);if(req.method==='POST'&&m)return json(res,200,await driverReportIssue(m[2],m[1],await body(req)));\n      m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)\\/orders\\/([^/]+)\\/enroute$/);if(req.method==='POST'&&m)return json(res,200,await driverConfirmEnRoute(m[2],m[1]));",
    'driver issue endpoint'
  );
});


patchFile('apps/driver/public/index.html',({replaceOnce})=>{
  replaceOnce(
    '<div class="wallet"><span>יתרה</span><b><span id="wallet">—</span> ₪</b></div>',
    '<div class="wallet"><span>יתרת קרדיטים</span><b><span id="wallet">—</span> קרדיטים</b></div>',
    'driver wallet credits label'
  );
  replaceOnce(
    '<section id="walletPane" class="pane"><div class="panel"><h2>טעינת יתרה</h2><p>Bit או מזומן. היתרה נכנסת לשימוש רק אחרי אישור הדיספצ׳ר.</p><form id="topup" class="topup"><input name="amount" type="number" min="1" placeholder="סכום" required><select name="method"><option value="bit">Bit</option><option value="cash">מזומן</option></select><button>שלח לאישור</button></form><div id="topupStatus"></div><div id="topupHistory"></div></div></section>',
    '<section id="walletPane" class="pane"><div class="panel"><h2>רכישת קרדיטים</h2><p>1 קרדיט = 1 ₪ לפני מע״מ. לתשלום מתווסף מע״מ 18%; הקרדיטים נכנסים לשימוש רק אחרי אישור הדיספצ׳ר.</p><form id="topup" class="topup"><input name="amount" type="number" min="1" step="1" placeholder="מספר קרדיטים" required><select name="method"><option value="bit">Bit</option><option value="cash">מזומן</option></select><button>שלח לאישור</button></form><div id="topupCalc">לדוגמה: 100 קרדיטים = 100 ₪ + מע״מ 18% = 118 ₪ לתשלום</div><div id="topupStatus"></div><div id="topupHistory"></div></div></section>',
    'driver credit top-up VAT disclosure'
  );
});


const authModule=fs.readFileSync(path.join(__dirname,'marketplace-auth.js'),'utf8');
fs.writeFileSync(path.join(root,'src','auth.js'),authModule);
const driverUi=fs.readFileSync(path.join(__dirname,'marketplace-driver-app.js'),'utf8');
const dispatchUi=fs.readFileSync(path.join(__dirname,'marketplace-dispatch-app.js'),'utf8');
const marketplaceCss=fs.readFileSync(path.join(__dirname,'marketplace-ui.css'),'utf8');

fs.writeFileSync(path.join(root,'apps','driver','public','app.js'),driverUi);
fs.writeFileSync(path.join(root,'apps','dispatch','public','app.js'),dispatchUi);
{
  const file=path.join(root,'apps','dispatch','public','index.html');
  let html=fs.readFileSync(file,'utf8');
  const oldRef='./app.js';
  const newRef='./app.js?v=20261008-mobileauth1';
  if(!html.includes(oldRef) && !html.includes(newRef)) throw new Error('MARKETPLACE_V1_PATCH_MISS: dispatch app.js cache-bust');
  html=html.replace(oldRef,newRef);
  fs.writeFileSync(file,html);
}

for(const rel of [path.join('apps','driver','public','app.css'),path.join('apps','dispatch','public','app.css')]){
  const file=path.join(root,rel);
  let css=fs.readFileSync(file,'utf8');
  css=css.replace(/\/\* MARKETPLACE_V1_UI \*\/[\s\S]*$/,'').trimEnd()+'\n'+marketplaceCss+'\n';
  fs.writeFileSync(file,css);
}

{
  const file=path.join(root,'apps','client','public','app.js');
  let client=fs.readFileSync(file,'utf8');
  const old='הבקשה עוברת לאישור ושיבוץ נהג.';
  const next='ההזמנה התקבלה ונמצאת בבדיקת המוקד. לאחר אישור היא תפורסם לנהגים.';
  if(!client.includes(old) && !client.includes(next)) throw new Error('MARKETPLACE_V1_PATCH_MISS: client confirmation copy');
  client=client.replace(old,next);
  client=client.replace("pool:'אושרה · מחפשים נהג'","pool:'מחפשים נהג'");
  client += "\n;(()=>{for(const id of ['childSeats','childSeatCount','boosterCount','boosters']){const el=document.getElementById(id);if(!el)continue;try{el.value='0'}catch{}const wrap=el.closest('label,.field,.form-row,.grid-item');if(wrap)wrap.hidden=true;else el.hidden=true}})();\n";
  fs.writeFileSync(file,client);
}

console.log('MARKETPLACE_V1_PATCH_APPLIED', JSON.stringify({
  staffGateBeforePool:true,
  fareFinalizedAtBooking:true,
  commissionFinalizedAtBooking:true,
  idempotentClaim:true,
  scheduleConflictGuard:true,
  exceptionQueue:true,
  completionStateGuard:true,
  commissionMetrics:true,
  driverCancellationMetrics:true,
  creditTopupVat18:true,
  roleBasedAuth:true,
  highVolumeDriverUi:true,
  exceptionFirstDispatchUi:true
}));

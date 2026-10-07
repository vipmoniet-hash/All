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
    "id:id('ord'), bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'awaiting_dispatch', tripAt,",
    "id:id('ord'), bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'pool', tripAt,",
    'new booking status'
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
    "return { bookingCode:code, bookingGroupId:group, status:'received', ridePaymentMethod:common.ridePaymentMethod,",
    "return { bookingCode:code, bookingGroupId:group, status:'pool', ridePaymentMethod:common.ridePaymentMethod,",
    'booking response status'
  );

  replaceOnce(
    "const pool=db.orders.filter(o=>o.status==='pool').sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)).map(sanitizeOrderForPool);",
    "const pool=db.orders.filter(o=>o.status==='pool').sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)).map(o=>marketplacePoolView(db,driver,o));",
    'decorate driver pool eligibility'
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
    netCommissionPaid:Number((commissionDebited-commissionRefunded).toFixed(2))
  };
  return {driver:{id:driver.id,name:driver.name,wallet:driver.wallet,reliability:driver.reliability,vehiclePlate:driver.vehiclePlate||'',completedTrips:Number(driver.completedTrips||allCompleted.length)},pool,mine,completed,topups,stats};`,
    'driver finance stats'
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
    "ORDER_ALREADY_TAKEN:409,INSUFFICIENT_WALLET_BALANCE:402,LATE_CANCEL_REQUIRES_DISPATCH:409,",
    "ORDER_ALREADY_TAKEN:409,INSUFFICIENT_WALLET_BALANCE:402,DRIVER_SCHEDULE_CONFLICT:409,DRIVER_MUST_BE_ENROUTE:409,ORDER_ISSUE_NOT_OPEN:409,LATE_CANCEL_REQUIRES_DISPATCH:409,",
    'marketplace HTTP statuses'
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


const driverUi=fs.readFileSync(path.join(__dirname,'marketplace-driver-app.js'),'utf8');
const dispatchUi=fs.readFileSync(path.join(__dirname,'marketplace-dispatch-app.js'),'utf8');
const marketplaceCss=fs.readFileSync(path.join(__dirname,'marketplace-ui.css'),'utf8');

fs.writeFileSync(path.join(root,'apps','driver','public','app.js'),driverUi);
fs.writeFileSync(path.join(root,'apps','dispatch','public','app.js'),dispatchUi);

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
  const next='ההזמנה פורסמה לנהגים מאומתים. ברגע שנהג ייקח אותה, פרטיו יופיעו כאן.';
  if(!client.includes(old) && !client.includes(next)) throw new Error('MARKETPLACE_V1_PATCH_MISS: client confirmation copy');
  client=client.replace(old,next);
  client=client.replace("pool:'אושרה · מחפשים נהג'","pool:'מחפשים נהג'");
  fs.writeFileSync(file,client);
}

console.log('MARKETPLACE_V1_PATCH_APPLIED', JSON.stringify({
  directToPool:true,
  fareFinalizedAtBooking:true,
  commissionFinalizedAtBooking:true,
  idempotentClaim:true,
  scheduleConflictGuard:true,
  exceptionQueue:true,
  completionStateGuard:true,
  commissionMetrics:true,
  highVolumeDriverUi:true,
  exceptionFirstDispatchUi:true
}));

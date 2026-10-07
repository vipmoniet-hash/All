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
    "ORDER_ALREADY_TAKEN:409,INSUFFICIENT_WALLET_BALANCE:402,DRIVER_SCHEDULE_CONFLICT:409,LATE_CANCEL_REQUIRES_DISPATCH:409,",
    'schedule conflict HTTP status'
  );
});

console.log('MARKETPLACE_V1_PATCH_APPLIED', JSON.stringify({
  directToPool:true,
  fareFinalizedAtBooking:true,
  commissionFinalizedAtBooking:true,
  idempotentClaim:true,
  scheduleConflictGuard:true
}));

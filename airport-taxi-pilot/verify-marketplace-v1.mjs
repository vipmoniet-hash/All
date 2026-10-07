import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] || 'app';
const persistence = await import(pathToFileURL(path.resolve(root,'src','persistence.js')).href + '?marketplace-test=1');
const service = await import(pathToFileURL(path.resolve(root,'src','service.js')).href + '?marketplace-test=1');

const seed = {
  drivers: [
    {
      id:'drv-test-001',
      name:'נהג בדיקה',
      phone:'0500000001',
      wallet:500,
      reliability:100,
      active:true,
      verified:true,
      licenseNumber:'TEST-001',
      vehiclePlate:'00-000-01'
    }
  ],
  orders:[],
  topups:[],
  ledger:[],
  events:[]
};

function request(tripAt, customerName='לקוח בדיקה') {
  return {
    passengers:2,
    largeLuggage:0,
    smallLuggage:0,
    paymentMethod:'bit',
    customerName,
    customerPhone:'0501234567',
    fromArea:'ראשון לציון',
    toArea:'נתב״ג',
    tripAt,
    exactPickup:'הרצל 1 ראשון לציון',
    exactDropoff:'נתב״ג טרמינל 3',
    notes:'marketplace regression'
  };
}

await persistence.resetDb(seed);

const booking = await service.createClientBooking(request('2026-10-08T11:00'));
assert.equal(booking.orders.length,1,'single booking creates one ride');
assert.equal(booking.orders[0].status,'pool','valid Taxi 1-4 booking must enter driver pool immediately');

let state = await service.listDriverState('drv-test-001');
assert.equal(state.pool.length,1,'driver must immediately see the new ride');
assert.equal(state.pool[0].id,booking.orders[0].id,'pool ride id matches created ride');
assert.equal(state.pool[0].fare,170,'pool ride has final fare before claim');
assert.equal(state.pool[0].commission,10,'pool ride has commission before claim');
assert.equal(state.pool[0].driverNet,160,'pool ride shows driver net before claim');

console.log('MARKETPLACE_V1_AUTOPUBLISH_OK', JSON.stringify({
  orderId:booking.orders[0].id,
  status:booking.orders[0].status,
  fare:state.pool[0].fare,
  commission:state.pool[0].commission,
  driverNet:state.pool[0].driverNet
}));

const second = await service.createClientBooking(request('2026-10-08T11:30','לקוח בדיקה 2'));
const firstOrderId=booking.orders[0].id;
const secondOrderId=second.orders[0].id;

const claim1 = await service.buyOrder(firstOrderId,'drv-test-001');
assert.equal(claim1.wallet,490,'first claim debits commission exactly once');
assert.equal(claim1.order.assignedDriverId,'drv-test-001','first claim assigns driver');

const retry = await service.buyOrder(firstOrderId,'drv-test-001');
assert.equal(retry.wallet,490,'same-driver retry must not debit commission again');
assert.equal(retry.order.assignedDriverId,'drv-test-001','same-driver retry returns existing ownership');

let db=await persistence.readDb();
assert.equal(db.ledger.filter(x=>x.orderId===firstOrderId&&x.type==='commission_debit').length,1,'idempotent claim produces one commission debit');

state = await service.listDriverState('drv-test-001');
const conflict=state.pool.find(x=>x.id===secondOrderId);
assert.ok(conflict,'overlapping unclaimed ride stays visible in pool');
assert.equal(conflict.canClaim,false,'overlapping ride is visibly not claimable');
assert.equal(conflict.claimBlockReason,'schedule_conflict','overlapping ride explains schedule conflict');

await assert.rejects(
  service.buyOrder(secondOrderId,'drv-test-001'),
  err=>err?.message==='DRIVER_SCHEDULE_CONFLICT',
  'server must reject overlapping claim even if UI is bypassed'
);

db=await persistence.readDb();
assert.equal(db.drivers.find(x=>x.id==='drv-test-001').wallet,490,'rejected conflict does not debit wallet');
assert.equal(db.orders.find(x=>x.id===secondOrderId).status,'pool','rejected conflict leaves ride in pool');

console.log('MARKETPLACE_V1_CLAIM_SAFETY_OK', JSON.stringify({
  idempotentWallet:retry.wallet,
  commissionDebits:db.ledger.filter(x=>x.orderId===firstOrderId&&x.type==='commission_debit').length,
  conflictOrderId:secondOrderId,
  conflictReason:conflict.claimBlockReason
}));


await assert.rejects(
  service.driverCompleteOrder(firstOrderId,'drv-test-001',new Date('2026-10-08T07:40:00Z')),
  err=>err?.message==='DRIVER_MUST_BE_ENROUTE',
  'driver cannot complete a ride before marking en route'
);

const issue = await service.driverReportIssue(
  firstOrderId,
  'drv-test-001',
  {type:'client_unreachable',note:'אין מענה בטלפון'},
  new Date('2026-10-08T07:35:00Z')
);
assert.equal(issue.status,'open','driver issue opens an exception');
assert.equal(issue.type,'client_unreachable','issue type is retained');

let admin = await service.listAdminState(new Date('2026-10-08T07:35:00Z'));
assert.ok(admin.attention.some(x=>x.orderId===firstOrderId&&x.kind==='open_issue'),'open driver issue appears in dispatch attention');

const resolved = await service.adminResolveIssue(firstOrderId,{note:'נוצר קשר עם הלקוח'},new Date('2026-10-08T07:38:00Z'));
assert.equal(resolved.status,'resolved','dispatcher can resolve driver issue');

admin = await service.listAdminState(new Date('2026-10-08T07:38:00Z'));
assert.ok(!admin.attention.some(x=>x.orderId===firstOrderId&&x.kind==='open_issue'),'resolved issue leaves open-issue attention queue');

const enroute = await service.driverConfirmEnRoute(firstOrderId,'drv-test-001',new Date('2026-10-08T07:30:00Z'));
assert.equal(enroute.status,'driver_enroute','driver can mark en route near pickup');

const completed = await service.driverCompleteOrder(firstOrderId,'drv-test-001',new Date('2026-10-08T08:10:00Z'));
assert.equal(completed.status,'completed','en-route ride can be completed');

db=await persistence.readDb();
assert.equal(db.drivers.find(x=>x.id==='drv-test-001').completedTrips,1,'driver completed-trip counter increments');

console.log('MARKETPLACE_V1_EXCEPTION_FLOW_OK', JSON.stringify({
  issueType:issue.type,
  resolved:resolved.status,
  finalStatus:completed.status,
  completedTrips:db.drivers.find(x=>x.id==='drv-test-001').completedTrips
}));

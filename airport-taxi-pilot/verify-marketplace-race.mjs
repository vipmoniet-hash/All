import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.argv[2]||'app';
const persistence=await import(pathToFileURL(path.resolve(root,'src','persistence.js')).href+'?race=1');
const service=await import(pathToFileURL(path.resolve(root,'src','service.js')).href+'?race=1');

const drivers=Array.from({length:12},(_,i)=>({
  id:'race-'+String(i+1).padStart(2,'0'),
  name:'Race Driver '+(i+1),
  phone:'050900'+String(i+1).padStart(4,'0'),
  wallet:100,
  reliability:100,
  active:true,
  verified:true,
  licenseNumber:'RACE-'+(i+1),
  vehiclePlate:'90-'+String(i+1).padStart(3,'0')+'-90'
}));
await persistence.resetDb({drivers,orders:[],topups:[],ledger:[],events:[]});

try{
  const booking=await service.createClientBooking({
    passengers:2,largeLuggage:0,smallLuggage:0,paymentMethod:'cash',
    customerName:'Race Test',customerPhone:'0509990000',
    fromArea:'ראשון לציון',toArea:'נתב״ג',tripAt:'2026-10-13T11:00',
    exactPickup:'Race 1',exactDropoff:'TLV T3'
  });
  const orderId=booking.orders[0].id;

  const attempts=await Promise.allSettled(drivers.map(d=>service.buyOrder(orderId,d.id)));
  const winners=attempts.filter(x=>x.status==='fulfilled');
  const losers=attempts.filter(x=>x.status==='rejected');

  assert.equal(winners.length,1,'exactly one concurrent driver wins the ride');
  assert.equal(losers.length,drivers.length-1,'all other concurrent drivers lose the ride');
  assert.ok(losers.every(x=>x.reason?.message==='ORDER_ALREADY_TAKEN'),'losers receive ORDER_ALREADY_TAKEN');

  const db=await persistence.readDb();
  const order=db.orders.find(x=>x.id===orderId);
  assert.ok(order.assignedDriverId,'race winner is persisted on order');
  assert.equal(db.ledger.filter(x=>x.orderId===orderId&&x.type==='commission_debit').length,1,'concurrent race creates one commission debit');
  assert.equal(db.drivers.filter(d=>d.wallet<100).length,1,'only winning driver wallet is debited');

  console.log('MARKETPLACE_V1_CONCURRENT_CLAIM_OK',JSON.stringify({
    contenders:drivers.length,
    winners:winners.length,
    assignedDriverId:order.assignedDriverId,
    commissionDebits:db.ledger.filter(x=>x.orderId===orderId&&x.type==='commission_debit').length
  }));
}finally{
  await persistence.resetDb();
}

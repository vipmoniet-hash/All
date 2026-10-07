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

await persistence.resetDb(seed);

const booking = await service.createClientBooking({
  passengers:2,
  largeLuggage:0,
  smallLuggage:0,
  paymentMethod:'bit',
  customerName:'לקוח בדיקה',
  customerPhone:'0501234567',
  fromArea:'ראשון לציון',
  toArea:'נתב״ג',
  tripAt:'2026-10-08T11:00',
  exactPickup:'הרצל 1 ראשון לציון',
  exactDropoff:'נתב״ג טרמינל 3',
  notes:'marketplace regression'
});

assert.equal(booking.orders.length,1,'single booking creates one ride');
assert.equal(booking.orders[0].status,'pool','valid Taxi 1-4 booking must enter driver pool immediately');

const state = await service.listDriverState('drv-test-001');
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

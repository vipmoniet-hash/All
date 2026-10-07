const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';
const rel='src/service.js';
const file=path.join(root,rel);
let src=fs.readFileSync(file,'utf8');

function replaceOnce(search,replacement,label){
  const before=src;
  src=src.replace(search,replacement);
  if(src===before) throw new Error('MARKETPLACE_V1_PATCH_MISS: '+label);
}

replaceOnce(
  "id:id('ord'), bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'awaiting_dispatch', tripAt,",
  "id:id('ord'), bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'pool', tripAt,",
  'new booking status'
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

fs.writeFileSync(file,src);
console.log('MARKETPLACE_V1_PATCH_APPLIED', JSON.stringify({
  directToPool:true,
  fareFinalizedAtBooking:true,
  commissionFinalizedAtBooking:true
}));

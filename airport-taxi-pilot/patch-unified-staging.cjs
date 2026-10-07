const fs=require('fs');
const path=require('path');

const root=process.argv[2]||'app';

function patchFile(rel,fn){
  const file=path.join(root,rel);
  let src=fs.readFileSync(file,'utf8');
  const api={
    replaceOnce(search,replacement,label){
      const before=src;
      src=src.replace(search,replacement);
      if(src===before)throw new Error('UNIFIED_PATCH_MISS: '+rel+' :: '+label);
    },
    get(){return src;}
  };
  fn(api);
  fs.writeFileSync(file,api.get());
}

const source=path.join(__dirname,'unified-staging');
const target=path.join(root,'apps','unified','public');
fs.rmSync(target,{recursive:true,force:true});
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.cpSync(source,target,{recursive:true});

patchFile('src/persistence.js',({replaceOnce})=>{
  replaceOnce(
    "sessions: Array.isArray(db?.sessions) ? db.sessions : []",
    "sessions: Array.isArray(db?.sessions) ? db.sessions : [], largeOrders: Array.isArray(db?.largeOrders) ? db.largeOrders : []",
    'large shadow collection'
  );
});

patchFile('src/service.js',({replaceOnce})=>{
  replaceOnce(
    "id:id('ord'), bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'awaiting_dispatch', tripAt,",
    "id:id('ord'), serviceType:'taxi_1_4', bookingCode, bookingGroupId, leg, createdAt:new Date().toISOString(), status:'awaiting_dispatch', tripAt,",
    'small service type'
  );

  replaceOnce(
    "orders:orders.map(o=>({id:o.id,leg:o.leg,status:o.status,tripAt:o.tripAt,fromArea:o.fromArea,toArea:o.toArea,quotedFare:o.quotedFare,flightNumber:o.flightNumber}))",
    "orders:orders.map(o=>({id:o.id,serviceType:o.serviceType,leg:o.leg,status:o.status,tripAt:o.tripAt,fromArea:o.fromArea,toArea:o.toArea,quotedFare:o.quotedFare,flightNumber:o.flightNumber}))",
    'small booking response service type'
  );

  replaceOnce(
    "export async function createClientRequest(input){ const b=await createClientBooking(input);",
    `export async function createLargeShadowBooking(input){
  const passengers=Math.round(Number(input.passengers));
  if(!Number.isFinite(passengers)||passengers<1||passengers>6)throw new Error('LARGE_PASSENGERS_INVALID');
  const largeLuggage=assertLuggageCount(input.largeLuggage??0,'LARGE_LUGGAGE_INVALID');
  const smallLuggage=assertLuggageCount(input.smallLuggage??0,'SMALL_LUGGAGE_INVALID');
  const direction=clean(input.direction,10);
  if(!['to','from'].includes(direction))throw new Error('INVALID_LARGE_DIRECTION');
  const tripAt=normalizeTripAt(input.tripAt);
  const city=requireText(input.city,'CITY_REQUIRED');
  const customerName=requireText(input.customerName,'CUSTOMER_NAME_REQUIRED');
  const customerPhone=requireText(input.customerPhone,'CUSTOMER_PHONE_REQUIRED');
  const exactPickup=requireText(input.exactPickup,'EXACT_PICKUP_REQUIRED');
  const exactDropoff=requireText(input.exactDropoff,'EXACT_DROPOFF_REQUIRED');
  const flightNumber=clean(input.flightNumber,40).toUpperCase();
  if(direction==='from'&&!flightNumber)throw new Error('FLIGHT_NUMBER_REQUIRED_FOR_AIRPORT_PICKUP');
  const order={
    id:id('lg'),bookingCode:publicCode(),serviceType:'large_5_6',shadowOnly:true,status:'awaiting_dispatch',
    createdAt:new Date().toISOString(),tripAt,direction,city,
    fromArea:direction==='from'?'Ben Gurion Airport':city,
    toArea:direction==='from'?city:'Ben Gurion Airport',
    exactPickup,exactDropoff,customerName,customerPhone,passengers,largeLuggage,smallLuggage,
    luggage:largeLuggage+smallLuggage,flightNumber,notes:clean(input.notes,500),fare:null,commission:0,priceState:'shadow_review'
  };
  return transact(db=>{
    db.largeOrders.push(order);
    event(db,order.id,'large_shadow_booking_created','client',{serviceType:'large_5_6'});
    return {...order};
  });
}

export async function createClientRequest(input){ const b=await createClientBooking(input);`,
    'large shadow booking service'
  );

  replaceOnce(
    "orders:db.orders.slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),",
    "orders:db.orders.slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),\n    largeOrders:db.largeOrders.slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),\n    unifiedOrders:[...db.orders,...db.largeOrders].map(o=>({id:o.id,serviceType:o.serviceType||'taxi_1_4',bookingCode:o.bookingCode,status:o.status,tripAt:o.tripAt,fromArea:o.fromArea,toArea:o.toArea,passengers:o.passengers,largeLuggage:o.largeLuggage,smallLuggage:o.smallLuggage,customerName:o.customerName,customerPhone:o.customerPhone,fare:o.fare??o.quotedFare??null,commission:o.commission??0,assignedDriverId:o.assignedDriverId??null,shadowOnly:Boolean(o.shadowOnly)})).sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),",
    'large shadow and unified staff visibility'
  );
});

patchFile('server.js',({replaceOnce})=>{
  replaceOnce(
    "createClientBooking, publishOrder, listAdminState,",
    "createClientBooking, createLargeShadowBooking, publishOrder, listAdminState,",
    'large shadow service import'
  );

  replaceOnce(
    "if(req.method==='GET'&&url.pathname==='/api/auth/status')return json(res,200,{required:marketplaceAuthRequired()});",
    "if(req.method==='GET'&&url.pathname==='/api/auth/status')return json(res,200,{required:marketplaceAuthRequired()});\n      if(req.method==='POST'&&url.pathname==='/api/unified/large/bookings'){enforceBookingRate(req);return json(res,201,await createLargeShadowBooking(await body(req)));}",
    'large shadow HTTP endpoint'
  );

  replaceOnce(
    "for(const [prefix,app] of [['/client','client'],['/driver','driver'],['/dispatch','dispatch']]){",
    "for(const [prefix,app] of [['/client','client'],['/driver','driver'],['/dispatch','dispatch'],['/unified','unified']]){",
    'unified static app route'
  );

  replaceOnce(
    "SERVER_BUSY:503,RATE_LIMITED:429,",
    "SERVER_BUSY:503,RATE_LIMITED:429,LARGE_PASSENGERS_INVALID:400,INVALID_LARGE_DIRECTION:400,CITY_REQUIRED:400,",
    'large shadow HTTP statuses'
  );
});

for(const rel of [
  path.join('apps','unified','public','unified.js'),
  path.join('apps','unified','public','large','large.js'),
  path.join('apps','unified','public','dispatch','dispatch.js')
]){
  require('child_process').execFileSync(process.execPath,['--check',path.join(root,rel)],{stdio:'inherit'});
}

console.log('UNIFIED_VANCLICK_PATCH_APPLIED',JSON.stringify({
  staticUnified:true,
  largeShadowOrders:true,
  productionDispatchCalls:false,
  smallDriverIsolation:true
}));

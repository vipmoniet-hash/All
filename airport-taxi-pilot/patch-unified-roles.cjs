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
      if(src===before)throw new Error('UNIFIED_ROLE_PATCH_MISS: '+rel+' :: '+label);
    },
    get(){return src;}
  };
  fn(api);
  fs.writeFileSync(file,api.get());
}

patchFile('src/service.js',({replaceOnce})=>{
  replaceOnce(
    "    largeOrders:db.largeOrders.slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),\n    unifiedOrders:[...db.orders,...db.largeOrders].map(o=>({id:o.id,serviceType:o.serviceType||'taxi_1_4',bookingCode:o.bookingCode,status:o.status,tripAt:o.tripAt,fromArea:o.fromArea,toArea:o.toArea,passengers:o.passengers,largeLuggage:o.largeLuggage,smallLuggage:o.smallLuggage,customerName:o.customerName,customerPhone:o.customerPhone,fare:o.fare??o.quotedFare??null,commission:o.commission??0,assignedDriverId:o.assignedDriverId??null,shadowOnly:Boolean(o.shadowOnly)})).sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt)),\n",
    "",
    'remove cross-line data from small dispatch state'
  );

  const roleFns=[
    "function largeOrderOrThrow(db,orderId){const o=(db.largeOrders||[]).find(x=>x.id===orderId);if(!o)throw new Error('ORDER_NOT_FOUND');return o;}",
    "",
    "export async function approveLargeOrder(orderId,input={},actor='dispatcher'){return transact(db=>{const o=largeOrderOrThrow(db,orderId);if(!['awaiting_dispatch','confirmed'].includes(o.status))throw new Error('ORDER_NOT_APPROVABLE');const fare=Number(input.fare);if(!Number.isFinite(fare)||fare<=0)throw new Error('FARE_MUST_BE_POSITIVE');o.fare=Number(fare.toFixed(2));o.commission=0;o.status='confirmed';o.confirmedAt=new Date().toISOString();event(db,o.id,'large_order_confirmed',actor,{fare:o.fare});return {...o};});}",
    "",
    "export async function assignLargeOrder(orderId,input={},actor='dispatcher'){return transact(db=>{const o=largeOrderOrThrow(db,orderId);if(o.status!=='confirmed')throw new Error('ORDER_NOT_ASSIGNABLE');o.assignedDriverName=requireText(input.driverName,'DRIVER_NAME_REQUIRED');o.assignedDriverPhone=requireText(input.driverPhone,'DRIVER_PHONE_REQUIRED');o.vehiclePlate=clean(input.vehiclePlate,40);o.status='assigned';o.assignedAt=new Date().toISOString();event(db,o.id,'large_driver_assigned',actor,{driverName:o.assignedDriverName});return {...o};});}",
    "",
    "export async function largeOrderEnroute(orderId,actor='dispatcher'){return transact(db=>{const o=largeOrderOrThrow(db,orderId);if(o.status!=='assigned')throw new Error('ORDER_NOT_ASSIGNED');o.status='driver_enroute';o.driverConfirmedAt=new Date().toISOString();event(db,o.id,'large_driver_enroute',actor,{driverName:o.assignedDriverName});return {...o};});}",
    "",
    "export async function completeLargeOrder(orderId,actor='dispatcher'){return transact(db=>{const o=largeOrderOrThrow(db,orderId);if(o.status!=='driver_enroute')throw new Error('DRIVER_MUST_BE_ENROUTE');o.status='completed';o.completedAt=new Date().toISOString();event(db,o.id,'large_trip_completed',actor,{driverName:o.assignedDriverName});return {...o};});}",
    "",
    "export async function cancelLargeOrder(orderId,input={},actor='dispatcher'){return transact(db=>{const o=largeOrderOrThrow(db,orderId);if(['completed','cancelled'].includes(o.status))throw new Error('ORDER_NOT_CANCELLABLE');o.status='cancelled';o.cancelledAt=new Date().toISOString();o.cancellationReason=clean(input.reason,240)||'staff_cancelled';event(db,o.id,'large_order_cancelled',actor,{reason:o.cancellationReason});return {...o};});}",
    "",
    "export async function listLargeDispatchState() {",
    "  const db=await readDb();",
    "  const orders=(db.largeOrders||[]).slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt));",
    "  const counts={};for(const o of orders)counts[o.status]=(counts[o.status]||0)+1;",
    "  const orderIds=new Set(orders.map(o=>o.id));",
    "  return {serviceType:'large_5_6',orders,counts,events:(db.events||[]).filter(e=>orderIds.has(e.orderId)).slice(-500).reverse()};",
    "}",
    "",
    "export async function listUnifiedAdminState() {",
    "  const small=await listAdminState();",
    "  const db=await readDb();",
    "  const largeOrders=(db.largeOrders||[]).slice().sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt));",
    "  const unifiedOrders=[...db.orders,...largeOrders].map(o=>({",
    "    id:o.id,serviceType:o.serviceType||'taxi_1_4',bookingCode:o.bookingCode,status:o.status,tripAt:o.tripAt,",
    "    fromArea:o.fromArea,toArea:o.toArea,passengers:o.passengers,largeLuggage:o.largeLuggage,smallLuggage:o.smallLuggage,",
    "    customerName:o.customerName,customerPhone:o.customerPhone,fare:o.fare??o.quotedFare??null,commission:o.commission??0,",
    "    assignedDriverId:o.assignedDriverId??null,shadowOnly:Boolean(o.shadowOnly)",
    "  })).sort((a,b)=>new Date(a.tripAt)-new Date(b.tripAt));",
    "  const largeCounts={};for(const o of largeOrders)largeCounts[o.status]=(largeCounts[o.status]||0)+1;",
    "  const customerMap=new Map();",
    "  const canonicalPhone=value=>{const digits=String(value||'').replace(/\\D/g,'');return digits.startsWith('972')&&digits.length>=11?'0'+digits.slice(3):digits;};",
    "  for(const o of [...db.orders,...largeOrders]){const key=canonicalPhone(o.customerPhone);if(!key)continue;let p=customerMap.get(key);if(!p){p={customerKey:key,customerName:o.customerName||'',customerPhone:o.customerPhone||'',totalTrips:0,completedTrips:0,serviceTypes:[],firstTripAt:o.tripAt||null,lastTripAt:o.tripAt||null,orderIds:[]};customerMap.set(key,p);}p.totalTrips++;if(o.status==='completed')p.completedTrips++;if(!p.serviceTypes.includes(o.serviceType||'taxi_1_4'))p.serviceTypes.push(o.serviceType||'taxi_1_4');p.orderIds.push(o.id);if(o.tripAt&&(!p.firstTripAt||new Date(o.tripAt)<new Date(p.firstTripAt)))p.firstTripAt=o.tripAt;if(o.tripAt&&(!p.lastTripAt||new Date(o.tripAt)>=new Date(p.lastTripAt))){p.lastTripAt=o.tripAt;p.customerName=o.customerName||p.customerName;p.customerPhone=o.customerPhone||p.customerPhone;}}",
    "  const customerProfiles=[...customerMap.values()].sort((a,b)=>new Date(b.lastTripAt||0)-new Date(a.lastTripAt||0));",
    "  const serviceByOrder=new Map([...db.orders,...largeOrders].map(o=>[o.id,o.serviceType||'taxi_1_4']));",
    "  const unifiedJournal=(db.events||[]).slice(-1000).map(e=>({...e,serviceType:serviceByOrder.get(e.orderId)||'system'})).reverse();",
    "  return {...small,largeOrders,largeCounts,unifiedOrders,customerProfiles,unifiedJournal};",
    "}",
    ""
  ].join('\n');

  replaceOnce(
    "export async function driverCompleteOrder(orderId,driverId,now=new Date()){return transact(db=>{",
    roleFns+"export async function driverCompleteOrder(orderId,driverId,now=new Date()){return transact(db=>{",
    'role-scoped staff states'
  );
});

patchFile('server.js',({replaceOnce})=>{
  replaceOnce(
    "listAdminState, listDriverState, buyOrder,",
    "listAdminState, listLargeDispatchState, listUnifiedAdminState, approveLargeOrder, assignLargeOrder, largeOrderEnroute, completeLargeOrder, cancelLargeOrder, listDriverState, buyOrder,",
    'role-scoped state imports'
  );

  replaceOnce(
    "async function enforceMarketplaceAuth(req,url){if(!marketplaceAuthRequired())return;if(url.pathname.startsWith('/api/auth/'))return;if(url.pathname.startsWith('/api/dispatch/')){const s=await sessionForToken(bearerToken(req));if(!s||!['admin','dispatch'].includes(s.role))throw new Error('UNAUTHORIZED');return;}const m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)/);if(m){const s=await sessionForToken(bearerToken(req));if(!s||s.role!=='driver'||s.driverId!==decodeURIComponent(m[1]))throw new Error('UNAUTHORIZED');}}",
    "async function enforceMarketplaceAuth(req,url){if(!marketplaceAuthRequired())return null;if(url.pathname.startsWith('/api/auth/'))return null;const s=await sessionForToken(bearerToken(req));const staffRoles=['admin','dispatcher'];if(url.pathname.startsWith('/api/dispatch/')){if(!s)throw new Error('UNAUTHORIZED');if(!staffRoles.includes(s.role))throw new Error('FORBIDDEN');return s;}if(url.pathname.startsWith('/api/unified/admin/')){if(!s)throw new Error('UNAUTHORIZED');if(!staffRoles.includes(s.role))throw new Error('FORBIDDEN');return s;}if(url.pathname.startsWith('/api/unified/large/')){if(!s)throw new Error('UNAUTHORIZED');if(!staffRoles.includes(s.role))throw new Error('FORBIDDEN');return s;}if(url.pathname.startsWith('/api/unified/driver/')){if(!s)throw new Error('UNAUTHORIZED');if(s.role!=='driver'||!s.driverId)throw new Error('FORBIDDEN');return s;}const m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)/);if(m){if(!s)throw new Error('UNAUTHORIZED');if(s.role!=='driver'||s.driverId!==decodeURIComponent(m[1]))throw new Error('FORBIDDEN');return s;}return s;}",
    'server-enforced staff scopes'
  );

  replaceOnce(
    "UNAUTHORIZED:401,INVALID_CREDENTIALS:401,",
    "UNAUTHORIZED:401,FORBIDDEN:403,ORDER_NOT_APPROVABLE:409,ORDER_NOT_ASSIGNABLE:409,INVALID_CREDENTIALS:401,",
    'forbidden status'
  );

  replaceOnce(
    "      await enforceMarketplaceAuth(req,url);",
    "      const staffSession=await enforceMarketplaceAuth(req,url);\n      let driverPreviewMatch=url.pathname.match(/^\\/api\\/unified\\/admin\\/driver-preview\\/([^/]+)$/);if(req.method==='GET'&&driverPreviewMatch){if(staffSession?.role!=='admin')throw new Error('FORBIDDEN');const preview=await listDriverState(decodeURIComponent(driverPreviewMatch[1]));return json(res,200,{...preview,previewMode:true});}\n      if(req.method==='GET'&&url.pathname==='/api/unified/driver/state'){if(!staffSession?.driverId)throw new Error('FORBIDDEN');return json(res,200,await listDriverState(staffSession.driverId));}\n      if(req.method==='POST'&&url.pathname==='/api/unified/driver/topups'){if(!staffSession?.driverId)throw new Error('FORBIDDEN');const b=await body(req);return json(res,201,await requestDriverTopup(staffSession.driverId,b.amount,b.method||'bit'));}\n      let unifiedDriverMatch=url.pathname.match(/^\\/api\\/unified\\/driver\\/orders\\/([^/]+)\\/(claim|confirm|problem|complete)$/);if(req.method==='POST'&&unifiedDriverMatch){if(!staffSession?.driverId)throw new Error('FORBIDDEN');const orderId=unifiedDriverMatch[1],action=unifiedDriverMatch[2],b=await body(req);if(action==='claim')return json(res,200,await buyOrder(orderId,staffSession.driverId));if(action==='confirm')return json(res,200,await driverConfirmEnRoute(orderId,staffSession.driverId));if(action==='problem')return json(res,200,await driverReportIssue(orderId,staffSession.driverId,{type:b.type||'other',note:b.note||'VanClick Driver'}));if(action==='complete')return json(res,200,await driverCompleteOrder(orderId,staffSession.driverId));}\n      if(req.method==='GET'&&url.pathname==='/api/unified/large/state')return json(res,200,await listLargeDispatchState());\n      if(req.method==='GET'&&url.pathname==='/api/unified/admin/state')return json(res,200,await listUnifiedAdminState());\n      let largeMatch=url.pathname.match(/^\\/api\\/unified\\/large\\/orders\\/([^/]+)\\/(approve|assign|enroute|complete|cancel)$/);if(req.method==='POST'&&largeMatch){const orderId=largeMatch[1],action=largeMatch[2],actor=staffSession?.role||'dispatcher',b=await body(req);if(action==='approve')return json(res,200,await approveLargeOrder(orderId,b,actor));if(action==='assign')return json(res,200,await assignLargeOrder(orderId,b,actor));if(action==='enroute')return json(res,200,await largeOrderEnroute(orderId,actor));if(action==='complete')return json(res,200,await completeLargeOrder(orderId,actor));if(action==='cancel')return json(res,200,await cancelLargeOrder(orderId,b,actor));}",
    'role-scoped state routes'
  );
});

console.log('UNIFIED_ROLE_PATCH_APPLIED',JSON.stringify({
  adminScope:'owner_all',
  dispatcherScope:'both_lines_operational',
  ownerOnlyAdminControls:true,
  serverEnforced:true
}));

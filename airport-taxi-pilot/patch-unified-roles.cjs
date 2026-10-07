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
    "  return {...small,largeOrders,largeCounts,unifiedOrders};",
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
    "listAdminState, listLargeDispatchState, listUnifiedAdminState, listDriverState, buyOrder,",
    'role-scoped state imports'
  );

  replaceOnce(
    "async function enforceMarketplaceAuth(req,url){if(!marketplaceAuthRequired())return;if(url.pathname.startsWith('/api/auth/'))return;if(url.pathname.startsWith('/api/dispatch/')){const s=await sessionForToken(bearerToken(req));if(!s||!['admin','dispatch'].includes(s.role))throw new Error('UNAUTHORIZED');return;}const m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)/);if(m){const s=await sessionForToken(bearerToken(req));if(!s||s.role!=='driver'||s.driverId!==decodeURIComponent(m[1]))throw new Error('UNAUTHORIZED');}}",
    "async function enforceMarketplaceAuth(req,url){if(!marketplaceAuthRequired())return null;if(url.pathname.startsWith('/api/auth/'))return null;const s=await sessionForToken(bearerToken(req));if(url.pathname.startsWith('/api/dispatch/')){if(!s)throw new Error('UNAUTHORIZED');if(!['admin','dispatcher_1_4'].includes(s.role))throw new Error('FORBIDDEN');return s;}if(url.pathname.startsWith('/api/unified/admin/')){if(!s)throw new Error('UNAUTHORIZED');if(s.role!=='admin')throw new Error('FORBIDDEN');return s;}if(url.pathname.startsWith('/api/unified/large/')){if(!s)throw new Error('UNAUTHORIZED');if(!['admin','dispatcher_5_6'].includes(s.role))throw new Error('FORBIDDEN');return s;}const m=url.pathname.match(/^\\/api\\/drivers\\/([^/]+)/);if(m){if(!s)throw new Error('UNAUTHORIZED');if(s.role!=='driver'||s.driverId!==decodeURIComponent(m[1]))throw new Error('FORBIDDEN');return s;}return s;}",
    'server-enforced staff scopes'
  );

  replaceOnce(
    "UNAUTHORIZED:401,INVALID_CREDENTIALS:401,",
    "UNAUTHORIZED:401,FORBIDDEN:403,INVALID_CREDENTIALS:401,",
    'forbidden status'
  );

  replaceOnce(
    "      await enforceMarketplaceAuth(req,url);",
    "      await enforceMarketplaceAuth(req,url);\n      if(req.method==='GET'&&url.pathname==='/api/unified/large/state')return json(res,200,await listLargeDispatchState());\n      if(req.method==='GET'&&url.pathname==='/api/unified/admin/state')return json(res,200,await listUnifiedAdminState());",
    'role-scoped state routes'
  );
});

console.log('UNIFIED_ROLE_PATCH_APPLIED',JSON.stringify({
  adminScope:'all',
  dispatcher1to4:'taxi_1_4',
  dispatcher5to6:'large_5_6',
  serverEnforced:true
}));

const fs=require('fs');
const path=require('path');
const root=process.argv[2]||'app';
function patchFile(rel,fn){
 const file=path.join(root,rel); let src=fs.readFileSync(file,'utf8');
 const api={replaceOnce(a,b,label){const before=src;src=src.replace(a,b);if(src===before)throw new Error('RESILIENCE_PATCH_MISS '+rel+' '+label);},get(){return src;}};
 fn(api); fs.writeFileSync(file,api.get());
}
patchFile('src/persistence.js',({replaceOnce})=>{
 replaceOnce("let writeChain = Promise.resolve();","let writeChain = Promise.resolve();\nlet pendingWrites=0;\nconst MAX_PENDING_WRITES=Math.max(50,Number(process.env.TAXI4_MAX_PENDING_WRITES||1000));",'queue state');
 replaceOnce("export async function transact(mutator) {\n  let result; let rejection;\n  writeChain = writeChain.then(async () => {","export async function transact(mutator) {\n  if(pendingWrites>=MAX_PENDING_WRITES)throw new Error('SERVER_BUSY');\n  pendingWrites++;\n  let result; let rejection;\n  writeChain = writeChain.then(async () => {",'queue entry');
 replaceOnce("  await writeChain;\n  if (rejection) throw rejection;\n  return result;\n}","  try{await writeChain;}finally{pendingWrites=Math.max(0,pendingWrites-1);}\n  if (rejection) throw rejection;\n  return result;\n}\nexport function persistenceStats(){return {pendingWrites,maxPendingWrites:MAX_PENDING_WRITES};}",'queue exit');
});
patchFile('server.js',({replaceOnce})=>{
 replaceOnce("import { ensureDb, readDb, resetDb } from './src/persistence.js';","import { ensureDb, readDb, resetDb, persistenceStats } from './src/persistence.js';",'stats import');
 replaceOnce("const ROOT=path.dirname(fileURLToPath(import.meta.url));\nconst PORT=Number(process.env.PORT||process.env.TAXI4_PORT||3000);","const ROOT=path.dirname(fileURLToPath(import.meta.url));\nconst PORT=Number(process.env.PORT||process.env.TAXI4_PORT||3000);\nconst MAX_ACTIVE_REQUESTS=Math.max(50,Number(process.env.TAXI4_MAX_ACTIVE_REQUESTS||400));\nconst BOOKING_WINDOW_MS=60000;\nconst BOOKING_LIMIT_PER_IP=Math.max(20,Number(process.env.TAXI4_BOOKING_LIMIT_PER_IP||120));\nlet activeRequests=0;\nconst bookingRate=new Map();\nfunction clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();}\nfunction enforceBookingRate(req){const now=Date.now(),ip=clientIp(req);let slot=bookingRate.get(ip);if(!slot||now-slot.startedAt>=BOOKING_WINDOW_MS)slot={startedAt:now,count:0};slot.count++;bookingRate.set(ip,slot);if(slot.count>BOOKING_LIMIT_PER_IP)throw new Error('RATE_LIMITED');}\nfunction overloadSnapshot(){return {activeRequests,maxActiveRequests:MAX_ACTIVE_REQUESTS,...persistenceStats()};}",'guards');
 replaceOnce("const statusFor=code=>({","const statusFor=code=>({SERVER_BUSY:503,RATE_LIMITED:429,",'status map');
 replaceOnce("if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'airport-taxi-pilot',version:'0.7.0'});","if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'airport-taxi-pilot',version:'0.8.0',load:overloadSnapshot()});",'health');
 replaceOnce("if(req.method==='POST'&&url.pathname==='/api/client/bookings'){const b=await body(req);","if(req.method==='POST'&&url.pathname==='/api/client/bookings'){enforceBookingRate(req);const b=await body(req);",'booking rate');
 replaceOnce("http.createServer(async(req,res)=>{\n  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);","const server=http.createServer(async(req,res)=>{\n  activeRequests++;let released=false;const release=()=>{if(!released){released=true;activeRequests=Math.max(0,activeRequests-1);}};res.once('finish',release);res.once('close',release);if(activeRequests>MAX_ACTIVE_REQUESTS){release();return json(res,503,{error:'SERVER_BUSY',retryAfterSeconds:2});}\n  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);",'active guard');
 replaceOnce("}).listen(PORT,'0.0.0.0',()=>console.log(`Airport Taxi Pilot listening on :${PORT}`));","});\nserver.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;server.listen(PORT,'0.0.0.0',()=>console.log(`Airport Taxi Pilot listening on :${PORT}`));",'timeouts');
});
console.log('MARKETPLACE_RESILIENCE_PATCH_APPLIED');
const fs=require('fs');
const path=require('path');
const root=path.resolve(process.argv[2]||'app');
const here=__dirname;
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const auth=fs.readFileSync(path.join(root,'src','auth.js'),'utf8');
const control=fs.readFileSync(path.join(root,'apps','unified','public','dispatch','dispatch.js'),'utf8');

const assert=(ok,msg)=>{if(!ok)throw new Error('UNIFIED_SECURITY_SURFACE: '+msg);};

assert(server.includes("MARKETPLACE_ALLOW_TEST_HUB!=='1'"),'test hub must be fail-closed');
assert(server.includes("MARKETPLACE_ALLOW_RESET_DEMO!=='1'"),'reset-demo must require explicit enable flag');
assert(server.includes("s.role!=='admin'"),'reset-demo must require admin role');
assert(server.includes("authGuard(req,'staff')"),'staff login must be rate-limited');
assert(server.includes("authGuard(req,'driver')"),'driver login must be rate-limited');
assert(server.includes("AUTH_MODE"),'runtime auth telemetry must exist');
assert(!/\/api\/(?:debug|demo)\b/.test(server),'debug/demo API routes are forbidden');

assert(auth.includes("MARKETPLACE_AUTH_REQUIRED??'1'"),'auth must default to required');
assert(!auth.includes('FALLBACK_STAFF'),'public source must not contain fallback staff credentials');
assert(auth.includes("process.env.MARKETPLACE_ADMIN_PIN"),'admin PIN must come from environment');
assert(auth.includes("process.env.MARKETPLACE_DISPATCH_1_4_PIN"),'1-4 dispatcher PIN must come from environment');
assert(auth.includes("process.env.MARKETPLACE_DISPATCH_5_6_PIN"),'5-6 dispatcher PIN must come from environment');
assert(auth.includes("crypto.scryptSync"),'driver PIN storage must use scrypt');
assert(auth.includes("crypto.timingSafeEqual"),'credential comparison must be timing-safe');
assert(auth.includes("tokenHash(token)"),'stored sessions must hash bearer tokens');

assert(control.includes("sessionStorage.getItem('taxi4_dispatch_token')"),'staff token must be session-scoped');
assert(!control.includes("localStorage.getItem('taxi4_dispatch_token')"),'staff token must not persist in localStorage');
assert(!/[?&](?:token|auth|pin)=/i.test(control),'staff credentials must not be put in URLs');

console.log('UNIFIED_SECURITY_SURFACE_OK',JSON.stringify({
  authDefaultClosed:true,
  loginRateLimit:true,
  resetGuard:true,
  testHubClosed:true,
  noFallbackCredentials:true,
  hashedSessions:true,
  sessionScopedStaffToken:true,
  noCredentialUrls:true
}));

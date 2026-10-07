import crypto from 'node:crypto';
import { readDb, transact, id } from './persistence.js';

const SESSION_MS=24*60*60*1000;
const FALLBACK_STAFF=Object.freeze({
  admin:{salt:'de9d23f8d364c8b127e782a16d8f06be',hash:'6d093eaa68ab76bdcd3d5f8ef9ad0145f87fd683863ff445a3698e999e19121a'},
  dispatcher_1_4:{salt:'73e073cd9c4a4cf3e75ab28117d9c00c',hash:'315e76d980fdcfe8c9c7ca6bbcd1ad646587dc0643e3951704a258855e719d34'},
  dispatcher_5_6:{salt:'e5dbcbab1bfb668993f9d1663a1eaaaa',hash:'e19b043c084b6cff4ea3a062606f97329d47f4d0ecdb3d506a6dff21e68a6f07'}
});

function tokenHash(token){
  return crypto.createHash('sha256').update(String(token||'')).digest('hex');
}
function pinHash(pin,salt){
  return crypto.scryptSync(String(pin),String(salt),32).toString('hex');
}
function safeEqualText(a,b){
  const ah=crypto.createHash('sha256').update(String(a||'')).digest();
  const bh=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(ah,bh);
}
function validatePin(pin){
  const p=String(pin||'').trim();
  if(!/^\d{4,12}$/.test(p))throw new Error('PIN_MUST_BE_4_TO_12_DIGITS');
  return p;
}
function cleanSessions(db,now=Date.now()){
  db.sessions=(db.sessions||[]).filter(s=>new Date(s.expiresAt).getTime()>now);
}
function publicDriver(d){
  return {id:d.id,name:d.name,phone:d.phone,vehiclePlate:d.vehiclePlate||'',active:!!d.active,verified:!!d.verified};
}

export function marketplaceAuthRequired(){
  return String(process.env.MARKETPLACE_AUTH_REQUIRED??'1')!=='0';
}
export function staffAuthStats(){
  return {
    required:marketplaceAuthRequired(),
    adminConfigured:Boolean(process.env.MARKETPLACE_ADMIN_PIN)||Boolean(FALLBACK_STAFF.admin),
    dispatcher1to4Configured:Boolean(process.env.MARKETPLACE_DISPATCH_1_4_PIN||process.env.MARKETPLACE_DISPATCH_PIN)||Boolean(FALLBACK_STAFF.dispatcher_1_4),
    dispatcher5to6Configured:Boolean(process.env.MARKETPLACE_DISPATCH_5_6_PIN)||Boolean(FALLBACK_STAFF.dispatcher_5_6),
    fallbackVerifierEnabled:true
  };
}
function staffPinMatches(supplied,envPin,fallback){
  if(envPin)return safeEqualText(supplied,envPin);
  return safeEqualText(pinHash(String(supplied||''),fallback.salt),fallback.hash);
}

export async function configureDriverPin(driverId,pin){
  const p=validatePin(pin);
  return transact(db=>{
    const driver=db.drivers.find(d=>d.id===driverId);
    if(!driver)throw new Error('DRIVER_NOT_FOUND');
    const salt=crypto.randomBytes(16).toString('hex');
    driver.pinSalt=salt;
    driver.pinHash=pinHash(p,salt);
    driver.pinUpdatedAt=new Date().toISOString();
    return {driver:publicDriver(driver),pinConfigured:true};
  });
}

export async function driverLogin(driverId,pin,now=new Date()){
  const p=validatePin(pin);
  const identifier=String(driverId||'').trim();
  return transact(db=>{
    const driver=db.drivers.find(d=>d.id===identifier||String(d.phone||'').replace(/\\D/g,'')===identifier.replace(/\\D/g,''));
    if(!driver)throw new Error('DRIVER_NOT_FOUND');
    if(!driver.active||driver.verified===false)throw new Error('DRIVER_NOT_ACTIVE');
    if(!driver.pinHash||!driver.pinSalt)throw new Error('DRIVER_PIN_NOT_CONFIGURED');
    if(!safeEqualText(pinHash(p,driver.pinSalt),driver.pinHash))throw new Error('INVALID_CREDENTIALS');
    cleanSessions(db,new Date(now).getTime());
    const token=crypto.randomBytes(32).toString('base64url');
    const session={id:id('ses'),tokenHash:tokenHash(token),role:'driver',driverId:driver.id,createdAt:new Date(now).toISOString(),expiresAt:new Date(new Date(now).getTime()+SESSION_MS).toISOString()};
    db.sessions.push(session);
    return {token,expiresAt:session.expiresAt,role:'driver',driver:publicDriver(driver)};
  });
}

export async function dispatchLogin(pin,now=new Date()){
  const adminPin=String(process.env.MARKETPLACE_ADMIN_PIN||'');
  const smallPin=String(process.env.MARKETPLACE_DISPATCH_1_4_PIN||process.env.MARKETPLACE_DISPATCH_PIN||'');
  const largePin=String(process.env.MARKETPLACE_DISPATCH_5_6_PIN||'');
  if(!adminPin&&!smallPin&&!largePin&&!FALLBACK_STAFF.admin&&!FALLBACK_STAFF.dispatcher_1_4&&!FALLBACK_STAFF.dispatcher_5_6)throw new Error('STAFF_PIN_NOT_CONFIGURED');
  const supplied=String(pin||'');
  const role=
    staffPinMatches(supplied,adminPin,FALLBACK_STAFF.admin)?'admin':
    staffPinMatches(supplied,smallPin,FALLBACK_STAFF.dispatcher_1_4)?'dispatcher_1_4':
    staffPinMatches(supplied,largePin,FALLBACK_STAFF.dispatcher_5_6)?'dispatcher_5_6':
    null;
  if(!role)throw new Error('INVALID_CREDENTIALS');
  return transact(db=>{
    cleanSessions(db,new Date(now).getTime());
    const token=crypto.randomBytes(32).toString('base64url');
    const session={
      id:id('ses'),
      tokenHash:tokenHash(token),
      role,
      serviceScope:role==='admin'?'all':role==='dispatcher_1_4'?'taxi_1_4':'large_5_6',
      driverId:null,
      createdAt:new Date(now).toISOString(),
      expiresAt:new Date(new Date(now).getTime()+SESSION_MS).toISOString()
    };
    db.sessions.push(session);
    return {token,expiresAt:session.expiresAt,role,serviceScope:session.serviceScope};
  });
}

export async function sessionForToken(token,now=new Date()){
  if(!token)return null;
  const db=await readDb();
  const hash=tokenHash(token);
  return (db.sessions||[]).find(s=>s.tokenHash===hash&&new Date(s.expiresAt).getTime()>new Date(now).getTime())||null;
}

export async function logoutToken(token){
  if(!token)return {ok:true};
  const hash=tokenHash(token);
  return transact(db=>{
    db.sessions=(db.sessions||[]).filter(s=>s.tokenHash!==hash);
    return {ok:true};
  });
}

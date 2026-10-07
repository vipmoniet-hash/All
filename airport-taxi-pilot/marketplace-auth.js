import crypto from 'node:crypto';
import { readDb, transact, id } from './persistence.js';

const SESSION_MS=24*60*60*1000;
const LEGACY_OWNER_HOST='vanclick-dispatch.netlify.app';

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
function staffHashConfigured(name){return Boolean(String(process.env[name]||'').trim());}
function verifyStaffHash(pin,encoded){
  const raw=String(encoded||'').trim();
  if(!raw)return false;
  const i=raw.indexOf(':');
  if(i<=0||i===raw.length-1)return false;
  const salt=raw.slice(0,i), expected=raw.slice(i+1);
  return safeEqualText(pinHash(pin,salt),expected);
}
function verifyStaffCredential(pin,plainName,hashName){
  const plain=String(process.env[plainName]||'');
  if(plain&&safeEqualText(pin,plain))return true;
  return verifyStaffHash(pin,process.env[hashName]);
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
function legacyOwnerAuthUrl(){
  const raw=String(process.env.LEGACY_OWNER_AUTH_URL||'').trim();
  if(!raw)return '';
  try{
    const u=new URL(raw);
    const trustedProd=u.protocol==='https:'&&u.hostname===LEGACY_OWNER_HOST&&u.pathname==='/api/login';
    const trustedLocal=(u.hostname==='127.0.0.1'||u.hostname==='localhost')&&u.pathname==='/api/login';
    return trustedProd||trustedLocal?u.toString():'';
  }catch{return '';}
}
async function verifyLegacyOwner(phone,pin){
  const url=legacyOwnerAuthUrl();
  const identifier=String(phone||'').trim();
  if(!url||!identifier)return false;
  const p=validatePin(pin);
  let response;
  try{
    response=await fetch(url,{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({phone:identifier,pin:p}),
      redirect:'error',
      signal:AbortSignal.timeout(5000)
    });
  }catch{
    throw new Error('OWNER_AUTH_UNAVAILABLE');
  }
  if([400,401,403,404].includes(response.status))return false;
  if(!response.ok)throw new Error('OWNER_AUTH_UNAVAILABLE');
  let payload=null;
  try{payload=await response.json();}catch{throw new Error('OWNER_AUTH_UNAVAILABLE');}
  return payload?.user?.role==='owner';
}
async function createStaffSession(role,now=new Date()){
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

export function marketplaceAuthRequired(){
  return String(process.env.MARKETPLACE_AUTH_REQUIRED??'1')!=='0';
}
export function staffAuthStats(){
  const legacyOwnerBridgeConfigured=Boolean(legacyOwnerAuthUrl());
  return {
    required:marketplaceAuthRequired(),
    adminConfigured:Boolean(process.env.MARKETPLACE_ADMIN_PIN)||staffHashConfigured('MARKETPLACE_ADMIN_PIN_HASH')||legacyOwnerBridgeConfigured,
    dispatcher1to4Configured:Boolean(process.env.MARKETPLACE_DISPATCH_1_4_PIN||process.env.MARKETPLACE_DISPATCH_PIN)||staffHashConfigured('MARKETPLACE_DISPATCH_1_4_PIN_HASH'),
    dispatcher5to6Configured:Boolean(process.env.MARKETPLACE_DISPATCH_5_6_PIN)||staffHashConfigured('MARKETPLACE_DISPATCH_5_6_PIN_HASH'),
    legacyOwnerBridgeConfigured,
    secretSource:legacyOwnerBridgeConfigured?'legacy_owner_bridge_or_render_environment':'render_environment_only'
  };
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
    const driver=db.drivers.find(d=>d.id===identifier||String(d.phone||'').replace(/\D/g,'')===identifier.replace(/\D/g,''));
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

export async function driverOrOwnerLogin(driverId,pin,now=new Date()){
  let ownerBridgeError=null;
  if(legacyOwnerAuthUrl()&&String(driverId||'').trim()){
    try{
      if(await verifyLegacyOwner(driverId,pin))return createStaffSession('admin',now);
    }catch(error){
      ownerBridgeError=error;
    }
  }
  try{
    return await driverLogin(driverId,pin,now);
  }catch(error){
    if(ownerBridgeError&&String(error?.message||'')==='DRIVER_NOT_FOUND')throw ownerBridgeError;
    throw error;
  }
}

export async function dispatchLogin(pin,now=new Date(),phone=''){
  const legacyConfigured=Boolean(legacyOwnerAuthUrl());
  const adminConfigured=Boolean(process.env.MARKETPLACE_ADMIN_PIN)||staffHashConfigured('MARKETPLACE_ADMIN_PIN_HASH');
  const smallConfigured=Boolean(process.env.MARKETPLACE_DISPATCH_1_4_PIN||process.env.MARKETPLACE_DISPATCH_PIN)||staffHashConfigured('MARKETPLACE_DISPATCH_1_4_PIN_HASH');
  const largeConfigured=Boolean(process.env.MARKETPLACE_DISPATCH_5_6_PIN)||staffHashConfigured('MARKETPLACE_DISPATCH_5_6_PIN_HASH');
  if(!adminConfigured&&!smallConfigured&&!largeConfigured&&!legacyConfigured)throw new Error('STAFF_PIN_NOT_CONFIGURED');

  const ownerPhone=String(phone||'').trim();
  if(ownerPhone&&legacyConfigured){
    if(await verifyLegacyOwner(ownerPhone,pin))return createStaffSession('admin',now);
  }

  const supplied=String(pin||'');
  const role=
    verifyStaffCredential(supplied,'MARKETPLACE_ADMIN_PIN','MARKETPLACE_ADMIN_PIN_HASH')?'admin':
    (verifyStaffCredential(supplied,'MARKETPLACE_DISPATCH_1_4_PIN','MARKETPLACE_DISPATCH_1_4_PIN_HASH')||(process.env.MARKETPLACE_DISPATCH_PIN&&safeEqualText(supplied,process.env.MARKETPLACE_DISPATCH_PIN)))?'dispatcher_1_4':
    verifyStaffCredential(supplied,'MARKETPLACE_DISPATCH_5_6_PIN','MARKETPLACE_DISPATCH_5_6_PIN_HASH')?'dispatcher_5_6':
    null;
  if(!role)throw new Error('INVALID_CREDENTIALS');
  return createStaffSession(role,now);
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

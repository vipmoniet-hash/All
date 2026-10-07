import crypto from 'node:crypto';
import { readDb, transact, id } from './persistence.js';

const SESSION_MS=24*60*60*1000;

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
  return String(process.env.MARKETPLACE_AUTH_REQUIRED||'0')==='1';
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
  const expected=String(process.env.MARKETPLACE_ADMIN_PIN||'');
  if(!expected)throw new Error('ADMIN_PIN_NOT_CONFIGURED');
  if(!safeEqualText(String(pin||''),expected))throw new Error('INVALID_CREDENTIALS');
  return transact(db=>{
    cleanSessions(db,new Date(now).getTime());
    const token=crypto.randomBytes(32).toString('base64url');
    const session={id:id('ses'),tokenHash:tokenHash(token),role:'dispatch',driverId:null,createdAt:new Date(now).toISOString(),expiresAt:new Date(new Date(now).getTime()+SESSION_MS).toISOString()};
    db.sessions.push(session);
    return {token,expiresAt:session.expiresAt,role:'dispatch'};
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

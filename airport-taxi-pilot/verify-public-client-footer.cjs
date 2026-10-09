'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalizePublicClientFooter}=require('./public-client-footer.cjs');
const original='<main>Booking</main>\n<footer><span>סביבת בדיקה · Airport Taxi Pilot</span><a href="https://vanclick.co.il/test/">כלי בדיקה</a></footer>';
const normalized=normalizePublicClientFooter(original);
assert.ok(normalized.includes('VanClick · מוניות לנתב״ג בהזמנה מראש'));
assert.ok(normalized.includes('href="https://vanclick.co.il/terms"'));
assert.ok(!normalized.includes('Airport Taxi Pilot'));
assert.ok(!normalized.includes('https://vanclick.co.il/test/'));
assert.equal(normalizePublicClientFooter(normalized),normalized,'replacement must be idempotent');
assert.throws(()=>normalizePublicClientFooter('<footer>סביבת בדיקה · Airport Taxi Pilot</footer>'),/internal pilot/);
assert.equal(normalizePublicClientFooter('<footer>Existing customer policy</footer>'),'<footer>Existing customer policy</footer>');
const root=process.argv[2];
if(root){
  const base=path.join(root,'apps','client','public');
  const files=[];
  const walk=dir=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,ent.name);
      if(ent.isDirectory())walk(file);
      else if(ent.isFile()&&/\.html?$/i.test(ent.name))files.push(file);
    }
  };
  walk(base);
  assert.ok(files.length>0,'build must contain public client HTML');
  for(const file of files){
    const html=fs.readFileSync(file,'utf8');
    assert.equal(normalizePublicClientFooter(html),html,'production output must have no pilot footer: '+file);
  }
}
console.log('Public Taxi 1–4 footer contract PASS: no pilot/test link on customer page');

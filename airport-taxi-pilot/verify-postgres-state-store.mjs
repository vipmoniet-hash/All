import assert from 'node:assert/strict';
import { createPostgresStateStore } from './postgres-state-store.js';

const seed={drivers:[],orders:[],largeOrders:[],topups:[],ledger:[],events:[],sessions:[]};

function fakePool(initial=null){
  let payload=initial;
  const log=[];
  return {
    log,
    async connect(){
      let txPayload=payload==null?null:structuredClone(payload);
      let inTx=false;
      return {
        async query(sql,params=[]){
          const q=String(sql).replace(/\s+/g,' ').trim();
          log.push(q);
          if(/^BEGIN/i.test(q)){inTx=true;txPayload=payload==null?null:structuredClone(payload);return {rows:[]};}
          if(/^ROLLBACK/i.test(q)){inTx=false;txPayload=payload==null?null:structuredClone(payload);return {rows:[]};}
          if(/^COMMIT/i.test(q)){payload=structuredClone(txPayload);inTx=false;return {rows:[]};}
          if(/CREATE TABLE IF NOT EXISTS vanclick_state/i.test(q))return {rows:[]};
          if(/INSERT INTO vanclick_state/i.test(q)&&/ON CONFLICT .* DO NOTHING/i.test(q)){if(txPayload==null)txPayload=JSON.parse(params[1]);if(!inTx)payload=structuredClone(txPayload);return {rows:[]};}
          if(/SELECT payload FROM vanclick_state/i.test(q)){const p=inTx?txPayload:payload;return {rows:p==null?[]:[{payload:structuredClone(p)}]};}
          if(/UPDATE vanclick_state SET payload/i.test(q)){txPayload=JSON.parse(params[0]);if(!inTx)payload=structuredClone(txPayload);return {rowCount:1,rows:[]};}
          if(/INSERT INTO vanclick_state/i.test(q)&&/ON CONFLICT .* DO UPDATE/i.test(q)){txPayload=JSON.parse(params[1]);if(!inTx)payload=structuredClone(txPayload);return {rows:[]};}
          throw new Error('UNEXPECTED_SQL '+q);
        },
        release(){}
      };
    },
    snapshot(){return structuredClone(payload);}
  };
}

const pool=fakePool();
const store=createPostgresStateStore({pool,seed,shape:x=>x});
await store.ensureDb();
let db=await store.readDb();
assert.deepEqual(db,seed,'ensure/read must materialize seed state');

const result=await store.transact(state=>{state.orders.push({id:'ord-1'});return 'ok';});
assert.equal(result,'ok','transaction returns mutator result');
assert.equal(pool.snapshot().orders.length,1,'committed mutation is persisted');
assert.ok(pool.log.some(x=>/FOR UPDATE/i.test(x)),'transaction must lock the shared state row with FOR UPDATE');
assert.ok(pool.log.some(x=>/^BEGIN/i.test(x))&&pool.log.some(x=>/^COMMIT/i.test(x)),'transaction must use BEGIN/COMMIT');

await assert.rejects(()=>store.transact(state=>{state.orders.push({id:'bad'});throw new Error('boom');}),/boom/);
assert.equal(pool.snapshot().orders.length,1,'failed transaction must roll back state');
assert.ok(pool.log.some(x=>/^ROLLBACK/i.test(x)),'failed transaction must issue ROLLBACK');

await store.resetDb({...seed,largeOrders:[{id:'lg-1'}]});
db=await store.readDb();
assert.equal(db.largeOrders.length,1,'reset must atomically replace state');

console.log('POSTGRES_STATE_STORE_CONTRACT_OK',JSON.stringify({
  rowLock:true,
  rollback:true,
  reset:true,
  apiCompatible:true
}));

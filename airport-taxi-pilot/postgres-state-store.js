const STATE_ID='marketplace';

export function createPostgresStateStore({pool,seed,shape}){
  if(!pool||typeof pool.connect!=='function')throw new Error('POSTGRES_POOL_REQUIRED');
  if(typeof shape!=='function')throw new Error('STATE_SHAPE_REQUIRED');

  async function ensureDb(){
    const client=await pool.connect();
    try{
      await client.query(`
        CREATE TABLE IF NOT EXISTS vanclick_state (
          id text PRIMARY KEY,
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        'INSERT INTO vanclick_state(id,payload) VALUES($1,$2::jsonb) ON CONFLICT (id) DO NOTHING',
        [STATE_ID,JSON.stringify(shape(seed))]
      );
    }finally{client.release();}
  }

  async function readDb(){
    await ensureDb();
    const client=await pool.connect();
    try{
      const result=await client.query('SELECT payload FROM vanclick_state WHERE id=$1',[STATE_ID]);
      const payload=result.rows[0]?.payload??seed;
      return shape(payload);
    }finally{client.release();}
  }

  async function transact(mutator){
    await ensureDb();
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const locked=await client.query('SELECT payload FROM vanclick_state WHERE id=$1 FOR UPDATE',[STATE_ID]);
      const db=shape(locked.rows[0]?.payload??seed);
      const result=await mutator(db);
      await client.query(
        'UPDATE vanclick_state SET payload=$1::jsonb, updated_at=now() WHERE id=$2',
        [JSON.stringify(shape(db)),STATE_ID]
      );
      await client.query('COMMIT');
      return result;
    }catch(error){
      try{await client.query('ROLLBACK');}catch{}
      throw error;
    }finally{client.release();}
  }

  async function resetDb(custom=seed){
    await ensureDb();
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO vanclick_state(id,payload,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()',
        [STATE_ID,JSON.stringify(shape(custom))]
      );
      await client.query('COMMIT');
    }catch(error){
      try{await client.query('ROLLBACK');}catch{}
      throw error;
    }finally{client.release();}
  }

  return {ensureDb,readDb,transact,resetDb};
}

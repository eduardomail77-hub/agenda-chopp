import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não está configurada');
    }
    pool = new Pool({ connectionString: databaseUrl });
    pool.on('error', (err) => {
      console.error('Erro no pool de conexões:', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executada:', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error('Erro na query:', err);
    throw err;
  }
}

export async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, close };

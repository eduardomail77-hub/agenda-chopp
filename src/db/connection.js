import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Erro no pool de conexões:', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
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
  await pool.end();
}

export default pool;

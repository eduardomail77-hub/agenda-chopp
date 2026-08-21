import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não está configurada');
}

const poolConfig = databaseUrl ?
  { connectionString: databaseUrl } :
  { host: 'localhost', port: 5432, database: 'test', user: 'postgres', password: 'test' };

const pool = new Pool(poolConfig);

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

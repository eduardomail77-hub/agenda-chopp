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

/**
 * Roda várias queries na MESMA conexão, dentro de uma transação.
 * Necessário porque cada chamada de query() pega uma conexão diferente
 * do pool, o que faz BEGIN/COMMIT soltos não terem efeito nenhum.
 */
export async function transacao(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, transacao, close };

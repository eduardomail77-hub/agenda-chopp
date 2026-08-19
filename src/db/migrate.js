import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, close } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  try {
    console.log('Iniciando migração do banco de dados...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await query(schema);

    console.log('✓ Migração concluída com sucesso!');
    await close();
  } catch (err) {
    console.error('✗ Erro na migração:', err);
    await close();
    process.exit(1);
  }
}

migrate();

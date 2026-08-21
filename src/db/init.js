import { query, close } from './connection.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function waitForDatabase(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await query('SELECT 1');
      console.log('✓ Banco de dados conectado');
      return true;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`⏳ Aguardando banco de dados... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error('Não foi possível conectar ao banco de dados');
}

async function migrate() {
  try {
    console.log('🚀 Executando migrações...');

    const migrationSql = `
      CREATE TABLE IF NOT EXISTS chopeiras (
        id VARCHAR(20) PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        vias INTEGER NOT NULL,
        vazao INTEGER
      );

      CREATE TABLE IF NOT EXISTS cervejas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) UNIQUE NOT NULL,
        estilo VARCHAR(255),
        abv NUMERIC(4,2),
        ibu INTEGER
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        cliente VARCHAR(255) NOT NULL,
        telefone VARCHAR(20),
        data_entrega DATE NOT NULL,
        gas BOOLEAN DEFAULT false,
        valor_entrega_coleta NUMERIC(10,2),
        pago BOOLEAN DEFAULT false,
        resp_entrega VARCHAR(255),
        resp_coleta VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pendente',
        origem VARCHAR(50) DEFAULT 'interno',
        google_event_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
        cerveja VARCHAR(255) NOT NULL,
        litros NUMERIC(10,2),
        valor_litro NUMERIC(10,2)
      );

      CREATE TABLE IF NOT EXISTS pedido_chopeiras (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
        chopeira_id VARCHAR(20) NOT NULL REFERENCES chopeiras(id)
      );

      CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_entrega);
      CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
      CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_pedido_chopeiras_pedido ON pedido_chopeiras(pedido_id);
    `;

    await query(migrationSql);
    console.log('✓ Migrações executadas com sucesso');
  } catch (err) {
    console.error('✗ Erro na migração:', err.message);
    throw err;
  }
}

async function seed() {
  try {
    console.log('🌱 Executando seed...');

    const CHOPEIRAS = [
      { id: 'E.25L.1V.1', tipo: 'Elétrica', vias: 1, vazao: 25 },
      { id: 'E.25L.1V.2', tipo: 'Elétrica', vias: 1, vazao: 25 },
      { id: 'E.40L.1V.1', tipo: 'Elétrica', vias: 1, vazao: 40 },
      { id: 'E.110L.2V.1', tipo: 'Elétrica', vias: 2, vazao: 110 },
      { id: 'G.1V.1', tipo: 'Gelo', vias: 1, vazao: null },
      { id: 'G.1V.2', tipo: 'Gelo', vias: 1, vazao: null },
      { id: 'G.1V.3', tipo: 'Gelo', vias: 1, vazao: null },
      { id: 'G.2V.1', tipo: 'Gelo', vias: 2, vazao: null },
    ];

    const CERVEJAS = [
      { nome: 'Predileta', estilo: 'Cream Ale', abv: 4.5, ibu: 10 },
      { nome: 'Old Barn', estilo: 'Weissbier', abv: 5.5, ibu: 15 },
      { nome: 'Sunset', estilo: 'Session IPA', abv: 4.2, ibu: 37 },
      { nome: 'Prohibition', estilo: 'Brown Ale', abv: 4.7, ibu: 23 },
      { nome: 'Red Door', estilo: 'Irish Red Ale', abv: 6.6, ibu: 31 },
      { nome: 'Dois Mundos', estilo: 'American Pale Ale', abv: 5.5, ibu: 35 },
      { nome: 'Aloha', estilo: 'Juicy IPA', abv: 6.1, ibu: 50 },
      { nome: 'Five Hops', estilo: 'American IPA', abv: 6.6, ibu: 55 },
      { nome: 'La Tripel', estilo: 'Belgian Tripel', abv: 7.9, ibu: 17 },
      { nome: 'Hop Witcher', estilo: 'Double IPA', abv: 9, ibu: 90 },
    ];

    for (const chopeira of CHOPEIRAS) {
      await query(
        'INSERT INTO chopeiras (id, tipo, vias, vazao) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [chopeira.id, chopeira.tipo, chopeira.vias, chopeira.vazao]
      );
    }
    console.log(`✓ ${CHOPEIRAS.length} chopeiras inseridas`);

    for (const cerveja of CERVEJAS) {
      await query(
        'INSERT INTO cervejas (nome, estilo, abv, ibu) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [cerveja.nome, cerveja.estilo, cerveja.abv, cerveja.ibu]
      );
    }
    console.log(`✓ ${CERVEJAS.length} cervejas inseridas`);
  } catch (err) {
    console.error('✗ Erro no seed:', err.message);
    throw err;
  }
}

export async function initializeDatabase() {
  try {
    await waitForDatabase();
    await migrate();
    await seed();
    console.log('✓ Banco de dados inicializado com sucesso');
  } catch (err) {
    console.error('✗ Erro na inicialização do banco:', err.message);
    throw err;
  }
}

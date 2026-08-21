import bcrypt from 'bcryptjs';
import { query } from './connection.js';
import { sincronizarAcessos } from '../services/googleCalendarService.js';

async function waitForDatabase(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await query('SELECT 1');
      console.log('✓ Banco de dados conectado');
      return true;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`⏳ Aguardando banco de dados... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error('Não foi possível conectar ao banco de dados');
}

async function migrate() {
  console.log('🚀 Executando migrações...');

  await query(`
    CREATE TABLE IF NOT EXISTS chopeiras (
      id VARCHAR(20) PRIMARY KEY,
      tipo VARCHAR(50) NOT NULL,
      vias INTEGER NOT NULL,
      vazao INTEGER,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cervejas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) UNIQUE NOT NULL,
      estilo VARCHAR(255),
      abv NUMERIC(4,2),
      ibu INTEGER,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      telefone VARCHAR(30),
      senha_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) NOT NULL DEFAULT 'vendedor',
      recebe_aviso BOOLEAN DEFAULT true,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave VARCHAR(100) PRIMARY KEY,
      valor TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      cliente VARCHAR(255) NOT NULL,
      telefone VARCHAR(30),
      data_entrega DATE NOT NULL,
      gas BOOLEAN DEFAULT false,
      valor_entrega_coleta NUMERIC(10,2) DEFAULT 0,
      desconto NUMERIC(10,2) DEFAULT 0,
      pago BOOLEAN DEFAULT false,
      resp_entrega VARCHAR(255),
      resp_coleta VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pendente',
      origem VARCHAR(50) DEFAULT 'interno',
      criado_por INTEGER REFERENCES usuarios(id),
      google_event_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      cerveja VARCHAR(255) NOT NULL,
      litros NUMERIC(10,2),
      valor_litro NUMERIC(10,2)
    );

    CREATE TABLE IF NOT EXISTS pedido_chopeiras (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      chopeira_id VARCHAR(20) NOT NULL REFERENCES chopeiras(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_entrega);
    CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
    CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_pedido_chopeiras_pedido ON pedido_chopeiras(pedido_id);
  `);

  // Colunas adicionadas depois da primeira versão do schema
  await query(`
    ALTER TABLE cervejas ADD COLUMN IF NOT EXISTS preco_litro NUMERIC(10,2) DEFAULT 0;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id);
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco TEXT;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS hora_entrega TIME;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_coleta DATE;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS hora_coleta TIME;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS google_event_entrega VARCHAR(255);
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS google_event_coleta VARCHAR(255);
  `);

  // Eventos antigos ficavam num campo só; passam a ser o evento de entrega
  await query(`
    UPDATE pedidos SET google_event_entrega = google_event_id
    WHERE google_event_id IS NOT NULL AND google_event_entrega IS NULL
  `);

  // Pedido sem data de coleta recolhe no dia seguinte à entrega
  await query(`
    UPDATE pedidos SET data_coleta = data_entrega + INTERVAL '1 day'
    WHERE data_coleta IS NULL
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_pedidos_coleta ON pedidos(data_coleta)
  `);

  console.log('✓ Migrações executadas com sucesso');
}

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

const CONFIG_PADRAO = {
  // minutos antes do início do evento, separados por vírgula
  lembretes: '2880,1440,60',
  valor_entrega_padrao: '0',
  hora_entrega_padrao: '10:00',
  hora_coleta_padrao: '10:00',
};

async function seed() {
  console.log('🌱 Executando seed...');

  for (const c of CHOPEIRAS) {
    await query(
      'INSERT INTO chopeiras (id, tipo, vias, vazao) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [c.id, c.tipo, c.vias, c.vazao]
    );
  }

  for (const c of CERVEJAS) {
    await query(
      'INSERT INTO cervejas (nome, estilo, abv, ibu) VALUES ($1, $2, $3, $4) ON CONFLICT (nome) DO NOTHING',
      [c.nome, c.estilo, c.abv, c.ibu]
    );
  }

  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
    await query(
      'INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO NOTHING',
      [chave, valor]
    );
  }

  await seedAdmin();

  console.log('✓ Seed concluído');
}

async function seedAdmin() {
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM usuarios WHERE perfil = 'admin'");
  if (rows[0].n > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA_INICIAL;

  if (!email || !senha) {
    console.warn('⚠ Nenhum admin cadastrado e ADMIN_EMAIL/ADMIN_SENHA_INICIAL não definidos. Sistema ficará sem acesso até configurar.');
    return;
  }

  const hash = await bcrypt.hash(senha, 10);
  await query(
    "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, 'admin')",
    [process.env.ADMIN_NOME || 'Administrador', email.toLowerCase(), hash]
  );
  console.log(`✓ Admin inicial criado: ${email}`);
}

export async function initializeDatabase() {
  await waitForDatabase();
  await migrate();
  await seed();
  console.log('✓ Banco de dados inicializado com sucesso');

  // Não bloqueia a subida do servidor se o Google estiver fora
  sincronizarAcessos().catch((err) =>
    console.error('Falha ao sincronizar acessos:', err.message)
  );
}

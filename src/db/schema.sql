-- Schema do banco de dados - Agenda de Chopp
-- Fora da Lei Cervejaria

CREATE TABLE IF NOT EXISTS cervejas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  estilo VARCHAR(100) NOT NULL,
  abv DECIMAL(3, 1) NOT NULL,
  ibu INT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chopeiras (
  id VARCHAR(20) PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Elétrica', 'Gelo')),
  vias INT NOT NULL CHECK (vias > 0),
  vazao INT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  cliente VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  data_entrega DATE NOT NULL,
  gas BOOLEAN DEFAULT false,
  valor_entrega_coleta DECIMAL(10, 2) NOT NULL,
  pago BOOLEAN DEFAULT false,
  resp_entrega VARCHAR(100),
  resp_coleta VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'confirmado')) DEFAULT 'pendente',
  origem VARCHAR(20) NOT NULL CHECK (origem IN ('interno', 'cliente')) DEFAULT 'interno',
  google_event_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  cerveja VARCHAR(100) NOT NULL,
  litros DECIMAL(10, 2) NOT NULL CHECK (litros > 0),
  valor_litro DECIMAL(10, 2) NOT NULL CHECK (valor_litro > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido_chopeiras (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  chopeira_id VARCHAR(20) NOT NULL REFERENCES chopeiras(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pedido_id, chopeira_id)
);

-- Índices para performance
CREATE INDEX idx_pedidos_data_entrega ON pedidos(data_entrega);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_origem ON pedidos(origem);
CREATE INDEX idx_pedido_itens_pedido_id ON pedido_itens(pedido_id);
CREATE INDEX idx_pedido_chopeiras_pedido_id ON pedido_chopeiras(pedido_id);
CREATE INDEX idx_pedido_chopeiras_chopeira_id ON pedido_chopeiras(chopeira_id);

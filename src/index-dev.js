import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Dados em memória para teste
let pedidosDb = [
  {
    id: 1,
    cliente: 'Marcelo Andrade',
    telefone: '(51) 99123-4567',
    data_entrega: new Date().toISOString().split('T')[0],
    gas: true,
    valor_entrega_coleta: 150,
    pago: true,
    resp_entrega: 'Giba',
    resp_coleta: 'Entregador 1',
    status: 'confirmado',
    origem: 'interno',
    google_event_id: null,
    itens: [
      { cerveja: 'Predileta', litros: 100, valor_litro: 22 },
      { cerveja: 'Aloha', litros: 40, valor_litro: 30 },
    ],
    chopeiras: ['E.110L.2V.1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    cliente: 'Aniversário Dona Léa',
    telefone: '(51) 98888-1122',
    data_entrega: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    gas: true,
    valor_entrega_coleta: 120,
    pago: false,
    resp_entrega: 'Eduardo',
    resp_coleta: 'Eduardo',
    status: 'confirmado',
    origem: 'interno',
    google_event_id: null,
    itens: [{ cerveja: 'Old Barn', litros: 50, valor_litro: 26 }],
    chopeiras: ['E.40L.1V.1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    cliente: 'Casamento Priscila & João',
    telefone: '(51) 99777-3300',
    data_entrega: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    gas: true,
    valor_entrega_coleta: 200,
    pago: false,
    resp_entrega: '',
    resp_coleta: '',
    status: 'pendente',
    origem: 'interno',
    google_event_id: null,
    itens: [
      { cerveja: 'Sunset', litros: 80, valor_litro: 24 },
      { cerveja: 'Red Door', litros: 40, valor_litro: 28 },
    ],
    chopeiras: ['E.25L.1V.1', 'G.1V.1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
  { id: 1, nome: 'Predileta', estilo: 'Cream Ale', abv: 4.5, ibu: 10 },
  { id: 2, nome: 'Old Barn', estilo: 'Weissbier', abv: 5.5, ibu: 15 },
  { id: 3, nome: 'Sunset', estilo: 'Session IPA', abv: 4.2, ibu: 37 },
  { id: 4, nome: 'Prohibition', estilo: 'Brown Ale', abv: 4.7, ibu: 23 },
  { id: 5, nome: 'Red Door', estilo: 'Irish Red Ale', abv: 6.6, ibu: 31 },
  { id: 6, nome: 'Dois Mundos', estilo: 'American Pale Ale', abv: 5.5, ibu: 35 },
  { id: 7, nome: 'Aloha', estilo: 'Juicy IPA', abv: 6.1, ibu: 50 },
  { id: 8, nome: 'Five Hops', estilo: 'American IPA', abv: 6.6, ibu: 55 },
  { id: 9, nome: 'La Tripel', estilo: 'Belgian Tripel', abv: 7.9, ibu: 17 },
  { id: 10, nome: 'Hop Witcher', estilo: 'Double IPA', abv: 9, ibu: 90 },
];

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: 'demo', timestamp: new Date().toISOString() });
});

// Pedidos
app.get('/api/pedidos', (req, res) => {
  const { status } = req.query;
  let result = pedidosDb;
  if (status) result = result.filter((p) => p.status === status);
  res.json(result);
});

app.get('/api/pedidos/:id', (req, res) => {
  const pedido = pedidosDb.find((p) => p.id === parseInt(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(pedido);
});

app.post('/api/pedidos', (req, res) => {
  const { cliente, telefone, data_entrega, gas, valor_entrega_coleta, pago, resp_entrega, resp_coleta, itens, chopeiras } = req.body;

  if (!cliente || !telefone || !data_entrega || !itens?.length || !chopeiras?.length) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }

  const newId = Math.max(...pedidosDb.map((p) => p.id)) + 1;
  const newPedido = {
    id: newId,
    cliente,
    telefone,
    data_entrega,
    gas,
    valor_entrega_coleta: Number(valor_entrega_coleta) || 0,
    pago,
    resp_entrega: resp_entrega || '',
    resp_coleta: resp_coleta || '',
    status: 'pendente',
    origem: 'interno',
    google_event_id: null,
    itens,
    chopeiras,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  pedidosDb.push(newPedido);
  res.status(201).json(newPedido);
});

app.patch('/api/pedidos/:id', (req, res) => {
  const pedido = pedidosDb.find((p) => p.id === parseInt(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

  Object.assign(pedido, req.body, { updated_at: new Date().toISOString() });
  res.json(pedido);
});

app.post('/api/pedidos/:id/confirmar', (req, res) => {
  const pedido = pedidosDb.find((p) => p.id === parseInt(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  if (pedido.status === 'confirmado') return res.status(400).json({ erro: 'Já confirmado' });

  pedido.status = 'confirmado';
  pedido.updated_at = new Date().toISOString();
  res.json(pedido);
});

app.delete('/api/pedidos/:id', (req, res) => {
  const idx = pedidosDb.findIndex((p) => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ erro: 'Pedido não encontrado' });

  pedidosDb.splice(idx, 1);
  res.json({ mensagem: 'Pedido deletado' });
});

// Recursos
app.get('/api/recursos/chopeiras', (req, res) => {
  res.json(CHOPEIRAS);
});

app.get('/api/recursos/chopeiras/disponibles', (req, res) => {
  const { data } = req.query;
  const resultado = CHOPEIRAS.map((c) => {
    const pedido = pedidosDb.find((p) => p.data_entrega === data && p.chopeiras?.includes(c.id));
    return {
      ...c,
      ocupada_por: pedido?.cliente || null,
    };
  });
  res.json(resultado);
});

app.get('/api/recursos/cervejas', (req, res) => {
  res.json(CERVEJAS);
});

// Público - Link de auto-agendamento
app.post('/api/publico/agendar', (req, res) => {
  const { cliente, telefone, data_entrega, gas, valor_entrega_coleta, itens, chopeiras } = req.body;

  if (!cliente || !telefone || !data_entrega || !itens?.length || !chopeiras?.length) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataEntrega = new Date(data_entrega + 'T00:00:00');
  if (dataEntrega < hoje) {
    return res.status(400).json({ erro: 'Data não pode ser no passado' });
  }

  const newId = Math.floor(Math.random() * 10000);
  const response = {
    id: newId,
    cliente,
    telefone,
    data_entrega,
    gas: gas || false,
    valor_entrega_coleta: valor_entrega_coleta || 0,
    pago: false,
    resp_entrega: null,
    resp_coleta: null,
    itens,
    chopeiras,
    status: 'pendente',
    origem: 'cliente',
    google_event_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  pedidosDb.push(response);

  res.status(201).json({
    sucesso: true,
    mensagem: 'Pedido criado! Aguardando confirmação da Fora da Lei.',
    pedido: response,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.listen(PORT, () => {
  console.log(`✓ Backend DEMO rodando em http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Dados em memória (não persiste)`);
});

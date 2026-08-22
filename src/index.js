import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import pedidosRoutes from './routes/pedidos.js';
import recursosRoutes from './routes/recursos.js';
import publicoRoutes from './routes/publico.js';
import cotacoesRoutes from './routes/cotacoes.js';
import { exigirLogin, exigirAdmin } from './middleware/auth.js';
import { initializeDatabase } from './db/init.js';

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Só o site do chopp fala com esta API.
 * Sem lista, qualquer página na internet poderia chamar as rotas usando o
 * navegador de alguém já logado.
 */
const ORIGENS = [
  'https://chopp.foradalei.com.br',
  'https://frontend-tau-lilac-32.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin(origin, callback) {
      // Sem origin é chamada fora do navegador, como o health check do Railway
      if (!origin) return callback(null, true);
      if (ORIGENS.includes(origin)) return callback(null, true);

      // Pré-visualizações do próprio projeto na Vercel
      if (/^https:\/\/frontend-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      console.warn('Origem bloqueada pelo CORS:', origin);
      return callback(new Error('Origem não autorizada'));
    },
  })
);

app.use(express.json());

// Health check fica aberto para o Railway conseguir monitorar
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Aberta na internet: é o link de cotação que vai para o cliente
app.use('/api/publico', publicoRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/pedidos', exigirLogin, pedidosRoutes);
app.use('/api/recursos', exigirLogin, recursosRoutes);
// Cotação é assunto de administrador: envolve preço e negociação
app.use('/api/cotacoes', exigirLogin, exigirAdmin, cotacoesRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  // Origem barrada não é falha do servidor, é a regra funcionando
  if (err?.message === 'Origem não autorizada') {
    return res.status(403).json({ erro: 'Origem não autorizada' });
  }
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, async () => {
  console.log(`✓ Servidor rodando na porta ${PORT}`);

  if (process.env.NODE_ENV === 'production') {
    try {
      await initializeDatabase();
    } catch (err) {
      console.error('✗ Erro na inicialização do banco:', err.message);
    }
  }
});

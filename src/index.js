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

app.use(cors());
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

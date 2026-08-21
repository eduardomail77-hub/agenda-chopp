import express from 'express';
import cors from 'cors';
import pedidosRoutes from './routes/pedidos.js';
import recursosRoutes from './routes/recursos.js';
import publicoRoutes from './routes/publico.js';
import { initializeDatabase } from './db/init.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/recursos', recursosRoutes);
app.use('/api/publico', publicoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

let initialized = false;

app.listen(PORT, async () => {
  console.log(`✓ Servidor rodando em http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);

  if (!initialized && process.env.NODE_ENV === 'production') {
    initialized = true;
    try {
      await initializeDatabase();
    } catch (err) {
      console.error('✗ Erro na inicialização:', err.message);
    }
  }
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pedidosRoutes from './routes/pedidos.js';
import recursosRoutes from './routes/recursos.js';
import publicoRoutes from './routes/publico.js';

dotenv.config();

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

app.listen(PORT, () => {
  console.log(`✓ Servidor rodando em http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});

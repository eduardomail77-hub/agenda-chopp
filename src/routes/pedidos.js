import express from 'express';
import {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  confirmPedido,
  deletePedido,
} from '../controllers/pedidosController.js';

const router = express.Router();

// GET /api/pedidos - Listar todos os pedidos (com filtros opcionais)
router.get('/', getPedidos);

// GET /api/pedidos/:id - Buscar pedido específico
router.get('/:id', getPedidoById);

// POST /api/pedidos - Criar novo pedido
router.post('/', createPedido);

// PATCH /api/pedidos/:id - Atualizar pedido
router.patch('/:id', updatePedido);

// POST /api/pedidos/:id/confirmar - Confirmar pedido
router.post('/:id/confirmar', confirmPedido);

// DELETE /api/pedidos/:id - Deletar pedido
router.delete('/:id', deletePedido);

export default router;

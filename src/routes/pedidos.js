import express from 'express';
import {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  confirmPedido,
  deletePedido,
} from '../controllers/pedidosController.js';
import { exigirAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/pedidos - Listar todos os pedidos (com filtros opcionais)
router.get('/', getPedidos);

// GET /api/pedidos/:id - Buscar pedido específico
router.get('/:id', getPedidoById);

// POST /api/pedidos - Criar novo pedido
router.post('/', createPedido);

// PATCH /api/pedidos/:id - Atualizar pedido
router.patch('/:id', updatePedido);

// POST /api/pedidos/:id/confirmar - Confirmar pedido (só admin: ocupa a frota e dispara o aviso)
router.post('/:id/confirmar', exigirAdmin, confirmPedido);

// DELETE /api/pedidos/:id - Deletar pedido (só admin)
router.delete('/:id', exigirAdmin, deletePedido);

export default router;

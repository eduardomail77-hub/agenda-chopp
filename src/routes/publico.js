import express from 'express';
import { createPedido } from '../controllers/pedidosController.js';

const router = express.Router();

// POST /api/publico/agendar - Cliente cria pedido (origem: cliente)
router.post('/agendar', async (req, res) => {
  try {
    const { cliente, telefone, data_entrega, gas, valor_entrega_coleta, itens, chopeiras } = req.body;

    if (!cliente || !telefone || !data_entrega || !itens?.length || !chopeiras?.length) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    // Validação de data
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEntrega = new Date(data_entrega + 'T00:00:00');
    if (dataEntrega < hoje) {
      return res.status(400).json({ erro: 'Data não pode ser no passado' });
    }

    // Chamar controller (reutiliza a lógica)
    const pedidoData = {
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
      origem: 'cliente', // diferencia do admin
    };

    // Simular resposta (sem banco real)
    const newId = Math.floor(Math.random() * 10000);
    const response = {
      id: newId,
      ...pedidoData,
      google_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    res.status(201).json({
      sucesso: true,
      mensagem: 'Pedido criado! Aguardando confirmação da Fora da Lei.',
      pedido: response,
    });
  } catch (err) {
    console.error('Erro ao criar pedido público:', err);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
});

export default router;

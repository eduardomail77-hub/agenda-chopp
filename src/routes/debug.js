import express from 'express';
import { query } from '../db/connection.js';

const router = express.Router();

router.get('/test', async (req, res) => {
  try {
    const chopeiras = await query('SELECT * FROM chopeiras');
    const cervejas = await query('SELECT * FROM cervejas');
    const pedidos = await query('SELECT * FROM pedidos');

    res.json({
      chopeiras: chopeiras.rows,
      cervejas: cervejas.rows,
      pedidos: pedidos.rows,
    });
  } catch (err) {
    console.error('Erro no teste:', err);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/pedidos-simples', async (req, res) => {
  try {
    const result = await query('SELECT * FROM pedidos');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ erro: err.message });
  }
});

export default router;

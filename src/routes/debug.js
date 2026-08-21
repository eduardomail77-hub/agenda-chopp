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

router.get('/simple', (req, res) => {
  res.json({ ok: true, message: 'Backend is working' });
});

router.get('/pedidos-query', async (req, res) => {
  try {
    console.log('Testando query de pedidos...');
    const result = await query('SELECT * FROM pedidos LIMIT 5');
    console.log('Query executada com sucesso:', result.rows.length, 'linhas');
    res.json({ success: true, count: result.rows.length, rows: result.rows });
  } catch (err) {
    console.error('Erro na query:', err.message, err.code);
    res.status(500).json({ erro: err.message, code: err.code });
  }
});

export default router;

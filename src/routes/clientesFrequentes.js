import crypto from 'node:crypto';
import express from 'express';
import { query } from '../db/connection.js';

// O acesso é restrito a administrador em src/index.js
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, nome, telefone, endereco, token, ativo FROM clientes_frequentes ORDER BY nome ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar clientes frequentes:', err.message);
    res.status(500).json({ erro: 'Erro ao listar clientes frequentes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, telefone, endereco } = req.body;
    if (!nome?.trim() || !telefone?.trim()) {
      return res.status(400).json({ erro: 'Nome e telefone são obrigatórios' });
    }
    // Token aleatório de 128 bits: o link é a única chave de acesso aos dados
    const token = crypto.randomBytes(16).toString('hex');
    const { rows } = await query(
      `INSERT INTO clientes_frequentes (nome, telefone, endereco, token)
       VALUES ($1,$2,$3,$4) RETURNING id, nome, telefone, endereco, token, ativo`,
      [nome.trim(), telefone.trim(), endereco?.trim() || null, token]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar cliente frequente:', err.message);
    res.status(500).json({ erro: 'Erro ao criar cliente frequente' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, telefone, endereco, ativo } = req.body;
    const { rows } = await query(
      `UPDATE clientes_frequentes SET
         nome = COALESCE($1, nome),
         telefone = COALESCE($2, telefone),
         endereco = CASE WHEN $3::bool THEN $4 ELSE endereco END,
         ativo = COALESCE($5, ativo)
       WHERE id = $6 RETURNING id, nome, telefone, endereco, token, ativo`,
      [
        nome ?? null,
        telefone ?? null,
        Object.prototype.hasOwnProperty.call(req.body, 'endereco'),
        endereco?.trim() || null,
        ativo ?? null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar cliente frequente:', err.message);
    res.status(500).json({ erro: 'Erro ao atualizar cliente frequente' });
  }
});

/** Gera um link novo e invalida o antigo, caso ele tenha vazado. */
router.post('/:id/novo-link', async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    const { rows } = await query(
      'UPDATE clientes_frequentes SET token = $1 WHERE id = $2 RETURNING id, token',
      [token, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao gerar novo link:', err.message);
    res.status(500).json({ erro: 'Erro ao gerar novo link' });
  }
});

export default router;

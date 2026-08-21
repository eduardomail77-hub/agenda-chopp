import express from 'express';
import { query, transacao } from '../db/connection.js';

// O acesso a estas rotas já é restrito a administrador em src/index.js
const router = express.Router();

const STATUS_VALIDOS = ['nova', 'respondida', 'convertida', 'perdida'];

async function comItens(cotacao) {
  const { rows } = await query(
    'SELECT cerveja, litros, valor_litro FROM cotacao_itens WHERE cotacao_id = $1 ORDER BY id',
    [cotacao.id]
  );
  return { ...cotacao, itens: rows };
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let sql = 'SELECT * FROM cotacoes';

    if (status && STATUS_VALIDOS.includes(status)) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const { rows } = await query(sql, params);
    res.json(await Promise.all(rows.map(comItens)));
  } catch (err) {
    console.error('Erro ao listar cotações:', err.message);
    res.status(500).json({ erro: 'Erro ao listar cotações' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM cotacoes WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ erro: 'Cotação não encontrada' });
    res.json(await comItens(rows[0]));
  } catch (err) {
    console.error('Erro ao buscar cotação:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar cotação' });
  }
});

/** Preenche os valores da cotação antes de mandar para o cliente. */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      itens,
      valor_entrega_coleta,
      desconto,
      status,
      data_entrega,
      hora_entrega,
      data_coleta,
      hora_coleta,
      tipo_chopeira,
      observacoes,
    } = req.body;

    const atual = await query('SELECT * FROM cotacoes WHERE id = $1', [id]);
    if (atual.rows.length === 0) return res.status(404).json({ erro: 'Cotação não encontrada' });

    if (status && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const temCampo = (n) => Object.prototype.hasOwnProperty.call(req.body, n);
    const EDITAVEIS = [
      'valor_entrega_coleta', 'desconto', 'status', 'data_entrega', 'hora_entrega',
      'data_coleta', 'hora_coleta', 'tipo_chopeira', 'observacoes',
    ];
    const alvos = EDITAVEIS.filter(temCampo);

    const atualizada = await transacao(async (client) => {
      let row = atual.rows[0];

      if (alvos.length > 0) {
        const sets = alvos.map((campo, i) => `${campo} = $${i + 1}`);
        const valores = alvos.map((c) => (req.body[c] === '' ? null : req.body[c]));

        // Marca quando a cotação foi respondida, para medir tempo de resposta depois
        const extra = status === 'respondida' ? ', resposta_em = CURRENT_TIMESTAMP' : '';

        const { rows } = await client.query(
          `UPDATE cotacoes SET ${sets.join(', ')}${extra} WHERE id = $${alvos.length + 1} RETURNING *`,
          [...valores, id]
        );
        row = rows[0];
      }

      if (itens?.length) {
        await client.query('DELETE FROM cotacao_itens WHERE cotacao_id = $1', [id]);
        for (const item of itens) {
          await client.query(
            'INSERT INTO cotacao_itens (cotacao_id, cerveja, litros, valor_litro) VALUES ($1,$2,$3,$4)',
            [id, item.cerveja, item.litros || null, item.valor_litro || null]
          );
        }
      }

      return row;
    });

    res.json(await comItens(atualizada));
  } catch (err) {
    console.error('Erro ao atualizar cotação:', err.message);
    res.status(500).json({ erro: 'Erro ao atualizar cotação' });
  }
});

/**
 * Cliente aceitou: a cotação vira pedido pendente.
 * Nasce pendente de propósito, a confirmação continua sendo o passo
 * que ocupa a frota e dispara os avisos.
 */
router.post('/:id/converter', async (req, res) => {
  try {
    const { id } = req.params;
    const { chopeiras, resp_entrega, resp_coleta } = req.body;

    const atual = await query('SELECT * FROM cotacoes WHERE id = $1', [id]);
    if (atual.rows.length === 0) return res.status(404).json({ erro: 'Cotação não encontrada' });

    const cotacao = await comItens(atual.rows[0]);

    if (cotacao.pedido_id) {
      return res.status(409).json({
        erro: 'Essa cotação já virou pedido',
        pedido_id: cotacao.pedido_id,
      });
    }
    if (!chopeiras?.length) {
      return res.status(400).json({ erro: 'Escolha as chopeiras do pedido' });
    }
    if (!cotacao.itens.every((i) => i.litros > 0 && i.valor_litro > 0)) {
      return res.status(400).json({
        erro: 'Preencha litros e valor por litro de cada cerveja antes de converter',
      });
    }

    const pedido = await transacao(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO pedidos
           (cliente, telefone, endereco, data_entrega, hora_entrega, data_coleta, hora_coleta,
            valor_entrega_coleta, desconto, resp_entrega, resp_coleta, status, origem, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pendente','cotacao',$12)
         RETURNING *`,
        [
          cotacao.cliente,
          cotacao.telefone,
          cotacao.endereco,
          cotacao.data_entrega,
          cotacao.hora_entrega,
          cotacao.data_coleta,
          cotacao.hora_coleta,
          cotacao.valor_entrega_coleta || 0,
          cotacao.desconto || 0,
          resp_entrega || null,
          resp_coleta || null,
          req.usuario.id,
        ]
      );

      const novo = rows[0];

      for (const item of cotacao.itens) {
        await client.query(
          'INSERT INTO pedido_itens (pedido_id, cerveja, litros, valor_litro) VALUES ($1,$2,$3,$4)',
          [novo.id, item.cerveja, item.litros, item.valor_litro]
        );
      }
      for (const chop of chopeiras) {
        await client.query(
          'INSERT INTO pedido_chopeiras (pedido_id, chopeira_id) VALUES ($1,$2)',
          [novo.id, chop]
        );
      }

      await client.query(
        "UPDATE cotacoes SET status = 'convertida', pedido_id = $1 WHERE id = $2",
        [novo.id, id]
      );

      return novo;
    });

    res.status(201).json(pedido);
  } catch (err) {
    console.error('Erro ao converter cotação:', err.message);
    res.status(500).json({ erro: 'Erro ao converter cotação em pedido' });
  }
});

export default router;

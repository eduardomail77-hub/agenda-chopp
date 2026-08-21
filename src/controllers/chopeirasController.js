import { query } from '../db/connection.js';

export async function getChopeiras(req, res) {
  try {
    const result = await query(
      'SELECT * FROM chopeiras ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar chopeiras:', err);
    res.status(500).json({ erro: 'Erro ao buscar chopeiras' });
  }
}

export async function getChopeirasDisponiveisPorData(req, res) {
  try {
    const { data } = req.query;

    if (!data) {
      return res.status(400).json({ erro: 'Data é obrigatória' });
    }

    // A chopeira fica presa da entrega até o recolhimento, não só no dia da entrega
    const result = await query(
      `SELECT c.*,
        (SELECT p.cliente FROM pedidos p
         JOIN pedido_chopeiras pc ON p.id = pc.pedido_id
         WHERE pc.chopeira_id = c.id
           AND p.status = 'confirmado'
           AND $1::date BETWEEN p.data_entrega AND COALESCE(p.data_coleta, p.data_entrega)
         LIMIT 1) as ocupada_por
      FROM chopeiras c
      WHERE c.ativo = true
      ORDER BY c.id ASC`,
      [data]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar disponibilidade de chopeiras:', err);
    res.status(500).json({ erro: 'Erro ao buscar disponibilidade de chopeiras' });
  }
}

export async function getCervejas(req, res) {
  try {
    // Ordem de venda primeiro, alfabética como desempate
    const result = await query(
      'SELECT * FROM cervejas ORDER BY ordem ASC, nome ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar cervejas:', err);
    res.status(500).json({ erro: 'Erro ao buscar cervejas' });
  }
}

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

    const result = await query(
      `SELECT c.*,
        (SELECT p.cliente FROM pedidos p
         JOIN pedido_chopeiras pc ON p.id = pc.pedido_id
         WHERE pc.chopeira_id = c.id AND p.data_entrega = $1 AND p.status = 'confirmado') as ocupada_por
      FROM chopeiras c
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
    const result = await query(
      'SELECT * FROM cervejas ORDER BY nome ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar cervejas:', err);
    res.status(500).json({ erro: 'Erro ao buscar cervejas' });
  }
}

import { query } from '../db/connection.js';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/googleCalendarService.js';

export async function getPedidos(req, res) {
  try {
    const { status, data_inicio, data_fim } = req.query;

    let sql = 'SELECT * FROM pedidos';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (data_inicio) {
      conditions.push(`data_entrega >= $${params.length + 1}`);
      params.push(data_inicio);
    }

    if (data_fim) {
      conditions.push(`data_entrega <= $${params.length + 1}`);
      params.push(data_fim);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY data_entrega ASC';

    const result = await query(sql, params);

    const pedidos = await Promise.all(
      result.rows.map(async (pedido) => {
        const itens = await query('SELECT cerveja, litros, valor_litro FROM pedido_itens WHERE pedido_id = $1', [pedido.id]);
        const chopeiras = await query('SELECT chopeira_id FROM pedido_chopeiras WHERE pedido_id = $1', [pedido.id]);
        return {
          ...pedido,
          itens: itens.rows,
          chopeiras: chopeiras.rows.map((c) => c.chopeira_id),
        };
      })
    );

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
}

export async function getPedidoById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*,
        json_agg(
          json_build_object(
            'cerveja', pi.cerveja,
            'litros', pi.litros,
            'valor_litro', pi.valor_litro
          )
        ) FILTER (WHERE pi.id IS NOT NULL) as itens,
        array_agg(DISTINCT pc.chopeira_id) FILTER (WHERE pc.chopeira_id IS NOT NULL) as chopeiras
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON p.id = pi.pedido_id
      LEFT JOIN pedido_chopeiras pc ON p.id = pc.pedido_id
      WHERE p.id = $1
      GROUP BY p.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
}

export async function createPedido(req, res) {
  const client = await query('BEGIN');

  try {
    const {
      cliente,
      telefone,
      data_entrega,
      gas,
      valor_entrega_coleta,
      pago,
      resp_entrega,
      resp_coleta,
      status = 'pendente',
      origem = 'interno',
      itens,
      chopeiras,
    } = req.body;

    // Validação básica
    if (!cliente || !telefone || !data_entrega || !itens || itens.length === 0 || !chopeiras || chopeiras.length === 0) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    // Inserir pedido
    const pedidoResult = await query(
      `INSERT INTO pedidos (cliente, telefone, data_entrega, gas, valor_entrega_coleta, pago, resp_entrega, resp_coleta, status, origem)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [cliente, telefone, data_entrega, gas, valor_entrega_coleta, pago, resp_entrega || null, resp_coleta || null, status, origem]
    );

    const pedidoId = pedidoResult.rows[0].id;

    // Inserir itens
    for (const item of itens) {
      await query(
        'INSERT INTO pedido_itens (pedido_id, cerveja, litros, valor_litro) VALUES ($1, $2, $3, $4)',
        [pedidoId, item.cerveja, item.litros, item.valor_litro]
      );
    }

    // Inserir chopeiras
    for (const chop of chopeiras) {
      await query(
        'INSERT INTO pedido_chopeiras (pedido_id, chopeira_id) VALUES ($1, $2)',
        [pedidoId, chop]
      );
    }

    await query('COMMIT');

    res.status(201).json(pedidoResult.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Erro ao criar pedido:', err);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
}

export async function updatePedido(req, res) {
  const client = await query('BEGIN');

  try {
    const { id } = req.params;
    const { cliente, telefone, resp_entrega, resp_coleta, pago, itens, chopeiras } = req.body;

    // Buscar pedido atual
    const currentResult = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const currentPedido = currentResult.rows[0];

    // Atualizar dados do pedido
    const updateResult = await query(
      `UPDATE pedidos
      SET cliente = COALESCE($1, cliente),
          telefone = COALESCE($2, telefone),
          resp_entrega = COALESCE($3, resp_entrega),
          resp_coleta = COALESCE($4, resp_coleta),
          pago = COALESCE($5, pago),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [cliente || null, telefone || null, resp_entrega || null, resp_coleta || null, pago !== undefined ? pago : null, id]
    );

    // Atualizar itens se fornecidos
    if (itens && itens.length > 0) {
      await query('DELETE FROM pedido_itens WHERE pedido_id = $1', [id]);
      for (const item of itens) {
        await query(
          'INSERT INTO pedido_itens (pedido_id, cerveja, litros, valor_litro) VALUES ($1, $2, $3, $4)',
          [id, item.cerveja, item.litros, item.valor_litro]
        );
      }
    }

    // Atualizar chopeiras se fornecidas
    if (chopeiras && chopeiras.length > 0) {
      await query('DELETE FROM pedido_chopeiras WHERE pedido_id = $1', [id]);
      for (const chop of chopeiras) {
        await query(
          'INSERT INTO pedido_chopeiras (pedido_id, chopeira_id) VALUES ($1, $2)',
          [id, chop]
        );
      }
    }

    await query('COMMIT');

    res.json(updateResult.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Erro ao atualizar pedido:', err);
    res.status(500).json({ erro: 'Erro ao atualizar pedido' });
  }
}

export async function confirmPedido(req, res) {
  try {
    const { id } = req.params;

    // Buscar pedido
    const pedidoResult = await query(
      `SELECT p.*,
        json_agg(
          json_build_object(
            'cerveja', pi.cerveja,
            'litros', pi.litros,
            'valor_litro', pi.valor_litro
          )
        ) FILTER (WHERE pi.id IS NOT NULL) as itens,
        array_agg(DISTINCT pc.chopeira_id) FILTER (WHERE pc.chopeira_id IS NOT NULL) as chopeiras
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON p.id = pi.pedido_id
      LEFT JOIN pedido_chopeiras pc ON p.id = pc.pedido_id
      WHERE p.id = $1
      GROUP BY p.id`,
      [id]
    );

    if (pedidoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.status === 'confirmado') {
      return res.status(400).json({ erro: 'Pedido já confirmado' });
    }

    // Criar evento no Google Calendar
    let googleEventId = null;
    try {
      googleEventId = await createGoogleCalendarEvent(pedido);
    } catch (err) {
      console.error('Erro ao criar evento no Google Calendar:', err);
      // Continuar mesmo se o Google Calendar falhar
    }

    // Atualizar status para confirmado
    const updateResult = await query(
      'UPDATE pedidos SET status = $1, google_event_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['confirmado', googleEventId, id]
    );

    res.json(updateResult.rows[0]);
  } catch (err) {
    console.error('Erro ao confirmar pedido:', err);
    res.status(500).json({ erro: 'Erro ao confirmar pedido' });
  }
}

export async function deletePedido(req, res) {
  try {
    const { id } = req.params;

    // Buscar Google Event ID
    const result = await query('SELECT google_event_id FROM pedidos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const { google_event_id } = result.rows[0];

    // Deletar evento do Google Calendar se existir
    if (google_event_id) {
      try {
        await deleteGoogleCalendarEvent(google_event_id);
      } catch (err) {
        console.error('Erro ao deletar evento do Google Calendar:', err);
      }
    }

    // Deletar pedido (cascata deleta itens e chopeiras)
    await query('DELETE FROM pedidos WHERE id = $1', [id]);

    res.json({ mensagem: 'Pedido deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar pedido:', err);
    res.status(500).json({ erro: 'Erro ao deletar pedido' });
  }
}

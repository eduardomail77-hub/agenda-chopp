import { query, transacao } from '../db/connection.js';
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '../services/googleCalendarService.js';

async function carregarDetalhes(pedido) {
  const itens = await query(
    'SELECT cerveja, litros, valor_litro FROM pedido_itens WHERE pedido_id = $1',
    [pedido.id]
  );
  const chopeiras = await query(
    'SELECT chopeira_id FROM pedido_chopeiras WHERE pedido_id = $1 ORDER BY chopeira_id',
    [pedido.id]
  );
  return {
    ...pedido,
    itens: itens.rows,
    chopeiras: chopeiras.rows.map((c) => c.chopeira_id),
  };
}

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
    res.json(await Promise.all(result.rows.map(carregarDetalhes)));
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
}

export async function getPedidoById(req, res) {
  try {
    const { rows } = await query('SELECT * FROM pedidos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }
    res.json(await carregarDetalhes(rows[0]));
  } catch (err) {
    console.error('Erro ao buscar pedido:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
}

export async function createPedido(req, res) {
  try {
    const {
      cliente,
      telefone,
      data_entrega,
      gas = false,
      valor_entrega_coleta = 0,
      desconto = 0,
      pago = false,
      resp_entrega,
      resp_coleta,
      itens,
      chopeiras,
    } = req.body;

    if (!cliente || !data_entrega || !itens?.length || !chopeiras?.length) {
      return res.status(400).json({
        erro: 'Cliente, data, pelo menos uma cerveja e pelo menos uma chopeira são obrigatórios',
      });
    }
    if (Number(desconto) < 0 || Number(valor_entrega_coleta) < 0) {
      return res.status(400).json({ erro: 'Valores não podem ser negativos' });
    }

    const pedido = await transacao(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO pedidos
           (cliente, telefone, data_entrega, gas, valor_entrega_coleta, desconto,
            pago, resp_entrega, resp_coleta, status, origem, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente','interno',$10)
         RETURNING *`,
        [
          cliente,
          telefone || null,
          data_entrega,
          gas,
          valor_entrega_coleta,
          desconto,
          pago,
          resp_entrega || null,
          resp_coleta || null,
          req.usuario.id,
        ]
      );

      const novo = rows[0];

      for (const item of itens) {
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

      return novo;
    });

    res.status(201).json(await carregarDetalhes(pedido));
  } catch (err) {
    console.error('Erro ao criar pedido:', err.message);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
}

export async function updatePedido(req, res) {
  try {
    const { id } = req.params;
    const {
      cliente,
      telefone,
      data_entrega,
      gas,
      valor_entrega_coleta,
      desconto,
      pago,
      resp_entrega,
      resp_coleta,
      itens,
      chopeiras,
    } = req.body;

    const atual = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const atualizado = await transacao(async (client) => {
      const { rows } = await client.query(
        `UPDATE pedidos SET
           cliente = COALESCE($1, cliente),
           telefone = COALESCE($2, telefone),
           data_entrega = COALESCE($3, data_entrega),
           gas = COALESCE($4, gas),
           valor_entrega_coleta = COALESCE($5, valor_entrega_coleta),
           desconto = COALESCE($6, desconto),
           pago = COALESCE($7, pago),
           resp_entrega = COALESCE($8, resp_entrega),
           resp_coleta = COALESCE($9, resp_coleta),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 RETURNING *`,
        [
          cliente ?? null,
          telefone ?? null,
          data_entrega ?? null,
          gas ?? null,
          valor_entrega_coleta ?? null,
          desconto ?? null,
          pago ?? null,
          resp_entrega ?? null,
          resp_coleta ?? null,
          id,
        ]
      );

      if (itens?.length) {
        await client.query('DELETE FROM pedido_itens WHERE pedido_id = $1', [id]);
        for (const item of itens) {
          await client.query(
            'INSERT INTO pedido_itens (pedido_id, cerveja, litros, valor_litro) VALUES ($1,$2,$3,$4)',
            [id, item.cerveja, item.litros, item.valor_litro]
          );
        }
      }
      if (chopeiras?.length) {
        await client.query('DELETE FROM pedido_chopeiras WHERE pedido_id = $1', [id]);
        for (const chop of chopeiras) {
          await client.query(
            'INSERT INTO pedido_chopeiras (pedido_id, chopeira_id) VALUES ($1,$2)',
            [id, chop]
          );
        }
      }

      return rows[0];
    });

    const completo = await carregarDetalhes(atualizado);

    // Se já estava confirmado, o evento na agenda precisa refletir a mudança
    if (completo.google_event_id) {
      try {
        await updateGoogleCalendarEvent(completo.google_event_id, completo);
      } catch (err) {
        console.error('Pedido salvo, mas falhou ao atualizar o Google Agenda:', err.message);
        return res.json({
          ...completo,
          aviso: 'Pedido salvo, mas não consegui atualizar o evento no Google Agenda',
        });
      }
    }

    res.json(completo);
  } catch (err) {
    console.error('Erro ao atualizar pedido:', err.message);
    res.status(500).json({ erro: 'Erro ao atualizar pedido' });
  }
}

export async function confirmPedido(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }
    if (rows[0].status === 'confirmado') {
      return res.status(400).json({ erro: 'Pedido já confirmado' });
    }

    const pedido = await carregarDetalhes(rows[0]);

    // Se a agenda falhar, o pedido NÃO é confirmado em silêncio:
    // confirmar sem aviso é pior do que não confirmar.
    let googleEventId;
    try {
      googleEventId = await createGoogleCalendarEvent(pedido);
    } catch (err) {
      console.error('Erro ao criar evento no Google Agenda:', err.message);
      return res.status(502).json({
        erro: 'Não consegui criar o evento no Google Agenda, o pedido continua pendente',
        detalhe: err.message,
      });
    }

    const atualizado = await query(
      `UPDATE pedidos SET status = 'confirmado', google_event_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [googleEventId, id]
    );

    res.json(await carregarDetalhes(atualizado.rows[0]));
  } catch (err) {
    console.error('Erro ao confirmar pedido:', err.message);
    res.status(500).json({ erro: 'Erro ao confirmar pedido' });
  }
}

export async function deletePedido(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    if (rows[0].google_event_id) {
      try {
        await deleteGoogleCalendarEvent(rows[0].google_event_id);
      } catch (err) {
        console.error('Falhou ao remover evento da agenda:', err.message);
      }
    }

    await transacao(async (client) => {
      await client.query('DELETE FROM pedido_itens WHERE pedido_id = $1', [id]);
      await client.query('DELETE FROM pedido_chopeiras WHERE pedido_id = $1', [id]);
      await client.query('DELETE FROM pedidos WHERE id = $1', [id]);
    });

    res.json({ mensagem: 'Pedido deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar pedido:', err.message);
    res.status(500).json({ erro: 'Erro ao deletar pedido' });
  }
}

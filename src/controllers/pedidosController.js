import { query, transacao } from '../db/connection.js';
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '../services/googleCalendarService.js';

const soData = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).split('T')[0] : null);

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
      endereco,
      data_entrega,
      hora_entrega,
      data_coleta,
      hora_coleta,
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
    if (data_coleta && data_coleta < data_entrega) {
      return res.status(400).json({ erro: 'O recolhimento não pode ser antes da entrega' });
    }

    const pedido = await transacao(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO pedidos
           (cliente, telefone, endereco, data_entrega, hora_entrega, data_coleta, hora_coleta,
            gas, valor_entrega_coleta, desconto, pago, resp_entrega, resp_coleta,
            status, origem, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pendente','interno',$14)
         RETURNING *`,
        [
          cliente,
          telefone || null,
          endereco || null,
          data_entrega,
          hora_entrega || null,
          data_coleta || null,
          hora_coleta || null,
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
      endereco,
      data_entrega,
      hora_entrega,
      data_coleta,
      hora_coleta,
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

    // Pedido confirmado já ocupa frota e tem evento na agenda, então só admin mexe.
    // Baixar pagamento continua liberado, é rotina de quem está na rua.
    if (atual.rows[0].status === 'confirmado' && req.usuario.perfil !== 'admin') {
      const campos = Object.keys(req.body);
      const soPagamento = campos.length > 0 && campos.every((c) => c === 'pago');
      if (!soPagamento) {
        return res.status(403).json({
          erro: 'Pedido já confirmado, só um administrador pode alterar',
        });
      }
    }

    const temCampo = (nome) => Object.prototype.hasOwnProperty.call(req.body, nome);

    const entregaFinal = temCampo('data_entrega')
      ? data_entrega
      : soData(atual.rows[0].data_entrega);
    const coletaFinal = temCampo('data_coleta') ? data_coleta : soData(atual.rows[0].data_coleta);
    if (coletaFinal && entregaFinal && coletaFinal < entregaFinal) {
      return res.status(400).json({ erro: 'O recolhimento não pode ser antes da entrega' });
    }
    if (temCampo('data_entrega') && !data_entrega) {
      return res.status(400).json({ erro: 'A data de entrega é obrigatória' });
    }

    // Monta o UPDATE apenas com o que veio no corpo. Usar COALESCE aqui impediria
    // limpar um campo, por exemplo tirar o responsável que já estava definido.
    const EDITAVEIS = [
      'cliente', 'telefone', 'endereco', 'data_entrega', 'hora_entrega',
      'data_coleta', 'hora_coleta', 'gas', 'valor_entrega_coleta',
      'desconto', 'pago', 'resp_entrega', 'resp_coleta',
    ];

    const alvos = EDITAVEIS.filter(temCampo);
    const valores = alvos.map((campo) => {
      const v = req.body[campo];
      // Campo de texto ou data em branco vira null, não string vazia
      return v === '' ? null : v;
    });

    const atualizado = await transacao(async (client) => {
      let atualizadoRow = atual.rows[0];

      if (alvos.length > 0) {
        const sets = alvos.map((campo, i) => `${campo} = $${i + 1}`);
        const { rows } = await client.query(
          `UPDATE pedidos SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $${alvos.length + 1} RETURNING *`,
          [...valores, id]
        );
        atualizadoRow = rows[0];
      }

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

      return atualizadoRow;
    });

    const completo = await carregarDetalhes(atualizado);

    // Se já estava confirmado, os eventos na agenda precisam refletir a mudança
    if (completo.google_event_entrega) {
      try {
        const ids = await updateGoogleCalendarEvent(completo);
        if (ids.coleta && ids.coleta !== completo.google_event_coleta) {
          await query('UPDATE pedidos SET google_event_coleta = $1 WHERE id = $2', [ids.coleta, id]);
          completo.google_event_coleta = ids.coleta;
        }
      } catch (err) {
        console.error('Pedido salvo, mas falhou ao atualizar o Google Agenda:', err.message);
        return res.json({
          ...completo,
          aviso: 'Pedido salvo, mas não consegui atualizar os eventos no Google Agenda',
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
    let ids;
    try {
      ids = await createGoogleCalendarEvent(pedido);
    } catch (err) {
      console.error('Erro ao criar evento no Google Agenda:', err.message);
      return res.status(502).json({
        erro: 'Não consegui criar os eventos no Google Agenda, o pedido continua pendente',
        detalhe: err.message,
      });
    }

    const atualizado = await query(
      `UPDATE pedidos SET status = 'confirmado',
         google_event_entrega = $1, google_event_coleta = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [ids.entrega, ids.coleta, id]
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

    for (const eventId of [rows[0].google_event_entrega, rows[0].google_event_coleta]) {
      if (!eventId) continue;
      try {
        await deleteGoogleCalendarEvent(eventId);
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

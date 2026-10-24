import { query } from '../db/connection.js';

/**
 * Chopeiras já presas por pedido CONFIRMADO em qualquer dia do período
 * entrega até recolhimento (sem recolhimento, vale só o dia da entrega).
 * `ignorarPedidoId` serve pra edição e confirmação não colidirem com o próprio pedido.
 */
export async function chopeirasEmConflito(chopeiras, dataEntrega, dataColeta, ignorarPedidoId = null) {
  if (!chopeiras?.length || !dataEntrega) return [];

  const { rows } = await query(
    `SELECT DISTINCT pc.chopeira_id, p.cliente
     FROM pedido_chopeiras pc
     JOIN pedidos p ON p.id = pc.pedido_id
     WHERE p.status = 'confirmado'
       AND pc.chopeira_id = ANY($1::text[])
       AND ($4::int IS NULL OR p.id <> $4)
       AND p.data_entrega <= COALESCE($3::date, $2::date)
       AND COALESCE(p.data_coleta, p.data_entrega) >= $2::date`,
    [chopeiras, dataEntrega, dataColeta || null, ignorarPedidoId]
  );
  return rows;
}

export const mensagemConflito = (conflitos) =>
  `Chopeira já ocupada nessas datas: ${conflitos
    .map((c) => `${c.chopeira_id} (${c.cliente})`)
    .join(', ')}`;

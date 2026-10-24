const soData = (v) => (v ? String(v).split('T')[0] : '');

/**
 * Chopeiras presas por pedido confirmado em qualquer dia do período
 * entrega até recolhimento. Sem recolhimento, conta só o dia da entrega.
 * Devolve Map id da chopeira para nome do cliente que ocupa.
 */
export function chopeirasOcupadas(orders, dataEntrega, dataColeta, ignorarId = null) {
  const mapa = new Map();
  if (!dataEntrega) return mapa;
  const fim = dataColeta || dataEntrega;

  orders.forEach((o) => {
    if (o.id === ignorarId || o.status !== 'confirmado') return;
    const ini = soData(o.data_entrega);
    const ate = soData(o.data_coleta) || ini;
    if (ini <= fim && ate >= dataEntrega) {
      o.chopeiras?.forEach((c) => mapa.set(c, o.cliente));
    }
  });
  return mapa;
}

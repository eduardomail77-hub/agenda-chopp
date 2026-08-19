export function validarPedido(pedido, chopeiras) {
  const erros = [];

  // Validação de campos obrigatórios
  if (!pedido.cliente?.trim()) erros.push('Cliente é obrigatório');
  if (!pedido.telefone?.trim()) erros.push('Telefone é obrigatório');
  if (!pedido.data_entrega) erros.push('Data de entrega é obrigatória');
  if (!pedido.itens || pedido.itens.length === 0) erros.push('Adicione pelo menos uma cerveja');
  if (!pedido.chopeiras || pedido.chopeiras.length === 0) erros.push('Selecione pelo menos uma chopeira');

  // Validação de itens
  const itensValidos = pedido.itens.filter((it) => it.cerveja && it.litros && it.valor_litro);
  if (itensValidos.length === 0) erros.push('Todos os itens devem ter cerveja, litros e preço');

  // Validação de capacidade por vias
  const chopeirasSel = chopeiras.filter((c) => pedido.chopeiras.includes(c.id));
  const viasTotais = chopeirasSel.reduce((sum, c) => sum + c.vias, 0);
  const numCervejas = pedido.itens.filter((it) => it.cerveja && it.litros).length;

  if (viasTotais < numCervejas) {
    erros.push(
      `Capacidade insuficiente: ${viasTotais} via(s) para ${numCervejas} cerveja(s). Equipe pode revezar rótulos.`
    );
  }

  // Validação de valor de entrega
  if (Number(pedido.valor_entrega_coleta) < 0) {
    erros.push('Valor de entrega não pode ser negativo');
  }

  // Validação de data
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataEntrega = new Date(pedido.data_entrega + 'T00:00:00');
  if (dataEntrega < hoje) {
    erros.push('Data de entrega não pode ser no passado');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

export function calcularTotal(pedido) {
  const totalCervejas = (pedido.itens || []).reduce(
    (sum, it) => sum + (Number(it.litros) || 0) * (Number(it.valor_litro) || 0),
    0
  );
  return totalCervejas + (Number(pedido.valor_entrega_coleta) || 0);
}

export function totalLitros(pedido) {
  return (pedido.itens || []).reduce((sum, it) => sum + (Number(it.litros) || 0), 0);
}

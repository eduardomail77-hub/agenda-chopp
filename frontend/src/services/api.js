const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function getPedidos(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.data_inicio) params.append('data_inicio', filters.data_inicio);
  if (filters.data_fim) params.append('data_fim', filters.data_fim);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_URL}/pedidos${query}`);
  if (!res.ok) throw new Error('Erro ao buscar pedidos');
  return res.json();
}

export async function getPedidoById(id) {
  const res = await fetch(`${API_URL}/pedidos/${id}`);
  if (!res.ok) throw new Error('Erro ao buscar pedido');
  return res.json();
}

export async function createPedido(data) {
  const res = await fetch(`${API_URL}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao criar pedido');
  return res.json();
}

export async function updatePedido(id, data) {
  const res = await fetch(`${API_URL}/pedidos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao atualizar pedido');
  return res.json();
}

export async function confirmPedido(id) {
  const res = await fetch(`${API_URL}/pedidos/${id}/confirmar`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Erro ao confirmar pedido');
  return res.json();
}

export async function deletePedido(id) {
  const res = await fetch(`${API_URL}/pedidos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao deletar pedido');
  return res.json();
}

export async function getChopeiras() {
  const res = await fetch(`${API_URL}/recursos/chopeiras`);
  if (!res.ok) throw new Error('Erro ao buscar chopeiras');
  return res.json();
}

export async function getChopeirasDisponiveis(data) {
  const res = await fetch(`${API_URL}/recursos/chopeiras/disponibles?data=${data}`);
  if (!res.ok) throw new Error('Erro ao buscar disponibilidade');
  return res.json();
}

export async function getCervejas() {
  const res = await fetch(`${API_URL}/recursos/cervejas`);
  if (!res.ok) throw new Error('Erro ao buscar cervejas');
  return res.json();
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const CHAVE_TOKEN = 'agenda_chopp_token';
const CHAVE_USUARIO = 'agenda_chopp_usuario';

export function getToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function getUsuarioSalvo() {
  const bruto = localStorage.getItem(CHAVE_USUARIO);
  try {
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function sair() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
}

/** Chamada autenticada. Mensagem de erro vem do backend quando existe. */
async function req(caminho, opcoes = {}) {
  const headers = { ...(opcoes.headers || {}) };
  if (opcoes.body) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers });

  if (res.status === 401) {
    sair();
    window.dispatchEvent(new Event('sessao-expirada'));
    throw new Error('Sessão expirada, entre de novo');
  }

  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    throw new Error(dados?.erro || dados?.detalhe || 'Erro na requisição');
  }
  return dados;
}

/* ---------- Autenticação ---------- */

export async function login(email, senha) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const dados = await res.json();
  if (!res.ok) throw new Error(dados?.erro || 'Erro ao entrar');

  localStorage.setItem(CHAVE_TOKEN, dados.token);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(dados.usuario));
  return dados.usuario;
}

export const trocarSenha = (senha_atual, senha_nova) =>
  req('/auth/trocar-senha', { method: 'POST', body: JSON.stringify({ senha_atual, senha_nova }) });

/* ---------- Pedidos ---------- */

export function getPedidos(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.status) params.append('status', filtros.status);
  if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
  if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
  const qs = params.toString() ? `?${params}` : '';
  return req(`/pedidos${qs}`);
}

export const getPedidoById = (id) => req(`/pedidos/${id}`);

export const createPedido = (data) =>
  req('/pedidos', { method: 'POST', body: JSON.stringify(data) });

export const updatePedido = (id, data) =>
  req(`/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const confirmPedido = (id) => req(`/pedidos/${id}/confirmar`, { method: 'POST' });

export const deletePedido = (id) => req(`/pedidos/${id}`, { method: 'DELETE' });

/* ---------- Catálogo ---------- */

export const getChopeiras = () => req('/recursos/chopeiras');
export const getChopeirasDisponiveis = (data) =>
  req(`/recursos/chopeiras/disponibles?data=${data}`);
export const getCervejas = () => req('/recursos/cervejas');

/* ---------- Configurações ---------- */

export const getUsuarios = () => req('/config/usuarios');

export const criarUsuario = (data) =>
  req('/config/usuarios', { method: 'POST', body: JSON.stringify(data) });

export const atualizarUsuario = (id, data) =>
  req(`/config/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const getPreferencias = () => req('/config/preferencias');

export const salvarPreferencias = (data) =>
  req('/config/preferencias', { method: 'PUT', body: JSON.stringify(data) });

export const criarCerveja = (data) =>
  req('/config/cervejas', { method: 'POST', body: JSON.stringify(data) });

export const atualizarCerveja = (id, data) =>
  req(`/config/cervejas/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const criarChopeira = (data) =>
  req('/config/chopeiras', { method: 'POST', body: JSON.stringify(data) });

export const atualizarChopeira = (id, data) =>
  req(`/config/chopeiras/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const getStatusGoogle = () => req('/config/google/status');

/* ---------- Cotações ---------- */

export const getCotacoes = (status) =>
  req(`/cotacoes${status ? `?status=${status}` : ''}`);

export const atualizarCotacao = (id, data) =>
  req(`/cotacoes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const converterCotacao = (id, data) =>
  req(`/cotacoes/${id}/converter`, { method: 'POST', body: JSON.stringify(data) });

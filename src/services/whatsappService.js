import { query } from '../db/connection.js';

const API = 'https://graph.facebook.com/v21.0';

const TOKEN = () => process.env.WHATSAPP_TOKEN;
const PHONE_ID = () => process.env.WHATSAPP_PHONE_ID;
const TEMPLATE = () => process.env.WHATSAPP_TEMPLATE_COTACAO || 'aviso_cotacao';

export const whatsappConfigurado = () => Boolean(TOKEN() && PHONE_ID());

/** Número no formato que a Meta aceita: só dígitos, com o 55 na frente. */
function normalizar(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

/**
 * A Meta recusa parâmetro com quebra de linha, tabulação ou espaços seguidos.
 * Também corta o que for longo demais para não estourar o limite do modelo.
 */
const limpar = (texto, max = 120) =>
  String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'não informado';

async function enviarTemplate(numero, parametros) {
  const to = normalizar(numero);
  if (!to) return { ok: false, erro: 'telefone inválido' };

  const resposta = await fetch(`${API}/${PHONE_ID()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: TEMPLATE(),
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: parametros.map((texto) => ({ type: 'text', text: texto })),
          },
        ],
      },
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    const detalhe = dados?.error?.message || 'erro desconhecido';
    console.error(`WhatsApp recusou o envio para ${to}:`, detalhe);
    return { ok: false, erro: detalhe };
  }

  return { ok: true, id: dados?.messages?.[0]?.id };
}

/**
 * Avisa os administradores que entrou cotação nova.
 *
 * Só administrador recebe, porque cotação é assunto de quem precifica.
 * Falha aqui não pode derrubar o envio do cliente, então o erro é registrado
 * e a vida segue: o aviso no Google Agenda continua valendo como rede de apoio.
 */
export async function avisarCotacaoPorWhatsApp(cotacao) {
  if (!whatsappConfigurado()) return { enviados: 0, motivo: 'não configurado' };

  const { rows } = await query(
    `SELECT nome, telefone FROM usuarios
     WHERE perfil = 'admin' AND ativo = true AND recebe_aviso = true
       AND telefone IS NOT NULL AND telefone <> ''`
  );

  if (rows.length === 0) {
    console.warn('Nenhum administrador com telefone cadastrado para avisar por WhatsApp');
    return { enviados: 0, motivo: 'ninguém com telefone' };
  }

  const cervejas =
    cotacao.itens?.map((i) => `${i.cerveja} ${Number(i.litros) || '?'}L`).join(', ') ||
    'não informado';

  const data = cotacao.data_entrega
    ? String(cotacao.data_entrega).split('T')[0].split('-').reverse().join('/')
    : 'a combinar';
  const hora = cotacao.hora_entrega ? ` ${String(cotacao.hora_entrega).slice(0, 5)}` : '';

  const parametros = [
    limpar(cotacao.cliente, 60),
    limpar(cotacao.telefone, 20),
    limpar(`${data}${hora}`, 30),
    limpar(cervejas, 100),
  ];

  let enviados = 0;
  for (const admin of rows) {
    try {
      const r = await enviarTemplate(admin.telefone, parametros);
      if (r.ok) enviados += 1;
    } catch (err) {
      console.error(`Falhou o WhatsApp para ${admin.nome}:`, err.message);
    }
  }

  console.log(`Aviso de cotação enviado por WhatsApp para ${enviados}/${rows.length} admin(s)`);
  return { enviados, total: rows.length };
}

/** Usado pela tela de configurações para mostrar se a integração está de pé. */
export async function testarWhatsApp() {
  if (!whatsappConfigurado()) {
    return { ok: false, erro: 'WHATSAPP_TOKEN e WHATSAPP_PHONE_ID não configurados' };
  }

  try {
    const resposta = await fetch(`${API}/${PHONE_ID()}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      return { ok: false, erro: dados?.error?.message || 'não consegui falar com a Meta' };
    }

    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM usuarios
       WHERE perfil = 'admin' AND ativo = true AND recebe_aviso = true
         AND telefone IS NOT NULL AND telefone <> ''`
    );

    return {
      ok: true,
      numero: dados.display_phone_number,
      nome: dados.verified_name,
      template: TEMPLATE(),
      admins_com_telefone: rows[0].n,
    };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

import { query } from '../db/connection.js';

const API = 'https://graph.facebook.com/v21.0';

const TOKEN = () => process.env.WHATSAPP_TOKEN;
const PHONE_ID = () => process.env.WHATSAPP_PHONE_ID;
const TEMPLATE = () => process.env.WHATSAPP_TEMPLATE_COTACAO || 'aviso_cotacao';
const TEMPLATE_AGENDA = () => process.env.WHATSAPP_TEMPLATE_AGENDA || 'agenda_diaria';
const FUSO = 'America/Sao_Paulo';

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

async function enviarTemplate(numero, nomeModelo, parametros) {
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
        name: nomeModelo,
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
    // Só os 4 últimos dígitos no log, o bastante pra depurar sem expor o número inteiro
    const marcado = String(admin.telefone).replace(/\D/g, '').slice(-4);
    try {
      const r = await enviarTemplate(admin.telefone, TEMPLATE(), parametros);
      if (r.ok) {
        enviados += 1;
        console.log(`WhatsApp enviado para ${admin.nome} (...${marcado}), id ${r.id}`);
      } else {
        console.error(`WhatsApp NÃO enviado para ${admin.nome} (...${marcado}):`, r.erro);
      }
    } catch (err) {
      console.error(`Falhou o WhatsApp para ${admin.nome} (...${marcado}):`, err.message);
    }
  }

  console.log(`Aviso de cotação enviado por WhatsApp para ${enviados}/${rows.length} admin(s)`);
  return { enviados, total: rows.length };
}

const soData = (v) => (v ? String(v).split('T')[0] : null);
const soHora = (v) => (v ? String(v).slice(0, 5) : null);

/**
 * Monta a agenda de hoje: cada pedido confirmado entra como um evento de
 * entrega e/ou um de coleta, conforme a data de cada etapa bater com hoje.
 */
async function montarEventosDeHoje(hoje) {
  const { rows: pedidos } = await query(
    `SELECT cliente, data_entrega, hora_entrega, data_coleta, hora_coleta, resp_entrega, resp_coleta
     FROM pedidos
     WHERE status = 'confirmado' AND (data_entrega = $1::date OR data_coleta = $1::date)`,
    [hoje]
  );

  const eventos = [];
  for (const p of pedidos) {
    if (soData(p.data_entrega) === hoje) {
      eventos.push({
        hora: soHora(p.hora_entrega),
        tipo: 'Entrega',
        cliente: p.cliente,
        responsavel: p.resp_entrega,
      });
    }
    if (soData(p.data_coleta) === hoje) {
      eventos.push({
        hora: soHora(p.hora_coleta),
        tipo: 'Coleta',
        cliente: p.cliente,
        responsavel: p.resp_coleta,
      });
    }
  }

  eventos.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
  return eventos;
}

/**
 * Lembrete das 9h com a agenda do dia.
 *
 * Só dispara quando há algo marcado pra hoje. Vai pros administradores (que
 * têm "recebe aviso" ligado) e pra quem estiver como responsável de entrega
 * ou coleta hoje — este último recebe mesmo com o aviso geral desligado,
 * porque é entrega dele, não um FYI qualquer. Mesma pessoa, mesmo telefone,
 * recebe uma mensagem só.
 */
export async function enviarAgendaDiaria() {
  if (!whatsappConfigurado()) return { enviados: 0, motivo: 'não configurado' };

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
  const eventos = await montarEventosDeHoje(hoje);

  if (eventos.length === 0) {
    console.log('Agenda diária: nada marcado para hoje, nenhum aviso enviado');
    return { enviados: 0, motivo: 'sem entregas hoje' };
  }

  const linha = eventos
    .map((e) => {
      const resp = e.responsavel ? ` (${e.responsavel})` : '';
      return `${e.hora || '--:--'} ${e.tipo} · ${e.cliente}${resp}`;
    })
    .join(' | ');

  const parametros = [limpar(linha, 900)];

  const nomesResponsaveis = [...new Set(eventos.map((e) => e.responsavel).filter(Boolean))];

  const { rows: candidatos } = await query(
    `SELECT DISTINCT nome, telefone FROM usuarios
     WHERE ativo = true AND telefone IS NOT NULL AND telefone <> ''
       AND ((perfil = 'admin' AND recebe_aviso = true) OR nome = ANY($1::text[]))`,
    [nomesResponsaveis]
  );

  // Mesma pessoa pode entrar duas vezes (por nome parecido, ou ser admin e
  // responsável ao mesmo tempo); o telefone normalizado é quem decide.
  const porTelefone = new Map();
  for (const c of candidatos) {
    const chave = normalizar(c.telefone);
    if (chave && !porTelefone.has(chave)) porTelefone.set(chave, c);
  }

  if (porTelefone.size === 0) {
    console.warn('Agenda diária: ninguém com telefone pra avisar hoje');
    return { enviados: 0, motivo: 'ninguém com telefone', eventos: eventos.length };
  }

  let enviados = 0;
  for (const pessoa of porTelefone.values()) {
    const marcado = String(pessoa.telefone).replace(/\D/g, '').slice(-4);
    try {
      const r = await enviarTemplate(pessoa.telefone, TEMPLATE_AGENDA(), parametros);
      if (r.ok) {
        enviados += 1;
        console.log(`Agenda diária enviada para ${pessoa.nome} (...${marcado}), id ${r.id}`);
      } else {
        console.error(`Agenda diária NÃO enviada para ${pessoa.nome} (...${marcado}):`, r.erro);
      }
    } catch (err) {
      console.error(`Falhou a agenda diária para ${pessoa.nome} (...${marcado}):`, err.message);
    }
  }

  console.log(
    `Agenda diária: ${eventos.length} evento(s), enviada para ${enviados}/${porTelefone.size} pessoa(s)`
  );
  return { enviados, total: porTelefone.size, eventos: eventos.length };
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

import { google } from 'googleapis';
import { query } from '../db/connection.js';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });
const FUSO = 'America/Sao_Paulo';

let idEmCache = null;

/**
 * Devolve o calendário que o sistema usa, criando um se preciso.
 *
 * Um calendário criado na conta pessoal de alguém é invisível para a service
 * account, e foi isso que quebrou a integração antes. Aqui a própria service
 * account cria e vira dona do calendário, o que permite lançar evento e dar
 * acesso à equipe sem depender de configuração manual no Google.
 */
async function garantirCalendario() {
  if (idEmCache) return idEmCache;

  const candidatos = [];
  try {
    const { rows } = await query("SELECT valor FROM configuracoes WHERE chave = 'google_calendar_id'");
    if (rows[0]?.valor) candidatos.push(rows[0].valor);
  } catch {
    // banco ainda subindo, segue para o env
  }
  if (process.env.GOOGLE_CALENDAR_ID) candidatos.push(process.env.GOOGLE_CALENDAR_ID);

  for (const id of candidatos) {
    try {
      await calendar.calendars.get({ calendarId: id });
      idEmCache = id;
      return id;
    } catch {
      // não acessível, tenta o próximo
    }
  }

  const { data } = await calendar.calendars.insert({
    requestBody: { summary: 'Agenda de Chopp · Fora da Lei', timeZone: FUSO },
  });

  await query(
    `INSERT INTO configuracoes (chave, valor) VALUES ('google_calendar_id', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = $1, updated_at = CURRENT_TIMESTAMP`,
    [data.id]
  );

  console.log('Calendário criado pelo sistema:', data.id);
  idEmCache = data.id;
  return data.id;
}

const soData = (valor) =>
  valor instanceof Date ? valor.toISOString().split('T')[0] : String(valor).split('T')[0];

/** Junta data e hora no formato que o Google espera para evento com horário. */
function inicioFim(data, hora, duracaoMin = 60) {
  const h = (hora || '10:00').slice(0, 5);
  const inicio = `${soData(data)}T${h}:00`;

  const [hh, mm] = h.split(':').map(Number);
  const fim = new Date(Date.UTC(2000, 0, 1, hh, mm + duracaoMin));
  const fimStr = `${String(fim.getUTCHours()).padStart(2, '0')}:${String(fim.getUTCMinutes()).padStart(2, '0')}`;

  return {
    start: { dateTime: inicio, timeZone: FUSO },
    end: { dateTime: `${soData(data)}T${fimStr}:00`, timeZone: FUSO },
  };
}

async function lembretesConfigurados() {
  try {
    const { rows } = await query("SELECT valor FROM configuracoes WHERE chave = 'lembretes'");
    const minutos = (rows[0]?.valor || '2880,1440,60')
      .split(',')
      .map((m) => parseInt(m.trim(), 10))
      .filter((m) => Number.isInteger(m) && m >= 0 && m <= 40320);

    // O Google aceita no máximo 5 lembretes por evento
    return minutos.slice(0, 5).map((minutes) => ({ method: 'popup', minutes }));
  } catch (err) {
    console.error('Erro ao ler lembretes, usando padrão:', err.message);
    return [2880, 1440, 60].map((minutes) => ({ method: 'popup', minutes }));
  }
}

function resumoFinanceiro(pedido) {
  const subtotal = (pedido.itens || []).reduce(
    (s, i) => s + Number(i.litros || 0) * Number(i.valor_litro || 0),
    0
  );
  const entrega = Number(pedido.valor_entrega_coleta || 0);
  const desconto = Number(pedido.desconto || 0);
  return { subtotal, entrega, desconto, total: subtotal + entrega - desconto };
}

function descricao(pedido, etapa) {
  const cervejas =
    pedido.itens?.map((i) => `${i.cerveja} (${Number(i.litros)}L)`).join(', ') || 'N/A';
  const chopeiras = pedido.chopeiras?.join(', ') || 'N/A';
  const { subtotal, entrega, desconto, total } = resumoFinanceiro(pedido);

  const linhas = [
    `Cliente: ${pedido.cliente}`,
    `Telefone: ${pedido.telefone || 'N/A'}`,
    `Endereço: ${pedido.endereco || 'A confirmar'}`,
    '',
    `Cervejas: ${cervejas}`,
    `Chopeiras: ${chopeiras}`,
    `Gás: ${pedido.gas ? 'Sim' : 'Não'}`,
    '',
    `Entrega: ${soData(pedido.data_entrega).split('-').reverse().join('/')} às ${(pedido.hora_entrega || '10:00').slice(0, 5)} · ${pedido.resp_entrega || 'a definir'}`,
    `Recolhimento: ${pedido.data_coleta ? soData(pedido.data_coleta).split('-').reverse().join('/') : 'a definir'} às ${(pedido.hora_coleta || '10:00').slice(0, 5)} · ${pedido.resp_coleta || 'a definir'}`,
  ];

  if (etapa === 'entrega') {
    linhas.push(
      '',
      `Chopp: R$ ${subtotal.toFixed(2)}`,
      `Entrega, instalação e chopeira: R$ ${entrega.toFixed(2)}`,
      `Desconto: R$ ${desconto.toFixed(2)}`,
      `Total: R$ ${total.toFixed(2)}`,
      `Pago: ${pedido.pago ? 'Sim' : 'Não'}`
    );
  }

  return linhas.join('\n');
}

async function montarEvento(pedido, etapa) {
  const ehEntrega = etapa === 'entrega';
  const data = ehEntrega ? pedido.data_entrega : pedido.data_coleta;
  const hora = ehEntrega ? pedido.hora_entrega : pedido.hora_coleta;
  const responsavel = ehEntrega ? pedido.resp_entrega : pedido.resp_coleta;

  return {
    summary: `${ehEntrega ? 'Entrega' : 'Recolhimento'} · ${pedido.cliente}${responsavel ? ` (${responsavel})` : ''}`,
    location: pedido.endereco || undefined,
    description: descricao(pedido, etapa),
    ...inicioFim(data, hora),
    reminders: { useDefault: false, overrides: await lembretesConfigurados() },
  };
}

/**
 * Cria os dois eventos do pedido: entrega e recolhimento.
 * Devolve os ids para o pedido guardar.
 */
export async function createGoogleCalendarEvent(pedido) {
  const calendarId = await garantirCalendario();

  const entrega = await calendar.events.insert({
    calendarId,
    requestBody: await montarEvento(pedido, 'entrega'),
  });

  let coletaId = null;
  if (pedido.data_coleta) {
    const coleta = await calendar.events.insert({
      calendarId,
      requestBody: await montarEvento(pedido, 'coleta'),
    });
    coletaId = coleta.data.id;
  }

  console.log('Eventos criados no Google Agenda:', entrega.data.id, coletaId);
  return { entrega: entrega.data.id, coleta: coletaId };
}

export async function updateGoogleCalendarEvent(pedido) {
  const calendarId = await garantirCalendario();

  const entregaId = pedido.google_event_entrega;
  let coletaId = pedido.google_event_coleta;

  if (entregaId) {
    await calendar.events.update({
      calendarId,
      eventId: entregaId,
      requestBody: await montarEvento(pedido, 'entrega'),
    });
  }

  if (pedido.data_coleta) {
    if (coletaId) {
      await calendar.events.update({
        calendarId,
        eventId: coletaId,
        requestBody: await montarEvento(pedido, 'coleta'),
      });
    } else {
      // Data de recolhimento preenchida depois da confirmação
      const novo = await calendar.events.insert({
        calendarId,
        requestBody: await montarEvento(pedido, 'coleta'),
      });
      coletaId = novo.data.id;
    }
  }

  return { entrega: entregaId, coleta: coletaId };
}

export async function deleteGoogleCalendarEvent(eventId) {
  if (!eventId) return;

  try {
    await calendar.events.delete({ calendarId: await garantirCalendario(), eventId });
  } catch (err) {
    // Evento removido na mão não deve derrubar a exclusão do pedido
    if (err.code === 404 || err.code === 410) return;
    throw err;
  }
}

/**
 * Dá acesso de leitura ao calendário para um e-mail do Google.
 * É assim que o aviso chega no celular: a pessoa passa a enxergar
 * o calendário no app do Google Agenda e recebe os lembretes dos eventos.
 */
export async function compartilharCalendario(email) {
  if (!email) return;

  try {
    await calendar.acl.insert({
      calendarId: await garantirCalendario(),
      requestBody: { role: 'reader', scope: { type: 'user', value: email } },
      sendNotifications: true,
    });
    console.log('Calendário compartilhado com', email);
  } catch (err) {
    if (err.code === 409) return; // já tinha acesso
    console.error(`Não consegui compartilhar o calendário com ${email}:`, err.message);
  }
}

export async function removerAcessoCalendario(email) {
  if (!email) return;

  try {
    await calendar.acl.delete({
      calendarId: await garantirCalendario(),
      ruleId: `user:${email}`,
    });
    console.log('Acesso ao calendário removido de', email);
  } catch (err) {
    if (err.code === 404) return;
    console.error(`Não consegui remover o acesso de ${email}:`, err.message);
  }
}

/**
 * Avisa a equipe que entrou cotação nova.
 *
 * Vira um evento curto começando agora, com lembrete em zero minuto: o Google
 * dispara a notificação na hora, no celular de quem enxerga o calendário. É o
 * jeito de avisar sem custo por mensagem, já que WhatsApp API é cobrado.
 */
export async function avisarCotacaoNova(cotacao) {
  const calendarId = await garantirCalendario();

  const agora = new Date();
  const fim = new Date(agora.getTime() + 15 * 60 * 1000);
  const cervejas =
    cotacao.itens?.map((i) => `${i.cerveja}${i.litros ? ` (${Number(i.litros)}L)` : ''}`).join(', ') ||
    'não informado';

  const tipo = {
    eletrica: 'Elétrica (tem 220V no local)',
    gelo: 'Gelo (sem energia)',
    indiferente: 'Sem preferência',
  }[cotacao.tipo_chopeira] || 'Sem preferência';

  const descricao = [
    `Cotação #${cotacao.id}`,
    '',
    `Cliente: ${cotacao.cliente}`,
    `Telefone: ${cotacao.telefone}`,
    `Endereço: ${cotacao.endereco || 'não informado'}`,
    cotacao.pessoas ? `Pessoas: ${cotacao.pessoas}` : null,
    '',
    `Cervejas: ${cervejas}`,
    `Chopeira: ${tipo}`,
    '',
    `Entrega: ${soData(cotacao.data_entrega).split('-').reverse().join('/')}${cotacao.hora_entrega ? ` às ${String(cotacao.hora_entrega).slice(0, 5)}` : ''}`,
    cotacao.data_coleta
      ? `Recolhimento: ${soData(cotacao.data_coleta).split('-').reverse().join('/')}${cotacao.hora_coleta ? ` às ${String(cotacao.hora_coleta).slice(0, 5)}` : ''}`
      : 'Recolhimento: a combinar',
    cotacao.observacoes ? `\nObservações: ${cotacao.observacoes}` : null,
    '',
    'Responda pela aba Cotações no sistema.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Cotação nova · ${cotacao.cliente}`,
      description: descricao,
      start: { dateTime: agora.toISOString(), timeZone: FUSO },
      end: { dateTime: fim.toISOString(), timeZone: FUSO },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    },
  });

  console.log('Aviso de cotação criado na agenda:', data.id);
  return data.id;
}

/**
 * Garante que todo mundo marcado para receber aviso enxergue o calendário.
 * Roda na subida do servidor porque uma pessoa pode ter sido cadastrada
 * enquanto o Google estava fora, ou antes do calendário existir.
 */
export async function sincronizarAcessos() {
  try {
    const { rows } = await query(
      'SELECT email FROM usuarios WHERE ativo = true AND recebe_aviso = true'
    );
    for (const { email } of rows) {
      await compartilharCalendario(email);
    }
    if (rows.length) console.log(`✓ Acesso ao calendário conferido para ${rows.length} pessoa(s)`);
  } catch (err) {
    console.error('Não consegui sincronizar os acessos ao calendário:', err.message);
  }
}

/** Usado pela tela de configurações para mostrar se a integração está de pé. */
export async function testarConexao() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, erro: 'Credenciais do Google não configuradas' };
  }

  try {
    const calendarId = await garantirCalendario();
    const { data } = await calendar.calendars.get({ calendarId });
    return { ok: true, calendario: data.summary, calendarId };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

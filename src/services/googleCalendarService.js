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
const calendarId = () => process.env.GOOGLE_CALENDAR_ID;

/** Data em YYYY-MM-DD, que é o formato exigido para evento de dia inteiro. */
function soData(valor) {
  if (valor instanceof Date) return valor.toISOString().split('T')[0];
  return String(valor).split('T')[0];
}

function diaSeguinte(data) {
  const d = new Date(`${soData(data)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

async function lembretesConfigurados() {
  try {
    const { rows } = await query("SELECT valor FROM configuracoes WHERE chave = 'lembretes'");
    const bruto = rows[0]?.valor || '2880,1440,60';
    const minutos = bruto
      .split(',')
      .map((m) => parseInt(m.trim(), 10))
      .filter((m) => Number.isInteger(m) && m >= 0 && m <= 40320);

    // O Google aceita no máximo 5 lembretes por evento
    return minutos.slice(0, 5).map((minutes) => ({ method: 'popup', minutes }));
  } catch (err) {
    console.error('Erro ao ler lembretes, usando padrão:', err.message);
    return [
      { method: 'popup', minutes: 2880 },
      { method: 'popup', minutes: 1440 },
      { method: 'popup', minutes: 60 },
    ];
  }
}

function montarDescricao(pedido) {
  const cervejas =
    pedido.itens?.map((i) => `${i.cerveja} (${i.litros}L)`).join(', ') || 'N/A';
  const chopeiras = pedido.chopeiras?.join(', ') || 'N/A';

  const subtotal = (pedido.itens || []).reduce(
    (soma, i) => soma + Number(i.litros || 0) * Number(i.valor_litro || 0),
    0
  );
  const entrega = Number(pedido.valor_entrega_coleta || 0);
  const desconto = Number(pedido.desconto || 0);
  const total = subtotal + entrega - desconto;

  return [
    `Cliente: ${pedido.cliente}`,
    `Telefone: ${pedido.telefone || 'N/A'}`,
    `Cervejas: ${cervejas}`,
    `Chopeiras: ${chopeiras}`,
    `Gás: ${pedido.gas ? 'Sim' : 'Não'}`,
    `Entrega: ${pedido.resp_entrega || 'A definir'}`,
    `Coleta: ${pedido.resp_coleta || 'A definir'}`,
    '',
    `Chopp: R$ ${subtotal.toFixed(2)}`,
    `Entrega, instalação e chopeira: R$ ${entrega.toFixed(2)}`,
    `Desconto: R$ ${desconto.toFixed(2)}`,
    `Total: R$ ${total.toFixed(2)}`,
    `Pago: ${pedido.pago ? 'Sim' : 'Não'}`,
  ].join('\n');
}

async function montarEvento(pedido) {
  return {
    summary: `Chopp · ${pedido.cliente}`,
    description: montarDescricao(pedido),
    start: { date: soData(pedido.data_entrega) },
    end: { date: diaSeguinte(pedido.data_entrega) },
    reminders: {
      useDefault: false,
      overrides: await lembretesConfigurados(),
    },
  };
}

export async function createGoogleCalendarEvent(pedido) {
  if (!calendarId()) {
    console.warn('GOOGLE_CALENDAR_ID não configurado, pulando criação de evento');
    return null;
  }

  const response = await calendar.events.insert({
    calendarId: calendarId(),
    requestBody: await montarEvento(pedido),
  });

  console.log('Evento criado no Google Agenda:', response.data.id);
  return response.data.id;
}

export async function updateGoogleCalendarEvent(googleEventId, pedido) {
  if (!googleEventId || !calendarId()) return null;

  const response = await calendar.events.update({
    calendarId: calendarId(),
    eventId: googleEventId,
    requestBody: await montarEvento(pedido),
  });

  console.log('Evento atualizado no Google Agenda:', response.data.id);
  return response.data.id;
}

export async function deleteGoogleCalendarEvent(googleEventId) {
  if (!googleEventId || !calendarId()) return;

  try {
    await calendar.events.delete({ calendarId: calendarId(), eventId: googleEventId });
    console.log('Evento removido do Google Agenda:', googleEventId);
  } catch (err) {
    // Evento já removido na mão não deve derrubar a exclusão do pedido
    if (err.code === 404 || err.code === 410) return;
    throw err;
  }
}

/**
 * Dá acesso de leitura ao calendário para um e-mail do Google.
 * É assim que o aviso chega no celular: a pessoa passa a enxergar
 * o calendário no app do Google Agenda e recebe os lembretes do evento.
 */
export async function compartilharCalendario(email) {
  if (!calendarId() || !email) return;

  try {
    await calendar.acl.insert({
      calendarId: calendarId(),
      requestBody: {
        role: 'reader',
        scope: { type: 'user', value: email },
      },
      sendNotifications: true,
    });
    console.log('Calendário compartilhado com', email);
  } catch (err) {
    if (err.code === 409) return; // já tinha acesso
    console.error(`Não consegui compartilhar o calendário com ${email}:`, err.message);
  }
}

export async function removerAcessoCalendario(email) {
  if (!calendarId() || !email) return;

  try {
    await calendar.acl.delete({
      calendarId: calendarId(),
      ruleId: `user:${email}`,
    });
    console.log('Acesso ao calendário removido de', email);
  } catch (err) {
    if (err.code === 404) return;
    console.error(`Não consegui remover o acesso de ${email}:`, err.message);
  }
}

/** Usado pela tela de configurações para mostrar se a integração está de pé. */
export async function testarConexao() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, erro: 'Credenciais do Google não configuradas' };
  }
  if (!calendarId()) {
    return { ok: false, erro: 'GOOGLE_CALENDAR_ID não configurado' };
  }

  try {
    const { data } = await calendar.calendars.get({ calendarId: calendarId() });
    return { ok: true, calendario: data.summary };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

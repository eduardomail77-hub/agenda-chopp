import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

export async function createGoogleCalendarEvent(pedido) {
  try {
    if (!process.env.GOOGLE_CALENDAR_ID) {
      console.warn('GOOGLE_CALENDAR_ID não configurado, pulando criação de evento');
      return null;
    }

    const cervejasList = pedido.itens
      ?.map((item) => `${item.cerveja} (${item.litros}L)`)
      .join(', ') || 'N/A';

    const chopeirasText = pedido.chopeiras?.join(', ') || 'N/A';

    const descricao = `
Cliente: ${pedido.cliente}
Telefone: ${pedido.telefone}
Cervejas: ${cervejasList}
Chopeiras: ${chopeirasText}
Gás: ${pedido.gas ? 'Sim' : 'Não'}
Entrega: ${pedido.resp_entrega || 'A definir'}
Coleta: ${pedido.resp_coleta || 'A definir'}
Total: R$ ${parseFloat(pedido.valor_entrega_coleta).toFixed(2)}
Pago: ${pedido.pago ? 'Sim' : 'Não'}
    `.trim();

    const event = {
      summary: `Chopp - ${pedido.cliente}`,
      description: descricao,
      start: {
        date: pedido.data_entrega,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        date: new Date(new Date(pedido.data_entrega).getTime() + 86400000)
          .toISOString()
          .split('T')[0],
        timeZone: 'America/Sao_Paulo',
      },
      attendees: [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'notification', minutes: 2880 }, // 2 dias
          { method: 'notification', minutes: 1440 }, // 1 dia
          { method: 'notification', minutes: 0 }, // no dia
        ],
      },
    };

    // Adicionar responsáveis como convidados
    if (pedido.resp_entrega) {
      event.attendees.push({ email: `${pedido.resp_entrega.toLowerCase().replace(/\s+/g, '.')}@foradaleibrew.com` });
    }
    if (pedido.resp_coleta && pedido.resp_coleta !== pedido.resp_entrega) {
      event.attendees.push({ email: `${pedido.resp_coleta.toLowerCase().replace(/\s+/g, '.')}@foradaleibrew.com` });
    }

    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: event,
    });

    console.log('Evento do Google Calendar criado:', response.data.id);
    return response.data.id;
  } catch (err) {
    console.error('Erro ao criar evento no Google Calendar:', err);
    throw err;
  }
}

export async function updateGoogleCalendarEvent(googleEventId, pedido) {
  try {
    if (!googleEventId || !process.env.GOOGLE_CALENDAR_ID) {
      console.warn('googleEventId ou GOOGLE_CALENDAR_ID não disponível');
      return null;
    }

    const cervejasList = pedido.itens
      ?.map((item) => `${item.cerveja} (${item.litros}L)`)
      .join(', ') || 'N/A';

    const chopeirasText = pedido.chopeiras?.join(', ') || 'N/A';

    const descricao = `
Cliente: ${pedido.cliente}
Telefone: ${pedido.telefone}
Cervejas: ${cervejasList}
Chopeiras: ${chopeirasText}
Gás: ${pedido.gas ? 'Sim' : 'Não'}
Entrega: ${pedido.resp_entrega || 'A definir'}
Coleta: ${pedido.resp_coleta || 'A definir'}
Total: R$ ${parseFloat(pedido.valor_entrega_coleta).toFixed(2)}
Pago: ${pedido.pago ? 'Sim' : 'Não'}
    `.trim();

    const updatedEvent = {
      description: descricao,
    };

    const response = await calendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId: googleEventId,
      requestBody: updatedEvent,
    });

    console.log('Evento do Google Calendar atualizado:', response.data.id);
    return response.data.id;
  } catch (err) {
    console.error('Erro ao atualizar evento no Google Calendar:', err);
    throw err;
  }
}

export async function deleteGoogleCalendarEvent(googleEventId) {
  try {
    if (!googleEventId || !process.env.GOOGLE_CALENDAR_ID) {
      console.warn('googleEventId ou GOOGLE_CALENDAR_ID não disponível');
      return;
    }

    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId: googleEventId,
    });

    console.log('Evento do Google Calendar deletado:', googleEventId);
  } catch (err) {
    console.error('Erro ao deletar evento do Google Calendar:', err);
    throw err;
  }
}

import cron from 'node-cron';
import { enviarAgendaDiaria } from './whatsappService.js';

/**
 * Lembrete diário das 9h com a agenda de entregas e coletas do dia.
 * Roda uma vez, no processo que está de pé às 9h — não há fila nem worker
 * separado, então redeploys por perto do horário podem atrasar em minutos.
 */
export function iniciarAgendador() {
  cron.schedule(
    '0 9 * * *',
    () => {
      enviarAgendaDiaria().catch((err) =>
        console.error('Falhou o envio da agenda diária:', err.message)
      );
    },
    { timezone: 'America/Sao_Paulo' }
  );

  console.log('✓ Agendador da agenda diária ligado (9h, América/São_Paulo)');
}

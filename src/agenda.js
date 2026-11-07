import { listAgendaEvents, updateAgendaEvent } from './store.js';

const REMINDER_WINDOW_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
let activeTimer;

export function startAgendaScheduler(sock) {
  if (activeTimer) clearInterval(activeTimer);
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const now = Date.now();
      const events = await listAgendaEvents();
      for (const event of events) {
        const reminderAt = event.timestamp - REMINDER_WINDOW_MS;
        if (event.reminderSent || now < reminderAt || now >= event.timestamp) continue;
        try {
          await sock.sendMessage(event.chatJid, {
            text: `🔔 *LEMBRETE DE EVENTO*\n\n📅 ${event.name}\n⏰ Começa em 10 minutos!\n🗓️ ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.timestamp))}`,
          });
          await updateAgendaEvent(event.id, { reminderSent: true });
        } catch (error) {
          console.error('[agenda] Não foi possível enviar o lembrete:', error?.message ?? error);
        }
      }
    } catch (error) {
      console.error('[agenda] Falha ao verificar eventos:', error?.message ?? error);
    } finally {
      checking = false;
    }
  };
  activeTimer = setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
  activeTimer.unref?.();
  void check();
  return () => {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = undefined;
  };
}

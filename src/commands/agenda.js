import { randomUUID } from 'node:crypto';
import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { addAgendaEvent, clearAgendaEvents, listAgendaEvents } from '../store.js';

const TIME_ZONE = 'America/Sao_Paulo';

function parseDateTime(dateText, timeText) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText ?? '');
  const time = /^(\d{2}):(\d{2})$/.exec(timeText ?? '');
  if (!date || !time) return null;
  const [, day, month, year] = date.map(Number);
  const [, hour, minute] = time.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > days) return null;
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(timestamp));
}

registerCommand({
  name: 'agenda-criar',
  role: 'membro',
  async execute(ctx) {
    const [dateText, timeText, ...nameParts] = ctx.args;
    const name = nameParts.join(' ').trim();
    const date = parseDateTime(dateText, timeText);
    if (!date || !name) {
      return ctx.reply(`📅 Uso: ${config.prefix}agenda-criar DD/MM/AAAA HH:MM nome do evento\nExemplo: ${config.prefix}agenda-criar 08/11/2026 14:30 Reunião`);
    }
    if (date.getTime() <= Date.now()) {
      return ctx.reply('⏰ A data e o horário precisam estar no futuro.');
    }
    const event = {
      id: randomUUID().slice(0, 8),
      chatJid: ctx.chatJid,
      chatName: ctx.chatJid.endsWith('@g.us') ? 'Grupo' : 'Conversa privada',
      name,
      timestamp: date.getTime(),
      reminderSent: false,
      createdBy: ctx.senderJid,
    };
    if (ctx.isGroup) {
      try { event.chatName = (await ctx.sock.groupMetadata(ctx.chatJid)).subject || event.chatName; } catch {}
    }
    await addAgendaEvent(event);
    await ctx.reply(`📅 *Evento agendado!*\n\n✨ ${name}\n🗓️ ${formatDate(event.timestamp)}\n🔔 Vou avisar 10 minutos antes neste chat.\n🆔 ID: ${event.id}`);
  },
});

registerCommand({
  name: 'agenda-lista',
  aliases: ['agenta-lista'],
  role: 'dono',
  async execute({ reply }) {
    const events = (await listAgendaEvents()).filter((event) => event.timestamp > Date.now());
    if (!events.length) return reply('📅 Não há eventos futuros salvos na agenda.');
    const lines = events.map((event, index) =>
      `${index + 1}. *${event.name}*\n   🗓️ ${formatDate(event.timestamp)}\n   💬 ${event.chatName || event.chatJid}\n   🆔 ${event.id}`
    );
    await reply(`📅 *AGENDA GLOBAL DA NYX*\n\n${lines.join('\n\n')}`);
  },
});

registerCommand({
  name: 'agenda-limpar',
  role: 'dono',
  async execute({ reply }) {
    const count = await clearAgendaEvents();
    await reply(count
      ? `🗑️ Agenda limpa! ${count} evento(s) removido(s) de todas as conversas.`
      : '📅 A agenda já está vazia.');
  },
});

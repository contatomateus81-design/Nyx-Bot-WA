import { getGroup, getGroupContext } from './store.js';
import { getText } from './utils.js';

export async function handleGroupMessage(sock, message) {
 const jid = message.key.remoteJid;
 if (!jid?.endsWith('@g.us') || message.key.fromMe) return;
 const settings = await getGroup(jid);
 if (!settings.antiLink) return;
 const text = getText(message);
 if (!/(chat\.whatsapp\.com\/|https?:\/\/|www\.)/i.test(text)) return;
 try {
  const g = await getGroupContext(sock, message, message.key.participant ?? '');
  if (g.isSenderAdmin || g.isOwner) return;
  await sock.sendMessage(jid, { delete: message.key });
  await sock.sendMessage(jid, { text: '🔗 Link removido pelas regras do grupo.' });
 } catch (error) {
  console.error('[anti-link]', error.message);
 }
}

export async function handleParticipantsUpdate(sock, update) {
 if (!update.id?.endsWith('@g.us') || !Array.isArray(update.participants)) return;
 const settings = await getGroup(update.id);
 if (!settings.welcome || update.action !== 'add') return;
 for (const participant of update.participants) {
  await sock.sendMessage(update.id, { text: `💜 Bem-vindo(a), @${participant.split('@')[0]}!`, mentions: [participant] });
 }
}

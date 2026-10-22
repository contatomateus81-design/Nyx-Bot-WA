import { getGroup } from './store.js';
import { getText, getGroupContext } from './utils.js';
import { renderWelcomeCard } from './welcome/render.js';

function participantNumber(jid = '') {
 const local = jid.split('@')[0].split(':')[0];
 const digits = local.replace(/\D/g, '');
 return digits || null;
}

export async function handleGroupMessage(sock, message) {
 const jid = message.key.remoteJid;
 if (!jid?.endsWith('@g.us') || message.key.fromMe) return;
 const settings = await getGroup(jid);
 if (!settings.antiLink) return;
 const text = getText(message);
 if (!/(chat\.whatsapp\.com\/|https?:\/\/|www\.)/i.test(text)) return;
 try {
  const g = await getGroupContext(sock, message, message.key.participant ?? '');
  if (g.isSenderAdmin) return;
  await sock.sendMessage(jid, { delete: message.key });
  await sock.sendMessage(jid, { text: '🔗 Link removido pelas regras do grupo.' });
 } catch (error) { console.error('[anti-link]', error.message); }
}

export async function handleParticipantsUpdate(sock, update) {
 if (!update.id?.endsWith('@g.us') || !Array.isArray(update.participants)) return;
 const settings = await getGroup(update.id);
 if (!settings.welcome || update.action !== 'add') return;
 for (const participant of update.participants) {
  const number = participantNumber(participant);
  const mention = number ? `@${number}` : '@membro';
  const details = {
   name: number ? `+${number}` : 'Novo membro',
   phone: number ? `+${number}` : 'Indisponível',
   mention,
   id: participant || null,
  };
  try {
   const image = await renderWelcomeCard(sock, participant, details);
   await sock.sendMessage(update.id, {
    image,
    caption: `💜 Bem-vindo(a), ${mention}!\nQue bom ter você por aqui.\n\n📱 Número: ${details.phone}\n🆔 ID: ${details.id ?? 'Indisponível'}`,
    mentions: [participant],
   });
  } catch (error) {
   console.error('[welcome] Não foi possível gerar a imagem:', error.message);
   await sock.sendMessage(update.id, {
    text: `💜 Bem-vindo(a), ${mention}!\n📱 Número: ${details.phone}\n🆔 ID: ${details.id ?? 'Indisponível'}`,
    mentions: [participant],
   });
  }
 }
}

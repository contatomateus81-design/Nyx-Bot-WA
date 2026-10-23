import { getGroup } from './store.js';
import { getText, getGroupContext } from './utils.js';
import { renderWelcomeCard } from './welcome/render.js';

// Retained for compatibility with the contact-cache listeners in index.js.
export function rememberContact() {}

const WELCOME_TEXT = '💜 𝕭𝖊𝖒 𝖛𝖎𝖓𝖉𝖔, 𝖓𝖔𝖛𝖔 𝖎𝖓𝖙𝖊𝖌𝖗𝖆𝖓𝖙𝖊 💜';

export async function triggerWelcomeTest(sock, chatJid, participantJid) {
 if (!chatJid?.endsWith('@g.us')) throw new Error('Este teste de evento só funciona em grupos.');
 const resolvedJid = await resolveParticipant(sock, participantJid);
 try {
  const image = await renderWelcomeCard(sock, resolvedJid);
  await sock.sendMessage(chatJid, { image, caption: WELCOME_TEXT });
 } catch (error) {
  console.error('[welcome:test] Não foi possível gerar a imagem:', error.message);
  await sock.sendMessage(chatJid, { text: WELCOME_TEXT });
 }
}

async function resolveParticipant(sock, jid) {
 if (!String(jid).endsWith('@lid')) return jid;
 try {
  const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
  if (typeof mapped === 'string' && mapped.includes('@s.whatsapp.net')) return mapped;
 } catch (error) {
  console.warn('[welcome] Não foi possível resolver o LID para obter a foto:', error.message);
 }
 return jid;
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
  await triggerWelcomeTest(sock, update.id, participant);
 }
}

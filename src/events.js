import { getGroup } from './store.js';
import { getText, getGroupContext } from './utils.js';
import { renderWelcomeCard } from './welcome/render.js';

// Retained for compatibility with the contact-cache listeners in index.js.
export function rememberContact() {}

const WELCOME_TEXT = '💜 𝕭𝖊𝖒 𝖛𝖎𝖓𝖉𝖔, 𝖓𝖔𝖛𝖔 𝖎𝖓𝖙𝖊𝖌𝖗𝖆𝖓𝖙𝖊 💜';
const WELCOME_MESSAGES = [
 'chegou mais uma pessoa pra nossa família! Fica à vontade 💜',
 'seja muito bem-vindo(a)! Esperamos que curta o grupo ✨',
 'olha quem chegou! Puxa uma cadeira e aproveita o papo 😺',
 'bem-vindo(a) ao grupo! Que venham boas conversas 🌙',
 'tem gente nova na área! Recebam com carinho 💜',
];

export async function triggerWelcomeTest(sock, chatJid, participantJid) {
 if (!chatJid?.endsWith('@g.us')) throw new Error('Este teste de evento só funciona em grupos.');
 const resolvedJid = await resolveParticipant(sock, participantJid);
 const mentionJid = resolvedJid || participantJid;
 const mention = String(mentionJid).split('@')[0];
 const greeting = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
 const caption = '@' + mention + ', ' + greeting;
 try {
  const image = await renderWelcomeCard(sock, resolvedJid);
  await sock.sendMessage(chatJid, { image, caption, mentions: [mentionJid] });
 } catch (error) {
  console.error('[welcome] Não foi possível gerar a imagem:', error.message);
  await sock.sendMessage(chatJid, { text: caption, mentions: [mentionJid] });
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


const X9_TTL_MS = 10 * 60 * 1000;
const x9Messages = new Map();

function unwrapMessage(message) {
 let content = message?.message ?? {};
 for (let i = 0; i < 4; i++) {
  const next = content.ephemeralMessage?.message
   ?? content.viewOnceMessage?.message
   ?? content.viewOnceMessageV2?.message
   ?? content.documentWithCaptionMessage?.message;
  if (!next) break;
  content = next;
 }
 return content;
}

function getPlainText(message) {
 const content = unwrapMessage(message);
 const value = content.conversation ?? content.extendedTextMessage?.text;
 return typeof value === 'string' ? value.trim() : '';
}

export async function handleX9Message(sock, message) {
 const key = message?.key;
 const jid = key?.remoteJid;
 if (!jid?.endsWith('@g.us') || !key?.id) return;
 const settings = await getGroup(jid);
 const cacheKey = jid + ':' + key.id;
 const protocol = unwrapMessage(message).protocolMessage;
 const isRevoke = protocol?.type ===  revokeType();
 if (isRevoke) {
  if (!settings.x9) return;
  const originalKey = protocol.key;
  if (!originalKey?.id) return;
  const originalJid = originalKey.remoteJid || jid;
  if (originalJid !== jid) return;
  const originalCacheKey = jid + ':' + originalKey.id;
  const saved = x9Messages.get(originalCacheKey);
  if (!saved || Date.now() - saved.createdAt > X9_TTL_MS) {
   x9Messages.delete(originalCacheKey);
   return;
  }
  x9Messages.delete(originalCacheKey);
  try {
   const author = saved.authorJid;
   await sock.sendMessage(jid, {
    text: '💜 *NYX BOT — X9*\\n👤 *Autor:* @' + author.split('@')[0].split(':')[0] +
      '\\n📝 *Conteúdo:* ' + saved.text + '\\n🔎 _Mensagem excluída._',
    mentions: [author],
   });
  } catch (error) {
   console.error('[x9] Não foi possível reenviar a mensagem:', error?.message ?? error);
  }
  return;
 }
 if (!settings.x9 || key.fromMe) return;
 const text = getPlainText(message);
 if (!text || !key.id) return;
 const authorJid = key.participant || '';
 if (!authorJid) return;
 x9Messages.set(cacheKey, { text, authorJid, createdAt: Date.now() });
 const timer = setTimeout(() => {
  const current = x9Messages.get(cacheKey);
  if (current && current.createdAt + X9_TTL_MS <= Date.now()) x9Messages.delete(cacheKey);
 }, X9_TTL_MS + 50);
 timer.unref?.();
}

// Baileys ProtocolMessageType.REVOKE is 0; keep compatible with numeric enum values.
function revokeType() { return 0; }

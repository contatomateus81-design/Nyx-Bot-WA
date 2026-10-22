import { getGroup } from './store.js';
import { getText, getGroupContext } from './utils.js';
import { renderWelcomeCard } from './welcome/render.js';

const contactNames = new Map();
function normalizeJid(jid = '') { return String(jid).split(':')[0].trim().toLowerCase(); }
function rememberContactName(jid, name) {
 const value = String(name ?? '').replace(/[\\r\\n]+/g, ' ').trim();
 if (jid && value && !/^\\+?\\d+$/.test(value) && value.length <= 80) contactNames.set(normalizeJid(jid), value);
}
export function rememberContact(jid, name) { rememberContactName(jid, name); }

async function resolveParticipant(sock, jid) {
 if (!String(jid).endsWith('@lid')) return jid;
 try {
  const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
  if (typeof mapped === 'string' && mapped.includes('@s.whatsapp.net')) return mapped;
 } catch (error) {
  console.warn('[welcome] Não foi possível resolver o LID para número:', error.message);
 }
 return jid;
}

function participantNumber(jid = '', member = {}) {
 for (const candidate of [member.phoneNumber, jid, member.id]) {
  if (!candidate || String(candidate).endsWith('@lid')) continue;
  const digits = String(candidate).split('@')[0].split(':')[0].replace(/\\D/g, '');
  if (digits.length >= 8) return digits;
 }
 return null;
}
function findContactName(sock, jids, member) {
 const candidates = [
  member?.notify, member?.name, member?.pushName, member?.verifiedName,
  ...jids.flatMap(jid => [
   sock?.store?.contacts?.[jid]?.notify,
   sock?.store?.contacts?.[jid]?.name,
   sock?.store?.contacts?.[jid]?.verifiedName,
   contactNames.get(normalizeJid(jid))
  ])
 ];
 return candidates.find(value => typeof value === 'string' && value.trim() && !/^\\+?\\d+$/.test(value.trim()))?.trim() ?? 'Novo membro';
}

export async function handleGroupMessage(sock, message) {
 const jid = message.key.remoteJid;
 if (!jid?.endsWith('@g.us') || message.key.fromMe) return;
 const settings = await getGroup(jid);
 if (!settings.antiLink) return;
 const text = getText(message);
 if (!/(chat\\.whatsapp\\.com\\/|https?:\\/\\/|www\\.)/i.test(text)) return;
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
 let members = [];
 try { members = (await sock.groupMetadata(update.id)).participants ?? []; }
 catch (error) { console.error('[welcome] Não foi possível consultar os dados do grupo:', error.message); }

 for (const participant of update.participants) {
  const resolvedJid = await resolveParticipant(sock, participant);
  const normalizedIds = [participant, resolvedJid].map(normalizeJid);
  const member = members.find(item =>
   [item.id, item.lid, item.phoneNumber].filter(Boolean).some(id => normalizedIds.includes(normalizeJid(id)))
  ) ?? {};
  const number = participantNumber(resolvedJid, member);
  const name = findContactName(sock, [...new Set([participant, resolvedJid, member.id, member.phoneNumber].filter(Boolean))], member);
  const mentionJid = number ? number + '@s.whatsapp.net' : participant;
  const mention = '@' + (number || String(participant).split('@')[0]);
  // Keep each field semantically distinct: phone number, mention, and original WhatsApp participant ID.
  const details = {
   name,
   phone: number ? '+' + number : 'Indisponível',
   mention,
   id: participant || 'Indisponível'
  };
  try {
   const image = await renderWelcomeCard(sock, resolvedJid, details);
   const caption = '💜 Bem-vindo(a), ' + mention + '!\\nQue bom ter você por aqui.\\n\\n📱 Número: ' + details.phone + '\\n🆔 ID: ' + details.id;
   await sock.sendMessage(update.id, { image, caption, mentions: [mentionJid] });
  } catch (error) {
   console.error('[welcome] Não foi possível gerar a imagem:', error.message);
   await sock.sendMessage(update.id, {
    text: '💜 Bem-vindo(a), ' + mention + '!\\n📱 Número: ' + details.phone + '\\n🆔 ID: ' + details.id,
    mentions: [mentionJid]
   });
  }
 }
}

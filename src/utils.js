export function getText(message) {
 return message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? message.message?.imageMessage?.caption ?? message.message?.videoMessage?.caption ?? '';
}
export function getMentionedJids(message) {
 const c = message.message?.extendedTextMessage?.contextInfo ?? message.message?.imageMessage?.contextInfo ?? message.message?.videoMessage?.contextInfo;
 return c?.mentionedJid ?? [];
}
export function getTargetJid(message, args = []) {
 const mentioned = getMentionedJids(message); if (mentioned.length) return mentioned[0];
 const quoted = message.message?.extendedTextMessage?.contextInfo?.participant; if (quoted) return quoted;
 const number = (args[0] ?? '').replace(/\\D/g, ''); return number ? `${number}@s.whatsapp.net` : null;
}
export async function getGroupContext(sock, message, senderJid) {
 const jid = message.key.remoteJid; if (!jid?.endsWith('@g.us')) throw new Error('Este comando só funciona em grupos.');
 const metadata = await sock.groupMetadata(jid); const members = metadata.participants ?? [];
 const normalizeJid = (value = '') => String(value).split(':')[0].trim().toLowerCase();
 const phoneDigits = (value = '') => {
  const base = normalizeJid(value).split('@')[0];
  return base.replace(/\\D/g, '');
 };
 const matchesIdentity = (participant, identities) => {
  const participantIds = [participant?.id, participant?.lid, participant?.phoneNumber].filter(Boolean);
  const normalizedParticipantIds = participantIds.map(normalizeJid);
  if (normalizedParticipantIds.some(id => identities.some(candidate => normalizeJid(candidate) === id))) return true;
  const participantPhones = participantIds.map(phoneDigits).filter(Boolean);
  const identityPhones = identities.map(phoneDigits).filter(Boolean);
  return participantPhones.some(number => identityPhones.includes(number));
 };
 const sender = members.find(p => matchesIdentity(p, [senderJid]));
 const botIdentities = [sock.user?.id, sock.user?.lid, sock.user?.phoneNumber].filter(Boolean);
 const bot = members.find(p => matchesIdentity(p, botIdentities));
 const isAdmin = p => p?.admin === 'admin' || p?.admin === 'superadmin';
 return { jid, metadata, members, sender, bot, isSenderAdmin: isAdmin(sender), isBotAdmin: isAdmin(bot) };
}
export function formatDuration(ms) {
 const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
 return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '<1m';
}

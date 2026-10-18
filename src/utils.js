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
 const number = (args[0] ?? '').replace(/\D/g, ''); return number ? `${number}@s.whatsapp.net` : null;
}
export async function getGroupContext(sock, message, senderJid) {
 const jid = message.key.remoteJid; if (!jid?.endsWith('@g.us')) throw new Error('Este comando só funciona em grupos.');
 const metadata = await sock.groupMetadata(jid); const members = metadata.participants ?? [];
 const norm = (v = '') => v.split(':')[0];
 const sender = members.find(p => norm(p.id) === norm(senderJid));
 const bot = members.find(p => norm(p.id) === norm(sock.user?.id ?? ''));
 const isAdmin = p => p?.admin === 'admin' || p?.admin === 'superadmin';
 return { jid, metadata, members, sender, bot, isSenderAdmin: isAdmin(sender), isBotAdmin: isAdmin(bot) };
}
export function formatDuration(ms) {
 const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
 return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '<1m';
}

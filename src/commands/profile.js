import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { getMentionedJids } from '../utils.js';

const pickInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(6 - n);

function getQuotedParticipant(message) {
  const context = message.message?.extendedTextMessage?.contextInfo
    ?? message.message?.imageMessage?.contextInfo
    ?? message.message?.videoMessage?.contextInfo;
  return context?.participant ?? null;
}

function jidNumber(jid = '') {
  if (jid.endsWith('@lid')) return null;
  const value = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  return value || null;
}

async function getPicture(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    return data.length > 0 && data.length <= 8 * 1024 * 1024 ? data : null;
  } catch {
    return null;
  }
}

async function getBio(sock, jid) {
  try {
    if (typeof sock.fetchStatus !== 'function') return null;
    const result = await sock.fetchStatus(jid);
    const entry = Array.isArray(result) ? result[0] : result;
    const value = typeof entry === 'string' ? entry : entry?.status;
    return typeof value === 'string' && value.trim()
      ? value.trim().replace(/[\r\n]+/g, ' ').slice(0, 180)
      : null;
  } catch {
    return null;
  }
}

registerCommand({
  name: 'perfil',
  aliases: ['ficha', 'profile'],
  role: 'membro',
  async execute({ sock, message, senderJid, chatJid, args }) {
    const mentions = getMentionedJids(message);
    const quotedParticipant = getQuotedParticipant(message);
    const typedNumber = (args[0] ?? '').replace(/\D/g, '');
    let targetJid = mentions[0] ?? quotedParticipant;

    if (!targetJid && typedNumber.length >= 10) {
      targetJid = `${typedNumber}@s.whatsapp.net`;
    }
    if (!targetJid) {
      targetJid = message.key?.fromMe
        ? `${config.ownerNumber}@s.whatsapp.net`
        : senderJid;
    }

    const number = jidNumber(targetJid);
    const isSelf = targetJid === senderJid
      || (message.key?.fromMe && number === config.ownerNumber);
    const name = isSelf
      ? (message.pushName || 'Yato')
      : (mentions.length ? 'Pessoa mencionada' : (message.message?.extendedTextMessage?.contextInfo?.pushName || 'Contato do WhatsApp'));

    const [picture, bio] = await Promise.all([
      getPicture(sock, targetJid),
      getBio(sock, targetJid),
    ]);

    const wanted = pickInt(1, 6);
    const chaos = pickInt(1, 50_000_000);
    const chaosIndex = pickInt(0, 100);
    const groupDanger = pickInt(1, 6);
    const caption = [
      '╭─「 🕵️ FICHA DO SUSPEITO 」',
      '│ ✦ NYX BOT • PERFIL RECREATIVO',
      '├────────────────',
      `│ 👤 Nome: ${name.slice(0, 70)}`,
      `│ 📱 Número: ${number ? '+' + number : 'Indisponível'}`,
      `│ 📝 Bio: ${bio || 'Não disponível'}`,
      '├──「 🎲 ESTATÍSTICAS FICTÍCIAS 」',
      `│ 🚨 Procurado: ${stars(wanted)} (${wanted}/6)`,
      `│ 🤪 Nível de caos: ${chaos.toLocaleString('pt-BR')} / 50.000.000`,
      `│ 🌀 Índice de caos: ${chaosIndex}%`,
      `│ 👑 Perigo nos grupos: nível ${groupDanger}/6`,
      '╰────────────────',
    ].join('\n');

    if (picture) {
      await sock.sendMessage(chatJid, { image: picture, caption }, { quoted: message });
    } else {
      await sock.sendMessage(chatJid, { text: '🖼️ Foto de perfil indisponível; enviando a ficha em texto.\n\n' + caption }, { quoted: message });
    }
  },
});

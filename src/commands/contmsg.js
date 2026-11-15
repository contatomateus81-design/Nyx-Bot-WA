import { registerCommand } from '../handler.js';
import { getGroupContext, getTargetJid } from '../utils.js';
import { getGroupMessageStats } from '../store.js';

const format = (value) => (Number(value) || 0).toLocaleString('pt-BR');

function sameIdentity(a = '', b = '') {
  const normalize = (value) => String(value).split(':')[0].trim().toLowerCase();
  const digits = (value) => normalize(value).split('@')[0].replace(/\\D/g, '');
  if (normalize(a) === normalize(b)) return true;
  const aDigits = digits(a);
  const bDigits = digits(b);
  return aDigits.length >= 10 && aDigits === bDigits;
}

registerCommand({
  name: 'contmsg',
  aliases: ['contarmensagens', 'atividade'],
  async execute(ctx) {
    if (!ctx.isGroup) return ctx.reply('ℹ️ Este comando só funciona em grupos.');

    const group = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
    if (!ctx.isOwner && !group.isSenderAdmin) {
      return ctx.reply('🔒 Somente o dono do bot ou administradores do grupo podem consultar esse relatório.');
    }

    const targetJid = getTargetJid(ctx.message, ctx.args);
    if (!targetJid) {
      return ctx.reply('Marque o membro que deseja consultar. Ex.: }contmsg @usuario');
    }

    const participant = group.members.find((member) =>
      [member.id, member.lid, member.phoneNumber].filter(Boolean)
        .some((identity) => sameIdentity(identity, targetJid))
    );
    if (!participant) {
      return ctx.reply('❌ Não encontrei esse membro entre os participantes do grupo. Marque alguém que esteja no grupo.');
    }

    const targetIds = [participant.id, participant.lid, participant.phoneNumber, targetJid].filter(Boolean);
    const stats = await getGroupMessageStats(group.jid, targetIds);
    const mentionJid = participant.id ?? targetJid;
    const displayId = participant.phoneNumber ?? participant.id ?? targetJid;
    const mentionText = `@${String(displayId).split('@')[0].split(':')[0]}`;

    const caption = [
      '╭━━━〔 💜 NYX • ATIVIDADE 〕━━━╮',
      '',
      `👤 Membro: ${mentionText}`,
      '',
      `💬 Mensagens: ${format(stats.messages)}`,
      `🔗 Links enviados: ${format(stats.links)}`,
      '',
      `📸 Fotos: ${format(stats.photos)}`,
      `🎥 Vídeos: ${format(stats.videos)}`,
      `🎞️ GIFs: ${format(stats.gifs)}`,
      `🎭 Figurinhas: ${format(stats.stickers)}`,
      '',
      '╰━━━━━━━━━━━━━━━━━━━━━━╯',
      stats.messages
        ? '📊 Contagem desde a ativação do contador.'
        : '⏳ Ainda não há mensagens registradas desde a instalação do contador.',
    ].join('\\n');

    let pictureUrl = null;
    for (const identity of [participant.id, participant.lid, participant.phoneNumber, targetJid].filter(Boolean)) {
      try {
        pictureUrl = await ctx.sock.profilePictureUrl(identity, 'image');
        if (pictureUrl) break;
      } catch {
        // A foto pode estar indisponível ou oculta; o relatório em texto continua disponível.
      }
    }

    if (pictureUrl) {
      try {
        return await ctx.sock.sendMessage(group.jid, {
          image: { url: pictureUrl },
          caption,
          mentions: [mentionJid],
        }, { quoted: ctx.message });
      } catch {
        // Fall back to the same report without a profile photo.
      }
    }

    return ctx.sock.sendMessage(group.jid, {
      text: caption,
      mentions: [mentionJid],
    }, { quoted: ctx.message });
  },
});

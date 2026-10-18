import { registerCommand } from '../handler.js';
import { config } from '../config.js';

registerCommand({
  name: 'menu',
  aliases: ['help', 'ajuda'],
  role: 'membro',
  async execute({ reply, senderNumber }) {
    await reply(
      `╭─「 ✦ ${config.name} ✦ 」\n` +
      `│ Prefixo: ${config.prefix}\n` +
      `│ ${config.prefix}menu — mostrar comandos\n` +
      `│ ${config.prefix}ping — testar resposta\n` +
      `│ ${config.prefix}owner — informações do dono\n` +
      `╰────────────────\n` +
      `Olá, @${senderNumber}! 💜`
    );
  },
});

registerCommand({
  name: 'ping',
  role: 'membro',
  async execute({ reply }) {
    await reply('Pong! 🏓 Nyx está online.');
  },
});

registerCommand({
  name: 'owner',
  aliases: ['dono'],
  role: 'membro',
  async execute({ reply }) {
    await reply(config.ownerNumber
      ? `👑 Dono do bot: +${config.ownerNumber}`
      : 'O número do dono ainda não foi configurado.');
  },
});

registerCommand({
  name: 'say',
  aliases: ['dizer'],
  role: 'dono',
  async execute({ reply, args }) {
    if (!args.length) return reply(`Uso: ${config.prefix}say <mensagem>`);
    await reply(args.join(' '));
  },
});

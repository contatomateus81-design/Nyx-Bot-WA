import { registerCommand } from '../handler.js';
import { config } from '../config.js';

registerCommand({
  name: 'menu',
  aliases: ['help', 'ajuda'],
  role: 'membro',
  async execute({ reply }) {
    await reply(`╭─「 ✦ ${config.name} ✦ 」
│ Prefixo: ${config.prefix}
│
│ ✨ GERAL
│ ${config.prefix}ping — testar resposta
│ ${config.prefix}tempo — tempo ligado
│ ${config.prefix}sobre — sobre o bot
│ ${config.prefix}dono — contato do criador
│ ${config.prefix}play nome ou link — baixar áudio
│
│ 👥 GRUPO (admin)
│ ${config.prefix}infogrupo — informações
│ ${config.prefix}totag — marcar todos
│ ${config.prefix}remover — remover membro
│ ${config.prefix}promover / rebaixar
│ ${config.prefix}link / revogar — convite
│ ${config.prefix}nomegrupo / descricao
│ ${config.prefix}fechargrupo / abrirgrupo
│ ${config.prefix}boasvindas on|off
│ ${config.prefix}antilink on|off
│ ${config.prefix}nota adicionar|ver|listar|apagar
│ ${config.prefix}aviso — advertir membro
│
│ 🎲 DIVERSÃO
│ ${config.prefix}escolher A | B
│ ${config.prefix}bola8 pergunta
╰──────────────────────`);
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
  name: 'dono',
  aliases: ['owner'],
  role: 'membro',
  async execute({ sock, chatJid, message }) {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Nyx;Criador Oficial;;;',
      'FN:Criador Oficial do Nyx Bot',
      'TEL;type=CELL;type=VOICE;waid=555481296959:+555481296959',
      'END:VCARD',
    ].join('\n');
    await sock.sendMessage(
      chatJid,
      { contacts: { displayName: 'Criador Oficial do Nyx Bot', contacts: [{ vcard }] } },
      { quoted: message },
    );
  },
});

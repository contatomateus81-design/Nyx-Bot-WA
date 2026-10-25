import { registerCommand } from '../handler.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const MENU_CATEGORIES = [
  { id: 'principal', title: '🏠 PRINCIPAL', description: 'Informações e comandos gerais', lines: [
    ['ping', 'Testa a resposta da Nyx.'], ['tempo', 'Mostra há quanto tempo o bot está ligado.'],
    ['sobre', 'Conheça o Nyx Bot.'], ['dono', 'Contato do criador.'], ['status', 'Diagnóstico do bot.'],
  ] },
  { id: 'downloads', title: '🎵 DOWNLOADS', description: 'Músicas e áudio', lines: [
    ['play <nome ou link>', 'Pesquisa e baixa áudio compatível.'],
  ] },
  { id: 'brincadeiras', title: '🎮 BRINCADEIRAS', description: 'Comandos divertidos', lines: [
    ['escolher opção A | opção B', 'Escolhe entre opções.'], ['bola8 <pergunta>', 'Responde de forma divertida.'],
    ['perfil [@pessoa]', 'Gera uma ficha recreativa.'],
  ] },
  { id: 'figurinhas', title: '🖼️ FIGURINHAS', description: 'Criação de figurinhas', lines: [
    ['fig', 'Envie uma imagem com a legenda do comando ou responda a uma imagem.'],
  ] },
  { id: 'ia', title: '🤖 IA E VOZ', description: 'Texto para voz e recursos inteligentes', lines: [
    ['tts <texto>', 'Converte texto em áudio quando o Piper está configurado.'],
  ] },
  { id: 'ferramentas', title: '🛠️ FERRAMENTAS', description: 'Informações e utilidades', lines: [
    ['infogrupo', 'Mostra informações do grupo.'],
    ['nota adicionar <nome> <texto>', 'Salva uma nota para o grupo.'],
    ['nota ver <nome> / nota listar / nota apagar <nome>', 'Consulta e gerencia notas do grupo.'],
  ] },
  { id: 'admin', title: '👑 ADMINISTRAÇÃO', description: 'Comandos para administradores', lines: [
    ['totag [mensagem]', 'Marca os participantes.'], ['remover @pessoa', 'Remove um participante.'],
    ['promover @pessoa', 'Promove um participante.'], ['rebaixar @pessoa', 'Rebaixa um administrador.'],
    ['nomegrupo <nome>', 'Altera o nome do grupo.'], ['descricao <texto>', 'Altera a descrição.'],
    ['fechargrupo / abrirgrupo', 'Restringe ou libera mensagens.'], ['boasvindas 1|0', 'Ativa/desativa boas-vindas.'],
    ['antilink 1|0', 'Ativa/desativa bloqueio de links.'],
    ['link / revogar', 'Gera ou revoga o convite do grupo.'], ['aviso @pessoa', 'Registra um aviso para um participante.'],
  ] },
];

function formatMenuDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date);
}

async function sendMainMenu(ctx) {
  const { sock, chatJid, message, senderJid, isGroup, commandStartedAt } = ctx;
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const originalPath = new URL('../../mídia/menu.jpg', import.meta.url);
  const originalImage = await loadImage(fileURLToPath(originalPath));
  let groupName = isGroup ? 'Grupo (nome indisponível)' : 'PV';
  if (isGroup) {
    try { groupName = (await sock.groupMetadata(chatJid)).subject || groupName; } catch {}
  }
  const username = String(message.pushName ?? '').trim().slice(0, 32) || senderJid.split('@')[0];
  const elapsed = Math.max(0, Date.now() - (commandStartedAt ?? Date.now()));
  const width = 900;
  const padding = 42;
  const lineHeight = 34;
  const headerLines = [
    '╭━━━〔 💜 NYX BOT 〕━━━╮',
    '',
    `👤 Usuário: ${username}`,
    `⚡ Comando: ${config.prefix}menu`,
    `📅 Data/Hora: ${formatMenuDate()}`,
    `👥 Grupo: ${String(groupName).replace(/[\\r\\n]+/g, ' ').slice(0, 45)}`,
    `🚀 Ping: ${elapsed} ms`,
    `🔰 Prefixo: ${config.prefix}`,
    '',
    '╰━━━━━━━━━━━━━━━━━━━━╯',
  ];
  const menuLines = [
    '│ ✨ GERAL',
    `│ ${config.prefix}ping — testar resposta`,
    `│ ${config.prefix}tempo — tempo ligado`,
    `│ ${config.prefix}sobre — sobre o bot`,
    `│ ${config.prefix}dono — contato do criador`,
    `│ ${config.prefix}play nome ou link — baixar áudio`,
    `│ ${config.prefix}tts texto — falar em áudio (TTS local)`,
    `│ ${config.prefix}status — diagnóstico do bot`,
    `│ ${config.prefix}fig — criar figurinha de imagem`,
    `│ ${config.prefix}perfil [@pessoa] — ficha divertida`,
    '',
    '│ 👥 GRUPO (admin)',
    `│ ${config.prefix}infogrupo — informações`,
    `│ ${config.prefix}totag — marcar todos`,
    `│ ${config.prefix}remover — remover membro`,
    `│ ${config.prefix}promover / rebaixar`,
    `│ ${config.prefix}link / revogar — convite`,
    `│ ${config.prefix}nomegrupo / descricao`,
    `│ ${config.prefix}fechargrupo / abrirgrupo`,
    `│ ${config.prefix}boasvindas 1|0 (on|off)`,
    `│ ${config.prefix}antilink 1|0 (on|off)`,
    `│ ${config.prefix}nota adicionar|ver|listar|apagar`,
    `│ ${config.prefix}aviso — advertir membro`,
    '',
    '│ 🎲 DIVERSÃO',
    `│ ${config.prefix}escolher A | B`,
    `│ ${config.prefix}bola8 pergunta`,
    '╰──────────────────────',
  ];
  const height = Math.max(1700, 450 + (headerLines.length + menuLines.length) * lineHeight);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#160d27';
  context.fillRect(0, 0, width, height);
  const imageHeight = 320;
  const scale = Math.max(width / originalImage.width, imageHeight / originalImage.height);
  const cropWidth = width / scale;
  const cropHeight = imageHeight / scale;
  context.drawImage(originalImage,
    (originalImage.width - cropWidth) / 2, (originalImage.height - cropHeight) / 2,
    cropWidth, cropHeight, 0, 0, width, imageHeight);
  context.fillStyle = '#d9b8ff';
  context.font = 'bold 28px sans-serif';
  context.textBaseline = 'top';
  let y = imageHeight + 30;
  for (const line of headerLines) {
    context.fillStyle = line.includes('NYX BOT') ? '#ffffff' : '#e8dcff';
    context.font = line.includes('NYX BOT') ? 'bold 30px sans-serif' : '24px sans-serif';
    context.fillText(line, padding, y);
    y += lineHeight;
  }
  y += 14;
  context.strokeStyle = '#8055b5';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding, y);
  context.lineTo(width - padding, y);
  context.stroke();
  y += 20;
  context.font = '25px sans-serif';
  for (const line of menuLines) {
    context.fillStyle = line.includes('GERAL') || line.includes('GRUPO') || line.includes('DIVERSÃO')
      ? '#d7aaff' : '#ffffff';
    context.fillText(line, padding, y);
    y += lineHeight;
  }
  await sock.sendMessage(chatJid, { image: await canvas.encode('png') }, { quoted: message });
}
async function sendMenuCategory(ctx, categoryId) {
  const category = MENU_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return ctx.reply(`Não reconheci essa categoria. Envie ${config.prefix}menu para abrir a lista novamente.`);
  const body = [
    `╭━━━〔 ${category.title} 〕━━━╮`, '┃',
    ...category.lines.flatMap(([syntax, description]) => [
      `┃ ✦ ${config.prefix}${syntax}`, `┃   ${description}`, '┃',
    ]),
    '╰━━━━━━━━━━━━━━━━━━━━╯', '', `📋 Para voltar às categorias, envie ${config.prefix}menu.`,
  ].join('\n');
  await ctx.sock.sendMessage(ctx.chatJid, { text: body }, { quoted: ctx.message });
}

registerCommand({
  name: 'menu',
  aliases: ['help', 'ajuda'],
  role: 'membro',
  async execute(ctx) {
    if (ctx.args?.[0]) {
      const requested = String(ctx.args[0]).toLowerCase();
      const numericIndex = /^\d+$/.test(requested) ? Number(requested) - 1 : -1;
      const categoryId = numericIndex >= 0 && numericIndex < MENU_CATEGORIES.length
        ? MENU_CATEGORIES[numericIndex].id
        : requested;
      return sendMenuCategory(ctx, categoryId);
    }
    await sendMainMenu(ctx);
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


registerCommand({
  name: 'sobre',
  aliases: ['about', 'infobot'],
  role: 'membro',
  async execute({ sock, chatJid, message, reply }) {
    const about = `╭─「 💜 ${config.name} 」
│ Sua assistente para WhatsApp
│
│ ✨ O QUE EU FAÇO
│ • Comandos úteis e divertidos
│ • Ferramentas para grupos
│ • Figurinhas, áudio e texto para voz
│ • Perfil divertido e boas-vindas
│
│ 🌐 SITE OFICIAL
│ https://nyx-bot-creator.vercel.app/
│
│ 💡 Use ${config.prefix}menu para ver
│ os comandos disponíveis.
╰──────────────────────`;

    try {
      const background = await readFile(new URL('../../mídia/nyx-background.jpg', import.meta.url));
      await sock.sendMessage(chatJid, {
        image: background,
        caption: about,
      }, { quoted: message });
    } catch {
      await reply(about);
    }
  },
});

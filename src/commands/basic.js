import { registerCommand } from '../handler.js';
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { generateWAMessageContent, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

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

async function sendInteractiveButtons(ctx, { text, buttons, image }) {
  const { sock, chatJid, message } = ctx;
  let header = { title: '💜 NYX BOT', hasMediaAttachment: false };
  if (image) {
    const uploadedImage = await generateWAMessageContent(
      { image },
      { upload: sock.waUploadToServer },
    );
    header = {
      title: '💜 NYX BOT',
      hasMediaAttachment: true,
      imageMessage: uploadedImage.imageMessage,
    };
  }
  const interactiveContent = proto.Message.fromObject({
    interactiveMessage: {
      header,
      body: { text },
      footer: { text: 'NYX BOT • Menu interativo' },
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: buttons.map((button) => ({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: button.label,
            id: button.id,
          }),
        })),
      },
    },
  });
  const outgoing = generateWAMessageFromContent(chatJid, interactiveContent, {
    userJid: sock.user?.id,
    quoted: message,
  });
  await sock.relayMessage(chatJid, outgoing.message, {
    messageId: outgoing.key.id,
    additionalNodes: [{
      tag: 'biz',
      attrs: {},
      content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' } }],
    }],
  });
}

function menuButtonsForPage(page) {
  if (page === 1) {
    return [
      { label: '🎮 Brincadeiras', id: 'nyxmenu:brincadeiras' },
      { label: '🖼️ Figurinhas', id: 'nyxmenu:figurinhas' },
      { label: '➡️ Mais menus', id: 'nyxmenu:mais2' },
    ];
  }
  if (page === 2) {
    return [
      { label: '🤖 IA e Voz', id: 'nyxmenu:ia' },
      { label: '🛠️ Ferramentas', id: 'nyxmenu:ferramentas' },
      { label: '👑 Administração', id: 'nyxmenu:admin' },
    ];
  }
  return [
    { label: '🏠 Principal', id: 'nyxmenu:principal' },
    { label: '🎵 Downloads', id: 'nyxmenu:downloads' },
    { label: '➡️ Mais menus', id: 'nyxmenu:mais' },
  ];
}

async function sendMainMenu(ctx) {
  const { sock, chatJid, message, senderJid, isGroup, commandStartedAt } = ctx;
  const menuImage = await readFile(new URL('../../mídia/menu.jpg', import.meta.url));
  let groupName = isGroup ? 'Grupo (nome indisponível)' : 'Conversa privada';
  if (isGroup) {
    try { groupName = (await sock.groupMetadata(chatJid)).subject || groupName; } catch {}
  }
  const username = String(message.pushName ?? '').trim().slice(0, 80) || senderJid.split('@')[0];
  const elapsed = Math.max(0, Date.now() - (commandStartedAt ?? Date.now()));
  const caption = [
    '╭━━━〔 💜 NYX BOT 〕━━━╮', '┃',
    `┃ 👤 Usuário: ${username} (@${senderJid.split('@')[0]})`,
    `┃ ⚡ Comando: ${config.prefix}menu`,
    `┃ 📅 Data/Hora: ${formatMenuDate()}`,
    `┃ 👥 Grupo: ${String(groupName).replace(/[\\r\\n]+/g, ' ').slice(0, 100)}`,
    `┃ 🚀 Ping: ${elapsed} ms`, '┃', '╰━━━━━━━━━━━━━━━━━━━━╯',
    '', 'Escolha um menu nos botões abaixo.',
  ].join('\\n');
  await sendInteractiveButtons(ctx, {
    text: caption,
    image: menuImage,
    buttons: menuButtonsForPage(0),
  });
}
async function sendMoreMenus(ctx, page = 1) {
  const text = page === 1
    ? '💜 NYX BOT • MAIS MENUS\\nEscolha uma categoria:'
    : '💜 NYX BOT • ÚLTIMOS MENUS\\nEscolha uma categoria:';
  await sendInteractiveButtons(ctx, { text, buttons: menuButtonsForPage(page) });
}

async function sendMenuCategory(ctx, categoryId) {
  if (categoryId === 'mais') return sendMoreMenus(ctx, 1);
  if (categoryId === 'mais2') return sendMoreMenus(ctx, 2);
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
      const numericIndex = /^\\d+$/.test(requested) ? Number(requested) - 1 : -1;
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

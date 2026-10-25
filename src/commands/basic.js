import { registerCommand } from '../handler.js';
import { readFile } from 'node:fs/promises';
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
  const { sock, chatJid, message } = ctx;
  // Teste isolado: envia apenas o seletor nativo, sem imagem nem proto manual.
  await sock.sendMessage(chatJid, {
    interactiveMessage: {
      header: '💜 NYX BOT',
      title: 'Escolha uma categoria',
      footer: 'NYX BOT • Menu interativo',
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Ver categorias',
          sections: [{
            title: 'Categorias disponíveis',
            rows: MENU_CATEGORIES.map((category) => ({
              title: category.title,
              description: category.description,
              id: `nyxmenu:${category.id}`,
            })),
          }],
        }),
      }],
    },
  }, { quoted: message });
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

import { registerCommand, getRegisteredCommands, getRegisteredCommand } from '../handler.js';
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';

function formatMenuDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date);
}

async function getMenuHeader(ctx, commandName) {
  const { sock, chatJid, senderJid, isGroup, commandStartedAt } = ctx;
  let actualSenderJid = senderJid;
  if (String(actualSenderJid).endsWith('@lid')) {
    try {
      const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(actualSenderJid);
      if (typeof mapped === 'string' && mapped.endsWith('@s.whatsapp.net')) actualSenderJid = mapped;
    } catch (error) {
      console.warn('[menu] Não foi possível resolver o LID do remetente:', error?.message ?? error);
    }
  }
  const username = `@${actualSenderJid.split('@')[0].split(':')[0]}`;
  let groupName = isGroup ? 'Grupo (nome indisponível)' : 'PV';
  if (isGroup) {
    try { groupName = (await sock.groupMetadata(chatJid)).subject || groupName; } catch {}
  }
  const elapsed = Math.max(0, Date.now() - (commandStartedAt ?? Date.now()));
  return {
    actualSenderJid,
    text: [
      '╭━━━〔 💜 NYX BOT 〕━━━╮',
      '',
      `👤 Usuário: ${username}`,
      `⚡ Comando: ${config.prefix}${commandName}`,
      `📅 Data/Hora: ${formatMenuDate()}`,
      `👥 Grupo: ${String(groupName).replace(/[\r\n]+/g, ' ').slice(0, 70)}`,
      `🚀 Ping: ${elapsed} ms`,
      `🔰 Prefixo: ${config.prefix}`,
      '',
      '╰━━━━━━━━━━━━━━━━━━━━╯',
    ].join('\n'),
  };
}

const COMMAND_INFO = {
  menu: { description: 'Mostrar o menu geral de comandos.' },
  menuadm: { description: 'Mostrar os comandos de administração de grupos.' },
  menudono: { description: 'Mostrar os comandos exclusivos do dono.' },
  info: { description: 'Mostrar a descrição, o modo de uso e os aliases de um comando.', usage: 'info nome_do_comando' },
  ping: { description: 'Verificar se a Nyx está respondendo.' },
  dono: { description: 'Mostrar o contato do criador oficial do bot.' },
  sobre: { description: 'Mostrar informações sobre a Nyx Bot.' },
  tempo: { description: 'Mostrar há quanto tempo o processo do bot está ligado.' },
  escolher: { description: 'Escolher aleatoriamente uma opção entre as opções informadas.', usage: 'escolher opção 1 | opção 2' },
  bola8: { description: 'Responder a uma pergunta com uma resposta aleatória.', usage: 'bola8 sua pergunta' },
  infogrupo: { description: 'Mostrar informações básicas do grupo.' },
  totag: { description: 'Marcar todos os participantes do grupo.', usage: 'totag [mensagem]' },
  remover: { description: 'Remover um participante do grupo.', usage: 'remover @pessoa' },
  promover: { description: 'Promover um participante a administrador.', usage: 'promover @pessoa' },
  rebaixar: { description: 'Remover o cargo de administrador de um participante.', usage: 'rebaixar @pessoa' },
  link: { description: 'Gerar o link de convite do grupo.' },
  revogar: { description: 'Revogar o link de convite atual do grupo.' },
  nomegrupo: { description: 'Alterar o nome do grupo.', usage: 'nomegrupo novo nome' },
  descricao: { description: 'Alterar a descrição do grupo.', usage: 'descricao nova descrição' },
  fechargrupo: { description: 'Restringir o envio de mensagens aos administradores.' },
  abrirgrupo: { description: 'Liberar o envio de mensagens para todos os participantes.' },
  x9: { description: 'Ativar ou desativar o registro de mensagens de texto excluídas.', usage: 'x9 1 | x9 0' },
  boasvindas: { description: 'Ativar ou desativar as mensagens de boas-vindas.', usage: 'boasvindas [1|0]' },
  antilink: { description: 'Ativar ou desativar a proteção contra links no grupo.', usage: 'antilink [1|0]' },
  nota: { description: 'Adicionar, consultar, listar ou apagar notas do grupo.', usage: 'nota adicionar <nome> <texto> | ver <nome> | listar | apagar <nome>' },
  aviso: { description: 'Registrar uma advertência para um participante.', usage: 'aviso @pessoa' },
  say: { description: 'Enviar uma mensagem pelo bot.', usage: 'say mensagem' },
  chatid: { description: 'Mostrar o identificador deste chat.' },
  botname: { description: 'Mostrar o nome configurado para o bot.' },
  adddono: { description: 'Conceder poderes de dono adicional a uma pessoa.', usage: 'adddono @pessoa ou número' },
  deldono: { description: 'Remover os poderes de dono adicional de uma pessoa.', usage: 'deldono @pessoa ou número' },
  test: { description: 'Testar um evento ou executar outro comando em modo de teste.', usage: 'test <evento ou comando> [argumentos]' },
  crash: { description: 'Executar um teste controlado do tratamento de erros.', usage: 'crash [erro]' },
  play: { description: 'Baixar áudio de uma música ou de um link compatível com yt-dlp.', usage: 'play nome da música ou link' },
  fig: { description: 'Criar uma figurinha a partir de uma imagem enviada com o comando ou respondida com ele.', usage: 'fig (na legenda da imagem ou respondendo à imagem)' },
  perfil: { description: 'Mostrar uma ficha recreativa de você ou de outra pessoa.', usage: 'perfil [@pessoa]' },
  status: { description: 'Mostrar o estado da conexão, memória e recursos do bot.' },
  tts: { description: 'Converter um texto em áudio usando o Piper configurado localmente.', usage: 'tts texto' },
  tomp3: { description: 'Extrair o áudio de um vídeo e convertê-lo para MP3.', usage: 'tomp3 (respondendo a um vídeo ou na legenda)' },
  'agenda-criar': { description: 'Criar um evento e agendar lembretes para ele.', usage: 'agenda-criar DD/MM/AAAA HH:MM nome do evento' },
  'agenda-lista': { description: 'Listar os eventos futuros salvos na agenda global.' },
  'agenda-limpar': { description: 'Apagar todos os eventos salvos na agenda global.' },
};

async function sendMenu(ctx, commandName, title, commandNames) {
  const header = await getMenuHeader(ctx, commandName);
  const caption = [
    header.text,
    '',
    `╭━━━〔 ${title} 〕━━━╮`,
    ...commandNames.map((name) => `│ ${config.prefix}${name}`),
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    `📋 Para voltar, envie ${config.prefix}menu.`,
  ].join('\\n');
  const image = await readFile(new URL('../../mídia/menu.jpg', import.meta.url));
  await ctx.sock.sendMessage(ctx.chatJid, {
    image, caption, mentions: [header.actualSenderJid],
  }, { quoted: ctx.message });
}

async function sendMainMenu(ctx) {
  const header = await getMenuHeader(ctx, 'menu');
  const sections = [
    '╭━━━〔 📋 MENU 📋 〕━━━╮',
    `│ ${config.prefix}menu`,
    `│ ${config.prefix}menuadm`,
    `│ ${config.prefix}menudono`,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    '╭━━━〔 ✨ GERAL 〕━━━╮',
    ...['info','ping','tempo','sobre','dono','play','tts','status','fig','perfil','tomp3'].map((name) => `│ ${config.prefix}${name}`),
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    '╭━━━〔 🎲 DIVERSÃO 〕━━━╮',
    `│ ${config.prefix}escolher`,
    `│ ${config.prefix}bola8`,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
  ];
  const caption = [header.text, '', ...sections].join('\\n');
  const image = await readFile(new URL('../../mídia/menu.jpg', import.meta.url));
  await ctx.sock.sendMessage(ctx.chatJid, {
    image, caption, mentions: [header.actualSenderJid],
  }, { quoted: ctx.message });
}

async function sendInfo(ctx) {
  const requestedName = String(ctx.args[0] ?? '').trim();
  if (!requestedName) {
    return ctx.reply(`💜 Informe o comando que deseja consultar.\\nExemplo: ${config.prefix}info play`);
  }
  const command = getRegisteredCommand(requestedName);
  if (!command) {
    return ctx.reply(`❌ Não encontrei o comando "${requestedName}". Confira o nome e tente novamente.`);
  }
  const details = COMMAND_INFO[command.name] ?? {};
  const usage = details.usage ?? command.usage ?? command.name;
  const aliases = command.aliases ?? [];
  const lines = [
    '💜 *INFORMAÇÕES DO COMANDO*',
    '',
    `🎵 *Comando:* ${config.prefix}${command.name}`,
    '',
    details.description ?? command.description ?? 'Ainda não há uma descrição cadastrada para este comando.',
    '',
    `📌 *Como usar:* ${config.prefix}${usage}`,
    ...(aliases.length ? ['', '*Também pode ser usado com:*', ...aliases.map((alias) => `${config.prefix}${alias}`)] : []),
  ];
  await ctx.reply(lines.join('\\n'));
}

async function sendRegistryMenu(ctx, { commandName, role, title }) {
  const names = getRegisteredCommands(role)
    .filter((command) => command.name !== commandName)
    .map((command) => command.name);
  if (role === 'admin') names.unshift('infogrupo');
  await sendMenu(ctx, commandName, title, names);
}

registerCommand({
  name: 'menu',
  aliases: ['help', 'ajuda'],
  role: 'membro',
  async execute(ctx) {
    await sendMainMenu(ctx);
  },
});

registerCommand({
  name: 'menuadm',
  aliases: ['menu-admin'],
  role: 'membro',
  async execute(ctx) {
    await sendRegistryMenu(ctx, {
      commandName: 'menuadm',
      role: 'admin',
      title: '👥 MENU ADMIN',

    });
  },
});

registerCommand({
  name: 'menudono',
  aliases: ['menu-dono'],
  role: 'dono',
  async execute(ctx) {
    await sendRegistryMenu(ctx, {
      commandName: 'menudono',
      role: 'dono',
      title: '👑 MENU DO DONO',

    });
  },
});

registerCommand({
  name: 'info',
  aliases: ['informacao', 'informações'],
  role: 'membro',
  async execute(ctx) {
    await sendInfo(ctx);
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
      await sock.sendMessage(chatJid, { image: background, caption: about }, { quoted: message });
    } catch {
      await reply(about);
    }
  },
});

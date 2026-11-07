import { registerCommand, getRegisteredCommands } from '../handler.js';
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
      `👥 Grupo: ${String(groupName).replace(/[\\r\\n]+/g, ' ').slice(0, 70)}`,
      `🚀 Ping: ${elapsed} ms`,
      `🔰 Prefixo: ${config.prefix}`,
      '',
      '╰━━━━━━━━━━━━━━━━━━━━╯',
    ].join('\\n'),
  };
}

async function sendMainMenu(ctx) {
  const header = await getMenuHeader(ctx, 'menu');
  const menuText = [
    header.text,
    '',
    '╭━━━〔 📋 MENU 📋 〕━━━╮',
    `│ ${config.prefix}menu`,
    `│ ${config.prefix}menuadm`,
    `│ ${config.prefix}menudono`,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    '╭━━━〔 ✨ GERAL 〕━━━╮',
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
    '╭━━━〔 🎲 DIVERSÃO 〕━━━╮',
    `│ ${config.prefix}escolher A | B`,
    `│ ${config.prefix}bola8 pergunta`,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
  ].join('\\n');

  const image = await readFile(new URL('../../mídia/menu.jpg', import.meta.url));
  await ctx.sock.sendMessage(ctx.chatJid, {
    image, caption: menuText, mentions: [header.actualSenderJid],
  }, { quoted: ctx.message });
}

const ADMIN_DESCRIPTIONS = {
  infogrupo: 'Mostrar informações do grupo.',
  totag: 'Marcar todos os participantes.',
  remover: 'Remover um participante.',
  promover: 'Promover um participante a administrador.',
  rebaixar: 'Remover o cargo de administrador.',
  link: 'Gerar o convite do grupo.',
  revogar: 'Revogar o convite atual.',
  nomegrupo: 'Alterar o nome do grupo.',
  descricao: 'Alterar a descrição do grupo.',
  fechargrupo: 'Permitir mensagens somente de administradores.',
  abrirgrupo: 'Liberar mensagens para todos.',
  boasvindas: 'Ativar ou desativar as boas-vindas.',
  antilink: 'Ativar ou desativar o anti-link.',
  x9: 'Ativar ou desativar o registro de mensagens excluídas.',
  nota: 'Adicionar, consultar, listar ou apagar notas.',
  aviso: 'Advertir um participante.',
};

const OWNER_DESCRIPTIONS = {
  'agenda-lista': 'Listar os eventos futuros de todas as conversas.',
  'agenda-limpar': 'Apagar todos os eventos da agenda.',
  adddono: 'Conceder poderes de dono adicional (somente dono oficial).',
  deldono: 'Remover poderes de dono adicional (somente dono oficial).',
  say: 'Enviar uma mensagem pelo bot.',
  chatid: 'Mostrar o ID deste chat.',
  botname: 'Mostrar o nome configurado para o bot.',
  test: 'Testar um evento ou executar um comando de teste.',
};

async function sendRegistryMenu(ctx, { commandName, role, title, descriptions, extraLines = [] }) {
  const header = await getMenuHeader(ctx, commandName);
  const commands = getRegisteredCommands(role);
  const lines = commands.map((command) => {
    const aliases = command.aliases?.length ? ` (atalhos: ${command.aliases.map((alias) => config.prefix + alias).join(', ')})` : '';
    const description = descriptions[command.name] || command.description || 'Comando registrado.';
    return `│ ${config.prefix}${command.name}${aliases} — ${description}`;
  });
  const body = [
    header.text,
    '',
    `╭━━━〔 ${title} 〕━━━╮`,
    ...extraLines.map((line) => `│ ${line}`),
    ...lines,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    `📋 Para voltar, envie ${config.prefix}menu.`,
  ].join('\\n');
  await ctx.sock.sendMessage(ctx.chatJid, {
    text: body,
    ...(role === 'dono' ? { mentions: [header.actualSenderJid] } : {}),
  }, { quoted: ctx.message });
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
      descriptions: ADMIN_DESCRIPTIONS,
      extraLines: ['Comandos de administração de grupos'],
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
      descriptions: OWNER_DESCRIPTIONS,
      extraLines: ['Comandos exclusivos do proprietário e donos adicionais'],
    });
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
    ].join('\\n');
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
